/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const {
  analyzeCleanupCandidates,
  analyzeConstraintCompatibility,
  scopeFingerprint,
}: {
  analyzeCleanupCandidates: (input: {
    leagues: Array<Record<string, unknown>>
    members: Array<Record<string, unknown>>
    scores: Array<Record<string, unknown>>
    seasons: Array<Record<string, unknown>>
  }) => Record<string, unknown>
  analyzeConstraintCompatibility: (input: {
    leagues: Array<Record<string, unknown>>
    matchups: Array<Record<string, unknown>>
    members: Array<Record<string, unknown>>
    payments: Array<Record<string, unknown>>
    scores: Array<Record<string, unknown>>
    seasons: Array<Record<string, unknown>>
  }) => Record<string, unknown>
  scopeFingerprint: (leagueId: string) => string
} = require('../../../scripts/lib/legacy-cleanup-audit.cjs')

const leagues = [
  { current_season: '2025', id: 'league-alpha' },
  { current_season: '2025', id: 'league-beta' },
]

const members = [
  { id: 'a-current', is_active: true, league_id: 'league-alpha', season: '2025' },
  { id: 'a-history', is_active: true, league_id: 'league-alpha', season: '2021' },
  { id: 'b-one', is_active: true, league_id: 'league-beta', season: '2022' },
  { id: 'b-two', is_active: true, league_id: 'league-beta', season: '2022' },
  { id: 'b-current', is_active: true, league_id: 'league-beta', season: '2025' },
]

const seasons = [
  {
    draft_food_cost: 10,
    fee_amount: 100,
    final_winners: { first: 'a-history', unused: 'a-history' },
    is_active: true,
    league_id: 'league-alpha',
    playoff_spots: 4,
    playoff_start_week: 15,
    prize_structure: { first: 30, unused: 0 },
    season: '2021',
    total_weeks: 2,
    weekly_prize_amount: 10,
  },
  {
    draft_food_cost: 0,
    fee_amount: 0,
    final_winners: null,
    is_active: true,
    league_id: 'league-alpha',
    playoff_spots: 4,
    playoff_start_week: 15,
    prize_structure: {},
    season: '2025',
    total_weeks: 17,
    weekly_prize_amount: 0,
  },
  {
    draft_food_cost: 0,
    fee_amount: 0,
    final_winners: null,
    is_active: true,
    league_id: 'league-beta',
    playoff_spots: 4,
    playoff_start_week: 15,
    prize_structure: {},
    season: '2022',
    total_weeks: 17,
    weekly_prize_amount: 0,
  },
  {
    draft_food_cost: 0,
    fee_amount: 0,
    final_winners: null,
    is_active: true,
    league_id: 'league-beta',
    playoff_spots: 4,
    playoff_start_week: 15,
    prize_structure: {},
    season: '2025',
    total_weeks: 17,
    weekly_prize_amount: 0,
  },
]

const scores = [
  {
    is_final_score: true,
    league_id: 'league-alpha',
    member_id: 'a-current',
    is_playoff_week: false,
    points: 110.25,
    season: '2025',
    week_number: 1,
    week_status: 'completed',
  },
  {
    is_final_score: true,
    league_id: 'league-alpha',
    member_id: 'a-current',
    is_playoff_week: false,
    points: 110.25,
    season: null,
    week_number: 1,
    week_status: 'completed',
  },
  ...['b-one', 'b-two'].map((memberId, index) => ({
    is_final_score: false,
    league_id: 'league-beta',
    member_id: memberId,
    is_playoff_week: false,
    points: 90 + index,
    season: '2022',
    week_number: 1,
    week_status: 'completed',
  })),
]

