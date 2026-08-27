\set ON_ERROR_STOP on

do $$
declare
  checked_role text;
  checked_relation text;
begin
  if to_regclass('public.league_share_links') is null then
    raise exception 'Scoped sharing table is missing.';
  end if;

  foreach checked_role in array array['anon', 'authenticated'] loop
    foreach checked_relation in array array[
      'leagues',
      'league_seasons',
      'league_members',
      'weekly_scores',
      'matchups',
      'managers',
      'prize_awards',
      'prize_payouts',
      'league_share_links',
      'matchup_results_with_scores'
    ] loop
      if has_table_privilege(checked_role, 'public.' || checked_relation, 'select') then
        raise exception '% retains direct SELECT on public.%', checked_role, checked_relation;
      end if;
    end loop;

    if has_function_privilege(
      checked_role,
      'public.rotate_league_share_link(text,text,text,text)',
      'execute'
    ) or has_function_privilege(
      checked_role,
      'public.revoke_league_share_link(text,text)',
      'execute'
    ) then
      raise exception '% can manage player links', checked_role;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.league_share_links', 'select')
      or not has_function_privilege(
        'service_role',
        'public.rotate_league_share_link(text,text,text,text)',
        'execute'
      ) then
    raise exception 'service_role cannot manage scoped player links';
  end if;
end;
$$;

insert into public.leagues (id, name, current_season)
values ('fixture-league', 'Scoped Sharing Fixture', '2026')
on conflict (id) do nothing;

insert into public.league_seasons (
  league_id,
  season,
  is_active,
  total_weeks,
  playoff_start_week,
  playoff_spots
)
values ('fixture-league', '2026', true, 17, 15, 6)
on conflict (league_id, season) do nothing;

set role service_role;

select public.rotate_league_share_link(
  'fixture-league',
  '2026',
  repeat('a', 64),
  'aaaaaaaa'
);

do $$
begin
  if (
    select count(*)
    from public.league_share_links
    where league_id = 'fixture-league'
      and season = '2026'
      and revoked_at is null
  ) <> 1 then
    raise exception 'Expected one active scoped player link.';
  end if;
end;
$$;

select public.rotate_league_share_link(
  'fixture-league',
  '2026',
  repeat('b', 64),
  'bbbbbbbb'
);

do $$
begin
  if (
    select count(*)
    from public.league_share_links
    where league_id = 'fixture-league'
      and season = '2026'
  ) <> 2 or (
    select count(*)
    from public.league_share_links
    where league_id = 'fixture-league'
      and season = '2026'
      and revoked_at is null
      and token_digest = repeat('b', 64)
  ) <> 1 then
    raise exception 'Rotation did not preserve history and replace the active link.';
  end if;
end;
$$;

select public.revoke_league_share_link('fixture-league', '2026');

do $$
begin
  if exists (
    select 1
    from public.league_share_links
    where league_id = 'fixture-league'
      and season = '2026'
      and revoked_at is null
  ) then
    raise exception 'Revocation left an active player link.';
  end if;
end;
$$;

reset role;
