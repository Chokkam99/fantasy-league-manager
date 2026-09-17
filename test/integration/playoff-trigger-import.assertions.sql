-- Set expect_legacy_failure=true before migration 020; false afterward.
begin;
select public.create_league_atomically('trigger-fixture','Trigger Fixture','2026',
 '{"divisions":[],"draft_food_cost":0,"fee_amount":100,"playoff_spots":2,"playoff_start_week":12,"prize_structure":{"first":200},"total_weeks":17,"weekly_prize_amount":0}',
 '[{"division":null,"manager_name":"Alex","team_name":"A"},{"division":null,"manager_name":"Blake","team_name":"B"}]',null);
select set_config('test.expect_legacy_failure', :'expect_legacy_failure', true);
do $$
declare scores jsonb; matchups jsonb; result jsonb; target_week integer;
begin
 select jsonb_agg(jsonb_build_object('member_id',id,'points',100)) into scores
 from public.league_members where league_id='trigger-fixture';
 matchups := jsonb_build_array(jsonb_build_object('team1_member_id',scores->0->>'member_id','team2_member_id',scores->1->>'member_id'));
 foreach target_week in array array[1,12] loop
  result := public.import_espn_week_atomically('trigger-fixture','2026',target_week,scores,matchups,'scheduled');
  if current_setting('test.expect_legacy_failure')::boolean then
   if (result->>'success')::boolean is distinct from false or result->>'error' is distinct from 'relation "league_seasons" does not exist' then
    raise exception 'Expected the production trigger failure, got %',result;
   end if;
   if exists(select 1 from public.weekly_scores where league_id='trigger-fixture') or exists(select 1 from public.matchups where league_id='trigger-fixture') then raise exception 'Failed import was not rolled back'; end if;
  else
   if (result->>'success')::boolean is distinct from true then raise exception 'Scheduled import still failed: %', result; end if;
   if (select count(*) from public.weekly_scores where league_id='trigger-fixture' and week_number=target_week and is_final_score and week_status='completed' and is_playoff_week=(target_week>=12)) <> 2 then raise exception 'Imported playoff/final flags are incorrect'; end if;
   if (select count(*) from public.matchups where league_id='trigger-fixture' and week_number=target_week) <> 1 then raise exception 'Matchups were not imported'; end if;
   -- A correction/retry must replace the same week without duplicates.
   result := public.import_espn_week_atomically('trigger-fixture','2026',target_week,scores,matchups,'scheduled_correction');
   if (result->>'success')::boolean is distinct from true then raise exception 'Correction failed: %',result; end if;
   if (select count(*) from public.weekly_scores where league_id='trigger-fixture' and week_number=target_week) <> 2 then raise exception 'Retry duplicated scores'; end if;
  end if;
 end loop;
 if not current_setting('test.expect_legacy_failure')::boolean and exists(select 1 from public.leagues where id='trigger-fixture' and (last_sync_error is not null or sync_status<>'active')) then raise exception 'Successful import did not clear sync health'; end if;
end;
$$;
rollback;
