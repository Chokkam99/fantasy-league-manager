-- Create a league, its first season, roster, finance defaults, and optional
-- current-season ESPN connection as one transaction. Historical seasons are
-- intentionally outside this workflow because ESPN exposes only the selected
-- current league season reliably.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create or replace function public.create_league_atomically(
  p_league_id text,
  p_name text,
  p_season text,
  p_configuration jsonb,
  p_members jsonb,
  p_espn_connection jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured jsonb;
  configured_division text;
  configured_member_count integer;
  division_names jsonb;
  draft_cost numeric;
  entry_fee numeric;
  espn_mapping jsonb := '{}'::jsonb;
  espn_team_id text;
  final_prizes jsonb;
  inserted_member_id uuid;
  playoff_spots_value integer;
  playoff_start_value integer;
  total_weeks_value integer;
  weekly_prize numeric;
begin
  if p_league_id is null
    or p_league_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(p_league_id) > 64
    or p_league_id = 'new' then
    raise exception using errcode = '22023', message = 'The league link is invalid.';
  end if;
  if p_name is null or btrim(p_name) = '' or char_length(btrim(p_name)) > 100 then
    raise exception using errcode = '22023', message = 'The league name is invalid.';
  end if;
  if p_season is null or p_season !~ '^[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'The season start year is invalid.';
  end if;
  if jsonb_typeof(p_configuration) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Season settings are required.';
  end if;
  if jsonb_typeof(p_configuration->'fee_amount') is distinct from 'number'
    or jsonb_typeof(p_configuration->'draft_food_cost') is distinct from 'number'
    or jsonb_typeof(p_configuration->'weekly_prize_amount') is distinct from 'number'
    or jsonb_typeof(p_configuration->'total_weeks') is distinct from 'number'
    or jsonb_typeof(p_configuration->'playoff_start_week') is distinct from 'number'
    or jsonb_typeof(p_configuration->'playoff_spots') is distinct from 'number' then
    raise exception using errcode = '22023', message = 'Season settings contain an invalid numeric value.';
  end if;
  if jsonb_typeof(p_members) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Season players must be a list.';
  end if;

  configured_member_count := jsonb_array_length(p_members);
  if configured_member_count < 2
    or configured_member_count > 64
    or configured_member_count % 2 <> 0 then
    raise exception using errcode = '22023', message = 'A season must include an even number of teams between 2 and 64.';
  end if;

  total_weeks_value := (p_configuration->>'total_weeks')::integer;
  playoff_start_value := (p_configuration->>'playoff_start_week')::integer;
  playoff_spots_value := (p_configuration->>'playoff_spots')::integer;
  entry_fee := (p_configuration->>'fee_amount')::numeric;
  draft_cost := (p_configuration->>'draft_food_cost')::numeric;
  weekly_prize := (p_configuration->>'weekly_prize_amount')::numeric;
  division_names := p_configuration->'divisions';
  final_prizes := p_configuration->'prize_structure';

  if total_weeks_value not between 1 and 25
    or playoff_start_value not between 1 and total_weeks_value
    or playoff_spots_value not between 2 and configured_member_count then
    raise exception using errcode = '22023', message = 'The season format is invalid.';
  end if;
  if entry_fee < 0 or draft_cost < 0 or weekly_prize < 0
    or entry_fee > 1000000 or draft_cost > 1000000 or weekly_prize > 1000000 then
    raise exception using errcode = '22023', message = 'The season money plan is invalid.';
  end if;
  if jsonb_typeof(division_names) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Season groups must be a list of up to 16 names.';
  end if;
  if jsonb_array_length(division_names) > 16
    or exists (
      select 1
      from jsonb_array_elements(division_names) division(value)
      where jsonb_typeof(division.value) <> 'string'
        or btrim(division.value #>> '{}') = ''
        or char_length(btrim(division.value #>> '{}')) > 40
    )
    or (
      select count(*) from jsonb_array_elements_text(division_names)
    ) <> (
      select count(distinct lower(btrim(value)))
      from jsonb_array_elements_text(division_names) division(value)
    ) then
    raise exception using errcode = '22023', message = 'Season groups are invalid or duplicated.';
  end if;
  if jsonb_typeof(final_prizes) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'The payout plan is invalid.';
  end if;
  if (select count(*) from jsonb_each(final_prizes)) > 32
    or exists (
      select 1
      from jsonb_each(final_prizes) prize(key, value)
      where prize.key !~ '^[a-z0-9_]{1,64}$'
        or jsonb_typeof(prize.value) <> 'number'
        or (prize.value #>> '{}')::numeric not between 0 and 1000000
    ) then
    raise exception using errcode = '22023', message = 'Prize categories are invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_members) member(value)
    where jsonb_typeof(member.value) is distinct from 'object'
      or jsonb_typeof(member.value->'manager_name') is distinct from 'string'
      or btrim(member.value->>'manager_name') = ''
      or char_length(btrim(member.value->>'manager_name')) > 80
      or jsonb_typeof(member.value->'team_name') is distinct from 'string'
      or btrim(member.value->>'team_name') = ''
      or char_length(btrim(member.value->>'team_name')) > 80
  ) then
    raise exception using errcode = '22023', message = 'Every player needs a valid manager and team name.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_members) member(value)
    group by lower(btrim(regexp_replace(member.value->>'manager_name', '[[:space:]]+', ' ', 'g')))
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Each manager can only appear once.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_members) member(value)
    group by lower(btrim(regexp_replace(member.value->>'team_name', '[[:space:]]+', ' ', 'g')))
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Each team name must be unique.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_members) member(value)
    where coalesce(btrim(member.value->>'division'), '') <> ''
      and not division_names ? btrim(member.value->>'division')
  ) then
    raise exception using errcode = '22023', message = 'Every player group must match a configured group.';
  end if;

  if p_espn_connection is not null then
    if jsonb_typeof(p_espn_connection) is distinct from 'object'
      or coalesce(p_espn_connection->>'league_id', '') !~ '^[0-9]{1,20}$'
      or jsonb_typeof(p_espn_connection->'private_league') is distinct from 'boolean'
      or jsonb_typeof(p_espn_connection->'auto_sync_enabled') is distinct from 'boolean' then
      raise exception using errcode = '22023', message = 'The ESPN connection is invalid.';
    end if;
    if (p_espn_connection->>'private_league')::boolean
      and (coalesce(p_espn_connection->>'espn_s2', '') = '' or coalesce(p_espn_connection->>'swid', '') = '') then
      raise exception using errcode = '22023', message = 'Private ESPN credentials are incomplete.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_members) member(value)
      where jsonb_typeof(member.value->'espn_team_id') is distinct from 'number'
        or (member.value->>'espn_team_id')::integer <= 0
    ) then
      raise exception using errcode = '22023', message = 'Every player must map to one current ESPN team.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_members) member(value)
      group by member.value->>'espn_team_id'
      having count(*) > 1
    ) then
      raise exception using errcode = '22023', message = 'Each ESPN team can only be mapped once.';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('new-league:' || p_league_id, 0));

  insert into public.leagues (
    id,
    name,
    current_season,
    platform_type,
    platform_league_id,
    auto_sync_enabled,
    sync_status
  ) values (
    p_league_id,
    btrim(regexp_replace(p_name, '[[:space:]]+', ' ', 'g')),
    p_season,
    case when p_espn_connection is null then 'manual' else 'espn' end,
    case when p_espn_connection is null then null else p_espn_connection->>'league_id' end,
    case when p_espn_connection is null then false else (p_espn_connection->>'auto_sync_enabled')::boolean end,
    case when p_espn_connection is null then 'none' else 'active' end
  );

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
    p_season,
    entry_fee,
    draft_cost,
    weekly_prize,
    total_weeks_value,
    playoff_start_value,
    playoff_spots_value,
    case when jsonb_array_length(division_names) = 0 then null else jsonb_build_object('divisions', division_names) end,
    final_prizes,
    null,
    true
  );

  for configured in select value from jsonb_array_elements(p_members)
  loop
    configured_division := nullif(btrim(configured->>'division'), '');
    insert into public.league_members (
      league_id,
      manager_name,
      team_name,
      season,
      division,
      is_active,
      payment_status
    ) values (
      p_league_id,
      btrim(regexp_replace(configured->>'manager_name', '[[:space:]]+', ' ', 'g')),
      btrim(regexp_replace(configured->>'team_name', '[[:space:]]+', ' ', 'g')),
      p_season,
      configured_division,
      true,
      'pending'
    ) returning id into inserted_member_id;

    if p_espn_connection is not null then
      espn_team_id := configured->>'espn_team_id';
      espn_mapping := jsonb_set(
        espn_mapping,
        array[espn_team_id],
        to_jsonb(inserted_member_id::text),
        true
      );
    end if;
  end loop;

  if p_espn_connection is not null then
    update public.leagues
    set platform_config = jsonb_build_object(
      'credentials', case
        when (p_espn_connection->>'private_league')::boolean then jsonb_build_object(
          'espn_s2', p_espn_connection->>'espn_s2',
          'swid', p_espn_connection->>'swid'
        )
        else '{}'::jsonb
      end,
      'league_id', p_espn_connection->>'league_id',
      'platform_type', 'espn',
      'private_league', (p_espn_connection->>'private_league')::boolean,
      'team_mappings', jsonb_build_object(p_season, espn_mapping),
      'year', p_season::integer
    )
    where id = p_league_id;
  end if;

  return jsonb_build_object(
    'league_id', p_league_id,
    'member_count', configured_member_count,
    'season', p_season,
    'success', true
  );
end;
$$;

revoke all on function public.create_league_atomically(text, text, text, jsonb, jsonb, jsonb) from public;
revoke all on function public.create_league_atomically(text, text, text, jsonb, jsonb, jsonb) from anon;
revoke all on function public.create_league_atomically(text, text, text, jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.create_league_atomically(text, text, text, jsonb, jsonb, jsonb) to service_role;

commit;
