/** @jest-environment node */

import { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/adminSession'
import {
  authorizeLeagueRead,
  digestShareToken,
} from '@/lib/shareAccessServer'
import type { AppSupabaseClient } from '@/lib/supabaseServer'

const token = 'a'.repeat(43)
const secret = 'share-access-test-secret-with-32-characters'
const originalSecret = process.env.ADMIN_SESSION_SECRET

function request(url = `http://localhost/league/friends?season=2026&share=${token}`, cookie?: string) {
  return new NextRequest(url, {
    headers: cookie ? { Cookie: cookie } : undefined,
  })
}

function databaseResult(data: unknown, error: unknown = null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data, error })
  const query = {
    eq: jest.fn(),
    is: jest.fn(),
    maybeSingle,
    select: jest.fn(),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  const from = jest.fn().mockReturnValue(query)

  return {
    database: { from } as unknown as AppSupabaseClient,
    from,
    query,
  }
}

describe('server league-read authorization', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = secret
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = originalSecret
  })

  it('allows a signed commissioner without consulting share-link storage', async () => {
    const database = databaseResult(null)
    const cookie = `${ADMIN_SESSION_COOKIE}=${createAdminSession(secret)}`

    await expect(
      authorizeLeagueRead(request(undefined, cookie), database.database, 'friends', '2026'),
    ).resolves.toEqual({
      access: { kind: 'commissioner' },
      error: null,
      status: 200,
    })
    expect(database.from).not.toHaveBeenCalled()
  })

  it('rejects missing or malformed league grants before database access', async () => {
    const database = databaseResult(null)

    await expect(
      authorizeLeagueRead(
        request('http://localhost/league/friends?season=2026&share=short'),
        database.database,
        'friends',
        '2026',
      ),
    ).resolves.toMatchObject({ access: null, status: 401 })
    expect(database.from).not.toHaveBeenCalled()
  })

  it('allows the normal league path as a public read-only view', async () => {
    const database = databaseResult(null)

    await expect(
      authorizeLeagueRead(
        request('http://localhost/league/friends'),
        database.database,
        'friends',
        '2026',
      ),
    ).resolves.toEqual({
      access: { kind: 'public' },
      error: null,
      status: 200,
    })
    expect(database.from).not.toHaveBeenCalled()
  })

  it.each(['short', 'a'.repeat(12), 'a'.repeat(43)])('ignores ambient legacy cookies on normal public URLs (%s)', async (cookie) => {
    const database = databaseResult(null)
    await expect(authorizeLeagueRead(
      request('http://localhost/league/another-league?season=2025', `flm-player-share=${cookie}`),
      database.database, 'another-league', '2025',
    )).resolves.toMatchObject({ access: { kind: 'public' }, status: 200 })
    expect(database.from).not.toHaveBeenCalled()
  })

  it('authorizes a legacy link only for its exact league and season', async () => {
    const database = databaseResult({ id: 'link-id', season: '2026' })

    await expect(
      authorizeLeagueRead(request(), database.database, 'friends', '2026'),
    ).resolves.toEqual({
      access: { kind: 'share', linkId: 'link-id', season: '2026' },
      error: null,
      status: 200,
    })
    expect(database.from).toHaveBeenCalledWith('league_share_links')
    expect(database.query.eq).toHaveBeenNthCalledWith(1, 'league_id', 'friends')
    expect(database.query.eq).toHaveBeenNthCalledWith(2, 'season', '2026')
    expect(database.query.eq).toHaveBeenNthCalledWith(3, 'token_digest', digestShareToken(token))
    expect(database.query.is).toHaveBeenCalledWith('revoked_at', null)
    expect(JSON.stringify(database.query.eq.mock.calls)).not.toContain(token)
  })

  it('rejects unknown, cross-season, or revoked legacy links', async () => {
    const database = databaseResult({ id: 'legacy-link', season: '2026' })

    await expect(
      authorizeLeagueRead(request(), database.database, 'friends', '2025'),
    ).resolves.toMatchObject({
      access: null,
      status: 403,
    })
  })

  it('reports the prepared migration requirement without exposing database details', async () => {
    const database = databaseResult(null, {
      code: '42P01',
      message: 'relation public.league_share_links does not exist',
    })

    await expect(
      authorizeLeagueRead(request(), database.database, 'friends', '2026'),
    ).resolves.toEqual({
      access: null,
      error: 'League links are not available yet. Your league data is unaffected.',
      status: 409,
    })
  })
})
