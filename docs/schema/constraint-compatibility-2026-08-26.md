# Core constraint compatibility report — 2026-08-26

This report evaluates whether stronger core-table safeguards are compatible with the current production rows. It is evidence for a future, separately reviewed migration; it does **not** authorize or apply a cleanup, constraint, trigger, or schema change.

The live check ran through `npm run schema:audit:constraints`. The command makes paginated HTTP `GET` requests for explicit columns and prints aggregate counts only. It used the anonymous key while legacy shared reads remain active. Names are inspected only for blank-value checks; names, raw IDs, score values, credentials, and row payloads are never printed.

## Audited baseline

| Resource | Rows |
| --- | ---: |
| Leagues | 2 |
| Season configurations | 8 |
| Season memberships | 92 |
| Weekly scores | 1,568 |
| Matchups | 773 |
| Legacy payments | 0 |

Latest live audit timestamp: `2026-08-26T16:17:22.675Z`.

## Result summary

| Classification | Candidate safeguards | Meaning |
| --- | ---: | --- |
| Compatible with current rows | 8 | The audited data has zero violations; migration design and rollout review are still required. |
| Safe only after approved cleanup | 3 | The only violations are the already proven mechanical cleanup candidates. |
| Blocked on a legacy-default decision | 1 | Four nullable historical money fields must retain null or be explicitly normalized. |
| Requires trigger or schedule redesign | 1 | Current rows comply, but a normal unique index cannot express the rule across both matchup slots. |
| Requires trigger or transaction boundary | 1 | Current rows comply, but the rule spans matchup and score tables. |
| Requires trigger or import-boundary redesign | 1 | The audit identified playoff derivation as cross-table; local migration `013` now resolves the future-write boundary and remains unapplied. |
| Insufficient production data | 1 | The legacy `payments` table is empty, so row compatibility cannot be demonstrated. |

“Compatible” does not mean “already present” or “approved.” Each proposed database change still needs exact SQL, disposable-database verification, lock/runtime review, backup and rollback steps, and separate production approval.

## Compatible with current rows

The following checks found zero violations:

- All membership league and season scopes exist. `league_members.league_id` and `season` can become non-null and can reference the corresponding `(league_id, season)` configuration after exact foreign-key/index design is reviewed.
- Every non-null league, configuration, member, and score season uses the four-digit NFL season-start-year convention.
- All present fee, draft-cost, weekly-prize, and positive-prize-rule amounts are finite and nonnegative. Total weeks, playoff start, and playoff spots are positive and within the audited safe ranges; playoff start does not exceed total weeks.
- All 92 manager and team display names are nonempty and every member payment status is supported.
- All 1,568 score values are finite; week numbers are positive and within the applicable configured schedule.
- No matchup has the same member in both slots or duplicates an unordered member pair within a league, season, and week.
- Every matchup week is valid, and both members belong to that matchup's league and season.
- All matchup score-lock flags agree with the presence or absence of their completion timestamps.

Candidate checks should initially be introduced with the least disruptive PostgreSQL form practical—for example, a `CHECK ... NOT VALID` followed by separate validation—when that form is available. `NOT NULL`, unique indexes, and foreign keys require their own lock and rollout analysis rather than being treated as equivalent operations.

## Safe only after the three approved cleanups

These safeguards are blocked only by the candidates documented in [the legacy cleanup report](legacy-cleanup-candidates-2026-08-26.md):

1. `weekly_scores.season` non-null and member-scope consistency: ten null-season 2025 Week 1 duplicates remain. There are no non-null score/member league or season mismatches and no missing members.
2. Completed/final lifecycle consistency: 24 2022 scores are completed but not final. There are no inverse final-but-not-completed rows.
3. At most one active configuration per league: six historical configurations are active while both current 2025 configurations are present and active.

The cleanup report's exact predicates, row-count gates, protected backup requirements, and postconditions remain mandatory. The compatibility audit originally identified that a partial unique index required atomic rollover first. Local follow-on migrations `011` and `012` now provide that locked rollover operation and then enforce **at most one** active row; both remain intentionally unapplied.

## Blocked on a legacy-default decision

Three historical `draft_food_cost` values and one historical `weekly_prize_amount` value are null. There are no negative or non-finite populated values. Current application reads interpret both null fields as zero.

Two valid choices remain:

- Preserve null as “not recorded” and add only nonnegative checks, which PostgreSQL permits alongside null values.
- Approve a count-gated normalization of exactly those four fields to zero, then make the columns non-null with defaults.

Do not silently combine this choice with the three mechanical cleanups. Null and explicit zero carry different historical meaning even though today's UI calculates them the same way.

## Structurally compatible but not expressible as a simple constraint

### One matchup per member per week

No member is double-booked in the 773 current matchups. Separate unique indexes on `team1_member_id` and `team2_member_id` would not catch a member appearing once in each slot. Reliable enforcement needs one of:

- a normalized matchup-participant table with a unique `(league_id, season, week_number, member_id)` key;
- a carefully locked trigger; or
- schedule creation through one serialized server/database operation that validates the complete week.

Prefer the normalized participant model only if future schedule editing justifies the added schema. For this small private app, a transactionally validated schedule write may be the simpler design.

### Both score rows exist for every matchup

All 773 matchups currently have score rows for both members in the same league, season, and week. This is a cross-table assertion and cannot be guaranteed by the existing matchup columns alone. Atomic ESPN import writes the full unit together. Local migration `013` gives manual completion an equivalent locked boundary that validates every scheduled participant before exact score replacement. Local migration `014` retires the unused legacy schedule writers, so no unsupported write path remains that justifies a global participant model today.

### Score playoff flag matches season configuration

All 1,568 current score flags agree with `week_number >= playoff_start_week`, and no flag is null. This rule spans score and configuration rows. Local migration `013` now moves manual score writes behind a locked RPC and adds a derivation trigger for every future insert or relevant update. It remains intentionally unapplied and does not rewrite the audited historical rows.

## Insufficient production evidence

The legacy `payments` table has zero rows. Its member foreign key, member non-null requirement, positive finite amount check, and supporting member index can be designed and tested with synthetic fixtures, but production compatibility cannot be inferred from an empty table. The newer cents-based finance records remain the canonical direction; do not strengthen or expand the legacy table unless an application read/write path still needs it.

## Recommended migration packaging

Do not create one large “constraints” migration. If production rollout is later approved, keep these reviewable units separate:

1. The three exact, count-gated legacy cleanup transactions.
2. Compatible check constraints, added and validated in controlled steps.
3. Scope non-null/foreign-key changes after cleanup, with exact lock review.
4. Atomic rollover followed by the active-season uniqueness safeguard (locally prepared as migrations `011` and `012`).
5. Atomic manual score mutation and playoff derivation (locally prepared as migration `013`).
6. Retirement of the unused legacy schedule writers (locally prepared as migration `014`). Revisit a normalized/serialized schedule model only if schedule editing becomes a supported feature.
7. Any four-field null-to-zero normalization only after the commissioner explicitly chooses that historical interpretation.
8. Legacy payment safeguards only if that table remains part of the supported data path.

Before each unit: rerun both aggregate audits, verify the exact expected counts, test against the disposable PostgreSQL 17 baseline and representative fixtures, take the required protected backup/export, and record rollback or compensating steps. The locally prepared units and their exact rollout contract are documented in [legacy cleanup and core-constraint rollout](cleanup-constraint-rollout.md). No production migration should be applied merely because this report shows row compatibility.
