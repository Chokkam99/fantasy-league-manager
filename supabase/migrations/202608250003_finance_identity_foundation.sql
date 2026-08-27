-- Stable manager identities and exact, season-scoped finance records.
-- Apply after 202608250001 and 202608250002. This migration is additive: the
-- existing league_members IDs remain the canonical season-team IDs referenced
-- by scores and matchups, while manager_id links the same person across years.

begin;

create table public.managers (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  display_name text not null,
  identity_key text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint managers_display_name_check check (
    btrim(display_name) <> '' and char_length(display_name) <= 80
  ),
  constraint managers_identity_key_check check (
    btrim(identity_key) <> '' and char_length(identity_key) <= 120
  ),
  constraint managers_league_identity_key_unique unique (league_id, identity_key),
  constraint managers_id_league_unique unique (id, league_id)
);

alter table public.league_members
  add column if not exists manager_id uuid references public.managers(id) on delete restrict;

insert into public.managers (league_id, display_name, identity_key)
select distinct on (candidate.league_id, candidate.identity_key)
  candidate.league_id,
  candidate.display_name,
  candidate.identity_key
from (
  select
    lm.league_id,
    btrim(regexp_replace(lm.manager_name, '[[:space:]]+', ' ', 'g')) as display_name,
    lower(btrim(regexp_replace(lm.manager_name, '[[:space:]]+', ' ', 'g'))) as identity_key,
    lm.season,
    lm.joined_at,
    l.current_season
  from public.league_members lm
  join public.leagues l on l.id = lm.league_id
  where lm.league_id is not null
    and btrim(lm.manager_name) <> ''
) candidate
order by
  candidate.league_id,
  candidate.identity_key,
  (candidate.season = candidate.current_season) desc,
  candidate.season desc nulls last,
  candidate.joined_at desc nulls last;

update public.league_members lm
set manager_id = m.id
from public.managers m
where m.league_id = lm.league_id
  and m.identity_key = lower(
    btrim(regexp_replace(lm.manager_name, '[[:space:]]+', ' ', 'g'))
  )
  and lm.manager_id is null;

do $$
begin
  if exists (
    select 1
    from public.league_members
    where league_id is not null
      and btrim(manager_name) <> ''
      and manager_id is null
  ) then
    raise exception 'A valid league member could not be linked to a manager.';
  end if;

  if exists (
    select 1
    from public.league_members
    where manager_id is not null
      and league_id is not null
      and season is not null
    group by league_id, season, manager_id
    having count(*) > 1
  ) then
    raise exception 'A normalized manager appears more than once in a season.';
  end if;
end;
$$;

create index if not exists league_members_manager_id_idx
  on public.league_members (manager_id);
create unique index if not exists league_members_manager_season_unique_idx
  on public.league_members (league_id, season, manager_id)
  where league_id is not null and season is not null and manager_id is not null;

alter table public.league_members
  add constraint league_members_id_league_season_unique
  unique (id, league_id, season);

create or replace function public.assign_league_member_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_identity text;
begin
  if new.league_id is null or btrim(new.manager_name) = '' then
    return new;
  end if;

  if new.manager_id is not null then
    if not exists (
      select 1
      from public.managers m
      where m.id = new.manager_id and m.league_id = new.league_id
    ) then
      raise exception 'The manager does not belong to this league.';
    end if;
    if new.season is not null and not exists (
      select 1
      from public.league_members existing_member
      where existing_member.manager_id = new.manager_id
        and existing_member.season > new.season
    ) then
      update public.managers
      set display_name = btrim(
        regexp_replace(new.manager_name, '[[:space:]]+', ' ', 'g')
      )
      where id = new.manager_id;
    end if;
    return new;
  end if;

  normalized_identity := lower(
    btrim(regexp_replace(new.manager_name, '[[:space:]]+', ' ', 'g'))
  );

  insert into public.managers (league_id, display_name, identity_key)
  values (
    new.league_id,
    btrim(regexp_replace(new.manager_name, '[[:space:]]+', ' ', 'g')),
    normalized_identity
  )
  on conflict (league_id, identity_key) do nothing;

  select m.id into new.manager_id
  from public.managers m
  where m.league_id = new.league_id
    and m.identity_key = normalized_identity;

  if new.season is not null and not exists (
    select 1
    from public.league_members existing_member
    where existing_member.manager_id = new.manager_id
      and existing_member.season > new.season
  ) then
    update public.managers
    set display_name = btrim(
      regexp_replace(new.manager_name, '[[:space:]]+', ' ', 'g')
    )
    where id = new.manager_id;
  end if;

  return new;
