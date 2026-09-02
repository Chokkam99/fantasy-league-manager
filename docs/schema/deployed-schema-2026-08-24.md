# Deployed database contract audit — 2026-08-25

Status: **historical deployed-v0 baseline**. Production subsequently received migrations 001–015 on 2026-08-27 and migration 016 on 2026-09-02. Use [the Production migration checkpoint](../deployment/production-migration-2026-08-27.md) for current state; keep this document as the source-shape and migration rationale.

This is a read-only compatibility snapshot of the deployed Supabase project. It records the public schema contract and aggregate data-health findings without recording credentials, player names, team names, score values, or other row-level content.

The initial anon-key audit was completed on 2026-08-24. On 2026-08-25, the repository was linked to the verified `fantasy-league-manager` project and the audit was completed through Supabase's enforced `supabase_read_only_user` Management API endpoint. The full audit covered columns and defaults, relationships, constraints, indexes, triggers, function definitions and grants, view definitions, table grants, RLS state, Supabase security/performance advisors, and aggregate consistency checks.

Re-run the audit with:

```bash
pnpm schema:audit
```

The `schema:audit` script remains the safe, anon-key compatibility check. The linked CLI can also generate exact public TypeScript types. As of CLI `2.114.0`, `db dump`, `db query`, and `db advisors` encounter a Supabase temporary-login-role provisioning error for this project; the official Management API read-only query and advisor endpoints work and were used instead. No schema or row mutation was performed.

## Production data footprint

| Resource | Visible rows | Notes |
| --- | ---: | --- |
| `leagues` | 2 | Both visible records currently use ESPN. |
| `league_seasons` | 8 | Multi-season history exists and must be preserved. |
| `league_members` | 92 | This table currently combines a person, team, and season participation. |
| `weekly_scores` | 1,568 | Historical scores are material production data. |
| `matchups` | 773 | Historical matchups are material production data. |
| `payments` | 0 | Table exists, but no visible rows establish its real contract. |
| `matchup_results_with_scores` | 773 | Calculated view exists and is used by the current UI. |
| `collections` | 1 | Unrelated public table sharing this project; do not alter as part of the league migration without confirming ownership. |
| `items` | 0 | Unrelated public table sharing this project. |

The following planned resources do not exist in the exposed schema: `playoff_teams`, `prize_rules`, `prize_awards`, and `import_runs`.

## Visible deployed columns

### `leagues`

`auto_sync_enabled`, `created_at`, `current_season`, `espn_league_id`, `espn_s2`, `espn_swid`, `id`, `last_sync_at`, `last_sync_error`, `name`, `platform_config`, `platform_league_id`, `platform_type`, `sync_status`, `updated_at`

### `league_seasons`

`created_at`, `divisions`, `draft_food_cost`, `fee_amount`, `final_winners`, `id`, `is_active`, `league_id`, `playoff_spots`, `playoff_start_week`, `prize_structure`, `season`, `total_weeks`, `updated_at`, `weekly_prize_amount`

### `league_members`

`division`, `id`, `is_active`, `joined_at`, `league_id`, `manager_name`, `payment_status`, `season`, `team_name`, `updated_at`

### `weekly_scores`

`created_at`, `id`, `is_final_score`, `is_playoff_week`, `league_id`, `member_id`, `points`, `season`, `week_number`, `week_status`

### `matchups`

`created_at`, `id`, `league_id`, `scores_locked`, `season`, `team1_member_id`, `team2_member_id`, `updated_at`, `week_completed_at`, `week_number`

### `matchup_results_with_scores`

`created_at`, `id`, `is_tie`, `league_id`, `season`, `team1_member_id`, `team1_score`, `team2_member_id`, `team2_score`, `updated_at`, `week_number`, `winner_member_id`

## Authorization and exposure findings

This is the highest-priority production issue.

- RLS is disabled on all eight public tables: the six league tables plus `collections` and `items`.
- There are no RLS policies in the public schema.
- `anon`, `authenticated`, and `service_role` have every relation privilege on the public tables, including `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN`.
- `anon` and `authenticated` can execute all ten public functions. This includes the mutating `generate_round_robin_schedule`, `insert_season_matchups`, and `recalculate_matchup_winners` RPCs.
- `matchup_results_with_scores` uses owner permissions rather than `security_invoker`; Supabase reports it as a security-definer view.
- All ten public functions have a mutable `search_path`.
- The official Supabase Security Advisor reports 38 findings: one security-definer view error, eight public-table RLS errors, ten mutable-function-path warnings, eighteen public GraphQL exposure warnings, and one PostgreSQL patch warning.
- The application-level commissioner cookie does not protect direct Data API requests. With the public anon key, database mutations currently bypass the UI and application routes entirely.

