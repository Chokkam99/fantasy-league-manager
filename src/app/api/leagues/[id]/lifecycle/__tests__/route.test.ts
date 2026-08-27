/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/leagues/[id]/lifecycle/route'
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/adminSession'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

jest.mock('@/lib/supabaseServer', () => {
  const actual = jest.requireActual('@/lib/supabaseServer')
  return { ...actual, createServerSupabaseClient: jest.fn() }
})

const mockedCreateServerClient =
  createServerSupabaseClient as jest.MockedFunction<
    typeof createServerSupabaseClient
  >
const secret = 'test-session-secret-with-at-least-32-characters'
const originalSecret = process.env.ADMIN_SESSION_SECRET
const context = { params: Promise.resolve({ id: 'fixture-league' }) }

function request(method: 'GET' | 'POST', body?: string, authorized = false) {
  return new NextRequest('http://localhost/api/leagues/fixture-league/lifecycle', {
    body,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(authorized
        ? { Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(secret)}` }
        : {}),
    },
    method,
  })
}

describe('lifecycle route boundary', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = secret
    mockedCreateServerClient.mockReset()
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = originalSecret
  })

  it('keeps lifecycle reads and writes commissioner-only', async () => {
    expect((await GET(request('GET'), context)).status).toBe(401)
    expect((await POST(request('POST', '{'), context)).status).toBe(401)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('rejects delete-like and malformed actions before database access', async () => {
    const response = await POST(
      request(
        'POST',
        JSON.stringify({ action: 'delete_league', archived: true }),
        true,
      ),
      context,
    )

    expect(response.status).toBe(422)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('explains when the archival RPC is not active yet', async () => {
    const database = {
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
        'POST',
        JSON.stringify({ action: 'set_league_archive', archived: true }),
        true,
      ),
      context,
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('prepared lifecycle migration'),
      success: false,
    })
  })
})
