# Production migration checkpoint — 2026-08-27

Status: **migrations `001`–`016` applied successfully; migration-compatible application release prepared**.

This records the completed Production schema rollout. It contains no secret values or production row payloads.

## Execution

- The compatibility-capable application release at commit `7b7518d` was deployed first as Vercel Production deployment `dpl_C6Bz5axu1EqAJh7gxs2ioF96jCCw` and reached `READY`.
- The commissioner confirmed successful Production sign-in and league loading before the migration window.
- Immediately before execution, all three GET-only audits matched the frozen baseline, both protected exports and their checksums passed, all 14 immutable migration hashes matched, the migration-history table was absent, and the linked dry-run proposed exactly migrations `001`–`014` with no seeds or roles.
- With explicit commissioner approval, `supabase db push --linked --include-all --skip-vault` applied migrations `001`–`014` once, in filename order. The database password was read from macOS Keychain and passed only through child-process environment memory.
- The post-migration history table contains 14 rows. A follow-up dry-run reports `upToDate: true`, no migrations, no seeds, and no roles.

## Verified data state

- Preserved: 2 leagues, 8 season configurations, 92 season memberships, and 773 matchups.
- Canonical scores: 1,558 after removal of exactly 10 proven null-season duplicates.
- Cleanup postconditions: 0 null-season scores, 0 completed/not-final scores, 0 historical active seasons, 0 inactive current seasons, and 0 memberships missing a stable manager.
- Identity and finance backfill: 30 stable managers, 92 canonical season-payment rows, 113 prize awards, and 28 prize-payout rows.
- Preserved decisions: the 2021 `$40` unallocated balance, three null draft-food costs, one null weekly-prize amount, historical winner metadata, and the empty legacy payments table were not invented or normalized.
- Integrity audits report zero malformed identifiers, invalid score values, schedule-boundary failures, member/scope mismatches, matchup-integrity failures, and playoff-flag mismatches.

## Verified authorization state

- Anonymous Data API reads now return `401 / 42501` for all fantasy tables, the calculated matchup view, prize awards, and import history.
- All 12 fantasy tables have RLS enabled and `anon`/`authenticated` have zero direct table privileges.
- `matchup_results_with_scores` uses `security_invoker`.
- The three legacy schedule functions are absent. The atomic ESPN and manual-score functions remain present and have no anonymous execution privilege.
- Share-link storage has no plaintext token column. No share link has been created yet.
- Supabase Security Advisor reports no fantasy-table RLS-disabled error and no fantasy GraphQL exposure. Its remaining errors concern the unrelated pre-existing `collections` and `items` tables. Informational no-policy findings are intentional deny-by-default behavior for the server-only fantasy tables.

## Application and activation state

- Post-migration Home, Overview, and Standings route checks return HTTP 200. Signed-out session checking returns 200; anonymous protected reads and unauthenticated cron requests return 401.
- Automatic score sync is disabled for both leagues. No authenticated cron request or ESPN request was made. `import_runs` remains empty.
- The live-generated TypeScript schema contract was reconciled locally. Typecheck, lint, the production build, and 359/359 Jest tests pass after preserving explicit SQL-null RPC argument types that the generator does not represent.
- At this original checkpoint, the GitHub Actions pnpm argument-forwarding failure remained deferred and did not affect the successful Vercel deployment or migration. It was corrected in the subsequent application release, whose current CI run is recorded below.

## Additive migration 015 and its release

- After the original `001`–`014` checkpoint, a fresh protected public-schema/data backup was created and verified before the additive payout migration.
- The linked dry run proposed exactly `202608270015_player_payout_statuses.sql` with SHA-256 `aec2bf7ee3a2af788ac1fde226803498ce3e062e65f48a7976e2eab7c3c6b038`. It was applied once with explicit approval, after which migration history contained 15 rows and the final dry run reported `upToDate: true` with no migrations, seeds, or roles pending.
- `player_payout_statuses` was created with RLS enabled and no `anon` or `authenticated` table privileges. Its setter RPC is service-only, and score/award triggers reset completion state when a payout total can change.
- The table intentionally began with zero rows. The migration did not infer that any historical handout had already been paid.
- The current application release is commit `a90edc5`, deployed through Vercel Production deployment `dpl_2jFH5bVMexGhkXFtJZg7QukAB9tQ`. GitHub Actions Quality run `33137872136` passed lint, typecheck, 374 unit/component tests, six synthetic integration workflows, the Production build, and all 12 responsive browser journeys.
- The normal `/league/<league-slug>` URL is now the league-wide public share path. Existing digest-only `/s/...` links remain supported as legacy links but are no longer created by the current share action.
- Automatic ESPN sync remains disabled. No migration cleanup, score import, authenticated cron invocation, provider upgrade, or paid resource remains part of this completed rollout.

## Additive migration 016 and the 2026-09-02 release

- A fresh owner-only public-schema/data backup was created under the ignored local backup directory and successfully restored into disposable PostgreSQL 17 before migration. The schema export is 127,036 bytes with SHA-256 `4b6b9b0b98a940a4b2daa77e7d5472c1a2527376655f0c33c668b01d59df63bc`; the data export is 470,392 bytes with SHA-256 `85b0fbe41436641a492c4ece8ea2ef41ad87d54f6e9a588cc450632cc473ca46`.
- Immediately before execution, Production migration history contained exactly 15 rows and the linked dry run proposed only `202609010016_historical_returning_members.sql`, SHA-256 `6ccbb85335958111b5bdb384d870ba9b0c333763e065de44b9a09643b35c1156`, with no seeds or roles.
- Migration 016 was applied once with explicit approval. It replaced the existing service-role-only atomic rollover function without changing its signature or table shape. The new function accepts earlier same-league memberships, rejects duplicate stable identities, and enforces an even 2–64 team roster with a valid playoff count.
- Post-migration verification reports 16 migration-history rows and an up-to-date dry run with no pending migrations, seeds, or roles. The rollover function is present, contains the historical-member predicate, and grants no execution to `anon` or `authenticated`.
- Existing aggregate state remains coherent: 2 leagues, 8 seasons, 92 memberships, 1,558 scores, 773 matchups, 30 managers, 92 season payments, 113 prize awards, and 28 prize payouts. Cleanup postconditions remain zero, all fantasy tables retain RLS with no shared-role table privileges, automatic sync remains disabled, and no ESPN or cron request was invoked.
- Security Advisor introduced no migration-016 finding. Intentional service-only tables remain informational RLS-with-no-policy entries; the warnings and errors for legacy functions, the provider PostgreSQL patch level, and unrelated `collections`/`items` remain pre-existing and out of scope for this migration.
- The accompanying application passed 379 unit/component tests, six integration workflows, lint, typecheck, the Production build, both disposable PostgreSQL suites, and all 12 responsive browser journeys before release.

## Ongoing operational checks

1. Exercise commissioner write workflows deliberately and individually. Do not use a live score import as a generic smoke test.
2. Keep automatic sync disabled until an on-demand ESPN preview and one explicitly approved import validate the atomic persistence path.
3. Retain the protected backups until another trusted backup supersedes them; never commit them to Git.
4. Treat future schema changes as new forward migrations. Do not edit the 16 applied migration files or repair their history.
