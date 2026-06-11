-- ============================================================
-- Supabase Cron: adaptive sync scheduler
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

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ── Tabela de configuração ────────────────────────────────────
-- Substitui ALTER DATABASE SET (que requer superuser).
-- RLS habilitado sem policies = apenas postgres/service_role acessa.
create table if not exists public.cron_config (
  key   text primary key,
  value text not null
);

alter table public.cron_config enable row level security;

-- Helper: lê config em runtime dentro dos job commands (security definer
-- garante que o job pg_cron, que roda como postgres, sempre consiga ler)
create or replace function public.get_cron_config(p_key text)
returns text
language sql
security definer
set search_path = ''
as $$
  select value from public.cron_config where key = p_key;
$$;

-- ── Tabela de estado (singleton) ─────────────────────────────
create table if not exists public.cron_sync_state (
  id           integer     primary key default 1,
  mode         text        not null default 'slow' check (mode in ('slow', 'fast')),
  activated_at timestamptz not null default now(),
  constraint singleton check (id = 1)
);

insert into public.cron_sync_state (id, mode, activated_at)
values (1, 'slow', now())
on conflict do nothing;

-- ── activate_fast_sync ───────────────────────────────────────
create or replace function public.activate_fast_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  -- Agenda job rápido (cron.schedule é upsert — sobrescreve se já existir)
  perform cron.schedule(
    'sync_results_fast',
    '* * * 6,7 *',
    $job$
      select net.http_get(
        url     := public.get_cron_config('base_url') || '/api/cron/sync-results',
        headers := ('{"Authorization":"Bearer ' || public.get_cron_config('cron_secret') || '"}')::jsonb
      )
    $job$
  );

  -- Remove job lento se existir
  if exists (select 1 from cron.job where jobname = 'sync_results_slow') then
    perform cron.unschedule('sync_results_slow');
  end if;

  -- Disparo imediato para não perder o primeiro minuto do jogo
  v_url    := public.get_cron_config('base_url');
  v_secret := public.get_cron_config('cron_secret');

  if v_url is not null and v_secret is not null then
    perform net.http_get(
      url     := v_url || '/api/cron/sync-results',
      headers := ('{"Authorization":"Bearer ' || v_secret || '"}')::jsonb
    );
  end if;

  update public.cron_sync_state set mode = 'fast', activated_at = now() where id = 1;
end;
$$;

-- ── activate_slow_sync ───────────────────────────────────────
create or replace function public.activate_slow_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Agenda job lento
  perform cron.schedule(
    'sync_results_slow',
    '*/5 * * 6,7 *',
    $job$
      select net.http_get(
        url     := public.get_cron_config('base_url') || '/api/cron/sync-results',
        headers := ('{"Authorization":"Bearer ' || public.get_cron_config('cron_secret') || '"}')::jsonb
      )
    $job$
  );

  -- Remove job rápido se existir
  if exists (select 1 from cron.job where jobname = 'sync_results_fast') then
    perform cron.unschedule('sync_results_fast');
  end if;

  update public.cron_sync_state set mode = 'slow', activated_at = now() where id = 1;
end;
$$;

-- ── sync_watchdog ────────────────────────────────────────────
-- Roda a cada 5 min. Garante o modo correto e auto-recupera
-- caso algum job tenha desaparecido por erro.
create or replace function public.sync_watchdog()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_live     boolean;
  has_upcoming boolean;
  current_mode text;
begin
  select mode into current_mode from public.cron_sync_state where id = 1;

  -- Jogos ao vivo agora
  select exists (
    select 1 from public.games where status in ('LIVE', 'HT')
  ) into has_live;

  -- Jogos que começam nos próximos 35 min (ativa fast mode antes do kickoff)
  select exists (
    select 1 from public.games
    where status = 'NS'
      and match_date between now() and now() + interval '35 minutes'
  ) into has_upcoming;

  if has_live or has_upcoming then
    if current_mode <> 'fast'
       or not exists (select 1 from cron.job where jobname = 'sync_results_fast')
    then
      perform public.activate_fast_sync();
    end if;
  else
    if current_mode <> 'slow'
       or not exists (select 1 from cron.job where jobname = 'sync_results_slow')
    then
      perform public.activate_slow_sync();
    end if;
  end if;
end;
$$;

-- ── Jobs iniciais ────────────────────────────────────────────

-- Watchdog: sempre ativo, garante modo correto a cada 5 min
select cron.schedule(
  'sync_watchdog',
  '*/5 * * 6,7 *',
  $$ select public.sync_watchdog() $$
);

-- Odds: lógica de flags inalterada, só muda o scheduler
select cron.schedule(
  'update_odds',
  '*/30 * * 6,7 *',
  $job$
    select net.http_get(
      url     := public.get_cron_config('base_url') || '/api/cron/update-odds',
      headers := ('{"Authorization":"Bearer ' || public.get_cron_config('cron_secret') || '"}')::jsonb
    )
  $job$
);

-- Slow sync: job inicial (watchdog alterna para fast quando necessário)
select cron.schedule(
  'sync_results_slow',
  '*/5 * * 6,7 *',
  $job$
    select net.http_get(
      url     := public.get_cron_config('base_url') || '/api/cron/sync-results',
      headers := ('{"Authorization":"Bearer ' || public.get_cron_config('cron_secret') || '"}')::jsonb
    )
  $job$
);
