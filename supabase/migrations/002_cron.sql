-- ============================================================
-- Sistema de cron adaptativo para sync de resultados e odds
-- ============================================================
-- Consolidado de: 005_supabase_cron, 006_watchdog_unscored
-- ============================================================
-- Após aplicar esta migration, popule a tabela cron_config no
-- SQL Editor do Supabase (não commitar com valores reais):
--
--   insert into cron_config (key, value) values
--     ('base_url',    'https://seu-app.vercel.app'),
--     ('cron_secret', 'valor-do-CRON_SECRET')
--   on conflict (key) do update set value = excluded.value;
--
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ── Tabela de configuração ────────────────────────────────────
-- Substitui ALTER DATABASE SET (que requer superuser).
-- RLS habilitado sem policies = apenas postgres/service_role acessa.
CREATE TABLE IF NOT EXISTS public.cron_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY;

-- Lê config em runtime dentro dos job commands (security definer
-- garante que o job pg_cron, que roda como postgres, sempre consiga ler)
CREATE OR REPLACE FUNCTION public.get_cron_config(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT value FROM public.cron_config WHERE key = p_key;
$$;


-- ── Tabela de estado (singleton) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.cron_sync_state (
  id           INTEGER     PRIMARY KEY DEFAULT 1,
  mode         TEXT        NOT NULL DEFAULT 'slow' CHECK (mode IN ('slow', 'fast')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO public.cron_sync_state (id, mode, activated_at)
VALUES (1, 'slow', NOW())
ON CONFLICT DO NOTHING;


-- ── activate_fast_sync ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_fast_sync()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  -- Agenda job rápido (cron.schedule é upsert — sobrescreve se já existir)
  PERFORM cron.schedule(
    'sync_results_fast',
    '* * * 6,7 *',
    $job$
      SELECT net.http_get(
        url     := public.get_cron_config('base_url') || '/api/cron/sync-results',
        headers := ('{"Authorization":"Bearer ' || public.get_cron_config('cron_secret') || '"}')::jsonb
      )
    $job$
  );

  -- Remove job lento se existir
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync_results_slow') THEN
    PERFORM cron.unschedule('sync_results_slow');
  END IF;

  -- Disparo imediato para não perder o primeiro minuto do jogo
  v_url    := public.get_cron_config('base_url');
  v_secret := public.get_cron_config('cron_secret');

  IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_get(
      url     := v_url || '/api/cron/sync-results',
      headers := ('{"Authorization":"Bearer ' || v_secret || '"}')::jsonb
    );
  END IF;

  UPDATE public.cron_sync_state SET mode = 'fast', activated_at = NOW() WHERE id = 1;
END;
$$;


-- ── activate_slow_sync ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_slow_sync()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Agenda job lento
  PERFORM cron.schedule(
    'sync_results_slow',
    '*/5 * * 6,7 *',
    $job$
      SELECT net.http_get(
        url     := public.get_cron_config('base_url') || '/api/cron/sync-results',
        headers := ('{"Authorization":"Bearer ' || public.get_cron_config('cron_secret') || '"}')::jsonb
      )
    $job$
  );

  -- Remove job rápido se existir
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync_results_fast') THEN
    PERFORM cron.unschedule('sync_results_fast');
  END IF;

  UPDATE public.cron_sync_state SET mode = 'slow', activated_at = NOW() WHERE id = 1;
END;
$$;


-- ── sync_watchdog ────────────────────────────────────────────
-- Roda a cada 5 min. Garante o modo correto e auto-recupera
-- caso algum job tenha desaparecido por erro.
CREATE OR REPLACE FUNCTION public.sync_watchdog()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  has_live     BOOLEAN;
  has_upcoming BOOLEAN;
  has_unscored BOOLEAN;
  current_mode TEXT;
BEGIN
  SELECT mode INTO current_mode FROM public.cron_sync_state WHERE id = 1;

  -- Jogos ao vivo agora
  SELECT EXISTS (
    SELECT 1 FROM public.games WHERE status IN ('LIVE', 'HT')
  ) INTO has_live;

  -- Jogos que começam nos próximos 35 min (ativa fast mode antes do kickoff)
  SELECT EXISTS (
    SELECT 1 FROM public.games
    WHERE status = 'NS'
      AND match_date BETWEEN NOW() AND NOW() + INTERVAL '35 minutes'
  ) INTO has_upcoming;

  -- Jogos finalizados nas últimas 6h com palpites mas sem pontuação calculada
  SELECT EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.status IN ('FT', 'FINISHED')
      AND g.match_date > NOW() - INTERVAL '6 hours'
      AND EXISTS     (SELECT 1 FROM public.predictions p  WHERE p.game_id  = g.id)
      AND NOT EXISTS (SELECT 1 FROM public.game_scores gs WHERE gs.game_id = g.id)
  ) INTO has_unscored;

  IF has_live OR has_upcoming OR has_unscored THEN
    IF current_mode <> 'fast'
       OR NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync_results_fast')
    THEN
      PERFORM public.activate_fast_sync();
    END IF;
  ELSE
    IF current_mode <> 'slow'
       OR NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync_results_slow')
    THEN
      PERFORM public.activate_slow_sync();
    END IF;
  END IF;
END;
$$;


-- ── Jobs iniciais ────────────────────────────────────────────

-- Watchdog: sempre ativo, garante modo correto a cada 5 min
SELECT cron.schedule(
  'sync_watchdog',
  '*/5 * * 6,7 *',
  $$ SELECT public.sync_watchdog() $$
);

-- Odds: atualiza 24h e 1h antes de cada jogo
SELECT cron.schedule(
  'update_odds',
  '*/30 * * 6,7 *',
  $job$
    SELECT net.http_get(
      url     := public.get_cron_config('base_url') || '/api/cron/update-odds',
      headers := ('{"Authorization":"Bearer ' || public.get_cron_config('cron_secret') || '"}')::jsonb
    )
  $job$
);

-- Slow sync: job inicial (watchdog alterna para fast quando necessário)
SELECT cron.schedule(
  'sync_results_slow',
  '*/5 * * 6,7 *',
  $job$
    SELECT net.http_get(
      url     := public.get_cron_config('base_url') || '/api/cron/sync-results',
      headers := ('{"Authorization":"Bearer ' || public.get_cron_config('cron_secret') || '"}')::jsonb
    )
  $job$
);