end;
$$;

drop trigger if exists assign_league_member_manager on public.league_members;
create trigger assign_league_member_manager
before insert or update of league_id, manager_name, manager_id
on public.league_members
for each row execute function public.assign_league_member_manager();

create table public.season_payments (
  id uuid primary key default gen_random_uuid(),
  league_id text not null,
  season text not null,
  league_member_id uuid not null,
  manager_id uuid not null,
  expected_amount_cents integer not null default 0,
  paid_amount_cents integer not null default 0,
  status text not null default 'pending',
  payment_method text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint season_payments_season_check check (season ~ '^\d{4}$'),
  constraint season_payments_amount_check check (
    expected_amount_cents between 0 and 100000000
    and paid_amount_cents between 0 and 100000000
  ),
  constraint season_payments_status_check check (
    status in ('pending', 'partial', 'paid')
  ),
  constraint season_payments_status_amount_check check (
    (status = 'pending' and paid_amount_cents = 0 and paid_at is null)
    or (
      status = 'partial'
      and paid_amount_cents > 0
      and paid_amount_cents < expected_amount_cents
      and paid_at is null
    )
    or (
      status = 'paid'
      and paid_amount_cents >= expected_amount_cents
      and paid_at is not null
    )
  ),
  constraint season_payments_member_unique unique (league_member_id),
  constraint season_payments_member_scope_fkey
    foreign key (league_member_id, league_id, season)
    references public.league_members(id, league_id, season)
    on delete cascade,
  constraint season_payments_manager_scope_fkey
    foreign key (manager_id, league_id)
    references public.managers(id, league_id)
    on delete restrict,
  constraint season_payments_league_season_fkey
    foreign key (league_id, season)
    references public.league_seasons(league_id, season)
    on delete cascade
);

insert into public.season_payments (
  league_id,
  season,
  league_member_id,
  manager_id,
  expected_amount_cents,
  paid_amount_cents,
  status,
  payment_method,
  paid_at,
  notes
)
select
  lm.league_id,
  lm.season,
  lm.id,
  lm.manager_id,
  amounts.expected_cents,
  amounts.paid_cents,
  case
    when amounts.paid_cents >= amounts.expected_cents
      and (lm.payment_status = 'paid' or amounts.paid_cents > 0)
      then 'paid'
    when amounts.paid_cents > 0 then 'partial'
    else 'pending'
  end,
  legacy.payment_method,
  case
    when amounts.paid_cents >= amounts.expected_cents
      and (lm.payment_status = 'paid' or amounts.paid_cents > 0)
      then coalesce(legacy.paid_at, now())
    else null
  end,
  legacy.notes
from public.league_members lm
join public.league_seasons ls
  on ls.league_id = lm.league_id and ls.season = lm.season
cross join lateral (
  select round(greatest(coalesce(ls.fee_amount, 0), 0) * 100)::integer
    as expected_cents
) expected
left join lateral (
  select
    coalesce(sum(greatest(p.amount, 0)), 0) as paid_amount,
    max(p.paid_date) as paid_at,
    max(p.payment_method) as payment_method,
    string_agg(nullif(btrim(p.notes), ''), E'\n' order by p.created_at) as notes
  from public.payments p
  where p.league_member_id = lm.id
) legacy on true
cross join lateral (
  select
    expected.expected_cents,
    case
      when coalesce(legacy.paid_amount, 0) > 0
        then round(legacy.paid_amount * 100)::integer
      when lm.payment_status = 'paid' then expected.expected_cents
      else 0
    end as paid_cents
) amounts
where lm.league_id is not null
  and lm.season is not null
  and lm.manager_id is not null;

create index if not exists season_payments_league_season_idx
  on public.season_payments (league_id, season, status);
create index if not exists season_payments_manager_idx
  on public.season_payments (manager_id, season desc);

