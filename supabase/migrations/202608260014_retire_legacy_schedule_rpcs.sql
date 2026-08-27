-- Retire unused, destructive/broken deployed-v0 schedule RPCs. Supported
-- matchup writes now occur only through the locked ESPN import boundary;
-- manual score corrections preserve the existing schedule.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

do $$
begin
  if to_regprocedure(
    'public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)'
  ) is null or to_regprocedure(
    'public.mutate_manual_week_atomically(text,text,text,integer,jsonb)'
  ) is null then
    raise exception 'Supported atomic score and matchup boundaries must exist before legacy schedule RPC retirement.';
  end if;

  if to_regprocedure(
    'public.generate_round_robin_schedule(uuid,character varying,integer)'
  ) is null or to_regprocedure(
    'public.insert_season_matchups(uuid,character varying,jsonb)'
  ) is null or to_regprocedure(
    'public.recalculate_matchup_winners(uuid,character varying)'
  ) is null then
    raise exception 'Legacy schedule RPC retirement precondition failed.';
  end if;
end;
$$;

drop function public.generate_round_robin_schedule(uuid, varchar, integer) restrict;
drop function public.insert_season_matchups(uuid, varchar, jsonb) restrict;
drop function public.recalculate_matchup_winners(uuid, varchar) restrict;

commit;
