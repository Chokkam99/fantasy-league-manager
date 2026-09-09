/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/adminSession'
import { requestESPNSeasonData } from '@/lib/espn/request'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { espnHistory, espnSeasonData } from '../../../../../../../../test/fixtures/espnSeason'

jest.mock('@/lib/espn/request', () => ({ ...jest.requireActual('@/lib/espn/request'), requestESPNSeasonData: jest.fn() }))
jest.mock('@/lib/supabaseServer', () => ({ ...jest.requireActual('@/lib/supabaseServer'), createServerSupabaseClient: jest.fn() }))
const secret = 'fixture-season-import-session-secret-32-characters'
const oldSecret = process.env.ADMIN_SESSION_SECRET
const context = { params: Promise.resolve({ id: 'fixture-league' }) }
const readESPN = requestESPNSeasonData as jest.Mock
function request(body: unknown, authorized = true) {
  return new NextRequest('http://localhost/api/leagues/fixture-league/seasons/espn', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...(authorized ? { Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(secret)}` } : {}) } })
}
function database() {
  const values: Record<string, unknown> = {
    leagues: { id: 'fixture-league', current_season: '2025', archived_at: null, auto_sync_enabled: false, platform_type: 'espn', platform_league_id: '123456', platform_config: { private_league: true, credentials: { espn_s2: 'secret-fixture-cookie', swid: 'secret-fixture-swid' } } },
    league_members: espnHistory,
    league_seasons: [{ season: '2025', total_weeks: 17, playoff_start_week: 15, playoff_spots: 2, divisions: null, fee_amount: 100, draft_food_cost: 0, weekly_prize_amount: 0, prize_structure: {}, archived_at: null }],
    weekly_scores: [],
  }
  const from = jest.fn((table: string) => {
    const result = { data: values[table], error: null }
    const query: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }
    for (const method of ['select','eq','order','maybeSingle']) query[method] = jest.fn().mockReturnValue(query)
    return query
  })
  const rpc = jest.fn().mockResolvedValue({ data: { success: true }, error: null })
  ;(createServerSupabaseClient as jest.Mock).mockReturnValue({ from, rpc })
  return { values, from, rpc }
}
beforeEach(() => { process.env.ADMIN_SESSION_SECRET = secret; readESPN.mockReset().mockResolvedValue(espnSeasonData); jest.clearAllMocks() })
afterAll(() => { if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = oldSecret })
it('denies shared viewers before any database or ESPN access', async () => {
  const db = database()
  expect((await POST(request({ action: 'preview' }, false), context)).status).toBe(401)
  expect((await GET(new NextRequest('http://localhost/api/leagues/fixture-league/seasons/espn'), context)).status).toBe(401)
  expect(db.from).not.toHaveBeenCalled(); expect(readESPN).not.toHaveBeenCalled()
})
it('returns only safe preview data and carries confirmed source values into one atomic write', async () => {
  const db = database()
  const response = await POST(request({ action: 'preview', season: '2026' }), context)
  expect(response.status).toBe(200)
  const payload = await response.json()
  expect(JSON.stringify(payload)).not.toContain('secret-fixture')
  expect(payload.preview.configuration.fee_amount).toBe(100)
  expect(readESPN).toHaveBeenCalledWith(expect.objectContaining({ year: 2026, espn_s2: 'secret-fixture-cookie' }))
  const result = await POST(request({ action: 'apply', season: '2026', revision: payload.preview.revision, confirmed: true }), context)
  expect(result.status).toBe(200)
  expect(db.rpc).toHaveBeenCalledTimes(1)
  expect(db.rpc.mock.calls[0][0]).toBe('import_espn_season_atomically')
  expect(db.rpc.mock.calls[0][1]).toMatchObject({ p_season: '2026', p_current_season: '2025', p_expected_members: espnHistory, p_weeks: [expect.objectContaining({ week: 1 })] })
})
it('rejects changed ESPN data and returns a refreshed preview before writing', async () => {
  const db = database()
  const initial = await (await POST(request({ action: 'preview', season: '2026' }), context)).json()
  readESPN.mockResolvedValue({ ...espnSeasonData, teams: espnSeasonData.teams.map(team => ({ ...team, name: 'Changed ' + team.name })) })
  const result = await POST(request({ action: 'apply', season: '2026', revision: initial.preview.revision, confirmed: true }), context)
  expect(result.status).toBe(409)
  expect((await result.json()).code).toBe('PREVIEW_CHANGED')
  expect(db.rpc).not.toHaveBeenCalled()
})
it('rejects archived targets and future substitution, and reports a missing migration without fallback writes', async () => {
  const db = database()
  ;(db.values.league_seasons as Array<{ archived_at: string | null }>)[0].archived_at = '2026-01-01'
  expect((await POST(request({ action: 'preview', season: '2025' }), context)).status).toBe(422)
  expect(readESPN).not.toHaveBeenCalled()
  expect((await POST(request({ action: 'preview', season: '2030' }), context)).status).toBe(422)
  ;(db.values.league_seasons as Array<{ archived_at: string | null }>)[0].archived_at = null
  const initial = await (await POST(request({ action: 'preview', season: '2026' }), context)).json()
  db.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
  const result = await POST(request({ action: 'apply', season: '2026', revision: initial.preview.revision, confirmed: true }), context)
  expect(result.status).toBe(503)
  expect((await result.json()).error).toMatch(/No changes were made/)
})
