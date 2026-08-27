#!/bin/sh

set -eu

output_file='src/lib/database.types.ts'
temporary_file="$(mktemp "${TMPDIR:-/tmp}/fantasy-league-manager.database.types.XXXXXX")"

cleanup() {
  rm -f "$temporary_file"
}
trap cleanup EXIT HUP INT TERM

supabase gen types typescript --linked --schema public > "$temporary_file"

if [ ! -s "$temporary_file" ]; then
  echo 'Supabase generated an empty type contract; the existing file was preserved.' >&2
  exit 1
fi

mv "$temporary_file" "$output_file"
trap - EXIT HUP INT TERM

echo "Generated $output_file from the linked public schema."
