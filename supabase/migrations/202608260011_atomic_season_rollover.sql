-- Atomic season rollover. This replaces the application's multi-request
-- create/member/activate/deactivate sequence with one locked transaction.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create or replace function public.rollover_league_season_atomically(
  p_league_id text,
  p_source_season text,
  p_target_season text,
  p_configuration jsonb,
  p_members jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  copied_players integer := 0;
  divisions_value jsonb;
  draft_cost numeric;
  entry_fee numeric;
  league_current_season text;
  lock_acquired boolean;
  member_count integer;
  playoff_spots_number numeric;
  playoff_spots_value integer;
  playoff_start_number numeric;
  playoff_start_value integer;
  prize_structure_value jsonb;
  requested_returning_count integer;
  resolved_returning_count integer;
  total_weeks_number numeric;
  total_weeks_value integer;
  weekly_prize numeric;
begin
  if p_league_id is null or btrim(p_league_id) = ''
      or p_source_season is null
      or p_target_season is null
      or p_source_season !~ '^[0-9]{4}$'
      or p_target_season !~ '^[0-9]{4}$'
      or p_target_season::integer <> p_source_season::integer + 1 then
    raise exception using
      errcode = '22023',
      message = 'A league and consecutive four-digit source and target seasons are required.';
  end if;

  select pg_try_advisory_xact_lock(
    hashtextextended(concat_ws(':', 'season-rollover', p_league_id), 0)
  ) into lock_acquired;
  if not lock_acquired then
    raise exception using
      errcode = '55P03',
      message = 'Another season rollover is already in progress.';
  end if;

  select league.current_season
  into league_current_season
  from public.leagues league
  where league.id = p_league_id
    and league.archived_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'League not found or archived.';
  end if;
  if league_current_season <> p_source_season then
    raise exception using
      errcode = '40001',
      message = 'The active season changed before rollover could start.';
  end if;

  perform 1
  from public.league_seasons season_config
  where season_config.league_id = p_league_id
    and season_config.season = p_source_season
    and season_config.is_active
    and season_config.archived_at is null
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The active source season configuration was not found.';
  end if;

  if exists (
    select 1
    from public.league_seasons
    where league_id = p_league_id and season = p_target_season
  ) then
    raise exception using
      errcode = '23505',
      message = 'The target season is already configured.';
  end if;

  if jsonb_typeof(p_configuration) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Season settings must be an object.';
  end if;

  if jsonb_typeof(p_configuration->'fee_amount') is distinct from 'number'
      or jsonb_typeof(p_configuration->'draft_food_cost') is distinct from 'number'
      or jsonb_typeof(p_configuration->'weekly_prize_amount') is distinct from 'number'
      or jsonb_typeof(p_configuration->'total_weeks') is distinct from 'number'
      or jsonb_typeof(p_configuration->'playoff_start_week') is distinct from 'number'
      or jsonb_typeof(p_configuration->'playoff_spots') is distinct from 'number' then
    raise exception using errcode = '22023', message = 'Season settings contain an invalid numeric value.';
  end if;

  entry_fee := (p_configuration->>'fee_amount')::numeric;
  draft_cost := (p_configuration->>'draft_food_cost')::numeric;
  weekly_prize := (p_configuration->>'weekly_prize_amount')::numeric;
  total_weeks_number := (p_configuration->>'total_weeks')::numeric;
  playoff_start_number := (p_configuration->>'playoff_start_week')::numeric;
  playoff_spots_number := (p_configuration->>'playoff_spots')::numeric;

  if entry_fee not between 0 and 1000000
      or draft_cost not between 0 and 1000000
      or weekly_prize not between 0 and 1000000
      or total_weeks_number <> trunc(total_weeks_number)
      or playoff_start_number <> trunc(playoff_start_number)
      or playoff_spots_number <> trunc(playoff_spots_number)
      or total_weeks_number not between 1 and 25
      or playoff_start_number not between 1 and total_weeks_number
      or playoff_spots_number not between 2 and 64 then
    raise exception using errcode = '22023', message = 'Season settings are outside supported ranges.';
  end if;

  total_weeks_value := total_weeks_number::integer;
  playoff_start_value := playoff_start_number::integer;
  playoff_spots_value := playoff_spots_number::integer;

  divisions_value := coalesce(p_configuration->'divisions', '[]'::jsonb);
  if jsonb_typeof(divisions_value) is distinct from 'array'
      or jsonb_array_length(divisions_value) > 16
      or exists (
        select 1
        from jsonb_array_elements(divisions_value) division(value)
        where jsonb_typeof(division.value) <> 'string'
          or btrim(division.value #>> '{}') = ''
          or char_length(btrim(division.value #>> '{}')) > 40
      )
      or (
        select count(*)
        from jsonb_array_elements_text(divisions_value) division(value)
      ) <> (
        select count(distinct lower(btrim(division.value)))
        from jsonb_array_elements_text(divisions_value) division(value)
      ) then
    raise exception using errcode = '22023', message = 'Season groups are invalid or duplicated.';
  end if;

  prize_structure_value := coalesce(p_configuration->'prize_structure', '{}'::jsonb);
  if jsonb_typeof(prize_structure_value) is distinct from 'object'
      or (select count(*) from jsonb_each(prize_structure_value)) > 32
      or exists (
        select 1
        from jsonb_each(prize_structure_value) prize(key, value)
        where prize.key !~ '^[a-z0-9_]{1,64}$'
          or jsonb_typeof(prize.value) <> 'number'
          or (prize.value #>> '{}')::numeric not between 0 and 1000000
      ) then
    raise exception using errcode = '22023', message = 'Prize categories are invalid.';
  end if;

  if jsonb_typeof(p_members) is distinct from 'array'
      or jsonb_array_length(p_members) > 64
      or exists (
        select 1 from jsonb_array_elements(p_members) member(value)
        where jsonb_typeof(member.value) <> 'object'
      ) then
    raise exception using errcode = '22023', message = 'Season players must be a valid list.';
  end if;
  member_count := jsonb_array_length(p_members);

  if exists (
    select 1
    from jsonb_array_elements(p_members) member(value)
    where jsonb_typeof(member.value->'manager_name') is distinct from 'string'
      or btrim(member.value->>'manager_name') = ''
      or char_length(btrim(member.value->>'manager_name')) > 80
      or jsonb_typeof(member.value->'team_name') is distinct from 'string'
      or btrim(member.value->>'team_name') = ''
      or char_length(btrim(member.value->>'team_name')) > 80
      or (
        member.value->>'source_member_id' is not null
        and member.value->>'source_member_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
      or (
        nullif(btrim(member.value->>'division'), '') is not null
        and not exists (
          select 1
          from jsonb_array_elements_text(divisions_value) division(value)
          where division.value = btrim(member.value->>'division')
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'A season player is invalid.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_members) member(value)
  ) <> (
    select count(distinct lower(btrim(regexp_replace(
      member.value->>'manager_name',
      '[[:space:]]+',
      ' ',
      'g'
    ))))
    from jsonb_array_elements(p_members) member(value)
  ) then
    raise exception using errcode = '22023', message = 'Manager names must be unique within a season.';
  end if;

  select count(*)
  into requested_returning_count
  from jsonb_array_elements(p_members) member(value)
  where member.value->>'source_member_id' is not null;

  if requested_returning_count <> (
    select count(distinct member.value->>'source_member_id')
    from jsonb_array_elements(p_members) member(value)
    where member.value->>'source_member_id' is not null
  ) then
    raise exception using errcode = '22023', message = 'A returning player was selected more than once.';
  end if;

  select count(*)
  into resolved_returning_count
  from jsonb_array_elements(p_members) configured(value)
  join public.league_members source_member
    on source_member.id = (configured.value->>'source_member_id')::uuid
   and source_member.league_id = p_league_id
   and source_member.season = p_source_season
   and source_member.is_active
  where configured.value->>'source_member_id' is not null;

  if requested_returning_count <> resolved_returning_count then
    raise exception using
      errcode = 'P0002',
      message = 'A selected returning player is not active in the source season.';
  end if;

  -- Deactivate before inserting the active target so the partial unique index
  -- added by migration 012 remains valid throughout the transaction.
  update public.league_seasons
  set is_active = false
  where league_id = p_league_id
    and season = p_source_season
    and is_active;

  insert into public.league_seasons (
    league_id,
    season,
    fee_amount,
    draft_food_cost,
    weekly_prize_amount,
    total_weeks,
    playoff_start_week,
    playoff_spots,
    divisions,
    prize_structure,
    final_winners,
    is_active
  ) values (
    p_league_id,
    p_target_season,
    entry_fee,
    draft_cost,
    weekly_prize,
    total_weeks_value,
    playoff_start_value,
    playoff_spots_value,
    case
      when jsonb_array_length(divisions_value) = 0 then null
      else jsonb_build_object('divisions', divisions_value)
    end,
    prize_structure_value,
    null,
    true
  );

  insert into public.league_members (
    league_id,
    manager_id,
    manager_name,
    team_name,
    season,
    division,
    is_active,
    payment_status
  )
  select
    p_league_id,
    source_member.manager_id,
    btrim(regexp_replace(configured.manager_name, '[[:space:]]+', ' ', 'g')),
    btrim(regexp_replace(configured.team_name, '[[:space:]]+', ' ', 'g')),
    p_target_season,
    nullif(btrim(configured.division), ''),
    true,
    'pending'
  from jsonb_to_recordset(p_members) as configured(
    source_member_id uuid,
    manager_name text,
    team_name text,
    division text
  )
  left join public.league_members source_member
    on source_member.id = configured.source_member_id
   and source_member.league_id = p_league_id
   and source_member.season = p_source_season
   and source_member.is_active;
  get diagnostics copied_players = row_count;

  if copied_players <> member_count then
    raise exception 'Season rollover inserted %, expected % players.', copied_players, member_count;
  end if;

  update public.leagues
  set
    current_season = p_target_season,
    auto_sync_enabled = false,
    last_sync_at = null,
    last_sync_error = null,
    sync_status = 'disabled',
    updated_at = now()
  where id = p_league_id
    and current_season = p_source_season;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'The active season changed before rollover could finish.';
  end if;

  return jsonb_build_object(
    'success', true,
    'source_season', p_source_season,
    'target_season', p_target_season,
    'copied_players', copied_players
  );
end;
$$;

revoke execute on function public.rollover_league_season_atomically(
  text,
  text,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.rollover_league_season_atomically(
  text,
  text,
  text,
  jsonb,
  jsonb
) to service_role;

commit;
