# Production rollout checkpoint — 2026-08-26

Status: **preparation only; production deployment and migrations are not approved or executed**.

This is the exact handoff for the locally verified application and migrations `001`–`014`. The project must remain on free plans with no paid branch, database, compute, add-on, or recurring service.

## Prepared evidence

- Release branch: `codex/authorization-preview`.
- Full local gate: 354/354 Jest tests, 6/6 synthetic integration tests, 6/6 responsive Playwright journeys, all three disposable PostgreSQL 17 suites, typecheck, lint, build, shell validation, and diff checks.
- Fresh GET-only production audits at `2026-08-27T04:12Z` found the unchanged deployed-v0 shape: 2 leagues, 8 season configurations, 92 memberships, 1,568 scores, 773 matchups, and 0 legacy payments.
- Cleanup preconditions remain exactly 10 null-season duplicate scores, 24 completed/not-final scores, and 6 historical active-season flags. Every ambiguity and matchup-integrity counter remains zero.
- Owner-only application-data export: `data/rollout-backups/2026-08-26-pre-migration/`. The directory is gitignored with mode `700`; its eight JSON files use mode `600`. The manifest checksums and all JSON files were independently read and verified.

The current export contains every row from `leagues`, `league_seasons`, `league_members`, `weekly_scores`, `matchups`, and `payments`, plus the exact 10/24/6 rollback rows. It is a compensating application-data export, not a transaction snapshot, PostgreSQL role/schema dump, managed-schema backup, or provider restore point.

## Open gates

Do not deploy or migrate until all are resolved:

1. The Supabase Free plan has no downloadable automatic backup. The linked CLI's temporary-login-role flow fails for this legacy project, even for `db dump --dry-run`, because it cannot alter `cli_login_postgres`. Either explicitly accept the verified application-data export as the recovery boundary for this private project or obtain the database password and create the full logical dump described below. Do not upgrade the plan or enable PITR.
2. Vercel Production currently lacks `ADMIN_SESSION_SECRET` and `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY`. Its existing `ADMIN_PASSWORD_HASH` and `CRON_SECRET` are stored as non-sensitive values and must be replaced with new production-only sensitive values. Never reuse local Keychain values.
3. Review and commit the complete dirty worktree on `codex/authorization-preview`; then rerun the release gate from that exact commit.
4. Immediately before migration, rerun the read-only audits and require the exact counts above. Any drift stops the rollout.
5. Confirm migration history with a read-only query. The audited baseline has no history table; if one now exists or contains rows, stop and reconcile it before `db push`.
6. Obtain separate explicit approval immediately before the production application deployment and again before removing `--dry-run` from the migration command.

## Production secret preparation

Generate four independent production values. Use hidden prompts or secure provider UI; never put them in `.env`, command arguments, chat, shell history, or Git.

Configure them interactively as sensitive, Production-only Vercel values:

```sh
vercel env add ADMIN_PASSWORD_HASH production --force --sensitive
vercel env add ADMIN_SESSION_SECRET production --force --sensitive
vercel env add SUPABASE_SECRET_KEY production --force --sensitive
vercel env add CRON_SECRET production --force --sensitive
```

Afterward, `vercel env ls production` must show all four plus the two public Supabase values. Do not pull secret values into the workspace.

## Full logical dump option

Supabase recommends a CLI/`pg_dump` logical export for Free projects. If the database password is available without a plan change, load it into only the current shell through a hidden prompt and do not pass it on the command line:

```sh
read -s "SUPABASE_DB_PASSWORD?Supabase database password: "
export SUPABASE_DB_PASSWORD
umask 077
mkdir -p data/rollout-backups/production-pg-dump
supabase db dump --linked --role-only --file data/rollout-backups/production-pg-dump/roles.sql
supabase db dump --linked --file data/rollout-backups/production-pg-dump/schema.sql
supabase db dump --linked --data-only --use-copy --file data/rollout-backups/production-pg-dump/data.sql
unset SUPABASE_DB_PASSWORD
```

Verify that every file is nonempty and readable, record SHA-256 checksums, and retain it outside Git. If the password must be reset, treat that as a separate remote credential change requiring approval.

## Immutable migration manifest

Do not edit a migration after this checkpoint. Any hash change invalidates the audits, disposable-database results, and this plan.

