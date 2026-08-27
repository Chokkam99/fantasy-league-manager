-- Make the compatibility is_active field agree with leagues.current_season.
-- Archive state and league_members.is_active participation are not changed.
--
-- REMOTE GATES:
-- 1. Confirm six historical active rows, two active current rows, and no missing
--    current configuration.
-- 2. Export league_id, season, and is_active for all eight configurations.
-- 3. Apply during a quiet season-settings window.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

lock table public.leagues in share row exclusive mode;
lock table public.league_seasons in share row exclusive mode;

do $$
declare
  current_invalid_count integer;
  historical_candidate_count integer;
  historical_non_boolean_count integer;
  missing_current_count integer;
  updated_count integer;
begin
  select count(*)
  into missing_current_count
  from public.leagues league
  where league.current_season is null
     or not exists (
       select 1
       from public.league_seasons season_config
       where season_config.league_id = league.id
         and season_config.season = league.current_season
     );

  select count(*)
  into current_invalid_count
  from public.league_seasons season_config
  join public.leagues league on league.id = season_config.league_id
  where season_config.season = league.current_season
    and season_config.is_active is distinct from true;

  select count(*)
  into historical_candidate_count
  from public.league_seasons season_config
  join public.leagues league on league.id = season_config.league_id
  where season_config.season <> league.current_season
    and season_config.is_active is true;

  select count(*)
  into historical_non_boolean_count
  from public.league_seasons season_config
  join public.leagues league on league.id = season_config.league_id
  where season_config.season <> league.current_season
    and season_config.is_active is distinct from false
    and season_config.is_active is not true;

  if missing_current_count <> 0
      or current_invalid_count <> 0
      or historical_non_boolean_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Active-season cleanup aborted: missing current %, invalid current %, ambiguous historical %.',
        missing_current_count,
        current_invalid_count,
        historical_non_boolean_count
      );
  end if;

  if historical_candidate_count not in (0, 6) then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Active-season cleanup aborted: expected exactly 0 or the audited 6 historical candidates, found %.',
        historical_candidate_count
      );
  end if;

  update public.league_seasons season_config
  set is_active = false
  from public.leagues league
  where league.id = season_config.league_id
    and season_config.season <> league.current_season
    and season_config.is_active is true;

  get diagnostics updated_count = row_count;
  if updated_count <> historical_candidate_count then
    raise exception 'Active-season cleanup updated %, expected %.', updated_count, historical_candidate_count;
  end if;

  if exists (
    select 1
    from public.league_seasons season_config
    join public.leagues league on league.id = season_config.league_id
    where season_config.is_active is distinct from
      (season_config.season = league.current_season)
  ) then
    raise exception 'Active-season cleanup left an activation mismatch.';
  end if;
end;
$$;

commit;
