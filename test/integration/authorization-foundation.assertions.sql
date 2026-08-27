\set ON_ERROR_STOP on

do $$
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'authorization migration requires PostgreSQL 15 or newer';
  end if;
end;
$$;

do $$
declare
  fantasy_table text;
begin
  foreach fantasy_table in array array[
    'leagues',
    'league_seasons',
    'league_members',
    'weekly_scores',
    'matchups',
    'payments'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = fantasy_table
        and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', fantasy_table;
    end if;
  end loop;
end;
$$;

do $$
declare
  checked_role text;
begin
  foreach checked_role in array array['anon', 'authenticated'] loop
    if has_table_privilege(checked_role, 'public.leagues', 'INSERT')
      or has_table_privilege(checked_role, 'public.leagues', 'UPDATE')
      or has_table_privilege(checked_role, 'public.leagues', 'DELETE') then
      raise exception '% retains mutation privileges on leagues', checked_role;
    end if;

    if not has_column_privilege(
      checked_role,
      'public.leagues',
      'name',
      'SELECT'
    ) then
      raise exception '% cannot read the safe league name column', checked_role;
    end if;

    if has_column_privilege(
      checked_role,
      'public.leagues',
      'platform_config',
      'SELECT'
    ) or has_column_privilege(
      checked_role,
      'public.leagues',
      'espn_s2',
      'SELECT'
    ) or has_column_privilege(
      checked_role,
      'public.leagues',
      'espn_swid',
      'SELECT'
    ) then
      raise exception '% can still read league credential columns', checked_role;
    end if;

    if has_table_privilege(checked_role, 'public.payments', 'SELECT') then
      raise exception '% can still read payment rows', checked_role;
    end if;

    if not has_table_privilege(
      checked_role,
      'public.weekly_scores',
      'SELECT'
    ) or not has_table_privilege(
      checked_role,
      'public.matchups',
      'SELECT'
    ) then
      raise exception 'shared reads were removed for %', checked_role;
    end if;
  end loop;
end;
$$;

do $$
declare
  policy_count integer;
begin
  select count(*) into policy_count
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'leagues',
      'league_seasons',
      'league_members',
      'weekly_scores',
      'matchups'
    );

  if policy_count <> 5 then
    raise exception 'expected 5 shared read policies, found %', policy_count;
  end if;
end;
$$;

do $$
declare
  checked_role text;
  function_signature text;
begin
  foreach checked_role in array array['anon', 'authenticated'] loop
    foreach function_signature in array array[
      'public.generate_round_robin_schedule(uuid, varchar, integer)',
      'public.get_season_standings(text, text, boolean)',
      'public.get_team_record(uuid, uuid, varchar)',
      'public.insert_season_matchups(uuid, varchar, jsonb)',
      'public.recalculate_matchup_winners(uuid, varchar)',
      'public.set_playoff_week_flag()',
      'public.update_matchup_results()',
      'public.update_matchup_winners()',
      'public.update_updated_at_column()'
    ] loop
      if has_function_privilege(
        checked_role,
        function_signature,
        'EXECUTE'
      ) then
        raise exception '% retains EXECUTE on %', checked_role, function_signature;
      end if;
    end loop;
  end loop;
end;
$$;

do $$
declare
  view_options text[];
begin
  select c.reloptions into view_options
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'matchup_results_with_scores';

  if not ('security_invoker=true' = any(coalesce(view_options, array[]::text[]))) then
    raise exception 'matchup result view is not security_invoker';
  end if;
end;
$$;

do $$
begin
  if not has_table_privilege('anon', 'public.collections', 'INSERT') then
    raise exception 'unrelated collections grants were changed';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('collections', 'items')
      and c.relrowsecurity
  ) then
    raise exception 'unrelated collection tables had RLS enabled';
  end if;
end;
$$;

set role anon;
select id, name, current_season from public.leagues;
select season, fee_amount from public.league_seasons;
select manager_name, team_name from public.league_members;
select week_number, points from public.weekly_scores;
select week_number, team1_member_id, team2_member_id from public.matchups;
select winner_member_id, team1_score, team2_score
from public.matchup_results_with_scores;
reset role;

set role authenticated;
select id, name, current_season from public.leagues;
select week_number, points from public.weekly_scores;
select winner_member_id, team1_score, team2_score
from public.matchup_results_with_scores;
reset role;

set role service_role;
update public.leagues
set updated_at = '2000-01-01 00:00:00+00', name = 'Fixture Friends League Updated'
where id = 'fixture-league';

update public.leagues
set name = 'Fixture Friends League Trigger Checked'
where id = 'fixture-league';

do $$
declare
  changed_at timestamptz;
begin
  select updated_at into changed_at
  from public.leagues
  where id = 'fixture-league';

  if changed_at <= '2000-01-01 00:00:00+00'::timestamptz then
    raise exception 'updated_at trigger did not execute after EXECUTE revocation';
  end if;
end;
$$;

insert into public.league_members (
  league_id,
  manager_name,
  team_name,
  season,
  is_active
) values (
  'fixture-league',
  'Privileged Fixture Manager',
  'Privileged Fixture Team',
  '2026',
  true
);

delete from public.league_members
where manager_name = 'Privileged Fixture Manager';
reset role;