| Migration | SHA-256 |
| --- | --- |
| `202608250001_authorization_foundation.sql` | `fd34413c8d206dfa61851d9bdc1041bbacc2adb480235cdfa5e90d466c052da4` |
| `202608250002_atomic_espn_imports.sql` | `3ac5b65ed44b664a11d7372d77e61f40d8a9cd2b4e2014d3d8b6e40bae64db1e` |
| `202608250003_finance_identity_foundation.sql` | `de215ddd5dde68b87b71e7493248ca3ca76f6c53534aea7b24b2669532349a8c` |
| `202608250004_safe_archival.sql` | `f69380b62b9c05cddfa2a8eaa7e0e5765a95d0da124abfc64b3d4df1ae6d1639` |
| `202608260005_scoped_share_links.sql` | `3e32ed1b0120cf1aff4d702f7fee9828f87c000ae9dd58e00bc3f52098a47944` |
| `202608260006_remove_exact_null_season_score_duplicates.sql` | `d61914ced531637f7d7050b3c1d8b7de8c6e1a00f51168a0207b8bee5af43924` |
| `202608260007_normalize_completed_score_flags.sql` | `99c94920e48be4362588edc48c44327aea1a36a30af4bdf394a33923c5adfe91` |
| `202608260008_normalize_active_seasons.sql` | `65c92c282655b500c8c43e96f5c58e599ae07ead35fd889e563502a0d358e9ec` |
| `202608260009_add_core_constraints_not_valid.sql` | `d56bea8fa7287c6a58bd796e4d42b6fd9578948c9740249d87906b1bd535dc0c` |
| `202608260010_validate_core_constraints.sql` | `a58ca17bae51ee796b79b31294cbbfdfaf05c51208bbe653f0edd16730ab7431` |
| `202608260011_atomic_season_rollover.sql` | `3a7caa2605ebcf82d07b083b39c996f2818c4c0a317ad4a0faea1272cd572acd` |
| `202608260012_enforce_one_active_season.sql` | `7246dda53e554c387c34ec46c4d572f2bdb2c5c6e6482a7121aa9351692fe9ec` |
| `202608260013_atomic_manual_week_scores.sql` | `9226d835d013d4e2f50fe6289c1229f0d4350175c1bf7fa4f7722183d550eedc` |
| `202608260014_retire_legacy_schedule_rpcs.sql` | `d2c16e336a97db38d84c66dd1cc2071ac09a81e664b0c4e5174d6f98cad9646c` |

## Exact dry-run plan

First use the Supabase SQL Editor or official read-only Management API endpoint to run:

```sql
select
  to_regclass('supabase_migrations.schema_migrations') as history_table;
```

The expected result is null. Only if it is non-null, run `select count(*) from supabase_migrations.schema_migrations;` and inspect every history row. If the table remains absent, no baseline `migration repair` is needed because the repository contains forward migrations only; the deployed-v0 bootstrap is intentionally outside `supabase/migrations`.

With the database password loaded transiently as `SUPABASE_DB_PASSWORD`, generate the plan:

```sh
supabase db push --linked --include-all --skip-vault --dry-run
```

Require exactly migrations `001` through `014`, in filename order, and no seed, roles, Vault update, destructive reset, bootstrap, or `database-setup.sql`. Save only the non-secret plan output. If the CLI again attempts temporary-login provisioning, stop; do not repair/delete login roles or switch to an unreviewed SQL execution path.

## Approved execution sequence

These steps are instructions for a later approved window, not authorization to run them now:

1. Freeze edits and automatic/manual imports. Recheck the hashes and all local release gates from the release commit.
2. Rerun all three GET-only audits and verify exact counts. Verify the protected export or full logical dump again.
3. Configure the four production-only sensitive Vercel values.
4. Deploy the compatibility-capable application release first. Because it contains pre-migration fallbacks, schema-dependent features remain unavailable rather than writing through the public key.
5. Smoke-test signed commissioner authentication, server-authorized reads, missing-schema fallbacks, and cron rejection without invoking an authenticated cron/import.
6. Enter the maintenance window and obtain explicit migration approval.
7. Rerun the exact `db push --dry-run`. Only then run the identical command without `--dry-run`:

   ```sh
   supabase db push --linked --include-all --skip-vault
   ```

8. Run every post-migration check in `docs/schema/authorization-foundation-rollout.md` before enabling sync or creating player links.
9. Rerun Supabase Security Advisor. Resolve only findings caused by this application; unrelated `collections` and `items` remain out of scope.
10. Keep automatic sync disabled until an explicit manual preview and import are approved.

Each migration is individually transactional and has lock/statement guards. If a migration fails, stop: its transaction rolls back, but earlier successful files remain applied. Prefer diagnosing and rolling forward. Roll the application deployment back first if user access is impaired; use the protected row export only for the exact documented compensating changes, never a broad blind overwrite.
