import { NextRequest, NextResponse } from 'next/server'
import {
  isValidShareToken,
  PLAYER_SHARE_COOKIE,
} from '@/lib/shareAccess'
import { digestShareToken } from '@/lib/shareAccessServer'
import {
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

interface RouteContext {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  if (!isValidShareToken(slug)) {
    return new NextResponse('This player link is not valid.', { status: 404 })
  }

  try {
    const database = createServerSupabaseClient()
    const result = await database
      .from('league_share_links')
      .select('league_id, season')
      .eq('token_digest', digestShareToken(slug))
      .is('revoked_at', null)
      .maybeSingle()

    if (result.error || !result.data) {
      return new NextResponse('This player link is not valid.', { status: 404 })
    }

    const target = new URL(
      `/league/${encodeURIComponent(result.data.league_id)}?season=${encodeURIComponent(result.data.season)}`,
      request.url,
    )
    const response = NextResponse.redirect(target)
    response.cookies.set(PLAYER_SHARE_COOKIE, slug, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 400,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return response
  } catch (error) {
    if (isServerSupabaseConfigurationError(error)) {
      return new NextResponse('Player links are temporarily unavailable.', {
        status: 503,
      })
    }
    return new NextResponse('This player link could not be opened.', {
      status: 500,
    })
  }
}
