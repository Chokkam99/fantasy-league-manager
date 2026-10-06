-- An unchanged weekly re-import or manual save must keep settled player
-- payouts; a genuine score change must still reopen them.
\set ON_ERROR_STOP on
begin;
select public.create_league_atomically('payout-import-fixture','Payout Import Fixture','2026',
 '{"divisions":[],"draft_food_cost":0,"fee_amount":100,"playoff_spots":2,"playoff_start_week":12,"prize_structure":{"first":200},"total_weeks":17,"weekly_prize_amount":20}',
 '[{"division":null,"manager_name":"Alex","team_name":"A"},{"division":null,"manager_name":"Blake","team_name":"B"}]',null);
do $$
declare
 scores jsonb; same_scores jsonb; changed_scores jsonb; matchups jsonb; result jsonb;
 first_member uuid; score_ids uuid[];
begin
 select jsonb_agg(jsonb_build_object('member_id',id,'points',100.5) order by manager_name),
        jsonb_agg(jsonb_build_object('points',100.50,'member_id',id) order by manager_name desc),
        min(id::text)::uuid
 into scores, same_scores, first_member
 from public.league_members where league_id='payout-import-fixture';
 matchups := jsonb_build_array(jsonb_build_object('team1_member_id',scores->0->>'member_id','team2_member_id',scores->1->>'member_id'));
 changed_scores := jsonb_set(scores, '{0,points}', '99.25');

 result := public.import_espn_week_atomically('payout-import-fixture','2026',3,scores,matchups,'scheduled');
 if (result->>'success')::boolean is distinct from true or result ? 'unchanged' then
  raise exception 'Initial weekly import failed or was skipped: %', result;
 end if;
 select array_agg(id order by id) into score_ids from public.weekly_scores
  where league_id='payout-import-fixture' and season='2026' and week_number=3;

 perform public.set_player_payout_status('payout-import-fixture','2026',first_member,'paid');

 -- Same values in a different order and numeric scale.
 result := public.import_espn_week_atomically('payout-import-fixture','2026',3,same_scores,matchups,'scheduled_correction');
 if (result->>'success')::boolean is distinct from true or result->>'code' <> 'IMPORTED'
   or (result->>'unchanged')::boolean is distinct from true
   or (result->>'score_count')::integer <> 2 or (result->>'matchup_count')::integer <> 1 then
  raise exception 'Unchanged re-import did not report an unchanged success: %', result;
 end if;
 if (select status from public.player_payout_statuses
     where league_id='payout-import-fixture' and season='2026' and league_member_id=first_member) <> 'paid' then
  raise exception 'Unchanged re-import reopened a paid player payout.';
 end if;
 if (select array_agg(id order by id) from public.weekly_scores
     where league_id='payout-import-fixture' and season='2026' and week_number=3) is distinct from score_ids then
  raise exception 'Unchanged re-import replaced score rows.';
 end if;
 if (select status from public.import_runs where id=(result->>'run_id')::uuid) <> 'succeeded' then
  raise exception 'Unchanged re-import was not recorded as a successful run.';
 end if;
 if exists(select 1 from public.leagues where id='payout-import-fixture'
   and (last_sync_error is not null or sync_status<>'active' or last_sync_at is null)) then
  raise exception 'Unchanged re-import did not record sync health.';
 end if;

 -- A genuine ESPN correction still replaces the week and reopens payouts.
 result := public.import_espn_week_atomically('payout-import-fixture','2026',3,changed_scores,matchups,'scheduled_correction');
 if (result->>'success')::boolean is distinct from true or result ? 'unchanged' then
  raise exception 'Changed re-import failed or was skipped: %', result;
 end if;
 if (select points from public.weekly_scores where league_id='payout-import-fixture' and season='2026'
     and week_number=3 and member_id=(changed_scores->0->>'member_id')::uuid) <> 99.25 then
  raise exception 'Changed re-import did not store the corrected score.';
 end if;
 if (select status from public.player_payout_statuses
     where league_id='payout-import-fixture' and season='2026' and league_member_id=first_member) <> 'pending' then
  raise exception 'A changed score did not reopen the paid player payout.';
 end if;
end;
$$;
do $$
declare
 scores jsonb; changed_scores jsonb; result jsonb; first_member uuid;
begin
 select jsonb_agg(jsonb_build_object('member_id',member_id,'points',points) order by member_id), min(member_id::text)::uuid
 into scores, first_member
 from public.weekly_scores where league_id='payout-import-fixture' and season='2026' and week_number=3;
 changed_scores := jsonb_set(scores, '{0,points}', '88');
 perform public.set_player_payout_status('payout-import-fixture','2026',first_member,'paid');

 result := public.mutate_manual_week_atomically('save_week','payout-import-fixture','2026',3,scores);
 if (result->>'success')::boolean is distinct from true or (result->>'unchanged')::boolean is distinct from true
   or (result->>'score_count')::integer <> 2 or (result->>'matchup_count')::integer <> 1 then
  raise exception 'Unchanged manual save did not report an unchanged success: %', result;
 end if;
 if (select status from public.player_payout_statuses
     where league_id='payout-import-fixture' and season='2026' and league_member_id=first_member) <> 'paid' then
  raise exception 'Unchanged manual save reopened a paid player payout.';
 end if;

 result := public.mutate_manual_week_atomically('save_week','payout-import-fixture','2026',3,changed_scores);
 if (result->>'success')::boolean is distinct from true or result ? 'unchanged' then
  raise exception 'Changed manual save failed or was skipped: %', result;
 end if;
 if (select status from public.player_payout_statuses
     where league_id='payout-import-fixture' and season='2026' and league_member_id=first_member) <> 'pending' then
  raise exception 'A manual score correction did not reopen the paid player payout.';
 end if;
end;
$$;
rollback;