Enabling RLS or revoking anonymous writes without coordinating the application would break commissioner actions because server routes still use the anon Supabase client. The security migration must first introduce a server-only privileged client and move every mutation behind verified server authorization.

## Constraints, indexes, triggers, and functions

### Confirmed safeguards

- Primary keys exist on all eight public tables.
- Foreign keys cascade league deletion into seasons, members, scores, matchups, and payments.
- `league_seasons` is unique on `(league_id, season)`.
- `league_members` is unique per season by manager name and independently by team name.
- `weekly_scores` is unique on `(league_id, member_id, week_number, season)`.
- Payment, platform, sync, and score-status values have basic check constraints.
- Matchups prohibit the same member in both slots.
- Twenty-eight indexes exist; the primary league/season/week read paths are generally covered.

### Missing or weak safeguards

- `league_members.league_id`, `league_members.season`, `weekly_scores.season`, and `payments.league_member_id` are nullable.
- Week ranges, money values, playoff settings, score finiteness, and non-empty names lack database checks.
- Matchups have no unique constraint preventing duplicate pairs or a team appearing twice in one week.
- `payments.amount` has no positivity check, and the payment foreign key lacks an index.
- ESPN team mapping columns do not exist in the deployed member table.
- There is no Supabase migration-history table, confirming this database was not built from a reproducible CLI migration chain.

### Function drift and unsafe RPCs

- `get_team_record`, `recalculate_matchup_winners`, and `update_matchup_winners` reference matchup columns that do not exist in production and are unusable against the deployed contract.
- The first two also declare UUID league parameters while `leagues.id` and dependent `league_id` columns are text.
- `generate_round_robin_schedule` deletes the season's matchups, accepts the mismatched UUID league parameter, and increments the week once per matchup rather than once per round.
- `insert_season_matchups` deletes every matchup for the target season before reinserting the supplied JSON schedule.
- Both destructive schedule functions are callable by `anon`.
- Local migration `001` revokes their shared-role execution, and prepared migration `014` removes the exact three unused legacy schedule signatures with `RESTRICT` after verifying the supported atomic ESPN/manual boundaries exist. Neither migration has been applied remotely.
- `get_season_standings` uses the calculated view and text league IDs, but still hardcodes Week 15 when excluding playoffs instead of reading the season configuration.
- `update_matchup_results` is a no-op trigger function; the calculated view already supplies results.

## Aggregate production data health

The historical data is broadly coherent and should be preserved:

- All 773 matchups have both corresponding weekly scores.
- No duplicate unordered matchups were found.
- No team appears in multiple matchups in the same week.
- No matchup/member league or season mismatches were found.
- No scores or matchups fall outside configured week ranges.
- No negative or non-finite scores were found.
- All prize-bearing saved recipient IDs are valid except one zero-dollar 2023 rule in the second league.
- Seven of eight season money plans balance exactly under the application's null-as-zero behavior. The first league's 2021 plan leaves $40 unallocated.

Items requiring an explicit cleanup migration:

- Ten Week 1 score rows have `season = null`. They all belong to 2025 members and exactly duplicate an existing 2025 score for the same member, week, league, and point value.
- Twenty-four 2022 rows have `week_status = 'completed'` while `is_final_score` is false.
- Every historical season configuration is still marked `is_active = true`, so both leagues have multiple active configurations. `leagues.current_season` itself points to a valid active 2025 configuration.
- The `payments` table is empty; existing paid state lives entirely on `league_members.payment_status`.
- Several seasons retain extra historical `final_winners` keys that are not part of that season's prize structure. Current UI calculation safely ignores those extra keys.

## Confirmed drift from checked-in SQL

