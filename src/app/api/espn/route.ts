import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/adminSession'
import { ESPNRequestError, requestESPNData } from '@/lib/espn/request'

interface ESPNProxyRequest {
  endpoint?: string
  espnS2?: string
  leagueId?: string
  params?: Record<string, string>
  swid?: string
  year?: number
}

export async function POST(request: NextRequest) {
  if (
    !isValidAdminSession(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
      process.env.ADMIN_SESSION_SECRET,
    )
  ) {
    return NextResponse.json(
      { error: 'Commissioner sign-in is required.' },
      { status: 401 },
    )
  }

  try {
    const body = (await request.json()) as ESPNProxyRequest

    if (!body.leagueId || !body.year) {
      return NextResponse.json(
        { error: 'Missing required parameters: leagueId, year' },
        { status: 400 },
      )
    }

    const data = await requestESPNData(
      {
        league_id: body.leagueId,
        year: body.year,
        espn_s2: body.espnS2,
        swid: body.swid,
      },
      body.endpoint,
      body.params,
    )

    return NextResponse.json(data)
  } catch (error) {
    const status = error instanceof ESPNRequestError ? error.status : 500
    const message =
      error instanceof Error ? error.message : 'ESPN request failed.'

    console.error('ESPN API proxy error:', message)
    return NextResponse.json({ error: message }, { status })
  }
}
