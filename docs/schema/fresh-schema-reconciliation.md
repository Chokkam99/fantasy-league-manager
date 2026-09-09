# Fresh schema reconciliation

The database has two explicit installation paths. The existing-Production path was completed on 2026-08-27; the new-empty-project path remains reproducible through the disposable PostgreSQL test suite.

## Installation paths

### Existing production

The linked production project already is the audited deployed-v0 baseline and contains historical data plus unrelated `collections` and `items` tables. Do **not** run the bootstrap or retired `database-setup.sql` there.

Production received migrations 001–015 in filename order on 2026-08-27 and migration 016 on 2026-09-02:

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
15. `202608270015_player_payout_statuses.sql`
16. `202609010016_historical_returning_members.sql`

The live project now has 16 Supabase migration-history rows. A post-migration linked dry run reports `upToDate: true`, with no pending migrations, seeds, or role changes. Future Production changes must be new forward migrations; do not edit or repair the applied history. Migration 016 replaces the existing restricted rollover function without changing its signature or any table, permits returning-player selection from all earlier league seasons, preserves stable manager identity, and validates even team counts plus playoff capacity.

### New empty project

A new database starts with `supabase/bootstrap/deployed-v0.sql`, then immediately applies migrations `001`–`016` in order. Cleanup migrations 006–008 accept the zero-candidate path on an empty database. The bootstrap refuses a non-empty public schema and intentionally excludes unrelated production tables.

The bootstrap briefly reproduces deployed-v0 grants so migration `001` can exercise the same security transition as production. It must never be used alone or exposed to application traffic before the complete forward chain succeeds.

`database-setup.sql` is retired, intentionally fails if executed, and remains only as historical evidence of the earlier schema drift.

## Reconciled lifecycle decisions

### `leagues.current_season`

This is the canonical current NFL/fantasy season start year. It remains authoritative through January playoff weeks; calendar-year rollover is not used.

### `league_seasons.is_active`

This remains a compatibility field, not the historical/archive indicator. Migration `008` performed the exact historical normalization. Migration `011` moved rollover into one locked transaction that deactivates the source before inserting the active target, and migration `012` enforces at most one active configuration per league.

Archive state is represented only by `league_seasons.archived_at`. Historical seasons may remain available without being archived. Migration `008` changes only compatibility activation flags and never archive state.

### `league_members.is_active`

This continues to mean participation in that season. Deactivation is intentionally non-destructive and preserves scores, matchups, dues, and history. It must not be merged with league/season archival state.

## Applied cleanup/constraints and deferred decisions

Migrations 006–014 applied the three exact-count cleanups, compatible core safeguards, atomic season rollover, one-active-season uniqueness, atomic manual score replacement, playoff-flag derivation, and retirement of the unused legacy schedule writers. All documented backup, count, timeout, approval, and postcondition gates passed. Migration 015 then added service-only per-player payout completion and automatic reset triggers without rewriting historical payout state. Migration 016 extended the existing atomic rollover boundary to historical league members and added roster-size validation without changing stored rows.

The following are still deliberately excluded:

- The unallocated $40 in the 2021 prize plan.
- Normalizing four nullable historical draft/weekly-prize fields to zero.
- A global matchup-participant model outside the supported atomic import/manual-completion paths. Migration `014` removes the unused legacy writers; add a new serialized schedule boundary only if schedule editing becomes a supported feature.
- New constraints on the empty legacy `payments` table.

Any future cleanup still requires a fresh read-only report, an exact expected row count, a verified backup, a reversible plan, and separate explicit Production approval. Do not use the successful 2026-08-27 rollout as standing authorization for another cleanup.

The pre-migration aggregate findings, exact eligibility predicates, and rollback gates remain recorded in [the 2026-08-26 legacy cleanup candidate report](legacy-cleanup-candidates-2026-08-26.md). The compatible, cleanup-gated, design-gated, and insufficient-data safeguards remain classified in [the 2026-08-26 core constraint compatibility report](constraint-compatibility-2026-08-26.md). Those dated reports are historical evidence; the mechanical 10/24/6 cleanup and compatible constraints were subsequently applied, while the product decisions listed above remain deliberately unresolved.

## Local verification

Run all database paths:

```sh
npm run schema:test:fresh
npm run schema:test:authorization
npm run schema:test:cleanup
```

The fresh test starts an empty disposable PostgreSQL 17 container, applies the fantasy-only baseline plus migrations `001`–`016`, verifies the data-free target schema, RLS, private ESPN fields, restricted supported RPCs, retired legacy schedule RPCs, scoped legacy links, payout completion, historical returning-player rollover, direct shared-role denial, lifecycle state, active-season uniqueness, playoff derivation, and absence of unrelated tables, then removes the container.

The authorization test starts from a synthetic copy of the deployed production shape and representative data, including unrelated tables, then verifies preservation, backfills, imports, finance, archival, access boundaries, and concurrency. The cleanup test separately proves the exact 10/24/6 success path and unexpected-count rollback. None connects to Supabase or reads production credentials or rows.

## Reusable Production-readiness checklist

The 2026-08-27 rollout completed these gates. Reuse them before requesting approval for any future Production migration:

- [ ] The implementation diff is reviewed and packaged in an exact commit.
- [ ] `npm test -- --runInBand`, `npm run test:integration --runInBand`, typecheck, lint, and production build pass from that exact commit.
- [ ] All three disposable schema commands above pass from that exact commit.
- [ ] A current Production schema audit matches the documented migration history and has no unreviewed drift.
- [ ] A current full Supabase backup/export exists, can be read, and has a documented restore owner and procedure.
- [ ] Production has independent `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `CRON_SECRET`, and privileged Supabase server key values; none use a `NEXT_PUBLIC_` name.
- [ ] When the schema change requires it, a compatibility-capable application release is deployed before database activation.
- [ ] Public-safe reads and commissioner routes are verified against an isolated writable target or the disposable database; a Vercel Preview pointing at live Supabase remains non-writable.
- [ ] The exact migration order and migration-history reconciliation commands are generated and reviewed without execution.
- [ ] A maintenance window, observer, rollback decision point, and post-migration verification owner are named.
- [ ] The commissioner gives explicit production approval immediately before execution.
- [ ] The provider plan remains free and no branch, database, compute, or add-on with recurring cost is created.

After migration, verify direct anonymous-read denial, public-safe league reads, legacy-link isolation if affected, credential denial, commissioner writes, atomic score import, stable identities, finance reconciliation, payout completion, archive/restore, automatic-sync state, Security Advisor results, and historical row counts before closing the window.


## September 8 production extension

Migration `202609080018_espn_season_import.sql` adds the restricted atomic ESPN season import and was applied with explicit approval on September 8. The preflight audit found migration `017` already applied. Production now has all 18 migration versions and no pending migration; pre/post row fingerprints match for all 15 inspected public tables. A fresh public-schema/data backup was restored successfully in disposable PostgreSQL 17 before applying 018. The fresh-schema script exercises migrations 001–018 and synthetic season import assertions. See [the release checkpoint](../deployment/production-release-2026-09-08.md) and [ESPN-first workflow](../espn-first-season-import-2026-09-08.md).

## Money settings follow-up (September 9 UTC)

Migration `019` adds the restricted atomic season-money editor and has been applied to production after a fresh verified backup restore. All 19 versions are present, the dry run is up to date, and row fingerprints remain unchanged across the 15 inspected public tables. The fresh-schema test now includes 001–019 and fee/payout preservation assertions. See [the money-settings release checkpoint](../deployment/money-settings-release-2026-09-09.md).
