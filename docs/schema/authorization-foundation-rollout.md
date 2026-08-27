# Authorization and atomic-import rollout

The dated packaging, backup, environment, immutable-hash, and exact-command checkpoint is [production rollout — 2026-08-26](../deployment/production-rollout-2026-08-26.md). That document is preparation evidence only and does not authorize deployment or migration.

Migrations `001`–`014` were applied to Production on 2026-08-27 after the documented backup, audit, dry-run, deployment, and explicit approval gates. See [the Production migration checkpoint](../deployment/production-migration-2026-08-27.md) for execution and post-migration evidence. The first five close anonymous access, add locked atomic ESPN imports, stable identity/finance, reversible archive state, and scoped player links. Migrations 006–010 package separately gated legacy cleanup and compatible core safeguards. Migrations 011–012 add locked atomic season rollover and enforce one active season configuration. Migration 013 adds locked manual score replacement and playoff-flag derivation. Migration 014 retires three unused, broken/destructive legacy schedule RPCs after verifying both supported atomic write boundaries exist; see [cleanup and constraint rollout](cleanup-constraint-rollout.md).

## Disposable PostgreSQL verification

Run `npm run schema:test:authorization` before preview or production rollout. The command starts an isolated Supabase PostgreSQL 17 container in the existing Podman machine, loads a synthetic deployed-`v0` schema and data set, applies all migrations in order, runs the access/import/finance checks, and removes the container. It publishes no host port and does not read the linked Supabase project or any production row or credential.

Also run `npm run schema:test:fresh` and `npm run schema:test:cleanup`. The former validates the empty baseline plus migrations `001`–`014`; the latter proves the exact cleanup success and rollback gates. See [fresh schema reconciliation](fresh-schema-reconciliation.md) for the installation paths and production-readiness checklist.

The test requires Podman and the `public.ecr.aws/supabase/postgres:17.6.1.158` image. Podman may download that image if it is not already present. A running Podman machine is required on macOS.

The checks cover:

- Safe league, season, member, score, matchup, and calculated-view reads before the scoped-sharing migration.
- Denial of credential columns, payment rows, table mutations, and all legacy public functions for both shared roles.
- Removal of all direct `anon` and `authenticated` fantasy-data reads after migration `005`.
- Active token rotation/revocation, digest-only storage, season isolation, and service-role-only share-link operations.
- `security_invoker` behavior for `matchup_results_with_scores`.
- `service_role` insert, update, and delete access, including existing timestamp-trigger behavior.
- Preservation of the unrelated `collections` and `items` authorization state.
- Private, service-role-only import-run history and RPC execution.
- Exact-week atomic replacement, repeatable correction imports without duplicates, rollback on invalid partial payloads, and durable failed-run records.
- A concurrent same-league/season/week import returning `IMPORT_LOCKED` without modifying data.
- Distinct `scheduled` and `scheduled_correction` run labels for the primary week and the one-week bounded correction lookback.
- Stable manager reuse across seasons with different team names while preserving every existing season-team ID.
- Exact-cent dues backfill, rare partial payments, normalized prize awards, saved-recipient payout backfill, finance privacy, and cross-league reference rejection.
- Reversible league and historical-season archive/restore behavior, active-season protection, preserved members and scores, shared archive-state reads, and service-role-only archive mutations.
- Exact-count legacy cleanup success/abort behavior, validated core checks and scope foreign keys, audited `NOT NULL` promotion, and reversed-pair matchup uniqueness.
- Atomic season creation/member reset/current-season activation with rollback on stale members, contention rejection, and one-active-season uniqueness.
- Atomic exact-set manual score replacement/clearing, stale-score removal, matchup completion reopening, playoff derivation, double-booked schedule rejection, and ESPN-lock contention.
- Exact-signature retirement of the three unused legacy schedule writers while preserving both supported atomic RPCs and the matchup/score data model.

The complete chain passed locally against PostgreSQL 17 on 2026-08-26. It validates the prepared migrations, not production deployment. Supabase Security Advisor must still be rerun against preview after applying the migration there and against production after an explicitly approved production rollout.

## Required deployment order

