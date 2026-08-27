\set ON_ERROR_STOP on

set role service_role;

do $$
begin
  begin
    perform public.rollover_league_season_atomically(
      'rollover-lock-league',
      '2026',
      '2027',
      '{
        "divisions":[],
        "draft_food_cost":0,
        "fee_amount":0,
        "playoff_spots":4,
        "playoff_start_week":15,
        "prize_structure":{},
        "total_weeks":17,
        "weekly_prize_amount":0
      }'::jsonb,
      '[]'::jsonb
    );
    raise exception 'Concurrent rollover unexpectedly succeeded.';
  exception when lock_not_available then
    null;
  end;
end;
$$;

select 'ROLLOVER_LOCKED';

reset role;
