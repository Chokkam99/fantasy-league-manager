import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import {
  isMissingFinanceSchema,
  summarizeFinance,
  validateFinanceAction,
} from '@/lib/finance'
import { getLifecycleWriteBlock } from '@/lib/lifecycleServer'
import { authorizeLeagueRead } from '@/lib/shareAccessServer'
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

function financeSchemaPendingResponse(isCommissioner: boolean) {
  return NextResponse.json({
    awards: [],
    is_commissioner: isCommissioner,
    payments: isCommissioner ? [] : undefined,
    payouts: [],
    schema_ready: false,
    success: true,
    summary: null,
  })
}

function databaseErrorStatus(error: DatabaseError) {
  if (error.code === 'P0002') return 404
  if (error.code === '22023') return 422
  if (error.code === '23503') return 409
  return 500
}

export async function GET(request: NextRequest, context: RouteContext) {
  const season = request.nextUrl.searchParams.get('season') || ''
  if (!/^\d{4}$/.test(season)) {
    return errorResponse('A valid season is required.', 400)
  }

  const { id: leagueId } = await context.params

  try {
    const database = createServerSupabaseClient()
    const authorization = await authorizeLeagueRead(
      request,
      database,
      leagueId,
      season,
    )
    if (!authorization.access) {
      return errorResponse(authorization.error, authorization.status)
    }
    const isCommissioner = authorization.access.kind === 'commissioner'
    const seasonResult = await database
      .from('league_seasons')
      .select('season')
      .eq('league_id', leagueId)
      .eq('season', season)
      .maybeSingle()

    if (seasonResult.error) throw seasonResult.error
    if (!seasonResult.data) return errorResponse('Season not found.', 404)

    const [awardResult, payoutResult, paymentResult] = await Promise.all([
      database
        .from('prize_awards')
        .select(
          'id, award_key, award_type, category_key, label, planned_amount_cents, week_number',
        )
        .eq('league_id', leagueId)
        .eq('season', season)
        .eq('is_active', true)
        .order('award_type', { ascending: true })
        .order('week_number', { ascending: true, nullsFirst: false })
        .order('award_key', { ascending: true }),
      database
        .from('prize_payouts')
        .select(
          'id, award_id, league_member_id, amount_cents, status, paid_at',
        )
        .eq('league_id', leagueId)
        .eq('season', season),
      isCommissioner
        ? database
            .from('season_payments')
            .select(
              'id, league_member_id, expected_amount_cents, paid_amount_cents, status, payment_method, notes, paid_at',
            )
            .eq('league_id', leagueId)
            .eq('season', season)
        : Promise.resolve({ data: null, error: null }),
    ])

    const financeError =
      awardResult.error || payoutResult.error || paymentResult.error
    if (isMissingFinanceSchema(financeError)) {
      return financeSchemaPendingResponse(isCommissioner)
    }
    if (financeError) throw financeError

    const payments = isCommissioner ? paymentResult.data || [] : undefined
    return NextResponse.json({
      awards: awardResult.data || [],
      is_commissioner: isCommissioner,
      payments,
      payouts: payoutResult.data || [],
      schema_ready: true,
      success: true,
      summary: isCommissioner
        ? summarizeFinance({
            payments: payments || [],
            payouts: payoutResult.data || [],
          })
        : null,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error ? error.message : 'Finance details could not be loaded.'
    console.error(`Finance load failed for ${leagueId}:`, message)
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
    return errorResponse('The finance request is not valid JSON.', 400)
  }

  const validation = validateFinanceAction(requestBody)
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
    const lifecycleBlock = await getLifecycleWriteBlock(
      database,
      leagueId,
      action.season,
    )
    if (lifecycleBlock) return errorResponse(lifecycleBlock, 409)
    const { data: season, error: seasonError } = await database
      .from('league_seasons')
      .select('season')
      .eq('league_id', leagueId)
      .eq('season', action.season)
      .maybeSingle()

    if (seasonError) throw seasonError
    if (!season) return errorResponse('Season not found.', 404)

    let result
    if (action.action === 'set_payment') {
      result = await database.rpc('set_season_payment_details', {
        p_league_id: leagueId,
        p_member_id: action.member_id,
        p_notes: action.notes,
        p_paid_amount_cents: action.paid_amount_cents,
        p_payment_method: action.payment_method,
        p_season: action.season,
        p_status: action.status,
      })
    } else if (action.action === 'assign_award') {
      result = await database.rpc('assign_prize_recipient', {
        p_award_id: action.award_id,
        p_league_id: leagueId,
        p_member_id: action.member_id,
        p_season: action.season,
      })
    } else {
      result = await database.rpc('set_prize_payout_status', {
        p_league_id: leagueId,
        p_payout_id: action.payout_id,
        p_season: action.season,
        p_status: action.status,
      })
    }

    if (result.error) {
      if (isMissingFinanceSchema(result.error)) {
        return errorResponse(
          'Finance editing will be available after the prepared database migration is applied.',
          409,
        )
      }
      return errorResponse(
        result.error.message || 'The finance update failed.',
        databaseErrorStatus(result.error),
      )
    }

    return NextResponse.json({ result: result.data, success: true })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const databaseError = error as DatabaseError
    if (isMissingFinanceSchema(databaseError)) {
      return errorResponse(
        'Finance editing will be available after the prepared database migration is applied.',
        409,
      )
    }

    const message =
      error instanceof Error ? error.message : 'The finance update failed.'
    console.error(`Finance action failed for ${leagueId}:`, message)
    return errorResponse(message, databaseErrorStatus(databaseError))
  }
}
