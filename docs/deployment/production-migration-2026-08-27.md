# Production migration checkpoint — 2026-08-27

Status: **application deployed and migrations `001`–`014` applied successfully**.

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
- The known GitHub Actions pnpm argument-forwarding failure remains deferred at the commissioner's request. It did not affect the successful Vercel deployment or migration.

## Remaining checks

1. Refresh the signed-in Production portfolio after migration and confirm league pages still load through the protected server routes.
2. Create and validate the first season-scoped player link before distributing it; verify exact-season access and replacement/revocation behavior without exposing the stored digest.
3. Exercise commissioner write workflows deliberately and individually. Do not use a live score import as a generic smoke test.
4. Keep automatic sync disabled until an on-demand ESPN preview and one explicitly approved import validate the new atomic persistence path.
5. Commit and later push the live-generated type contract and this checkpoint together with the deferred GitHub Actions correction to avoid an unnecessary extra Vercel deployment.