create or replace function public.sync_member_payment_summary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_cents integer;
begin
  if new.league_id is null or new.season is null or new.manager_id is null then
    return new;
  end if;

  select round(greatest(coalesce(ls.fee_amount, 0), 0) * 100)::integer
  into expected_cents
  from public.league_seasons ls
  where ls.league_id = new.league_id and ls.season = new.season;

  if not found then
    return new;
  end if;

  insert into public.season_payments (
    league_id,
    season,
    league_member_id,
    manager_id,
    expected_amount_cents,
    paid_amount_cents,
    status,
    paid_at
  ) values (
    new.league_id,
    new.season,
    new.id,
    new.manager_id,
    expected_cents,
    case when new.payment_status = 'paid' then expected_cents else 0 end,
    case when new.payment_status = 'paid' then 'paid' else 'pending' end,
    case when new.payment_status = 'paid' then now() else null end
  )
  on conflict (league_member_id) do update
  set
    league_id = excluded.league_id,
    season = excluded.season,
    manager_id = excluded.manager_id,
    expected_amount_cents = excluded.expected_amount_cents,
    paid_amount_cents = excluded.paid_amount_cents,
    status = excluded.status,
    paid_at = case
      when excluded.status = 'paid'
        then coalesce(public.season_payments.paid_at, excluded.paid_at)
      else null
    end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_member_payment_summary on public.league_members;
create trigger sync_member_payment_summary
after insert or update of league_id, season, manager_id, payment_status
on public.league_members
for each row execute function public.sync_member_payment_summary();

create table public.prize_awards (
  id uuid primary key default gen_random_uuid(),
  league_id text not null,
  season text not null,
  award_key text not null,
  category_key text not null,
  label text not null,
  award_type text not null,
  week_number integer,
  planned_amount_cents integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prize_awards_season_check check (season ~ '^\d{4}$'),
  constraint prize_awards_key_check check (
    btrim(award_key) <> '' and char_length(award_key) <= 128
    and btrim(category_key) <> '' and char_length(category_key) <= 96
  ),
  constraint prize_awards_label_check check (
    btrim(label) <> '' and char_length(label) <= 100
  ),
  constraint prize_awards_type_check check (
    award_type in ('weekly', 'final', 'special')
  ),
  constraint prize_awards_week_check check (
    (award_type = 'weekly' and week_number between 1 and 30)
    or (award_type in ('final', 'special') and week_number is null)
  ),
  constraint prize_awards_amount_check check (
    planned_amount_cents between 0 and 100000000
  ),
  constraint prize_awards_key_unique unique (league_id, season, award_key),
  constraint prize_awards_id_scope_unique unique (id, league_id, season),
  constraint prize_awards_league_season_fkey
    foreign key (league_id, season)
    references public.league_seasons(league_id, season)
    on delete cascade
);

create table public.prize_payouts (
  id uuid primary key default gen_random_uuid(),
  league_id text not null,
  season text not null,
  award_id uuid not null,
  league_member_id uuid not null,
  manager_id uuid not null,
  amount_cents integer not null,
  status text not null default 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prize_payouts_amount_check check (
    amount_cents between 0 and 100000000
  ),
  constraint prize_payouts_status_check check (status in ('pending', 'paid')),
  constraint prize_payouts_paid_at_check check (
    (status = 'pending' and paid_at is null)
    or (status = 'paid' and paid_at is not null)
  ),
  constraint prize_payouts_recipient_unique unique (award_id, league_member_id),
  constraint prize_payouts_award_scope_fkey
    foreign key (award_id, league_id, season)
    references public.prize_awards(id, league_id, season)
    on delete cascade,
  constraint prize_payouts_member_scope_fkey
    foreign key (league_member_id, league_id, season)
    references public.league_members(id, league_id, season)
    on delete restrict,
  constraint prize_payouts_manager_scope_fkey
    foreign key (manager_id, league_id)
    references public.managers(id, league_id)
    on delete restrict
);

create index if not exists prize_awards_league_season_idx
  on public.prize_awards (league_id, season, award_type, week_number);
create index if not exists prize_payouts_manager_idx
  on public.prize_payouts (manager_id, status);

