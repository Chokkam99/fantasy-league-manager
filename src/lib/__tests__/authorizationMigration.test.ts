/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PUBLIC_LEAGUE_COLUMNS } from '@/lib/publicLeague'

const freshBaseline = readFileSync(
  join(process.cwd(), 'supabase/bootstrap/deployed-v0.sql'),
  'utf8',
)

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608250001_authorization_foundation.sql',
  ),
  'utf8',
)

const atomicImportMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608250002_atomic_espn_imports.sql',
  ),
  'utf8',
)

const financeIdentityMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608250003_finance_identity_foundation.sql',
  ),
  'utf8',
)

const safeArchivalMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608250004_safe_archival.sql',
  ),
  'utf8',
)

const scopedSharingMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260005_scoped_share_links.sql',
  ),
  'utf8',
)

const nullScoreCleanupMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260006_remove_exact_null_season_score_duplicates.sql',
  ),
  'utf8',
)

const lifecycleCleanupMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260007_normalize_completed_score_flags.sql',
  ),
  'utf8',
)

const activeSeasonCleanupMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260008_normalize_active_seasons.sql',
  ),
  'utf8',
)

const stagedConstraintsMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260009_add_core_constraints_not_valid.sql',
  ),
  'utf8',
)

const validatedConstraintsMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260010_validate_core_constraints.sql',
  ),
  'utf8',
)

const atomicRolloverMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260011_atomic_season_rollover.sql',
  ),
  'utf8',
)

const activeSeasonConstraintMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260012_enforce_one_active_season.sql',
  ),
  'utf8',
)

const atomicManualWeekMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260013_atomic_manual_week_scores.sql',
  ),
  'utf8',
)

const retiredScheduleMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608260014_retire_legacy_schedule_rpcs.sql',
  ),
  'utf8',
)

const playerPayoutStatusMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202608270015_player_payout_statuses.sql',
  ),
  'utf8',
)

const historicalReturningMembersMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/202609010016_historical_returning_members.sql',
  ),
  'utf8',
)

describe('authorization foundation migration', () => {
  it('is transactional and enables RLS on all fantasy tables', () => {
    expect(migration.trimStart()).toMatch(/begin;/)
    expect(migration.trimEnd()).toMatch(/commit;$/)

    for (const table of [
      'leagues',
      'league_seasons',
      'league_members',
      'weekly_scores',
      'matchups',
      'payments',
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      )
    }
  })

  it('keeps the browser league columns aligned with database grants', () => {
    const leagueGrant = migration.match(
      /grant select \(([\s\S]*?)\) on table public\.leagues/,
    )?.[1]
    expect(leagueGrant).toBeDefined()

    const grantedColumns = leagueGrant
      ?.split(',')
      .map((column) => column.trim())
      .filter(Boolean)
      .sort()
    const browserColumns = PUBLIC_LEAGUE_COLUMNS.split(',')
      .map((column) => column.trim())
      .filter(Boolean)
      .sort()

    expect(grantedColumns).toEqual(browserColumns)
  })

  it('does not expose credential columns or alter unrelated public tables', () => {
    const leagueGrant = migration.match(
      /grant select \(([\s\S]*?)\) on table public\.leagues/,
    )?.[1]

    expect(leagueGrant).not.toMatch(/platform_config|espn_s2|espn_swid/)
    expect(migration).not.toMatch(/public\.(collections|items)/)
  })

  it('revokes public execution of destructive legacy schedule functions', () => {
    expect(migration).toContain(
      'revoke execute on function public.generate_round_robin_schedule',
    )
    expect(migration).toContain(
      'revoke execute on function public.insert_season_matchups',
    )
    expect(migration).toContain('from public, anon, authenticated;')
  })
})

