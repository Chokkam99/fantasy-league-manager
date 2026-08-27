/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/leagues/[id]/automation/mapping/route'
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
} from '@/lib/adminSession'

const sessionSecret = 'mapping-route-test-secret-with-32-characters'
const context = { params: Promise.resolve({ id: 'league-1' }) }
const originalSessionSecret = process.env.ADMIN_SESSION_SECRET

function authorizedRequest(url: string, init?: RequestInit) {
  const session = createAdminSession(sessionSecret)
  return new NextRequest(url, {
    ...init,
    headers: {
      ...init?.headers,
      cookie: `${ADMIN_SESSION_COOKIE}=${session}`,
    },
  })
}

describe('ESPN team mapping route boundary', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = sessionSecret
  })

  afterAll(() => {
    if (originalSessionSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSessionSecret
    }
  })

  it('requires commissioner authentication for reads and writes', async () => {
    const getResponse = await GET(
      new NextRequest(
        'http://localhost/api/leagues/league-1/automation/mapping?season=2026',
      ),
      context,
    )
    const postResponse = await POST(
      new NextRequest(
        'http://localhost/api/leagues/league-1/automation/mapping',
        {
          body: JSON.stringify({ mappings: { '1': 'member-1' }, season: '2026' }),
          method: 'POST',
        },
      ),
      context,
    )

    expect(getResponse.status).toBe(401)
    expect(postResponse.status).toBe(401)
  })

  it('rejects missing seasons before loading server data', async () => {
    const response = await GET(
      authorizedRequest(
        'http://localhost/api/leagues/league-1/automation/mapping',
      ),
      context,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'A valid season is required.',
      success: false,
    })
  })

  it('rejects malformed and incomplete write payloads before loading server data', async () => {
    const malformed = await POST(
      authorizedRequest(
        'http://localhost/api/leagues/league-1/automation/mapping',
        { body: '{', method: 'POST' },
      ),
      context,
    )
    const emptyMapping = await POST(
      authorizedRequest(
        'http://localhost/api/leagues/league-1/automation/mapping',
        {
          body: JSON.stringify({ mappings: {}, season: '2026' }),
          method: 'POST',
        },
      ),
      context,
    )

    expect(malformed.status).toBe(400)
    expect(emptyMapping.status).toBe(422)
  })
})
