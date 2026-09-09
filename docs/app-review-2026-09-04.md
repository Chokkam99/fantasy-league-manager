# App review — September 4, 2026

Review of the local application, source, and synthetic browser workflows. These
findings are a backlog, not a claim that fixes have shipped or that Production
was tested.

## Follow-up — September 8

The five application findings below are addressed locally in
[the quality-review tracker](quality-review-2026-09-08.md) and
[the shared-dues notes](shared-dues-2026-09-08.md). The original descriptions are
preserved as review history. The operational configuration items remain follow-ups.

## Original priority fixes

1. **Shared dues — resolved locally September 8:** Owner confirmed individual
   dues status should be public while payment notes stay private. Shared finance
   now returns canonical dues and totals, explicitly excluding private payment
   fields. Roster badges show paid, partial, or unpaid; visible roster, overview,
   and money pages refresh every 30 seconds and on return to the tab. Regression
   coverage checks response privacy, partial amounts, and stale cache races.
2. **Reliable logout:** `AdminLogin` reports logout before awaiting the server;
   `logoutAdmin` ignores unsuccessful HTTP responses. Confirm cookie removal
   before changing UI state and provide a retryable error.
3. **Legacy share cookies:** a cookie for another league makes an otherwise
   valid public link return 403. Reproduced with a synthetic authorization call.
   Legacy access must not block normal public access.
4. **Cache invalidation:** an in-flight finance request can repopulate the cache
   after invalidation. Reproduced using a deferred synthetic response. Version
   requests and scope caches to authentication state.
5. **Season switching:** async season and page loaders do not ignore stale
   responses; an older season request can overwrite a newer selection. Add
   cancellation or request-generation guards.

## Product and performance opportunities

- Put commissioner attention items near the top of the mobile overview.
- Reduce automatic prefetching of seven view resources and full history.
- Add browser coverage for real route response contracts, auth transitions,
  delayed responses, failed writes, and rapid season switching. Current browser
  fixtures test navigation and presentation, not server authorization.
- Review login throttling; no application-level rate limiter was found.

## Local configuration hygiene

The Git-ignored local `CLAUDE.md` contains a plaintext database credential and
outdated testing instructions. Remove the credential from instructions, use
secure configuration, and rotate it if active. This review did not establish
that the credential was committed or published. Do not copy it into this note.

## Validation at review time

- ESLint and application TypeScript checks passed.
- 82 Jest suites / 401 tests passed.
- Synthetic integration suite: 6 tests passed (also included in Jest).
- 12 Playwright journeys passed at 320, 390, 768, and 1280px widths.
- Visually inspected fixture-backed mobile overview and desktop roster.
- No Production services were validated and no source changes were made during
  the review. The subsequent UI redesign is a separate change.