1. Create a current Supabase backup/export and verify that it can be read.
2. Generate a versioned scrypt `ADMIN_PASSWORD_HASH` with `npm run admin:hash-password` and install it as a protected server value. Do not enable `ALLOW_LEGACY_ADMIN_PASSWORD_HASH` in the target release; see `docs/security/commissioner-authentication.md`.
3. Configure `ADMIN_SESSION_SECRET` with a separate high-entropy value of at least 32 characters in local, preview, and production server environments. Generate one with `openssl rand -base64 32`; never reuse `ADMIN_PASSWORD_HASH` or expose it with a `NEXT_PUBLIC_` prefix. Existing legacy cookies become invalid and commissioners must sign in again.
4. Configure `SUPABASE_SECRET_KEY` (preferred) or `SUPABASE_SERVICE_ROLE_KEY` in local, preview, and production server environments. Never use a `NEXT_PUBLIC_` prefix.
5. Prepare the application version that uses modern password verification, signed commissioner sessions, `createServerSupabaseClient()` for every protected read and mutation, explicit resource-specific player payloads, and graceful pre-migration fallbacks. Score sync remains unavailable until migration `202608250002` is active; player links remain unavailable until migration `202608260005` is active.
6. Verify malformed/legacy password verifiers fail closed; tampered, expired, and legacy cookies and unauthenticated mutation routes return unauthorized; authenticated preview/read routes work; and the scheduled route returns `401` without its bearer secret.
7. Run `npm run schema:test:authorization`, `npm run schema:test:fresh`, and `npm run schema:test:cleanup` against disposable PostgreSQL 17 and retain the successful output.
8. Apply all migrations in filename order to a disposable preview environment and run player-link create/use/replace/revoke, commissioner-route, correction re-import, rollback, finance-backfill, and cross-league isolation checks there.
9. Review Supabase Security Advisor output. The six fantasy tables should no longer report RLS-disabled errors; unrelated `collections` and `items` remain out of scope.
10. Request explicit production approval, then apply all migrations in filename order in a short maintenance window. Verify the atomic import RPC and identity/finance reconciliation before enabling automatic sync or commissioner finance edits.

## Post-migration verification

- Anonymous and authenticated direct `SELECT` fail on all fantasy tables and the calculated matchup view.
- Signed commissioner requests load league data through the protected server routes.
- A valid player token loads only its exact league and season; another season, a malformed token, a replaced token, and a revoked token fail.
- Share-link storage contains only a token digest and non-secret prefix, never the raw URL token.
- Anonymous `INSERT`, `UPDATE`, and `DELETE` fail on all six fantasy tables.
- The three legacy schedule RPC signatures are absent; anonymous execution of supported import/mutation RPCs fails.
- Commissioner server routes still perform authorized member, payment-state, manual-score, automation, import, and rollover writes.
- Cron can read configured leagues and record sync results only with the correct bearer secret.
- A valid ESPN import writes all scores, matchups, league health, and its succeeded run record together.
- A corrected re-import replaces that exact week without duplicates; a failed import preserves the prior week data and records a failed run.
- A concurrent same-week import is skipped with `IMPORT_LOCKED` rather than marking the league unhealthy.
- The scheduled correction week runs before the primary week; a correction warning does not prevent the primary import, and the primary result is the final visible league-health write.
- Existing member rows retain their IDs and gain stable manager links; renamed teams in later seasons reuse the manager identity.
- Dues details remain commissioner-private, while token-authorized players can read award allocation and payout status without payout notes.
- Archived leagues and seasons remain readable; commissioner mutations are rejected until restored.
- The current season cannot be archived. Archiving a league disables automatic score sync, and restoring it does not silently re-enable automation.
- Starting a season commits configuration, members, finance resets, activation, and automation shutdown together; a competing rollover is rejected without partial rows.
- Manual week saves replace exactly the active roster's scores, derive playoff state, preserve and complete valid schedules, and cannot race an ESPN import for the same week.

## Emergency rollback

Prefer rolling the application deployment back first. If database access must be restored during an incident, use the verified pre-migration schema/grant export rather than improvising grants. Restoring anonymous writes recreates the original security vulnerability and must be temporary, logged, and followed by a new migration.

Do not treat coordinated deployment approval as approval for cleanup migrations 006–008. Their exact protected exports, fresh audit counts, and separate execution approval remain mandatory. The unallocated 2021 money and four nullable legacy fields remain product decisions outside this chain.

`src/lib/database.types.ts` contains the deployed generated types plus target definitions from migrations `202608250002` through `202608260014`; the three retired RPC definitions are removed from that target contract. Migrations 006–010, 012, and 014 tighten behavior without adding application-facing fields. Running `npm run schema:types` against the live project before applying the chain will remove pending additions; regenerate only after the target schema is active, or restore the target additions while development remains local.
