import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import {
  isMissingManagerIdentitySchema,
  sameManagerIdentity,
} from '@/lib/managerIdentity'
import { getLifecycleWriteBlock } from '@/lib/lifecycleServer'
import { validateMemberAction } from '@/lib/memberActions'
import {
  type AppSupabaseClient,
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface MemberRow {
  id: string
  is_active: boolean
  manager_id?: string | null
  manager_name: string
  payment_status: 'paid' | 'pending'
  season: string
  team_name: string
}

export const dynamic = 'force-dynamic'

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message, success: false }, { status })
}

function sameManager(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}

async function loadSeasonMembers(
  database: AppSupabaseClient,
  leagueId: string,
  season: string,
) {
  const canonicalResult = await database
    .from('league_members')
    .select('id, manager_id, manager_name, team_name, season, is_active, payment_status')
    .eq('league_id', leagueId)
    .eq('season', season)

  const result =
    canonicalResult.error && isMissingManagerIdentitySchema(canonicalResult.error)
      ? await database
          .from('league_members')
          .select('id, manager_name, team_name, season, is_active, payment_status')
          .eq('league_id', leagueId)
          .eq('season', season)
      : canonicalResult

  if (result.error) throw result.error
  return (result.data || []) as MemberRow[]
}

async function loadMemberWithIdentity(
  database: AppSupabaseClient,
  leagueId: string,
  memberId: string,
) {
  const canonicalResult = await database
    .from('league_members')
    .select('id, manager_id, manager_name, team_name, season, is_active, payment_status')
    .eq('id', memberId)
    .eq('league_id', leagueId)
    .maybeSingle()

  const result =
    canonicalResult.error && isMissingManagerIdentitySchema(canonicalResult.error)
      ? await database
          .from('league_members')
          .select('id, manager_name, team_name, season, is_active, payment_status')
          .eq('id', memberId)
          .eq('league_id', leagueId)
          .maybeSingle()
      : canonicalResult

  if (result.error) throw result.error
  return result.data as MemberRow | null
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
  let requestBody: unknown

  try {
    requestBody = await request.json()
  } catch {
    return errorResponse('The member request is not valid JSON.', 400)
  }

  const validation = validateMemberAction(requestBody)
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

  const memberAction = validation.value

  try {
    const supabase = createServerSupabaseClient()
    const lifecycleBlock = await getLifecycleWriteBlock(
      supabase,
      leagueId,
      memberAction.season,
    )
    if (lifecycleBlock) return errorResponse(lifecycleBlock, 409)
    const { data: season, error: seasonError } = await supabase
      .from('league_seasons')
      .select('season')
      .eq('league_id', leagueId)
      .eq('season', memberAction.season)
      .maybeSingle()

    if (seasonError) throw seasonError
    if (!season) return errorResponse('Season not found.', 404)

    if (memberAction.action === 'add') {
      const seasonMembers = await loadSeasonMembers(
        supabase,
        leagueId,
        memberAction.season,
      )

      const existingMember = seasonMembers.find(
        (member) => sameManager(member.manager_name, memberAction.manager_name),
      )

      if (existingMember?.is_active) {
        return errorResponse(
          `${existingMember.manager_name} is already active in ${memberAction.season}.`,
          409,
        )
      }

      const mutation = existingMember
        ? supabase
            .from('league_members')
            .update({
              is_active: true,
              payment_status: 'pending',
              team_name: memberAction.team_name,
            })
            .eq('id', existingMember.id)
            .eq('league_id', leagueId)
            .select('id, manager_name, team_name, season, is_active, payment_status')
            .single()
        : supabase
            .from('league_members')
            .insert({
              is_active: true,
              league_id: leagueId,
              manager_name: memberAction.manager_name,
              payment_status: 'pending',
              season: memberAction.season,
              team_name: memberAction.team_name,
            })
            .select('id, manager_name, team_name, season, is_active, payment_status')
            .single()
      const { data: member, error } = await mutation
      if (error) throw error

      return NextResponse.json({
        member,
        message: `${memberAction.manager_name} added to ${memberAction.season}.`,
        success: true,
      })
    }

    if (memberAction.action === 'activate') {
      const [sourceMember, seasonMembers] = await Promise.all([
        loadMemberWithIdentity(supabase, leagueId, memberAction.member_id),
        loadSeasonMembers(supabase, leagueId, memberAction.season),
      ])

      if (!sourceMember) return errorResponse('Player not found.', 404)

      const currentMember = seasonMembers.find((member) =>
        sameManagerIdentity(member, sourceMember),
      )

      if (currentMember?.is_active) {
        return errorResponse(
          `${currentMember.manager_name} is already active in ${memberAction.season}.`,
          409,
        )
      }

      const mutation = currentMember
        ? supabase
            .from('league_members')
            .update({ is_active: true, payment_status: 'pending' })
            .eq('id', currentMember.id)
            .eq('league_id', leagueId)
            .select('id, manager_name, team_name, season, is_active, payment_status')
            .single()
        : supabase
            .from('league_members')
            .insert({
              is_active: true,
              league_id: leagueId,
              ...(sourceMember.manager_id
                ? { manager_id: sourceMember.manager_id }
                : {}),
              manager_name: sourceMember.manager_name,
              payment_status: 'pending',
              season: memberAction.season,
              team_name: sourceMember.team_name,
            })
            .select('id, manager_name, team_name, season, is_active, payment_status')
            .single()
      const { data: member, error } = await mutation
      if (error) throw error

      return NextResponse.json({
        member,
        message: `${sourceMember.manager_name} added to ${memberAction.season}.`,
        success: true,
      })
    }

    const { data: member, error: memberError } = await supabase
      .from('league_members')
      .select('id, manager_name, team_name, season, is_active, payment_status')
      .eq('id', memberAction.member_id)
      .eq('league_id', leagueId)
      .eq('season', memberAction.season)
      .maybeSingle()

    if (memberError) throw memberError
    if (!member) return errorResponse('Player not found.', 404)
    if (!member.is_active) {
      return errorResponse('This player is not active in the selected season.', 409)
    }

    if (memberAction.action === 'set_payment') {
      const { data: updatedMember, error } = await supabase
        .from('league_members')
        .update({ payment_status: memberAction.payment_status })
        .eq('id', memberAction.member_id)
        .eq('league_id', leagueId)
        .eq('season', memberAction.season)
        .eq('is_active', true)
        .select('id, manager_name, team_name, season, is_active, payment_status')
        .single()

      if (error) throw error
      return NextResponse.json({
        member: updatedMember,
        message: `${member.manager_name} marked ${memberAction.payment_status}.`,
        success: true,
      })
    }

    const [scoreResult, teamOneResult, teamTwoResult] = await Promise.all([
      supabase
        .from('weekly_scores')
        .select('id')
        .eq('league_id', leagueId)
        .eq('season', memberAction.season)
        .eq('member_id', memberAction.member_id)
        .limit(1),
      supabase
        .from('matchups')
        .select('id')
        .eq('league_id', leagueId)
        .eq('season', memberAction.season)
        .eq('team1_member_id', memberAction.member_id)
        .limit(1),
      supabase
        .from('matchups')
        .select('id')
        .eq('league_id', leagueId)
        .eq('season', memberAction.season)
        .eq('team2_member_id', memberAction.member_id)
        .limit(1),
    ])

    if (scoreResult.error) throw scoreResult.error
    if (teamOneResult.error) throw teamOneResult.error
    if (teamTwoResult.error) throw teamTwoResult.error

    if (
      (scoreResult.data?.length || 0) > 0 ||
      (teamOneResult.data?.length || 0) > 0 ||
      (teamTwoResult.data?.length || 0) > 0
    ) {
      return errorResponse(
        'This player already has scores or matchups. Keep them active to preserve season history.',
        409,
      )
    }

    const { error: deactivateError } = await supabase
      .from('league_members')
      .update({ is_active: false })
      .eq('id', memberAction.member_id)
      .eq('league_id', leagueId)
      .eq('season', memberAction.season)
      .eq('is_active', true)

    if (deactivateError) throw deactivateError

    return NextResponse.json({
      message: `${member.manager_name} removed from ${memberAction.season}.`,
      success: true,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error ? error.message : 'The member request failed.'

    console.error(`Member action failed for league ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}
