-- Track one season-end handout status per player. This covers the player's
-- complete tally, including calculated weekly winnings and assigned awards.

begin;

create table if not exists public.player_payout_statuses (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  season text not null,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_payout_statuses_member_scope_fkey
    foreign key (league_member_id, league_id, season)
    references public.league_members(id, league_id, season)
    on delete cascade,
  constraint player_payout_statuses_member_scope_key
    unique (league_id, season, league_member_id)
);

create index if not exists player_payout_statuses_scope_idx
  on public.player_payout_statuses (league_id, season, status);

alter table public.player_payout_statuses enable row level security;
revoke all privileges on table public.player_payout_statuses
  from public, anon, authenticated;
grant select, insert, update, delete on table public.player_payout_statuses
  to service_role;

create or replace function public.set_player_payout_status(
  p_league_id text,
  p_season text,
  p_member_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payout_status_id uuid;
begin
  if p_status not in ('pending', 'paid') then
    raise exception using errcode = '22023', message = 'Player payout status is not valid.';
  end if;

  perform 1
  from public.league_members member
  where member.id = p_member_id
    and member.league_id = p_league_id
    and member.season = p_season
    and coalesce(member.is_active, true)
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Player was not found.';
  end if;

  insert into public.player_payout_statuses (
    league_id,
    season,
    league_member_id,
    status,
    paid_at
  ) values (
    p_league_id,
    p_season,
    p_member_id,
    p_status,
    case when p_status = 'paid' then now() else null end
  )
  on conflict (league_id, season, league_member_id) do update
  set
    status = excluded.status,
    paid_at = case
      when excluded.status = 'paid' then coalesce(public.player_payout_statuses.paid_at, now())
      else null
    end,
    updated_at = now()
  returning id into payout_status_id;

  -- Keep assigned award records aligned for existing finance summaries. The
  -- player status remains authoritative for the complete weekly + award tally.
  update public.prize_payouts
  set
    status = p_status,
    paid_at = case
      when p_status = 'paid' then coalesce(paid_at, now())
      else null
    end,
    updated_at = now()
  where league_id = p_league_id
    and season = p_season
    and league_member_id = p_member_id;

  return jsonb_build_object(
    'success', true,
    'player_payout_status_id', payout_status_id,
    'member_id', p_member_id,
    'status', p_status
  );
end;
$$;

create or replace function public.reset_player_payout_statuses_for_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_league_id text;
  target_season text;
begin
  if tg_op = 'DELETE' then
    target_league_id := old.league_id;
    target_season := old.season;
  else
    target_league_id := new.league_id;
    target_season := new.season;
  end if;

  update public.player_payout_statuses
  set status = 'pending', paid_at = null, updated_at = now()
  where league_id = target_league_id
    and season = target_season
    and status = 'paid';
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists reset_player_payout_statuses_for_score
  on public.weekly_scores;
create trigger reset_player_payout_statuses_for_score
after insert or delete or update of member_id, points, week_number, season
on public.weekly_scores
for each row execute function public.reset_player_payout_statuses_for_score();

create or replace function public.reset_player_payout_statuses_for_award()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_member_id uuid;
  second_member_id uuid;
  target_league_id text;
  target_season text;
begin
  if tg_op = 'DELETE' then
    target_league_id := old.league_id;
    target_season := old.season;
    first_member_id := old.league_member_id;
    second_member_id := old.league_member_id;
  elsif tg_op = 'INSERT' then
    target_league_id := new.league_id;
    target_season := new.season;
    first_member_id := new.league_member_id;
    second_member_id := new.league_member_id;
  else
    target_league_id := new.league_id;
    target_season := new.season;
    first_member_id := new.league_member_id;
    second_member_id := old.league_member_id;
  end if;

  update public.player_payout_statuses
  set status = 'pending', paid_at = null, updated_at = now()
  where league_id = target_league_id
    and season = target_season
    and league_member_id in (first_member_id, second_member_id)
    and status = 'paid';
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists reset_player_payout_statuses_for_award
  on public.prize_payouts;
create trigger reset_player_payout_statuses_for_award
after insert or delete or update of league_member_id, amount_cents
on public.prize_payouts
for each row execute function public.reset_player_payout_statuses_for_award();

grant execute on function public.set_player_payout_status(text, text, uuid, text)
  to service_role;
revoke execute on function public.set_player_payout_status(text, text, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.reset_player_payout_statuses_for_score()
  from public, anon, authenticated;
revoke execute on function public.reset_player_payout_statuses_for_award()
  from public, anon, authenticated;

commit;
