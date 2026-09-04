/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/leagues/espn-preview/route'
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/adminSession'
import { requestESPNOnboardingData } from '@/lib/espn/request'

jest.mock('@/lib/espn/request', () => {
  const actual = jest.requireActual('@/lib/espn/request')
  return { ...actual, requestESPNOnboardingData: jest.fn() }
})

const mockedRequestESPNOnboardingData = requestESPNOnboardingData as jest.MockedFunction<typeof requestESPNOnboardingData>
const secret = 'test-session-secret-with-at-least-32-characters'
const originalSecret = process.env.ADMIN_SESSION_SECRET

function request(body: unknown, authorized = false) {
  return new NextRequest('http://localhost/api/leagues/espn-preview', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      ...(authorized
        ? { Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(secret)}` }
        : {}),
    },
    method: 'POST',
  })
}

describe('new league ESPN preview route', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = secret
    mockedRequestESPNOnboardingData.mockReset()
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = originalSecret
  })

  it('rejects unauthenticated requests before ESPN access', async () => {
    const response = await POST(request({}))
    expect(response.status).toBe(401)
    expect(mockedRequestESPNOnboardingData).not.toHaveBeenCalled()
  })

  it('returns a sanitized current-season roster', async () => {
    mockedRequestESPNOnboardingData.mockResolvedValue({
      members: [{ firstName: 'Alex', id: 'owner-1', lastName: 'Smith' }],
      settings: { name: 'Friends League' },
      teams: [{ id: 1, name: 'Sunday Stars', primaryOwner: 'owner-1' }],
    })

    const response = await POST(request({
      league_id: '12345',
      private_league: false,
      season: '2026',
    }, true))

    expect(response.status).toBe(200)
    expect(mockedRequestESPNOnboardingData).toHaveBeenCalledWith(
      expect.objectContaining({ league_id: '12345', year: 2026 }),
    )
    await expect(response.json()).resolves.toMatchObject({
      snapshot: {
        league_name: 'Friends League',
        teams: [{ manager_name: 'Alex Smith', team_id: 1, team_name: 'Sunday Stars' }],
      },
      success: true,
    })
  })
})
