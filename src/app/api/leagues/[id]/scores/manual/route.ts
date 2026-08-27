import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { getLifecycleWriteBlock } from '@/lib/lifecycleServer'
import {
  isMissingAtomicManualWeekSchema,
  parseAtomicManualWeekResult,
  validateManualScores,
  type AtomicManualWeekResult,
  type ManualScoreInput,
} from '@/lib/manualScores'
import type { Json } from '@/lib/database.types'
import {
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface ManualScoreRequest {
  action?: 'clear_season' | 'clear_week' | 'save_week'
  scores?: unknown
  season?: string
  week?: number
}

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

function successResponse(result: AtomicManualWeekResult) {
  if (result.action === 'save_week') {
    return NextResponse.json({
      message: `Week ${result.week} scores saved.`,
      saved_scores: result.score_count,
      success: true,
      updated_matchups: result.matchup_count,
      week: result.week,
    })
  }

  return NextResponse.json({
    cleared_scores: result.score_count,
    message:
      result.action === 'clear_week'
        ? `Week ${result.week} scores cleared.`
        : `${result.season} season scores cleared.`,
    success: true,
    updated_matchups: result.matchup_count,
    week: result.action === 'clear_week' ? result.week : undefined,
  })
}

function atomicErrorResponse(error: DatabaseError) {
  if (['22023', '23514'].includes(error.code || '')) {
    return errorResponse(
      error.message || 'The score request is no longer valid.',
      422,
    )
  }
  if (error.code === '23503') {
    return errorResponse(
      'The season roster or matchup schedule changed. Refresh before trying again.',
      409,
    )
  }
  if (error.code === 'P0002') {
    return errorResponse('The league season was not found or is archived.', 409)
  }
  if (error.code === '55P03') {
    return errorResponse(
      'A score sync or correction is already in progress. Try again shortly.',
      409,
    )
  }
  return null
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
  let body: ManualScoreRequest

  try {
    body = (await request.json()) as ManualScoreRequest
  } catch {
    return errorResponse('The score request is not valid JSON.', 400)
  }

  const { action, season } = body

  if (!['clear_season', 'clear_week', 'save_week'].includes(action || '')) {
    return errorResponse('Choose a supported score action.', 400)
  }

  if (!season || !/^\d{4}$/.test(season)) {
    return errorResponse('A valid season is required.', 400)
  }

  try {
    const supabase = createServerSupabaseClient()
    const lifecycleBlock = await getLifecycleWriteBlock(
      supabase,
      leagueId,
      season,
    )
    if (lifecycleBlock) return errorResponse(lifecycleBlock, 409)
    const [seasonResult, membersResult] = await Promise.all([
      supabase
        .from('league_seasons')
        .select('playoff_start_week, total_weeks')
        .eq('league_id', leagueId)
        .eq('season', season)
        .maybeSingle(),
      supabase
        .from('league_members')
        .select('id')
        .eq('league_id', leagueId)
        .eq('season', season)
        .eq('is_active', true),
    ])

    if (seasonResult.error) throw seasonResult.error
    if (membersResult.error) throw membersResult.error
    const seasonConfiguration = seasonResult.data
    if (!seasonConfiguration) return errorResponse('Season not found.', 404)

    const maximumWeek = seasonConfiguration.total_weeks || 17

    if (
      action !== 'clear_season' &&
      (!Number.isInteger(body.week) ||
        (body.week || 0) < 1 ||
        (body.week || 0) > maximumWeek)
    ) {
      return errorResponse(`Week must be between 1 and ${maximumWeek}.`, 400)
    }

    let validatedScores: ManualScoreInput[] = []
    if (action === 'save_week') {
      const week = body.week
      if (typeof week !== 'number') {
        return errorResponse('A valid week is required.', 400)
      }

      const validation = validateManualScores(
        body.scores,
        (membersResult.data || []).map((member) => member.id),
      )

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

      validatedScores = validation.scores
    }

    const atomicResult = await supabase.rpc('mutate_manual_week_atomically', {
      p_action: action as NonNullable<ManualScoreRequest['action']>,
      p_league_id: leagueId,
      p_scores: validatedScores as unknown as Json,
      p_season: season,
      p_week: action === 'clear_season' ? null : (body.week ?? null),
    })

    if (!atomicResult.error) {
      const result = parseAtomicManualWeekResult(atomicResult.data)
      if (!result) {
        throw new Error('Atomic manual score operation returned an invalid result.')
      }
      return successResponse(result)
    }

    if (!isMissingAtomicManualWeekSchema(atomicResult.error)) {
      const response = atomicErrorResponse(atomicResult.error)
      if (response) return response
      throw atomicResult.error
    }

    // Compatibility path while migration 013 is not active. It preserves the
    // existing write behavior; the RPC becomes authoritative once available.
    if (action === 'save_week') {
      const week = body.week
      if (typeof week !== 'number') {
        return errorResponse('A valid week is required.', 400)
      }

      const { error } = await supabase.from('weekly_scores').upsert(
        validatedScores.map((score) => ({
          is_final_score: true,
          is_playoff_week:
            week >= (seasonConfiguration.playoff_start_week ?? 15),
          league_id: leagueId,
          member_id: score.member_id,
          points: score.points,
          season,
          week_number: week,
          week_status: 'completed',
        })),
        { onConflict: 'league_id,season,week_number,member_id' },
      )

      if (error) throw error

      return NextResponse.json({
        message: `Week ${week} scores saved.`,
        saved_scores: validatedScores.length,
        success: true,
        week,
      })
    }

    const deleteQuery = supabase
      .from('weekly_scores')
      .delete({ count: 'exact' })
      .eq('league_id', leagueId)
      .eq('season', season)

    if (action === 'clear_week') {
      const week = body.week
      if (typeof week !== 'number') {
        return errorResponse('A valid week is required.', 400)
      }
      deleteQuery.eq('week_number', week)
    }

    const { count, error } = await deleteQuery
    if (error) throw error

    return NextResponse.json({
      cleared_scores: count || 0,
      message:
        action === 'clear_week'
          ? `Week ${body.week} scores cleared.`
          : `${season} season scores cleared.`,
      success: true,
      week: action === 'clear_week' ? body.week : undefined,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error ? error.message : 'The score request failed.'

    console.error(`Manual score action failed for league ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}
