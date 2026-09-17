-- The legacy trigger uses an unqualified league_seasons lookup, which fails
-- inside the atomic import RPC's empty search_path. Migration 013 installed
-- the schema-qualified replacement; retire only the duplicate legacy trigger.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '2min';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.weekly_scores'::regclass
      and tgname = 'derive_weekly_score_playoff_flag'
      and tgfoid = 'public.derive_weekly_score_playoff_flag()'::regprocedure
      and tgenabled in ('O', 'A')
      and not tgisinternal
  ) then
    raise exception 'The canonical playoff flag trigger must be enabled before retiring the legacy trigger.';
  end if;
end;
$$;

drop trigger if exists set_playoff_week_trigger on public.weekly_scores;
commit;
