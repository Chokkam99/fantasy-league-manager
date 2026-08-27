-- Add audited core safeguards in NOT VALID form where PostgreSQL supports it.
-- Apply only after migrations 006-008. Validation and NOT NULL promotion are
-- intentionally separate in migration 010.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

alter table public.leagues
  add constraint leagues_current_season_format_check
  check (current_season ~ '^[0-9]{4}$') not valid;

alter table public.league_seasons
  add constraint league_seasons_season_format_check
    check (season ~ '^[0-9]{4}$') not valid,
  add constraint league_seasons_schedule_range_check
    check (
      total_weeks between 1 and 25
      and playoff_start_week between 1 and total_weeks
      and playoff_spots > 0
    ) not valid,
  add constraint league_seasons_money_range_check
    check (
      fee_amount >= 0
      and fee_amount not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
      and (
        draft_food_cost is null
        or (
          draft_food_cost >= 0
          and draft_food_cost not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
        )
      )
      and (
        weekly_prize_amount is null
        or (
          weekly_prize_amount >= 0
          and weekly_prize_amount not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
        )
      )
    ) not valid;

alter table public.league_members
  add constraint league_members_season_format_check
    check (season ~ '^[0-9]{4}$') not valid,
  add constraint league_members_display_names_check
    check (
      btrim(manager_name) <> ''
      and char_length(manager_name) <= 80
      and btrim(team_name) <> ''
      and char_length(team_name) <= 80
    ) not valid,
  add constraint league_members_season_scope_fkey
    foreign key (league_id, season)
    references public.league_seasons(league_id, season)
    on update cascade
    on delete cascade
    not valid;

alter table public.weekly_scores
  add constraint weekly_scores_season_format_check
    check (season ~ '^[0-9]{4}$') not valid,
  add constraint weekly_scores_week_range_check
    check (week_number between 1 and 25) not valid,
  add constraint weekly_scores_points_finite_check
    check (points not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)) not valid,
  add constraint weekly_scores_lifecycle_check
    check (is_final_score = (week_status = 'completed')) not valid,
  add constraint weekly_scores_member_scope_fkey
    foreign key (member_id, league_id, season)
    references public.league_members(id, league_id, season)
    on update cascade
    on delete cascade
    not valid;

alter table public.matchups
  add constraint matchups_season_format_check
    check (season ~ '^[0-9]{4}$') not valid,
  add constraint matchups_week_range_check
    check (week_number between 1 and 25) not valid,
  add constraint matchups_completion_state_check
    check (scores_locked = (week_completed_at is not null)) not valid,
  add constraint matchups_season_scope_fkey
    foreign key (league_id, season)
    references public.league_seasons(league_id, season)
    on update cascade
    on delete cascade
    not valid,
  add constraint matchups_team1_scope_fkey
    foreign key (team1_member_id, league_id, season)
    references public.league_members(id, league_id, season)
    on update cascade
    on delete cascade
    not valid,
  add constraint matchups_team2_scope_fkey
    foreign key (team2_member_id, league_id, season)
    references public.league_members(id, league_id, season)
    on update cascade
    on delete cascade
    not valid;

-- A regular unique index takes a brief write-blocking lock. The audited table
-- has only 773 rows; retain this transactional form for rollback safety rather
-- than using CREATE INDEX CONCURRENTLY inside the migration transaction.
create unique index matchups_unordered_pair_scope_unique_idx
  on public.matchups (
    league_id,
    season,
    week_number,
    least(team1_member_id, team2_member_id),
    greatest(team1_member_id, team2_member_id)
  );

commit;
