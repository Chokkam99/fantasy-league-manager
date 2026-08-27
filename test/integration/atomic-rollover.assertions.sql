\set ON_ERROR_STOP on

do $$
begin
  if to_regprocedure(
    'public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)'
  ) is null then
    raise exception 'Atomic rollover function is missing.';
  end if;
  if to_regclass('public.league_seasons_one_active_scope_idx') is null then
    raise exception 'One-active-season index is missing.';
  end if;
  if has_function_privilege(
    'anon',
    'public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'A shared role can execute atomic rollover.';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'service_role cannot execute atomic rollover.';
  end if;
end;
$$;

insert into public.leagues (
  id,
  name,
  current_season,
  auto_sync_enabled,
  sync_status
) values (
  'rollover-fixture-league',
  'Atomic Rollover Fixture',
  '2026',
  true,
  'active'
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
  is_active
) values (
  'rollover-fixture-league',
  '2026',
  50,
  20,
  5,
  17,
  15,
  4,
  '{"divisions":["Old"]}',
  '{"first":100}',
  true
);

insert into public.league_members (
  id,
  league_id,
  manager_name,
  team_name,
  season,
  division,
  is_active,
  payment_status
) values
  (
    '80000000-0000-4000-8000-000000000001',
    'rollover-fixture-league',
    'Returning Manager',
    'Old Team',
    '2026',
    'Old',
    true,
    'paid'
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    'rollover-fixture-league',
    'Not Returning',
    'Retired Team',
    '2026',
    'Old',
    true,
    'paid'
  );

set role service_role;

do $$
declare
  result jsonb;
begin
  select public.rollover_league_season_atomically(
    'rollover-fixture-league',
    '2026',
    '2027',
    '{
      "divisions":["North","South"],
      "draft_food_cost":75,
      "fee_amount":125,
      "playoff_spots":4,
      "playoff_start_week":15,
      "prize_structure":{"first":500,"second":250},
      "total_weeks":17,
      "weekly_prize_amount":10
    }'::jsonb,
    '[
      {
        "source_member_id":"80000000-0000-4000-8000-000000000001",
        "manager_name":"Returning Manager Renamed",
        "team_name":"New Team Name",
        "division":"North"
      },
      {
        "source_member_id":null,
        "manager_name":"Expansion Manager",
        "team_name":"Expansion Team",
        "division":"South"
      }
    ]'::jsonb
  ) into result;

  if not coalesce((result->>'success')::boolean, false)
      or (result->>'copied_players')::integer <> 2
      or result->>'target_season' <> '2027' then
    raise exception 'Atomic rollover returned an invalid result: %', result;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.leagues
    where id = 'rollover-fixture-league'
      and current_season = '2027'
      and not auto_sync_enabled
      and sync_status = 'disabled'
  ) then
    raise exception 'Atomic rollover did not activate the target league season.';
  end if;
  if (
    select count(*) from public.league_seasons
    where league_id = 'rollover-fixture-league' and is_active
  ) <> 1 or not exists (
    select 1 from public.league_seasons
    where league_id = 'rollover-fixture-league'
      and season = '2027'
      and is_active
      and fee_amount = 125
      and divisions = '{"divisions":["North","South"]}'::jsonb
  ) then
    raise exception 'Atomic rollover left incoherent season configuration.';
  end if;
  if (
    select count(*) from public.league_members
    where league_id = 'rollover-fixture-league' and season = '2027'
  ) <> 2 then
    raise exception 'Atomic rollover did not create exactly two target members.';
  end if;
  if (
    select manager_id from public.league_members
    where league_id = 'rollover-fixture-league'
      and season = '2027'
      and manager_name = 'Returning Manager Renamed'
  ) <> (
    select manager_id from public.league_members
    where id = '80000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Returning manager identity was not preserved.';
  end if;
  if (
    select count(*) from public.season_payments
    where league_id = 'rollover-fixture-league' and season = '2027'
      and status = 'pending' and paid_amount_cents = 0
  ) <> 2 then
    raise exception 'Target-season payment reset was not created atomically.';
  end if;
end;
$$;

-- A stale/invalid returning member must roll back source deactivation, target
-- configuration, members, finance rows, and league activation together.
insert into public.leagues (id, name, current_season)
values ('rollover-rollback-league', 'Rollback Fixture', '2026');
insert into public.league_seasons (
  league_id, season, fee_amount, total_weeks, playoff_start_week, playoff_spots, is_active
) values (
  'rollover-rollback-league', '2026', 0, 17, 15, 4, true
);

do $$
begin
  begin
    perform public.rollover_league_season_atomically(
      'rollover-rollback-league',
      '2026',
      '2027',
      '{
        "divisions":[],
        "draft_food_cost":0,
        "fee_amount":0,
        "playoff_spots":4,
        "playoff_start_week":15,
        "prize_structure":{},
        "total_weeks":17.5,
        "weekly_prize_amount":0
      }'::jsonb,
      '[]'::jsonb
    );
    raise exception 'A fractional week count was accepted.';
  exception when invalid_parameter_value then
    null;
  end;

  if exists (
    select 1 from public.league_seasons
    where league_id = 'rollover-rollback-league' and season = '2027'
  ) then
    raise exception 'Invalid numeric configuration left a target season.';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.rollover_league_season_atomically(
      'rollover-rollback-league',
      '2026',
      '2027',
      '{
        "divisions":[],
        "draft_food_cost":0,
        "fee_amount":0,
        "playoff_spots":4,
        "playoff_start_week":15,
        "prize_structure":{},
        "total_weeks":17,
        "weekly_prize_amount":0
      }'::jsonb,
      '[{
        "source_member_id":"80000000-0000-4000-8000-000000000099",
        "manager_name":"Missing Manager",
        "team_name":"Missing Team",
        "division":null
      }]'::jsonb
    );
    raise exception 'Invalid returning member was accepted.';
  exception when sqlstate 'P0002' then
    null;
  end;

  if exists (
    select 1 from public.league_seasons
    where league_id = 'rollover-rollback-league' and season = '2027'
  ) or not exists (
    select 1 from public.league_seasons
    where league_id = 'rollover-rollback-league'
      and season = '2026' and is_active
  ) or (
    select current_season from public.leagues
    where id = 'rollover-rollback-league'
  ) <> '2026' then
    raise exception 'Failed atomic rollover left partial state.';
  end if;
end;
$$;

-- The partial index rejects direct creation of a second active season.
do $$
begin
  begin
    insert into public.league_seasons (
      league_id, season, fee_amount, total_weeks, playoff_start_week, playoff_spots, is_active
    ) values (
      'rollover-rollback-league', '2028', 0, 17, 15, 4, true
    );
    raise exception 'A second direct active season was accepted.';
  exception when unique_violation then
    null;
  end;
end;
$$;

-- A dedicated untouched scope is used by the shell-level concurrent lock test.
insert into public.leagues (id, name, current_season)
values ('rollover-lock-league', 'Lock Fixture', '2026');
insert into public.league_seasons (
  league_id, season, fee_amount, total_weeks, playoff_start_week, playoff_spots, is_active
) values (
  'rollover-lock-league', '2026', 0, 17, 15, 4, true
);

reset role;
