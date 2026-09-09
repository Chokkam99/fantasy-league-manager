import { NextRequest, NextResponse } from 'next/server'
import { isMissingFinanceSchema } from '@/lib/finance'
import { seasonPhase } from '@/lib/seasonNavigation'
import { isMissingLifecycleSchema } from '@/lib/lifecycle'
import {
  PUBLIC_LEAGUE_COLUMNS,
  PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE,
} from '@/lib/publicLeague'
import { SEASON_CONFIG_COLUMNS } from '@/lib/seasonConfigClient'
import { authorizeLeagueRead } from '@/lib/shareAccessServer'
import {
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface RouteContext {
  params: Promise<{ id: string }>
}

const resources = new Set([
  'navigation',
  'memberships',
  'history',
  'overview',
  'prizes',
  'scores',
  'season',
  'shell',
  'standings',
  'week',
])

export const dynamic = 'force-dynamic'

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error, success: false }, { status })
}

export async function GET(request: NextRequest, context: RouteContext) {
  const resource = request.nextUrl.searchParams.get('resource') || ''
  const season = request.nextUrl.searchParams.get('season') || ''
  if (!resources.has(resource)) return errorResponse('Unknown league view.', 400)

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
    const isShared = authorization.access.kind === 'share'
    const shareSeason =
      authorization.access.kind === 'share'
        ? authorization.access.season
        : null

    if (resource === 'history') {
      const scopedSeason = shareSeason
      let seasonsQuery = database
        .from('league_seasons')
        .select('divisions, final_winners, playoff_spots, playoff_start_week, season, total_weeks')
        .eq('league_id', leagueId)
      let membersQuery = database
        .from('league_members')
        .select('id, manager_id, manager_name, team_name, division, season, is_active')
        .eq('league_id', leagueId)
      let scoresQuery = database
        .from('weekly_scores')
        .select('member_id, points, week_number, season')
        .eq('league_id', leagueId)
      let matchupsQuery = database
        .from('matchup_results_with_scores')
        .select('is_tie, team1_member_id, team1_score, team2_member_id, team2_score, week_number, winner_member_id, season')
        .eq('league_id', leagueId)
      if (scopedSeason) {
        seasonsQuery = seasonsQuery.eq('season', scopedSeason)
        membersQuery = membersQuery.eq('season', scopedSeason)
        scoresQuery = scoresQuery.eq('season', scopedSeason)
        matchupsQuery = matchupsQuery.eq('season', scopedSeason)
      }
      const [seasons, members, scores, matchups] = await Promise.all([
        seasonsQuery,
        membersQuery,
        scoresQuery,
        matchupsQuery,
      ])
      if (seasons.error || members.error || scores.error || matchups.error) {
        throw seasons.error || members.error || scores.error || matchups.error
      }
      return NextResponse.json({
        matchups: matchups.data || [],
        members: members.data || [],
        scores: scores.data || [],
        seasons: seasons.data || [],
        success: true,
      })
    }

    if (resource === 'shell') {
      let leagueResult = await database
        .from('leagues')
        .select(PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE)
        .eq('id', leagueId)
        .single()
      if (leagueResult.error && isMissingLifecycleSchema(leagueResult.error)) {
        leagueResult = await database
          .from('leagues')
          .select(PUBLIC_LEAGUE_COLUMNS)
          .eq('id', leagueId)
          .single()
      }
      let seasonsQuery = database
        .from('league_seasons')
        .select('season, archived_at')
        .eq('league_id', leagueId)
      if (isShared && shareSeason) {
        seasonsQuery = seasonsQuery.eq('season', shareSeason)
      }
      const lifecycleSeasonsResult = await seasonsQuery
      let seasonsData: Array<{ archived_at?: string | null; season: string }> | null =
        lifecycleSeasonsResult.data
      let seasonsError = lifecycleSeasonsResult.error
      if (seasonsError && isMissingLifecycleSchema(seasonsError)) {
        let legacyQuery = database
          .from('league_seasons')
          .select('season')
          .eq('league_id', leagueId)
        if (isShared && shareSeason) {
          legacyQuery = legacyQuery.eq('season', shareSeason)
        }
        const legacyResult = await legacyQuery
        seasonsData = legacyResult.data
        seasonsError = legacyResult.error
      }
      if (leagueResult.error || seasonsError) {
        throw leagueResult.error || seasonsError
      }
      return NextResponse.json({
        league: leagueResult.data,
        seasons: seasonsData || [],
        success: true,
      })
    }

    if (!/^\d{4}$/.test(season)) {
      return errorResponse('A valid season is required.', 400)
    }

    if (resource === 'navigation') {
      const [config, scores, members, payments] = await Promise.all([
        database.from('league_seasons').select('total_weeks').eq('league_id', leagueId).eq('season', season).maybeSingle(),
        database.from('weekly_scores').select('week_number').eq('league_id', leagueId).eq('season', season)
          .or('is_final_score.eq.true,week_status.eq.completed').order('week_number', { ascending: false }).limit(1),
        database.from('league_members').select('id, payment_status').eq('league_id', leagueId).eq('season', season).eq('is_active', true),
        database.from('season_payments').select('league_member_id, status').eq('league_id', leagueId).eq('season', season),
      ])
      if (config.error || scores.error || members.error) throw config.error || scores.error || members.error
      if (payments.error && !isMissingFinanceSchema(payments.error)) throw payments.error
      const statuses = new Map((payments.data || []).map(payment => [payment.league_member_id, payment.status]))
      return NextResponse.json({
        success: true, season,
        phase: seasonPhase(scores.data?.[0]?.week_number || 0, config.data?.total_weeks || 17),
        duesRemaining: (members.data || []).filter(member => (statuses.get(member.id) || member.payment_status) !== 'paid').length,
        playerCount: members.data?.length || 0,
      })
    }

    if (resource === 'season') {
      const result = await database
        .from('league_seasons')
        .select(SEASON_CONFIG_COLUMNS)
        .eq('league_id', leagueId)
        .eq('season', season)
        .maybeSingle()
      if (result.error) throw result.error
      return NextResponse.json({ data: result.data, success: true })
    }

    if (resource === 'memberships') {
      let query = database
        .from('league_members')
        .select('id, manager_id, manager_name, team_name, payment_status, season, is_active, division')
        .eq('league_id', leagueId)
      if (isShared && shareSeason) {
        query = query.eq('season', shareSeason)
      }
      const canonicalResult = await query
      let membershipData: Array<{
        division: string | null
        id: string
        is_active: boolean | null
        manager_id?: string | null
        manager_name: string
        payment_status: string | null
        season: string | null
        team_name: string
      }> | null = canonicalResult.data
      let membershipError = canonicalResult.error
      if (membershipError && membershipError.message?.includes('manager_id')) {
        let legacyQuery = database
          .from('league_members')
          .select('id, manager_name, team_name, payment_status, season, is_active, division')
          .eq('league_id', leagueId)
        if (isShared && shareSeason) {
          legacyQuery = legacyQuery.eq('season', shareSeason)
        }
        const legacyResult = await legacyQuery
        membershipData = legacyResult.data
        membershipError = legacyResult.error
      }
      if (membershipError) throw membershipError
      return NextResponse.json({ data: membershipData || [], success: true })
    }

    const memberColumns =
      resource === 'standings'
        ? 'id, manager_name, team_name, division'
        : resource === 'scores'
          ? 'id, manager_name, team_name, season'
          : 'id, manager_name, team_name, payment_status, division'
    const membersPromise = database
      .from('league_members')
      .select(memberColumns)
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('is_active', true)

    if (resource === 'scores') {
      const [members, latest] = await Promise.all([
        membersPromise.order('updated_at', { ascending: false }),
        database
          .from('weekly_scores')
          .select('week_number')
          .eq('league_id', leagueId)
          .eq('season', season)
          .order('week_number', { ascending: false })
          .limit(1),
      ])
      if (members.error || latest.error) throw members.error || latest.error
      return NextResponse.json({
        latest: latest.data || [],
        members: members.data || [],
        success: true,
      })
    }

    if (resource === 'week') {
      const week = Number(request.nextUrl.searchParams.get('week'))
      if (!Number.isInteger(week) || week < 1 || week > 25) {
        return errorResponse('A valid week is required.', 400)
      }
      const [scores, matchups] = await Promise.all([
        database
          .from('weekly_scores')
          .select('id, member_id, points, week_status, is_final_score')
          .eq('league_id', leagueId)
          .eq('season', season)
          .eq('week_number', week),
        database
          .from('matchup_results_with_scores')
          .select('id, is_tie, team1_member_id, team1_score, team2_member_id, team2_score, winner_member_id')
          .eq('league_id', leagueId)
          .eq('season', season)
          .eq('week_number', week),
      ])
      if (scores.error || matchups.error) throw scores.error || matchups.error
      return NextResponse.json({
        matchups: matchups.data || [],
        scores: scores.data || [],
        success: true,
      })
    }

    const scoreColumns =
      resource === 'standings'
        ? 'member_id, points, week_number'
        : 'member_id, week_number, points, is_final_score, week_status'
    const matchupColumns =
      'is_tie, team1_member_id, team1_score, team2_member_id, team2_score, week_number, winner_member_id'
    const queries: Array<PromiseLike<{ data: unknown; error: { message?: string } | null }>> = [
      membersPromise,
      database
        .from('weekly_scores')
        .select(scoreColumns)
        .eq('league_id', leagueId)
        .eq('season', season),
    ]
    if (resource === 'overview' || resource === 'standings') {
      queries.push(
        database
          .from('matchup_results_with_scores')
          .select(matchupColumns)
          .eq('league_id', leagueId)
          .eq('season', season),
      )
    }
    const [members, scores, matchups] = await Promise.all(queries)
    if (members.error || scores.error || matchups?.error) {
      throw members.error || scores.error || matchups?.error
    }
    return NextResponse.json({
      matchups: matchups?.data || [],
      members: members.data || [],
      scores: scores.data || [],
      success: true,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }
    const message = error instanceof Error ? error.message : 'League data could not be loaded.'
    console.error(`League view failed for ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}
