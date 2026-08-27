-- Revocable, season-scoped player links and server-only read enforcement.
-- Raw share tokens are never stored. The application hashes each token before
-- invoking the restricted rotation function or validating a player request.

begin;

create table if not exists public.league_share_links (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  season varchar not null,
  token_digest varchar(64) not null unique,
  token_prefix varchar(8) not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint league_share_links_season_format
    check (season ~ '^[0-9]{4}$'),
  constraint league_share_links_token_digest_format
    check (token_digest ~ '^[0-9a-f]{64}$'),
  constraint league_share_links_token_prefix_format
    check (token_prefix ~ '^[A-Za-z0-9_-]{8}$')
);

create unique index if not exists league_share_links_one_active_scope_idx
  on public.league_share_links (league_id, season)
  where revoked_at is null;
create index if not exists league_share_links_lookup_idx
  on public.league_share_links (league_id, season, token_digest)
  where revoked_at is null;

alter table public.league_share_links enable row level security;
revoke all privileges on table public.league_share_links
  from public, anon, authenticated;
grant select, insert, update on table public.league_share_links to service_role;

create or replace function public.rotate_league_share_link(
  p_league_id text,
  p_season text,
  p_token_digest text,
  p_token_prefix text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_link public.league_share_links;
begin
  if p_season !~ '^[0-9]{4}$'
      or p_token_digest !~ '^[0-9a-f]{64}$'
      or p_token_prefix !~ '^[A-Za-z0-9_-]{8}$' then
    raise exception using
      errcode = '22023',
      message = 'A valid season and share token digest are required.';
  end if;

  perform 1
  from public.leagues league
  where league.id = p_league_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'League not found.';
  end if;

  perform 1
  from public.league_seasons season_config
  where season_config.league_id = p_league_id
    and season_config.season = p_season;
  if not found then
    raise exception using errcode = 'P0002', message = 'Season not found.';
  end if;

  update public.league_share_links
  set revoked_at = now()
  where league_id = p_league_id
    and season = p_season
    and revoked_at is null;

  insert into public.league_share_links (
    league_id,
    season,
    token_digest,
    token_prefix
  ) values (
    p_league_id,
    p_season,
    p_token_digest,
    p_token_prefix
  )
  returning * into created_link;

  return jsonb_build_object(
    'id', created_link.id,
    'league_id', created_link.league_id,
    'season', created_link.season,
    'token_prefix', created_link.token_prefix,
    'created_at', created_link.created_at
  );
end;
$$;

create or replace function public.revoke_league_share_link(
  p_league_id text,
  p_season text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  revoked_count integer;
begin
  if p_season !~ '^[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'A valid season is required.';
  end if;

  perform 1
  from public.leagues league
  where league.id = p_league_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'League not found.';
  end if;

  update public.league_share_links
  set revoked_at = now()
  where league_id = p_league_id
    and season = p_season
    and revoked_at is null;
  get diagnostics revoked_count = row_count;

  return jsonb_build_object(
    'success', true,
    'league_id', p_league_id,
    'season', p_season,
    'revoked_count', revoked_count
  );
end;
$$;

grant execute on function public.rotate_league_share_link(text, text, text, text)
  to service_role;
grant execute on function public.revoke_league_share_link(text, text)
  to service_role;
revoke execute on function public.rotate_league_share_link(text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.revoke_league_share_link(text, text)
  from public, anon, authenticated;

-- Player and commissioner reads now go through server routes. The server
-- validates either the signed commissioner cookie or a digest-matched link,
-- then uses the service role with an explicit safe-column contract.
revoke all privileges on table public.leagues from anon, authenticated;
revoke all privileges on table public.league_seasons from anon, authenticated;
revoke all privileges on table public.league_members from anon, authenticated;
revoke all privileges on table public.weekly_scores from anon, authenticated;
revoke all privileges on table public.matchups from anon, authenticated;
revoke all privileges on table public.managers from anon, authenticated;
revoke all privileges on table public.prize_awards from anon, authenticated;
revoke all privileges on table public.prize_payouts from anon, authenticated;
revoke all privileges on table public.matchup_results_with_scores
  from anon, authenticated;

drop policy if exists league_shared_read on public.leagues;
drop policy if exists season_shared_read on public.league_seasons;
drop policy if exists member_shared_read on public.league_members;
drop policy if exists score_shared_read on public.weekly_scores;
drop policy if exists matchup_shared_read on public.matchups;
drop policy if exists manager_shared_read on public.managers;
drop policy if exists prize_award_shared_read on public.prize_awards;
drop policy if exists prize_payout_shared_read on public.prize_payouts;

commit;
