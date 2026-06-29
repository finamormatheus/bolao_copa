# Handoff: Visão "Chave" (Bracket mata-mata) — Bolão Copa 2026

## Overview
Esta é uma **nova visão de chaveamento (bracket) para a fase mata-mata** do Bolão Copa do Mundo 2026. Ela entra como uma **4ª aba** no seletor de visualização da página de Palpites (`/palpites`), ao lado de `Cronológico`, `Por grupo` e `Encerrados`.

A chave mostra todas as fases eliminatórias (Rodada de 32 → Oitavas → Quartas → Semifinais → Final) num diagrama horizontal com conectores. O usuário foca uma fase por vez; clicar numa fase, nas setas, ou num confronto navega/expande. Clicar num card abre um **modal de palpite** que reaproveita a mesma lógica de palpite/resultado/odds/revelação que já existe no `GameCard.tsx`.

## About the Design Files
Os arquivos neste pacote são **referências de design feitas em HTML** — um protótipo que mostra o visual e o comportamento pretendidos, **não** código de produção para copiar e colar. O `Chave.dc.html` usa um runtime de protótipo próprio (`support.js`, classe `DCLogic`, tags `<sc-for>`/`<sc-if>`) que **não deve ir para o app**.

A tarefa é **recriar este design dentro do codebase existente** (Next.js 16 + React 19 + TypeScript + Tailwind/shadcn, estilos inline com CSS vars `--bolao-*`), reusando os componentes, tipos e dados que já existem. Trate o `support.js` apenas como motor do protótipo.

## Fidelity
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios, sombras e estados finais estão definidos. Recrie a UI fielmente usando as CSS vars `--bolao-*` e a fonte `FWC2026` que **já existem** no `app/globals.css`. As medidas em px no protótipo são as medidas-alvo.

> Importante: os **dados são mockados** no protótipo (16 confrontos fixos, palpites de colegas gerados por seed). No app real, os dados vêm do Supabase (`games`, `predictions`, `odds`, `game_scores`) e da API `/api/game-picks`. Use o protótipo para **layout, interação e estilo**; use as fontes de dados reais para conteúdo.

---

## Como isto se encaixa no codebase atual

A página de Palpites já tem o padrão de abas. A chave é só mais uma `View`:

- `app/(dashboard)/palpites/PalpitesClient.tsx` — adicionar `"chave"` ao type `View`, ao `VIEW_LABELS` e renderizar `<BracketView>` quando ativo. Persistência em `localStorage("bolao_view")` já existe — `"chave"` entra de graça.
- `components/GameCard.tsx` — **fonte de verdade** para o modal. Os sub-componentes `OddsStrip`, `LockedOddsStrip`, `GroupReveal`, `PickRow`, `FlagChip`, `ScorePillInput`, `ScorePillStatic`, `StatusChip` já implementam tudo o que o modal precisa. Reaproveite, não reescreva.
- `lib/scoring/calculator.ts` — `probabilityToPoints()` e `calculateScore()` já existem; o protótipo reimplementa essa matemática (`p2p`, `scoreOf`) só porque não tinha acesso a elas. **Use as funções reais.**
- `lib/supabase/types.ts` — `Game`, `Odds`, `Prediction`, `GameScore` já existem (ver "Modelo de dados").
- `lib/translations/teams.ts` — `translateTeamName()` e `TEAM_FLAGS` (slug → `/flags/regular/<slug>.png`).

### Recomendação de arquivos novos
```
components/
  BracketView.tsx        — o diagrama da chave (client component)
  GameModal.tsx          — modal de palpite/resultado (extraído da lógica do GameCard)
```
Idealmente, **extraia o conteúdo do footer do `GameCard`** (odds, save, resultado, reveal) para um componente compartilhado, e use-o tanto no `GameCard` quanto no `GameModal` — evita duplicar a lógica de `handleSave`, `withinLock`, `saveState`, etc.

---

## Screens / Views

### 1. BracketView (diagrama da chave)
**Propósito:** visão geral da fase mata-mata; navegar entre fases e abrir confrontos.

