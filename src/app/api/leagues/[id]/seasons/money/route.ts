import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { validateSeasonMoney } from '@/lib/seasonMoney'
import type { Json } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
const fail = (error: string, status = 422) => NextResponse.json({ success: false, error }, { status })
const authorized = (request: NextRequest) => isValidAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, process.env.ADMIN_SESSION_SECRET)

async function readSettings(id: string, season: string) {
  const database = createServerSupabaseClient()
  const [configuration, roster, league] = await Promise.all([
    database.from('league_seasons').select('fee_amount, draft_food_cost, weekly_prize_amount, prize_structure, total_weeks, archived_at').eq('league_id', id).eq('season', season).maybeSingle(),
    database.from('league_members').select('id').eq('league_id', id).eq('season', season).eq('is_active', true),
    database.from('leagues').select('archived_at').eq('id', id).maybeSingle(),
  ])
  if (configuration.error || roster.error || league.error) throw new Error('Season money settings could not be loaded.')
  if (!configuration.data || !league.data) return null
  const { total_weeks, archived_at, ...expected } = configuration.data
  const settings = { fee_amount: expected.fee_amount || 0, draft_food_cost: expected.draft_food_cost || 0, weekly_prize_amount: expected.weekly_prize_amount || 0, prize_structure: expected.prize_structure || {} }
  return { database, expected, payload: { settings, total_weeks, player_count: roster.data?.length || 0, archived: Boolean(archived_at || league.data.archived_at), revision: createHash('sha256').update(JSON.stringify(expected)).digest('hex') } }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return fail('Commissioner sign-in is required.', 401)
  const season = request.nextUrl.searchParams.get('season') || ''
  if (!/^\d{4}$/.test(season)) return fail('Choose a valid season.', 400)
  try {
    const current = await readSettings((await context.params).id, season)
    return current ? NextResponse.json({ success: true, ...current.payload }) : fail('Season not found.', 404)
  } catch { return fail('Season money settings could not be loaded. Try again.', 503) }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return fail('Commissioner sign-in is required.', 401)
  try {
    const body = await request.json()
    const settings = validateSeasonMoney(body.settings)
    if (!settings || typeof body.season !== 'string' || !/^\d{4}$/.test(body.season)) return fail('Enter valid amounts with at most two decimal places.')
    const { id } = await context.params
    const current = await readSettings(id, body.season)
    if (!current) return fail('Season not found.', 404)
    if (current.payload.archived) return fail('Restore this league or season in League Settings before editing.', 409)
    if (body.revision !== current.payload.revision) return fail('Money settings changed. Reload them before saving.', 409)
    const result = await current.database.rpc('update_season_money_atomically', { p_league_id: id, p_season: body.season, p_settings: settings as unknown as Json, p_expected: current.expected as Json })
    if (result.error) {
      if (['PGRST202', '42883'].includes(result.error.code)) return fail('Money editing needs the pending database update. No changes were made.', 503)
      if (['40001', '40P01', '55P03'].includes(result.error.code)) return fail('The season changed while saving. Reload money settings and try again.', 409)
      return fail(result.error.message)
    }
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data) || result.data.success !== true) return fail('The database did not confirm the update.', 503)
    return NextResponse.json({ success: true, season: body.season })
  } catch { return fail('Money settings could not be saved. Check the values and try again.') }
}
