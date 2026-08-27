\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'import_runs'
      and c.relrowsecurity
  ) then
    raise exception 'import_runs must have RLS enabled';
  end if;

  if has_table_privilege('anon', 'public.import_runs', 'SELECT')
    or has_table_privilege('authenticated', 'public.import_runs', 'SELECT') then
    raise exception 'shared roles can read private import history';
  end if;

  if has_function_privilege(
    'anon',
    'public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'shared roles can execute atomic imports';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute atomic imports';
  end if;
end;
$$;

set role service_role;

do $$
declare
  result jsonb;
begin
  select public.import_espn_week_atomically(
    'fixture-league',
    '2026',
    2,
    '[
      {"member_id":"00000000-0000-4000-8000-000000000011","points":110.5},
      {"member_id":"00000000-0000-4000-8000-000000000012","points":108.25}
    ]'::jsonb,
    '[
      {
        "team1_member_id":"00000000-0000-4000-8000-000000000011",
        "team2_member_id":"00000000-0000-4000-8000-000000000012"
      }
    ]'::jsonb,
    'manual'
  ) into result;

  if not coalesce((result->>'success')::boolean, false) then
    raise exception 'valid atomic import failed: %', result;
  end if;
  if (result->>'score_count')::integer <> 2
    or (result->>'matchup_count')::integer <> 1 then
    raise exception 'atomic import returned incorrect counts: %', result;
  end if;
end;
$$;

do $$
begin
  if (select count(*) from public.weekly_scores
      where league_id = 'fixture-league' and season = '2026' and week_number = 2) <> 2 then
    raise exception 'atomic import did not write exactly two scores';
  end if;
  if (select count(*) from public.matchups
      where league_id = 'fixture-league' and season = '2026' and week_number = 2) <> 1 then
    raise exception 'atomic import did not write exactly one matchup';
  end if;
  if (select count(*) from public.import_runs
      where league_id = 'fixture-league' and season = '2026'
        and week_number = 2 and status = 'succeeded') <> 1 then
    raise exception 'successful import run was not recorded';
  end if;
end;
$$;

-- Re-import the same week with a correction and reversed matchup order. The
-- final week remains exact rather than accumulating duplicate rows.
do $$
declare
  result jsonb;
begin
  select public.import_espn_week_atomically(
    'fixture-league',
    '2026',
    2,
    '[
      {"member_id":"00000000-0000-4000-8000-000000000011","points":111.75},
      {"member_id":"00000000-0000-4000-8000-000000000012","points":108.25}
    ]'::jsonb,
    '[
      {
        "team1_member_id":"00000000-0000-4000-8000-000000000012",
        "team2_member_id":"00000000-0000-4000-8000-000000000011"
      }
    ]'::jsonb,
    'scheduled_correction'
  ) into result;

  if not coalesce((result->>'success')::boolean, false) then
    raise exception 'idempotent correction failed: %', result;
  end if;
end;
$$;

do $$
begin
  if (select count(*) from public.weekly_scores
      where league_id = 'fixture-league' and season = '2026' and week_number = 2) <> 2 then
    raise exception 'idempotent correction duplicated scores';
  end if;
  if (select count(*) from public.matchups
      where league_id = 'fixture-league' and season = '2026' and week_number = 2) <> 1 then
    raise exception 'idempotent correction duplicated matchups';
  end if;
  if (select points from public.weekly_scores
      where member_id = '00000000-0000-4000-8000-000000000011'
        and season = '2026' and week_number = 2) <> 111.75 then
    raise exception 'corrected score was not persisted';
  end if;
  if (select count(*) from public.import_runs
      where league_id = 'fixture-league' and season = '2026'
        and week_number = 2 and status = 'succeeded') <> 2 then
    raise exception 'both idempotent import runs were not recorded';
  end if;
  if (select count(*) from public.import_runs
      where league_id = 'fixture-league' and season = '2026'
        and week_number = 2 and trigger_mode = 'scheduled_correction'
        and status = 'succeeded') <> 1 then
    raise exception 'scheduled correction run was not labeled';
  end if;
end;
$$;

-- A partial payload must leave the week untouched while retaining a failed run.
do $$
declare
  result jsonb;
begin
  select public.import_espn_week_atomically(
    'fixture-league',
    '2026',
    3,
    '[
      {"member_id":"00000000-0000-4000-8000-000000000011","points":99.5}
    ]'::jsonb,
    '[]'::jsonb,
    'manual'
  ) into result;

  if coalesce((result->>'success')::boolean, false)
    or result->>'code' <> 'IMPORT_FAILED' then
    raise exception 'invalid payload did not fail safely: %', result;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.weekly_scores
    where league_id = 'fixture-league' and season = '2026' and week_number = 3
  ) or exists (
    select 1 from public.matchups
    where league_id = 'fixture-league' and season = '2026' and week_number = 3
  ) then
    raise exception 'failed import left partial week data';
  end if;
  if (select count(*) from public.import_runs
      where league_id = 'fixture-league' and season = '2026'
        and week_number = 3 and status = 'failed'
        and completed_at is not null and error_message is not null) <> 1 then
    raise exception 'failed import run was not recorded';
  end if;
end;
$$;

reset role;
