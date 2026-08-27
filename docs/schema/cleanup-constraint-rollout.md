# Legacy cleanup and core-constraint rollout

Status: **prepared and locally verified; not applied to production**.

This package converts the two read-only audit reports into small, forward-only migration units and adds transaction prerequisites for active-season uniqueness and manual score integrity. It retires the unused legacy schedule-write surface rather than adding a global matchup model for an unsupported editor. It deliberately excludes unresolved historical-money interpretation, legacy-payment changes, and global matchup double-booking/cross-table score-pair constraints outside supported write workflows.

## Migration units

| Migration | Scope | Production expectation | Rollback source |
| --- | --- | ---: | --- |
| `006_remove_exact_null_season_score_duplicates` | Delete only exact null-season canonical duplicates | 10 or already-clean 0 | Protected export of the ten complete rows |
| `007_normalize_completed_score_flags` | Set only `is_final_score = true` for completed legacy rows | 24 or already-clean 0 | Export of IDs plus original lifecycle fields |
| `008_normalize_active_seasons` | Set only historical configuration `is_active = false` | 6 or already-clean 0 | Export of all eight league/season active values |
| `009_add_core_constraints_not_valid` | Add compatible checks and composite scope foreign keys; add unordered-matchup uniqueness | Zero violations | Drop staged constraints/index |
| `010_validate_core_constraints` | Validate staged safeguards and promote audited fields to `NOT NULL` | Zero violations | Drop `NOT NULL`, then drop migration-009 objects if required |
| `011_atomic_season_rollover` | Add a locked, service-role-only transaction for configuration, members, activation, and automation reset | Existing atomic function absent | Drop the function and retain the application compatibility path |
| `012_enforce_one_active_season` | Add a partial unique index after verifying active flags match each league's current season | Zero precondition violations | Drop the partial unique index |
| `013_atomic_manual_week_scores` | Add ESPN-compatible locking, exact-set manual score mutation, matchup completion state, and playoff derivation | Existing function/trigger absent | Drop the RPC and trigger/function; retain the application compatibility path |
| `014_retire_legacy_schedule_rpcs` | Remove the three unused broken/destructive schedule RPC signatures after supported atomic import/manual boundaries exist | Exact three legacy signatures present; both supported RPCs present | Recreate only from the audited deployed-v0 function definitions if rollback is explicitly required |

Every cleanup accepts only the exact audited count or zero. Zero permits a fresh empty installation and permits a production database whose candidate was separately cleaned before migration execution. Any other nonzero count raises an exception and rolls back the whole unit. Each migration uses a five-second lock timeout and a two-minute statement timeout so unexpected contention fails rather than waiting indefinitely.

## Required production backup/export

Before any remote execution, use a privileged read-only connection to export complete rows. Store the files outside the repository in an encrypted/protected location, verify that they can be read back, and record row counts and a checksum. The examples below are query shapes, not authorization to connect or mutate.

### Null-season score rows

Export `candidate.*` for the exact predicate used by migration 006: a null-season score whose same-league member has a four-digit season and which has exactly one canonical score matching league, member, week, inferred season, and points. The export must contain exactly ten complete rows, including IDs and timestamps.

Rollback is an insert of those exact exported rows after confirming that their IDs and null-season uniqueness slots remain free. Never reconstruct deleted rows from displayed score values.

### Lifecycle rows

Export complete rows—or at minimum immutable row ID, `week_status`, `is_final_score`, and modification timestamps—for:

```sql
select *
from public.weekly_scores
where week_status = 'completed'
  and is_final_score is distinct from true;
```

The export must contain exactly 24 rows and the inverse final/not-completed query must return zero. Rollback sets `is_final_score` back to its exported value by immutable ID; it must not change points, week, season, playoff state, or status.

### Active-season compatibility values

Export `league_id`, `season`, `is_active`, and `updated_at` for all eight season configurations. Verify two active current rows, six active historical rows, and no league missing its current configuration. Rollback restores only the exported `is_active` values by `(league_id, season)`.

## Preflight

Immediately before a reviewed remote window:

1. Confirm a current full Supabase backup or supported project restore point exists within the free plan; if the free plan cannot provide one, use verified protected logical exports for every changed row and stop if a lossless recovery path is unavailable.
2. Run `npm run schema:audit:cleanup` and require the documented 10/24/6 results with every ambiguity/error counter at zero.
3. Run `npm run schema:audit:constraints` and require zero new violations. Expected classifications are eight compatible now, three cleanup-gated, one legacy-money decision, three workflow/design-gated, and one empty legacy-payment evidence gap.
4. Run all three disposable suites: `schema:test:authorization`, `schema:test:fresh`, and `schema:test:cleanup`.
5. Confirm there are no active score imports, manual score writes, season settings saves, or season rollover requests.
6. Review the exact migration files that will be applied and record their checksums. Do not edit them after approval.

## Lock and runtime behavior

