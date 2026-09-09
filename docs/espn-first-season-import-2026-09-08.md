# ESPN-first season imports — September 8, 2026

This supersedes the manual-first default in the earlier season-workflow review. Manual setup remains a fallback; ESPN is the primary path for onboarding, the next season, and reconciling an existing season.

## Implemented behavior and tracked fixes

| ID | Behavior / issue | Resolution |
| --- | --- | --- |
| EI-01 | Manual roster entry was the default for the next season. | Open the saved ESPN connection and read the target season automatically. The four-step manual form is behind an explicit fallback. |
| EI-02 | Existing seasons lacked a complete import flow. | Primary Import from ESPN action on Players & dues; full-season link on Scores; import action in the league menu. A year selector supports available historical seasons. |
| EI-03 | New-league onboarding treated ESPN as optional roster prefilling. | ESPN appears first; league name/link, roster, divisions, and supported format are filled automatically. Creation continues to the full-season results import. |
| EI-04 | Confirmed data still required repetitive editing. | Read-only confirmed data summary. Editable controls appear for unconfirmed identities or missing format values; confirmed ESPN fields remain server-owned on apply. |
| EI-05 | Renames and returning players could lose history. | Match unique historical names and saved ESPN owner-to-manager identities. Persist owner identities and season-scoped ESPN team mappings in the atomic transaction. |
| EI-06 | Reused team IDs could silently assign scores to a different person. | Detect ownership conflicts; require an explicit new-versus-returning player decision. Duplicate identities and ambiguous co-owners require clarification. |
| EI-07 | Missing ESPN owner/team names could become invented placeholders. | Missing names require user input. No current-season substitution is allowed: every ESPN response must confirm the requested league and year. |
| EI-08 | Departures could disappear silently. | Explicitly confirm active local players absent from the resolved ESPN roster. Mark them inactive without deleting payment records or earlier memberships. |
| EI-09 | Season import could overwrite app-owned financial data. | Preserve existing dues, payment methods/notes, partial amounts, and prize budgets. Next-season budgets carry forward; new historical budgets begin at zero. |
| EI-10 | Legacy payment triggers could reset a partial payment during a roster rename. | Existing membership updates omit the columns that fire payment-summary replacement. PostgreSQL assertions compare the entire payment record before/after. |
| EI-11 | Weekly sync did not import a complete historical season. | Import all ESPN-confirmed completed weeks in one season transaction. Historical imports retain the current active season; creating the next season activates it. |
| EI-12 | Missing or multiweek scores could be mistaken for zero or aggregate totals. | Accept genuine zero/negative scores, reject missing values, require per-scoring-period points for multiweek matchups, and leave incomplete/ambiguous weeks unchanged. |
| EI-13 | Completion could be guessed from dates or maximum week fields. | Use ESPN scoring-period progress and ended-season status. Do not treat `latestScoringPeriod` as evidence that all weeks finished. |
| EI-14 | A stale preview could overwrite intervening changes. | Re-read ESPN and compare preview revision before apply. Lock and compare membership, season, platform, and score state again inside the database transaction. |
| EI-15 | Failure midway through importing could leave a partial season. | One restricted atomic RPC covers season configuration, roster, mappings, and completed results. Invalid later weeks roll back every earlier write. |
| EI-16 | Re-importing identical scores could reset settled payout flags. | Skip unchanged score/matchup replacements. Genuine score changes retain the existing payout-recheck behavior. |
| EI-17 | Successful import followed by failed navigation could be submitted again. | Separate successful import state from navigation; retry opening the result without another POST. Failed writes preserve conflict answers for retry. |
| EI-18 | Private leagues could return an incomplete public response first. | Send saved private credentials immediately when the connection is private; use no-store requests. Credentials are not returned in previews or saved in browser draft storage. |

## Boundaries

- ESPN must supply the requested year's records. An unavailable season or mismatched response produces an actionable error; no current roster or guessed historical data is substituted.
- Existing archive protections remain: restore an archived league/season before importing into it. Reading another archived season does not block setting up a new season.
- Confirmed completed weeks replace that season's scores/matchups, including manual corrections. The preview explains the scope before the final import action. Incomplete weeks remain unchanged and are listed for review.
- ESPN does not confirm this app's dues or prize budgets. Existing-season values are preserved; new-season values carry forward. These remain editable in the app's money/rules controls.
- Roster/format conflict resolution uses existing application constraints (even 2–64 teams, supported playoff/week ranges, unique manager identities). Unsupported ESPN formats are not silently coerced.
- All testing used synthetic fixtures and disposable local PostgreSQL. No real league, ESPN account, or production database was modified.

## Deployment status

With explicit user authorization, migration `202609080018_espn_season_import.sql` was applied to production on September 8, 2026. The fresh production audit established that migration `017` was already applied; it was not replayed. Migration history now contains all 18 versions, the linked dry run is up to date, and all existing table row fingerprints remain unchanged. The service-role-only function is available for this application release. See the [release checkpoint](deployment/production-release-2026-09-08.md).

## Verification

- Unit/component and authenticated route tests cover automatic matching, conflicts, missing settings, stale previews, credential privacy, failure retry, and navigation-after-success.
- PostgreSQL 17 fresh-schema regression through migrations 001–018 passes, including atomic season-import assertions for current/new/historical seasons, identity preservation, partial payment/notes preservation, unchanged payout status, archive rejection, repeat import, and rollback of a later invalid week.
- Final Jest run: 92 suites / 463 tests passed, including first-league automatic format/roster filling and the uncertain-owner confirmation gate.
- Responsive browser suite: 61 passing cases across 320, 390, 768, and 1280 pixels, with 3 existing skips. The initial run had 60 passes and one subpixel measurement failure (`48.0000305px` versus `48px`); allowing 0.1px rounding tolerance made that case pass on rerun. All 8 new ESPN import cases passed in the full run.
- Production build, ESLint, application TypeScript check, and whitespace checks passed.
- Production Chrome visual checks at 390 and 1440 pixels covered confirmed data, identity/settings conflicts, and initial connection. No horizontal overflow or unlabeled visible fields. Screenshots are in `temp/ui-redesign/espn-{clean,conflict,connection}-{390,1440}.png` (ignored local artifacts). Visual review also corrected singular/plural review and week labels.