create or replace function public.sync_season_prize_awards(
  p_league_id text,
  p_season text,
  p_weekly_prize_amount numeric,
  p_total_weeks integer,
  p_prize_structure jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.prize_awards
  set is_active = false, updated_at = now()
  where league_id = p_league_id and season = p_season;

  if coalesce(p_weekly_prize_amount, 0) > 0 then
    insert into public.prize_awards (
      league_id,
      season,
      award_key,
      category_key,
      label,
      award_type,
      week_number,
      planned_amount_cents,
      is_active
    )
    select
      p_league_id,
      p_season,
      'weekly:' || week_number,
      'weekly_high_score',
      'Week ' || week_number || ' high score',
      'weekly',
      week_number,
      round(p_weekly_prize_amount * 100)::integer,
      true
    from generate_series(1, greatest(coalesce(p_total_weeks, 0), 0)) week_number
    on conflict (league_id, season, award_key) do update
    set
      label = excluded.label,
      planned_amount_cents = excluded.planned_amount_cents,
      is_active = true,
      updated_at = now();
  end if;

  insert into public.prize_awards (
    league_id,
    season,
    award_key,
    category_key,
    label,
    award_type,
    week_number,
    planned_amount_cents,
    is_active
  )
  select
    p_league_id,
    p_season,
    'season:' || prize.key,
    prize.key,
    case prize.key
      when 'first' then '1st place'
      when 'second' then '2nd place'
      when 'third' then '3rd place'
      when 'fourth' then '4th place'
      when 'highest_points' then 'Highest points'
      when 'highest_weekly' then 'Highest weekly score'
      when 'lowest_weekly' then 'Lowest weekly score'
      else initcap(replace(prize.key, '_', ' '))
    end,
    case
      when prize.key in ('first', 'second', 'third', 'fourth') then 'final'
      else 'special'
    end,
    null,
    round((prize.value #>> '{}')::numeric * 100)::integer,
    true
  from jsonb_each(coalesce(p_prize_structure, '{}'::jsonb)) prize
  where jsonb_typeof(prize.value) = 'number'
    and (prize.value #>> '{}')::numeric > 0
  on conflict (league_id, season, award_key) do update
  set
    category_key = excluded.category_key,
    label = excluded.label,
    award_type = excluded.award_type,
    week_number = excluded.week_number,
    planned_amount_cents = excluded.planned_amount_cents,
    is_active = true,
    updated_at = now();
end;
$$;

create or replace function public.sync_season_prize_awards_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_season_prize_awards(
    new.league_id,
    new.season,
    new.weekly_prize_amount,
    new.total_weeks,
    new.prize_structure
  );
  return new;
end;
$$;

drop trigger if exists sync_season_prize_awards on public.league_seasons;
create trigger sync_season_prize_awards
after insert or update of weekly_prize_amount, total_weeks, prize_structure
on public.league_seasons
for each row execute function public.sync_season_prize_awards_trigger();

do $$
declare
  season_row record;
begin
  for season_row in
    select
      league_id,
      season,
      weekly_prize_amount,
      total_weeks,
      prize_structure
    from public.league_seasons
  loop
    perform public.sync_season_prize_awards(
      season_row.league_id,
      season_row.season,
      season_row.weekly_prize_amount,
      season_row.total_weeks,
      season_row.prize_structure
    );
  end loop;
end;
$$;

insert into public.prize_payouts (
  league_id,
  season,
  award_id,
  league_member_id,
  manager_id,
  amount_cents,
  status
)
select
  award.league_id,
  award.season,
  award.id,
  member.id,
  member.manager_id,
  award.planned_amount_cents,
  'pending'
from public.prize_awards award
join public.league_seasons season_config
  on season_config.league_id = award.league_id
  and season_config.season = award.season
join public.league_members member
  on member.id::text = season_config.final_winners ->> award.category_key
  and member.league_id = award.league_id
  and member.season = award.season
where award.award_type in ('final', 'special')
  and member.manager_id is not null
on conflict (award_id, league_member_id) do nothing;

create or replace function public.set_season_payment_details(
  p_league_id text,
  p_season text,
  p_member_id uuid,
  p_status text,
  p_paid_amount_cents integer default null,
  p_payment_method text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_cents integer;
  normalized_paid_cents integer;
  payment_id uuid;
begin
  if p_status not in ('pending', 'partial', 'paid') then
    raise exception using errcode = '22023', message = 'Payment status is not valid.';
  end if;
  if p_payment_method is not null and char_length(p_payment_method) > 40 then
    raise exception using errcode = '22023', message = 'Payment method is too long.';
  end if;
  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception using errcode = '22023', message = 'Payment notes are too long.';
  end if;

  select payment.expected_amount_cents, payment.id
  into expected_cents, payment_id
  from public.season_payments payment
  where payment.league_id = p_league_id
    and payment.season = p_season
    and payment.league_member_id = p_member_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Season payment was not found.';
  end if;

  normalized_paid_cents := case p_status
    when 'pending' then 0
    when 'paid' then coalesce(p_paid_amount_cents, expected_cents)
    else p_paid_amount_cents
  end;

  if normalized_paid_cents is null
    or normalized_paid_cents < 0
    or normalized_paid_cents > 100000000 then
    raise exception using errcode = '22023', message = 'Paid amount is not valid.';
  end if;
  if p_status = 'partial'
    and not (
      normalized_paid_cents > 0
      and normalized_paid_cents < expected_cents
    ) then
    raise exception using
      errcode = '22023',
      message = 'A partial payment must be greater than zero and below the expected amount.';
  end if;
  if p_status = 'paid' and normalized_paid_cents < expected_cents then
    raise exception using
      errcode = '22023',
      message = 'A paid amount cannot be below the expected amount.';
  end if;

  -- Keep the legacy binary field compatible. Its trigger writes a basic
  -- summary first; the exact canonical values below are the final state.
  update public.league_members
  set payment_status = case when p_status = 'paid' then 'paid' else 'pending' end
  where id = p_member_id
    and league_id = p_league_id
    and season = p_season;

  update public.season_payments
  set
    paid_amount_cents = normalized_paid_cents,
    status = p_status,
    payment_method = nullif(btrim(p_payment_method), ''),
    notes = nullif(btrim(p_notes), ''),
    paid_at = case
      when p_status = 'paid' then coalesce(paid_at, now())
      else null
    end,
    updated_at = now()
  where id = payment_id;

  return jsonb_build_object(
    'success', true,
    'payment_id', payment_id,
    'status', p_status,
    'expected_amount_cents', expected_cents,
    'paid_amount_cents', normalized_paid_cents
  );
end;
$$;

create or replace function public.assign_prize_recipient(
  p_league_id text,
  p_season text,
  p_award_id uuid,
  p_member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  award_category text;
  award_type_value text;
  manager_identity uuid;
  payout_id uuid;
  planned_cents integer;
begin
  select award.category_key, award.award_type, award.planned_amount_cents
  into award_category, award_type_value, planned_cents
  from public.prize_awards award
  where award.id = p_award_id
    and award.league_id = p_league_id
    and award.season = p_season
    and award.is_active
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Prize award was not found.';
  end if;
  if award_type_value not in ('final', 'special') then
    raise exception using
      errcode = '22023',
      message = 'Weekly recipients are calculated from completed scores.';
  end if;

  if p_member_id is null then
    delete from public.prize_payouts where award_id = p_award_id;
    update public.league_seasons
    set final_winners = coalesce(final_winners, '{}'::jsonb) - award_category
    where league_id = p_league_id and season = p_season;

    return jsonb_build_object(
      'success', true,
      'award_id', p_award_id,
      'payout_id', null,
      'member_id', null
    );
  end if;

  select member.manager_id into manager_identity
  from public.league_members member
  where member.id = p_member_id
    and member.league_id = p_league_id
    and member.season = p_season
    and coalesce(member.is_active, true);

  if not found or manager_identity is null then
    raise exception using errcode = '23503', message = 'Prize recipient was not found.';
  end if;

  delete from public.prize_payouts where award_id = p_award_id;
  insert into public.prize_payouts (
    league_id,
    season,
    award_id,
    league_member_id,
    manager_id,
    amount_cents,
    status
  ) values (
    p_league_id,
    p_season,
    p_award_id,
    p_member_id,
    manager_identity,
    planned_cents,
    'pending'
  )
  returning id into payout_id;

  update public.league_seasons
  set final_winners = jsonb_set(
    coalesce(final_winners, '{}'::jsonb),
    array[award_category],
    to_jsonb(p_member_id::text),
    true
  )
  where league_id = p_league_id and season = p_season;

  return jsonb_build_object(
    'success', true,
    'award_id', p_award_id,
    'payout_id', payout_id,
    'member_id', p_member_id
  );
end;
$$;

create or replace function public.set_prize_payout_status(
  p_league_id text,
  p_season text,
  p_payout_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_payout_id uuid;
begin
  if p_status not in ('pending', 'paid') then
    raise exception using errcode = '22023', message = 'Payout status is not valid.';
  end if;

  update public.prize_payouts
  set
    status = p_status,
    paid_at = case
      when p_status = 'paid' then coalesce(paid_at, now())
      else null
    end,
    updated_at = now()
  where id = p_payout_id
    and league_id = p_league_id
    and season = p_season
  returning id into updated_payout_id;

  if updated_payout_id is null then
    raise exception using errcode = 'P0002', message = 'Prize payout was not found.';
  end if;

  return jsonb_build_object(
    'success', true,
    'payout_id', updated_payout_id,
    'status', p_status
  );
end;
$$;

drop trigger if exists update_managers_updated_at on public.managers;
create trigger update_managers_updated_at
before update on public.managers
for each row execute function public.update_updated_at_column();
drop trigger if exists update_season_payments_updated_at on public.season_payments;
create trigger update_season_payments_updated_at
before update on public.season_payments
for each row execute function public.update_updated_at_column();
drop trigger if exists update_prize_awards_updated_at on public.prize_awards;
create trigger update_prize_awards_updated_at
before update on public.prize_awards
for each row execute function public.update_updated_at_column();
drop trigger if exists update_prize_payouts_updated_at on public.prize_payouts;
create trigger update_prize_payouts_updated_at
before update on public.prize_payouts
for each row execute function public.update_updated_at_column();

alter table public.managers enable row level security;
alter table public.season_payments enable row level security;
alter table public.prize_awards enable row level security;
alter table public.prize_payouts enable row level security;

revoke all privileges on table public.managers
  from public, anon, authenticated;
revoke all privileges on table public.season_payments
  from public, anon, authenticated;
revoke all privileges on table public.prize_awards
  from public, anon, authenticated;
revoke all privileges on table public.prize_payouts
  from public, anon, authenticated;

grant select (id, league_id, display_name)
  on table public.managers to anon, authenticated;
grant select on table public.prize_awards to anon, authenticated;
grant select (
  id,
  award_id,
  league_id,
  season,
  league_member_id,
  manager_id,
  amount_cents,
  status,
  paid_at,
  created_at,
  updated_at
) on table public.prize_payouts to anon, authenticated;

grant select, insert, update, delete on table public.managers to service_role;
grant select, insert, update, delete on table public.season_payments to service_role;
grant select, insert, update, delete on table public.prize_awards to service_role;
grant select, insert, update, delete on table public.prize_payouts to service_role;

grant execute on function public.set_season_payment_details(
  text, text, uuid, text, integer, text, text
) to service_role;
grant execute on function public.assign_prize_recipient(
  text, text, uuid, uuid
) to service_role;
grant execute on function public.set_prize_payout_status(
  text, text, uuid, text
) to service_role;

drop policy if exists manager_shared_read on public.managers;
create policy manager_shared_read
  on public.managers for select to anon, authenticated using (true);
drop policy if exists prize_award_shared_read on public.prize_awards;
create policy prize_award_shared_read
  on public.prize_awards for select to anon, authenticated using (true);
drop policy if exists prize_payout_shared_read on public.prize_payouts;
create policy prize_payout_shared_read
  on public.prize_payouts for select to anon, authenticated using (true);

revoke execute on function public.assign_league_member_manager()
  from public, anon, authenticated;
revoke execute on function public.sync_member_payment_summary()
  from public, anon, authenticated;
revoke execute on function public.sync_season_prize_awards(text, text, numeric, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.sync_season_prize_awards_trigger()
  from public, anon, authenticated;
revoke execute on function public.set_season_payment_details(
  text, text, uuid, text, integer, text, text
) from public, anon, authenticated;
revoke execute on function public.assign_prize_recipient(
  text, text, uuid, uuid
) from public, anon, authenticated;
revoke execute on function public.set_prize_payout_status(
  text, text, uuid, text
) from public, anon, authenticated;

commit;
