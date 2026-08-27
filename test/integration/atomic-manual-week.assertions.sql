\set ON_ERROR_STOP on

do $$
begin
  if to_regprocedure(
    'public.mutate_manual_week_atomically(text,text,text,integer,jsonb)'
  ) is null then
    raise exception 'Atomic manual-week function is missing.';
  end if;
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'derive_weekly_score_playoff_flag'
      and not tgisinternal
  ) then
    raise exception 'Playoff-flag derivation trigger is missing.';
  end if;
  if has_function_privilege(
    'anon',
    'public.mutate_manual_week_atomically(text,text,text,integer,jsonb)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.mutate_manual_week_atomically(text,text,text,integer,jsonb)',
    'execute'
  ) then
    raise exception 'A shared role can execute atomic manual score writes.';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.mutate_manual_week_atomically(text,text,text,integer,jsonb)',
    'execute'
  ) then
    raise exception 'service_role cannot execute atomic manual score writes.';
  end if;
end;
$$;

insert into public.leagues (id, name, current_season)
values ('manual-week-fixture', 'Manual Week Fixture', '2026');

insert into public.league_seasons (
  league_id,
  season,
  fee_amount,
  total_weeks,
  playoff_start_week,
  playoff_spots,
  is_active
) values (
  'manual-week-fixture',
  '2026',
  0,
  17,
  15,
  4,
  true
);

insert into public.league_members (
  id,
  league_id,
  manager_name,
  team_name,
  season,
  is_active,
  payment_status
) values
  ('90000000-0000-4000-8000-000000000001', 'manual-week-fixture', 'Manager 1', 'Team 1', '2026', true, 'pending'),
  ('90000000-0000-4000-8000-000000000002', 'manual-week-fixture', 'Manager 2', 'Team 2', '2026', true, 'pending'),
  ('90000000-0000-4000-8000-000000000003', 'manual-week-fixture', 'Manager 3', 'Team 3', '2026', true, 'pending'),
  ('90000000-0000-4000-8000-000000000004', 'manual-week-fixture', 'Manager 4', 'Team 4', '2026', true, 'pending'),
  ('90000000-0000-4000-8000-000000000005', 'manual-week-fixture', 'Former Manager', 'Former Team', '2026', false, 'pending');

insert into public.matchups (
  league_id,
  season,
  week_number,
  team1_member_id,
  team2_member_id,
  scores_locked
) values
  ('manual-week-fixture', '2026', 14, '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', false),
  ('manual-week-fixture', '2026', 14, '90000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000004', false),
  ('manual-week-fixture', '2026', 15, '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003', false),
  ('manual-week-fixture', '2026', 15, '90000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000004', false),
  ('manual-week-fixture', '2026', 16, '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', false),
  ('manual-week-fixture', '2026', 16, '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003', false);

-- This stale inactive-player score must disappear when Week 14 is replaced.
insert into public.weekly_scores (
  league_id,
  season,
  week_number,
  member_id,
  points,
  is_final_score,
  is_playoff_week,
  week_status
) values (
  'manual-week-fixture',
  '2026',
  14,
  '90000000-0000-4000-8000-000000000005',
  1,
  true,
  true,
  'completed'
);

set role service_role;

do $$
declare
  result jsonb;
begin
  select public.mutate_manual_week_atomically(
    'save_week',
    'manual-week-fixture',
    '2026',
    14,
    '[
      {"member_id":"90000000-0000-4000-8000-000000000001","points":101.25},
      {"member_id":"90000000-0000-4000-8000-000000000002","points":99},
      {"member_id":"90000000-0000-4000-8000-000000000003","points":88.5},
      {"member_id":"90000000-0000-4000-8000-000000000004","points":77}
    ]'::jsonb
  ) into result;

  if result->>'action' <> 'save_week'
      or (result->>'score_count')::integer <> 4
      or (result->>'matchup_count')::integer <> 2 then
    raise exception 'Week 14 save returned an invalid result: %', result;
  end if;
end;
$$;

do $$
begin
  if (
    select count(*)
    from public.weekly_scores
    where league_id = 'manual-week-fixture' and season = '2026' and week_number = 14
  ) <> 4 or exists (
    select 1
    from public.weekly_scores
    where league_id = 'manual-week-fixture'
      and season = '2026'
      and week_number = 14
      and (not is_final_score or week_status <> 'completed' or is_playoff_week)
  ) or exists (
    select 1
    from public.weekly_scores
    where league_id = 'manual-week-fixture'
      and season = '2026'
      and week_number = 14
      and member_id = '90000000-0000-4000-8000-000000000005'
  ) then
    raise exception 'Exact regular-season score replacement failed.';
  end if;

  if (
    select count(*)
    from public.matchups
    where league_id = 'manual-week-fixture'
      and season = '2026'
      and week_number = 14
      and scores_locked
      and week_completed_at is not null
  ) <> 2 then
    raise exception 'Week 14 matchups were not completed with the scores.';
  end if;
