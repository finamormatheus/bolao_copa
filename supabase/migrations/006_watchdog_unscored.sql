-- Atualiza sync_watchdog: mantém fast mode enquanto há jogos finalizados
-- com palpites mas sem pontuação calculada.

create or replace function public.sync_watchdog()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_live     boolean;
  has_upcoming boolean;
  has_unscored boolean;
  current_mode text;
begin
  select mode into current_mode from public.cron_sync_state where id = 1;

  select exists (
    select 1 from public.games where status in ('LIVE', 'HT')
  ) into has_live;

  select exists (
    select 1 from public.games
    where status = 'NS'
      and match_date between now() and now() + interval '35 minutes'
  ) into has_upcoming;

  -- Jogos finalizados nas últimas 6h com palpites mas sem pontuação calculada
  select exists (
    select 1 from public.games g
    where g.status in ('FT', 'FINISHED')
      and g.match_date > now() - interval '6 hours'
      and g.home_score is not null
      and exists     (select 1 from public.predictions  p  where p.game_id  = g.id)
      and not exists (select 1 from public.game_scores  gs where gs.game_id = g.id)
  ) into has_unscored;

  if has_live or has_upcoming or has_unscored then
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
