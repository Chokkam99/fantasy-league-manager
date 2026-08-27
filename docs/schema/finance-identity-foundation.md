# Finance and stable-identity foundation

Migration `202608250003_finance_identity_foundation.sql` is prepared and locally verified but intentionally **not applied** to the linked Supabase project.

## Identity model

- `managers` is the stable person identity within one league.
- Existing `league_members.id` values remain the season-team identity. Scores, matchups, saved winners, and ESPN mappings keep their current references.
- `league_members.manager_id` links season teams to a stable manager, allowing team names and divisions to change each season.
- Historical backfill matches normalized manager names within each league. It prefers the active/current-season spelling for `managers.display_name` while preserving every season-specific `manager_name` and `team_name` snapshot.
- Compatibility triggers assign `manager_id` to current application inserts. Future application writes should pass an existing manager ID explicitly for renamed managers rather than relying on name matching.
- The migration fails closed if normalization would place the same manager identity into one season twice.

The application reads `manager_id` first for player history, returning-player activation, and season rollover. While this migration remains unapplied, those reads retry against the legacy columns and continue grouping normalized names. Once active, returning season-team writes carry the existing manager ID explicitly, so the manager display name and team name can both change without splitting the person’s history. The latest season snapshot refreshes `managers.display_name`; edits to older seasons cannot overwrite a newer display.

## Dues model

`season_payments` stores one private summary per season team:

- Expected and paid values use integer cents.
- Normal operation remains a simple `pending` or `paid` toggle.
- `partial` is supported for the rare partial-payment case without making it the primary workflow.
- Existing `payments` transactions are preserved unchanged and used during backfill. When no legacy transaction exists, `league_members.payment_status` remains the source for the initial paid/pending amount.
- A compatibility trigger keeps the canonical summary aligned with the existing binary member toggle until application writes move fully to the new table.

Anonymous and authenticated roles cannot read dues records, payment method, dates, or notes.

Commissioner changes use the restricted `set_season_payment_details` operation. It validates the rare partial amount, updates the private cents-based record, and keeps the legacy binary `league_members.payment_status` summary synchronized during rollout.

## Prize and payout model

- `prize_awards` normalizes every positive weekly, final, and special allocation into integer cents.
- Weekly awards are created for the configured number of weeks. Removing a configured award deactivates it instead of deleting historical payout records.
- `prize_payouts` supports one or more recipients per award, including tied weekly winners.
- Saved `final_winners` are backfilled as assigned, pending payouts. The migration does not infer that money was sent.
- Token-authorized players may read award allocations, recipients, amounts, and paid/pending state through the protected finance route. Commissioner notes remain private.
- Composite foreign keys reject cross-league and cross-season payment or payout references.

Final and special recipients use `assign_prize_recipient`, which updates the normalized payout and legacy `final_winners` snapshot in one transaction. `set_prize_payout_status` records paid/pending state and the paid timestamp. Weekly winners remain calculated from finalized score data rather than manually assigned.

All three operations are executable only by `service_role`; the application exposes them through `/api/leagues/[id]/finance`, after validating the signed commissioner session and season scope. The same route validates a season-scoped player token before returning safe award/payout fields, adds private dues only for the commissioner, and returns `schema_ready: false` while this migration is not active so existing pages keep working.

## Compatibility and rollout

The migration is additive and does not delete or rename existing tables, members, scores, matchups, payment transactions, or saved JSON. Current member creation, rollover, and paid/pending writes remain compatible through restricted triggers. In the UI, the common dues workflow remains a one-tap paid/pending action; partial amount, method, and note fields are secondary details. Season award cards show recipient and payout status to players and add recipient/payout controls only for commissioners.

Run `npm run schema:test:authorization` to verify the complete migration chain in disposable PostgreSQL 17. The suite covers historical team-name changes, stable manager reuse, legacy payment backfill, commissioner partial/payment operations, award normalization, recipient assignment, payout completion, public/private grants, current-write compatibility, and rejection of cross-league finance references.

Do not combine activation with the separately identified null-season score cleanup, lifecycle normalization, historical active-flag cleanup, or the 2021 unallocated-money decision. Apply migrations only after a verified backup and explicit production approval.