- Migrations 006 and 007 take `SHARE ROW EXCLUSIVE` on `weekly_scores`. Reads continue; score inserts, updates, deletes, and concurrent conflicting DDL wait and then fail at the five-second timeout.
- Migration 008 locks `leagues` and then `league_seasons` in a consistent order. Reads continue, but league/season writes pause for the short update.
- Migration 009 briefly takes strong table locks to register `NOT VALID` constraints. The unordered-matchup unique index scans 773 audited rows and blocks matchup writes while building.
- Migration 010 validates constraints with lower-impact scans, then takes stronger short locks for `SET NOT NULL` after validation proves the columns contain no nulls.
- Migration 011 installs a function only. Each future invocation takes a nonblocking transaction-scoped advisory lock per league and locks that league/current-season row before changing rollover state.
- Migration 012 checks the normalized active/current relationship, then scans `league_seasons` while creating the partial unique index. Season writes can be blocked briefly and fail at the five-second timeout.
- Migration 013 installs functions and one row trigger only. Future manual week writes use the same advisory-lock key as ESPN imports; season clears acquire all 25 supported week locks in ascending order. The trigger reads the matching season configuration for inserted or rescheduled score rows.
- Migration 014 performs catalog-only exact-signature function drops with `RESTRICT`. It makes no table changes and aborts if either supported atomic boundary is absent, any expected legacy signature has drifted, or a dependency still exists.

The current data volume is small, but the timeout—not estimated speed—is the safety boundary. A timeout means stop, inspect activity, and reschedule; do not increase timeouts reflexively.

## Postconditions after each unit

### After 006

- Zero `weekly_scores.season is null` rows.
- The ten canonical 2025 Week 1 rows remain unchanged.
- Total score count decreases by exactly ten unless the migration took the already-clean zero path.

### After 007

- Zero completed/not-final rows.
- Zero final/not-completed rows.
- Exactly 24 rows changed unless already clean.
- Points, league/member scope, season, week, and playoff flags are unchanged.

### After 008

- Each current configuration is active.
- Every historical configuration is inactive.
- Archive state and member participation state are unchanged.

### After 009–010

- Every added `pg_constraint.convalidated` value is true.
- Audited league/member/score/matchup scope and lifecycle columns are non-null.
- Composite member and season foreign keys reject cross-league/cross-season references.
- Score/matchup week checks, finite numeric checks, display-name checks, lifecycle checks, and completion-state checks reject invalid new writes.
- Reversed duplicate matchup pairs in the same scope are rejected.
- The four historical nullable draft/weekly-prize fields remain nullable.

### After 011–012

- Only `service_role` can execute atomic rollover; shared roles cannot call it.
- Rollover deactivates the source before inserting the active target and commits the season configuration, participating members, stable returning-manager identities, payment resets, league current season, and disabled automation together.
- Stale returning members, invalid input, or lock contention leave the source and target unchanged.
- A partial unique index rejects a second active season configuration for a league.

### After 013

- Only `service_role` can execute manual score mutations; shared roles cannot call the RPC.
- Saving a week replaces its entire score set with exactly one finite score per active player, removes stale inactive-player scores, preserves the matchup schedule, and completes valid scheduled matchups in the same transaction.
- Clearing a week or season removes scores and reopens the preserved matchup schedule atomically.
- Manual writes and ESPN imports for the same week cannot race; contention returns without partial changes.
- Every future score insert or relevant scope/week update derives `is_playoff_week` from that season's `playoff_start_week`, including ESPN, manual, and direct privileged writes.
- The manual completion boundary rejects scheduled inactive/missing players and cross-slot double booking before replacing scores.

### After 014

- `generate_round_robin_schedule(uuid, varchar, integer)`, `insert_season_matchups(uuid, varchar, jsonb)`, and `recalculate_matchup_winners(uuid, varchar)` are absent.
- The atomic ESPN import and manual score RPCs remain present and restricted to `service_role`.
- `matchups`, `weekly_scores`, and `matchup_results_with_scores` remain present and unchanged.

Rerun both aggregate audits after the package. Save only aggregate output in project records; do not commit production row exports.

## Deliberately deferred safeguards

Active-season uniqueness is no longer deferred: migrations 011–012 resolve the multi-request rollover conflict and add the partial index in the required order. The application calls the RPC first and retains its old sequence only as a compatibility path while migration 011 is absent; migration 012 cannot be applied without the RPC.

Playoff-flag derivation is no longer deferred: migration 013 routes manual writes through an atomic boundary and installs a derivation trigger for all future score writes. Existing rows are not rewritten; their audited zero-mismatch state remains the migration precondition.

### One matchup per member and paired scores

An unordered pair index prevents duplicate pairings, but cannot prevent one member appearing once in each team slot. Nor can a normal row constraint require two score rows in another table. The ESPN import and manual completion RPCs validate their complete week payloads, and the manual RPC rejects a double-booked saved schedule. Migration 014 retires the only other known schedule-writing RPCs, which have no application callers. No global matchup-participant model is needed for the supported product today; if schedule editing is added later, it must use a new serialized transaction that validates the complete week before rows are written.

### Historical money and legacy payments

Three `draft_food_cost` and one `weekly_prize_amount` values remain null by design. Do not normalize them to zero or make them non-null without an explicit commissioner decision. The empty legacy `payments` table remains untouched; canonical cents-based `season_payments` is the supported direction.

## Local verification contract

`npm run schema:test:cleanup` creates a disposable PostgreSQL 17 database, applies migrations 001–005, inserts a synthetic 10/24/6 dirty shape, applies 006–014, and proves the cleanup postconditions, constraint rejections, and legacy schedule retirement. A second disposable database inserts unexpected counts of one and proves each cleanup aborts without changing its candidate row.

The authorization and fresh-schema suites also apply migrations 006–014. The authorization suite additionally proves rollover success/failure, active uniqueness, manual exact-set replacement/clearing, playoff derivation, schedule validation, service-role permissions, both rollover and score lock contention, and exact-signature removal without losing the supported write paths or data objects. None of these commands contacts the linked Supabase project.
