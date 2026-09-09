import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { validateAutomationSettings } from '@/lib/automationSettings'
import { parseESPNSeasonSnapshot } from '@/lib/espn/seasonSnapshot'
import { parseESPNOnboardingSnapshot } from '@/lib/espn/onboarding'
import {
  ESPNRequestError,
  requestESPNSeasonData,
} from '@/lib/espn/request'

export const dynamic = 'force-dynamic'

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message, success: false }, { status })
}

export async function POST(request: NextRequest) {
  if (
    !isValidAdminSession(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
      process.env.ADMIN_SESSION_SECRET,
    )
  ) {
    return errorResponse('Commissioner sign-in is required.', 401)
  }

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return errorResponse('The ESPN preview request is not valid JSON.', 400)
  }

  const validation = validateAutomationSettings({
    ...(requestBody && typeof requestBody === 'object' ? requestBody : {}),
    auto_sync_enabled: false,
  })
  if (!validation.is_valid) {
    return errorResponse(validation.errors[0], 422)
  }

  const settings = validation.value
  if (settings.private_league && (!settings.espn_s2 || !settings.swid)) {
    return errorResponse(
      'Private ESPN leagues require both ESPN_S2 and SWID cookies.',
      422,
    )
  }

  try {
    const data = await requestESPNSeasonData({
      espn_s2: settings.espn_s2,
      league_id: settings.league_id,
      private_league: settings.private_league,
      swid: settings.swid,
      year: Number(settings.season),
    })
    const snapshot = parseESPNOnboardingSnapshot(data)
    if (!snapshot) {
      return errorResponse(
        `ESPN did not return teams for the ${settings.season} season. Confirm the season and league ID.`,
        422,
      )
    }

    const seasonSnapshot = parseESPNSeasonSnapshot(data, settings.season, [], {}, settings.league_id)
    return NextResponse.json({
      season_snapshot: seasonSnapshot,
      cron_configured: Boolean(process.env.CRON_SECRET),
      snapshot,
      success: true,
    })
  } catch (error) {
    const status = error instanceof ESPNRequestError ? error.status : 500
    return errorResponse(
      error instanceof Error ? error.message : 'ESPN league preview failed.',
      status,
    )
  }
}
