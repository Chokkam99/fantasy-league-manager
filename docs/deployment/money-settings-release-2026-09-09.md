# Money settings and readability release

This follows the September 8 releases and the user's authorization to fix, migrate, commit, and deploy the app. It addresses inherited entry fees, binary dues controls, larger text, allocation colors, and the two reported sidebar wrapping issues. The earlier historical score-finalization repair remains open.

## User-facing changes

- Players & dues, League money, and Rules link directly to the selected season's entry-fee and prize-budget editor in Settings. The editor supports entry fees, draft expenses, weekly prizes, and final/special prizes. A budget shortfall is editable and does not block saving.
- Fee changes update active players' expected dues while preserving actual received amounts and private notes/methods. Other seasons and inactive players are untouched. Assigned or paid prizes prevent prize-amount changes; fee-only and draft-cost changes remain available.
- Dues controls and shared labels use Paid/Unpaid. Previously recorded receipt amounts remain intact; note-only edits do not reset them. The older internal payment representation remains compatible with historical records.
- Shared text sizes are 13/15/17px, with slightly larger compact labels and stable headings.
- The segmented bar beneath “How $… is divided” on Prizes uses blue for draft costs, green for weekly prizes, dark ink for final/special prizes, and neutral gray for unallocated funds. The overview uses the same legend. A real budget shortfall remains red; payout completion is shown separately.
- The desktop rail provides room for a single-line Players & dues label, count, and active marker. Footer phrases have intentional line breaks so “Every season.” stays together.

## Database checkpoint

- Only `202609090019_season_money_settings.sql` was pending. Its SHA-256 is `f996cff9e23a00841173f64c5df5be03c3c6ab40000f8bca72b55a7cf5b8efa8`.
- A fresh protected public-schema/data backup was restored successfully in disposable PostgreSQL 17 before applying the migration. Ignored backup location: `data/rollout-backups/2026-09-08-pre-019/`. Schema: 156,632 bytes, SHA-256 `cb4179c63fe10c9169180d82803bf8852fa051c043d17bbec0b0adac5f08bb87`. Data: 503,294 bytes, SHA-256 `4679da2121e33d1b4389c12ce2a3bc45ae469c96aef54ac8c425e4003534dfdf`.
- The linked push applied only 019. There are now 19 migration versions and the postflight dry run reports the remote database up to date.
- The new atomic function is restricted to `service_role`, with an empty search path and execution denied to `anon` and `authenticated`. The API separately requires a commissioner session and checks the selected season and stale revision.
- Before/after row counts and fingerprints match across all 15 inspected public tables: 3 leagues, 12 seasons, 138 memberships/season payments, 45 managers, 1,558 scores, 773 matchups, 158 awards, 28 prize payouts, 9 player payout statuses, 3 legacy share links, 1 unrelated collection, and no items/legacy payments/import runs. Installing the function changed no app records.

## Validation

- All 474 unit/component/API tests pass across 94 suites; six synthetic integration workflows pass.
- Fresh PostgreSQL 17 bootstrap plus migrations 001–019 and data assertions pass. New cases cover fee increases/decreases, receipt preservation, inactive dues, stale/archived writes, award synchronization, guarded payouts, and rollback on failed saves.
- The responsive suite has 69 passing cases and three existing skips across 320/390/768/1280px. Old exact typography expectations were updated to the intended sizes, and both affected larger-screen journeys passed on rerun. The desktop journey passed again after the sidebar spacing change.
- Production build, application typecheck, ESLint, and whitespace checks pass. Generated browser-report bundles are excluded from source linting.
- Production-preview checks cover Settings, Prizes, and Players at 320/390/1440px, including the selected sidebar with a dues badge. Screenshots remain ignored under `temp/ui-redesign/`.

## Recovery and limits

The migration only installs a function and grants; no row repair or live fee edit was performed. Roll back the application release first if needed, and adjust/remove the function only through a forward migration. Do not edit applied migration history. The protected backup excludes provider-managed schemas and cluster roles.

Browser mutations used synthetic fixtures. No live ESPN import or payout edit was used as a release smoke test. Operational credential hygiene, deployment-level login throttling, and historical score reconciliation remain tracked in the review document.
