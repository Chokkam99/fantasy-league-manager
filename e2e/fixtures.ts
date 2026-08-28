import type { Page, Route } from '@playwright/test'

const league = {
  archived_at: null,
  auto_sync_enabled: true,
  created_at: '2026-08-01T00:00:00.000Z',
  current_season: '2026',
  id: 'gridiron-gurus',
  last_sync_at: '2026-09-16T09:00:00.000Z',
  last_sync_error: null,
  name: 'Gridiron Gurus',
  platform_league_id: '123456789',
  platform_type: 'espn',
  sync_status: 'success',
  updated_at: '2026-09-16T09:00:00.000Z',
}

const season = {
  archived_at: null,
  created_at: '2026-08-01T00:00:00.000Z',
  divisions: { divisions: ['East', 'West'] },
  draft_food_cost: 20,
  fee_amount: 50,
  final_winners: {
    first: 'member-1',
    second: 'member-2',
    third: 'member-3',
  },
  id: 'season-2026',
  is_active: true,
  league_id: league.id,
  playoff_spots: 2,
  playoff_start_week: 15,
  prize_structure: { first: 60, second: 25, third: 10 },
  season: '2026',
  total_weeks: 17,
  updated_at: '2026-08-01T00:00:00.000Z',
  weekly_prize_amount: 5,
}

const members = [
  {
    division: 'East',
    id: 'member-1',
    is_active: true,
    joined_at: '2026-08-01T00:00:00.000Z',
    league_id: league.id,
    manager_id: 'manager-1',
    manager_name: 'Alex Smith',
    payment_status: 'paid',
    season: '2026',
    team_name: 'Sunday Scaries',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    division: 'East',
    id: 'member-2',
    is_active: true,
    joined_at: '2026-08-01T00:00:00.000Z',
    league_id: league.id,
    manager_id: 'manager-2',
    manager_name: 'Jordan Lee',
    payment_status: 'paid',
    season: '2026',
    team_name: 'Waiver Warriors',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    division: 'West',
    id: 'member-3',
    is_active: true,
    joined_at: '2026-08-01T00:00:00.000Z',
    league_id: league.id,
    manager_id: 'manager-3',
    manager_name: 'Morgan Chen',
    payment_status: 'paid',
    season: '2026',
    team_name: 'Desert Blitz',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    division: 'West',
    id: 'member-4',
    is_active: true,
    joined_at: '2026-08-01T00:00:00.000Z',
    league_id: league.id,
    manager_id: 'manager-4',
    manager_name: 'Taylor Reed',
    payment_status: 'partial',
    season: '2026',
    team_name: 'Fourth & Long',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    division: 'West',
    id: 'member-history',
    is_active: true,
    joined_at: '2025-08-01T00:00:00.000Z',
    league_id: league.id,
    manager_id: 'manager-history',
    manager_name: 'Casey Patel',
    payment_status: 'paid',
    season: '2025',
    team_name: 'Old School',
    updated_at: '2025-08-01T00:00:00.000Z',
  },
  {
    division: 'East',
    id: 'member-1-history',
    is_active: true,
    joined_at: '2025-08-01T00:00:00.000Z',
    league_id: league.id,
    manager_id: 'manager-1',
    manager_name: 'Alex Smith',
    payment_status: 'paid',
    season: '2025',
    team_name: 'Old Sunday Scaries',
    updated_at: '2025-08-01T00:00:00.000Z',
  },
]

const scores = [
  [1, [112.4, 106.2, 98.7, 101.1]],
  [2, [119.8, 127.3, 104.5, 110.9]],
].flatMap(([week, points]) =>
  (points as number[]).map((value, index) => ({
    created_at: '2026-09-01T00:00:00.000Z',
    id: `score-${week}-${index + 1}`,
    is_final_score: true,
    is_playoff_week: false,
    league_id: league.id,
    member_id: `member-${index + 1}`,
    points: value,
    season: '2026',
    week_number: week as number,
    week_status: 'completed',
  })),
)

