import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { buildSharePath, isValidShareSeason } from '@/lib/shareAccess'
import {
  createStableShareSlug,
  digestShareToken,
  isMissingShareSchema,
} from '@/lib/shareAccessServer'
import {
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface RouteContext {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

function responseError(error: string, status: number) {
  return NextResponse.json({ error, success: false }, { status })
}

function isCommissioner(request: NextRequest) {
  return isValidAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET,
  )
}

function schemaPending() {
  return responseError(
    'Player links are not available yet. Your league data is unaffected.',
    409,
  )
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isCommissioner(request)) {
    return responseError('Commissioner sign-in is required.', 401)
  }

  const season = request.nextUrl.searchParams.get('season')
  if (!isValidShareSeason(season)) {
    return responseError('A valid season is required.', 400)
  }

  const { id: leagueId } = await context.params
  try {
    const database = createServerSupabaseClient()
    const result = await database
      .from('league_share_links')
      .select('created_at, token_prefix')
      .eq('league_id', leagueId)
      .eq('season', season)
      .is('revoked_at', null)
      .maybeSingle()

    if (isMissingShareSchema(result.error)) return schemaPending()
    if (result.error) throw result.error

    return NextResponse.json({
      active: Boolean(result.data),
      created_at: result.data?.created_at || null,
      season,
      success: true,
      token_prefix: result.data?.token_prefix || null,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return responseError(error.message, 503)
    }
    return responseError(
      error instanceof Error ? error.message : 'Share-link status could not be loaded.',
      500,
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isCommissioner(request)) {
    return responseError('Commissioner sign-in is required.', 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return responseError('The share-link request is not valid JSON.', 400)
  }
  const season =
    body && typeof body === 'object' && 'season' in body ? body.season : null
  if (!isValidShareSeason(season)) {
    return responseError('A valid season is required.', 400)
  }

  const { id: leagueId } = await context.params
  const token = createStableShareSlug(
    leagueId,
    season,
    process.env.ADMIN_SESSION_SECRET || '',
  )
  try {
    const database = createServerSupabaseClient()
    const existing = await database
      .from('league_share_links')
      .select('created_at, token_prefix')
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('token_digest', digestShareToken(token))
      .is('revoked_at', null)
      .maybeSingle()

    if (isMissingShareSchema(existing.error)) return schemaPending()
    if (existing.error) throw existing.error
    if (existing.data) {
      return NextResponse.json({
        link: existing.data,
        share_path: buildSharePath(leagueId, season, token),
        success: true,
        token,
      })
    }

    const result = await database.rpc('rotate_league_share_link', {
      p_league_id: leagueId,
      p_season: season,
      p_token_digest: digestShareToken(token),
      p_token_prefix: token.slice(0, 8),
    })

    if (isMissingShareSchema(result.error)) return schemaPending()
    if (result.error) throw result.error

    return NextResponse.json({
      link: result.data,
      share_path: buildSharePath(leagueId, season, token),
      success: true,
      token,
    })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return responseError(error.message, 503)
    }
    return responseError(
      error instanceof Error ? error.message : 'The player link could not be created.',
      500,
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isCommissioner(request)) {
    return responseError('Commissioner sign-in is required.', 401)
  }

  const season = request.nextUrl.searchParams.get('season')
  if (!isValidShareSeason(season)) {
    return responseError('A valid season is required.', 400)
  }

  const { id: leagueId } = await context.params
  try {
    const database = createServerSupabaseClient()
    const result = await database.rpc('revoke_league_share_link', {
      p_league_id: leagueId,
      p_season: season,
    })
    if (isMissingShareSchema(result.error)) return schemaPending()
    if (result.error) throw result.error
    return NextResponse.json({ result: result.data, success: true })
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return responseError(error.message, 503)
    }
    return responseError(
      error instanceof Error ? error.message : 'The player link could not be revoked.',
      500,
    )
  }
}
