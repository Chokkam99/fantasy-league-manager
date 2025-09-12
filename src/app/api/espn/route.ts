import { NextRequest, NextResponse } from 'next/server'

// Server-side ESPN API proxy to bypass CORS restrictions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leagueId, year, espnS2, swid, endpoint, params } = body

    if (!leagueId || !year) {
      return NextResponse.json(
        { error: 'Missing required parameters: leagueId, year' },
        { status: 400 }
      )
    }

    // Try public read-only endpoint first, fallback to authenticated endpoint
    const publicUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}`
    const privateUrl = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}`
    
    let response: Response
    let isPrivateAttempt = false

    // First try: public endpoint (works for most leagues)
    const publicEndpoint = new URL(publicUrl + (endpoint || ''))
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        publicEndpoint.searchParams.append(key, value as string)
      })
    }

    response = await fetch(publicEndpoint.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Fantasy-League-Manager/1.0)'
      },
      method: 'GET'
    })

    // If public endpoint fails and we have credentials, try private endpoint
    if (!response.ok && espnS2 && swid) {
      isPrivateAttempt = true
      const privateEndpoint = new URL(privateUrl + (endpoint || ''))
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          privateEndpoint.searchParams.append(key, value as string)
        })
      }

      response = await fetch(privateEndpoint.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; Fantasy-League-Manager/1.0)',
          'Cookie': `espn_s2=${espnS2}; SWID=${swid};`
        },
        method: 'GET'
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      
      // Check if it's an HTML response (likely auth required)
      if (errorText.includes('<!DOCTYPE html>')) {
        if (isPrivateAttempt) {
          return NextResponse.json(
            { error: 'ESPN API requires valid authentication. Please check your espn_s2 and SWID cookies.' },
            { status: 401 }
          )
        } else {
          return NextResponse.json(
            { error: 'ESPN league appears to be private. Please provide valid espn_s2 and SWID cookies.' },
            { status: 401 }
          )
        }
      }
      
      return NextResponse.json(
        { error: `ESPN API request failed: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const responseText = await response.text()
    
    try {
      const data = JSON.parse(responseText)
      return NextResponse.json(data)
    } catch {
      // Check if it's an HTML response (likely auth required)
      if (responseText.includes('<!DOCTYPE html>')) {
        return NextResponse.json(
          { error: 'ESPN league requires authentication. Please provide valid espn_s2 and SWID cookies.' },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { error: 'ESPN API returned invalid JSON response' },
        { status: 502 }
      )
    }
    
  } catch (error) {
    console.error('ESPN API proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}