const matchups = [
  {
    created_at: '2026-09-01T00:00:00.000Z',
    id: 'matchup-1-1',
    is_tie: false,
    league_id: league.id,
    season: '2026',
    team1_member_id: 'member-1',
    team1_score: 112.4,
    team2_member_id: 'member-2',
    team2_score: 106.2,
    updated_at: '2026-09-01T00:00:00.000Z',
    week_number: 1,
    winner_member_id: 'member-1',
  },
  {
    created_at: '2026-09-01T00:00:00.000Z',
    id: 'matchup-1-2',
    is_tie: false,
    league_id: league.id,
    season: '2026',
    team1_member_id: 'member-3',
    team1_score: 98.7,
    team2_member_id: 'member-4',
    team2_score: 101.1,
    updated_at: '2026-09-01T00:00:00.000Z',
    week_number: 1,
    winner_member_id: 'member-4',
  },
  {
    created_at: '2026-09-08T00:00:00.000Z',
    id: 'matchup-2-1',
    is_tie: false,
    league_id: league.id,
    season: '2026',
    team1_member_id: 'member-1',
    team1_score: 119.8,
    team2_member_id: 'member-3',
    team2_score: 104.5,
    updated_at: '2026-09-08T00:00:00.000Z',
    week_number: 2,
    winner_member_id: 'member-1',
  },
  {
    created_at: '2026-09-08T00:00:00.000Z',
    id: 'matchup-2-2',
    is_tie: false,
    league_id: league.id,
    season: '2026',
    team1_member_id: 'member-2',
    team1_score: 127.3,
    team2_member_id: 'member-4',
    team2_score: 110.9,
    updated_at: '2026-09-08T00:00:00.000Z',
    week_number: 2,
    winner_member_id: 'member-2',
  },
]

const payments = members.slice(0, 4).map((member, index) => ({
  expected_amount_cents: 5_000,
  id: `payment-${index + 1}`,
  league_member_id: member.id,
  notes: null,
  paid_amount_cents: index === 3 ? 2_500 : 5_000,
  paid_at: index === 3 ? null : '2026-08-15T00:00:00.000Z',
  payment_method: index === 3 ? 'Cash' : 'Zelle',
  status: index === 3 ? 'partial' : 'paid',
}))

const awards = [
  ['award-first', 'first', '1st place', 6_000],
  ['award-second', 'second', '2nd place', 2_500],
  ['award-third', 'third', '3rd place', 1_000],
].map(([id, key, label, amount]) => ({
  award_key: key,
  award_type: 'final',
  category_key: key,
  id,
  label,
  planned_amount_cents: amount,
  week_number: null,
}))

function financeSnapshot(isCommissioner: boolean) {
  return {
    awards,
    is_commissioner: isCommissioner,
    payments: isCommissioner ? payments : undefined,
    player_payout_tracking_ready: true,
    player_payouts: [],
    payouts: [
      {
        amount_cents: 6_000,
        award_id: 'award-first',
        id: 'payout-first',
        league_member_id: 'member-1',
        paid_at: null,
        status: 'pending',
      },
    ],
    schema_ready: true,
    success: true,
    summary: {
      collected_cents: 17_500,
      expected_cents: 20_000,
      outstanding_cents: 2_500,
      paid_payouts_cents: 0,
      pending_payouts_cents: 6_000,
      planned_payouts_cents: 6_000,
      projected_balance_cents: 14_000,
    },
  }
}

function corsHeaders() {
  return {
    'access-control-allow-headers':
      'authorization, apikey, content-type, prefer, accept-profile',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-origin': '*',
    'content-type': 'application/json',
  }
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ headers: corsHeaders(), json, status })
}

