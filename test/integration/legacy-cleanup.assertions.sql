\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1
    from public.weekly_scores
    where league_id = 'cleanup-fixture-league'
      and season is null
  ) then
    raise exception 'Null-season duplicate cleanup left a fixture candidate.';
  end if;

  if (
    select count(*)
    from public.weekly_scores
    where league_id = 'cleanup-fixture-league'
      and season = '2025'
      and week_number = 1
  ) <> 10 then
    raise exception 'Null-season duplicate cleanup changed canonical scores.';
  end if;

  if (
    select count(*)
    from public.weekly_scores
    where league_id = 'cleanup-fixture-league'
      and season = '2022'
      and week_status = 'completed'
      and is_final_score
  ) <> 24 then
    raise exception 'Lifecycle cleanup did not normalize exactly 24 fixture rows.';
  end if;

  if exists (
    select 1
    from public.league_seasons
    where league_id = 'cleanup-fixture-league'
      and is_active is distinct from (season = '2025')
  ) then
    raise exception 'Active-season cleanup left a fixture mismatch.';
  end if;

  if (
    select count(*)
    from public.league_seasons
    where league_id = 'cleanup-fixture-league'
      and not is_active
  ) <> 6 then
    raise exception 'Active-season cleanup did not normalize six historical rows.';
  end if;
end;
$$;
