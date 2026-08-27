import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import type { Json } from '@/lib/database.types'
import { resolveESPNConfig } from '@/lib/espn/config'
import { ESPNImportService } from '@/lib/espn/import'
import {
  isCompleteTeamMappingSubmission,
  parseTeamMappingInput,
  withSeasonTeamMappings,
} from '@/lib/espn/team-mapping-config'
import { getLifecycleWriteBlock } from '@/lib/lifecycleServer'
import { validateActiveSeasonAccess } from '@/lib/seasonAccess'
import {
  type AppSupabaseClient,
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface MappingRequestBody {
  mappings?: unknown
  season?: string
}

export const dynamic = 'force-dynamic'

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message, success: false }, { status })
}

function isAuthorized(request: NextRequest) {
  return isValidAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET,
  )
}

async function loadContext(
  database: AppSupabaseClient,
  leagueId: string,
  season: string,
) {
  const [leagueResult, seasonResult] = await Promise.all([
    database
      .from('leagues')
      .select(`
        current_season,
        espn_league_id,
        espn_s2,
        espn_swid,
        platform_config,
        platform_league_id,
        platform_type
      `)
      .eq('id', leagueId)
      .maybeSingle(),
    database
      .from('league_seasons')
      .select('season')
      .eq('league_id', leagueId)
      .eq('season', season)
      .maybeSingle(),
  ])

  if (leagueResult.error) throw leagueResult.error
  if (seasonResult.error) throw seasonResult.error
  if (!leagueResult.data) return { error: errorResponse('League not found.', 404) }

  const access = validateActiveSeasonAccess(
    season,
    leagueResult.data.current_season,
  )
  if (!access.allowed) return { error: errorResponse(access.message, 409) }
  if (!seasonResult.data) return { error: errorResponse('Season not found.', 404) }

  const config = resolveESPNConfig(leagueResult.data)
  if (!config) {
    return {
      error: errorResponse('Connect this league to ESPN before mapping teams.', 409),
    }
  }

  return { config, league: leagueResult.data }
}

function validSeason(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}$/.test(value))
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  const season = request.nextUrl.searchParams.get('season')
  if (!validSeason(season)) return errorResponse('A valid season is required.', 400)

  const { id: leagueId } = await context.params

  try {
    const database = createServerSupabaseClient()
    const mappingContext = await loadContext(database, leagueId, season)
    if ('error' in mappingContext) return mappingContext.error

    const service = new ESPNImportService(
      leagueId,
      season,
      mappingContext.config,
      database,
    )
    const mapping = await service.getTeamMappingSnapshot()

    return NextResponse.json({ mapping, success: true })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error ? error.message : 'Team mapping could not be loaded.'
    console.error(`ESPN team mapping load failed for ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  let body: MappingRequestBody
  try {
    body = (await request.json()) as MappingRequestBody
  } catch {
    return errorResponse('The team mapping request is not valid JSON.', 400)
  }

  if (!validSeason(body.season)) {
    return errorResponse('A valid season is required.', 400)
  }

  const mappings = parseTeamMappingInput(body.mappings)
  if (!mappings) {
    return errorResponse('Assign every ESPN team to a league player.', 422)
  }

  const { id: leagueId } = await context.params

  try {
    const database = createServerSupabaseClient()
    const lifecycleBlock = await getLifecycleWriteBlock(
      database,
      leagueId,
      body.season,
    )
    if (lifecycleBlock) return errorResponse(lifecycleBlock, 409)
    const mappingContext = await loadContext(database, leagueId, body.season)
    if ('error' in mappingContext) return mappingContext.error

    const service = new ESPNImportService(
      leagueId,
      body.season,
      mappingContext.config,
      database,
    )
    const mapping = await service.getTeamMappingSnapshot(mappings)

    if (!isCompleteTeamMappingSubmission(mapping, mappings)) {
      return NextResponse.json(
        {
          error: 'Each current ESPN team must have one unique league player.',
          mapping,
          success: false,
        },
        { status: 422 },
      )
    }

    const platformConfig = withSeasonTeamMappings(
      mappingContext.league.platform_config,
      body.season,
      mappings,
    ) as Json
    const { error: updateError } = await database
      .from('leagues')
      .update({ platform_config: platformConfig })
      .eq('id', leagueId)

    if (updateError) throw updateError

    return NextResponse.json({
      mapping,
      message: `${mapping.assignments.length} ESPN team assignments saved for ${body.season}.`,
      success: true,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error ? error.message : 'Team mapping could not be saved.'
    console.error(`ESPN team mapping save failed for ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}
