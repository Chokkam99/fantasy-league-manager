-- Representative synthetic rows only. These IDs do not come from production.

insert into public.leagues (
  id,
  name,
  current_season,
  platform_type,
  platform_league_id,
  auto_sync_enabled,
  sync_status,
  platform_config,
  espn_league_id,
  espn_s2,
  espn_swid
) values (
  'fixture-league',
  'Fixture Friends League',
  '2026',
  'espn',
  '123456',
  false,
  'inactive',
  '{"private_league":true}',
  'legacy-123456',
  'fixture-private-cookie',
  '{FIXTURE-SWID}'
);

insert into public.league_seasons (
  id,
  league_id,
  season,
  fee_amount,
  draft_food_cost,
  weekly_prize_amount,
  total_weeks,
  playoff_start_week,
  playoff_spots,
  prize_structure,
  final_winners,
  is_active
) values (
  '00000000-0000-4000-8000-000000000001',
  'fixture-league',
  '2026',
  50,
  20,
  5,
  17,
  15,
  2,
  '{"first":65}',
  '{"first":"00000000-0000-4000-8000-000000000011"}',
  true
);

insert into public.league_seasons (
  id,
  league_id,
  season,
  fee_amount,
  draft_food_cost,
  weekly_prize_amount,
  total_weeks,
  playoff_start_week,
  playoff_spots,
  prize_structure,
  final_winners,
  is_active
) values (
  '00000000-0000-4000-8000-000000000002',
  'fixture-league',
  '2025',
  40,
  0,
  0,
  17,
  15,
  2,
  '{"first":80}',
  '{"first":"00000000-0000-4000-8000-000000000013"}',
  false
);

insert into public.league_members (
  id,
  league_id,
  manager_name,
  team_name,
  season,
  payment_status,
  is_active
) values
  (
    '00000000-0000-4000-8000-000000000011',
    'fixture-league',
    'Fixture Manager One',
    'Fixture Team One',
    '2026',
    'paid',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    'fixture-league',
    'Fixture Manager Two',
    'Fixture Team Two',
    '2026',
    'pending',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000013',
    'fixture-league',
    'Fixture Manager One',
    'Fixture Team One Old Name',
    '2025',
    'paid',
    false
  );

insert into public.weekly_scores (
  id,
  league_id,
  member_id,
  week_number,
  season,
  points,
  is_final_score,
  week_status
) values
  (
    '00000000-0000-4000-8000-000000000021',
    'fixture-league',
    '00000000-0000-4000-8000-000000000011',
    1,
    '2026',
    121.5,
    true,
    'completed'
  ),
  (
    '00000000-0000-4000-8000-000000000022',
    'fixture-league',
    '00000000-0000-4000-8000-000000000012',
    1,
    '2026',
    117.25,
    true,
    'completed'
  );

insert into public.matchups (
  id,
  league_id,
  season,
  week_number,
  team1_member_id,
  team2_member_id
) values (
  '00000000-0000-4000-8000-000000000031',
  'fixture-league',
  '2026',
  1,
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012'
);

insert into public.payments (
  id,
  league_member_id,
  amount,
  payment_method
) values (
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000011',
  50,
  'cash'
);

insert into public.collections (id, name, type)
values ('00000000-0000-4000-8000-000000000051', 'Fixture Collection', 'general');
