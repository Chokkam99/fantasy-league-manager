-- Authorization foundation for the deployed fantasy-league v0 schema.
--
-- PRECONDITIONS (verify before applying remotely):
-- 1. SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is configured for every
--    application environment that performs commissioner or cron mutations.
-- 2. The deployed application version routes every mutation through the
--    authenticated server endpoints and uses PUBLIC_LEAGUE_COLUMNS for browser
--    reads.
-- 3. A current database backup/export exists and has been verified.

begin;

-- Remove direct public writes while preserving the explicit shared-view reads
-- used by players. ESPN credentials remain inaccessible because league reads
-- are granted at the safe-column level rather than for the whole table.
revoke all privileges on table public.leagues from anon, authenticated;
grant select (
  id,
  name,
  current_season,
  created_at,
  updated_at,
  platform_type,
  platform_league_id,
  auto_sync_enabled,
  sync_status,
  last_sync_at,
  last_sync_error
) on table public.leagues to anon, authenticated;

revoke all privileges on table public.league_seasons from anon, authenticated;
grant select on table public.league_seasons to anon, authenticated;

revoke all privileges on table public.league_members from anon, authenticated;
grant select on table public.league_members to anon, authenticated;

revoke all privileges on table public.weekly_scores from anon, authenticated;
grant select on table public.weekly_scores to anon, authenticated;

revoke all privileges on table public.matchups from anon, authenticated;
grant select on table public.matchups to anon, authenticated;

revoke all privileges on table public.payments from anon, authenticated;

-- Shared-player reads remain public for the current product. There are no
-- public write policies; privileged server routes use the server secret role.
alter table public.leagues enable row level security;
alter table public.league_seasons enable row level security;
alter table public.league_members enable row level security;
alter table public.weekly_scores enable row level security;
alter table public.matchups enable row level security;
alter table public.payments enable row level security;

drop policy if exists league_shared_read on public.leagues;
create policy league_shared_read
  on public.leagues
  for select
  to anon, authenticated
  using (true);

drop policy if exists season_shared_read on public.league_seasons;
create policy season_shared_read
  on public.league_seasons
  for select
  to anon, authenticated
  using (true);

drop policy if exists member_shared_read on public.league_members;
create policy member_shared_read
  on public.league_members
  for select
  to anon, authenticated
  using (true);

drop policy if exists score_shared_read on public.weekly_scores;
create policy score_shared_read
  on public.weekly_scores
  for select
  to anon, authenticated
  using (true);

drop policy if exists matchup_shared_read on public.matchups;
create policy matchup_shared_read
  on public.matchups
  for select
  to anon, authenticated
  using (true);

-- Make the calculated result view respect the querying role and base-table
-- policies instead of running with its owner privileges.
alter view public.matchup_results_with_scores
  set (security_invoker = true);
revoke all privileges on table public.matchup_results_with_scores
  from anon, authenticated;
grant select on table public.matchup_results_with_scores
  to anon, authenticated;

-- Remove Data API access to legacy mutating, broken, or obsolete RPCs. Trigger
-- functions continue to run from their existing triggers without public RPC
-- execution grants.
revoke execute on function public.generate_round_robin_schedule(uuid, varchar, integer)
  from public, anon, authenticated;
revoke execute on function public.get_season_standings(text, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.get_team_record(uuid, uuid, varchar)
  from public, anon, authenticated;
revoke execute on function public.insert_season_matchups(uuid, varchar, jsonb)
  from public, anon, authenticated;
revoke execute on function public.recalculate_matchup_winners(uuid, varchar)
  from public, anon, authenticated;
revoke execute on function public.set_playoff_week_flag()
  from public, anon, authenticated;
revoke execute on function public.update_matchup_results()
  from public, anon, authenticated;
revoke execute on function public.update_matchup_winners()
  from public, anon, authenticated;
revoke execute on function public.update_updated_at_column()
  from public, anon, authenticated;

commit;
