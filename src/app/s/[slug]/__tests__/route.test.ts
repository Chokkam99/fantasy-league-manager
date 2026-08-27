/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/s/[slug]/route'
import { PLAYER_SHARE_COOKIE } from '@/lib/shareAccess'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

jest.mock('@/lib/supabaseServer', () => {
  const actual = jest.requireActual('@/lib/supabaseServer')
  return { ...actual, createServerSupabaseClient: jest.fn() }
})

const mockedCreateServerClient =
  createServerSupabaseClient as jest.MockedFunction<
    typeof createServerSupabaseClient
  >

describe('short player link', () => {
  beforeEach(() => mockedCreateServerClient.mockReset())

  it('rejects malformed slugs before database access', async () => {
    const response = await GET(
      new NextRequest('http://localhost/s/short'),
      { params: Promise.resolve({ slug: 'short' }) },
    )

    expect(response.status).toBe(404)
    expect(mockedCreateServerClient).not.toHaveBeenCalled()
  })

  it('sets protected player access and redirects to the scoped season', async () => {
    const query = {
      eq: jest.fn(),
      is: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { league_id: 'friends-league', season: '2026' },
        error: null,
      }),
      select: jest.fn(),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.is.mockReturnValue(query)
    mockedCreateServerClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as never)

    const slug = 'a'.repeat(12)
    const response = await GET(
      new NextRequest(`http://localhost/s/${slug}`),
      { params: Promise.resolve({ slug }) },
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/league/friends-league?season=2026',
    )
    expect(response.cookies.get(PLAYER_SHARE_COOKIE)).toMatchObject({
      httpOnly: true,
      value: slug,
    })
  })
})
