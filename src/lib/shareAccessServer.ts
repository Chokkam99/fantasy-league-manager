import { createHash, randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { isValidShareSeason, isValidShareToken } from '@/lib/shareAccess'
import type { AppSupabaseClient } from '@/lib/supabaseServer'

export type LeagueReadAccess =
  | { kind: 'commissioner' }
  | { kind: 'share'; linkId: string; season: string }

export type LeagueReadAccessResult =
  | { access: LeagueReadAccess; error: null; status: 200 }
  | { access: null; error: string; status: 401 | 403 | 409 }

export function createShareToken() {
  return randomBytes(32).toString('base64url')
}

export function digestShareToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function isMissingShareSchema(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.code === '42883' ||
        error.code === 'PGRST202' ||
        error.message?.includes('league_share_links')),
  )
}

export async function authorizeLeagueRead(
  request: NextRequest,
  database: AppSupabaseClient,
  leagueId: string,
  requestedSeason: string,
): Promise<LeagueReadAccessResult> {
  const commissioner = isValidAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET,
  )
  if (commissioner) {
    return { access: { kind: 'commissioner' }, error: null, status: 200 }
  }

  const token = request.nextUrl.searchParams.get('share')
  if (!isValidShareSeason(requestedSeason) || !isValidShareToken(token)) {
    return {
      access: null,
      error: 'A valid player share link is required.',
      status: 401,
    }
  }

  const result = await database
    .from('league_share_links')
    .select('id, season')
    .eq('league_id', leagueId)
    .eq('season', requestedSeason)
    .eq('token_digest', digestShareToken(token))
    .is('revoked_at', null)
    .maybeSingle()

  if (isMissingShareSchema(result.error)) {
    return {
      access: null,
      error: 'Player links are not available yet. Your league data is unaffected.',
      status: 409,
    }
  }
  if (result.error || !result.data) {
    return {
      access: null,
      error: 'This player share link is invalid or has been revoked.',
      status: 403,
    }
  }

  return {
    access: {
      kind: 'share',
      linkId: result.data.id,
      season: result.data.season,
    },
    error: null,
    status: 200,
  }
}
