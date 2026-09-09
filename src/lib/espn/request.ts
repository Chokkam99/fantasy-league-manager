import type { ESPNAPIResponse, ESPNConfig } from './types'

export class ESPNRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ESPNRequestError'
    this.status = status
  }
}

function buildESPNUrl(
  baseUrl: string,
  endpoint: string,
  params: Record<string, string>,
) {
  if (endpoint && (!endpoint.startsWith('/') || endpoint.includes('://'))) {
    throw new ESPNRequestError('Invalid ESPN endpoint', 400)
  }

  const url = new URL(`${baseUrl}${endpoint}`)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return url
}

async function parseESPNResponse(response: Response, usedCredentials: boolean) {
  const responseText = await response.text()
  const returnedHtml = responseText.includes('<!DOCTYPE html>')

  if (!response.ok || returnedHtml) {
    if (response.status === 401 || response.status === 403 || returnedHtml) {
      throw new ESPNRequestError(
        usedCredentials
          ? 'ESPN rejected the saved private-league credentials.'
          : 'This ESPN league is private and requires valid credentials.',
        401,
      )
    }

    throw new ESPNRequestError(
      `ESPN request failed with status ${response.status}.`,
      response.status || 502,
    )
  }

  try {
    return JSON.parse(responseText) as ESPNAPIResponse
  } catch {
    throw new ESPNRequestError('ESPN returned an invalid response.', 502)
  }
}

async function fetchESPNUrl(url: URL, cookie?: string) {
  return fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Fantasy-League-Manager/1.0',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
}

export async function requestESPNData(
  config: ESPNConfig,
  endpoint = '',
  params: Record<string, string> = {},
) {
  const leaguePath = `/apis/v3/games/ffl/seasons/${config.year}/segments/0/leagues/${config.league_id}`
  const publicUrl = buildESPNUrl(
    `https://lm-api-reads.fantasy.espn.com${leaguePath}`,
    endpoint,
    params,
  )
  if (config.private_league && config.espn_s2 && config.swid) {
    return parseESPNResponse(await fetchESPNUrl(publicUrl, `espn_s2=${config.espn_s2}; SWID=${config.swid};`), true)
  }
  const publicResponse = await fetchESPNUrl(publicUrl)

  if (publicResponse.ok) {
    try { return await parseESPNResponse(publicResponse, false) }
    catch (error) {
      if (!(error instanceof ESPNRequestError) || error.status !== 401 || !config.espn_s2 || !config.swid) throw error
    }
  }

  if (!config.espn_s2 || !config.swid) {
    return parseESPNResponse(publicResponse, false)
  }

  const privateUrl = buildESPNUrl(
    `https://lm-api-reads.fantasy.espn.com${leaguePath}`,
    endpoint,
    params,
  )
  const privateResponse = await fetchESPNUrl(
    privateUrl,
    `espn_s2=${config.espn_s2}; SWID=${config.swid};`,
  )

  return parseESPNResponse(privateResponse, true)
}

export async function requestESPNOnboardingData(config: ESPNConfig) {
  const [settingsData, teamData] = await Promise.all([
    requestESPNData(config, '', { view: 'mSettings' }),
    requestESPNData(config, '', { view: 'mTeam' }),
  ])

  return {
    ...settingsData,
    ...teamData,
    members: teamData.members,
    settings: settingsData.settings || teamData.settings,
    teams: teamData.teams,
  } satisfies ESPNAPIResponse
}

/** Load the requested season's own records; never substitute the current season. */
export async function requestESPNSeasonData(config: ESPNConfig) {
  const responses = await Promise.all(['mSettings', 'mTeam', 'mMatchup'].map(view => requestESPNData(config, '', { view })))
  for (const response of responses) {
    const identity = response as ESPNAPIResponse & { id?: number; seasonId?: number }
    if (String(identity.id) !== config.league_id || identity.seasonId !== config.year) {
      throw new ESPNRequestError('ESPN did not confirm the requested league and season. No data was imported.', 422)
    }
  }
  return { ...responses[0], ...responses[1], ...responses[2], settings: responses[0].settings, teams: responses[1].teams, members: responses[1].members, schedule: responses[2].schedule }
}
