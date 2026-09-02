#!/bin/sh

set -eu

if ! command -v podman >/dev/null 2>&1; then
  echo 'Podman is required for the PostgreSQL 17 authorization test.' >&2
  exit 1
fi

postgres_image='public.ecr.aws/supabase/postgres:17.6.1.158'
container_name="fantasy-league-auth-test-$$"
database_name='fantasy_league_authorization_test'
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

run_sql_command() {
  podman exec "$container_name" \
    psql -X -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" -c "$1"
}

run_sql_file test/fixtures/deployed-v0-schema.sql >/dev/null
run_sql_file test/fixtures/deployed-v0-data.sql >/dev/null
run_sql_file supabase/migrations/202608250001_authorization_foundation.sql >/dev/null
run_sql_file supabase/migrations/202608250002_atomic_espn_imports.sql >/dev/null
run_sql_file supabase/migrations/202608250003_finance_identity_foundation.sql >/dev/null
run_sql_file supabase/migrations/202608250004_safe_archival.sql >/dev/null
run_sql_file test/integration/finance-identity.assertions.sql >/dev/null
run_sql_file test/integration/safe-archival.assertions.sql >/dev/null
run_sql_file test/integration/authorization-foundation.assertions.sql >/dev/null
run_sql_file test/integration/atomic-import.assertions.sql >/dev/null
run_sql_file supabase/migrations/202608260005_scoped_share_links.sql >/dev/null
run_sql_file test/integration/scoped-sharing.assertions.sql >/dev/null
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
run_sql_file supabase/migrations/202609010016_historical_returning_members.sql >/dev/null
run_sql_file test/integration/core-constraints.assertions.sql >/dev/null
run_sql_file test/integration/atomic-rollover.assertions.sql >/dev/null
run_sql_file test/integration/atomic-manual-week.assertions.sql >/dev/null
run_sql_file test/integration/legacy-schedule-retirement.assertions.sql >/dev/null
run_sql_file test/integration/player-payout-statuses.assertions.sql >/dev/null

expect_denied() {
  checked_role="$1"
  description="$2"
  statement="$3"

  if run_sql_command "set role $checked_role; $statement" >/dev/null 2>&1; then
    echo "Expected $checked_role denial: $description" >&2
    exit 1
  fi
}

expect_denied anon 'credential-column read' \
  'select platform_config from public.leagues;'
expect_denied anon 'league insert' \
  "insert into public.leagues (name) values ('Denied League');"
expect_denied anon 'score update' \
  'update public.weekly_scores set points = 0;'
expect_denied anon 'payment read' \
  'select * from public.payments;'
expect_denied authenticated 'credential-column read' \
  'select espn_s2 from public.leagues;'
expect_denied authenticated 'league update' \
  "update public.leagues set name = 'Denied' where id = 'fixture-league';"
expect_denied authenticated 'payment read' \
  'select * from public.payments;'

podman exec "$container_name" \
  psql -X -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" \
  -c "begin; select pg_advisory_xact_lock(hashtextextended(concat_ws(':', 'espn', 'fixture-league', '2026', '4'), 0)); select pg_sleep(2); commit;" \
  >/dev/null &
lock_holder_pid="$!"
sleep 0.5
lock_response="$(run_sql_file test/integration/atomic-import-lock-call.sql)"
wait "$lock_holder_pid"

case "$lock_response" in
  *IMPORT_LOCKED*) ;;
  *)
    echo 'Expected a concurrent ESPN import to return IMPORT_LOCKED.' >&2
    exit 1
    ;;
esac

podman exec "$container_name" \
  psql -X -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" \
  -c "begin; select pg_advisory_xact_lock(hashtextextended(concat_ws(':', 'season-rollover', 'rollover-lock-league'), 0)); select pg_sleep(2); commit;" \
  >/dev/null &
rollover_lock_holder_pid="$!"
sleep 0.5
rollover_lock_response="$(run_sql_file test/integration/atomic-rollover-lock-call.sql)"
wait "$rollover_lock_holder_pid"

case "$rollover_lock_response" in
  *ROLLOVER_LOCKED*) ;;
  *)
    echo 'Expected a concurrent season rollover to return ROLLOVER_LOCKED.' >&2
    exit 1
    ;;
esac

podman exec "$container_name" \
  psql -X -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" \
  -c "begin; select pg_advisory_xact_lock(hashtextextended(concat_ws(':', 'espn', 'manual-week-lock-fixture', '2026', '4'), 0)); select pg_sleep(2); commit;" \
  >/dev/null &
manual_week_lock_holder_pid="$!"
sleep 0.5
manual_week_lock_response="$(run_sql_file test/integration/atomic-manual-week-lock-call.sql)"
wait "$manual_week_lock_holder_pid"

case "$manual_week_lock_response" in
  *MANUAL_WEEK_LOCKED*) ;;
  *)
    echo 'Expected a concurrent manual score write to share the ESPN week lock.' >&2
    exit 1
    ;;
esac

echo 'Authorization, import, identity, finance, archival, scoped sharing, player payout tracking, cleanup, constraints, historical-player rollover, manual scores, and legacy schedule retirement passed all disposable PostgreSQL 17 checks.'
