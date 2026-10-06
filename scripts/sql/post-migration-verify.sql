\pset tuples_only on
\pset format unaligned

begin transaction read only;

select jsonb_pretty(
  jsonb_build_object(
    'counts', jsonb_build_object(
      'leagues', (select count(*) from public.leagues),
      'seasons', (select count(*) from public.league_seasons),
      'members', (select count(*) from public.league_members),
      'scores', (select count(*) from public.weekly_scores),
      'matchups', (select count(*) from public.matchups),
      'legacy_payments', (select count(*) from public.payments),
      'managers', (select count(*) from public.managers),
      'season_payments', (select count(*) from public.season_payments),
      'prize_awards', (select count(*) from public.prize_awards),
      'prize_payouts', (select count(*) from public.prize_payouts),
      'player_payout_statuses', (select count(*) from public.player_payout_statuses),
      'share_links', (select count(*) from public.league_share_links),
      'import_runs', (select count(*) from public.import_runs)
    ),
    'cleanup_postconditions', jsonb_build_object(
      'null_season_scores', (
        select count(*) from public.weekly_scores where season is null
      ),
      'completed_not_final', (
        select count(*)
        from public.weekly_scores
        where week_status = 'completed' and not is_final_score
      ),
      'historical_active_seasons', (
        select count(*)
        from public.league_seasons seasons
        join public.leagues leagues on leagues.id = seasons.league_id
        where seasons.is_active and seasons.season <> leagues.current_season
      ),
      'current_season_not_active', (
        select count(*)
        from public.league_seasons seasons
        join public.leagues leagues on leagues.id = seasons.league_id
        where seasons.season = leagues.current_season and not seasons.is_active
      ),
      'members_missing_manager', (
        select count(*) from public.league_members where manager_id is null
      )
    ),
    'authorization', jsonb_build_object(
      'fantasy_tables_without_rls', (
        select count(*)
        from pg_class relations
        join pg_namespace schemas on schemas.oid = relations.relnamespace
        where schemas.nspname = 'public'
          and relations.relname = any(array[
            'leagues', 'league_seasons', 'league_members', 'weekly_scores',
            'matchups', 'payments', 'managers', 'season_payments',
            'prize_awards', 'prize_payouts', 'player_payout_statuses',
            'import_runs', 'league_share_links'
          ])
          and not relations.relrowsecurity
      ),
      'shared_role_table_privileges', (
        select count(*)
        from (values ('anon'), ('authenticated')) as roles(role_name)
        cross join (values
          ('leagues'), ('league_seasons'), ('league_members'), ('weekly_scores'),
          ('matchups'), ('payments'), ('managers'), ('season_payments'),
          ('prize_awards'), ('prize_payouts'), ('player_payout_statuses'),
          ('import_runs'), ('league_share_links')
        ) as relations(relation_name)
        where has_table_privilege(
          roles.role_name,
          format('public.%I', relations.relation_name),
          'SELECT,INSERT,UPDATE,DELETE'
        )
      ),
      'legacy_schedule_functions_present',
        (to_regprocedure('public.generate_round_robin_schedule(uuid,character varying,integer)') is not null)::integer
        + (to_regprocedure('public.insert_season_matchups(uuid,character varying,jsonb)') is not null)::integer
        + (to_regprocedure('public.recalculate_matchup_winners(uuid,character varying)') is not null)::integer,
      'supported_score_functions_missing',
        (to_regprocedure('public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)') is null)::integer
        + (to_regprocedure('public.mutate_manual_week_atomically(text,text,text,integer,jsonb)') is null)::integer,
      'anon_supported_score_function_privileges',
        has_function_privilege(
          'anon',
          'public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)',
          'EXECUTE'
        )::integer
        + has_function_privilege(
          'anon',
          'public.mutate_manual_week_atomically(text,text,text,integer,jsonb)',
          'EXECUTE'
        )::integer,
      'matchup_view_security_invoker', coalesce((
        select 'security_invoker=true' = any(reloptions)
        from pg_class relations
        join pg_namespace schemas on schemas.oid = relations.relnamespace
        where schemas.nspname = 'public'
          and relations.relname = 'matchup_results_with_scores'
      ), false),
      'plaintext_share_token_columns', (
        select count(*)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'league_share_links'
          and column_name in ('token', 'raw_token', 'share_token')
      ),
      'player_payout_rpc_missing',
        (to_regprocedure('public.set_player_payout_status(text,text,uuid,text)') is null)::integer,
      'anon_player_payout_rpc_privilege', coalesce(
        has_function_privilege(
          'anon',
          'public.set_player_payout_status(text,text,uuid,text)',
          'EXECUTE'
        )::integer,
        0
      ),
      'player_payout_reset_triggers', (
        select count(*)
        from pg_trigger
        where not tgisinternal
          and tgname in (
            'reset_player_payout_statuses_for_score',
            'reset_player_payout_statuses_for_award'
          )
      ),
      'rollover_rpc_missing',
        (to_regprocedure(
          'public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)'
        ) is null)::integer,
      'anon_rollover_rpc_privilege', coalesce(
        has_function_privilege(
          'anon',
          'public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)',
          'EXECUTE'
        )::integer,
        0
      ),
      'rollover_accepts_historical_members', coalesce((
        select position(
          'source_member.season < p_target_season'
          in pg_get_functiondef(
            'public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)'::regprocedure
          )
        ) > 0
      ), false),
      'reactivation_rpc_missing',
        (to_regprocedure(
          'public.reactivate_league_member_atomically(text,text,uuid,text)'
        ) is null)::integer,
      'anon_reactivation_rpc_privilege', coalesce(
        has_function_privilege(
          'anon',
          'public.reactivate_league_member_atomically(text,text,uuid,text)',
          'EXECUTE'
        )::integer,
        0
      ),
      'unchanged_week_skips_missing',
        (position('Re-importing an unchanged week' in pg_get_functiondef(
          'public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)'::regprocedure
        )) = 0)::integer
        + (position('Saving a week with unchanged scores' in pg_get_functiondef(
          'public.mutate_manual_week_atomically(text,text,text,integer,jsonb)'::regprocedure
        )) = 0)::integer
    ),
    'activation_state', jsonb_build_object(
      'automatic_sync_enabled_leagues', (
        select count(*) from public.leagues where auto_sync_enabled
      )
    )
  )
);

rollback;
