\set ON_ERROR_STOP on

do $$
declare
  checked_role text;
begin
  foreach checked_role in array array['anon', 'authenticated'] loop
    if not has_column_privilege(
      checked_role,
      'public.leagues',
      'archived_at',
      'SELECT'
    ) then
      raise exception '% cannot read public league archive state', checked_role;
    end if;
    if has_function_privilege(
      checked_role,
      'public.set_league_archive_status(text,boolean)',
      'EXECUTE'
    ) or has_function_privilege(
      checked_role,
      'public.set_season_archive_status(text,text,boolean)',
      'EXECUTE'
    ) then
      raise exception '% can change archive state', checked_role;
    end if;
  end loop;
end;
$$;

set role service_role;

do $$
begin
  begin
    perform public.set_season_archive_status(
      'fixture-league',
      '2026',
      true
    );
    raise exception 'active season archive was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

select public.set_season_archive_status('fixture-league', '2025', true);

do $$
begin
  if not exists (
    select 1 from public.league_seasons
    where league_id = 'fixture-league'
      and season = '2025'
      and archived_at is not null
  ) then
    raise exception 'historical season was not archived';
  end if;
  if not exists (
    select 1 from public.weekly_scores
    where league_id = 'fixture-league' and season = '2026'
  ) or not exists (
    select 1 from public.league_members
    where league_id = 'fixture-league' and season = '2025'
  ) then
    raise exception 'season archive deleted historical data';
  end if;
end;
$$;

select public.set_season_archive_status('fixture-league', '2025', false);
update public.leagues
set auto_sync_enabled = true, sync_status = 'active'
where id = 'fixture-league';
select public.set_league_archive_status('fixture-league', true);

do $$
begin
  if not exists (
    select 1 from public.leagues
    where id = 'fixture-league'
      and archived_at is not null
      and not auto_sync_enabled
      and sync_status = 'disabled'
  ) then
    raise exception 'league archive did not disable automation';
  end if;
  if (select count(*) from public.league_seasons where league_id = 'fixture-league') < 2 then
    raise exception 'league archive deleted season history';
  end if;
end;
$$;

select public.set_league_archive_status('fixture-league', false);

do $$
begin
  if (select archived_at from public.leagues where id = 'fixture-league') is not null then
    raise exception 'league restore did not clear archive state';
  end if;
end;
$$;

reset role;
