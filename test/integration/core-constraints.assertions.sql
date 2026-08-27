\set ON_ERROR_STOP on

do $$
declare
  constraint_name text;
begin
  foreach constraint_name in array array[
    'leagues_current_season_format_check',
    'league_seasons_season_format_check',
    'league_seasons_schedule_range_check',
    'league_seasons_money_range_check',
    'league_members_season_format_check',
    'league_members_display_names_check',
    'league_members_season_scope_fkey',
    'weekly_scores_season_format_check',
    'weekly_scores_week_range_check',
    'weekly_scores_points_finite_check',
    'weekly_scores_lifecycle_check',
    'weekly_scores_member_scope_fkey',
    'matchups_season_format_check',
    'matchups_week_range_check',
    'matchups_completion_state_check',
    'matchups_season_scope_fkey',
    'matchups_team1_scope_fkey',
    'matchups_team2_scope_fkey'
  ] loop
    if not exists (
      select 1
      from pg_constraint
      where conname = constraint_name
        and convalidated
    ) then
      raise exception 'Core constraint % is missing or unvalidated.', constraint_name;
    end if;
  end loop;

  if to_regclass('public.matchups_unordered_pair_scope_unique_idx') is null then
    raise exception 'The unordered matchup uniqueness index is missing.';
  end if;
end;
$$;

do $$
declare
  nullable_column text;
begin
  foreach nullable_column in array array[
    'leagues.current_season',
    'league_seasons.total_weeks',
    'league_seasons.playoff_start_week',
    'league_seasons.playoff_spots',
    'league_seasons.is_active',
    'league_members.league_id',
    'league_members.season',
    'league_members.payment_status',
    'weekly_scores.season',
    'weekly_scores.is_final_score',
    'weekly_scores.is_playoff_week',
    'weekly_scores.week_status',
    'matchups.scores_locked'
  ] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = split_part(nullable_column, '.', 1)
        and column_name = split_part(nullable_column, '.', 2)
        and is_nullable = 'YES'
    ) then
      raise exception 'Core column % remains nullable.', nullable_column;
    end if;
  end loop;
end;
$$;

-- The unresolved historical-default decision remains unresolved: these two
-- optional legacy fields still accept null while rejecting invalid values.
update public.league_seasons
set draft_food_cost = null, weekly_prize_amount = null
where league_id = 'fixture-league' and season = '2025';

do $$
begin
  if not exists (
    select 1
    from public.league_seasons
    where league_id = 'fixture-league'
      and season = '2025'
      and draft_food_cost is null
      and weekly_prize_amount is null
  ) then
    raise exception 'Optional legacy money fields were unexpectedly promoted to NOT NULL.';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.league_members (
      league_id,
      manager_name,
      team_name,
      season,
      payment_status
    ) values (
      'fixture-league',
      'Invalid Scope Manager',
      'Invalid Scope Team',
      '2099',
      'pending'
    );
    raise exception 'Missing season scope was accepted.';
  exception when foreign_key_violation then
    null;
  end;

  begin
    update public.weekly_scores
    set week_number = 26
    where id = '00000000-0000-4000-8000-000000000021';
    raise exception 'Out-of-range score week was accepted.';
  exception when check_violation then
    null;
  end;

  begin
    update public.weekly_scores
    set is_final_score = false
    where id = '00000000-0000-4000-8000-000000000021';
    raise exception 'Inconsistent score lifecycle was accepted.';
  exception when check_violation then
    null;
  end;

  begin
    update public.matchups
    set week_completed_at = now()
    where id = '00000000-0000-4000-8000-000000000031';
    raise exception 'Inconsistent matchup completion state was accepted.';
  exception when check_violation then
    null;
  end;

end;
$$;
