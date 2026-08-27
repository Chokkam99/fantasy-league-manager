-- Reversible league and season lifecycle state. Archiving never deletes
-- historical scores, members, finances, mappings, or season configuration.

begin;

alter table public.leagues
  add column if not exists archived_at timestamptz;
alter table public.league_seasons
  add column if not exists archived_at timestamptz;

create index if not exists leagues_archived_at_idx
  on public.leagues (archived_at);
create index if not exists league_seasons_archived_at_idx
  on public.league_seasons (league_id, archived_at, season desc);

-- The leagues table uses explicit shared-view column grants.
grant select (archived_at) on table public.leagues to anon, authenticated;

create or replace function public.set_league_archive_status(
  p_league_id text,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_value timestamptz;
begin
  if p_archived is null then
    raise exception using errcode = '22023', message = 'Archive state is required.';
  end if;

  update public.leagues
  set
    archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
    auto_sync_enabled = case when p_archived then false else auto_sync_enabled end,
    sync_status = case when p_archived then 'disabled' else sync_status end,
    updated_at = now()
  where id = p_league_id
  returning archived_at into archived_value;

  if not found then
    raise exception using errcode = 'P0002', message = 'League not found.';
  end if;

  return jsonb_build_object(
    'success', true,
    'league_id', p_league_id,
    'archived_at', archived_value
  );
end;
$$;

create or replace function public.set_season_archive_status(
  p_league_id text,
  p_season text,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_season text;
  archived_value timestamptz;
begin
  if p_season !~ '^[0-9]{4}$' or p_archived is null then
    raise exception using errcode = '22023', message = 'A valid season and archive state are required.';
  end if;

  select league.current_season into active_season
  from public.leagues league
  where league.id = p_league_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'League not found.';
  end if;
  if p_archived and p_season = active_season then
    raise exception using
      errcode = '22023',
      message = 'The active season cannot be archived.';
  end if;

  update public.league_seasons
  set archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
      updated_at = now()
  where league_id = p_league_id and season = p_season
  returning archived_at into archived_value;

  if not found then
    raise exception using errcode = 'P0002', message = 'Season not found.';
  end if;

  return jsonb_build_object(
    'success', true,
    'league_id', p_league_id,
    'season', p_season,
    'archived_at', archived_value
  );
end;
$$;

grant execute on function public.set_league_archive_status(text, boolean)
  to service_role;
grant execute on function public.set_season_archive_status(text, text, boolean)
  to service_role;

revoke execute on function public.set_league_archive_status(text, boolean)
  from public, anon, authenticated;
revoke execute on function public.set_season_archive_status(text, text, boolean)
  from public, anon, authenticated;

commit;
