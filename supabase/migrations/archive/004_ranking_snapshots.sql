-- Stores a rank snapshot per participant per game-day, used to compute position delta.
-- Written at the end of each day that has games (by the sync-results job).
create table if not exists ranking_snapshots (
  group_id   uuid    not null references groups(id) on delete cascade,
  game_day   date    not null,
  user_id    uuid    not null references auth.users(id) on delete cascade,
  rank       int     not null,
  points     int     not null,
  created_at timestamptz default now(),
  primary key (group_id, game_day, user_id)
);

alter table ranking_snapshots enable row level security;

grant select on public.ranking_snapshots to authenticated;
grant select, insert, update on public.ranking_snapshots to service_role;

-- Members can only read snapshots for their own groups.
create policy "group members can read ranking snapshots"
  on ranking_snapshots for select
  using (
    exists (
      select 1 from group_members gm
      join profiles p on p.email = gm.email
      where gm.group_id = ranking_snapshots.group_id
        and p.id = auth.uid()
    )
  );
