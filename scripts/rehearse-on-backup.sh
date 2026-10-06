#!/bin/sh
# Restore a production backup (from `npm run db:backup`) into a disposable
# PostgreSQL 17 container with no published port, then apply each given SQL
# file in order: forward migrations first, then their assertion files.
#
#   sh scripts/rehearse-on-backup.sh data/rollout-backups/<backup> \
#     supabase/migrations/<new>.sql test/integration/<new>.assertions.sql
#
# Nothing here connects to production; the container is removed on exit.

set -eu

if [ "$#" -lt 1 ] || [ ! -f "$1/schema.sql" ] || [ ! -f "$1/data.sql" ]; then
  echo 'Usage: rehearse-on-backup.sh <backup-directory with schema.sql and data.sql> [sql-file ...]' >&2
  exit 1
fi

backup_directory="$1"
shift

postgres_image='public.ecr.aws/supabase/postgres:17.6.1.158'
container_name="fantasy-backup-rehearsal-$$"
database_name='fantasy_backup_rehearsal'
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
  --env POSTGRES_DB=postgres \
  --env POSTGRES_PASSWORD='disposable-local-test-only' \
  "$postgres_image" >/dev/null
container_started='true'

attempt=0
consecutive_ready_checks=0
while [ "$consecutive_ready_checks" -lt 3 ]; do
  attempt="$((attempt + 1))"
  if [ "$attempt" -ge 240 ]; then
    echo 'Disposable rehearsal database did not become ready.' >&2
    exit 1
  fi
  if podman exec "$container_name" \
    psql -X -U "$database_user" -d postgres -c 'select 1;' >/dev/null 2>&1; then
    consecutive_ready_checks="$((consecutive_ready_checks + 1))"
  else
    consecutive_ready_checks=0
  fi
  sleep 0.5
done

podman exec "$container_name" createdb -U "$database_user" -T template0 "$database_name"
podman exec "$container_name" \
  psql -X -q -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" \
  -c 'drop schema public cascade; create schema extensions; create extension "uuid-ossp" with schema extensions;' \
  >/dev/null
podman exec -i "$container_name" \
  psql -X -q -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" -f - \
  < "$backup_directory/schema.sql" >/dev/null
podman exec \
  --env 'PGOPTIONS=-c session_replication_role=replica' \
  -i "$container_name" \
  psql -X -q -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" -f - \
  < "$backup_directory/data.sql" >/dev/null
echo "Restored $backup_directory."

for sql_file in "$@"; do
  podman exec -i "$container_name" \
    psql -X -q -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" -f - \
    < "$sql_file" >/dev/null
  echo "Applied $sql_file."
done

echo 'Rehearsal passed on the restored backup.'