**Layout**
- Container rolável: `position:relative; overflow:auto; max-height:74vh; border:1px solid var(--bolao-hairline); border-radius:16px; background:rgba(10,10,14,0.35)`.
- Faixa de cabeçalho sticky (`position:sticky; top:0; height:46px`) com gradiente `linear-gradient(180deg, rgba(16,16,22,0.97), rgba(16,16,22,0.85))`, `backdrop-filter:blur(8px)`, borda inferior `1px solid var(--bolao-hairline)`. Contém os **rótulos das fases** posicionados absolutamente, alinhados com as colunas.
- Campo (`field`) com `position:relative` e largura/altura calculadas. Cards e conectores são **absolutamente posicionados** dentro dele.
- Duas **setas** circulares flutuantes (‹ ›) `38×38px`, `border-radius:99px`, `border:1px solid var(--bolao-hairline-2)`, `background:rgba(21,21,25,0.92)`, `backdrop-filter:blur(6px)`, `top:62px`, `left:8px`/`right:8px`. Opacidade `0.22` + `pointer-events:none` quando no limite (primeira/última fase).

**Modelo de foco (chave horizontal)**
- 5 fases, com contagem de confrontos `[16, 8, 4, 2, 1]`.
- `focus` (0–4) é a fase ativa. A fase focada é a "base compacta": seus 16/8/4/2/1 cards ficam empilhados verticalmente com passo `pitch = CH + RG`.
- Fases **posteriores** (à direita) têm o centro vertical de cada card = média dos dois cards-filhos da fase anterior (efeito de chave abrindo).
- Fases **anteriores** (à esquerda, fora de tela) aninham-se dentro do pai para terem posição definida de onde deslizar.
- Coluna X de uma fase `r`: `colX(r) = PAD + (r - focus) * (CW + CG)`.
- Larguras de card por densidade (prop `cardDensity`): Confortável `CW=238, CH=100, RG=16, CG=66`; Compacto `CW=204, CH=84, RG=12, CG=56`. `PAD=12`.

**Conectores**
- Para cada confronto da fase `r≥1`, desenhar 4 segmentos (`background:var(--bolao-hairline-2)`, `border-radius:1px`): linha horizontal saindo de cada filho, uma vertical unindo-os, e uma horizontal entrando no pai. Visíveis só para `r ≥ focus+1`.

**Transições (glide ao trocar de fase)**
- Easing compartilhado: `cubic-bezier(.45,.02,.18,1)`.
- Cards: `left .52s <ease>, top .52s <ease>, opacity .34s ease`.
- Conectores: `left/top/width/height .52s <ease>, opacity .3s ease`.
- Rótulos de fase: `left .52s <ease>, color .3s ease, opacity .3s ease`.
- Recomendado no React: posicionar via `style` calculado por `focus` (Framer Motion não é necessário; transições CSS bastam, como no protótipo).

**Card de confronto** (largura `CW`, altura `CH`)
- `background:var(--bolao-surface); border:1px solid var(--bolao-hairline)` (ou `--bolao-hairline-2` se encerrado); `border-radius:14px`; `box-shadow:0 10px 24px -18px rgba(0,0,0,0.9)`; `overflow:visible`; cursor pointer; hover → `border-color:var(--bolao-ink-faint)`.
- **Cabeçalho:** data/hora à esquerda (`fmtDate`/`fmtTime` em pt-BR, `font:FWC2026 10px/800`, cor `--bolao-ink-dim`, `tabular-nums`); selo "Encerrado" à direita (`9px/800`, uppercase, `--bolao-ink-faint`) quando finalizado.
- **Duas linhas de time** (`height ~28px`): bandeira (chip `27×18px`, `border-radius:5px 2px 5px 2px`, borda branca `1.4px`, sombra) + nome (uppercase, `FWC2026 14px`, elipse) + coluna de placar (`20px`, centralizado, `tabular-nums`).
  - Bandeira ausente (time A definir) → "escudo" cinza `rgba(247,247,248,0.13)` e nome "A definir" em `--bolao-ink-faint`.
  - Vencedor que avança: nome em `--bolao-lime`, peso 800; perdedor em `--bolao-ink-faint`.
  - **Badge de acerto** (canto inferior direito da bandeira do vencedor, só se finalizado e havia palpite): círculo `15px`, `✓` verde (`--bolao-green-win`) se acertou quem avança, `✕` vermelho (`--bolao-red`) se errou; borda `2px solid var(--bolao-surface)`.
  - Selo "pên" (`8.5px`, uppercase, faint) quando o vencedor passou nos pênaltis.
- **Coluna de placar:**
  - Finalizado → placar real; vencedor `--bolao-ink`, perdedor `--bolao-ink-faint`.
  - Em aberto e times conhecidos → **seu palpite** (ou `–` se não palpitou); lado vencedor do palpite em `--bolao-lime`.
- **Marcador no canto direito do card** (finalizado + havia palpite): círculo `18px` `✓`/`✕` (verde se placar exato, vermelho caso contrário).

