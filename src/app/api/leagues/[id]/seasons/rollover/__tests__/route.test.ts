/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/leagues/[id]/seasons/rollover/route'
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/adminSession'
import { getLifecycleWriteBlock } from '@/lib/lifecycleServer'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

jest.mock('@/lib/supabaseServer', () => {
  const actual = jest.requireActual('@/lib/supabaseServer')
  return { ...actual, createServerSupabaseClient: jest.fn() }
})

jest.mock('@/lib/lifecycleServer', () => ({
  getLifecycleWriteBlock: jest.fn(),
}))

const mockedCreateServerClient =
  createServerSupabaseClient as jest.MockedFunction<
    typeof createServerSupabaseClient
  >
const mockedLifecycleBlock = getLifecycleWriteBlock as jest.MockedFunction<
  typeof getLifecycleWriteBlock
>
const secret = 'test-session-secret-with-at-least-32-characters'
const originalSecret = process.env.ADMIN_SESSION_SECRET
const context = { params: Promise.resolve({ id: 'fixture-league' }) }

const validBody = {
  configuration: {
    divisions: ['North', 'South'],
    draft_food_cost: 50,
    fee_amount: 100,
    playoff_spots: 2,
    playoff_start_week: 15,
    prize_structure: { first: 600 },
    total_weeks: 17,
    weekly_prize_amount: 10,
  },
  confirmed: true,
  members: [
    {
      division: 'North',
      manager_name: 'Alex',
      source_member_id: '123e4567-e89b-42d3-a456-426614174000',
      team_name: 'New Team',
    },
    {
      division: 'South',
      manager_name: 'Blake',
      source_member_id: '123e4567-e89b-42d3-a456-426614174001',
      team_name: 'Second Team',
    },
  ],
  source_season: '2025',
  target_season: '2026',
}

function request(body: unknown, authorized = false) {
  return new NextRequest(
    'http://localhost/api/leagues/fixture-league/seasons/rollover',
    {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(authorized
          ? { Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(secret)}` }
          : {}),
      },
      method: 'POST',
    },
  )
}

function databaseWithRpc(result: {
  data: Record<string, unknown> | null
  error: { code?: string; message?: string } | null
}, league: Record<string, unknown> = {
  auto_sync_enabled: false,
  current_season: '2025',
  id: 'fixture-league',
}) {
  const leagueQuery = {
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: league,
      error: null,
    }),
    select: jest.fn(),
    update: jest.fn(),
  }
  leagueQuery.select.mockReturnValue(leagueQuery)
  leagueQuery.eq.mockReturnValue(leagueQuery)
  leagueQuery.update.mockReturnValue(leagueQuery)

  return {
    from: jest.fn().mockReturnValue(leagueQuery),
    rpc: jest.fn().mockResolvedValue(result),
  }
}

describe('atomic season rollover route', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = secret
    mockedCreateServerClient.mockReset()
    mockedLifecycleBlock.mockReset().mockResolvedValue(null)
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = originalSecret
  })

  it('rejects unauthenticated rollover before database access', async () => {
    const response = await POST(request(validBody), context)

    expect(response.status).toBe(401)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('uses one RPC and returns its committed season result', async () => {
    const database = databaseWithRpc({
      data: {
        copied_players: 2,
        source_season: '2025',
        success: true,
        target_season: '2026',
      },
      error: null,
    })
    mockedCreateServerClient.mockReturnValue(
      database as unknown as ReturnType<typeof createServerSupabaseClient>,
    )

    const response = await POST(request(validBody, true), context)

    expect(response.status).toBe(200)
    expect(database.rpc).toHaveBeenCalledWith(
      'rollover_league_season_atomically',
      expect.objectContaining({
        p_league_id: 'fixture-league',
        p_source_season: '2025',
        p_target_season: '2026',
      }),
    )
    expect(database.from).toHaveBeenCalledTimes(1)
    await expect(response.json()).resolves.toMatchObject({
      copied_players: 2,
      success: true,
      target_season: '2026',
    })
  })

  it('returns a retryable conflict when another rollover owns the lock', async () => {
    const database = databaseWithRpc({
      data: null,
      error: { code: '55P03', message: 'Another rollover is in progress.' },
    })
    mockedCreateServerClient.mockReturnValue(
      database as unknown as ReturnType<typeof createServerSupabaseClient>,
    )

    const response = await POST(request(validBody, true), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Another season change'),
      success: false,
    })
  })

  it('carries an enabled league-level ESPN connection into the new season', async () => {
    const database = databaseWithRpc(
      {
        data: {
          copied_players: 2,
          source_season: '2025',
          success: true,
          target_season: '2026',
        },
        error: null,
      },
      {
        auto_sync_enabled: true,
        current_season: '2025',
        id: 'fixture-league',
        platform_config: {
          credentials: { espn_s2: 'stored-s2', swid: 'stored-swid' },
          private_league: true,
        },
        platform_league_id: '123456',
        platform_type: 'espn',
      },
    )
    mockedCreateServerClient.mockReturnValue(
      database as unknown as ReturnType<typeof createServerSupabaseClient>,
    )

    const response = await POST(request(validBody, true), context)

    expect(response.status).toBe(200)
    expect(database.from).toHaveBeenCalledTimes(2)
    const query = database.from.mock.results[1].value
    expect(query.update).toHaveBeenCalledWith({
      auto_sync_enabled: true,
      sync_status: 'active',
    })
    await expect(response.json()).resolves.toMatchObject({
      auto_sync_enabled: true,
      espn_connection_retained: true,
      success: true,
    })
  })
})
