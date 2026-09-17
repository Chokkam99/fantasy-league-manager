# September 16 auto-sync repair

Couchball and Gridiron both failed their scheduled 2026 Week 1 imports with `relation "league_seasons" does not exist`. The table existed. The production `set_playoff_week_trigger` called the legacy `set_playoff_week_flag()` function, whose unqualified table lookup inherited the atomic import function's empty search path.

Migration 013 had already installed the correct schema-qualified `derive_weekly_score_playoff_flag` trigger, but retained the older duplicate. Migration `202609160020_retire_legacy_playoff_trigger.sql` checks that the replacement is enabled, then drops only the obsolete trigger. It does not weaken the import function's restricted search path or rewrite application records.

## Validation and production execution

- Added the actual legacy trigger behavior to a regression fixture. Before 020, the test reproduces the exact production error and verifies atomic rollback. After 020, scheduled Week 1 and Week 12 imports succeed, follow a configured Week 12 playoff boundary, clear sync errors, and support correction retries without duplicate scores.
- Fresh PostgreSQL 17 bootstrap plus migrations 001–020 and all fresh-schema assertions pass. All 476 unit/component/API tests also pass.
- A fresh public-schema/data backup was restored successfully into disposable PostgreSQL 17. The same before/after import regression passed on the restored production schema, including its real trigger definitions.
- Protected backup: `data/rollout-backups/2026-09-16-pre-020/`. Schema SHA-256: `0a26aaa0071c4498e5b5919dddf80d6811265ede9f1af4d9433edad5dbd00bf2`; data SHA-256: `74b90808fa0e0023dbb56e7d45c64a01b99b9918349363d5d2525ca6cb4cf858`. The backup excludes provider-managed schemas and cluster roles.
- Migration SHA-256: `fca1734edb15e069c9b48e3122b98a26b91fb7e7f8971f22c8350c42b60fb5e7`. The dry run proposed only 020; the authorized push applied it and the postflight dry run is up to date. All 15 inspected public tables retained identical row fingerprints immediately after the migration.

## Recovery of the failed imports

Before retrying, both affected 2026 seasons had zero scores and no completed player/prize payouts. Retried only their completed Week 1 using the existing ESPN service, team mapping, completion validation, and atomic import RPC with `scheduled` mode:

- Couchball: 12 scores and 6 matchups; run `6102d995-c2a2-4f6a-9a67-1083b32e36ab` succeeded.
- Gridiron: 8 scores and 4 matchups; run `193f2b5f-d5f6-4af7-a61b-d14ae4a24ff0` succeeded.

Both now have `sync_status=active`, a refreshed `last_sync_at`, and no `last_sync_error`. Previous failed runs remain in the audit history. Fingerprints for the 11 non-import tables, including dues, rosters, season settings, awards, and payouts, remain unchanged after retry. Cousins remains disabled and was not imported.

The deployed scheduler secret is non-exportable, so the bounded retry used the existing protected database connection and the application import service rather than changing credentials. The temporary environment export was removed. The repair addresses the shared database persistence path; the next automatic HTTP cron invocation has not yet occurred.

Recovery, if needed, should use a reviewed forward migration. Re-enabling the obsolete trigger would reintroduce this failure. No rollback was needed.
