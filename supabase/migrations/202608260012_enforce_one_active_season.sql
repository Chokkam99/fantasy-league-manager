-- Enforce at most one active configuration only after migration 011 provides
-- an atomic rollover operation that deactivates the source before activation.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

do $$
begin
  if to_regprocedure(
    'public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)'
  ) is null then
    raise exception 'Atomic season rollover must exist before active-season uniqueness.';
  end if;

  if exists (
    select 1
    from public.league_seasons season_config
    join public.leagues league on league.id = season_config.league_id
    where season_config.is_active is distinct from
      (season_config.season = league.current_season)
  ) then
    raise exception 'Active-season uniqueness precondition failed.';
  end if;
end;
$$;

create unique index league_seasons_one_active_scope_idx
  on public.league_seasons (league_id)
  where is_active;

commit;
