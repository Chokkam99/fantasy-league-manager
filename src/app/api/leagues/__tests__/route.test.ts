/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/leagues/route'
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
} from '@/lib/adminSession'
import {
  createServerSupabaseClient,
  ServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

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

function request(
  body: string,
  authorized = false,
  sessionValue?: string,
) {
  return new NextRequest('http://localhost/api/leagues', {
    body,
    headers: {
      'Content-Type': 'application/json',
      ...(authorized
        ? {
            Cookie: `${ADMIN_SESSION_COOKIE}=${sessionValue ?? createAdminSession(sessionSecret)}`,
          }
        : {}),
    },
    method: 'POST',
  })
}

describe('league creation route authorization', () => {
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

  it('rejects unauthenticated requests before parsing or database access', async () => {
    const response = await POST(request('{'))

    expect(response.status).toBe(401)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('rejects the legacy password-hash cookie before database access', async () => {
    const response = await POST(
      request(
        JSON.stringify({
          fee_amount: 100,
          name: 'Friends League',
          season: '2026',
        }),
        true,
        'configured-hash',
      ),
    )

    expect(response.status).toBe(401)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('validates authenticated input before database access', async () => {
    const response = await POST(
      request(JSON.stringify({ fee_amount: -1, name: '', season: '26' }), true),
    )

    expect(response.status).toBe(422)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('fails closed when privileged server access is not configured', async () => {
    mockedCreateServerClient.mockImplementation(() => {
      throw new ServerSupabaseConfigurationError()
    })

    const response = await POST(
      request(
        JSON.stringify({
          fee_amount: 100,
          name: 'Friends League',
          season: '2026',
        }),
        true,
      ),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Server database access is not configured.',
      success: false,
    })
  })
})
