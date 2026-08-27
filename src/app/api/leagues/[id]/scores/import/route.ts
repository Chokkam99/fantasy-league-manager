import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { resolveESPNConfig } from '@/lib/espn/config'
import { ESPNImportService } from '@/lib/espn/import'
import { ESPNTeamMappingError } from '@/lib/espn/name-mapper'
import { ESPNImportPersistenceError } from '@/lib/espn/persistence'
import { validateWeekImport } from '@/lib/espn/validation'
import { getLifecycleWriteBlock } from '@/lib/lifecycleServer'
import { validateActiveSeasonAccess } from '@/lib/seasonAccess'
import {
  type AppSupabaseClient,
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface ImportRequestBody {
  action?: 'preview' | 'sync'
  season?: string
  week?: number | 'latest'
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message, success: false }, { status })
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (
    !isValidAdminSession(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
      process.env.ADMIN_SESSION_SECRET,
    )
  ) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  const { id: leagueId } = await context.params
  let body: ImportRequestBody

  try {
    body = (await request.json()) as ImportRequestBody
  } catch {
    return errorResponse('The import request is not valid JSON.', 400)
  }

  const { action, season } = body

  if (action !== 'preview' && action !== 'sync') {
    return errorResponse('Choose preview or sync.', 400)
  }

  if (!season || !/^\d{4}$/.test(season)) {
    return errorResponse('A valid season is required.', 400)
  }

  let database: AppSupabaseClient | null = null

  try {
    database = createServerSupabaseClient()
    const lifecycleBlock = await getLifecycleWriteBlock(
      database,
      leagueId,
      season,
    )
    if (lifecycleBlock) return errorResponse(lifecycleBlock, 409)
    const leagueResult = await database
      .from('leagues')
      .select(`
        id,
        current_season,
        espn_league_id,
        espn_s2,
        espn_swid,
        platform_config,
        platform_league_id,
        platform_type
      `)
      .eq('id', leagueId)
      .maybeSingle()

    if (leagueResult.error) throw leagueResult.error
    if (!leagueResult.data) return errorResponse('League not found.', 404)

    const seasonAccess = validateActiveSeasonAccess(
      season,
      leagueResult.data.current_season,
    )
    if (!seasonAccess.allowed) {
      return errorResponse(seasonAccess.message, 409)
    }

    const [seasonResult, membersResult] = await Promise.all([
      database
        .from('league_seasons')
        .select('season, total_weeks')
        .eq('league_id', leagueId)
        .eq('season', season)
        .maybeSingle(),
      database
        .from('league_members')
        .select('id')
        .eq('league_id', leagueId)
        .eq('season', season)
        .eq('is_active', true),
    ])

    if (seasonResult.error) throw seasonResult.error
    if (membersResult.error) throw membersResult.error
    if (!seasonResult.data) return errorResponse('Season not found.', 404)

    const espnConfig = resolveESPNConfig(leagueResult.data)

    if (!espnConfig) {
      return errorResponse('Connect this league to ESPN before importing.', 409)
    }

    const maximumWeek = seasonResult.data.total_weeks || 17
    const requestedWeek = body.week ?? 'latest'

    if (
      requestedWeek !== 'latest' &&
      (!Number.isInteger(requestedWeek) ||
        requestedWeek < 1 ||
        requestedWeek > maximumWeek)
    ) {
      return errorResponse(`Week must be between 1 and ${maximumWeek}.`, 400)
    }

    const importService = new ESPNImportService(
      leagueId,
      season,
      espnConfig,
      database,
    )
    const week =
      requestedWeek === 'latest'
        ? await importService.getLatestCompletedWeek(maximumWeek)
        : requestedWeek

    if (!week) {
      return errorResponse('No completed ESPN week is ready to import.', 409)
    }

    const preview = await importService.previewWeek(week)
    const validation = validateWeekImport(
      preview,
      (membersResult.data || []).map((member) => member.id),
      week,
    )

    if (action === 'preview') {
      return NextResponse.json({
        action,
        preview,
        success: true,
        validation,
        week,
      })
    }

    if (!validation.can_import) {
      const reason =
        validation.errors[0] ||
        validation.warnings[0] ||
        'The ESPN week is not ready to import.'

      await database
        .from('leagues')
        .update({ last_sync_error: reason, sync_status: 'error' })
        .eq('id', leagueId)

      return NextResponse.json(
        { error: reason, success: false, validation, week },
        { status: 422 },
      )
    }

    const result = await importService.importValidatedWeekData(preview, 'manual')

    return NextResponse.json({
      action,
      result,
      success: true,
      validation,
      week,
    })
  } catch (error) {
    if (error instanceof ESPNTeamMappingError) {
      return NextResponse.json(
        {
          code: 'TEAM_MAPPING_REQUIRED',
          error: error.message,
          mapping: error.snapshot,
          success: false,
        },
        { status: 409 },
      )
    }

    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    if (error instanceof ESPNImportPersistenceError) {
      const status = error.code === 'IMPORT_LOCKED' ? 409 : 422

      return NextResponse.json(
        {
          code: error.code,
          error: error.message,
          import_run_id: error.runId,
          success: false,
        },
        { status },
      )
    }

    const message =
      error instanceof Error ? error.message : 'The ESPN import failed.'

    if (action === 'sync' && database) {
      await database
        .from('leagues')
        .update({ last_sync_error: message, sync_status: 'error' })
        .eq('id', leagueId)
    }

    console.error(`ESPN ${action} failed for league ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}
