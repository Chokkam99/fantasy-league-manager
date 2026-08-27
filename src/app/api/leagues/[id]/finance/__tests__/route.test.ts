/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/leagues/[id]/finance/route'
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/adminSession'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

jest.mock('@/lib/supabaseServer', () => {
  const actual = jest.requireActual('@/lib/supabaseServer')
  return {
    ...actual,
    createServerSupabaseClient: jest.fn(),
  }
})

const mockedCreateServerClient =
  createServerSupabaseClient as jest.MockedFunction<
    typeof createServerSupabaseClient
  >

const sessionSecret = 'test-session-secret-with-at-least-32-characters'
const originalSessionSecret = process.env.ADMIN_SESSION_SECRET
const memberId = '123e4567-e89b-42d3-a456-426614174000'
const context = { params: Promise.resolve({ id: 'fixture-league' }) }

function request(body: string, authorized = false) {
  return new NextRequest('http://localhost/api/leagues/fixture-league/finance', {
    body,
    headers: {
      'Content-Type': 'application/json',
      ...(authorized
        ? {
            Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(sessionSecret)}`,
          }
        : {}),
    },
    method: 'POST',
  })
}

function getRequest(authorized = false) {
  return new NextRequest(
    'http://localhost/api/leagues/fixture-league/finance?season=2026',
    {
      headers: authorized
        ? {
            Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(sessionSecret)}`,
          }
        : undefined,
    },
  )
}

function resultQuery(data: unknown) {
  const result = { data, error: null }
  const query = {
    eq: jest.fn(),
    is: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    order: jest.fn(),
    select: jest.fn(),
    then: (
      resolve: (value: typeof result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.order.mockReturnValue(query)
  return query
}

describe('finance route authorization', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = sessionSecret
    mockedCreateServerClient.mockReset()
  })

  afterAll(() => {
    if (originalSessionSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSessionSecret
    }
  })

  it('rejects unauthenticated updates before parsing or database access', async () => {
    const response = await POST(request('{'), context)

    expect(response.status).toBe(401)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('validates authenticated input before database access', async () => {
    const response = await POST(
      request(
        JSON.stringify({
          action: 'set_payment',
          member_id: 'bad-id',
          season: '26',
          status: 'partial',
        }),
        true,
      ),
      context,
    )

    expect(response.status).toBe(422)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('loads migrated finance records without ordering by a nonexistent column', async () => {
    const seasonQuery = resultQuery({ season: '2026' })
    const awardsQuery = resultQuery([])
    const payoutsQuery = resultQuery([])
    const paymentsQuery = resultQuery([])
    const database = {
      from: jest.fn((table: string) => {
        if (table === 'league_seasons') return seasonQuery
        if (table === 'prize_awards') return awardsQuery
        if (table === 'prize_payouts') return payoutsQuery
        if (table === 'season_payments') return paymentsQuery
        throw new Error(`Unexpected table ${table}`)
      }),
    }
    mockedCreateServerClient.mockReturnValue(database as never)

    const response = await GET(getRequest(true), context)

    expect(response.status).toBe(200)
    expect(awardsQuery.order).toHaveBeenCalledWith('award_type', {
      ascending: true,
    })
    expect(awardsQuery.order).not.toHaveBeenCalledWith(
      'display_order',
      expect.anything(),
    )
  })

  it('returns an actionable response while the finance migration is pending', async () => {
    const seasonQuery = {
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { season: '2026' },
        error: null,
      }),
      select: jest.fn(),
    }
    seasonQuery.select.mockReturnValue(seasonQuery)
    seasonQuery.eq.mockReturnValue(seasonQuery)
    const database = {
      from: jest.fn().mockReturnValue(seasonQuery),
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'Function not found' },
      }),
    }
    mockedCreateServerClient.mockReturnValue(
      database as unknown as ReturnType<typeof createServerSupabaseClient>,
    )

    const response = await POST(
      request(
        JSON.stringify({
          action: 'set_payment',
          member_id: memberId,
          season: '2026',
          status: 'paid',
        }),
        true,
      ),
      context,
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('prepared database migration'),
      success: false,
    })
  })
})
