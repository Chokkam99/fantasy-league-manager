import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { parseESPNOnboardingSnapshot } from '@/lib/espn/onboarding'
import { requestESPNOnboardingData } from '@/lib/espn/request'
import type { Json } from '@/lib/database.types'
import { validateNewLeagueSetupRequest } from '@/lib/newLeagueSetup'
import { loadPortfolioLeagues, type PortfolioDataSource } from '@/lib/portfolioClient'
import {
  PUBLIC_LEAGUE_COLUMNS,
  PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE,
} from '@/lib/publicLeague'
import {
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message, success: false }, { status })
}

function isCommissioner(request: NextRequest) {
  return isValidAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET,
  )
}

export async function GET(request: NextRequest) {
  if (!isCommissioner(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  try {
    const database = createServerSupabaseClient()
    const source: PortfolioDataSource = {
      async loadPayments(leagueIds, seasons) {
        return database.from('season_payments')
          .select('league_id, season, league_member_id, expected_amount_cents, paid_amount_cents, status')
          .in('league_id', leagueIds).in('season', seasons)
      },
      async loadLegacyLeagues() {
        return (await database
          .from('leagues')
          .select(PUBLIC_LEAGUE_COLUMNS)
          .order('created_at', { ascending: false })) as never
      },
      async loadLifecycleLeagues() {
        return (await database
          .from('leagues')
          .select(PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE)
          .order('created_at', { ascending: false })) as never
      },
      async loadMembers(leagueIds, seasons) {
        return (await database
          .from('league_members')
          .select('id, manager_name, league_id, season, payment_status, is_active')
          .in('league_id', leagueIds)
          .in('season', seasons)) as never
      },
      async loadScores(leagueIds, seasons) {
        return (await database
          .from('weekly_scores')
          .select('league_id, season, week_number, points, week_status, is_final_score')
          .in('league_id', leagueIds)
          .in('season', seasons)) as never
      },
      async loadSeasons(leagueIds, seasons) {
        return (await database
          .from('league_seasons')
          .select('*')
          .in('league_id', leagueIds)
          .in('season', seasons)) as never
      },
    }
    return NextResponse.json({
      leagues: await loadPortfolioLeagues(source),
      success: true,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }
    return errorResponse(
      error instanceof Error ? error.message : 'The league portfolio could not be loaded.',
      500,
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isCommissioner(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return errorResponse('The league request is not valid JSON.', 400)
  }

  const validation = validateNewLeagueSetupRequest(requestBody)
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

  const settings = validation.value

  try {
    const database = createServerSupabaseClient()
    if (settings.espn_connection) {
      const connection = settings.espn_connection
      if (connection.auto_sync_enabled && !process.env.CRON_SECRET) {
        return errorResponse(
          'Automatic sync cannot be enabled until CRON_SECRET is configured.',
          409,
        )
      }
      const data = await requestESPNOnboardingData({
        espn_s2: connection.espn_s2,
        league_id: connection.league_id,
        private_league: connection.private_league,
        swid: connection.swid,
        year: Number(settings.season),
      })
      const snapshot = parseESPNOnboardingSnapshot(data)
      if (!snapshot) {
        return errorResponse('ESPN no longer returns teams for this league and season.', 422)
      }

      const configuredIds = settings.members
        .map((member) => member.espn_team_id)
        .filter((teamId): teamId is number => teamId !== null)
        .sort((left, right) => left - right)
      const liveIds = snapshot.teams
        .map((team) => team.team_id)
        .sort((left, right) => left - right)
      if (
        configuredIds.length !== settings.members.length ||
        configuredIds.length !== liveIds.length ||
        configuredIds.some((teamId, index) => teamId !== liveIds[index])
      ) {
        return errorResponse(
          'The ESPN team list changed after it was loaded. Pull the current teams again before creating the league.',
          409,
        )
      }
    }

    const { data, error } = await database.rpc('create_league_atomically', {
      p_configuration: settings.configuration as unknown as Json,
      p_espn_connection: settings.espn_connection as unknown as Json,
      p_league_id: settings.id,
      p_members: settings.members as unknown as Json,
      p_name: settings.name,
      p_season: settings.season,
    })

    if (error) {
      if (error.code === '23505') {
        return errorResponse('That league link is already in use. Choose another one.', 409)
      }
      if (
        ['42883', 'PGRST202'].includes(error.code || '') ||
        /create_league_atomically/i.test(error.message || '')
      ) {
        return errorResponse(
          'New league setup is not available until the latest database migration is applied.',
          503,
        )
      }
      throw error
    }

    const result = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown>
      : null
    if (
      !result ||
      result.success !== true ||
      result.league_id !== settings.id ||
      result.season !== settings.season
    ) {
      throw new Error('The database returned an invalid league creation result.')
    }

    const league = {
      current_season: settings.season,
      id: settings.id,
      name: settings.name,
    }

    return NextResponse.json(
      {
        league,
        message: `${settings.name} is ready for ${settings.season}.`,
        success: true,
      },
      { status: 201 },
    )
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error ? error.message : 'The league could not be created.'
    console.error('League creation failed:', message)
    return errorResponse(message, 500)
  }
}
