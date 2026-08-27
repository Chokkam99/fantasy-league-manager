/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/leagues/[id]/finance/route'
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