export async function installLeagueFixtures(
  page: Page,
  { commissioner }: { commissioner: boolean },
) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          ;(window as typeof window & { __copiedLeagueLink?: string })
            .__copiedLeagueLink = value
        },
      },
    })
  })

  await page.route('**/api/admin/auth**', async (route) => {
    await fulfillJson(route, { isAdmin: commissioner, success: true })
  })

  await page.route('**/api/leagues', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await fulfillJson(route, {
      leagues: [
        {
          ...league,
          attentionReasons: ['1 player has dues pending'],
          collectedAmount: 150,
          expectedAmount: 200,
          feeAmount: 50,
          latestWeek: 2,
          paidMembers: 3,
          pendingMembers: 1,
          totalMembers: 4,
          totalWeeks: 17,
        },
      ],
      success: true,
    })
  })

  await page.route(`**/api/leagues/${league.id}/view**`, async (route) => {
    const url = new URL(route.request().url())
    const resource = url.searchParams.get('resource')
    const selectedWeek = Number(url.searchParams.get('week'))
    const activeMembers = members.slice(0, 4)
    const payloadByResource: Record<string, unknown> = {
      history: {
        matchups,
        members,
        scores,
        seasons: [
          season,
          {
            divisions: { divisions: ['East', 'West'] },
            final_winners: { first: 'member-history' },
            playoff_spots: 1,
            playoff_start_week: 15,
            season: '2025',
            total_weeks: 17,
          },
        ],
        success: true,
      },
      memberships: {
        data: commissioner ? members : activeMembers,
        success: true,
      },
      overview: {
        matchups,
        members: activeMembers,
        scores,
        success: true,
      },
      prizes: { members: activeMembers, scores, success: true },
      scores: {
        latest: [{ week_number: 2 }],
        members: activeMembers,
        success: true,
      },
      season: { data: season, success: true },
      shell: {
        league,
        seasons: [
          { archived_at: null, season: '2026' },
          { archived_at: null, season: '2025' },
        ],
        success: true,
      },
      standings: {
        matchups,
        members: activeMembers,
        scores,
        success: true,
      },
      week: {
        matchups: matchups.filter((matchup) => matchup.week_number === selectedWeek),
        scores: scores.filter((score) => score.week_number === selectedWeek),
        success: true,
      },
    }
    await fulfillJson(route, payloadByResource[resource || ''] || { error: 'Unknown view.' }, resource && payloadByResource[resource] ? 200 : 400)
  })

  await page.route(`**/api/leagues/${league.id}/finance**`, async (route) => {
    await fulfillJson(route, financeSnapshot(commissioner))
  })

  await page.route(`**/api/leagues/${league.id}/sharing**`, async (route) => {
    await fulfillJson(
      route,
      route.request().method() === 'POST'
        ? {
            share_path: '/s/fixtureLink1',
            success: true,
            token: 'fixtureLink1',
          }
        : {
            active: false,
            created_at: null,
            season: '2026',
            success: true,
            token_prefix: null,
          },
    )
  })

  await page.route(`**/api/leagues/${league.id}/automation**`, async (route) => {
    await fulfillJson(route, {
      settings: {
        auto_sync_enabled: true,
        cron_configured: true,
        has_espn_s2: false,
        has_swid: false,
        is_configured: true,
        last_sync_at: league.last_sync_at,
        last_sync_error: null,
        latest_imported_week: 2,
        latest_import_run: null,
        league_id: league.platform_league_id,
        private_league: false,
        readiness: {
          can_enable_automatic: true,
          can_save_connection: true,
          checks: [],
        },
        season: '2026',
        sync_status: 'success',
        total_weeks: 17,
      },
      success: true,
    })
  })

  await page.route(`**/api/leagues/${league.id}/lifecycle**`, async (route) => {
    await fulfillJson(route, {
      league: {
        archived_at: null,
        current_season: '2026',
        id: league.id,
      },
      schema_ready: true,
      seasons: [
        { archived_at: null, is_active: true, season: '2026' },
        {
          archived_at: '2026-02-01T00:00:00.000Z',
          is_active: false,
          season: '2025',
        },
      ],
      success: true,
    })
  })

  await page.route('http://127.0.0.1:54321/rest/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ headers: corsHeaders(), status: 204 })
      return
    }

    const url = new URL(route.request().url())
    const table = url.pathname.split('/').at(-1)
    if (table === 'leagues') {
      await fulfillJson(route, url.searchParams.has('id') ? league : [league])
      return
    }
    if (table === 'league_seasons') {
      const exactSeason = url.searchParams.get('season')?.startsWith('eq.')
      await fulfillJson(route, exactSeason ? season : [season])
      return
    }
    if (table === 'league_members') {
      const exactSeason = url.searchParams.get('season')?.startsWith('eq.')
      await fulfillJson(route, exactSeason ? members.slice(0, 4) : members)
      return
    }
    if (table === 'weekly_scores') {
      const selectedWeek = url.searchParams.get('week_number')
      const select = url.searchParams.get('select')
      if (select === 'week_number') {
        await fulfillJson(route, [{ week_number: 2 }])
        return
      }
      const week = selectedWeek?.startsWith('eq.')
        ? Number(selectedWeek.slice(3))
        : null
      await fulfillJson(
        route,
        week ? scores.filter((score) => score.week_number === week) : scores,
      )
      return
    }
    if (table === 'matchup_results_with_scores') {
      const selectedWeek = url.searchParams.get('week_number')
      const week = selectedWeek?.startsWith('eq.')
        ? Number(selectedWeek.slice(3))
        : null
      await fulfillJson(
        route,
        week
          ? matchups.filter((matchup) => matchup.week_number === week)
          : matchups,
      )
      return
    }

    await fulfillJson(route, [])
  })
}
