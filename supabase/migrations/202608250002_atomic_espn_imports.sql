-- Atomic, idempotent ESPN week persistence with transaction-scoped locking and
-- durable run history. Apply only after 202608250001_authorization_foundation.

begin;

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  season text not null,
  week_number integer not null,
  source text not null default 'espn',
  trigger_mode text not null,
  status text not null default 'running',
  score_count integer not null default 0,
  matchup_count integer not null default 0,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint import_runs_season_check check (season ~ '^\d{4}$'),
  constraint import_runs_week_check check (week_number between 1 and 30),
  constraint import_runs_source_check check (source in ('espn')),
  constraint import_runs_trigger_mode_check
    check (trigger_mode in ('manual', 'scheduled', 'scheduled_correction')),
  constraint import_runs_status_check
    check (status in ('running', 'succeeded', 'failed')),
  constraint import_runs_counts_check
    check (score_count >= 0 and matchup_count >= 0),
  constraint import_runs_completion_check check (
    (status = 'running' and completed_at is null)
    or (status in ('succeeded', 'failed') and completed_at is not null)
  )
);

create index if not exists import_runs_league_season_started_idx
  on public.import_runs (league_id, season, started_at desc);

alter table public.import_runs enable row level security;
revoke all privileges on table public.import_runs from public, anon, authenticated;
grant select on table public.import_runs to service_role;

