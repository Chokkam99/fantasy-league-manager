begin;

do $$ begin
  if has_function_privilege('anon', 'public.import_espn_season_atomically(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.import_espn_season_atomically(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)', 'execute') then
    raise exception 'Public roles can execute ESPN season import.';
  end if;
  if not has_function_privilege('service_role', 'public.import_espn_season_atomically(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)', 'execute') then
    raise exception 'Service role cannot import ESPN seasons.';
  end if;
end $$;

select public.create_league_atomically('espn-season-fixture', 'Season Import Fixture', '2026',
  '{"divisions":[],"draft_food_cost":0,"fee_amount":100,"playoff_spots":2,"playoff_start_week":15,"prize_structure":{"first":150},"total_weeks":17,"weekly_prize_amount":0}',
  '[{"division":null,"espn_team_id":1,"manager_name":"Alex","team_name":"Old A"},{"division":null,"espn_team_id":2,"manager_name":"Blake","team_name":"Old B"}]',
  '{"auto_sync_enabled":false,"league_id":"123456","private_league":false}');

create function pg_temp.apply_fixture(target text, teams jsonb, weeks jsonb default '[]') returns jsonb language plpgsql as $$
declare members_value jsonb; seasons_value jsonb; scores_value jsonb; platform jsonb; active_season text;
begin
  select jsonb_agg(to_jsonb(t) order by id) into members_value from (select id,manager_id,manager_name,team_name,season,is_active,division from public.league_members where league_id='espn-season-fixture') t;
  select jsonb_agg(to_jsonb(t) order by season) into seasons_value from (select season,total_weeks,playoff_start_week,playoff_spots,divisions,fee_amount,draft_food_cost,weekly_prize_amount,prize_structure,archived_at from public.league_seasons where league_id='espn-season-fixture') t;
  select coalesce(jsonb_agg(to_jsonb(t) order by week_number,member_id),'[]') into scores_value from (select week_number,member_id,points,is_final_score,week_status from public.weekly_scores where league_id='espn-season-fixture' and season=target) t;
  select current_season,platform_config into active_season,platform from public.leagues where id='espn-season-fixture';
  return public.import_espn_season_atomically('espn-season-fixture',target,active_season,
    '{"divisions":[],"draft_food_cost":0,"fee_amount":100,"playoff_spots":2,"playoff_start_week":15,"prize_structure":{"first":150},"total_weeks":17,"weekly_prize_amount":0}',
    teams,weeks,members_value,seasons_value,scores_value,platform,platform);
end $$;

do $$
declare alex uuid; blake uuid; original_manager uuid; teams jsonb; weeks jsonb; result jsonb; original_payment jsonb; bad_teams jsonb;
begin
  select id,manager_id into alex,original_manager from public.league_members where league_id='espn-season-fixture' and manager_name='Alex';
  select id into blake from public.league_members where league_id='espn-season-fixture' and manager_name='Blake';
  update public.season_payments set paid_amount_cents=2500,status='partial',notes='Private fixture note',payment_method='Cash' where league_member_id=alex;
  select to_jsonb(p) into original_payment from public.season_payments p where league_member_id=alex;
  teams := jsonb_build_array(
    jsonb_build_object('team_id',1,'owner_id','owner-a','source_member_id',alex,'manager_name','Alex Renamed','team_name','New A','division',null),
    jsonb_build_object('team_id',2,'owner_id','owner-b','source_member_id',blake,'manager_name','Blake','team_name','New B','division',null));
  weeks := '[{"week":1,"scores":[{"team_id":1,"points":0},{"team_id":2,"points":102.4}],"matchups":[{"team1_id":1,"team2_id":2}]}]';
  result := pg_temp.apply_fixture('2026',teams,weeks);
  if result->>'success' <> 'true' then raise exception 'Current-season import failed.'; end if;
  if (select to_jsonb(p) from public.season_payments p where league_member_id=alex) is distinct from original_payment then raise exception 'Import changed a partial payment or private notes.'; end if;
  if (select team_name from public.league_members where id=alex) <> 'New A' then raise exception 'Matched team name was not updated.'; end if;
  if (select count(*) from public.weekly_scores where league_id='espn-season-fixture' and season='2026') <> 2 then raise exception 'Scores missing.'; end if;
  perform public.set_player_payout_status('espn-season-fixture','2026',alex,'paid');
  perform pg_temp.apply_fixture('2026',teams,weeks);
  if (select status from public.player_payout_statuses where league_member_id=alex) <> 'paid' then raise exception 'Unchanged score import reset a settled payout.'; end if;
  if (select count(*) from public.weekly_scores where league_id='espn-season-fixture' and season='2026') <> 2 then raise exception 'Repeated import duplicated scores.'; end if;
  if (select platform_config#>>'{espn_owner_mappings,123456,owner-a}' from public.leagues where id='espn-season-fixture') <> original_manager::text then raise exception 'Stable owner mapping was not stored.'; end if;
  -- An invalid later week must roll back earlier weeks, roster changes, and season creation together.
  begin
    perform pg_temp.apply_fixture('2027',teams,weeks || '[{"week":2,"scores":[{"team_id":999,"points":10}],"matchups":[]}]');
    raise exception 'Invalid week unexpectedly imported.';
  exception when invalid_parameter_value then null;
  end;
  if exists(select 1 from public.league_seasons where league_id='espn-season-fixture' and season='2027') then raise exception 'Failed import left a partial season.'; end if;
  if (select current_season from public.leagues where id='espn-season-fixture') <> '2026' then raise exception 'Failed import changed active season.'; end if;
  -- Historical import uses historical membership rows without activating that season.
  perform pg_temp.apply_fixture('2025',teams,weeks);
  if (select current_season from public.leagues where id='espn-season-fixture') <> '2026' then raise exception 'Historical import changed active season.'; end if;
  if (select manager_id from public.league_members where league_id='espn-season-fixture' and season='2025' and manager_name='Alex Renamed') <> original_manager then raise exception 'Historical import lost identity.'; end if;
  -- Next season creates new dues and keeps the old payment untouched.
  perform pg_temp.apply_fixture('2027',teams);
  if (select current_season from public.leagues where id='espn-season-fixture') <> '2027' then raise exception 'Next season was not activated.'; end if;
  if (select count(*) from public.league_seasons where league_id='espn-season-fixture' and is_active) <> 1 then raise exception 'Multiple active seasons.'; end if;
  if exists(select 1 from public.season_payments where league_id='espn-season-fixture' and season='2027' and paid_amount_cents<>0) then raise exception 'Old payments leaked into new season.'; end if;
  if (select to_jsonb(p) from public.season_payments p where league_member_id=alex) is distinct from original_payment then raise exception 'Rollover changed historical payment.'; end if;
  -- Same player cannot own two imported identities; the first row's update rolls back.
  bad_teams := jsonb_set(teams,'{1,source_member_id}',to_jsonb(alex));
  begin
    perform pg_temp.apply_fixture('2027',bad_teams);
    raise exception 'Duplicate identity unexpectedly imported.';
  exception when invalid_parameter_value then null;
  end;
  update public.league_seasons set archived_at=now() where league_id='espn-season-fixture' and season='2025';
  begin
    perform pg_temp.apply_fixture('2025',teams,weeks);
    raise exception 'Archived season unexpectedly imported.';
  exception when invalid_parameter_value then null;
  end;
end $$;
rollback;
