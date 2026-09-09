begin;
select public.create_league_atomically('money-fixture','Money Fixture','2026',
 '{"divisions":[],"draft_food_cost":0,"fee_amount":100,"playoff_spots":2,"playoff_start_week":15,"prize_structure":{"first":150},"total_weeks":17,"weekly_prize_amount":0}',
 '[{"division":null,"manager_name":"Alex","team_name":"A"},{"division":null,"manager_name":"Blake","team_name":"B"}]',null);

create function pg_temp.money_state() returns jsonb language sql as $$
 select jsonb_build_object('fee_amount',fee_amount,'draft_food_cost',draft_food_cost,'weekly_prize_amount',weekly_prize_amount,'prize_structure',prize_structure)
 from public.league_seasons where league_id='money-fixture' and season='2026';
$$;
do $$
declare alex uuid; blake uuid; before_value jsonb; next_value jsonb; old_payment jsonb; award uuid;
begin
 if has_function_privilege('anon','public.update_season_money_atomically(text,text,jsonb,jsonb)','execute') or has_function_privilege('authenticated','public.update_season_money_atomically(text,text,jsonb,jsonb)','execute') or not has_function_privilege('service_role','public.update_season_money_atomically(text,text,jsonb,jsonb)','execute') then raise exception 'Invalid money RPC grants'; end if;
 select id into alex from public.league_members where league_id='money-fixture' and manager_name='Alex';
 select id into blake from public.league_members where league_id='money-fixture' and manager_name='Blake';
 perform public.set_season_payment_details('money-fixture','2026',alex,'paid',10000,'Cash','Receipt note');
 update public.league_members set is_active=false where id=blake;
 select to_jsonb(p) into old_payment from public.season_payments p where league_member_id=blake;
 before_value := pg_temp.money_state(); next_value := before_value || '{"fee_amount":125.25}';
 perform public.update_season_money_atomically('money-fixture','2026',next_value,before_value);
 if not exists(select 1 from public.season_payments where league_member_id=alex and expected_amount_cents=12525 and paid_amount_cents=10000 and status='partial' and notes='Receipt note' and payment_method='Cash') then raise exception 'Fee increase lost recorded receipts'; end if;
 if (select payment_status from public.league_members where id=alex) <> 'pending' then raise exception 'Binary unpaid summary not updated'; end if;
 if (select to_jsonb(p) from public.season_payments p where league_member_id=blake) is distinct from old_payment then raise exception 'Inactive dues changed'; end if;
 begin
  perform public.update_season_money_atomically('money-fixture','2026',next_value,before_value);
  raise exception 'Stale state accepted';
 exception when serialization_failure then null; end;
 before_value := pg_temp.money_state(); next_value := before_value || '{"fee_amount":80,"weekly_prize_amount":5,"prize_structure":{"first":90,"second":10}}';
 perform public.update_season_money_atomically('money-fixture','2026',next_value,before_value);
 if not exists(select 1 from public.season_payments where league_member_id=alex and paid_amount_cents=10000 and expected_amount_cents=8000 and status='paid' and notes='Receipt note') then raise exception 'Fee decrease lost overpayment or note'; end if;
 if (select count(*) from public.prize_awards where league_id='money-fixture' and is_active and award_type='weekly') <> 17 then raise exception 'Weekly awards were not synchronized'; end if;
 select id into award from public.prize_awards where league_id='money-fixture' and award_key='season:first';
 perform public.assign_prize_recipient('money-fixture','2026',award,alex);
 perform public.set_player_payout_status('money-fixture','2026',alex,'paid');
 before_value := pg_temp.money_state();
 begin
  perform public.update_season_money_atomically('money-fixture','2026',before_value || '{"fee_amount":200,"weekly_prize_amount":10}',before_value);
  raise exception 'Assigned payout change accepted';
 exception when invalid_parameter_value then null; end;
 if pg_temp.money_state() is distinct from before_value then raise exception 'Failed save changed season values'; end if;
 perform public.update_season_money_atomically('money-fixture','2026',before_value || '{"fee_amount":90}',before_value);
 if not exists(select 1 from public.player_payout_statuses where league_member_id=alex and status='paid') then raise exception 'Fee-only edit reset payout'; end if;
 before_value := pg_temp.money_state();
 begin
  perform public.update_season_money_atomically('money-fixture','2026',before_value || '{"fee_amount":1.234}',before_value);
  raise exception 'Invalid currency accepted';
 exception when invalid_parameter_value then null; end;
 update public.league_seasons set archived_at=now() where league_id='money-fixture';
 begin
  perform public.update_season_money_atomically('money-fixture','2026',before_value || '{"fee_amount":91}',before_value);
  raise exception 'Archived season was edited';
 exception when invalid_parameter_value then null; end;
end $$;
rollback;