end;
$$;

do $$
begin
  perform public.mutate_manual_week_atomically(
    'save_week',
    'manual-week-fixture',
    '2026',
    15,
    '[
      {"member_id":"90000000-0000-4000-8000-000000000001","points":115},
      {"member_id":"90000000-0000-4000-8000-000000000002","points":105},
      {"member_id":"90000000-0000-4000-8000-000000000003","points":95},
      {"member_id":"90000000-0000-4000-8000-000000000004","points":85}
    ]'::jsonb
  );

  if (
    select count(*)
    from public.weekly_scores
    where league_id = 'manual-week-fixture'
      and season = '2026'
      and week_number = 15
      and is_playoff_week
  ) <> 4 then
    raise exception 'Playoff-week scores were not derived from configuration.';
  end if;

  begin
    perform public.mutate_manual_week_atomically(
      'save_week',
      'manual-week-fixture',
      '2026',
      15,
      '[{"member_id":"90000000-0000-4000-8000-000000000001","points":1}]'::jsonb
    );
    raise exception 'A partial score set was accepted.';
  exception when check_violation then
    null;
  end;

  if (
    select points
    from public.weekly_scores
    where league_id = 'manual-week-fixture'
      and season = '2026'
      and week_number = 15
      and member_id = '90000000-0000-4000-8000-000000000001'
  ) <> 115 then
    raise exception 'Rejected Week 15 replacement changed committed scores.';
  end if;
end;
$$;

-- The current table shape cannot globally prevent cross-slot double booking,
-- so the supported manual completion boundary rejects such a schedule.
do $$
begin
  begin
    perform public.mutate_manual_week_atomically(
      'save_week',
      'manual-week-fixture',
      '2026',
      16,
      '[
        {"member_id":"90000000-0000-4000-8000-000000000001","points":10},
        {"member_id":"90000000-0000-4000-8000-000000000002","points":20},
        {"member_id":"90000000-0000-4000-8000-000000000003","points":30},
        {"member_id":"90000000-0000-4000-8000-000000000004","points":40}
      ]'::jsonb
    );
    raise exception 'A double-booked matchup week was completed.';
  exception when check_violation then
    null;
  end;

  if exists (
    select 1 from public.weekly_scores
    where league_id = 'manual-week-fixture' and season = '2026' and week_number = 16
  ) or exists (
    select 1 from public.matchups
    where league_id = 'manual-week-fixture'
      and season = '2026'
      and week_number = 16
      and (scores_locked or week_completed_at is not null)
  ) then
    raise exception 'Rejected double-booked week left partial state.';
  end if;
end;
$$;

do $$
begin
  perform public.mutate_manual_week_atomically(
    'clear_week',
    'manual-week-fixture',
    '2026',
    14,
    '[]'::jsonb
  );

  if exists (
    select 1 from public.weekly_scores
    where league_id = 'manual-week-fixture' and season = '2026' and week_number = 14
  ) or (
    select count(*)
    from public.matchups
    where league_id = 'manual-week-fixture'
      and season = '2026'
      and week_number = 14
      and not scores_locked
      and week_completed_at is null
  ) <> 2 then
    raise exception 'Atomic week clear did not preserve and reopen the schedule.';
  end if;

  perform public.mutate_manual_week_atomically(
    'clear_season',
    'manual-week-fixture',
    '2026',
    null,
    '[]'::jsonb
  );

  if exists (
    select 1 from public.weekly_scores
    where league_id = 'manual-week-fixture' and season = '2026'
  ) or exists (
    select 1 from public.matchups
    where league_id = 'manual-week-fixture'
      and season = '2026'
      and (scores_locked or week_completed_at is not null)
  ) then
    raise exception 'Atomic season clear left scores or completed matchups.';
  end if;
end;
$$;

-- The trigger corrects a direct caller that supplies the wrong playoff flag.
insert into public.weekly_scores (
  league_id,
  season,
  week_number,
  member_id,
  points,
  is_final_score,
  is_playoff_week,
  week_status
) values (
  'manual-week-fixture',
  '2026',
  17,
  '90000000-0000-4000-8000-000000000001',
  10,
  true,
  false,
  'completed'
);

do $$
begin
  if not exists (
    select 1
    from public.weekly_scores
    where league_id = 'manual-week-fixture'
      and season = '2026'
      and week_number = 17
      and is_playoff_week
  ) then
    raise exception 'Direct score insert bypassed playoff derivation.';
  end if;
end;
$$;

-- An untouched scope supports the shell-level lock-contention assertion.
insert into public.leagues (id, name, current_season)
values ('manual-week-lock-fixture', 'Manual Lock Fixture', '2026');
insert into public.league_seasons (
  league_id, season, fee_amount, total_weeks, playoff_start_week, playoff_spots, is_active
) values (
  'manual-week-lock-fixture', '2026', 0, 17, 15, 4, true
);

reset role;