**Rótulos de fase** (`["Rodada de 32","Oitavas de final","Quartas de final","Semifinais","Final"]`): `FWC2026 14px/800`, uppercase; fase focada em `--bolao-lime`, demais em `--bolao-ink`; clicáveis (= `setFocus(r)`).

### 2. Modal de confronto (ao clicar num card)
Overlay: `position:fixed; inset:0; background:rgba(5,5,8,0.72); backdrop-filter:blur(4px)`; clique no fundo fecha; conteúdo para a propagação. Card: `max-width:460px; background:var(--bolao-surface); border:1px solid var(--bolao-hairline-2); border-radius:22px; box-shadow:0 30px 80px -20px rgba(0,0,0,0.9)`. Animações `bolaoFade .15s` (overlay) e `bolaoPop .18s` (card).

Três modos, derivados do estado do jogo (igual ao `GameCard`):
- **`tbd`** (times indefinidos): mensagem "Confronto a definir" + texto explicativo. Sem ações.
- **`edit`** (em aberto, times conhecidos): inputs de placar (`ScorePillInput` `54×50`), strip de odds 3-vias (`OddsStrip` — casa/empate/fora com % e `+N pts` via `probabilityToPoints`), seletor de **quem avança** (dois botões com bandeira+nome; obrigatório no mata-mata, e único caminho em caso de empate no tempo normal → pênaltis), e botão **Salvar**. Estados do botão: idle/`✓ Salvo!`/`Faltou algo!` (vermelho). Validação: placar preenchido **e** vencedor escolhido.
- **`result`** (encerrado): pílulas de placar final, `LockedOddsStrip` (odds no fechamento, vencedor destacado em verde/lime), resumo "Seu palpite X–Y · Time avança", pontos (`+N pts`), chips "placar exato" (🎯/✕) e "quem avança" (✓/✕), e o **`GroupReveal`** ("Palpites do grupo", expansível, agrupado por aposta) — exatamente o componente existente.

Cabeçalho do modal (`background:var(--bolao-surface-2)`): data · fase + chip de status (`Aberto` lime / `Encerrado` / `A definir`).

---

## Interações & Comportamento
- **Navegação de fase:** setas (`focus±1`, clamp 0–4), clique no rótulo da fase, clique num confronto. Trocar de foco re-posiciona cards/conectores com o glide CSS de `.52s`.
- **Abrir/fechar modal:** clique no card abre; clique no fundo ou no "Fechar" fecha; ESC recomendado (acessibilidade — não está no protótipo).
- **Editar palpite:** digitar placar deriva automaticamente quem avança quando não é empate; em empate, o usuário escolhe quem passa nos pênaltis. Salvar → `upsert` em `predictions` (ver `PalpitesClient.handleSave`). Travar palpite 5 min antes do jogo (`LOCK_MINUTES = 5`, `isWithinLock` no `GameCard`).
- **Revelação de palpites do grupo:** só quando travado/encerrado; busca lazy em `GET /api/game-picks?gameId=<id>` (já existe). Não revelar palpites de jogos ainda abertos.
- **Mata-mata vs. fase de grupos:** a chave acrescenta o conceito de "quem avança" (`adv`), que **não existe** no `GameCard` de grupos. Isto exige uma coluna/campo de vencedor no palpite do mata-mata — ver "Pontos de atenção".

## State Management
- `view` (incluindo `"chave"`) em `PalpitesClient`, persistido em `localStorage("bolao_view")` — já existe.
- `focus` (0–4): fase ativa na chave. Local ao `BracketView`.
- `selId`: confronto aberto no modal. Local ao `BracketView`/`GameModal`.
- Inputs de placar + vencedor + `saveState` + `withinLock`: locais ao modal (reaproveitar a lógica do `GameCard`).
- `predictions`: estado elevado em `PalpitesClient` (`useState`, atualizado após `handleSave`). A chave deve ler do mesmo estado para refletir palpites na hora.

## Dados / Fetching
- Confrontos do mata-mata = `games` com `stage` eliminatório (mapear via `STAGE_PT`/IDs do WC26). Hoje o app está em fase de grupos; a estrutura da chave (quem joga contra quem) depende do chaveamento oficial — pode vir do `lib/worldcup26` ou de um mapa estático de `bracket slots`.
- Odds/locked odds: tabela `odds` + campos `locked_*_prob` em `games`.
- Pontuação: `game_scores` (já calculada pelo cron `sync-results`).
- Palpites do grupo: `GET /api/game-picks?gameId=<id>`.

---

