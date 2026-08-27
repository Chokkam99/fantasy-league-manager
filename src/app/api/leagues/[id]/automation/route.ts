import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import {
  getAutomationReadiness,
  validateAutomationSettings,
} from '@/lib/automationSettings'
import { resolveESPNConfig } from '@/lib/espn/config'
import { requestESPNData } from '@/lib/espn/request'
import { withSeasonTeamMappings } from '@/lib/espn/team-mapping-config'
import { getLifecycleWriteBlock } from '@/lib/lifecycleServer'
import { normalizePlatformSyncHealth } from '@/lib/platformImport'
import { validateActiveSeasonAccess } from '@/lib/seasonAccess'
import {
  type AppSupabaseClient,
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface LeagueAutomationRow {
  auto_sync_enabled?: boolean
  current_season: string
  espn_league_id?: string | null
  espn_s2?: string | null
  espn_swid?: string | null
  last_sync_at?: string | null
  last_sync_error?: string | null
  platform_config?: unknown
  platform_league_id?: string | null
  platform_type?: string | null
  sync_status?: string | null
}

interface ImportRunSummary {
  completed_at: string | null
  error_message: string | null
  matchup_count: number
  score_count: number
  started_at: string
  status: string
  trigger_mode: string
  week_number: number
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

function isMissingImportRunSchema(error: { code?: string } | null) {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

function sanitizedSettings(
  league: LeagueAutomationRow,
  season: string,
  latestImportedWeek: number,
  latestImportRun: ImportRunSummary | null,
  totalWeeks: number,
) {
  const espnConfig = resolveESPNConfig(league)
  const cronConfigured = Boolean(process.env.CRON_SECRET)
  const privateLeague = Boolean(espnConfig?.private_league)
  const leagueId = espnConfig?.league_id || ''
  const readiness = getAutomationReadiness({
    cronConfigured,
    hasEspnS2: Boolean(espnConfig?.espn_s2),
    hasSwid: Boolean(espnConfig?.swid),
    leagueId,
    privateLeague,
  })
  const syncHealth = normalizePlatformSyncHealth({
    autoSyncEnabled: Boolean(league.auto_sync_enabled),
    lastSyncError: league.last_sync_error || null,
    syncStatus: league.sync_status || 'none',
    totalWeeks,
  })

  return {
    auto_sync_enabled: Boolean(league.auto_sync_enabled),
    cron_configured: cronConfigured,
    has_espn_s2: Boolean(espnConfig?.espn_s2),
    has_swid: Boolean(espnConfig?.swid),
    is_configured: Boolean(espnConfig) && readiness.can_save_connection,
    last_sync_at: league.last_sync_at || null,
    last_sync_error: syncHealth.lastSyncError,
    latest_imported_week: latestImportedWeek,
    latest_import_run: latestImportRun,
    league_id: leagueId,
    private_league: privateLeague,
    readiness,
    season,
    sync_status: syncHealth.syncStatus,
    total_weeks: totalWeeks,
  }
}

async function loadAutomationContext(
  database: AppSupabaseClient,
  leagueId: string,
  season: string,
) {
  const [leagueResult, seasonResult, scoreResult] = await Promise.all([
    database
      .from('leagues')
      .select(`
        auto_sync_enabled,
        current_season,
        espn_league_id,
        espn_s2,
        espn_swid,
        last_sync_at,
        last_sync_error,
        platform_config,
        platform_league_id,
        platform_type,
        sync_status
      `)
      .eq('id', leagueId)
      .maybeSingle(),
    database
      .from('league_seasons')
      .select('season, total_weeks')
      .eq('league_id', leagueId)
      .eq('season', season)
      .maybeSingle(),
    database
      .from('weekly_scores')
      .select('week_number')
      .eq('league_id', leagueId)
      .eq('season', season)
      .order('week_number', { ascending: false })
      .limit(1),
  ])

  if (leagueResult.error) throw leagueResult.error
  if (seasonResult.error) throw seasonResult.error
  if (scoreResult.error) throw scoreResult.error
  const totalWeeks = seasonResult.data?.total_weeks || 17
  const importRunResult = await database
    .from('import_runs')
    .select(`
      completed_at,
      error_message,
      matchup_count,
      score_count,
      started_at,
      status,
      trigger_mode,
      week_number
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .lte('week_number', totalWeeks)
    .order('started_at', { ascending: false })
    .limit(1)

  if (importRunResult.error && !isMissingImportRunSchema(importRunResult.error)) {
    throw importRunResult.error
  }

  return {
    latestImportedWeek: scoreResult.data?.[0]?.week_number || 0,
    latestImportRun:
      (importRunResult.data?.[0] as ImportRunSummary | undefined) || null,
    league: leagueResult.data as LeagueAutomationRow | null,
    season: seasonResult.data,
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  const season = request.nextUrl.searchParams.get('season') || ''
  if (!/^\d{4}$/.test(season)) {
    return errorResponse('A valid season is required.', 400)
  }

  const { id: leagueId } = await context.params

  try {
    const database = createServerSupabaseClient()
    const automation = await loadAutomationContext(database, leagueId, season)
    if (!automation.league) return errorResponse('League not found.', 404)

    const seasonAccess = validateActiveSeasonAccess(
      season,
      automation.league.current_season,
    )
    if (!seasonAccess.allowed) {
      return errorResponse(seasonAccess.message, 409)
    }

    if (!automation.season) return errorResponse('Season not found.', 404)

    return NextResponse.json({
      settings: sanitizedSettings(
        automation.league,
        season,
        automation.latestImportedWeek,
        automation.latestImportRun,
        automation.season.total_weeks || 17,
      ),
      success: true,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Automation settings could not be loaded.'
    console.error(`Automation settings load failed for ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return errorResponse('The automation request is not valid JSON.', 400)
  }

  const validation = validateAutomationSettings(requestBody)
  if (!validation.is_valid) {
    return NextResponse.json(
      {
        error: validation.errors[0],
        success: false,
        validation,
      },
      { status: 422 },
    )
  }

  const { id: leagueId } = await context.params
  const settings = validation.value

  try {
    const database = createServerSupabaseClient()
    const lifecycleBlock = await getLifecycleWriteBlock(
      database,
      leagueId,
      settings.season,
    )
    if (lifecycleBlock) return errorResponse(lifecycleBlock, 409)
    const automation = await loadAutomationContext(
      database,
      leagueId,
      settings.season,
    )
    if (!automation.league) return errorResponse('League not found.', 404)

    const seasonAccess = validateActiveSeasonAccess(
      settings.season,
      automation.league.current_season,
    )
    if (!seasonAccess.allowed) {
      return errorResponse(seasonAccess.message, 409)
    }

    if (!automation.season) return errorResponse('Season not found.', 404)

    const existingConfig = resolveESPNConfig(automation.league)
    const espnS2 = settings.private_league
      ? settings.espn_s2 || existingConfig?.espn_s2
      : undefined
    const swid = settings.private_league
      ? settings.swid || existingConfig?.swid
      : undefined
    const readiness = getAutomationReadiness({
      cronConfigured: Boolean(process.env.CRON_SECRET),
      hasEspnS2: Boolean(espnS2),
      hasSwid: Boolean(swid),
      leagueId: settings.league_id,
      privateLeague: settings.private_league,
    })

    if (!readiness.can_save_connection) {
      const failedCheck = readiness.checks.find((check) => !check.ready)
      return errorResponse(
        failedCheck?.detail || 'The ESPN connection is not ready to save.',
        422,
      )
    }
    if (settings.auto_sync_enabled && !readiness.can_enable_automatic) {
      return errorResponse(
        'Automatic sync cannot be enabled until CRON_SECRET is configured.',
        409,
      )
    }

    const espnData = await requestESPNData(
      {
        espn_s2: espnS2,
        league_id: settings.league_id,
        private_league: settings.private_league,
        swid,
        year: Number(settings.season),
      },
      '',
      { view: 'mSettings,mTeam' },
    )

    if (!espnData.settings || !espnData.teams?.length) {
      return errorResponse(
        'ESPN did not return league settings and teams for this connection.',
        422,
      )
    }

    const previousPlatformConfig =
      automation.league.platform_config &&
      typeof automation.league.platform_config === 'object' &&
      !Array.isArray(automation.league.platform_config)
        ? automation.league.platform_config
        : {}
    const mappingSafePlatformConfig =
      !existingConfig || existingConfig.league_id !== settings.league_id
        ? withSeasonTeamMappings(
            previousPlatformConfig,
            settings.season,
            {},
          )
        : previousPlatformConfig
    const platformConfig = {
      ...mappingSafePlatformConfig,
      credentials: settings.private_league ? { espn_s2: espnS2, swid } : {},
      league_id: settings.league_id,
      platform_type: 'espn',
      private_league: settings.private_league,
      year: Number(settings.season),
    }
    const { error: updateError } = await database
      .from('leagues')
      .update({
        auto_sync_enabled: settings.auto_sync_enabled,
        last_sync_error: null,
        platform_config: platformConfig,
        platform_league_id: settings.league_id,
        platform_type: 'espn',
        sync_status: 'active',
      })
      .eq('id', leagueId)

    if (updateError) throw updateError

    const updatedLeague: LeagueAutomationRow = {
      ...automation.league,
      auto_sync_enabled: settings.auto_sync_enabled,
      last_sync_error: null,
      platform_config: platformConfig,
      platform_league_id: settings.league_id,
      platform_type: 'espn',
      sync_status: 'active',
    }

    return NextResponse.json({
      message: settings.auto_sync_enabled
        ? 'ESPN connection tested. Wednesday automation is enabled.'
        : 'ESPN connection tested and saved. Automatic sync remains off.',
      settings: sanitizedSettings(
        updatedLeague,
        settings.season,
        automation.latestImportedWeek,
        automation.latestImportRun,
        automation.season.total_weeks || 17,
      ),
      success: true,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error ? error.message : 'ESPN setup failed.'
    console.error(`Automation settings save failed for ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}
