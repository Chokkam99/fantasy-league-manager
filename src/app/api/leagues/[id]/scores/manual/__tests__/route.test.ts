/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/leagues/[id]/scores/manual/route'
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
const memberId = '123e4567-e89b-42d3-a456-426614174000'

function request(authorized = false) {
  return new NextRequest(
    'http://localhost/api/leagues/fixture-league/scores/manual',
    {
      body: JSON.stringify({
        action: 'save_week',
        scores: [{ member_id: memberId, points: 101.5 }],
        season: '2026',
        week: 15,
      }),
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
}) {
  const seasonQuery = {
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { playoff_start_week: 15, total_weeks: 17 },
      error: null,
    }),
    select: jest.fn(),
  }
  seasonQuery.select.mockReturnValue(seasonQuery)
  seasonQuery.eq.mockReturnValue(seasonQuery)

  const membersResult = { data: [{ id: memberId }], error: null }
  const memberQuery = {
    eq: jest.fn(),
    select: jest.fn(),
    then: (
      resolve: (value: typeof membersResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(membersResult).then(resolve, reject),
  }
  memberQuery.select.mockReturnValue(memberQuery)
  memberQuery.eq.mockReturnValue(memberQuery)

  const weeklyScoresQuery = {
    upsert: jest.fn().mockResolvedValue({ error: null }),
  }

  return {
    from: jest.fn((table: string) => {
      if (table === 'league_seasons') return seasonQuery
      if (table === 'weekly_scores') return weeklyScoresQuery
      return memberQuery
    }),
    rpc: jest.fn().mockResolvedValue(result),
    weeklyScoresQuery,
  }
}

describe('atomic manual score route', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = secret
    mockedCreateServerClient.mockReset()
    mockedLifecycleBlock.mockReset().mockResolvedValue(null)
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = originalSecret
  })

  it('rejects unauthenticated saves before database access', async () => {
    const response = await POST(request(), context)

    expect(response.status).toBe(401)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('commits the validated week through one write RPC', async () => {
    const database = databaseWithRpc({
      data: {
        action: 'save_week',
        matchup_count: 1,
        score_count: 1,
        season: '2026',
        success: true,
        week: 15,
      },
      error: null,
    })
    mockedCreateServerClient.mockReturnValue(
      database as unknown as ReturnType<typeof createServerSupabaseClient>,
    )

    const response = await POST(request(true), context)

    expect(response.status).toBe(200)
    expect(database.rpc).toHaveBeenCalledWith(
      'mutate_manual_week_atomically',
      expect.objectContaining({
        p_action: 'save_week',
        p_league_id: 'fixture-league',
        p_season: '2026',
        p_week: 15,
      }),
    )
    expect(database.from).toHaveBeenCalledTimes(2)
    await expect(response.json()).resolves.toMatchObject({
      saved_scores: 1,
      success: true,
      updated_matchups: 1,
      week: 15,
    })
  })

  it('returns a retryable conflict when an ESPN import owns the week lock', async () => {
    const database = databaseWithRpc({
      data: null,
      error: {
        code: '55P03',
        message: 'A score import is already in progress.',
      },
    })
    mockedCreateServerClient.mockReturnValue(
      database as unknown as ReturnType<typeof createServerSupabaseClient>,
    )

    const response = await POST(request(true), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('already in progress'),
      success: false,
    })
  })

  it('keeps the pre-migration save path and supplies the playoff flag', async () => {
    const database = databaseWithRpc({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'mutate_manual_week_atomically was not found in the schema cache',
      },
    })
    mockedCreateServerClient.mockReturnValue(
      database as unknown as ReturnType<typeof createServerSupabaseClient>,
    )

    const response = await POST(request(true), context)

    expect(response.status).toBe(200)
    expect(database.weeklyScoresQuery.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          is_playoff_week: true,
          member_id: memberId,
          week_number: 15,
        }),
      ],
      { onConflict: 'league_id,season,week_number,member_id' },
    )
  })
})
