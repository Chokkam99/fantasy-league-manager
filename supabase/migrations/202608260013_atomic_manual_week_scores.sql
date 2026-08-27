-- Make commissioner score corrections all-or-nothing, serialize them with
-- ESPN imports, and derive playoff state from the selected season.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create or replace function public.derive_weekly_score_playoff_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_playoff_start integer;
begin
  select season_config.playoff_start_week
  into configured_playoff_start
  from public.league_seasons season_config
  where season_config.league_id = new.league_id
    and season_config.season = new.season;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'The score season configuration was not found.';
  end if;

  new.is_playoff_week := new.week_number >= configured_playoff_start;
  return new;
end;
$$;

revoke execute on function public.derive_weekly_score_playoff_flag()
  from public, anon, authenticated;

drop trigger if exists derive_weekly_score_playoff_flag
  on public.weekly_scores;
create trigger derive_weekly_score_playoff_flag
  before insert or update of league_id, season, week_number, is_playoff_week
  on public.weekly_scores
  for each row
  execute function public.derive_weekly_score_playoff_flag();

create or replace function public.mutate_manual_week_atomically(
  p_action text,
  p_league_id text,
  p_season text,
  p_week integer,
  p_scores jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_member_count integer;
  affected_matchup_count integer := 0;
  affected_score_count integer := 0;
  configured_playoff_start integer;
  configured_total_weeks integer;
  lock_week integer;
begin
  if p_action not in ('save_week', 'clear_week', 'clear_season')
      or p_league_id is null
      or btrim(p_league_id) = ''
      or p_season is null
      or p_season !~ '^[0-9]{4}$' then
    raise exception using
      errcode = '22023',
      message = 'A supported action, league, and four-digit season are required.';
  end if;

  if p_action = 'clear_season' then
    if p_week is not null then
      raise exception using
        errcode = '22023',
        message = 'A season-wide clear cannot specify one week.';
    end if;

    -- Lock every supported week in the same key space used by ESPN imports.
    -- Acquiring in ascending order avoids deadlocks between season clears.
    for lock_week in 1..25 loop
      if not pg_try_advisory_xact_lock(
        hashtextextended(
          concat_ws(':', 'espn', p_league_id, p_season, lock_week::text),
          0
        )
      ) then
        raise exception using
          errcode = '55P03',
          message = 'A score import or correction is already in progress.';
      end if;
    end loop;
  else
    if p_week is null or p_week not between 1 and 25 then
      raise exception using
        errcode = '22023',
        message = 'A valid week is required.';
    end if;

    if not pg_try_advisory_xact_lock(
      hashtextextended(
        concat_ws(':', 'espn', p_league_id, p_season, p_week::text),
        0
      )
    ) then
      raise exception using
        errcode = '55P03',
        message = 'A score import or correction is already in progress.';
    end if;
  end if;

  select
    season_config.playoff_start_week,
    season_config.total_weeks
  into configured_playoff_start, configured_total_weeks
  from public.leagues league
  join public.league_seasons season_config
    on season_config.league_id = league.id
   and season_config.season = p_season
  where league.id = p_league_id
    and league.archived_at is null
    and season_config.archived_at is null
  for update of league, season_config;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The league season was not found or is archived.';
  end if;

  if p_action <> 'clear_season' and p_week > configured_total_weeks then
    raise exception using
      errcode = '22023',
      message = format('Week must be between 1 and %s.', configured_total_weeks);
  end if;

  if p_action = 'save_week' then
    if jsonb_typeof(p_scores) is distinct from 'array' then
      raise exception using
        errcode = '22023',
        message = 'Scores must be provided as a list.';
    end if;

    select count(*)
    into active_member_count
    from public.league_members member
    where member.league_id = p_league_id
      and member.season = p_season
      and member.is_active;

    if active_member_count = 0 then
      raise exception using
        errcode = '23514',
        message = 'No active players are available for this season.';
    end if;

    if jsonb_array_length(p_scores) <> active_member_count
        or exists (
          select 1
          from jsonb_array_elements(p_scores) score(value)
          where jsonb_typeof(score.value) <> 'object'
            or jsonb_typeof(score.value->'member_id') is distinct from 'string'
            or score.value->>'member_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            or jsonb_typeof(score.value->'points') is distinct from 'number'
        ) then
      raise exception using
        errcode = '23514',
        message = format(
          'Enter one valid score for each of the %s active players.',
          active_member_count
        );
    end if;

    if (
      select count(distinct score.value->>'member_id')
      from jsonb_array_elements(p_scores) score(value)
    ) <> active_member_count then
      raise exception using
        errcode = '23514',
        message = 'Every active player must appear exactly once in scores.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_scores) score(value)
      left join public.league_members member
        on member.id = (score.value->>'member_id')::uuid
       and member.league_id = p_league_id
       and member.season = p_season
       and member.is_active
      where member.id is null
    ) then
      raise exception using
        errcode = '23503',
        message = 'A score references a player outside the active season roster.';
    end if;

    -- Existing schedules remain intact, but every participant must be an
    -- active player with exactly one submitted score and may appear once.
    if exists (
      select 1
      from (
        select matchup.team1_member_id as member_id
        from public.matchups matchup
        where matchup.league_id = p_league_id
          and matchup.season = p_season
          and matchup.week_number = p_week
        union all
        select matchup.team2_member_id
        from public.matchups matchup
        where matchup.league_id = p_league_id
          and matchup.season = p_season
          and matchup.week_number = p_week
      ) participant
      left join public.league_members member
        on member.id = participant.member_id
       and member.league_id = p_league_id
       and member.season = p_season
       and member.is_active
      left join jsonb_array_elements(p_scores) score(value)
        on (score.value->>'member_id')::uuid = participant.member_id
      where member.id is null or score.value is null
    ) then
      raise exception using
        errcode = '23514',
        message = 'Every scheduled player must have one score and remain active.';
    end if;

    if (
      select count(*) = count(distinct participant.member_id)
      from (
        select matchup.team1_member_id as member_id
        from public.matchups matchup
        where matchup.league_id = p_league_id
          and matchup.season = p_season
          and matchup.week_number = p_week
        union all
        select matchup.team2_member_id
        from public.matchups matchup
        where matchup.league_id = p_league_id
          and matchup.season = p_season
          and matchup.week_number = p_week
      ) participant
    ) is not true then
      raise exception using
        errcode = '23514',
        message = 'A player appears in more than one matchup for this week.';
    end if;

    delete from public.weekly_scores
    where league_id = p_league_id
      and season = p_season
      and week_number = p_week;

    insert into public.weekly_scores (
      league_id,
      season,
      week_number,
      member_id,
      points,
      is_final_score,
      is_playoff_week,
      week_status
    )
    select
      p_league_id,
      p_season,
      p_week,
      score.member_id,
      score.points,
      true,
      p_week >= configured_playoff_start,
      'completed'
    from jsonb_to_recordset(p_scores) as score(
      member_id uuid,
      points numeric
    );
    get diagnostics affected_score_count = row_count;

    update public.matchups
    set
      scores_locked = true,
      week_completed_at = now()
    where league_id = p_league_id
      and season = p_season
      and week_number = p_week;
    get diagnostics affected_matchup_count = row_count;
  elsif p_action = 'clear_week' then
    delete from public.weekly_scores
    where league_id = p_league_id
      and season = p_season
      and week_number = p_week;
    get diagnostics affected_score_count = row_count;

    update public.matchups
    set
      scores_locked = false,
      week_completed_at = null
    where league_id = p_league_id
      and season = p_season
      and week_number = p_week;
    get diagnostics affected_matchup_count = row_count;
  else
    delete from public.weekly_scores
    where league_id = p_league_id
      and season = p_season;
    get diagnostics affected_score_count = row_count;

    update public.matchups
    set
      scores_locked = false,
      week_completed_at = null
    where league_id = p_league_id
      and season = p_season;
    get diagnostics affected_matchup_count = row_count;
  end if;

  return jsonb_build_object(
    'success', true,
    'action', p_action,
    'season', p_season,
    'week', p_week,
    'score_count', affected_score_count,
    'matchup_count', affected_matchup_count
  );
end;
$$;

revoke execute on function public.mutate_manual_week_atomically(
  text,
  text,
  text,
  integer,
  jsonb
) from public, anon, authenticated;
grant execute on function public.mutate_manual_week_atomically(
  text,
  text,
  text,
  integer,
  jsonb
) to service_role;

commit;
