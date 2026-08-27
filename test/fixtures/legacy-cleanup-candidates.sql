-- Synthetic replicas of the audited aggregate cleanup shapes. No IDs, names,
-- values, or credentials in this file come from production.

insert into public.leagues (id, name, current_season)
values ('cleanup-fixture-league', 'Cleanup Fixture League', '2025');

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
  is_active
)
select
  ('01000000-0000-4000-8000-' || lpad(season_year::text, 12, '0'))::uuid,
  'cleanup-fixture-league',
  season_year::text,
  0,
  0,
  0,
  17,
  15,
  4,
  '{}'::jsonb,
  true
from generate_series(2019, 2025) season_year;

insert into public.league_members (
  id,
  league_id,
  manager_name,
  team_name,
  season,
  payment_status,
  is_active
)
select
  ('10000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid,
  'cleanup-fixture-league',
  'Current Manager ' || member_number,
  'Current Team ' || member_number,
  '2025',
  'pending',
  true
from generate_series(1, 10) member_number;

insert into public.league_members (
  id,
  league_id,
  manager_name,
  team_name,
  season,
  payment_status,
  is_active
)
select
  ('20000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid,
  'cleanup-fixture-league',
  'Historical Manager ' || member_number,
  'Historical Team ' || member_number,
  '2022',
  'paid',
  true
from generate_series(1, 12) member_number;

-- Ten canonical 2025 Week 1 scores plus ten exact null-season duplicates.
insert into public.weekly_scores (
  id,
  league_id,
  member_id,
  week_number,
  season,
  points,
  is_final_score,
  is_playoff_week,
  week_status
)
select
  ('30000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid,
  'cleanup-fixture-league',
  ('10000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid,
  1,
  '2025',
  100 + member_number,
  true,
  false,
  'completed'
from generate_series(1, 10) member_number;

insert into public.weekly_scores (
  id,
  league_id,
  member_id,
  week_number,
  season,
  points,
  is_final_score,
  is_playoff_week,
  week_status
)
select
  ('40000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid,
  'cleanup-fixture-league',
  ('10000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid,
  1,
  null,
  100 + member_number,
  true,
  false,
  'completed'
from generate_series(1, 10) member_number;

-- Twenty-four 2022 completed/not-final scores: 12 each in Weeks 15 and 17.
insert into public.weekly_scores (
  id,
  league_id,
  member_id,
  week_number,
  season,
  points,
  is_final_score,
  is_playoff_week,
  week_status
)
select
  (
    case when week_number = 15 then '50000000' else '60000000' end
    || '-0000-4000-8000-'
    || lpad(member_number::text, 12, '0')
  )::uuid,
  'cleanup-fixture-league',
  ('20000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid,
  week_number,
  '2022',
  80 + member_number + week_number::numeric / 100,
  false,
  true,
  'completed'
from generate_series(1, 12) member_number
cross join (values (15), (17)) weeks(week_number);
