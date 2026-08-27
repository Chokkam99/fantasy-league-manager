#!/bin/sh

set -eu

if ! command -v podman >/dev/null 2>&1; then
  echo 'Podman is required for the PostgreSQL 17 cleanup/constraint test.' >&2
  exit 1
fi

postgres_image='public.ecr.aws/supabase/postgres:17.6.1.158'
container_name="fantasy-league-cleanup-test-$$"
database_name='fantasy_league_cleanup_test'
guard_database_name='fantasy_league_cleanup_guard_test'
database_user='supabase_admin'
container_started='false'

cleanup() {
  if [ "$container_started" = 'true' ]; then
    podman rm --force "$container_name" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT HUP INT TERM

podman run \
  --detach \
  --name "$container_name" \
  --rm \
  --env POSTGRES_DB="$database_name" \
  --env POSTGRES_PASSWORD='disposable-local-test-only' \
  "$postgres_image" >/dev/null
container_started='true'

attempt=0
consecutive_ready_checks=0
while [ "$consecutive_ready_checks" -lt 3 ]; do
  attempt="$((attempt + 1))"
  if [ "$attempt" -ge 120 ]; then
    echo 'Disposable PostgreSQL 17 did not become ready.' >&2
    podman logs "$container_name" >&2
    exit 1
  fi

  if podman exec "$container_name" \
    psql -X -U "$database_user" -d "$database_name" -c 'select 1;' \
    >/dev/null 2>&1; then
    consecutive_ready_checks="$((consecutive_ready_checks + 1))"
  else
    consecutive_ready_checks=0
  fi

  sleep 0.5
done

run_sql_file() {
  podman exec -i "$container_name" \
    psql -X -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" -f - \
    < "$1"
}

run_sql_file_in_database() {
  checked_database="$1"
  checked_file="$2"
  podman exec -i "$container_name" \
    psql -X -v ON_ERROR_STOP=1 -U "$database_user" -d "$checked_database" -f - \
    < "$checked_file"
}

run_guard_command() {
  podman exec "$container_name" \
    psql -X -v ON_ERROR_STOP=1 -U "$database_user" -d "$guard_database_name" -c "$1"
}

run_sql_file test/fixtures/deployed-v0-schema.sql >/dev/null
run_sql_file test/fixtures/deployed-v0-data.sql >/dev/null
run_sql_file supabase/migrations/202608250001_authorization_foundation.sql >/dev/null
run_sql_file supabase/migrations/202608250002_atomic_espn_imports.sql >/dev/null
run_sql_file supabase/migrations/202608250003_finance_identity_foundation.sql >/dev/null
run_sql_file supabase/migrations/202608250004_safe_archival.sql >/dev/null
run_sql_file supabase/migrations/202608260005_scoped_share_links.sql >/dev/null
run_sql_file test/fixtures/legacy-cleanup-candidates.sql >/dev/null
run_sql_file supabase/migrations/202608260006_remove_exact_null_season_score_duplicates.sql >/dev/null
run_sql_file supabase/migrations/202608260007_normalize_completed_score_flags.sql >/dev/null
run_sql_file supabase/migrations/202608260008_normalize_active_seasons.sql >/dev/null
run_sql_file supabase/migrations/202608260009_add_core_constraints_not_valid.sql >/dev/null
run_sql_file supabase/migrations/202608260010_validate_core_constraints.sql >/dev/null
run_sql_file supabase/migrations/202608260011_atomic_season_rollover.sql >/dev/null
run_sql_file supabase/migrations/202608260012_enforce_one_active_season.sql >/dev/null
run_sql_file supabase/migrations/202608260013_atomic_manual_week_scores.sql >/dev/null
run_sql_file supabase/migrations/202608260014_retire_legacy_schedule_rpcs.sql >/dev/null
run_sql_file test/integration/legacy-cleanup.assertions.sql >/dev/null
run_sql_file test/integration/core-constraints.assertions.sql >/dev/null
run_sql_file test/integration/legacy-schedule-retirement.assertions.sql >/dev/null

# Prove that unexpected nonzero counts abort and preserve their candidate rows.
podman exec "$container_name" createdb -U "$database_user" "$guard_database_name"
run_sql_file_in_database "$guard_database_name" test/fixtures/deployed-v0-schema.sql >/dev/null
run_sql_file_in_database "$guard_database_name" test/fixtures/deployed-v0-data.sql >/dev/null
run_sql_file_in_database "$guard_database_name" supabase/migrations/202608250001_authorization_foundation.sql >/dev/null
run_sql_file_in_database "$guard_database_name" supabase/migrations/202608250002_atomic_espn_imports.sql >/dev/null
run_sql_file_in_database "$guard_database_name" supabase/migrations/202608250003_finance_identity_foundation.sql >/dev/null
run_sql_file_in_database "$guard_database_name" supabase/migrations/202608250004_safe_archival.sql >/dev/null
run_sql_file_in_database "$guard_database_name" supabase/migrations/202608260005_scoped_share_links.sql >/dev/null

run_guard_command "insert into public.weekly_scores (id, league_id, member_id, week_number, season, points, is_final_score, is_playoff_week, week_status) values ('70000000-0000-4000-8000-000000000001', 'fixture-league', '00000000-0000-4000-8000-000000000011', 1, null, 121.5, true, false, 'completed');" >/dev/null
if run_sql_file_in_database "$guard_database_name" supabase/migrations/202608260006_remove_exact_null_season_score_duplicates.sql >/dev/null 2>&1; then
  echo 'Expected the null-season cleanup to reject an unexpected count.' >&2
  exit 1
fi
run_guard_command "select 1 / count(*) from public.weekly_scores where id = '70000000-0000-4000-8000-000000000001';" >/dev/null

run_guard_command "update public.weekly_scores set is_final_score = false where id = '00000000-0000-4000-8000-000000000021';" >/dev/null
if run_sql_file_in_database "$guard_database_name" supabase/migrations/202608260007_normalize_completed_score_flags.sql >/dev/null 2>&1; then
  echo 'Expected the lifecycle cleanup to reject an unexpected count.' >&2
  exit 1
fi
run_guard_command "select 1 / count(*) from public.weekly_scores where id = '00000000-0000-4000-8000-000000000021' and not is_final_score;" >/dev/null

run_guard_command "update public.league_seasons set is_active = true where league_id = 'fixture-league' and season = '2025';" >/dev/null
if run_sql_file_in_database "$guard_database_name" supabase/migrations/202608260008_normalize_active_seasons.sql >/dev/null 2>&1; then
  echo 'Expected the active-season cleanup to reject an unexpected count.' >&2
  exit 1
fi
run_guard_command "select 1 / count(*) from public.league_seasons where league_id = 'fixture-league' and season = '2025' and is_active;" >/dev/null

echo 'Legacy cleanup and core constraints passed all disposable PostgreSQL 17 checks.'
