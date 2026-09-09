/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET } from '../route'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

jest.mock('@/lib/supabaseServer', () => ({
  ...jest.requireActual('@/lib/supabaseServer'), createServerSupabaseClient: jest.fn(),
}))
const createDatabase = createServerSupabaseClient as jest.Mock
const context = { params: Promise.resolve({ id: 'fixture-league' }) }
function request(query: string, cookie?: string) {
  return new NextRequest(`http://localhost/api/leagues/fixture-league/view?${query}`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  })
}
function database(data: unknown) {
  const result = { data, error: null }
  const query = {
    select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  const from = jest.fn().mockReturnValue(query)
  createDatabase.mockReturnValue({ from })
  return { query, from }
}

it('returns a missing season as an explicit empty configuration', async () => {
  const db = database(null)
  const response = await GET(request('resource=season&season=2026'), context)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ success: true, data: null })
  expect(db.query.maybeSingle).toHaveBeenCalledTimes(1)
})

it('includes roster history on a public URL even with an unrelated legacy cookie', async () => {
  const db = database([{ id: 'current', season: '2026' }, { id: 'past', season: '2025' }])
  const response = await GET(request('resource=memberships&season=2026', 'flm-player-share=old-cookie'), context)
  expect(response.status).toBe(200)
  expect((await response.json()).data).toHaveLength(2)
  expect(db.query.eq).toHaveBeenCalledWith('league_id', 'fixture-league')
  expect(db.query.eq).not.toHaveBeenCalledWith('season', expect.anything())
  expect(db.query.select.mock.calls[0][0]).not.toMatch(/notes|payment_method|platform_config/)
})

it('rejects malformed explicit share grants before reading league records', async () => {
  const db = database([])
  const response = await GET(request('resource=memberships&season=2026&share=bad'), context)
  expect(response.status).toBe(401)
  expect(db.from).not.toHaveBeenCalled()
})

it.each([0, 2, 17])('summarizes season phase and canonical dues without exposing payment details (week %s)', async week => {
  const queries: Record<string, ReturnType<typeof jest.fn>> = {}
  const values: Record<string, unknown> = {
    league_seasons: { total_weeks: 17 }, weekly_scores: week ? [{ week_number: week }] : [],
    league_members: [{ id: 'paid', payment_status: 'pending' }, { id: 'partial', payment_status: 'paid' }],
    season_payments: [{ league_member_id: 'paid', status: 'paid' }, { league_member_id: 'partial', status: 'partial' }],
  }
  createDatabase.mockReturnValue({ from: (table: string) => {
    const result = { data: values[table], error: null }
    const query: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }
    for (const method of ['select', 'eq', 'or', 'order', 'limit', 'maybeSingle']) query[method] = jest.fn().mockReturnValue(query)
    queries[table] = query.eq as jest.Mock
    return query
  } })
  const response = await GET(request('resource=navigation&season=2026'), context)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ success: true, season: '2026', phase: week === 0 ? 'preseason' : week === 17 ? 'wrap-up' : 'in-season', playerCount: 2, duesRemaining: 1 })
  expect(queries.league_members).toHaveBeenCalledWith('is_active', true)
  for (const query of Object.values(queries)) expect(query).toHaveBeenCalledWith('season', '2026')
})
