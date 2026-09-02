import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { getLifecycleWriteBlock } from '@/lib/lifecycleServer'
import { isMissingManagerIdentitySchema } from '@/lib/managerIdentity'
import {
  buildRolloverMemberOptions,
  createReturningMemberPayloads,
  createRolloverSeasonPayload,
  getNextSeason,
  isMissingAtomicRolloverSchema,
  parseAtomicSeasonRolloverResult,
  type ReturningMember,
  type ReusableSeasonConfiguration,
  validateSeasonRolloverRequest,
} from '@/lib/seasonRollover'
import type { Json } from '@/lib/database.types'
import {
  type AppSupabaseClient,
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface LeagueRow {
  current_season: string
  id: string
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

function rolloverSuccessResponse(
  sourceSeason: string,
  targetSeason: string,
  copiedPlayers: number,
  warning?: string,
) {
  return NextResponse.json({
    copied_players: copiedPlayers,
    message: `${targetSeason} is ready. ESPN automation remains off until the connection is tested.`,
    source_season: sourceSeason,
    success: true,
    target_season: targetSeason,
    warning,
  })
}

function atomicRolloverErrorResponse(
  error: DatabaseError,
  targetSeason: string,
) {
  if (error.code === '22023') {
    return errorResponse('The season setup is no longer valid. Review it and try again.', 422)
  }
  if (error.code === '23505') {
    return errorResponse(
      `${targetSeason} is already configured. No changes were made.`,
      409,
    )
  }
  if (['40001', '55P03'].includes(error.code || '')) {
    return errorResponse(
      'Another season change is in progress or just completed. Refresh before trying again.',
      409,
    )
  }
  if (error.code === 'P0002') {
    return errorResponse(
      'The active season or selected players changed. Refresh the setup before trying again.',
      409,
    )
  }
  return null
}

async function loadLeague(database: AppSupabaseClient, leagueId: string) {
  const { data, error } = await database
    .from('leagues')
    .select('id, current_season')
    .eq('id', leagueId)
    .maybeSingle()

  if (error) throw error
  return data as LeagueRow | null
}

async function loadRolloverSource(
  database: AppSupabaseClient,
  leagueId: string,
  sourceSeason: string,
) {
  const targetSeason = getNextSeason(sourceSeason)

  if (!targetSeason) {
    return { members: null, source: null, targetExists: false, targetSeason }
  }

  const membersWithIdentity = await database
    .from('league_members')
    .select('id, manager_id, manager_name, team_name, division, season, is_active')
    .eq('league_id', leagueId)
    .lte('season', sourceSeason)
    .order('season', { ascending: false })
    .order('manager_name')
  const membersResult =
    membersWithIdentity.error &&
    isMissingManagerIdentitySchema(membersWithIdentity.error)
      ? await database
          .from('league_members')
          .select('id, manager_name, team_name, division, season, is_active')
          .eq('league_id', leagueId)
          .lte('season', sourceSeason)
          .order('season', { ascending: false })
          .order('manager_name')
      : membersWithIdentity

  const [sourceResult, targetResult] = await Promise.all([
    database
      .from('league_seasons')
      .select(`
        divisions,
        draft_food_cost,
        fee_amount,
        playoff_spots,
        playoff_start_week,
        prize_structure,
        season,
        total_weeks,
        weekly_prize_amount
      `)
      .eq('league_id', leagueId)
      .eq('season', sourceSeason)
      .maybeSingle(),
    database
      .from('league_seasons')
      .select('id')
      .eq('league_id', leagueId)
      .eq('season', targetSeason)
      .maybeSingle(),
  ])

  if (sourceResult.error) throw sourceResult.error
  if (membersResult.error) throw membersResult.error
  if (targetResult.error) throw targetResult.error

  return {
    members: buildRolloverMemberOptions(
      (membersResult.data || []) as ReturningMember[],
      sourceSeason,
    ),
    source: sourceResult.data as (ReusableSeasonConfiguration & {
      season: string
    }) | null,
    targetExists: Boolean(targetResult.data),
    targetSeason,
  }
}

async function removeUnactivatedSeason(
  database: AppSupabaseClient,
  leagueId: string,
  targetSeason: string,
) {
  const membersResult = await database
    .from('league_members')
    .delete()
    .eq('league_id', leagueId)
    .eq('season', targetSeason)

  const seasonResult = await database
    .from('league_seasons')
    .delete()
    .eq('league_id', leagueId)
    .eq('season', targetSeason)

  return membersResult.error || seasonResult.error
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  const { id: leagueId } = await context.params

  try {
    const database = createServerSupabaseClient()
    const league = await loadLeague(database, leagueId)
    if (!league) return errorResponse('League not found.', 404)

    const rollover = await loadRolloverSource(
      database,
      leagueId,
      league.current_season,
    )
    if (!rollover.targetSeason) {
      return errorResponse(
        'The league active season is not configured correctly.',
        409,
      )
    }
    if (!rollover.source) {
      return errorResponse('The active season configuration was not found.', 409)
    }

    return NextResponse.json({
      preview: {
        can_start: !rollover.targetExists,
        members: rollover.members,
        source_configuration: rollover.source,
        source_season: league.current_season,
        target_exists: rollover.targetExists,
        target_season: rollover.targetSeason,
      },
      success: true,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error
        ? error.message
        : 'The next season preview could not be loaded.'
    console.error(`Season rollover preview failed for ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request)) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  const { id: leagueId } = await context.params
  let requestBody: unknown

  try {
    requestBody = await request.json()
  } catch {
    return errorResponse('The season rollover request is not valid JSON.', 400)
  }

  try {
    const database = createServerSupabaseClient()
    const league = await loadLeague(database, leagueId)
    if (!league) return errorResponse('League not found.', 404)

    const lifecycleBlock = await getLifecycleWriteBlock(
      database,
      leagueId,
      league.current_season,
    )
    if (lifecycleBlock) return errorResponse(lifecycleBlock, 409)

    const validation = validateSeasonRolloverRequest(
      requestBody,
      league.current_season,
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

    const settings = validation.value
    const managerNames = settings.members.map((member) =>
      member.manager_name.trim().toLocaleLowerCase(),
    )
    if (
      managerNames.some((name) => !name) ||
      new Set(managerNames).size !== managerNames.length
    ) {
      return errorResponse(
        'Every season player must have a unique manager name.',
        422,
      )
    }

    const atomicResult = await database.rpc(
      'rollover_league_season_atomically',
      {
        p_configuration: settings.configuration as unknown as Json,
        p_league_id: leagueId,
        p_members: settings.members as unknown as Json,
        p_source_season: settings.source_season,
        p_target_season: settings.target_season,
      },
    )

    if (!atomicResult.error) {
      const result = parseAtomicSeasonRolloverResult(atomicResult.data)
      if (!result) {
        throw new Error('Atomic season rollover returned an invalid result.')
      }
      return rolloverSuccessResponse(
        result.source_season,
        result.target_season,
        result.copied_players,
      )
    }

    if (!isMissingAtomicRolloverSchema(atomicResult.error)) {
      const response = atomicRolloverErrorResponse(
        atomicResult.error,
        settings.target_season,
      )
      if (response) return response
      throw atomicResult.error
    }

    // Compatibility path while migration 011 is not active. Migration 012 is
    // never applied without the RPC, so this path cannot conflict with the
    // one-active-season index.
    const rollover = await loadRolloverSource(
      database,
      leagueId,
      settings.source_season,
    )
    if (!rollover.source) {
      return errorResponse('The active season configuration was not found.', 409)
    }
    if (rollover.targetExists) {
      return errorResponse(
        `${settings.target_season} is already configured. No changes were made.`,
        409,
      )
    }

    const sourceMembers = rollover.members || []
    const sourceMemberIds = new Set(sourceMembers.map((member) => member.id))
    const unknownMember = settings.members.find(
      (member) =>
        member.source_member_id &&
        !sourceMemberIds.has(member.source_member_id),
    )
    if (unknownMember) {
      return errorResponse(
        'A selected returning player is not part of this league history.',
        422,
      )
    }

    const { error: seasonInsertError } = await database
      .from('league_seasons')
      .insert(
        createRolloverSeasonPayload(
          leagueId,
          settings.target_season,
          settings.configuration,
        ),
      )

    if (seasonInsertError) throw seasonInsertError

    const returningMembers = createReturningMemberPayloads(
      leagueId,
      settings.target_season,
      sourceMembers,
      settings.members,
    )
    if (returningMembers.length > 0) {
      const { error: membersInsertError } = await database
        .from('league_members')
        .insert(returningMembers)

      if (membersInsertError) {
        const rollbackError = await removeUnactivatedSeason(
          database,
          leagueId,
          settings.target_season,
        )
        if (rollbackError) {
          throw new Error(
            'Player setup failed and the incomplete season could not be removed. Refresh before trying again.',
          )
        }
        throw membersInsertError
      }
    }

    const { data: activatedLeague, error: activationError } = await database
      .from('leagues')
      .update({
        auto_sync_enabled: false,
        current_season: settings.target_season,
        last_sync_at: null,
        last_sync_error: null,
        sync_status: 'disabled',
      })
      .eq('id', leagueId)
      .eq('current_season', settings.source_season)
      .select('current_season')
      .maybeSingle()

    if (activationError || !activatedLeague) {
      const rollbackError = await removeUnactivatedSeason(
        database,
        leagueId,
        settings.target_season,
      )
      if (rollbackError) {
        throw new Error(
          'Season activation failed and the incomplete season could not be removed. Refresh before trying again.',
        )
      }
      throw (
        activationError ||
        new Error('The active season changed before rollover could finish.')
      )
    }

    const { error: sourceUpdateError } = await database
      .from('league_seasons')
      .update({ is_active: false })
      .eq('league_id', leagueId)
      .eq('season', settings.source_season)

    if (sourceUpdateError) {
      console.error(
        `Season ${settings.source_season} remained marked active after rollover:`,
        sourceUpdateError,
      )
    }

    return rolloverSuccessResponse(
      settings.source_season,
      settings.target_season,
      returningMembers.length,
      sourceUpdateError
        ? `${settings.source_season} history is preserved, but its active flag could not be cleared.`
        : undefined,
    )
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return errorResponse(error.message, 503)
    }

    const message =
      error instanceof Error ? error.message : 'The new season could not be started.'
    console.error(`Season rollover failed for ${leagueId}:`, message)
    return errorResponse(message, 500)
  }
}
