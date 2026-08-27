import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { validateCreateLeagueRequest } from '@/lib/leagueActions'
import { createSeasonConfigPayload } from '@/lib/seasonConfig'
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
          .select('league_id, season, payment_status, is_active')
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

  const validation = validateCreateLeagueRequest(requestBody)
  if (!validation.is_valid || !validation.value) {
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
    const { data: league, error: leagueError } = await database
      .from('leagues')
      .insert({
        current_season: settings.season,
        name: settings.name,
      })
      .select('id, name, current_season')
      .single()

    if (leagueError) throw leagueError

    const { error: seasonError } = await database
      .from('league_seasons')
      .insert(
        createSeasonConfigPayload(
          league.id,
          settings.season,
          settings.fee_amount,
        ),
      )

    if (seasonError) {
      const { error: rollbackError } = await database
        .from('leagues')
        .delete()
        .eq('id', league.id)

      if (rollbackError) {
        throw new Error(
          'League was created, but its season setup failed and could not be removed. Refresh before trying again.',
        )
      }

      throw seasonError
    }

    return NextResponse.json(
      {
        league,
        message: `${settings.name} created for ${settings.season}.`,
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
