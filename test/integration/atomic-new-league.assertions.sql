begin;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.create_league_atomically(text,text,text,jsonb,jsonb,jsonb)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.create_league_atomically(text,text,text,jsonb,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'Public roles must not execute atomic league creation.';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.create_league_atomically(text,text,text,jsonb,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'Service role must execute atomic league creation.';
  end if;
end;
$$;

set local role service_role;

select public.create_league_atomically(
  'new-friends-league',
  'New Friends League',
  '2026',
  '{
    "divisions": ["East", "West"],
    "draft_food_cost": 20,
    "fee_amount": 100,
    "playoff_spots": 2,
    "playoff_start_week": 15,
    "prize_structure": {"first": 150, "second": 30},
    "total_weeks": 17,
    "weekly_prize_amount": 0
  }'::jsonb,
  '[
    {"division":"East","espn_team_id":1,"manager_name":"Alex","team_name":"Sunday Stars"},
    {"division":"West","espn_team_id":2,"manager_name":"Blake","team_name":"Desert Owls"}
  ]'::jsonb,
  '{
    "auto_sync_enabled": false,
    "league_id": "123456",
    "private_league": false
  }'::jsonb
);

reset role;

do $$
declare
  config jsonb;
begin
  if (select count(*) from public.leagues where id = 'new-friends-league') <> 1 then
    raise exception 'Atomic creation did not create exactly one league.';
  end if;
  if (select count(*) from public.league_seasons where league_id = 'new-friends-league' and season = '2026') <> 1 then
    raise exception 'Atomic creation did not create the first season.';
  end if;
  if (select count(*) from public.league_members where league_id = 'new-friends-league' and season = '2026') <> 2 then
    raise exception 'Atomic creation did not create the roster.';
  end if;
  if (select count(*) from public.managers where league_id = 'new-friends-league') <> 2 then
    raise exception 'Atomic creation did not link stable manager identities.';
  end if;
  if (select count(*) from public.season_payments where league_id = 'new-friends-league' and season = '2026') <> 2 then
    raise exception 'Atomic creation did not initialize season payments.';
  end if;

  select platform_config into config
  from public.leagues
  where id = 'new-friends-league';
  if config#>>'{team_mappings,2026,1}' is null
    or config#>>'{team_mappings,2026,2}' is null then
    raise exception 'Atomic creation did not save current-season ESPN mappings.';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.create_league_atomically(
      'invalid-odd-league',
      'Invalid Odd League',
      '2026',
      '{"divisions":[],"draft_food_cost":0,"fee_amount":0,"playoff_spots":2,"playoff_start_week":15,"prize_structure":{},"total_weeks":17,"weekly_prize_amount":0}'::jsonb,
      '[{"division":null,"espn_team_id":null,"manager_name":"Only","team_name":"Only Team"}]'::jsonb,
      null
    );
    raise exception 'Odd roster unexpectedly succeeded.';
  exception
    when sqlstate '22023' then null;
  end;

  if exists (select 1 from public.leagues where id = 'invalid-odd-league') then
    raise exception 'Failed atomic creation left a partial league.';
  end if;
end;
$$;

rollback;
