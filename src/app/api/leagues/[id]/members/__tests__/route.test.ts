/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/adminSession'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

jest.mock('@/lib/supabaseServer', () => ({
  createServerSupabaseClient: jest.fn(),
  isServerSupabaseConfigurationError: () => false,
}))
jest.mock('@/lib/lifecycleServer', () => ({ getLifecycleWriteBlock: jest.fn().mockResolvedValue(null) }))

const secret = 'fixture-members-secret-at-least-32-characters'
const original = process.env.ADMIN_SESSION_SECRET
const context = { params: Promise.resolve({ id: 'fixture' }) }
const removed = { id: '00000000-0000-4000-8000-000000000a11', manager_id: '00000000-0000-4000-8000-000000000a12', manager_name: 'Alex', team_name: 'Old Team', season: '2026', is_active: false, payment_status: 'paid' }
const reactivated = { ...removed, is_active: true }

function request(body: unknown, authorized = true) {
  return new NextRequest('http://localhost/api/leagues/fixture/members', {
    body: JSON.stringify(body),
    headers: authorized ? { Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession(secret)}` } : {},
    method: 'POST',
  })
}

function setup() {
  const updates: Array<Record<string, unknown>> = []
  const inserts: Array<Record<string, unknown>> = []
  const from = jest.fn((table: string) => {
    let single = false
    const query: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => {
        const data = table === 'league_seasons'
          ? { season: '2026' }
          : updates.length ? reactivated : single ? removed : [removed]
        return Promise.resolve({ data, error: null }).then(resolve)
      },
    }
    for (const method of ['select', 'eq', 'limit']) query[method] = jest.fn().mockReturnValue(query)
    for (const method of ['maybeSingle', 'single']) query[method] = jest.fn(() => { single = true; return query })
    query.update = jest.fn((values: Record<string, unknown>) => { updates.push(values); return query })
    query.insert = jest.fn((values: Record<string, unknown>) => { inserts.push(values); return query })
    return query
  })
  const rpc = jest.fn().mockResolvedValue({ data: { success: true, member: reactivated }, error: null })
  ;(createServerSupabaseClient as jest.Mock).mockReturnValue({ from, rpc })
  return { from, inserts, rpc, updates }
}

beforeEach(() => { process.env.ADMIN_SESSION_SECRET = secret })
afterAll(() => {
  if (original === undefined) delete process.env.ADMIN_SESSION_SECRET
  else process.env.ADMIN_SESSION_SECRET = original
})

it('requires commissioner sign-in before touching players', async () => {
  const db = setup()
  const response = await POST(request({ action: 'activate', member_id: removed.id, season: '2026' }, false), context)
  expect(response.status).toBe(401)
  expect(db.from).not.toHaveBeenCalled()
  expect(db.rpc).not.toHaveBeenCalled()
})

it('re-adds a removed player through the receipt-preserving reactivation', async () => {
  const db = setup()
  const response = await POST(request({ action: 'activate', member_id: removed.id, season: '2026' }), context)
  expect(response.status).toBe(200)
  expect((await response.json()).member).toEqual(reactivated)
  expect(db.rpc).toHaveBeenCalledWith('reactivate_league_member_atomically', {
    p_league_id: 'fixture', p_member_id: removed.id, p_season: '2026', p_team_name: null,
  })
  expect(db.updates).toEqual([])
  expect(db.inserts).toEqual([])
})

it('re-adds a player by name with the new team name', async () => {
  const db = setup()
  const response = await POST(request({ action: 'add', manager_name: 'Alex', season: '2026', team_name: 'New Team' }), context)
  expect(response.status).toBe(200)
  expect(db.rpc).toHaveBeenCalledWith('reactivate_league_member_atomically', expect.objectContaining({
    p_member_id: removed.id, p_team_name: 'New Team',
  }))
  expect(db.inserts).toEqual([])
})

it('falls back to a reactivation that never writes the dues status before the migration', async () => {
  const db = setup()
  db.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } })
  const response = await POST(request({ action: 'add', manager_name: 'Alex', season: '2026', team_name: 'New Team' }), context)
  expect(response.status).toBe(200)
  expect(db.updates).toEqual([{ is_active: true, team_name: 'New Team' }])
  expect(db.updates[0]).not.toHaveProperty('payment_status')
})

it('reports a concurrent reactivation as a conflict', async () => {
  const db = setup()
  db.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'Alex is already active in 2026.' } })
  const response = await POST(request({ action: 'activate', member_id: removed.id, season: '2026' }), context)
  expect(response.status).toBe(409)
  expect((await response.json()).error).toContain('already active')
  expect(db.updates).toEqual([])
})
