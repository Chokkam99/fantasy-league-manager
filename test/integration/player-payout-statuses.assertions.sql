\set ON_ERROR_STOP on

do $$
declare
  checked_role text;
begin
  if to_regclass('public.player_payout_statuses') is null then
    raise exception 'Player payout status table is missing.';
  end if;
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.player_payout_statuses'::regclass
  ) then
    raise exception 'Player payout statuses do not have RLS enabled.';
  end if;

  foreach checked_role in array array['anon', 'authenticated'] loop
    if has_table_privilege(
      checked_role,
      'public.player_payout_statuses',
      'select'
    ) or has_function_privilege(
      checked_role,
      'public.set_player_payout_status(text,text,uuid,text)',
      'execute'
    ) then
      raise exception '% can access player payout tracking', checked_role;
    end if;
  end loop;

  if not has_table_privilege(
    'service_role',
    'public.player_payout_statuses',
    'select'
  ) or not has_function_privilege(
    'service_role',
    'public.set_player_payout_status(text,text,uuid,text)',
    'execute'
  ) then
    raise exception 'service_role cannot manage player payout tracking';
  end if;
end;
$$;

insert into public.managers (
  id,
  league_id,
  display_name,
  identity_key
) values (
  '00000000-0000-4000-8000-000000000151',
  'fixture-league',
  'Payout Fixture',
  'payout fixture'
)
on conflict (id) do nothing;

insert into public.league_members (
  id,
  league_id,
  season,
  manager_id,
  manager_name,
  team_name,
  payment_status,
  is_active
) values (
  '00000000-0000-4000-8000-000000000152',
  'fixture-league',
  '2026',
  '00000000-0000-4000-8000-000000000151',
  'Payout Fixture',
  'Payout Team',
  'paid',
  true
)
on conflict (id) do nothing;

set role service_role;

select public.set_player_payout_status(
  'fixture-league',
  '2026',
  '00000000-0000-4000-8000-000000000152',
  'paid'
);

do $$
begin
  if (
    select count(*)
    from public.player_payout_statuses
    where league_id = 'fixture-league'
      and season = '2026'
      and league_member_id = '00000000-0000-4000-8000-000000000152'
      and status = 'paid'
      and paid_at is not null
  ) <> 1 then
    raise exception 'Player payout was not marked paid.';
  end if;
end;
$$;

insert into public.weekly_scores (
  league_id,
  member_id,
  season,
  week_number,
  points,
  is_final_score,
  week_status
) values (
  'fixture-league',
  '00000000-0000-4000-8000-000000000152',
  '2026',
  1,
  100,
  true,
  'completed'
)
on conflict (league_id, season, week_number, member_id) do update
set points = excluded.points;

do $$
begin
  if (
    select status
    from public.player_payout_statuses
    where league_id = 'fixture-league'
      and season = '2026'
      and league_member_id = '00000000-0000-4000-8000-000000000152'
  ) <> 'pending' then
    raise exception 'A score change did not reopen the player payout.';
  end if;
end;
$$;

reset role;
