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
import { requestESPNOnboardingData } from '@/lib/espn/request'

jest.mock('@/lib/supabaseServer', () => {
  const actual = jest.requireActual('@/lib/supabaseServer')
  return {
    ...actual,
    createServerSupabaseClient: jest.fn(),
  }
})

jest.mock('@/lib/espn/request', () => {
  const actual = jest.requireActual('@/lib/espn/request')
  return { ...actual, requestESPNOnboardingData: jest.fn() }
})

const mockedCreateServerClient =
  createServerSupabaseClient as jest.MockedFunction<
    typeof createServerSupabaseClient
  >
const mockedRequestESPNOnboardingData = requestESPNOnboardingData as jest.MockedFunction<typeof requestESPNOnboardingData>

const sessionSecret = 'test-session-secret-with-at-least-32-characters'
const originalSessionSecret = process.env.ADMIN_SESSION_SECRET
const originalCronSecret = process.env.CRON_SECRET

const validBody = {
  configuration: {
    divisions: [],
    draft_food_cost: 20,
    fee_amount: 100,
    playoff_spots: 2,
    playoff_start_week: 15,
    prize_structure: { first: 150, second: 30 },
    total_weeks: 17,
    weekly_prize_amount: 0,
  },
  espn_connection: null,
  id: 'friends-league',
  members: [
    { division: null, espn_team_id: null, manager_name: 'Alex', team_name: 'A Team' },
    { division: null, espn_team_id: null, manager_name: 'Blake', team_name: 'B Team' },
  ],
  name: 'Friends League',
  season: '2026',
}

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
    mockedRequestESPNOnboardingData.mockReset()
  })

  afterAll(() => {
    if (originalSessionSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSessionSecret
    }
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
  })

  it('rejects unauthenticated requests before parsing or database access', async () => {
    const response = await POST(request('{'))

    expect(response.status).toBe(401)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('rejects the legacy password-hash cookie before database access', async () => {
    const response = await POST(
      request(
        JSON.stringify(validBody),
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
        JSON.stringify(validBody),
        true,
      ),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Server database access is not configured.',
      success: false,
    })
  })

  it('creates the complete first season through one atomic RPC', async () => {
    const database = {
      rpc: jest.fn().mockResolvedValue({
        data: {
          league_id: 'friends-league',
          member_count: 2,
          season: '2026',
          success: true,
        },
        error: null,
      }),
    }
    mockedCreateServerClient.mockReturnValue(
      database as unknown as ReturnType<typeof createServerSupabaseClient>,
    )

    const response = await POST(request(JSON.stringify(validBody), true))

    expect(response.status).toBe(201)
    expect(database.rpc).toHaveBeenCalledWith(
      'create_league_atomically',
      expect.objectContaining({
        p_league_id: 'friends-league',
        p_name: 'Friends League',
        p_season: '2026',
      }),
    )
    await expect(response.json()).resolves.toMatchObject({
      league: {
        current_season: '2026',
        id: 'friends-league',
        name: 'Friends League',
      },
      success: true,
    })
  })

  it('rechecks the current ESPN roster before committing its mappings', async () => {
    const database = {
      rpc: jest.fn().mockResolvedValue({
        data: { league_id: 'friends-league', member_count: 2, season: '2026', success: true },
        error: null,
      }),
    }
    mockedCreateServerClient.mockReturnValue(
      database as unknown as ReturnType<typeof createServerSupabaseClient>,
    )
    mockedRequestESPNOnboardingData.mockResolvedValue({
      settings: { name: 'Friends League' },
      teams: [{ id: 1, name: 'A Team' }, { id: 2, name: 'B Team' }],
    })

    const response = await POST(request(JSON.stringify({
      ...validBody,
      espn_connection: {
        auto_sync_enabled: false,
        league_id: '12345',
        private_league: false,
      },
      members: validBody.members.map((member, index) => ({
        ...member,
        espn_team_id: index + 1,
      })),
    }), true))

    expect(response.status).toBe(201)
    expect(mockedRequestESPNOnboardingData).toHaveBeenCalledTimes(1)
    expect(database.rpc).toHaveBeenCalledTimes(1)
  })

  it('does not enable automatic sync without cron authorization', async () => {
    delete process.env.CRON_SECRET
    mockedCreateServerClient.mockReturnValue({ rpc: jest.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>)

    const response = await POST(request(JSON.stringify({
      ...validBody,
      espn_connection: {
        auto_sync_enabled: true,
        league_id: '12345',
        private_league: false,
      },
      members: validBody.members.map((member, index) => ({
        ...member,
        espn_team_id: index + 1,
      })),
    }), true))

    expect(response.status).toBe(409)
    expect(mockedRequestESPNOnboardingData).not.toHaveBeenCalled()
  })
})
