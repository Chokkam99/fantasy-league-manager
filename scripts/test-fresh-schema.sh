#!/bin/sh

set -eu

if ! command -v podman >/dev/null 2>&1; then
  echo 'Podman is required for the PostgreSQL 17 fresh-schema test.' >&2
  exit 1
fi

postgres_image='public.ecr.aws/supabase/postgres:17.6.1.158'
container_name="fantasy-league-fresh-schema-test-$$"
database_name='fantasy_league_fresh_schema_test'
guard_database_name='fantasy_league_fresh_schema_guard_test'
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

podman exec "$container_name" \
  createdb -U "$database_user" "$guard_database_name"
podman exec "$container_name" \
  psql -X -v ON_ERROR_STOP=1 -U "$database_user" -d "$guard_database_name" \
  -c 'create table public.preexisting_table (id integer primary key);' \
  >/dev/null
if podman exec -i "$container_name" \
  psql -X -v ON_ERROR_STOP=1 -U "$database_user" -d "$guard_database_name" -f - \
  < supabase/bootstrap/deployed-v0.sql >/dev/null 2>&1; then
  echo 'Expected the fresh bootstrap to reject a non-empty public schema.' >&2
  exit 1
fi

run_sql_file supabase/bootstrap/deployed-v0.sql >/dev/null
run_sql_file supabase/migrations/202608250001_authorization_foundation.sql >/dev/null
run_sql_file supabase/migrations/202608250002_atomic_espn_imports.sql >/dev/null
run_sql_file supabase/migrations/202608250003_finance_identity_foundation.sql >/dev/null
run_sql_file supabase/migrations/202608250004_safe_archival.sql >/dev/null
run_sql_file supabase/migrations/202608260005_scoped_share_links.sql >/dev/null
run_sql_file supabase/migrations/202608260006_remove_exact_null_season_score_duplicates.sql >/dev/null
run_sql_file supabase/migrations/202608260007_normalize_completed_score_flags.sql >/dev/null
run_sql_file supabase/migrations/202608260008_normalize_active_seasons.sql >/dev/null
run_sql_file supabase/migrations/202608260009_add_core_constraints_not_valid.sql >/dev/null
run_sql_file supabase/migrations/202608260010_validate_core_constraints.sql >/dev/null
run_sql_file supabase/migrations/202608260011_atomic_season_rollover.sql >/dev/null
run_sql_file supabase/migrations/202608260012_enforce_one_active_season.sql >/dev/null
run_sql_file supabase/migrations/202608260013_atomic_manual_week_scores.sql >/dev/null
run_sql_file supabase/migrations/202608260014_retire_legacy_schedule_rpcs.sql >/dev/null
run_sql_file supabase/migrations/202608270015_player_payout_statuses.sql >/dev/null
run_sql_file test/integration/fresh-schema.assertions.sql >/dev/null
run_sql_file test/integration/scoped-sharing.assertions.sql >/dev/null
run_sql_file test/integration/player-payout-statuses.assertions.sql >/dev/null

echo 'Fresh fantasy-only schema passed the deployed-v0 plus migrations 001-015 PostgreSQL 17 checks, including player payout tracking.'
