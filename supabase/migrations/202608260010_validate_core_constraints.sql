-- Validate the staged constraints, promote audited fields to NOT NULL, and
-- promote audited fields to NOT NULL. Active-season uniqueness remains deferred
-- until the multi-request season rollover is replaced by one atomic operation.
--
-- VALIDATION/LOCK NOTES:
-- CHECK/FK validation scans tables while allowing ordinary reads and writes.
-- SET NOT NULL and the two unique-index builds require stronger locks; apply in
-- a quiet window and use the rollout guide's statement/lock timeouts remotely.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

alter table public.leagues
  validate constraint leagues_current_season_format_check;

alter table public.league_seasons
  validate constraint league_seasons_season_format_check,
  validate constraint league_seasons_schedule_range_check,
  validate constraint league_seasons_money_range_check;

alter table public.league_members
  validate constraint league_members_season_format_check,
  validate constraint league_members_display_names_check,
  validate constraint league_members_season_scope_fkey;

alter table public.weekly_scores
  validate constraint weekly_scores_season_format_check,
  validate constraint weekly_scores_week_range_check,
  validate constraint weekly_scores_points_finite_check,
  validate constraint weekly_scores_lifecycle_check,
  validate constraint weekly_scores_member_scope_fkey;

alter table public.matchups
  validate constraint matchups_season_format_check,
  validate constraint matchups_week_range_check,
  validate constraint matchups_completion_state_check,
  validate constraint matchups_season_scope_fkey,
  validate constraint matchups_team1_scope_fkey,
  validate constraint matchups_team2_scope_fkey;

alter table public.leagues
  alter column current_season set not null;

alter table public.league_seasons
  alter column total_weeks set not null,
  alter column playoff_start_week set not null,
  alter column playoff_spots set not null,
  alter column is_active set not null;

alter table public.league_members
  alter column league_id set not null,
  alter column season set not null,
  alter column payment_status set not null;

alter table public.weekly_scores
  alter column season set not null,
  alter column is_final_score set not null,
  alter column is_playoff_week set not null,
  alter column week_status set not null;

alter table public.matchups
  alter column scores_locked set not null;

commit;
