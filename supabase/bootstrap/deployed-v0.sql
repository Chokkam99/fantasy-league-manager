-- Fantasy League Manager deployed-v0 baseline for a NEW EMPTY database only.
--
-- Do not run this file against the existing production project. Production
-- already has this baseline and must start with the forward migrations in
-- supabase/migrations. A fresh project must apply this file and immediately
-- apply migrations 202608250001 through 202608250004 in filename order.
--
-- This intentionally excludes unrelated tables that happen to share the
-- current production project's public schema.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p', 'v', 'm', 'f')
      and relation.relname <> 'spatial_ref_sys'
  ) then
    raise exception 'The deployed-v0 bootstrap requires an empty public schema.';
  end if;
end;
$$;

create table public.leagues (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  current_season text,
  platform_type varchar(20),
  platform_league_id varchar(100),
  auto_sync_enabled boolean default false,
  last_sync_at timestamptz,
  sync_status varchar(20),
  platform_config jsonb,
  espn_league_id text,
  espn_s2 text,
  espn_swid text,
  last_sync_error text,
  constraint leagues_platform_type_check
    check (platform_type in ('manual', 'espn', 'yahoo', 'sleeper')),
  constraint leagues_sync_status_check
    check (sync_status in ('none', 'inactive', 'active', 'error', 'disabled', 'paused'))
);

create table public.league_seasons (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  season text not null,
  fee_amount numeric not null default 0,
  draft_food_cost numeric default 0,
  weekly_prize_amount numeric default 0,
  total_weeks integer default 17,
  playoff_start_week integer default 15,
  playoff_spots integer default 6,
  divisions jsonb,
  prize_structure jsonb,
  final_winners jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (league_id, season)
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id text references public.leagues(id) on delete cascade,
  manager_name text not null,
  team_name text not null,
  season text,
  division text,
  is_active boolean default true,
  payment_status text default 'pending',
  joined_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint league_members_payment_status_check
    check (payment_status in ('pending', 'paid')),
  unique (league_id, manager_name, season),
  unique (league_id, team_name, season)
);

create table public.weekly_scores (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  week_number integer not null,
  season text,
  points numeric not null default 0,
  created_at timestamptz default now(),
  is_final_score boolean default false,
  is_playoff_week boolean default false,
  week_status text default 'pending',
  constraint weekly_scores_week_status_check
    check (week_status in ('pending', 'completed')),
  unique (league_id, member_id, week_number, season)
);

create table public.matchups (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  season text not null,
  week_number integer not null,
  team1_member_id uuid not null references public.league_members(id) on delete cascade,
  team2_member_id uuid not null references public.league_members(id) on delete cascade,
  scores_locked boolean default false,
  week_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint matchups_distinct_members_check
    check (team1_member_id <> team2_member_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  league_member_id uuid references public.league_members(id) on delete cascade,
  amount numeric not null,
  payment_method text,
  paid_date timestamptz,
  notes text,
  created_at timestamptz default now()
);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_leagues_updated_at
before update on public.leagues
for each row execute function public.update_updated_at_column();

create trigger update_league_seasons_updated_at
before update on public.league_seasons
for each row execute function public.update_updated_at_column();

create trigger update_league_members_updated_at
before update on public.league_members
for each row execute function public.update_updated_at_column();

create trigger update_matchups_updated_at
before update on public.matchups
for each row execute function public.update_updated_at_column();

-- These legacy functions are part of deployed-v0. Migration 001 immediately
-- removes shared execution; current application code does not call them.
create or replace function public.set_playoff_week_flag()
returns trigger language plpgsql as $$ begin return new; end; $$;

create or replace function public.update_matchup_results()
returns trigger language plpgsql as $$ begin return new; end; $$;

create or replace function public.update_matchup_winners()
returns trigger language plpgsql as $$ begin return new; end; $$;

create or replace function public.generate_random_string(length integer)
returns text language sql as $$
  select string_agg(substr(
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    floor(random() * 62 + 1)::integer,
    1
  ), '')
  from generate_series(1, greatest(length, 0));
$$;

create or replace function public.generate_round_robin_schedule(
  p_league_id uuid,
  p_season varchar,
  p_weeks integer default 17
)
returns integer language sql as $$ select 0; $$;

create or replace function public.get_season_standings(
  p_league_id text,
  p_season text,
  p_include_playoffs boolean default false
)
returns table (
  member_id uuid,
  manager_name text,
  team_name text,
  wins bigint,
  losses bigint,
  ties bigint,
  games_played bigint,
  points_for numeric,
  avg_points numeric,
  weekly_wins numeric
)
language sql as $$
  select
    lm.id,
    lm.manager_name,
    lm.team_name,
    0::bigint,
    0::bigint,
    0::bigint,
    0::bigint,
    0::numeric,
    0::numeric,
    0::numeric
  from public.league_members lm
  where lm.league_id = p_league_id and lm.season = p_season;
$$;

create or replace function public.get_team_record(
  p_league_id uuid,
  p_member_id uuid,
  p_season varchar
)
returns table (wins bigint, losses bigint, ties bigint)
language sql as $$ select 0::bigint, 0::bigint, 0::bigint; $$;

create or replace function public.insert_season_matchups(
  p_league_id uuid,
  p_season varchar,
  p_matchups jsonb
)
returns integer language sql as $$ select 0; $$;

create or replace function public.recalculate_matchup_winners(
  p_league_id uuid,
  p_season varchar
)
returns integer language sql as $$ select 0; $$;

create view public.matchup_results_with_scores as
select
  m.id,
  m.league_id,
  m.season,
  m.week_number,
  m.team1_member_id,
  ws1.points as team1_score,
  m.team2_member_id,
  ws2.points as team2_score,
  case
    when ws1.points > ws2.points then m.team1_member_id
    when ws2.points > ws1.points then m.team2_member_id
    else null
  end as winner_member_id,
  case
    when ws1.points is not null and ws1.points = ws2.points then true
    else false
  end as is_tie,
  m.created_at,
  m.updated_at
from public.matchups m
left join public.weekly_scores ws1
  on ws1.league_id = m.league_id
  and ws1.season = m.season
  and ws1.week_number = m.week_number
  and ws1.member_id = m.team1_member_id
left join public.weekly_scores ws2
  on ws2.league_id = m.league_id
  and ws2.season = m.season
  and ws2.week_number = m.week_number
  and ws2.member_id = m.team2_member_id;

-- This reproduces deployed-v0 exposure only so migration 001 can prove that it
-- closes it. Never use the baseline without immediately applying all forwards.
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant execute on all functions in schema public
  to anon, authenticated, service_role;

commit;
