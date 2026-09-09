# App quality review and fix tracker — September 8, 2026

18 confirmed findings have been fixed locally and verified. Changes have not been
deployed. Each item below records the problem, the resulting behavior, and its
verification; this is not a guarantee that no undiscovered bugs remain.

| ID | Priority | Finding and fix | Status | Verification |
| --- | --- | --- | --- | --- |
| Q01 | Minor | Share was an icon-only square inside a menu of labeled rows. Added a full-width icon + text menu variant with copy feedback. | Verified | Browser checks every visible menu action for text and an icon, copies the link, and checks confirmation. |
| Q02 | Medium | The menu could overflow short screens, and its outside-click listener closed the sign-in dialog when interacting with it. Added bounded scrolling and dialog-aware dismissal. | Verified | 390×480 browser check; typing in the dialog; Escape dismissal and focus restoration. |
| Q03 | High | Logout changed the UI before server confirmation and ignored failures. It now waits, disables repeated submissions, and provides a persistent error with retry. | Verified | Deferred and failed logout tests; browser failure → retry → successful logout. |
| Q04 | High | Authentication changes retained page data and private finance caches. Clear caches across leagues, remount page state when access changes, and recheck access on focus and cross-tab login/logout. | Verified | Stale auth-check and cross-tab tests; browser logout/login reloads the roster and commissioner controls. |
| Q05 | Medium | An unrelated ambient legacy share cookie could block normal public league URLs. Normal URLs now remain public; explicit legacy grants still require validation. | Verified | Cookie variants, cross-league/season reads, malformed explicit grants, and actual read-route tests. |
| Q06 | High | Season and shell requests could resolve out of order; page filters, drafts, and dialogs survived season changes. Added request guards and season-scoped page state. | Verified | Delayed season-response test; browser 2026 → 2025 → 2026 navigation resets search and shows the correct roster. |
| Q07 | High | Rapid week changes could show an older response under the newly selected week. Only the current request may update the weekly view. | Verified | Deferred week 2 response arrives after week 3 and cannot replace its scores. |
| Q08 | Medium | Clearing season scores did not invalidate caches before refresh. Clear league and finance caches before reloading the displayed week. | Verified | Browser simulates a clear-season write and confirms cached scores disappear without navigation. |
| Q09 | Medium | Dashboard collection totals ignored partial payments. Added one batched canonical-payment read and use active members' expected/received amounts, scoped by league and season. | Verified | Partial, inactive, and historical-payment tests; query-plan and missing-schema/error tests. |
| Q10 | Minor | Settings/new-season rail icons used text glyphs and lacked active-page indication. Use the same SVG treatment and highlight the current destination. | Verified | Desktop production-preview inspection and accessible current-page attributes. |
| Q11 | Minor | The season selector invented the calendar year before league data arrived. Show a disabled loading state until an actual season is available. | Verified | Source/accessible-control audit; season navigation browser checks. |
| Q12 | Performance | Every league visit eagerly fetched seven resources and history. Removed the shell's blanket prefetch; visited pages load their own data and reuse valid caches. | Verified | Query/source review, navigation regressions, production build. |
| Q13 | High | Archive/restore left the cached shell unchanged, including editability and banners. Invalidate shell and finance records after successful lifecycle writes. | Verified | Client invalidation test; browser archive immediately shows the banner and removes score-edit controls. |
| Q14 | Medium | Week selection could change during score edits/saves, and player/payment fields remained editable during writes. Lock the relevant controls while editing or saving. | Verified | Failed score-save browser test preserves the draft for retry; busy form controls inspected. |
| Q15 | Minor | Payment details said a partial payer still “owes” the full fee. Describe the amount accurately as total season dues. | Verified | Component review and payment-dialog tests. |
| Q16 | Medium | Missing season settings returned a generic server failure. Return an explicit empty configuration so the existing unsaved-settings state can explain it. | Verified | Actual route test plus missing-configuration hook tests. |
| Q17 | Test coverage | Browser fixtures hid public roster history and mixed historical scores into current views. Align fixtures with the API's history and season-scoping contracts. | Verified | Actual public membership route test; returning-player journeys; current standings show 2/14 weeks. |
| Q18 | Medium | Two provisional scores could label a matchup Final and announce a winner. Honor explicit finalization metadata while preserving legacy records without it. | Verified | Component test with two pending scores; complete-score journeys remain valid. |

## Coverage

Reviewed home, league shell/menu, overview, standings, scores, roster/dues, prizes,
rules, settings, and season setup. Checks include normal and shared access,
keyboard interaction, responsive layouts, loading/error states, stale requests,
failed writes, money calculations, and archive state. Existing setup/import,
authorization, and domain tests were retained and run.

- Unit/component and synthetic integration tests: **431 passed** across 87 suites.
- Browser coverage: mobile 320 and 390, tablet 768, desktop 1280, an explicit
  680-pixel navigation check, and a 390×480 short-screen menu check.
- Application TypeScript check, ESLint, production build, and diff whitespace
  checks passed.
- Production-preview visual and accessible-label audit covered all seven primary
  league pages, plus the mobile menu and score editor. No document overflow or
  visible unlabeled form/button controls were found in those states.
- Local screenshots are in the Git-ignored `temp/ui-redesign/quality-*.png` files.

Final consolidated browser suite: **45 passed**, with three intentionally skipped
duplicate executions of the dedicated 680-pixel breakpoint case.

## Limits and deployment follow-ups

All browser data and writes were simulated. Live ESPN responses, real database
writes/migrations, and the deployed application were not exercised. No production
records were changed. The earlier review's credential-rotation/configuration
hygiene and deployment-level login-throttling items remain separate operational
follow-ups; this UI/functional pass does not claim to resolve them.


| Follow-up | Status | Needed to close |
| --- | --- | --- |
| O01 — Credential hygiene from the earlier local review | Operational follow-up | Confirm whether the previously noted local credential is active, remove it from instruction text, and rotate through the owning service if needed. No credential values are included here. |
| O02 — Login throttling | Deployment follow-up | Confirm the deployment’s trusted client-IP source and persistent/shared rate-limit storage before implementing a limiter that works across server instances. |
| O03 — Release validation | Not deployed | Deploy the reviewed changes and smoke-test the actual environment separately. |
