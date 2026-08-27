# Production rollout checkpoint — 2026-08-26

Status: **preparation only; production deployment and migrations are not approved or executed**.

This is the exact handoff for the locally verified application and migrations `001`–`014`. The project must remain on free plans with no paid branch, database, compute, add-on, or recurring service.

## Prepared evidence

- Release branch: `codex/authorization-preview`.
- Full local gate: 354/354 Jest tests, 6/6 synthetic integration tests, 6/6 responsive Playwright journeys, all three disposable PostgreSQL 17 suites, typecheck, lint, build, shell validation, and diff checks.
- Fresh GET-only production audits at `2026-08-27T04:12Z` found the unchanged deployed-v0 shape: 2 leagues, 8 season configurations, 92 memberships, 1,568 scores, 773 matchups, and 0 legacy payments.
- Cleanup preconditions remain exactly 10 null-season duplicate scores, 24 completed/not-final scores, and 6 historical active-season flags. Every ambiguity and matchup-integrity counter remains zero.
- Owner-only application-data export: `data/rollout-backups/2026-08-26-pre-migration/`. The directory is gitignored with mode `700`; its eight JSON files use mode `600`. The manifest checksums and all JSON files were independently read and verified.
- Owner-only PostgreSQL 17 logical export: `data/rollout-backups/2026-08-26-pooler-pg-dump/`. Its public-schema SQL files and checksum manifest use mode `600`; both checksums revalidate, and the dump restores successfully into a clean disposable PostgreSQL 17 database with the audited production counts and contracts.
- The production migration-history table is absent, as expected for the deployed-v0 baseline. The linked CLI dry-run completed successfully and proposed exactly migrations `001` through `014`, in order, with no seed or role changes.

The JSON export contains every row from `leagues`, `league_seasons`, `league_members`, `weekly_scores`, `matchups`, and `payments`, plus the exact 10/24/6 rollback rows. The PostgreSQL export independently contains the complete public schema and data, including grants, RLS, functions, fantasy data, and the unrelated public `collections`/`items` tables. Provider-managed schemas, cluster roles, and a provider restore point remain outside its scope.

## Open gates

The backup, packaging, release-gate, migration-history, and dry-run gates are resolved. Do not deploy or migrate until the remaining gates are resolved:

1. Vercel Production currently lacks `ADMIN_SESSION_SECRET` and `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY`. Its existing `ADMIN_PASSWORD_HASH` and `CRON_SECRET` are stored as non-sensitive values and must be replaced with new production-only sensitive values. Never reuse local Keychain values.
2. Immediately before migration, rerun the read-only audits and require the exact counts above. Any drift stops the rollout.
3. Obtain separate explicit approval immediately before the production application deployment and again before removing `--dry-run` from the migration command.

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

## Verified logical dump

Supabase recommends a CLI/`pg_dump` logical export for Free projects. The database password is stored in macOS Keychain and was passed only through child-process environment memory to PostgreSQL 17 tools. Because cluster-role dumping hung through the pooler and the direct database endpoint refused this machine's IPv4 connection, the verified export intentionally targets the complete `public` application schema and its data through the CLI-linked Supavisor session pooler.

The protected export is `data/rollout-backups/2026-08-26-pooler-pg-dump/`:

- `schema.sql`: 44,029 bytes; SHA-256 `54298fce9df13e9501fa6dbd75a512b962d7f0751b4367f8945775601744087e`.
- `data.sql`: 409,787 bytes; SHA-256 `f7945d541184fc5f957fd0263a8de1a163d170e13adc5eacb02d6d1265061b05`.
- `manifest.json`: owner-only checksum and scope metadata.

The dump restored successfully into a clean disposable PostgreSQL 17 database and reproduced the audited fantasy counts, cleanup candidates, calculated view, unrelated public tables, and deployed-v0 function contract. It is retained outside Git. Cluster roles and provider-managed schemas are not included and must not be inferred from this artifact.

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

The authorized read-only production check returned no migration-history table:

```sql
select
  to_regclass('supabase_migrations.schema_migrations') as history_table;
```

Result: `history_table = null`. No history rows were read because the table is absent. No baseline `migration repair` is needed because the repository contains forward migrations only; the deployed-v0 bootstrap is intentionally outside `supabase/migrations`.

With the database password loaded transiently as `SUPABASE_DB_PASSWORD`, generate the plan:

```sh
supabase db push --linked --include-all --skip-vault --dry-run
```

The dry-run succeeded and returned `upToDate: false`, `dryRun: true`, exactly migrations `001` through `014` in filename order, and empty `seeds` and `roles` lists. It proposed no Vault update, destructive reset, bootstrap, or `database-setup.sql`. The non-secret output is stored with the protected dump as `migration-dry-run.txt`.

This is planning evidence only. It did not apply migrations or establish authorization for a future non-dry-run command. Rerun the same dry-run immediately before an approved migration window and stop on any difference.

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