describe('fresh deployed-v0 bootstrap', () => {
  it('is transactional, fantasy-only, and guarded for an empty public schema', () => {
    expect(freshBaseline.trimStart()).toMatch(/^--[\s\S]*?begin;/)
    expect(freshBaseline.trimEnd()).toMatch(/commit;$/)
    expect(freshBaseline).toContain(
      'The deployed-v0 bootstrap requires an empty public schema.',
    )
    expect(freshBaseline).not.toMatch(
      /create table public\.(collections|items|playoff_teams)/,
    )
  })

  it('reproduces the audited legacy fields needed by forward migrations', () => {
    for (const field of [
      'fee_amount numeric not null default 0',
      'weekly_prize_amount numeric default 0',
      'joined_at timestamptz default now()',
      'is_final_score boolean default false',
      'scores_locked boolean default false',
    ]) {
      expect(freshBaseline).toContain(field)
    }
  })

  it('requires the insecure legacy grants to be closed by migration 001', () => {
    expect(freshBaseline).toContain(
      'grant all privileges on all tables in schema public',
    )
    expect(migration).toContain(
      'revoke all privileges on table public.leagues from anon, authenticated;',
    )
  })

  it('retires the old setup file with a deliberate transaction failure', () => {
    const retiredSetup = readFileSync(
      join(process.cwd(), 'database-setup.sql'),
      'utf8',
    )
    expect(retiredSetup).toContain('LEGACY REFERENCE ONLY — DO NOT RUN.')
    expect(retiredSetup).toContain(
      "raise exception 'database-setup.sql is retired;",
    )
  })
})

