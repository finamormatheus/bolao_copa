@AGENTS.md

# Bolão Copa do Mundo 2026

Aplicação web de bolão para a Copa do Mundo 2026. Participantes fazem palpites nos placares dos jogos, escolhem o campeão do torneio e disputam um ranking em tempo real dentro de grupos privados.

## Stack

- **Frontend/Backend:** Next.js 16 (App Router, TypeScript, shadcn/ui + Tailwind)
- **Auth + Banco:** Supabase (Postgres + RLS + Google OAuth)
- **Deploy:** Vercel
- **Automação:** pg_cron no Supabase (substitui GitHub Actions e middleware)

## Estrutura principal

```
app/
  (auth)/login/         — login Google OAuth
  (dashboard)/
    layout.tsx          — shell autenticado: valida sessão e membership de grupo
    palpites/           — página de palpites (Server + Client component)
    ranking/            — ranking com deltas de posição e pontos provisórios
    regras/             — explicação do sistema de pontos

lib/
  supabase/             — três clientes: browser, SSR (cookies), service role (cron)
  scoring/calculator.ts — lógica de pontuação isolada e testável
  worldcup26/           — cliente da API primária de fixtures/resultados
  api-football/         — cliente da API secundária (live scores)
  the-odds-api/         — cliente de odds (probabilidades de mercado)
  translations/teams.ts — mapeamento de nomes de times EN→PT

app/api/
  sync-fixtures/        — sincroniza fixtures do banco (chamada manual ou cron)
  cron/update-odds/     — atualiza odds em duas janelas (24h e 1h antes do jogo)
  cron/sync-results/    — sincroniza resultados ao vivo e calcula pontuação
  game-picks/           — lê palpites do grupo para um jogo
  champion-pick/        — lê e salva palpite de campeão do torneio
  group-champion-picks/ — agrega palpites de campeão do grupo

supabase/migrations/
  001_schema.sql        — schema completo (9 tabelas, RLS, triggers)
  002_cron.sql          — sistema adaptativo de cron com watchdog

proxy.ts                — substitui middleware.ts no Next.js 16; faz auth check nas rotas protegidas
```

## APIs externas e seus papéis

| API | Papel | Variável de ambiente |
|-----|-------|---------------------|
| worldcup26.ir | Fonte primária: todos os 104 jogos, placares, status, estádios | `WC26_JWT_TOKEN` |
| football-data.org | Fonte secundária: live scores e status em tempo real | `FOOTBALL_DATA_API_KEY` |
| The Odds API | Probabilidades de mercado (h2h) para calcular pontos por odds | `THE_ODDS_API_KEY` |

A função `bestScores()` em `sync-results` reconcilia os dados das duas fontes de resultados, usando o placar mais atualizado entre elas.

## Clientes Supabase — quando usar cada um

| Arquivo | Quando usar |
|---------|-------------|
| `lib/supabase/client.ts` | Componentes client-side (browser) |
| `lib/supabase/server.ts` | Server Components e API routes que precisam de auth do usuário |
| `lib/supabase/service.ts` | Cron jobs e operações que devem ignorar RLS (service role) |

Nunca use o service role client em código acessível pelo usuário final.

## Fluxo de dados de um jogo

```
sync-fixtures → games table
                    ↓
update-odds (24h antes) → odds table
update-odds (1h antes)  → odds bloqueadas nos games (locked_*_prob)
                    ↓
sync-results → games.status = LIVE/HT
sync-results → games.status = FT → game_scores calculados
                    ↓
ranking_snapshots (snapshot por game_day para calcular ↑↓)
```

## Sistema de pontuação (`lib/scoring/calculator.ts`)

- Acertar o **resultado** vale pontos baseados nas odds bloqueadas antes do apito
- Probabilidades mais baixas = mais pontos (escala exponencial, range 1–13)
- Acertar o **placar exato** dá +5 pontos de bônus
- Resultado errado = zero pontos
- Se não houver odds bloqueadas, fallback para 1 ponto base

## Sistema de cron (`supabase/migrations/002_cron.sql`)

O pg_cron roda no próprio Supabase. Um **watchdog** verifica a cada 5 minutos se há jogos ao vivo ou próximos, e:
- **Fast mode:** ativa sync a cada 1 minuto quando há jogo ao vivo
- **Slow mode:** sync a cada 5 minutos fora de jogos

As URLs e o `CRON_SECRET` são lidos de uma tabela `cron_config` no banco, não hardcoded.

## Variáveis de ambiente necessárias

```
NEXT_PUBLIC_SUPABASE_URL        — URL do projeto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY   — chave pública (segura para expor no client)
SUPABASE_SERVICE_ROLE_KEY       — chave service role (nunca expor no client)
FOOTBALL_DATA_API_KEY           — football-data.org
THE_ODDS_API_KEY                — the-odds-api.com
WC26_JWT_TOKEN                  — worldcup26.ir (API não oficial)
CRON_SECRET                     — segredo para autenticar chamadas de cron
```

## Banco de dados — tabelas principais

| Tabela | Propósito |
|--------|-----------|
| `profiles` | Perfil do usuário (extends auth.users) |
| `games` | Todos os jogos do torneio com status, placar e odds bloqueadas |
| `odds` | Snapshot de odds por jogo (pode mudar até o apito) |
| `predictions` | Palpites do usuário (user_id + game_id + placar) |
| `game_scores` | Pontos calculados por jogo por usuário após encerramento |
| `groups` | Grupos/bolões independentes |
| `group_members` | Whitelist de emails por grupo |
| `champion_picks` | Palpite de campeão por usuário |
| `ranking_snapshots` | Snapshot diário de ranking por grupo (para calcular ↑↓) |

## Pontos de atenção

- Os tipos TypeScript do Supabase (`lib/supabase/types.ts`) estão desatualizados — a tabela `ranking_snapshots` não está incluída, o que força `(supabase as any)` em alguns lugares. Para regenerar: `supabase gen types typescript --project-id <id> > lib/supabase/types.ts`
- `lib/api-football/sync-fixtures.ts` é código legado — não é importado em lugar nenhum após a migração para worldcup26.ir como fonte primária
- O arquivo `proxy.ts` substitui o `middleware.ts` convencional do Next.js (breaking change da versão 16)
- Grupos são controlados por email whitelist na tabela `group_members` — adicionar usuários requer inserção manual no banco
