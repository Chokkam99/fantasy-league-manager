\set ON_ERROR_STOP on

do $$
begin
  if (select count(*) from public.managers where league_id = 'fixture-league') <> 2 then
    raise exception 'historical manager backfill did not merge stable identities';
  end if;

  if (
    select count(distinct manager_id)
    from public.league_members
    where league_id = 'fixture-league'
      and manager_name = 'Fixture Manager One'
  ) <> 1 then
    raise exception 'the same manager was not linked across renamed teams';
  end if;

  if exists (
    select 1
    from public.league_members
    where league_id = 'fixture-league' and manager_id is null
  ) then
    raise exception 'a valid fixture season team lacks stable manager identity';
  end if;
end;
$$;

do $$
begin
  if (select count(*) from public.season_payments where league_id = 'fixture-league') <> 3 then
    raise exception 'season payment backfill did not create one row per season team';
  end if;

  if not exists (
    select 1
    from public.season_payments
    where league_member_id = '00000000-0000-4000-8000-000000000011'
      and expected_amount_cents = 5000
      and paid_amount_cents = 5000
      and status = 'paid'
      and paid_at is not null
  ) then
    raise exception 'legacy paid state was not backfilled exactly';
  end if;

  if not exists (
    select 1
    from public.season_payments
    where league_member_id = '00000000-0000-4000-8000-000000000012'
      and expected_amount_cents = 5000
      and paid_amount_cents = 0
      and status = 'pending'
      and paid_at is null
  ) then
    raise exception 'legacy pending state was not backfilled exactly';
  end if;

  if not exists (
    select 1
    from public.season_payments
    where league_member_id = '00000000-0000-4000-8000-000000000013'
      and expected_amount_cents = 4000
      and paid_amount_cents = 4000
      and status = 'paid'
  ) then
    raise exception 'binary paid state without a legacy transaction was not preserved';
  end if;
end;
$$;

do $$
begin
  if (select count(*) from public.prize_awards
      where league_id = 'fixture-league' and season = '2026'
        and award_type = 'weekly' and is_active) <> 17 then
    raise exception 'weekly prize plan was not normalized';
  end if;

  if not exists (
    select 1
    from public.prize_awards
    where league_id = 'fixture-league' and season = '2026'
      and award_key = 'season:first'
      and award_type = 'final'
      and planned_amount_cents = 6500
      and is_active
  ) then
    raise exception 'final prize plan was not normalized';
  end if;

  if not exists (
    select 1
    from public.prize_payouts payout
    join public.prize_awards award on award.id = payout.award_id
    where award.league_id = 'fixture-league'
      and award.season = '2026'
      and award.award_key = 'season:first'
      and payout.league_member_id = '00000000-0000-4000-8000-000000000011'
      and payout.amount_cents = 6500
      and payout.status = 'pending'
  ) then
    raise exception 'saved final recipient was not backfilled as a pending payout';
  end if;
end;
$$;

do $$
declare
  checked_role text;
