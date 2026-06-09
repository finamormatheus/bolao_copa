@AGENTS.md

# Bolão Copa do Mundo 2026

Aplicação web de bolão para a Copa do Mundo 2026. Os participantes fazem palpites nos resultados dos jogos e disputam um ranking com pontuação em tempo real.

## Stack

- **Frontend/Backend:** Next.js 16 (App Router, TypeScript, shadcn/ui + Tailwind)
- **Auth + Banco:** Supabase (Postgres + RLS + Google OAuth)
- **Deploy:** Vercel
- **Dados de futebol:** api-football (plano gratuito: 100 req/dia)

## Estrutura principal

- `app/` — páginas: `/login`, `/palpites`, `/ranking`
- `lib/scoring/calculator.ts` — lógica de pontuação dos palpites
- `lib/supabase/` — clientes browser (`client.ts`), SSR (`server.ts`) e service role (`service.ts`)
- `lib/api-football/client.ts` — integração com api-football
- `app/api/` — rotas: `sync-fixtures`, `cron/update-odds`, `cron/sync-results`
- `supabase/migrations/001_initial_schema.sql` — schema completo do banco
- `.github/workflows/` — GitHub Actions para sync automático de odds e resultados
- `proxy.ts` — proxy Next.js 16 (substitui `middleware.ts`)
