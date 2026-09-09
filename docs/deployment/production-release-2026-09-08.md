# September 8, 2026 release checkpoint

The user explicitly authorized the production migration and commit that triggers automatic deployment. This release contains the UI review fixes, shared dues privacy/freshness, phase-aware navigation, improved season workflows, and ESPN-first imports tracked in the September 8 review documents.

## Database execution and verification

- The fresh production audit found migrations 001–017 already applied. Only `202609080018_espn_season_import.sql` was pending; no earlier migration was edited, repaired, or replayed.
- Migration 018 SHA-256: `efa179224c242f0e98101f1108895724a1d9bff73abaf36f6c05b63c67a5666f`.
- A protected public-schema/data backup was created using the existing Keychain database connection, then restored successfully into disposable PostgreSQL 17 before execution. Provider-managed schemas and cluster roles are outside this application backup.
- Backup files remain ignored and owner-readable only under `data/rollout-backups/2026-09-08-pre-017-018/`. Schema: 139,579 bytes, SHA-256 `0de1a42e4020062eca3cbee858edb72779ae2b073a2043fe0b24e8cf96aa0359`. Data: 494,663 bytes, SHA-256 `6bd9e5c2fb20f188e12fddbba13411ded5cb03965e3a8829427775d303d02f9f`.
- The exact dry run proposed only 018, with no seeds or roles. The authorized linked push applied it once. Postflight history contains 18 versions and the dry run reports the remote database up to date.
- The new function has an empty search path, runs as security definer, allows `service_role` execution, and denies execution to `anon` and `authenticated`.
- Pre/post row fingerprints match across all 15 inspected public tables, including unrelated `collections` and `items`. Preserved application counts: 3 leagues, 11 seasons, 130 memberships/payments, 1,558 scores, 773 matchups, 44 managers, 137 prize awards, 28 prize payouts, 9 payout-status records, and 3 legacy share links. Import history remains empty.
- Existing authorization and integrity checks remain clear: no fantasy tables without RLS, no shared-role direct table privileges, no null-season scores or invalid completion/activation states, and no missing stable manager identities. Automatic sync remains disabled; no live ESPN import or cron invocation was used as a smoke test.

## Application release evidence

- Local unit/component/API tests: 463 passed in 92 suites. Six synthetic integration workflows passed.
- Production build, lint, application TypeScript check, and whitespace checks passed.
- Responsive browser checks: 61 passing cases and 3 existing skips across four viewport sizes, including all 8 new season-import cases. One strict height assertion required 0.1px tolerance for browser subpixel rounding and passed on rerun.
- Production-build visual inspection covered confirmed imports, conflict-only forms, and initial ESPN connection at 390px and 1440px without overflow or unlabeled visible controls.
- GitHub `main` matched local baseline `2b4e8bc` before this release. The existing GitHub/Vercel integration deploys pushes to `main`; no separate paid resource or deployment project is created.

## Recovery

The commissioner retains the protected backup and existing restore procedure. Migration 018 only adds a function and its grants; it rewrites no application records. If the application needs rollback, restore the preceding application release first. Remove or replace the new function only through a reviewed forward migration; do not repair or erase migration history. No recovery action was needed during this migration.
