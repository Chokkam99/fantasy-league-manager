-- Removing and re-adding a player keeps their dues receipt, refreshes the
-- expected amount to the current fee, and stays private to the server role.
\set ON_ERROR_STOP on
begin;
select public.create_league_atomically('reactivation-fixture','Reactivation Fixture','2026',
 '{"divisions":[],"draft_food_cost":0,"fee_amount":100,"playoff_spots":2,"playoff_start_week":12,"prize_structure":{"first":200},"total_weeks":17,"weekly_prize_amount":0}',
 '[{"division":null,"manager_name":"Alex","team_name":"A"},{"division":null,"manager_name":"Blake","team_name":"B"},{"division":null,"manager_name":"Casey","team_name":"C"},{"division":null,"manager_name":"Drew","team_name":"D"}]',null);
do $$
declare
 alex uuid; blake uuid; casey uuid; result jsonb; payment record; checked_role text;
begin
 foreach checked_role in array array['anon', 'authenticated'] loop
  if has_function_privilege(checked_role, 'public.reactivate_league_member_atomically(text,text,uuid,text)', 'execute') then
   raise exception '% can reactivate league members', checked_role;
  end if;
 end loop;

 select id into alex from public.league_members where league_id='reactivation-fixture' and manager_name='Alex';
 select id into blake from public.league_members where league_id='reactivation-fixture' and manager_name='Blake';
 select id into casey from public.league_members where league_id='reactivation-fixture' and manager_name='Casey';

 perform public.set_season_payment_details('reactivation-fixture','2026',alex,'paid',10000,'Venmo','Paid at the draft');
 perform public.set_season_payment_details('reactivation-fixture','2026',blake,'paid',10000,'Cash',null);
 update public.league_members set is_active=false where id in (alex, blake, casey);

 -- Fee unchanged: Alex comes back Paid with the same receipt and a new team name.
 result := public.reactivate_league_member_atomically('reactivation-fixture','2026',alex,'Alex Returns');
 if (result->>'success')::boolean is distinct from true or result->'member'->>'payment_status' <> 'paid'
   or (result->'member'->>'is_active')::boolean is distinct from true or result->'member'->>'team_name' <> 'Alex Returns' then
  raise exception 'Reactivation returned an unexpected member: %', result;
 end if;
 select * into payment from public.season_payments where league_member_id=alex;
 if payment.status <> 'paid' or payment.paid_amount_cents <> 10000 or payment.expected_amount_cents <> 10000
   or payment.payment_method <> 'Venmo' or payment.notes <> 'Paid at the draft' or payment.paid_at is null then
  raise exception 'Reactivation did not keep the paid receipt: %', row_to_json(payment);
 end if;

 -- Fee raised while Blake was inactive: the $100 receipt is kept and becomes partial.
 update public.league_seasons set fee_amount=150 where league_id='reactivation-fixture' and season='2026';
 perform public.reactivate_league_member_atomically('reactivation-fixture','2026',blake,null);
 select * into payment from public.season_payments where league_member_id=blake;
 if payment.status <> 'partial' or payment.paid_amount_cents <> 10000 or payment.expected_amount_cents <> 15000
   or payment.payment_method <> 'Cash' or payment.paid_at is not null then
  raise exception 'Reactivation after a fee change did not keep a partial receipt: %', row_to_json(payment);
 end if;
 if (select payment_status from public.league_members where id=blake) <> 'pending'
   or (select team_name from public.league_members where id=blake) <> 'B' then
  raise exception 'Reactivation did not align the membership summary or kept the wrong team name.';
 end if;

 -- Never paid: stays unpaid at the current fee.
 perform public.reactivate_league_member_atomically('reactivation-fixture','2026',casey,null);
 select * into payment from public.season_payments where league_member_id=casey;
 if payment.status <> 'pending' or payment.paid_amount_cents <> 0 or payment.expected_amount_cents <> 15000 then
  raise exception 'Reactivating an unpaid player changed their dues: %', row_to_json(payment);
 end if;

 -- Already active players are rejected without changes.
 begin
  perform public.reactivate_league_member_atomically('reactivation-fixture','2026',alex,null);
  raise exception 'Reactivating an active player should fail.';
 exception when unique_violation then null;
 end;
end;
$$;
rollback;
