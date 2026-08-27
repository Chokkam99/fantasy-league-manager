-- Target-contract assertions for a brand-new, data-free installation after
-- the fantasy-only deployed-v0 bootstrap plus migrations 001 through 014.

do $$
declare
  checked_table text;
  has_rows boolean;
  fantasy_tables text[] := array[
    'leagues',
    'league_seasons',
    'league_members',
    'weekly_scores',
    'matchups',
    'payments',
    'import_runs',
    'managers',
    'season_payments',
    'prize_awards',
    'prize_payouts',
    'league_share_links'
  ];
begin
  foreach checked_table in array fantasy_tables loop
    if to_regclass(format('public.%I', checked_table)) is null then
      raise exception 'Fresh schema is missing public.%', checked_table;
    end if;

    execute format(
      'select exists (select 1 from public.%I limit 1)',
      checked_table
    ) into has_rows;
    if has_rows then
      raise exception 'Fresh schema unexpectedly contains rows in public.%', checked_table;
    end if;
  end loop;

  if to_regclass('public.collections') is not null
      or to_regclass('public.items') is not null then
    raise exception 'Fresh fantasy bootstrap created unrelated public tables.';
  end if;
end;
$$;

do $$
declare
  checked_table text;
begin
  foreach checked_table in array array[
    'leagues',
    'league_seasons',
    'league_members',
    'weekly_scores',
    'matchups',
    'payments',
    'import_runs',
    'managers',
    'season_payments',
    'prize_awards',
    'prize_payouts',
    'league_share_links'
  ] loop
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = checked_table
        and relation.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', checked_table;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leagues'
      and column_name = 'archived_at'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'league_seasons'
      and column_name = 'archived_at'
  ) then
    raise exception 'Fresh schema is missing lifecycle columns.';
  end if;

  if to_regprocedure('public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)') is null
      or to_regprocedure('public.set_season_payment_details(text,text,uuid,text,integer,text,text)') is null
      or to_regprocedure('public.set_league_archive_status(text,boolean)') is null
      or to_regprocedure('public.set_season_archive_status(text,text,boolean)') is null
      or to_regprocedure('public.rotate_league_share_link(text,text,text,text)') is null
      or to_regprocedure('public.revoke_league_share_link(text,text)') is null
      or to_regprocedure('public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)') is null
      or to_regprocedure('public.mutate_manual_week_atomically(text,text,text,integer,jsonb)') is null then
    raise exception 'Fresh schema is missing a restricted application RPC.';
  end if;

  if has_function_privilege(
    'anon',
    'public.set_league_archive_status(text,boolean)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.set_league_archive_status(text,boolean)',
    'execute'
  ) then
    raise exception 'Shared role can execute lifecycle mutation RPC.';
  end if;

  if to_regprocedure(
    'public.generate_round_robin_schedule(uuid,character varying,integer)'
  ) is not null or to_regprocedure(
    'public.insert_season_matchups(uuid,character varying,jsonb)'
  ) is not null or to_regprocedure(
    'public.recalculate_matchup_winners(uuid,character varying)'
  ) is not null then
    raise exception 'Fresh schema retained a retired legacy schedule RPC.';
  end if;

  if has_column_privilege('anon', 'public.leagues', 'espn_s2', 'select')
      or has_column_privilege('authenticated', 'public.leagues', 'platform_config', 'select') then
    raise exception 'Fresh schema exposes private ESPN configuration.';
  end if;
end;
$$;

-- A new install has no lifecycle ambiguity: current_season is authoritative,
-- while is_active remains a compatibility field for current import queries.
insert into public.leagues (id, name, current_season)
values ('fresh-fixture-league', 'Fresh Fixture League', '2026');

insert into public.league_seasons (
  league_id,
  season,
  is_active,
  total_weeks,
  playoff_start_week,
  playoff_spots
)
values ('fresh-fixture-league', '2026', true, 17, 15, 6);

do $$
begin
  if (
    select count(*)
    from public.league_seasons season_config
    join public.leagues league on league.id = season_config.league_id
    where season_config.league_id = 'fresh-fixture-league'
      and season_config.season = league.current_season
      and season_config.is_active
      and season_config.archived_at is null
  ) <> 1 then
    raise exception 'Fresh season lifecycle contract is not coherent.';
  end if;
end;
$$;

delete from public.leagues where id = 'fresh-fixture-league';