describe('atomic ESPN import migration', () => {
  it('is transactional and keeps import history private', () => {
    expect(atomicImportMigration.trimStart()).toMatch(/begin;/)
    expect(atomicImportMigration.trimEnd()).toMatch(/commit;$/)
    expect(atomicImportMigration).toContain(
      'alter table public.import_runs enable row level security;',
    )
    expect(atomicImportMigration).toContain(
      'revoke all privileges on table public.import_runs from public, anon, authenticated;',
    )
    expect(atomicImportMigration).toContain(
      'grant select on table public.import_runs to service_role;',
    )
  })

  it('uses a restricted definer function and transaction-scoped lock', () => {
    expect(atomicImportMigration).toMatch(
      /create or replace function public\.import_espn_week_atomically\([\s\S]*?security definer\s+set search_path = ''/,
    )
    expect(atomicImportMigration).toContain('pg_try_advisory_xact_lock(')
    expect(atomicImportMigration).toContain(
      ') from public, anon, authenticated;',
    )
    expect(atomicImportMigration).toContain(
      ') to service_role;',
    )
  })

  it('replaces one exact week and records both success and failure', () => {
    expect(atomicImportMigration).toMatch(
      /delete from public\.matchups[\s\S]*?delete from public\.weekly_scores/,
    )
    expect(atomicImportMigration).toContain("status = 'succeeded'")
    expect(atomicImportMigration).toContain('exception when others then')
    expect(atomicImportMigration).toContain("status = 'failed'")
    expect(atomicImportMigration).toContain("'code', 'IMPORT_LOCKED'")
    expect(atomicImportMigration).toContain("'scheduled_correction'")
  })
})

describe('finance and identity foundation migration', () => {
  it('is additive, transactional, and preserves season-team IDs', () => {
    expect(financeIdentityMigration.trimStart()).toMatch(/begin;/)
    expect(financeIdentityMigration.trimEnd()).toMatch(/commit;$/)
    expect(financeIdentityMigration).toContain(
      'add column if not exists manager_id uuid',
    )
    expect(financeIdentityMigration).not.toMatch(
      /drop table public\.league_members|delete from public\.weekly_scores/,
    )
  })

  it('uses integer cents and supports pending, partial, and paid dues', () => {
    expect(financeIdentityMigration).toContain(
      'expected_amount_cents integer not null',
    )
    expect(financeIdentityMigration).toContain(
      'paid_amount_cents integer not null',
    )
    expect(financeIdentityMigration).toContain(
      "status in ('pending', 'partial', 'paid')",
    )
    expect(financeIdentityMigration).toContain(
      'planned_amount_cents integer not null',
    )
  })

  it('keeps dues private and exposes only public-safe payout columns', () => {
    expect(financeIdentityMigration).toContain(
      'alter table public.season_payments enable row level security;',
    )
    expect(financeIdentityMigration).toMatch(
      /grant select \([\s\S]*?status,[\s\S]*?paid_at,[\s\S]*?\) on table public\.prize_payouts/,
    )
    expect(financeIdentityMigration).not.toMatch(
      /grant select \([\s\S]*?notes[\s\S]*?\) on table public\.prize_payouts/,
    )
  })

  it('locks compatibility triggers behind restricted definer functions', () => {
    for (const functionName of [
      'assign_league_member_manager',
      'sync_member_payment_summary',
      'sync_season_prize_awards',
    ]) {
      expect(financeIdentityMigration).toMatch(
        new RegExp(
          `function public\\.${functionName}\\([\\s\\S]*?security definer\\s+set search_path = ''`,
        ),
      )
    }
    expect(financeIdentityMigration).toContain(
      'from public, anon, authenticated;',
    )
  })
})

describe('safe archival migration', () => {
  it('is additive, transactional, and never deletes history', () => {
    expect(safeArchivalMigration.trimStart()).toMatch(/begin;/)
    expect(safeArchivalMigration.trimEnd()).toMatch(/commit;$/)
    expect(safeArchivalMigration).toContain(
      'add column if not exists archived_at timestamptz',
    )
    expect(safeArchivalMigration).not.toMatch(
      /delete from public\.|drop table public\./,
    )
  })

  it('protects the active season and disables automation when archiving a league', () => {
    expect(safeArchivalMigration).toContain(
      "message = 'The active season cannot be archived.'",
    )
    expect(safeArchivalMigration).toContain(
      'auto_sync_enabled = case when p_archived then false else auto_sync_enabled end',
    )
    expect(safeArchivalMigration).toContain(
      "sync_status = case when p_archived then 'disabled' else sync_status end",
    )
  })

  it('keeps archive mutations service-role-only', () => {
    for (const signature of [
      'public.set_league_archive_status(text, boolean)',
      'public.set_season_archive_status(text, text, boolean)',
    ]) {
      expect(safeArchivalMigration).toContain(
        `grant execute on function ${signature}\n  to service_role;`,
      )
      expect(safeArchivalMigration).toContain(
        `revoke execute on function ${signature}\n  from public, anon, authenticated;`,
      )
    }
  })
})

describe('scoped player sharing migration', () => {
  it('stores only token digests and permits one active link per league season', () => {
    expect(scopedSharingMigration.trimStart()).toMatch(/^--[\s\S]*?begin;/)
    expect(scopedSharingMigration.trimEnd()).toMatch(/commit;$/)
    expect(scopedSharingMigration).toContain('token_digest varchar(64) not null unique')
    expect(scopedSharingMigration).toContain('league_share_links_one_active_scope_idx')
    expect(scopedSharingMigration).not.toMatch(/raw_token|token varchar\(43\)/)
  })

  it('restricts rotation and revocation to the service role', () => {
    expect(scopedSharingMigration).toContain(
      'grant execute on function public.rotate_league_share_link(text, text, text, text)',
    )
    expect(scopedSharingMigration).toContain(
      'grant execute on function public.revoke_league_share_link(text, text)',
    )
    expect(scopedSharingMigration).toContain('from public, anon, authenticated;')
  })

  it('removes direct shared-role reads from every player-facing table and view', () => {
    for (const relation of [
      'leagues',
      'league_seasons',
      'league_members',
      'weekly_scores',
      'matchups',
      'managers',
      'prize_awards',
      'prize_payouts',
      'matchup_results_with_scores',
    ]) {
      expect(scopedSharingMigration).toContain(
        `revoke all privileges on table public.${relation}`,
      )
    }
  })
})

describe('player payout status migration', () => {
  it('is additive, transactional, and tracks one handout status per player', () => {
    expect(playerPayoutStatusMigration.trimStart()).toMatch(/^--[\s\S]*?begin;/)
    expect(playerPayoutStatusMigration.trimEnd()).toMatch(/commit;$/)
    expect(playerPayoutStatusMigration).toContain(
      'create table if not exists public.player_payout_statuses',
    )
    expect(playerPayoutStatusMigration).toContain(
      'unique (league_id, season, league_member_id)',
    )
    expect(playerPayoutStatusMigration).not.toMatch(
      /delete from public\.weekly_scores|drop table public\./,
    )
  })

  it('keeps mutation service-role-only and reopens paid totals after score changes', () => {
    const signature = 'public.set_player_payout_status(text, text, uuid, text)'
    expect(playerPayoutStatusMigration).toContain(
      `grant execute on function ${signature}\n  to service_role;`,
    )
    expect(playerPayoutStatusMigration).toContain(
      `revoke execute on function ${signature}\n  from public, anon, authenticated;`,
    )
    expect(playerPayoutStatusMigration).toContain(
      'create trigger reset_player_payout_statuses_for_score',
    )
  })
})

describe('legacy cleanup migrations', () => {
  it('keeps each cleanup transactional and exact-count gated', () => {
    for (const cleanup of [
      nullScoreCleanupMigration,
      lifecycleCleanupMigration,
      activeSeasonCleanupMigration,
    ]) {
      expect(cleanup.trimStart()).toMatch(/^--[\s\S]*?begin;/)
      expect(cleanup.trimEnd()).toMatch(/commit;$/)
      expect(cleanup).toContain('lock table public.')
      expect(cleanup).toMatch(/not in \(0, (?:10|24|6)\)/)
    }
  })

  it('limits mutation to the three audited fields and preserves money decisions', () => {
    expect(nullScoreCleanupMigration).toMatch(
      /delete from public\.weekly_scores candidate/,
    )
    expect(lifecycleCleanupMigration).toMatch(
      /update public\.weekly_scores\s+set is_final_score = true/,
    )
    expect(activeSeasonCleanupMigration).toMatch(
      /update public\.league_seasons season_config\s+set is_active = false/,
    )

    const cleanupText = [
      nullScoreCleanupMigration,
      lifecycleCleanupMigration,
      activeSeasonCleanupMigration,
    ].join('\n')
    expect(cleanupText).not.toMatch(
      /set\s+(?:draft_food_cost|weekly_prize_amount|fee_amount)\s*=/,
    )
  })
})

describe('core constraint migrations', () => {
  it('stages check and scope constraints before validation and NOT NULL changes', () => {
    expect(stagedConstraintsMigration).toContain('not valid;')
    expect(stagedConstraintsMigration).toContain(
      'weekly_scores_member_scope_fkey',
    )
    expect(stagedConstraintsMigration).toContain('matchups_team1_scope_fkey')
    expect(stagedConstraintsMigration).toContain(
      'matchups_unordered_pair_scope_unique_idx',
    )
    expect(validatedConstraintsMigration).toContain(
      'validate constraint weekly_scores_member_scope_fkey',
    )
    expect(validatedConstraintsMigration).toContain(
      'alter column season set not null',
    )
    expect(validatedConstraintsMigration).not.toContain(
      'league_seasons_one_active_scope_idx',
    )
  })

  it('leaves explicit product and cross-table decisions out of executable SQL', () => {
    const constraintText = `${stagedConstraintsMigration}\n${validatedConstraintsMigration}`
    expect(constraintText).not.toMatch(
      /alter column (?:draft_food_cost|weekly_prize_amount) set not null/,
    )
    expect(constraintText).not.toMatch(/alter table public\.payments/)
    expect(constraintText).not.toMatch(/create (?:or replace )?function|create trigger/)
  })
})

describe('atomic season rollover migrations', () => {
  it('uses one restricted definer transaction and a nonblocking league lock', () => {
    expect(atomicRolloverMigration.trimStart()).toMatch(/^--[\s\S]*?begin;/)
    expect(atomicRolloverMigration.trimEnd()).toMatch(/commit;$/)
    expect(atomicRolloverMigration).toMatch(
      /function public\.rollover_league_season_atomically\([\s\S]*?security definer\s+set search_path = ''/,
    )
    expect(atomicRolloverMigration).toContain('pg_try_advisory_xact_lock(')
    expect(atomicRolloverMigration).toContain(
      ') from public, anon, authenticated;',
    )
    expect(atomicRolloverMigration).toContain(') to service_role;')
  })

  it('deactivates the source before inserting the target and has no compensating deletes', () => {
    const deactivatePosition = atomicRolloverMigration.indexOf(
      'update public.league_seasons\n  set is_active = false',
    )
    const insertPosition = atomicRolloverMigration.indexOf(
      'insert into public.league_seasons',
    )

    expect(deactivatePosition).toBeGreaterThan(0)
    expect(insertPosition).toBeGreaterThan(deactivatePosition)
    expect(atomicRolloverMigration).not.toMatch(/delete from public\./)
  })

  it('adds one-active-season uniqueness only after the atomic function exists', () => {
    expect(activeSeasonConstraintMigration.trimStart()).toMatch(
      /^--[\s\S]*?begin;/,
    )
    expect(activeSeasonConstraintMigration.trimEnd()).toMatch(/commit;$/)
    expect(activeSeasonConstraintMigration).toContain(
      "to_regprocedure(\n    'public.rollover_league_season_atomically(text,text,text,jsonb,jsonb)'",
    )
    expect(activeSeasonConstraintMigration).toContain(
      'create unique index league_seasons_one_active_scope_idx',
    )
    expect(activeSeasonConstraintMigration).toContain('where is_active;')
  })
})

describe('historical returning-member migration', () => {
  it('keeps rollover transactional, restricted, and signature-compatible', () => {
    expect(historicalReturningMembersMigration.trimStart()).toMatch(
      /^--[\s\S]*?begin;/,
    )
    expect(historicalReturningMembersMigration.trimEnd()).toMatch(/commit;$/)
    expect(historicalReturningMembersMigration).toMatch(
      /function public\.rollover_league_season_atomically\([\s\S]*?security definer\s+set search_path = ''/,
    )
    expect(historicalReturningMembersMigration).toContain(
      ') from public, anon, authenticated;',
    )
    expect(historicalReturningMembersMigration).toContain(') to service_role;')
    expect(historicalReturningMembersMigration).not.toMatch(
      /alter table public\.|create table public\.|drop table public\./,
    )
  })

  it('accepts earlier league memberships while enforcing a valid roster', () => {
    expect(historicalReturningMembersMigration).toContain(
      'source_member.season < p_target_season',
    )
    expect(historicalReturningMembersMigration).toContain(
      'group by source_member.manager_id',
    )
    expect(historicalReturningMembersMigration).toContain(
      'member_count < 2 or mod(member_count, 2) <> 0',
    )
    expect(historicalReturningMembersMigration).toContain(
      'playoff_spots_value > member_count',
    )
  })
})

describe('atomic manual-week migration', () => {
  it('uses a restricted definer function and the ESPN week lock namespace', () => {
    expect(atomicManualWeekMigration.trimStart()).toMatch(/^--[\s\S]*?begin;/)
    expect(atomicManualWeekMigration.trimEnd()).toMatch(/commit;$/)
    expect(atomicManualWeekMigration).toMatch(
      /function public\.mutate_manual_week_atomically\([\s\S]*?security definer\s+set search_path = ''/,
    )
    expect(atomicManualWeekMigration).toContain(
      "concat_ws(':', 'espn', p_league_id, p_season, p_week::text)",
    )
    expect(atomicManualWeekMigration).toContain(
      ') from public, anon, authenticated;',
    )
    expect(atomicManualWeekMigration).toContain(') to service_role;')
  })

  it('replaces one exact score week while preserving its matchup schedule', () => {
    expect(atomicManualWeekMigration).toMatch(
      /delete from public\.weekly_scores[\s\S]*?insert into public\.weekly_scores/,
    )
    expect(atomicManualWeekMigration).not.toMatch(/delete from public\.matchups/)
    expect(atomicManualWeekMigration).toContain('scores_locked = true')
    expect(atomicManualWeekMigration).toContain('scores_locked = false')
  })

  it('derives playoff state for every future score write', () => {
    expect(atomicManualWeekMigration).toMatch(
      /function public\.derive_weekly_score_playoff_flag\([\s\S]*?new\.is_playoff_week := new\.week_number >= configured_playoff_start/,
    )
    expect(atomicManualWeekMigration).toContain(
      'before insert or update of league_id, season, week_number, is_playoff_week',
    )
  })
})

describe('legacy schedule RPC retirement migration', () => {
  it('requires both supported atomic boundaries before retirement', () => {
    expect(retiredScheduleMigration.trimStart()).toMatch(/^--[\s\S]*?begin;/)
    expect(retiredScheduleMigration.trimEnd()).toMatch(/commit;$/)
    expect(retiredScheduleMigration).toContain(
      'public.import_espn_week_atomically(text,text,integer,jsonb,jsonb,text)',
    )
    expect(retiredScheduleMigration).toContain(
      'public.mutate_manual_week_atomically(text,text,text,integer,jsonb)',
    )
  })

  it('drops only the three unused schedule/result RPCs without cascade or row mutation', () => {
    for (const functionName of [
      'generate_round_robin_schedule',
      'insert_season_matchups',
      'recalculate_matchup_winners',
    ]) {
      expect(retiredScheduleMigration).toContain(
        `drop function public.${functionName}`,
      )
    }
    expect(retiredScheduleMigration).not.toMatch(/\bcascade\b/)
    expect(retiredScheduleMigration).not.toMatch(
      /(?:insert into|update|delete from|truncate) public\./,
    )
  })
})
