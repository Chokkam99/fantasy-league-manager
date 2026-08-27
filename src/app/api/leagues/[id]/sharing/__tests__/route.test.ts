/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/leagues/[id]/sharing/route'
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/adminSession'
import { digestShareToken } from '@/lib/shareAccessServer'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

jest.mock('@/lib/supabaseServer', () => {
  const actual = jest.requireActual('@/lib/supabaseServer')
  return { ...actual, createServerSupabaseClient: jest.fn() }
})

const mockedCreateServerClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>
const secret = 'share-route-test-secret-with-32-characters'
const originalSecret = process.env.ADMIN_SESSION_SECRET
const context = { params: Promise.resolve({ id: 'fixture-league' }) }

function request(body: unknown, authorized = false) {
  return new NextRequest('http://localhost/api/leagues/fixture-league/sharing', {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(authorized
        ? { Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(secret)}` }
        : {}),
    },
    method: 'POST',
  })
}

describe('legacy season share-link route', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = secret
    mockedCreateServerClient.mockReset()
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = originalSecret
  })

  it('rejects unauthenticated rotation before database access', async () => {
    const response = await POST(request({ season: '2026' }), context)
    expect(response.status).toBe(401)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON before database access', async () => {
    const malformed = new NextRequest(
      'http://localhost/api/leagues/fixture-league/sharing',
      {
        body: '{',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(secret)}`,
        },
        method: 'POST',
      },
    )
    const response = await POST(malformed, context)
    expect(response.status).toBe(400)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('returns a stable short slug while sending only its digest to the database', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { created_at: '2026-08-26T00:00:00.000Z' },
      error: null,
    })
    const query = {
      eq: jest.fn(),
      is: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn(),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.is.mockReturnValue(query)
    mockedCreateServerClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
      rpc,
    } as never)

    const response = await POST(request({ season: '2026' }, true), context)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.token).toMatch(/^[A-Za-z0-9_-]{12}$/)
    expect(payload.share_path).toBe(`/s/${payload.token}`)
    expect(rpc).toHaveBeenCalledWith(
      'rotate_league_share_link',
      {
        p_league_id: 'fixture-league',
        p_season: '2026',
        p_token_digest: digestShareToken(payload.token),
        p_token_prefix: payload.token.slice(0, 8),
      },
    )
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(payload.token)
  })
})
