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

it('returns every historical score even when the API caps each response at 1,000 rows', async () => {
  const scores = Array.from({ length: 1500 }, (_, index) => ({ member_id: `m${index % 12}`, points: index, week_number: 1 + Math.floor(index / 12) % 17, season: String(2021 + Math.floor(index / 204)) }))
  const ranges: Array<[string, number, number]> = []
  createDatabase.mockReturnValue({ from: (table: string) => {
    let slice: [number, number] | null = null
    const all = table === 'weekly_scores' ? scores : []
    const query: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => {
        const data = slice ? all.slice(slice[0], Math.min(slice[1] + 1, slice[0] + 1000)) : all
        return Promise.resolve({ data, count: all.length, error: null }).then(resolve)
      },
      range: jest.fn((from: number, to: number) => { slice = [from, to]; ranges.push([table, from, to]); return query }),
    }
    for (const method of ['select', 'eq', 'order']) query[method] = jest.fn().mockReturnValue(query)
    return query
  } })
  const response = await GET(request('resource=history&season=2026'), context)
  expect(response.status).toBe(200)
  expect((await response.json()).scores).toHaveLength(1500)
  expect(ranges.filter(([table]) => table === 'weekly_scores')).toEqual([['weekly_scores', 0, 999], ['weekly_scores', 1000, 1999]])
})

it('never returns raw database text from a stored sync error to league viewers', async () => {
  createDatabase.mockReturnValue({ from: (table: string) => {
    const data = table === 'leagues'
      ? { id: 'fixture-league', last_sync_error: 'relation "league_seasons" does not exist', sync_status: 'error' }
      : [{ season: '2026', archived_at: null }]
    const result = { data, error: null }
    const query: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }
    for (const method of ['select', 'eq']) query[method] = jest.fn().mockReturnValue(query)
    query.single = jest.fn().mockResolvedValue(result)
    return query
  } })
  const response = await GET(request('resource=shell&season=2026'), context)
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.league.sync_status).toBe('error')
  expect(body.league.last_sync_error).toEqual(expect.any(String))
  expect(JSON.stringify(body)).not.toMatch(/league_seasons|relation/)
})
