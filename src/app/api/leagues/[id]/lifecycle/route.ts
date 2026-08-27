import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import {
  isMissingLifecycleSchema,
  validateLifecycleAction,
} from '@/lib/lifecycle'
import {
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface DatabaseError {
  code?: string
  message?: string
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

function databaseErrorStatus(error: DatabaseError) {
  if (error.code === 'P0002') return 404
  if (error.code === '22023') return 422
  return 500
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  const { id: leagueId } = await context.params
  try {
    const database = createServerSupabaseClient()
    const leagueResult = await database
      .from('leagues')
      .select('id, current_season, archived_at')
      .eq('id', leagueId)
      .maybeSingle()

    if (isMissingLifecycleSchema(leagueResult.error)) {
      return NextResponse.json({
        league: null,
        schema_ready: false,
        seasons: [],
        success: true,
      })
    }
    if (leagueResult.error) throw leagueResult.error
    if (!leagueResult.data) return errorResponse('League not found.', 404)

    const seasonResult = await database
      .from('league_seasons')
      .select('season, is_active, archived_at')
      .eq('league_id', leagueId)
      .order('season', { ascending: false })

    if (isMissingLifecycleSchema(seasonResult.error)) {
      return NextResponse.json({
        league: null,
        schema_ready: false,
        seasons: [],
        success: true,
      })
    }
    if (seasonResult.error) throw seasonResult.error

    return NextResponse.json({
      league: leagueResult.data,
      schema_ready: true,
      seasons: seasonResult.data || [],
      success: true,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }
    const message =
      error instanceof Error ? error.message : 'Lifecycle settings could not be loaded.'
    console.error(`Lifecycle load failed for ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('The lifecycle request is not valid JSON.', 400)
  }

  const validation = validateLifecycleAction(body)
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
  const action = validation.value
  try {
    const database = createServerSupabaseClient()
    const result =
      action.action === 'set_league_archive'
        ? await database.rpc('set_league_archive_status', {
            p_archived: action.archived,
            p_league_id: leagueId,
          })
        : await database.rpc('set_season_archive_status', {
            p_archived: action.archived,
            p_league_id: leagueId,
            p_season: action.season,
          })

    if (result.error) {
      if (isMissingLifecycleSchema(result.error)) {
        return errorResponse(
          'Archiving will be available after the prepared lifecycle migration is applied.',
          409,
        )
      }
      return errorResponse(
        result.error.message || 'Archive state could not be updated.',
        databaseErrorStatus(result.error),
      )
    }

    return NextResponse.json({ result: result.data, success: true })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }
    const databaseError = error as DatabaseError
    const message =
      error instanceof Error ? error.message : 'Archive state could not be updated.'
    console.error(`Lifecycle update failed for ${leagueId}:`, message)
    return errorResponse(message, databaseErrorStatus(databaseError))
  }
}
