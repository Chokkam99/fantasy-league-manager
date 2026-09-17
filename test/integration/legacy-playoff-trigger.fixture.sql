-- Reproduce the production-only legacy trigger missing from the old synthetic
-- baseline. Its unqualified lookup inherits the import RPC's empty search_path.
create or replace function public.set_playoff_week_flag()
returns trigger language plpgsql as $$
declare playoff_start_week_num integer;
begin
  select playoff_start_week into playoff_start_week_num
  from league_seasons where league_id=new.league_id and season=new.season;
  new.is_playoff_week := new.week_number >= coalesce(playoff_start_week_num,15);
  return new;
end;
$$;
create trigger set_playoff_week_trigger before insert or update on public.weekly_scores
for each row execute function public.set_playoff_week_flag();
