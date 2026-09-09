/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/adminSession'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
jest.mock('@/lib/supabaseServer', () => ({ createServerSupabaseClient: jest.fn() }))
const secret = 'fixture-money-secret-at-least-32-characters'
const original = process.env.ADMIN_SESSION_SECRET
const context = { params: Promise.resolve({ id: 'fixture' }) }
const settings = { fee_amount: 100, draft_food_cost: 0, weekly_prize_amount: 0, prize_structure: { first: 200 } }
function request(body?: unknown, authorized = true) { return new NextRequest('http://localhost/api/leagues/fixture/seasons/money?season=2026', { method: body ? 'POST' : 'GET', ...(body ? { body: JSON.stringify(body) } : {}), headers: authorized ? { Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(secret)}` } : {} }) }
function setup() {
  const values: Record<string, unknown> = { league_seasons: { ...settings, total_weeks: 17, archived_at: null }, league_members: [{ id: 'one' }, { id: 'two' }], leagues: { archived_at: null } }
  const from = jest.fn((table: string) => {
    const query: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: values[table], error: null }).then(resolve) }
    for (const method of ['select', 'eq', 'maybeSingle']) query[method] = jest.fn().mockReturnValue(query)
    return query
  })
  const rpc = jest.fn().mockResolvedValue({ data: { success: true }, error: null })
  ;(createServerSupabaseClient as jest.Mock).mockReturnValue({ from, rpc })
  return { from, rpc, values }
}
beforeEach(() => { process.env.ADMIN_SESSION_SECRET = secret })
afterAll(() => { if (original === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = original })
it('denies shared access before reading or writing money settings', async () => {
  const db = setup()
  expect((await GET(request(undefined, false), context)).status).toBe(401)
  expect((await POST(request({ settings }, false), context)).status).toBe(401)
  expect(db.from).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled()
})
it('validates cents, rejects stale revisions, and uses a single atomic save for over-budget settings', async () => {
  const db = setup()
  const preview = await (await GET(request(), context)).json()
  expect((await POST(request({ season: '2026', revision: preview.revision, settings: { ...settings, fee_amount: 1.234 } }), context)).status).toBe(422)
  expect((await POST(request({ season: '2026', revision: 'stale', settings }), context)).status).toBe(409)
  expect(db.rpc).not.toHaveBeenCalled()
  const result = await POST(request({ season: '2026', revision: preview.revision, settings: { ...settings, fee_amount: 10 } }), context)
  expect(result.status).toBe(200)
  expect(db.rpc).toHaveBeenCalledWith('update_season_money_atomically', expect.objectContaining({ p_expected: settings, p_settings: { ...settings, fee_amount: 10 } }))
})
it('fails cleanly when the migration is missing and rejects archived writes', async () => {
  const db = setup(); const preview = await (await GET(request(), context)).json()
  db.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
  expect((await POST(request({ season: '2026', revision: preview.revision, settings }), context)).status).toBe(503)
  db.values.leagues = { archived_at: '2026-01-01' }; db.rpc.mockClear()
  expect((await POST(request({ season: '2026', revision: preview.revision, settings }), context)).status).toBe(409)
  expect(db.rpc).not.toHaveBeenCalled()
})
