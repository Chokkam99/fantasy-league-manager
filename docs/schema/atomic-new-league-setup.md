# Atomic new-league setup

Status: **migration 017 applied and verified in Production on 2026-09-03; compatible application release pending**.

Migration `202609030017_atomic_new_league_setup.sql` adds the restricted `create_league_atomically` function. It creates the league, first season, stable managers, season memberships, dues summaries, and optional current-season ESPN configuration in one transaction.

## Product boundary

The onboarding flow supports two roster sources:

- Manual current-season entry.
- A commissioner-authorized ESPN preview that returns only the selected season's league name, owners, team names, and team IDs.

ESPN preview is not a historical import. Prior seasons, former members, old team names, scores, matchups, and finishes must come from separately reviewed manual history data.

When ESPN is used, the server fetches the current team list again immediately before creation. Creation stops if the set of ESPN team IDs changed after the preview. Saved mappings point directly from current ESPN team IDs to the newly created season-member IDs. Private cookies stay server-only and are never returned by either onboarding route.

## Transaction behavior

The function validates and commits these records together:

1. A readable, unique lowercase league ID used by `/league/<league-id>`.
2. One active first-season configuration using the NFL season start year.
3. An even roster of 2 to 64 unique managers and team names.
4. Stable manager identities and season-specific team names.
5. Season payment summaries initialized as pending.
6. Optional current-season ESPN connection and exact team mappings.

Any validation, constraint, or insert failure rolls back the entire operation. The function is executable only by `service_role`; the application route requires a valid commissioner session before constructing privileged database access.

## Local verification

Run:

```sh
npm run schema:test:fresh
npm test
npm run typecheck
npm run lint
npm run build
```

The disposable PostgreSQL assertion verifies role restrictions, complete creation, stable identities, payment initialization, ESPN mappings, odd-roster rejection, and absence of partial rows after failure.

## Production rollout

Migration 017 was applied on 2026-09-03 after a linked dry-run proposed only that migration. The post-apply migration ledger contains 17 rows, the integrity and authorization audit passed, and a final linked dry-run reports no pending migrations, seeds, or roles.

Release the compatible application before using **Create league** in Production. The creation route deliberately fails closed when the restricted function is unavailable.
