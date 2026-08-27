\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

set role service_role;
select public.import_espn_week_atomically(
  'fixture-league',
  '2026',
  4,
  '[
    {"member_id":"00000000-0000-4000-8000-000000000011","points":100},
    {"member_id":"00000000-0000-4000-8000-000000000012","points":101}
  ]'::jsonb,
  '[
    {
      "team1_member_id":"00000000-0000-4000-8000-000000000011",
      "team2_member_id":"00000000-0000-4000-8000-000000000012"
    }
  ]'::jsonb,
  'scheduled'
);
reset role;