create or replace function public.import_espn_week_atomically(
  p_league_id text,
  p_season text,
  p_week integer,
  p_scores jsonb,
  p_matchups jsonb,
  p_trigger_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_member_count integer;
  caught_error_detail text;
  caught_error_message text;
  caught_error_state text;
  expected_matchup_count integer;
  import_run_id uuid;
  imported_matchup_count integer := 0;
  imported_score_count integer := 0;
  playoff_start_week integer;
  total_weeks integer;
begin
  if p_league_id is null or btrim(p_league_id) = '' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_REQUEST',
      'error', 'A league is required.'
    );
  end if;

  if p_season is null or p_season !~ '^\d{4}$' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_REQUEST',
      'error', 'A valid season is required.'
    );
  end if;

  if p_week is null or p_week < 1 or p_week > 30 then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_REQUEST',
      'error', 'A valid week is required.'
    );
  end if;

  if p_trigger_mode not in ('manual', 'scheduled', 'scheduled_correction') then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_REQUEST',
      'error', 'The import trigger is not valid.'
    );
  end if;

  if not pg_try_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', 'espn', p_league_id, p_season, p_week::text),
      0
    )
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'IMPORT_LOCKED',
      'error', 'This league week is already being imported.'
    );
  end if;

  insert into public.import_runs (
    league_id,
    season,
    week_number,
    source,
    trigger_mode,
    status
  ) values (
    p_league_id,
    p_season,
    p_week,
    'espn',
    p_trigger_mode,
    'running'
  )
  returning id into import_run_id;

  begin
    if jsonb_typeof(p_scores) <> 'array'
      or jsonb_typeof(p_matchups) <> 'array' then
      raise exception using
        errcode = '22023',
        message = 'Scores and matchups must be JSON arrays.';
    end if;

    select
      coalesce(ls.playoff_start_week, 15),
      coalesce(ls.total_weeks, 17)
    into playoff_start_week, total_weeks
    from public.leagues l
    join public.league_seasons ls
      on ls.league_id = l.id
      and ls.season = p_season
    where l.id = p_league_id
      and l.current_season = p_season
      and coalesce(ls.is_active, true);

    if not found then
      raise exception using
        errcode = '23503',
        message = 'The active league season could not be found.';
    end if;

    if p_week > total_weeks then
      raise exception using
        errcode = '23514',
        message = format('Week must be between 1 and %s.', total_weeks);
    end if;

    select count(*) into active_member_count
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.season = p_season
      and coalesce(lm.is_active, true);

    if active_member_count = 0 then
      raise exception using
        errcode = '23514',
        message = 'No active league players are available for import.';
    end if;

    if jsonb_array_length(p_scores) <> active_member_count then
      raise exception using
        errcode = '23514',
        message = format(
          'Expected %s scores, received %s.',
          active_member_count,
          jsonb_array_length(p_scores)
        );
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_scores) as score(member_id text, points jsonb)
      where score.member_id is null
        or btrim(score.member_id) = ''
        or jsonb_typeof(score.points) <> 'number'
    ) then
      raise exception using
        errcode = '22023',
        message = 'Every score requires a player ID and numeric points.';
    end if;

    if (
      select count(distinct score.member_id)
      from jsonb_to_recordset(p_scores) as score(member_id text)
    ) <> active_member_count then
      raise exception using
        errcode = '23514',
        message = 'Every active player must appear exactly once in scores.';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_scores) as score(member_id text)
      left join public.league_members lm
        on lm.id::text = score.member_id
        and lm.league_id = p_league_id
        and lm.season = p_season
        and coalesce(lm.is_active, true)
      where lm.id is null
    ) then
      raise exception using
        errcode = '23503',
        message = 'A score references a player outside the active season.';
    end if;

    expected_matchup_count := floor(active_member_count / 2.0);
    if jsonb_array_length(p_matchups) <> expected_matchup_count then
      raise exception using
        errcode = '23514',
        message = format(
          'Expected %s matchups, received %s.',
          expected_matchup_count,
          jsonb_array_length(p_matchups)
        );
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_matchups) as matchup(
        team1_member_id text,
        team2_member_id text
      )
      where matchup.team1_member_id is null
        or matchup.team2_member_id is null
        or matchup.team1_member_id = matchup.team2_member_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Every matchup requires two distinct players.';
    end if;

    if (
      select count(*) = count(distinct participant.member_id)
      from (
        select matchup.team1_member_id as member_id
        from jsonb_to_recordset(p_matchups) as matchup(
          team1_member_id text,
          team2_member_id text
        )
        union all
        select matchup.team2_member_id
        from jsonb_to_recordset(p_matchups) as matchup(
          team1_member_id text,
          team2_member_id text
        )
      ) participant
    ) is not true then
      raise exception using
        errcode = '23514',
        message = 'A player appears in more than one matchup.';
    end if;

    if exists (
      select 1
      from (
        select matchup.team1_member_id as member_id
        from jsonb_to_recordset(p_matchups) as matchup(
          team1_member_id text,
          team2_member_id text
        )
        union all
        select matchup.team2_member_id
        from jsonb_to_recordset(p_matchups) as matchup(
          team1_member_id text,
          team2_member_id text
        )
      ) participant
      left join public.league_members lm
        on lm.id::text = participant.member_id
        and lm.league_id = p_league_id
        and lm.season = p_season
        and coalesce(lm.is_active, true)
      where lm.id is null
    ) then
      raise exception using
        errcode = '23503',
        message = 'A matchup references a player outside the active season.';
    end if;

    delete from public.matchups
    where league_id = p_league_id
      and season = p_season
      and week_number = p_week;

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
      score.member_id::uuid,
      score.points,
      true,
      p_week >= playoff_start_week,
      'completed'
    from jsonb_to_recordset(p_scores) as score(
      member_id text,
      points numeric
    );
    get diagnostics imported_score_count = row_count;

    insert into public.matchups (
      league_id,
      season,
      week_number,
      team1_member_id,
      team2_member_id,
      scores_locked,
      week_completed_at
    )
    select
      p_league_id,
      p_season,
      p_week,
      matchup.team1_member_id::uuid,
      matchup.team2_member_id::uuid,
      true,
      now()
    from jsonb_to_recordset(p_matchups) as matchup(
      team1_member_id text,
      team2_member_id text
    );
    get diagnostics imported_matchup_count = row_count;

    update public.leagues
    set
      last_sync_at = now(),
      last_sync_error = null,
      sync_status = 'active'
    where id = p_league_id;

    update public.import_runs
    set
      status = 'succeeded',
      score_count = imported_score_count,
      matchup_count = imported_matchup_count,
      completed_at = now()
    where id = import_run_id;

    return jsonb_build_object(
      'success', true,
      'code', 'IMPORTED',
      'run_id', import_run_id,
      'score_count', imported_score_count,
      'matchup_count', imported_matchup_count
    );
  exception when others then
    get stacked diagnostics
      caught_error_state = returned_sqlstate,
      caught_error_message = message_text,
      caught_error_detail = pg_exception_detail;

    update public.import_runs
    set
      status = 'failed',
      error_code = caught_error_state,
      error_message = left(
        concat_ws(
          ' ',
          caught_error_message,
          nullif(caught_error_detail, '')
        ),
        1000
      ),
      completed_at = now()
    where id = import_run_id;

    update public.leagues
    set
      last_sync_error = left(caught_error_message, 1000),
      sync_status = 'error'
    where id = p_league_id;

    return jsonb_build_object(
      'success', false,
      'code', 'IMPORT_FAILED',
      'run_id', import_run_id,
      'error', caught_error_message
    );
  end;
end;
$$;

revoke execute on function public.import_espn_week_atomically(
  text,
  text,
  integer,
  jsonb,
  jsonb,
  text
) from public, anon, authenticated;
grant execute on function public.import_espn_week_atomically(
  text,
  text,
  integer,
  jsonb,
  jsonb,
  text
) to service_role;

commit;
