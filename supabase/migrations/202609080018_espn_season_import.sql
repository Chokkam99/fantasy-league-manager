-- ESPN-first setup and reconciliation for new, current, and historical seasons.
-- One transaction preserves membership IDs and payment records, and rejects stale previews.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '2min';

create or replace function public.import_espn_season_atomically(
  p_league_id text, p_season text, p_current_season text,
  p_configuration jsonb, p_teams jsonb, p_weeks jsonb,
  p_expected_members jsonb, p_expected_seasons jsonb, p_expected_scores jsonb,
  p_platform_config jsonb, p_expected_platform jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  league_row public.leagues%rowtype;
  current_members jsonb;
  current_seasons jsonb;
  current_scores jsonb;
  team jsonb;
  imported_week jsonb;
  source_manager uuid;
  target_member uuid;
  resolved_manager uuid;
  selected_ids uuid[] := '{}';
  team_ids jsonb := '{}'::jsonb;
  owner_ids jsonb;
  platform_value jsonb;
  is_new boolean;
  total_weeks_value integer;
  playoff_start_value integer;
  playoff_spots_value integer;
  week_value integer;
  score_count integer := 0;
  matchup_count integer := 0;
  import_league_id text;
begin
  if p_season !~ '^[0-9]{4}$' or p_current_season !~ '^[0-9]{4}$'
      or p_season::integer < 2000 or p_season::integer > p_current_season::integer + 1 then
    raise exception using errcode = '22023', message = 'Invalid season import target.';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended(concat_ws(':', 'season-rollover', p_league_id), 0)) then
    raise exception using errcode = '55P03', message = 'Another season change is in progress.';
  end if;
  select * into league_row from public.leagues where id = p_league_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'League not found or archived.'; end if;
  if league_row.current_season is distinct from p_current_season
      or coalesce(league_row.platform_config, 'null'::jsonb) is distinct from coalesce(p_expected_platform, 'null'::jsonb) then
    raise exception using errcode = '40001', message = 'League changed after preview.';
  end if;
  perform 1 from public.league_seasons where league_id = p_league_id for update;
  perform 1 from public.league_members where league_id = p_league_id for update;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'manager_id', manager_id, 'manager_name', manager_name, 'team_name', team_name,
    'season', season, 'is_active', is_active, 'division', division
  ) order by id), '[]'::jsonb) into current_members from public.league_members where league_id = p_league_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'season', season, 'total_weeks', total_weeks, 'playoff_start_week', playoff_start_week,
    'playoff_spots', playoff_spots, 'divisions', divisions, 'fee_amount', fee_amount,
    'draft_food_cost', draft_food_cost, 'weekly_prize_amount', weekly_prize_amount,
    'prize_structure', prize_structure, 'archived_at', archived_at
  ) order by season), '[]'::jsonb) into current_seasons from public.league_seasons where league_id = p_league_id;
  perform 1 from public.weekly_scores where league_id = p_league_id and season = p_season for update;
  select coalesce(jsonb_agg(jsonb_build_object('week_number', week_number, 'member_id', member_id,
    'points', points, 'is_final_score', is_final_score, 'week_status', week_status) order by week_number, member_id), '[]'::jsonb)
    into current_scores from public.weekly_scores where league_id = p_league_id and season = p_season;
  if current_scores is distinct from p_expected_scores then
    raise exception using errcode = '40001', message = 'Scores changed after preview.';
  end if;
  if current_members is distinct from p_expected_members or current_seasons is distinct from p_expected_seasons then
    raise exception using errcode = '40001', message = 'Season or roster changed after preview.';
  end if;
  if exists (select 1 from public.league_seasons where league_id = p_league_id and season = p_season and archived_at is not null) then
    raise exception using errcode = '22023', message = 'Restore the archived season before importing.';
  end if;
  if jsonb_typeof(p_teams) is distinct from 'array' or jsonb_array_length(p_teams) not between 2 and 64
      or jsonb_array_length(p_teams) % 2 <> 0 or jsonb_typeof(p_weeks) is distinct from 'array'
      or jsonb_array_length(p_weeks) > 25 or jsonb_typeof(p_configuration) is distinct from 'object'
      or jsonb_typeof(p_platform_config) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Invalid season import payload.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_teams) t where
      jsonb_typeof(t->'team_id') is distinct from 'number' or (t->>'team_id')::numeric <> trunc((t->>'team_id')::numeric)
      or (t->>'team_id')::integer < 1 or coalesce(btrim(t->>'manager_name'), '') = ''
      or char_length(t->>'manager_name') > 80 or coalesce(btrim(t->>'team_name'), '') = '' or char_length(t->>'team_name') > 80)
      or (select count(distinct t->>'team_id') from jsonb_array_elements(p_teams) t) <> jsonb_array_length(p_teams)
      or (select count(distinct lower(btrim(t->>'manager_name'))) from jsonb_array_elements(p_teams) t) <> jsonb_array_length(p_teams) then
    raise exception using errcode = '22023', message = 'Players or ESPN team identities are invalid or duplicated.';
  end if;
  total_weeks_value := (p_configuration->>'total_weeks')::integer;
  playoff_start_value := (p_configuration->>'playoff_start_week')::integer;
  playoff_spots_value := (p_configuration->>'playoff_spots')::integer;
  if total_weeks_value not between 1 and 25 or playoff_start_value not between 1 and total_weeks_value
      or playoff_spots_value not between 2 and jsonb_array_length(p_teams)
      or jsonb_typeof(p_configuration->'divisions') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Invalid imported season format.';
  end if;
  if exists (select 1 from public.weekly_scores where league_id = p_league_id and season = p_season and week_number > total_weeks_value) then
    raise exception using errcode = '22023', message = 'Imported format would exclude existing scores.';
  end if;
  import_league_id := p_platform_config->>'league_id';
  if import_league_id is null or import_league_id !~ '^[0-9]{1,20}$' then
    raise exception using errcode = '22023', message = 'ESPN connection is invalid.';
  end if;
  is_new := not exists (select 1 from public.league_seasons where league_id = p_league_id and season = p_season);
  if is_new then
    if p_season::integer = p_current_season::integer + 1 then
      update public.league_seasons set is_active = false where league_id = p_league_id and is_active;
    end if;
    insert into public.league_seasons (league_id, season, fee_amount, draft_food_cost, weekly_prize_amount,
      prize_structure, divisions, total_weeks, playoff_start_week, playoff_spots, is_active)
    values (p_league_id, p_season, (p_configuration->>'fee_amount')::numeric, (p_configuration->>'draft_food_cost')::numeric,
      (p_configuration->>'weekly_prize_amount')::numeric, p_configuration->'prize_structure',
      jsonb_build_object('divisions', p_configuration->'divisions'), total_weeks_value, playoff_start_value, playoff_spots_value,
      p_season::integer = p_current_season::integer + 1);
  else
    -- Financial settings and final award decisions are app-owned and never overwritten by ESPN.
    update public.league_seasons set total_weeks = total_weeks_value, playoff_start_week = playoff_start_value,
      playoff_spots = playoff_spots_value, divisions = jsonb_build_object('divisions', p_configuration->'divisions'), updated_at = now()
    where league_id = p_league_id and season = p_season;
  end if;
  owner_ids := coalesce(p_platform_config->'espn_owner_mappings'->import_league_id, '{}'::jsonb);
  for team in select value from jsonb_array_elements(p_teams) loop
    source_manager := null;
    target_member := null;
    if team->>'source_member_id' is not null then
      select manager_id into source_manager from public.league_members
        where id = (team->>'source_member_id')::uuid and league_id = p_league_id;
      if not found or source_manager is null then
        raise exception using errcode = 'P0002', message = 'Returning player identity could not be resolved.';
      end if;
      select id into target_member from public.league_members where league_id = p_league_id and season = p_season and manager_id = source_manager;
    end if;
    if target_member = any(selected_ids) then raise exception using errcode = '22023', message = 'Multiple ESPN teams resolve to the same player.'; end if;
    if target_member is null then
      insert into public.league_members (league_id, season, manager_id, manager_name, team_name, division, is_active, payment_status)
      values (p_league_id, p_season, source_manager, team->>'manager_name', team->>'team_name', team->>'division', true, 'pending')
      returning id, manager_id into target_member, resolved_manager;
    else
      -- Do not SET manager_id, season, or payment_status: those columns fire the legacy payment-summary trigger.
      update public.league_members set manager_name = team->>'manager_name', team_name = team->>'team_name',
        division = team->>'division', is_active = true, updated_at = now() where id = target_member
      returning manager_id into resolved_manager;
    end if;
    if target_member = any(selected_ids) then raise exception using errcode = '22023', message = 'Multiple ESPN teams resolve to the same player.'; end if;
    selected_ids := array_append(selected_ids, target_member);
    team_ids := team_ids || jsonb_build_object(team->>'team_id', target_member::text);
    if nullif(team->>'owner_id', '') is not null and (select count(*) from jsonb_array_elements(p_teams) t where t->>'owner_id' = team->>'owner_id') = 1 then
      owner_ids := owner_ids || jsonb_build_object(team->>'owner_id', resolved_manager::text);
    end if;
  end loop;
  update public.league_members set is_active = false, updated_at = now()
    where league_id = p_league_id and season = p_season and is_active and not (id = any(selected_ids));
  platform_value := jsonb_set(p_platform_config, '{team_mappings}', coalesce(p_platform_config->'team_mappings', '{}'::jsonb) || jsonb_build_object(p_season, team_ids));
  platform_value := jsonb_set(platform_value, '{espn_owner_mappings}', coalesce(platform_value->'espn_owner_mappings', '{}'::jsonb) || jsonb_build_object(import_league_id, owner_ids));
  if (select count(distinct w->>'week') from jsonb_array_elements(p_weeks) w) <> jsonb_array_length(p_weeks) then
    raise exception using errcode = '22023', message = 'Duplicate imported weeks.';
  end if;
  for imported_week in select value from jsonb_array_elements(p_weeks) loop
    week_value := (imported_week->>'week')::integer;
    if week_value not between 1 and total_weeks_value or jsonb_typeof(imported_week->'scores') is distinct from 'array'
        or jsonb_typeof(imported_week->'matchups') is distinct from 'array'
        or jsonb_array_length(imported_week->'scores') <> jsonb_array_length(p_teams)
        or (select count(distinct s->>'team_id') from jsonb_array_elements(imported_week->'scores') s) <> jsonb_array_length(p_teams)
        or exists (select 1 from jsonb_array_elements(imported_week->'scores') s where not (team_ids ? (s->>'team_id'))
          or jsonb_typeof(s->'points') is distinct from 'number' or (s->>'points')::numeric not between -1000 and 1000) then
      raise exception using errcode = '22023', message = 'An imported week has incomplete or invalid scores.';
    end if;
    if exists (select 1 from jsonb_array_elements(imported_week->'matchups') m where
        not (team_ids ? (m->>'team1_id')) or not (team_ids ? (m->>'team2_id')) or m->>'team1_id' = m->>'team2_id')
        or (select count(*) from (select m->>'team1_id' id from jsonb_array_elements(imported_week->'matchups') m union all select m->>'team2_id' from jsonb_array_elements(imported_week->'matchups') m) ids)
        <> (select count(distinct id) from (select m->>'team1_id' id from jsonb_array_elements(imported_week->'matchups') m union all select m->>'team2_id' from jsonb_array_elements(imported_week->'matchups') m) ids) then
      raise exception using errcode = '22023', message = 'Imported matchups are invalid or duplicated.';
    end if;
    if not pg_try_advisory_xact_lock(hashtextextended(concat_ws(':', 'espn', p_league_id, p_season, week_value::text), 0)) then
      raise exception using errcode = '55P03', message = 'Another score import is in progress.';
    end if;
    -- Re-reading an unchanged ESPN week must not reset settled payout flags or replace score IDs.
    if (select coalesce(jsonb_agg(jsonb_build_object('member_id', member_id, 'points', points,
          'final', is_final_score, 'status', week_status, 'playoff', is_playoff_week) order by member_id), '[]'::jsonb)
        from public.weekly_scores where league_id = p_league_id and season = p_season and week_number = week_value)
      = (select jsonb_agg(jsonb_build_object('member_id', team_ids->>(s->>'team_id'), 'points', (s->>'points')::numeric,
          'final', true, 'status', 'completed', 'playoff', week_value >= playoff_start_value) order by team_ids->>(s->>'team_id'))
        from jsonb_array_elements(imported_week->'scores') s)
      and (select coalesce(jsonb_agg(jsonb_build_array(team1_member_id, team2_member_id) order by team1_member_id, team2_member_id), '[]'::jsonb)
        from public.matchups where league_id = p_league_id and season = p_season and week_number = week_value)
      = (select coalesce(jsonb_agg(jsonb_build_array(team_ids->>(m->>'team1_id'), team_ids->>(m->>'team2_id'))
          order by team_ids->>(m->>'team1_id'), team_ids->>(m->>'team2_id')), '[]'::jsonb)
        from jsonb_array_elements(imported_week->'matchups') m) then
      continue;
    end if;
    delete from public.matchups where league_id = p_league_id and season = p_season and week_number = week_value;
    delete from public.weekly_scores where league_id = p_league_id and season = p_season and week_number = week_value;
    insert into public.weekly_scores (league_id, season, week_number, member_id, points, is_final_score, is_playoff_week, week_status)
      select p_league_id, p_season, week_value, (team_ids->>(s->>'team_id'))::uuid, (s->>'points')::numeric, true, week_value >= playoff_start_value, 'completed'
      from jsonb_array_elements(imported_week->'scores') s;
    get diagnostics score_count = row_count;
    insert into public.matchups (league_id, season, week_number, team1_member_id, team2_member_id, scores_locked, week_completed_at)
      select p_league_id, p_season, week_value, (team_ids->>(m->>'team1_id'))::uuid, (team_ids->>(m->>'team2_id'))::uuid, true, now()
      from jsonb_array_elements(imported_week->'matchups') m;
    get diagnostics matchup_count = row_count;
    insert into public.import_runs (league_id, season, week_number, trigger_mode, status, score_count, matchup_count, completed_at)
      values (p_league_id, p_season, week_value, 'manual', 'succeeded', score_count, matchup_count, now());
  end loop;
  update public.leagues set platform_type = 'espn', platform_league_id = import_league_id, platform_config = platform_value,
    current_season = case when is_new and p_season::integer = p_current_season::integer + 1 then p_season else current_season end,
    last_sync_at = case when jsonb_array_length(p_weeks) > 0 then now() else last_sync_at end,
    last_sync_error = null, sync_status = case when auto_sync_enabled then 'active' else 'disabled' end, updated_at = now()
  where id = p_league_id;
  return jsonb_build_object('success', true, 'season', p_season, 'players', cardinality(selected_ids), 'weeks', jsonb_array_length(p_weeks));
end;
$$;
revoke all on function public.import_espn_season_atomically(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.import_espn_season_atomically(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
commit;
