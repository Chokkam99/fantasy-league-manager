# Legacy cleanup candidate report — 2026-08-26

This report revalidates known production-data anomalies and defines exact eligibility rules for a future, separately approved cleanup. It does **not** authorize or perform any database change.

The live check ran through `npm run schema:audit:cleanup`. That command makes paginated HTTP `GET` requests for explicit non-credential columns and prints aggregates only. It uses the anonymous key while legacy shared reads remain active and may use a configured server key after migration `005`; the implementation has no mutating HTTP method in either mode. League IDs are represented by stable ten-character SHA-256 fingerprints. Names, team names, raw IDs, score values, credentials, and row payloads are never printed.

## Current aggregate baseline

| Resource | Rows observed |
| --- | ---: |
| Leagues | 2 |
| Seasons | 8 |
| Season-team memberships | 92 |
| Weekly scores | 1,568 |

These counts match the 2026-08-25 production-contract audit. No drift was observed in the resources needed for this report.

## Decision summary

| Candidate | Exact current count | Recommendation | Authorization state |
| --- | ---: | --- | --- |
| Null-season exact duplicate scores | 10 | Prepare a narrowly gated deletion | Candidate-ready; not approved |
| Completed scores with a false final flag | 24 | Normalize `is_final_score` to true | Candidate-ready; not approved |
| Historical seasons still marked active | 6 | Set historical `is_active` false | Candidate-ready; not approved |
| 2021 unallocated money | $40 | Preserve until commissioner chooses allocation or intentional remainder | Product decision required |
| Historical winner keys outside positive prize rules | 7 seasons | Leave unchanged | No cleanup recommended |

## 1. Null-season score duplicates

All ten null-season rows are Week 1 rows whose member belongs to the 2025 season. Every row has exactly one canonical 2025 score with the same league, member, week, and point value.

The future deletion predicate must require all of the following at execution time:

1. The candidate score has `season is null`.
2. Its referenced member exists, belongs to the same league, and has one valid season.
3. Exactly one non-null-season score exists for the same league, member, week, member season, and point value.
4. Point values are finite and the member season is a valid four-digit NFL season-start year.
5. The preflight count is exactly 10; ambiguous, unmatched, invalid-value, missing-member, or cross-league counts are all zero.

The migration must abort before deleting anything if any gate changes. It must not infer that every future null-season score is disposable.

Expected postcondition: zero null-season scores, unchanged canonical 2025 scores, and a total weekly-score reduction of exactly ten.

Rollback requirement: retain a verified pre-cleanup database backup or an exact protected export of the ten rows, including primary keys and timestamps, before deletion.

## 2. Score lifecycle flags

Twenty-four 2022 scores have `week_status = 'completed'` while `is_final_score = false`:

| Season/week | Rows |
| --- | ---: |
| 2022 Week 15 | 12 |
| 2022 Week 17 | 12 |

They form two complete candidate groups, and there are zero inverse mismatches where `is_final_score = true` but the status is not completed. Current application logic already treats either completed status or a true final flag as final, so this is a metadata normalization rather than a scoring change.

The future update must target only rows where the status is completed and the final flag is not true. It may set only `is_final_score = true`; it must not rewrite points, week numbers, playoff flags, status, members, or timestamps beyond normal database update behavior.

Expected postcondition: zero completed/not-final rows, zero inverse mismatches, and exactly 24 updated rows. Rollback must restore the captured prior flag values if verification fails.

## 3. Historical season activation

Both leagues have a valid active configuration matching `leagues.current_season`. Six additional historical configurations are also marked active:

| Historical season | Active rows |
| --- | ---: |
| 2021 | 1 |
| 2022 | 1 |
| 2023 | 2 |
| 2024 | 2 |

The canonical rule is: `league_seasons.is_active` is true exactly when that row's season equals its parent league's `current_season`. A future normalization may set the six historical rows false and keep the two current rows true.

This flag remains an import/rollover compatibility field. It is not the historical visibility or archive indicator; migration `004` uses `archived_at` for reversible archival, and `league_members.is_active` continues to mean season participation.

Expected postcondition: each league has exactly one active season configuration and it matches `current_season`. The update must abort if any league lacks that current configuration or if a current row is inactive at preflight.

## 4. 2021 money-plan discrepancy

Seven of eight season plans balance. The 2021 plan identified by league fingerprint `1e17f166e3` has ten active players, $1,500 expected fees, $1,460 planned outflow, and $40 unallocated.

This is not a safe mechanical cleanup. Both of these are valid product decisions:

- Assign the $40 to a specific historical prize or cost after confirming what happened.
- Preserve the plan as intentionally unallocated history.

Recommendation: preserve the current values unless the commissioner remembers the intended allocation. No synthetic prize, food cost, payout, or recipient should be invented merely to force a zero balance.

## 5. Historical winner metadata

Seven seasons contain saved winner keys that do not correspond to a positive prize rule in that season. Current application reads ignore those keys, and removing them would discard historical metadata without improving correctness. No cleanup is recommended.

## Future cleanup rollout gates

Each mechanical cleanup must remain a separate forward migration or separately reviewable transaction with:

1. A fresh run of `npm run schema:audit:cleanup` showing the exact expected counts above.
2. A current readable backup and named restore owner.
3. A transaction-level preflight that raises an exception on any count or eligibility mismatch.
4. Captured target IDs and prior values for verification and rollback.
5. Exact affected-row assertions immediately after each statement.
6. Post-migration application checks for historical scores, standings, prizes, current-season imports, and season selection.
7. Explicit commissioner approval immediately before production execution.

Do not combine the $40 product decision or historical winner metadata with the three mechanical cleanup candidates. Do not add stronger `NOT NULL`, lifecycle-consistency, or one-active-season constraints until the cleanup is complete and a separate compatibility report proves that all remaining rows satisfy them.
