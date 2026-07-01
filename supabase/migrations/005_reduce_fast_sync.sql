-- Reduz frequência do fast sync de 1 minuto para 2 minutos.
-- Combinado com a redução de chamadas ao football-data no route.ts,
-- isso corta o custo de CPU do Vercel pela metade durante jogos ao vivo.

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
  PERFORM cron.schedule(
    'sync_results_fast',
    '*/2 * * 6,7 *',
    $job$ SELECT public.http_sync_results() $job$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync_results_slow') THEN
    PERFORM cron.unschedule('sync_results_slow');
  END IF;

  v_url    := public.get_cron_config('base_url');
  v_secret := public.get_cron_config('cron_secret');

  IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_get(
      url                  := v_url || '/api/cron/sync-results',
      headers              := ('{"Authorization":"Bearer ' || v_secret || '"}')::jsonb,
      timeout_milliseconds := 35000
    );
  END IF;

  UPDATE public.cron_sync_state SET mode = 'fast', activated_at = NOW() WHERE id = 1;
END;
$$;

-- Aplica imediatamente se o job fast já estiver ativo
SELECT cron.schedule(
  'sync_results_fast',
  '*/2 * * 6,7 *',
  $job$ SELECT public.http_sync_results() $job$
) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync_results_fast');
