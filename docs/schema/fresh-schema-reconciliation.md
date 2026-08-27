# Fresh schema reconciliation and rollout readiness

The database now has two explicit installation paths. Neither path has been run against the live Supabase project.

## Installation paths

### Existing production

The linked production project already is the audited deployed-v0 baseline and contains historical data plus unrelated `collections` and `items` tables. Do **not** run the bootstrap or retired `database-setup.sql` there.

After backup, application, security, and approval gates are complete, production receives only these forward migrations in filename order:

1. `202608250001_authorization_foundation.sql`
2. `202608250002_atomic_espn_imports.sql`
3. `202608250003_finance_identity_foundation.sql`
4. `202608250004_safe_archival.sql`
5. `202608260005_scoped_share_links.sql`
6. `202608260006_remove_exact_null_season_score_duplicates.sql`
7. `202608260007_normalize_completed_score_flags.sql`
8. `202608260008_normalize_active_seasons.sql`
9. `202608260009_add_core_constraints_not_valid.sql`
10. `202608260010_validate_core_constraints.sql`
11. `202608260011_atomic_season_rollover.sql`
12. `202608260012_enforce_one_active_season.sql`
13. `202608260013_atomic_manual_week_scores.sql`
14. `202608260014_retire_legacy_schedule_rpcs.sql`

The live project has no existing Supabase migration history. Before an eventual rollout, generate and review a dry-run migration plan, then use the supported Supabase migration-history reconciliation workflow appropriate to the installed CLI version. Do not improvise history entries or mark a migration applied until its effects have been verified.

### New empty project

A new database starts with `supabase/bootstrap/deployed-v0.sql`, then immediately applies migrations `001`–`014` in order. Cleanup migrations 006–008 accept the zero-candidate path on an empty database. The bootstrap refuses a non-empty public schema and intentionally excludes unrelated production tables.

The bootstrap briefly reproduces deployed-v0 grants so migration `001` can exercise the same security transition as production. It must never be used alone or exposed to application traffic before the complete forward chain succeeds.

`database-setup.sql` is retired, intentionally fails if executed, and remains only as historical evidence of the earlier schema drift.

## Reconciled lifecycle decisions

### `leagues.current_season`

This is the canonical current NFL/fantasy season start year. It remains authoritative through January playoff weeks; calendar-year rollover is not used.

### `league_seasons.is_active`

This remains a compatibility field, not the historical/archive indicator. Migration `008` locally prepares the exact historical normalization. Migration `011` moves rollover into one locked transaction that deactivates the source before inserting the active target, and migration `012` then enforces at most one active configuration per league.

Archive state is represented only by `league_seasons.archived_at`. Historical seasons may remain available without being archived. Migration `008` changes only compatibility activation flags and never archive state.

### `league_members.is_active`

This continues to mean participation in that season. Deactivation is intentionally non-destructive and preserves scores, matchups, dues, and history. It must not be merged with league/season archival state.

## Prepared cleanup/constraints and deferred decisions

Migrations 006–014 now package the three exact-count cleanups, compatible core safeguards, atomic season rollover, one-active-season uniqueness, atomic manual score replacement, playoff-flag derivation, and retirement of the unused legacy schedule writers. They remain unapplied and require the audit, backup, approval, timeout, and postcondition gates in [the cleanup/constraint rollout](cleanup-constraint-rollout.md).

The following are still deliberately excluded:

- The unallocated $40 in the 2021 prize plan.
- Normalizing four nullable historical draft/weekly-prize fields to zero.
- A global matchup-participant model outside the supported atomic import/manual-completion paths. Migration `014` removes the unused legacy writers; add a new serialized schedule boundary only if schedule editing becomes a supported feature.
- New constraints on the empty legacy `payments` table.

Each prepared cleanup still requires a fresh read-only report, exact expected row count, verified backup, reversible plan, and separate explicit production approval. Compatible constraints are staged as `NOT VALID` and validated separately.

The current aggregate findings, exact eligibility predicates, recommended decisions, and rollback gates are recorded in [the 2026-08-26 legacy cleanup candidate report](legacy-cleanup-candidates-2026-08-26.md). The compatible, cleanup-gated, design-gated, and insufficient-data safeguards are separately classified in [the 2026-08-26 core constraint compatibility report](constraint-compatibility-2026-08-26.md). The reports and prepared SQL are evidence only; none of their candidate changes are authorized or applied.

## Local verification

Run all database paths:

```sh
npm run schema:test:fresh
npm run schema:test:authorization
npm run schema:test:cleanup
```

The fresh test starts an empty disposable PostgreSQL 17 container, applies the fantasy-only baseline plus migrations `001`–`014`, verifies the data-free target schema, RLS, private ESPN fields, restricted supported RPCs, retired legacy schedule RPCs, scoped share links, direct shared-role denial, lifecycle state, active-season uniqueness, playoff derivation, and absence of unrelated tables, then removes the container.

The authorization test starts from a synthetic copy of the deployed production shape and representative data, including unrelated tables, then verifies preservation, backfills, imports, finance, archival, access boundaries, and concurrency. The cleanup test separately proves the exact 10/24/6 success path and unexpected-count rollback. None connects to Supabase or reads production credentials or rows.

## Production-readiness checklist

All items are required before requesting migration approval:

- [ ] The implementation diff is reviewed and packaged on a non-`main` branch.
- [ ] `npm test -- --runInBand`, `npm run test:integration -- --runInBand`, typecheck, lint, and production build pass from that exact commit.
- [ ] All three disposable schema commands above pass from that exact commit.
- [ ] A current production schema audit shows the expected deployed-v0 contract and no unreviewed drift.
- [ ] A current full Supabase backup/export exists, can be read, and has a documented restore owner and procedure.
- [ ] Production has independent `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `CRON_SECRET`, and privileged Supabase server key values; none use a `NEXT_PUBLIC_` name.
- [ ] The application release containing signed sessions, server-only mutations, old-schema fallbacks, and migration-ready UI is deployed before database activation.
- [ ] Token-authorized reads and commissioner routes have been verified against an isolated writable target or the disposable database; a Vercel Preview pointing at live Supabase remains non-writable and cannot validate migration `005` behavior.
- [ ] The exact migration order and migration-history reconciliation commands are generated and reviewed without execution.
- [ ] A maintenance window, observer, rollback decision point, and post-migration verification owner are named.
- [ ] The commissioner gives explicit production approval immediately before execution.
- [ ] The provider plan remains free and no branch, database, compute, or add-on with recurring cost is created.

After migration, verify direct anonymous-read denial, player-link create/use/replace/revoke and season isolation, credential denial, commissioner writes, atomic score import, stable identities, finance reconciliation, archive/restore, automatic-sync state, Security Advisor results, and historical row counts before closing the window.