## Design Tokens (já existem em `app/globals.css` — **não recriar**)
Cores (CSS vars):
- `--bolao-bg: #0a0a0e`
- `--bolao-surface: rgb(21,21,25)`
- `--bolao-surface-2: rgb(63,64,77)`
- `--bolao-surface-3: #1f1f26`
- `--bolao-hairline: rgba(247,247,248,0.08)`
- `--bolao-hairline-2: rgba(247,247,248,0.14)`
- `--bolao-ink: rgb(247,247,248)`
- `--bolao-ink-dim: rgba(247,247,248,0.62)`
- `--bolao-ink-faint: rgba(247,247,248,0.40)`
- `--bolao-ink-dark: rgb(18,18,18)`
- `--bolao-lime: rgb(173,235,3)` (acento primário)
- `--bolao-red: rgb(255,22,68)`
- `--bolao-green-win: rgb(1,230,118)`
- `--bolao-pill: rgb(247,247,248)`

Tipografia:
- Display/UI: `"FWC2026", system-ui, sans-serif` (pesos 400–900). Usada em nomes, números, rótulos — quase sempre uppercase, `letter-spacing` 0.01–0.05em, `font-variant-numeric: tabular-nums` em placares.
- Texto corrido/labels secundárias: `"Noto Sans", system-ui, sans-serif`.

Raios: cards de confronto `14px`; modal `22px`; pílulas/chips `999px`; bandeiras `5px 2px 5px 2px` (grande `9px 3px 9px 3px`); inputs/pílulas de placar `12px`.

Sombras: card `0 10px 24px -18px rgba(0,0,0,0.9)`; modal `0 30px 80px -20px rgba(0,0,0,0.9)`.

Easing/transição: `cubic-bezier(.45,.02,.18,1)`, duração `.52s` para o glide de fase.

Keyframes (em `globals.css`): `bolaoFade`, `bolaoPop` (e `livePulse`/`bolao-spin` já usadas pelo GameCard).

## Assets
- Bandeiras: `/flags/regular/<slug>.png` (mapa `TEAM_FLAGS` em `lib/translations/teams.ts`). O protótipo usa `flags/<slug>.png` apenas localmente — **no app, use o caminho e o mapa reais**.
- Fonte `FWC2026`: `public/fonts/` (já registrada via `@font-face` no `globals.css`).
- Sem ícones SVG novos; marcadores usam glifos (`✓ ✕ 🎯 👥 🔒 ▾`).

## Pontos de atenção
1. **"Quem avança" (`adv`) é novo.** No mata-mata, o palpite precisa de um campo de vencedor além do placar. Isso pode exigir: (a) coluna nova em `predictions` (ex.: `advance_pick text check in ('home','away')`), e (b) ajuste no `calculateScore` para o bônus de avanço (no protótipo: `+3` se acertou quem avança; `+5` placar exato; base por odds). **Alinhe a regra de pontuação do mata-mata com o dono do produto antes de implementar** — o protótipo é uma proposta, não a regra oficial.
2. **Reaproveite, não duplique.** O modal deve usar os componentes/lógica do `GameCard`. O ideal é extrair o "footer" do GameCard num componente compartilhado.
3. **Estrutura da chave** (pareamentos por slot) precisa de uma fonte de dados real — defina se vem da API WC26 ou de um mapa estático de slots.
4. **Responsivo:** o protótipo é desktop-first com rolagem horizontal. Em mobile, o foco-por-fase + setas já ajuda; valide larguras de card (`Compacto`) e a rolagem em telas estreitas.
5. **Acessibilidade:** adicionar foco de teclado nas setas/cards, `aria-label`, fechar modal no ESC e trap de foco — ausentes no protótipo.

## Files
- `Chave.dc.html` — protótipo de referência da chave (este pacote). Abra no navegador para ver o comportamento. Ignore `support.js`/`DCLogic`/`<sc-*>` — são do motor de protótipo.

Arquivos do app a tocar/reusar (no repositório, **não** neste pacote):
- `app/(dashboard)/palpites/PalpitesClient.tsx` — adicionar aba `"chave"`.
- `components/GameCard.tsx` — fonte da lógica do modal (extrair footer compartilhado).
- `lib/scoring/calculator.ts` — `probabilityToPoints`, `calculateScore`.
- `lib/translations/teams.ts` — nomes + bandeiras.
- `lib/supabase/types.ts` — `Game`, `Odds`, `Prediction`, `GameScore`.
- `app/globals.css` — tokens `--bolao-*`, fontes, keyframes.
- `app/api/game-picks/` — revelação de palpites do grupo.
