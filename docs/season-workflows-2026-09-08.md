# Season navigation and new-season setup — September 8, 2026

> Updated default: [ESPN-first season import](espn-first-season-import-2026-09-08.md) supersedes the manual-first setup below. The manual wizard remains a fallback.

## Requested behavior

Make dues collection prominent before play begins, shift attention to competition during the season, and improve roster turnover when starting a new season. Preserve historical player identities and show shared viewers dues status without private payment notes (the existing sharing policy remains in place).

## Tracked improvements

| ID | Finding | Implemented change | Status |
| --- | --- | --- | --- |
| SW-01 | Navigation gives dues the same prominence throughout the year. | Commissioner preseason navigation places Players & dues immediately after Overview; it is a primary phone tab. | Fixed |
| SW-02 | Moving dues out of primary navigation could hide outstanding payments. | Active-player unpaid/partial count appears beside Players & dues and on the phone actions menu trigger. Zero removes the badge. | Fixed |
| SW-03 | Season phase should not depend on the calendar turning over. | Phase uses recorded completed/final scores: none = preseason; results = in season; final configured week = wrap-up, which promotes Prizes. | Fixed |
| SW-04 | Dues counts and priorities can become stale after edits. | Scoped cache-invalidation events update navigation after writes; returning window focus forces a fresh read. Old league/season responses cannot replace the current snapshot. | Fixed |
| SW-05 | A large setup form mixes roster decisions with money and rules. | Four-step Players → Format → Money → Review flow, with a persistent action bar and focused step headings. | Fixed |
| SW-06 | Departures are cumbersome to exclude and restore. | Compact selected roster with Remove; excluded players remain available in the historical directory. Prior seasons stay unchanged. | Fixed |
| SW-07 | Returning historical players are difficult to find. | Search by manager, team, or year; filter last-season versus earlier players, including inactive last-season members in the correct group; add with one click while retaining source identity. | Fixed |
| SW-08 | A returnee can accidentally be entered as a new person. | Exact normalized historical-name detection offers Bring back or Edit existing player. Duplicate selected manager names require clarification. | Fixed |
| SW-09 | Renaming a manager/team can lose their historical identity. | Edit upcoming-season display names in a focused dialog while retaining the original source member ID. | Fixed |
| SW-10 | New players require too much form scanning. | Dedicated Add new player dialog, compact roster row, and separate returning/comeback/new counts. | Fixed |
| SW-11 | Refreshing or leaving setup loses work. | Validated, season-scoped draft recovery in the current browser tab, Save & exit, and confirmed Start over. Storage failure is disclosed. | Fixed |
| SW-12 | Copied playoff settings can block roster work prematurely. | Validate each step separately. An even 2–64-player roster can proceed before adjusting copied playoff spots to its new size. | Fixed |
| SW-13 | Copied budgets and payout names are hard to verify. | Editable dues/expenses/weekly awards/season payouts; expected-versus-planned totals; over-budget or unassigned balance explanation; duplicate normalized payout names rejected. | Fixed |
| SW-14 | Final creation lacks a clear account of who is in/out and what carries forward. | Review shows final lineup, departures, comeback/new counts, format, divisions, dues, payout amounts, and ESPN connection/auto-sync state. | Fixed |
| SW-15 | Creation could leave cached league/finance data stale and open an unhelpful destination. | Invalidate league and finance caches after confirmed success, clear draft, reload league, open the new season’s Players & dues page. | Fixed |
| SW-16 | A navigation failure after successful creation could invite duplicate submission. | Track successful creation separately; expose an Open players & dues retry without posting again. Existing target seasons also have an explicit open action. | Fixed |
| SW-17 | Viewing an archived historical season blocks new-season setup. | Gate setup on commissioner access and league archival, independent of the selected historical season. Hide the unrelated historical-season selector and archived warning during setup. Server authorization remains authoritative. | Fixed |
| SW-18 | Redirect/remount after creation can recreate an empty completed draft. | Do not persist pristine default forms; completed drafts remain cleared during navigation. | Fixed |
| SW-19 | Minor responsive/accessibility details obscure status. | Compact phone roster rows, step navigation scrolled clear of the sticky header, and compact overlay badge in phone navigation; stable link names with accessible dues descriptions; labeled inputs/actions, modal focus, and narrow-screen payout wrapping. | Fixed |

## Scope and behavior

- Commissioner navigation adapts; shared viewers retain their established navigation. Phase follows recorded results rather than a scheduled date or a manual switch.
- New seasons initially select last season’s players only. Earlier players remain searchable rather than being bulk-selected.
- Returning-player detection matches normalized exact names. Commissioners can search historical teams/years for a returnee using a different name, then edit that existing person.
- Drafts are local to the browser tab and are not a cross-device or permanent draft service. Nothing in the league changes until Create season succeeds.
- The existing server rollover validation and atomic creation path remain in use. There are no new database migrations.
- All development browser mutations use synthetic fixtures. No live league was created or modified during testing. The subsequent authorized production migration and release are recorded in the [release checkpoint](deployment/production-release-2026-09-08.md).

## Verification

- Unit/component suite: 444 passing tests, including historical identity, departure/restore, historical-name detection, draft recovery, step validation, retry after failure, cache invalidation, phase/dues API projection, and stale-response protection.
- TypeScript and ESLint: passing.
- Full responsive browser suite: 53 passed, 3 intentional skips at 320, 390, 768, and 1280px. After final layout/context changes, the affected season workflows and primary navigation journeys passed again (25 passed, 3 intentional skips).
- Synthetic integration suite: 6 passing checks.
- Production build: passing. Visual checks at 390 and 1440px cover six-player rosters, all four setup steps, preseason navigation, input labels, document overflow, and setup access from archived history.
- Local review captures: `temp/ui-redesign/season-{roster,format,money,review}-{390,1440}.png` and `season-preseason-390.png` (generated, ignored artifacts).
