\set ON_ERROR_STOP on

do $$
begin
  if to_regprocedure(
    'public.generate_round_robin_schedule(uuid,character varying,integer)'
  ) is not null or to_regprocedure(
    'public.insert_season_matchups(uuid,character varying,jsonb)'
  ) is not null or to_regprocedure(
    'public.recalculate_matchup_winners(uuid,character varying)'
  ) is not null then
    raise exception 'A retired legacy schedule RPC still exists.';
  end if;

  if to_regprocedure(
    'public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)'
  ) is null or to_regprocedure(
    'public.mutate_manual_week_atomically(text,text,text,integer,jsonb)'
  ) is null then
    raise exception 'A supported atomic score/matchup boundary was removed.';
  end if;

  if to_regclass('public.matchups') is null
      or to_regclass('public.weekly_scores') is null
      or to_regclass('public.matchup_results_with_scores') is null then
    raise exception 'Legacy RPC retirement removed a supported relation.';
  end if;
end;
$$;