begin
  foreach checked_role in array array['anon', 'authenticated'] loop
    if has_table_privilege(checked_role, 'public.season_payments', 'SELECT') then
      raise exception '% can read private dues records', checked_role;
    end if;
    if not has_column_privilege(
      checked_role,
      'public.prize_payouts',
      'status',
      'SELECT'
    ) then
      raise exception '% cannot read public-safe payout status', checked_role;
    end if;
    if has_column_privilege(
      checked_role,
      'public.prize_payouts',
      'notes',
      'SELECT'
    ) then
      raise exception '% can read private payout notes', checked_role;
    end if;
    if has_table_privilege(checked_role, 'public.prize_awards', 'INSERT')
      or has_table_privilege(checked_role, 'public.prize_payouts', 'UPDATE')
      or has_table_privilege(checked_role, 'public.managers', 'DELETE') then
      raise exception '% can mutate canonical identity or finance records', checked_role;
    end if;
  end loop;

  if has_function_privilege(
    'anon',
    'public.sync_season_prize_awards(text,text,numeric,integer,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.assign_league_member_manager()',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.set_season_payment_details(text,text,uuid,text,integer,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.assign_prize_recipient(text,text,uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.set_prize_payout_status(text,text,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'shared roles can execute finance maintenance functions';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.set_season_payment_details(text,text,uuid,text,integer,text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.assign_prize_recipient(text,text,uuid,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.set_prize_payout_status(text,text,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'service role cannot execute commissioner finance functions';
  end if;
end;
$$;

set role anon;
select id, league_id, display_name from public.managers;
select award_key, label, award_type, planned_amount_cents
from public.prize_awards;
select award_id, league_member_id, amount_cents, status, paid_at
from public.prize_payouts;
reset role;

set role service_role;

insert into public.league_seasons (
  league_id,
  season,
  fee_amount,
  weekly_prize_amount,
  total_weeks,
  playoff_start_week,
  playoff_spots,
  prize_structure,
  is_active
) values (
  'fixture-league',
  '2027',
  60,
  10,
  3,
  3,
  2,
  '{"first":90,"custom_bonus":30}',
  false
);

insert into public.league_members (
  id,
  league_id,
  manager_id,
  manager_name,
  team_name,
  season,
  payment_status,
  is_active
) values (
  '00000000-0000-4000-8000-000000000014',
  'fixture-league',
  (
    select manager_id
    from public.league_members
    where id = '00000000-0000-4000-8000-000000000011'
  ),
  'Fixture Manager One Renamed',
  'Fixture Team One Future Name',
  '2027',
  'pending',
  true
);

do $$
begin
  if (
    select manager_id
    from public.league_members
    where id = '00000000-0000-4000-8000-000000000014'
  ) <> (
    select manager_id
    from public.league_members
    where id = '00000000-0000-4000-8000-000000000011'
  ) then
    raise exception 'compatibility insert did not reuse stable manager identity';
  end if;

  if (
    select display_name
    from public.managers
    where id = (
      select manager_id
      from public.league_members
      where id = '00000000-0000-4000-8000-000000000014'
    )
  ) <> 'Fixture Manager One Renamed' then
    raise exception 'latest season manager display name was not refreshed';
  end if;

  update public.league_members
  set manager_name = 'Historical Manager Name Edit'
  where id = '00000000-0000-4000-8000-000000000011';

  if (
    select display_name
    from public.managers
    where id = (
      select manager_id
      from public.league_members
      where id = '00000000-0000-4000-8000-000000000014'
    )
  ) <> 'Fixture Manager One Renamed' then
    raise exception 'historical edit overwrote the latest manager display name';
  end if;

  if not exists (
    select 1
    from public.season_payments
    where league_member_id = '00000000-0000-4000-8000-000000000014'
      and expected_amount_cents = 6000
      and paid_amount_cents = 0
      and status = 'pending'
  ) then
    raise exception 'compatibility insert did not create pending dues summary';
  end if;

  if (select count(*) from public.prize_awards
      where league_id = 'fixture-league' and season = '2027'
        and is_active) <> 5 then
    raise exception 'new season did not create weekly and season award records';
  end if;
end;
$$;

update public.league_members
set payment_status = 'paid'
where id = '00000000-0000-4000-8000-000000000014';

do $$
begin
  if not exists (
    select 1
    from public.season_payments
    where league_member_id = '00000000-0000-4000-8000-000000000014'
      and paid_amount_cents = 6000
      and status = 'paid'
      and paid_at is not null
  ) then
    raise exception 'legacy paid toggle did not update canonical dues summary';
  end if;
end;
$$;

select public.set_season_payment_details(
  'fixture-league',
  '2027',
  '00000000-0000-4000-8000-000000000014',
  'partial',
  2500,
  'Zelle',
  'First half'
);

do $$
begin
  if not exists (
    select 1
    from public.season_payments
    where league_member_id = '00000000-0000-4000-8000-000000000014'
      and expected_amount_cents = 6000
      and paid_amount_cents = 2500
      and status = 'partial'
      and payment_method = 'Zelle'
      and notes = 'First half'
      and paid_at is null
  ) then
    raise exception 'commissioner payment operation did not preserve partial details';
  end if;

  if (
    select payment_status
    from public.league_members
    where id = '00000000-0000-4000-8000-000000000014'
  ) <> 'pending' then
    raise exception 'partial payment did not preserve the legacy pending summary';
  end if;
end;
$$;

select public.set_season_payment_details(
  'fixture-league',
  '2027',
  '00000000-0000-4000-8000-000000000014',
  'paid'
);

do $$
declare
  final_award_id uuid;
  final_payout_id uuid;
  weekly_award_id uuid;
begin
  if not exists (
    select 1
    from public.season_payments
    where league_member_id = '00000000-0000-4000-8000-000000000014'
      and expected_amount_cents = 6000
      and paid_amount_cents = 6000
      and status = 'paid'
      and paid_at is not null
  ) or (
    select payment_status
    from public.league_members
    where id = '00000000-0000-4000-8000-000000000014'
  ) <> 'paid' then
    raise exception 'commissioner paid operation did not synchronize both payment models';
  end if;

  select id into final_award_id
  from public.prize_awards
  where league_id = 'fixture-league'
    and season = '2027'
    and award_key = 'season:first';

  perform public.assign_prize_recipient(
    'fixture-league',
    '2027',
    final_award_id,
    '00000000-0000-4000-8000-000000000014'
  );

  select id into final_payout_id
  from public.prize_payouts
  where award_id = final_award_id;

  if not exists (
    select 1
    from public.prize_payouts
    where id = final_payout_id
      and league_member_id = '00000000-0000-4000-8000-000000000014'
      and amount_cents = 9000
      and status = 'pending'
      and paid_at is null
  ) or (
    select final_winners ->> 'first'
    from public.league_seasons
    where league_id = 'fixture-league' and season = '2027'
  ) <> '00000000-0000-4000-8000-000000000014' then
    raise exception 'recipient assignment did not synchronize payout and saved winner';
  end if;

  perform public.set_prize_payout_status(
    'fixture-league',
    '2027',
    final_payout_id,
    'paid'
  );

  if not exists (
    select 1
    from public.prize_payouts
    where id = final_payout_id and status = 'paid' and paid_at is not null
  ) then
    raise exception 'payout operation did not record paid state and timestamp';
  end if;

  select id into weekly_award_id
  from public.prize_awards
  where league_id = 'fixture-league'
    and season = '2027'
    and award_key = 'weekly:1';

  begin
    perform public.assign_prize_recipient(
      'fixture-league',
      '2027',
      weekly_award_id,
      '00000000-0000-4000-8000-000000000014'
    );
    raise exception 'weekly recipient assignment was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

insert into public.leagues (id, name, current_season)
values ('other-fixture-league', 'Other Fixture League', '2027');

insert into public.league_seasons (
  league_id,
  season,
  fee_amount,
  total_weeks,
  playoff_start_week,
  playoff_spots,
  prize_structure,
  is_active
) values (
  'other-fixture-league',
  '2027',
  60,
  3,
  3,
  2,
  '{}',
  true
);

insert into public.league_members (
  id,
  league_id,
  manager_name,
  team_name,
  season,
  payment_status,
  is_active
) values (
  '00000000-0000-4000-8000-000000000015',
  'other-fixture-league',
  'Other Fixture Manager',
  'Other Fixture Team',
  '2027',
  'pending',
  true
);

do $$
declare
  other_manager_id uuid;
begin
  select manager_id into other_manager_id
  from public.league_members
  where id = '00000000-0000-4000-8000-000000000015';

  begin
    update public.season_payments
    set manager_id = other_manager_id
    where league_member_id = '00000000-0000-4000-8000-000000000014';
    raise exception 'cross-league payment manager was accepted';
  exception when foreign_key_violation then
    null;
  end;

  begin
    update public.prize_payouts
    set league_member_id = '00000000-0000-4000-8000-000000000015'
    where id = (
      select payout.id
      from public.prize_payouts payout
      join public.prize_awards award on award.id = payout.award_id
      where award.league_id = 'fixture-league'
      limit 1
    );
    raise exception 'cross-league payout recipient was accepted';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

reset role;
