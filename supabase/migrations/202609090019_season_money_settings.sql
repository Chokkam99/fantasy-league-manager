begin;
set local lock_timeout = '5s';
set local statement_timeout = '2min';

create or replace function public.update_season_money_atomically(
  p_league_id text, p_season text, p_settings jsonb, p_expected jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_config public.league_seasons%rowtype;
  payment_row public.season_payments%rowtype;
  new_fee integer;
  new_status text;
  prize_changed boolean;
  value jsonb;
  archived timestamptz;
begin
  if p_season !~ '^[0-9]{4}$' or jsonb_typeof(p_settings) is distinct from 'object' then
    raise exception using errcode='22023', message='Valid season money settings are required.';
  end if;
  perform pg_advisory_xact_lock(hashtext('season-rollover'), hashtext(p_league_id));
  select archived_at into archived from public.leagues where id=p_league_id for update;
  if not found then raise exception using errcode='P0002', message='League not found.'; end if;
  if archived is not null then raise exception using errcode='22023', message='Restore the archived league before editing money settings.'; end if;
  select * into current_config from public.league_seasons where league_id=p_league_id and season=p_season for update;
  if not found then raise exception using errcode='P0002', message='Season not found.'; end if;
  if current_config.archived_at is not null then raise exception using errcode='22023', message='Restore the archived season before editing money settings.'; end if;
  if jsonb_build_object('fee_amount',current_config.fee_amount,'draft_food_cost',current_config.draft_food_cost,
    'weekly_prize_amount',current_config.weekly_prize_amount,'prize_structure',current_config.prize_structure) is distinct from p_expected then
    raise exception using errcode='40001', message='Money settings changed. Reload them before saving.';
  end if;
  for value in select p_settings->key from unnest(array['fee_amount','draft_food_cost','weekly_prize_amount']) key loop
    if jsonb_typeof(value) is distinct from 'number' then raise exception using errcode='22023', message='Money amounts must be numbers.'; end if;
    if (value#>>'{}')::numeric not between 0 and 1000000 or round((value#>>'{}')::numeric,2) <> (value#>>'{}')::numeric then
      raise exception using errcode='22023', message='Money amounts must be between zero and one million with at most two decimal places.';
    end if;
  end loop;
  if jsonb_typeof(p_settings->'prize_structure') is distinct from 'object' then raise exception using errcode='22023', message='Prize amounts are required.'; end if;
  if (select count(*) from jsonb_each(p_settings->'prize_structure')) > 32 then raise exception using errcode='22023', message='At most 32 prizes are supported.'; end if;
  if exists(select 1 from jsonb_each(p_settings->'prize_structure') p where p.key !~ '^[a-z0-9_]{1,64}$' or jsonb_typeof(p.value) <> 'number') then
    raise exception using errcode='22023', message='Prize names or amounts are invalid.';
  end if;
  if exists(select 1 from jsonb_each_text(p_settings->'prize_structure') p where p.value::numeric not between 0 and 1000000 or round(p.value::numeric,2) <> p.value::numeric) then
    raise exception using errcode='22023', message='Prize amounts are invalid.';
  end if;
  prize_changed := coalesce(current_config.weekly_prize_amount,0) <> (p_settings->>'weekly_prize_amount')::numeric
    or coalesce(current_config.prize_structure,'{}'::jsonb) <> p_settings->'prize_structure';
  if prize_changed then
    perform 1 from public.league_members where league_id=p_league_id and season=p_season order by id for update;
    perform 1 from public.prize_awards where league_id=p_league_id and season=p_season order by id for update;
  end if;
  if prize_changed and (
    exists(select 1 from public.player_payout_statuses where league_id=p_league_id and season=p_season and status='paid')
    or exists(select 1 from public.prize_payouts where league_id=p_league_id and season=p_season)
  ) then
    raise exception using errcode='22023', message='This season has assigned or paid prizes. Review and clear the affected payout assignments before changing prize amounts. Entry fees and draft costs can still be edited separately.';
  end if;
  -- Updating only fee/cost columns avoids unnecessary award synchronization.
  update public.league_seasons set fee_amount=(p_settings->>'fee_amount')::numeric,
    draft_food_cost=(p_settings->>'draft_food_cost')::numeric, updated_at=now()
    where league_id=p_league_id and season=p_season;
  if current_config.fee_amount is distinct from (p_settings->>'fee_amount')::numeric then
    new_fee := round((p_settings->>'fee_amount')::numeric*100)::integer;
    for payment_row in select payment.* from public.season_payments payment
      join public.league_members member on member.id=payment.league_member_id
      where payment.league_id=p_league_id and payment.season=p_season and member.is_active is not false
      order by payment.id for update of payment, member
    loop
      new_status := case when payment_row.paid_amount_cents >= new_fee then 'paid' when payment_row.paid_amount_cents > 0 then 'partial' else 'pending' end;
      update public.league_members set payment_status=case when new_status='paid' then 'paid' else 'pending' end
        where id=payment_row.league_member_id;
      -- Restore exact receipts after the legacy membership summary trigger runs.
      update public.season_payments set expected_amount_cents=new_fee,
        paid_amount_cents=payment_row.paid_amount_cents, status=new_status,
        paid_at=case when new_status='paid' then coalesce(payment_row.paid_at,now()) else null end,
        payment_method=payment_row.payment_method, notes=payment_row.notes, updated_at=now()
        where id=payment_row.id;
    end loop;
  end if;
  if prize_changed then
    update public.league_seasons set weekly_prize_amount=(p_settings->>'weekly_prize_amount')::numeric,
      prize_structure=p_settings->'prize_structure', updated_at=now() where league_id=p_league_id and season=p_season;
  end if;
  return jsonb_build_object('success',true,'season',p_season);
end;
$$;
revoke all on function public.update_season_money_atomically(text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.update_season_money_atomically(text,text,jsonb,jsonb) to service_role;
commit;