describe('legacy cleanup candidate analysis', () => {
  it('finds only rule-proven duplicate, lifecycle, activation, and money candidates', () => {
    const result = analyzeCleanupCandidates({ leagues, members, scores, seasons }) as {
      candidates: Record<string, Record<string, unknown>>
    }

    expect(result.candidates.null_season_scores).toMatchObject({
      exact_duplicate_count: 1,
      inferred_weeks: [{ count: 1, week: 1 }],
      null_season_total: 1,
      ready_for_separate_cleanup_approval: true,
    })
    expect(result.candidates.score_lifecycle).toMatchObject({
      candidate_groups: 1,
      completed_but_not_final_count: 2,
      final_but_not_completed_count: 0,
      ready_for_separate_cleanup_approval: true,
      uniform_candidate_groups: 1,
    })
    expect(result.candidates.season_activation).toMatchObject({
      current_season_row_count: 2,
      historical_active_count: 2,
      missing_current_season_count: 0,
      ready_for_separate_cleanup_approval: true,
    })
    expect(result.candidates.season_money_plans).toMatchObject({
      balanced_plan_count: 3,
      requires_product_decision_count: 1,
      total_plan_count: 4,
    })
    expect(result.candidates.season_money_plans.discrepancies).toEqual([
      expect.objectContaining({
        delta_cents: 4000,
        season: '2021',
        status: 'unallocated',
      }),
    ])
  })

  it('fails the deletion-ready gate when a null-season score is not an exact duplicate', () => {
    const unsafeScores = scores.map((score) =>
      score.season === null ? { ...score, points: 111 } : score,
    )
    const result = analyzeCleanupCandidates({
      leagues,
      members,
      scores: unsafeScores,
      seasons,
    }) as { candidates: Record<string, Record<string, unknown>> }

    expect(result.candidates.null_season_scores).toMatchObject({
      exact_duplicate_count: 0,
      non_duplicate_count: 1,
      ready_for_separate_cleanup_approval: false,
    })
  })

  it('uses stable fingerprints without exposing raw league identifiers', () => {
    const fingerprint = scopeFingerprint('league-alpha')
    expect(fingerprint).toMatch(/^[0-9a-f]{10}$/)
    expect(fingerprint).not.toContain('league-alpha')
  })

  it('keeps the live audit transport GET-only and excludes private columns', () => {
    const source = readFileSync(
      join(process.cwd(), 'scripts/audit-cleanup-candidates.mjs'),
      'utf8',
    )

    expect(source).toContain("method: 'GET'")
    expect(source).not.toMatch(/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/)
    expect(source).not.toMatch(/manager_name|team_name|espn_s2|espn_swid|platform_config/)
  })

  it('classifies constraints that are safe now, cleanup-gated, or design-gated', () => {
    const matchups = [
      {
        league_id: 'league-beta',
        scores_locked: false,
        season: '2022',
        team1_member_id: 'b-one',
        team2_member_id: 'b-two',
        week_completed_at: null,
        week_number: 1,
      },
    ]
    const result = analyzeConstraintCompatibility({
      leagues,
      matchups,
      members: members.map((member) => ({
        ...member,
        manager_name: `Manager ${member.id}`,
        payment_status: 'pending',
        team_name: `Team ${member.id}`,
      })),
      payments: [],
      scores,
      seasons,
    }) as {
      recommendation_summary: Array<{ classification: string; count: number }>
      recommendations: Array<{
        classification: string
        constraint: string
        violations: number
      }>
    }

    expect(result.recommendation_summary).toEqual(
      expect.arrayContaining([
        { classification: 'blocked', count: 1 },
        { classification: 'compatible_now', count: 8 },
        {
          classification: 'compatible_but_requires_trigger_or_import_boundary',
          count: 1,
        },
        { classification: 'safe_after_approved_cleanup', count: 3 },
        { classification: 'insufficient_production_data', count: 1 },
      ]),
    )
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: 'safe_after_approved_cleanup',
          constraint: 'weekly_scores season is NOT NULL and score scope matches its member',
          violations: 1,
        }),
        expect.objectContaining({
          classification: 'compatible_but_requires_trigger_or_schedule_redesign',
          violations: 0,
        }),
      ]),
    )
  })

  it('keeps the constraint audit transport GET-only', () => {
    const source = readFileSync(
      join(process.cwd(), 'scripts/audit-constraint-compatibility.mjs'),
      'utf8',
    )

    expect(source).toContain("method: 'GET'")
    expect(source).not.toMatch(/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/)
    expect(source).not.toMatch(/espn_s2|espn_swid|platform_config/)
  })

  it('separates nullable legacy money from invalid populated amounts', () => {
    const result = analyzeConstraintCompatibility({
      leagues,
      matchups: [],
      members: members.map((member) => ({
        ...member,
        manager_name: `Manager ${member.id}`,
        payment_status: 'pending',
        team_name: `Team ${member.id}`,
      })),
      payments: [],
      scores: [],
      seasons: seasons.map((season, index) => ({
        ...season,
        draft_food_cost: index === 0 ? null : season.draft_food_cost,
      })),
    }) as {
      findings: { configuration_ranges: Record<string, number> }
      recommendations: Array<{
        classification: string
        constraint: string
        violations: number
      }>
    }

    expect(result.findings.configuration_ranges).toMatchObject({
      invalid_draft_cost: 0,
      missing_draft_cost: 1,
    })
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: 'blocked',
          constraint:
            'optional season money fields are made NOT NULL only after choosing legacy defaults',
          violations: 1,
        }),
      ]),
    )
  })
})