| Area | Deployed schema | `database-setup.sql` / migration state | Impact |
| --- | --- | --- | --- |
| Season money/config | Has `fee_amount`, `draft_food_cost`, `weekly_prize_amount`, `is_active` | Missing | Fresh setup cannot reproduce production or satisfy app types. |
| Member timestamps | Has `joined_at`, `updated_at`; no visible `created_at` | Defines `created_at`; no `joined_at` or `updated_at` | Current ordering works in production but not from fresh setup. |
| Member platform mapping | No visible `platform_team_id` or `espn_team_id` | Both are defined | Current ESPN mapping cannot rely on either documented field. |
| Weekly-score state | Has `is_final_score`, `is_playoff_week`, `week_status` | All missing | Fresh setup loses score lifecycle data. |
| Matchup state | Has `scores_locked`, `week_completed_at`, `updated_at`; result is calculated in a view | SQL stores `winner_member_id`, `is_tie`, `is_playoff`; lacks deployed state columns | App write paths and fresh schema disagree with production. |
| ESPN config | Has both generic and legacy fields | Base SQL has both; follow-up migration adds only legacy fields | Cron and setup UI select different contracts. |
| Sync statuses | Visible production value is `error` | Base SQL allows `none/active/error/disabled`; migration allows `inactive/active/error/paused` | Allowed status set is not canonical. |
| Planned finance/import records | Empty `payments` exists; prize/import tables absent | Not defined in base setup | Phase 1 requires additive migrations after live constraints are inspected. |
| Legacy fallback | No exposed `members` resource | Several pages query `members` as fallback | Fallback generates avoidable 404s and hides data-contract problems. |

## Canonical migration decision

1. Treat the deployed structure and its existing history as legacy production baseline `v0`.
2. Do not run `database-setup.sql` against production and do not use it as the Phase 1 migration source.
3. Keep all production changes forward-only, numbered, and reversible with documented backup/rollback steps.
4. Add a server-only privileged Supabase client and route every mutation through commissioner-authorized server handlers before revoking anon writes.
5. Move ESPN credentials out of publicly selectable league rows, then expose only an explicit safe read contract to shared-player views.
6. Revoke anonymous/authenticated mutation grants and unsafe RPC execution; enable RLS with the minimum required read policies.
7. Back up and verify the ten null-season duplicate scores, then remove only those confirmed duplicates and normalize legacy lifecycle flags.
8. Reconcile a disposable database to the deployed `v0` shape, then write additive migrations from `v0` to the target model.
9. Preserve existing IDs and history while introducing stable `managers` and `season_teams`; backfill and verify before switching reads or foreign keys.
10. Add season-scoped ESPN mappings, import runs/locks, prize awards, and payout state only after the authorization foundation is active.

## First compatibility slice completed

- Added representative local fixtures for the deployed `v0` contract.
- League creation now writes only league fields to `leagues`, then writes fee and configuration fields to `league_seasons`.
- A failed season insert attempts to remove only the newly created orphan league.
- Reading a missing season configuration now returns an explicitly unsaved in-memory configuration instead of mutating production data.

The full production contract is now recorded. The next schema-safety step is to prepare and test the coordinated server-authorization and RLS migration locally. Do not apply it to production until the application no longer depends on anonymous mutations, a backup/rollback procedure exists, and the user explicitly approves the production migration.

## Generated TypeScript contract

On 2026-08-25, the linked project's read-only type-generation endpoint produced `src/lib/database.types.ts` from the complete public schema. The generated contract includes the six fantasy tables, the unrelated `collections` and `items` tables, `matchup_results_with_scores`, all deployed relationships, and the six functions exposed by PostgREST's generated contract.

Both the public browser client and privileged server client now instantiate `@supabase/supabase-js` with this exact `Database` type. The active ESPN importer and server-route helpers retain that generic instead of erasing it to an untyped `SupabaseClient`.

The generated nullability is normalized only at explicit view-model boundaries. In particular, saved season JSON and nullable numeric fields pass through `normalizeSeasonConfig`; leagues without a valid four-digit `current_season` are rejected from active league views instead of being coerced; deployed member, weekly-score, payment, matchup, and calculated-view types are exported directly.

Regenerate after every approved schema change with `npm run schema:types`. The script writes to a temporary file first and preserves the current contract if generation fails or returns an empty result.

Typing also made the obsolete history/standings stack fail against the real contract. Those unused components and utilities were removed because the current Players and Standings routes supersede them and they called the broken `get_season_standings` RPC scheduled for public-execution revocation. No current runtime code calls that RPC.

## Disposable authorization-migration validation

On 2026-08-25, the prepared authorization migration was applied successfully to a synthetic copy of deployed baseline `v0` in the Supabase PostgreSQL 17.6.1 image. The fixture includes all six fantasy tables, the calculated matchup view, the affected legacy functions and triggers, representative league/season/member/score/matchup/payment rows, and unrelated `collections`/`items` tables.

`npm run schema:test:authorization` verifies shared-role safe reads, credential and payment denial, mutation and function denial, RLS policies, security-invoker view behavior, privileged server writes, trigger execution, and preservation of unrelated table authorization. The container has no published port, is automatically removed, and never connects to the linked project.

This closes the local disposable-database test step only. The migration remains unapplied to preview and production, and production Security Advisor findings remain unchanged until an explicitly approved rollout.
