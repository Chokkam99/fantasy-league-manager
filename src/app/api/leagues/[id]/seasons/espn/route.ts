import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { validateAutomationSettings } from '@/lib/automationSettings'
import { resolveESPNConfig } from '@/lib/espn/config'
import { ESPNRequestError, requestESPNSeasonData } from '@/lib/espn/request'
import { parseESPNSeasonSnapshot, record, type SeasonImportMember } from '@/lib/espn/seasonSnapshot'
import { configurationForImport, resolveSeasonImport, type SeasonImportPreview } from '@/lib/espn/seasonImport'
import { createServerSupabaseClient, type AppSupabaseClient, isServerSupabaseConfigurationError } from '@/lib/supabaseServer'
import type { Json } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
const fail = (error: string, status = 422) => NextResponse.json({ success: false, error }, { status })
const authorized = (request: NextRequest) => isValidAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, process.env.ADMIN_SESSION_SECRET)
const memberColumns = 'id, manager_id, manager_name, team_name, season, is_active, division' as const
const configColumns = 'season, total_weeks, playoff_start_week, playoff_spots, divisions, fee_amount, draft_food_cost, weekly_prize_amount, prize_structure, archived_at' as const
async function contextFor(database: AppSupabaseClient, leagueId: string, requested: unknown) {
  const leagueResult = await database.from('leagues').select('id, current_season, archived_at, auto_sync_enabled, platform_type, platform_league_id, platform_config, espn_league_id, espn_s2, espn_swid').eq('id', leagueId).maybeSingle()
  if (leagueResult.error) throw leagueResult.error
  const league = leagueResult.data
  if (!league) throw new Error('League not found.')
  if (league.archived_at) throw new Error('Restore the archived league before importing.')
  const season = typeof requested === 'string' ? requested : String(Number(league.current_season) + 1)
  if (!/^\d{4}$/.test(season) || Number(season) < 2000 || Number(season) > Number(league.current_season) + 1) throw new Error('Choose an ESPN season up to the next league season.')
  const [members, seasons, scores] = await Promise.all([
    database.from('league_members').select(memberColumns).eq('league_id', leagueId).order('id'),
    database.from('league_seasons').select(configColumns).eq('league_id', leagueId).order('season'),
    database.from('weekly_scores').select('week_number, member_id, points, is_final_score, week_status').eq('league_id', leagueId).eq('season', season).order('week_number').order('member_id'),
  ])
  if (members.error || seasons.error || scores.error) throw members.error || seasons.error || scores.error
  const target = seasons.data?.find(value => value.season === season)
  if (target?.archived_at) throw new Error(`${season} is archived. Restore it in League Settings before importing.`)
  return { league, season, history: (members.data || []) as SeasonImportMember[], seasons: seasons.data || [], target, scores: scores.data || [], existingWeeks: [...new Set((scores.data || []).map(score => score.week_number))].sort((a,b) => a-b) }
}
export async function GET(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return fail('Commissioner sign-in is required.', 401)
  try {
    const { id } = await route.params
    const context = await contextFor(createServerSupabaseClient(), id, request.nextUrl.searchParams.get('season') || undefined)
    const config = resolveESPNConfig(context.league)
    return NextResponse.json({ success: true, season: context.season, current_season: context.league.current_season, exists: Boolean(context.target), connection: { is_configured: Boolean(config), league_id: config?.league_id || '', private_league: Boolean(config?.private_league), has_credentials: Boolean(config?.espn_s2 && config?.swid) } })
  } catch (error) { return failure(error) }
}
function failure(error: unknown) {
  return fail(error instanceof Error ? error.message : 'Season import could not be completed.', isServerSupabaseConfigurationError(error) ? 503 : error instanceof ESPNRequestError ? error.status : 422)
}
export async function POST(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return fail('Commissioner sign-in is required.', 401)
  let body: Record<string, unknown>
  try { body = record(await request.json()) } catch { return fail('The season import request is not valid JSON.', 400) }
  if (!['preview', 'apply'].includes(String(body.action))) return fail('Choose preview or apply.', 400)
  try {
    const { id } = await route.params
    const database = createServerSupabaseClient()
    const context = await contextFor(database, id, body.season)
    const saved = resolveESPNConfig(context.league)
    const supplied = record(body.connection)
    const connectionValidation = validateAutomationSettings({ league_id: saved?.league_id || '', private_league: Boolean(saved?.private_league), ...supplied, season: context.season, auto_sync_enabled: false })
    if (!connectionValidation.is_valid) return fail(connectionValidation.errors[0])
    const value = connectionValidation.value
    const sameConnection = saved?.league_id === value.league_id
    const config = { league_id: value.league_id, year: Number(context.season), private_league: value.private_league,
      espn_s2: value.private_league ? value.espn_s2 || (sameConnection ? saved?.espn_s2 : undefined) : undefined,
      swid: value.private_league ? value.swid || (sameConnection ? saved?.swid : undefined) : undefined }
    if (config.private_league && (!config.espn_s2 || !config.swid)) return fail('This private ESPN league needs its ESPN_S2 and SWID cookies.')
    const data = await requestESPNSeasonData(config)
    const platform = record(context.league.platform_config)
    const espn = parseESPNSeasonSnapshot(data, context.season, context.history, sameConnection ? platform : {}, config.league_id)
    const source = context.target || (Number(context.season) > Number(context.league.current_season) ? context.seasons.find(value => value.season === context.league.current_season) : undefined)
    const configuration = configurationForImport(espn, source)
    const preview: SeasonImportPreview = {
      revision: createHash('sha256').update(JSON.stringify({ espn, history: context.history, seasons: context.seasons, scores: context.scores, current: context.league.current_season, connection: config.league_id, platform })).digest('hex'),
      season: context.season, current_season: context.league.current_season!, exists: Boolean(context.target), espn, history: context.history, configuration,
      missing_fields: Object.entries(espn.format).filter(([,value]) => value === null).map(([key]) => key),
      local_only: context.history.filter(member => member.season === context.season && member.is_active !== false && !espn.teams.some(team => { const sourceMember = context.history.find(value => value.id === team.source_member_id); return sourceMember && (sourceMember.manager_id ? sourceMember.manager_id === member.manager_id : sourceMember.id === member.id) })),
      existing_weeks: context.existingWeeks,
    }
    if (body.action === 'preview') return NextResponse.json({ success: true, preview })
    if (body.confirmed !== true) return fail('Review the import before applying it.')
    if (body.revision !== preview.revision) return NextResponse.json({ success: false, code: 'PREVIEW_CHANGED', error: 'ESPN or league data changed. Review the refreshed import before applying it.', preview }, { status: 409 })
    const resolved = resolveSeasonImport(preview, body)
    if (resolved.errors.length) return fail(resolved.errors[0])
    const nextPlatform = { ...platform, league_id: config.league_id, private_league: Boolean(config.private_league), credentials: config.private_league ? { espn_s2: config.espn_s2, swid: config.swid } : {}, ...(sameConnection ? {} : { team_mappings: {} }) }
    const result = await database.rpc('import_espn_season_atomically', {
      p_league_id: id, p_season: context.season, p_current_season: context.league.current_season!,
      p_configuration: resolved.configuration as unknown as Json, p_teams: resolved.teams as unknown as Json, p_weeks: espn.weeks as unknown as Json,
      p_expected_scores: context.scores as unknown as Json,
      p_expected_members: context.history as unknown as Json, p_expected_seasons: context.seasons as unknown as Json,
      p_platform_config: nextPlatform as unknown as Json, p_expected_platform: context.league.platform_config as Json,
    })
    if (result.error) {
      if (result.error.code === 'PGRST202' || result.error.code === '42883') return fail('Season imports need the pending database update. No changes were made.', 503)
      if (['40001','55P03'].includes(result.error.code || '')) return fail('The league changed during import. Refresh the ESPN preview and try again.', 409)
      throw new Error(result.error.message)
    }
    if (record(result.data).success !== true) throw new Error('The database did not confirm the season import.')
    return NextResponse.json({ success: true, season: context.season, imported_weeks: espn.weeks.length, players: resolved.teams.length, warnings: espn.warnings })
  } catch (error) { return failure(error) }
}
