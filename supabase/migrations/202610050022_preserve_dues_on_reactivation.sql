-- Re-adding a removed player must keep the dues they already paid.
--
-- The members route used to reactivate a player by writing
-- payment_status = 'pending', which fires sync_member_payment_summary
-- (migration 003) and resets that season's receipt to $0. This function
-- reactivates without touching the receipt: it refreshes the expected amount
-- to the season's current entry fee and recomputes Paid/Partial/Unpaid from
-- the amount already received, using the same rule as the money settings save
-- (migration 019).
--
-- Rollback: drop function public.reactivate_league_member_atomically(text, text, uuid, text);
-- the route falls back to a reactivation that leaves payment_status unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create or replace function public.reactivate_league_member_atomically(
  p_league_id text,
  p_season text,
  p_member_id uuid,
  p_team_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_row public.league_members%rowtype;
  payment_row public.season_payments%rowtype;
  fee_cents integer;
  new_status text;
  member_status text;
begin
  select * into member_row
  from public.league_members member
  where member.id = p_member_id
    and member.league_id = p_league_id
    and member.season = p_season
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Player not found.';
  end if;

  if member_row.is_active is not false then
    raise exception using
      errcode = '23505',
      message = format('%s is already active in %s.', member_row.manager_name, p_season);
  end if;

  select round(greatest(coalesce(season_config.fee_amount, 0), 0) * 100)::integer
  into fee_cents
  from public.league_seasons season_config
  where season_config.league_id = p_league_id
    and season_config.season = p_season;

  if not found then
    raise exception using errcode = 'P0002', message = 'Season not found.';
  end if;

  -- Leave payment_status out of this update so the summary trigger keeps the receipt.
  update public.league_members
  set
    is_active = true,
    team_name = coalesce(nullif(btrim(p_team_name), ''), team_name)
  where id = p_member_id;

  select * into payment_row
  from public.season_payments payment
  where payment.league_member_id = p_member_id
  for update;

  if found then
    new_status := case
      when payment_row.paid_amount_cents >= fee_cents then 'paid'
      when payment_row.paid_amount_cents > 0 then 'partial'
      else 'pending'
    end;
    member_status := case when new_status = 'paid' then 'paid' else 'pending' end;

    if member_row.payment_status is distinct from member_status then
      update public.league_members
      set payment_status = member_status
      where id = p_member_id;
    end if;

    -- Restore the exact receipt after the legacy summary trigger, as migration 019 does.
    update public.season_payments
    set
      expected_amount_cents = fee_cents,
      paid_amount_cents = payment_row.paid_amount_cents,
      status = new_status,
      paid_at = case
        when new_status = 'paid' then coalesce(payment_row.paid_at, now())
        else null
      end,
      payment_method = payment_row.payment_method,
      notes = payment_row.notes,
      updated_at = now()
    where id = payment_row.id;
  else
    -- No receipt yet: let the summary trigger create one from the membership status.
    update public.league_members
    set payment_status = coalesce(member_row.payment_status, 'pending')
    where id = p_member_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'member', (
      select jsonb_build_object(
        'id', member.id,
        'manager_name', member.manager_name,
        'team_name', member.team_name,
        'season', member.season,
        'is_active', member.is_active,
        'payment_status', member.payment_status
      )
      from public.league_members member
      where member.id = p_member_id
    )
  );
end;
$$;

revoke all on function public.reactivate_league_member_atomically(text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reactivate_league_member_atomically(text, text, uuid, text)
  to service_role;

commit;
