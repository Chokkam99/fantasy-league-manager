export const LEAGUE_DATA_CHANGED = 'league-data-changed'

function currentShareToken() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('share')
}

const CACHE_TTL_MS = 5 * 60 * 1000
const leagueViewCache = new Map<
  string,
  { expiresAt: number; value: unknown }
>()
const leagueViewRequests = new Map<string, Promise<unknown>>()

function leagueViewPath(
  leagueId: string,
  resource: string,
  options: { season?: string; shareToken?: string; week?: number },
) {
  const query = new URLSearchParams({ resource })
  if (options.season) query.set('season', options.season)
  if (options.week) query.set('week', String(options.week))
  if (options.shareToken) query.set('share', options.shareToken)
  else addCurrentShareToken(query)
  return `/api/leagues/${encodeURIComponent(leagueId)}/view?${query.toString()}`
}

export function invalidateLeagueReadCache(
  leagueId?: string,
  season?: string,
) {
  const leagueFragment = leagueId
    ? `/api/leagues/${encodeURIComponent(leagueId)}/view?`
    : null
  const seasonFragment = season ? `season=${encodeURIComponent(season)}` : null

  for (const key of new Set([...leagueViewCache.keys(), ...leagueViewRequests.keys()])) {
    if (leagueFragment && !key.startsWith(leagueFragment)) continue
    if (seasonFragment && !key.includes(seasonFragment)) continue
    leagueViewCache.delete(key)
    leagueViewRequests.delete(key)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEAGUE_DATA_CHANGED, { detail: { leagueId, season } }))
  }
}

export function addCurrentShareToken(query: URLSearchParams) {
  const token = currentShareToken()
  if (token) query.set('share', token)
  return query
}

export async function loadLeagueView<T>(
  leagueId: string,
  resource: string,
  options: {
    force?: boolean
    season?: string
    shareToken?: string
    week?: number
  } = {},
): Promise<T> {
  const path = leagueViewPath(leagueId, resource, options)
  const cached = leagueViewCache.get(path)
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.value as T
  }
  if (!options.force) {
    const pending = leagueViewRequests.get(path)
    if (pending) return pending as Promise<T>
  }

  const request: Promise<T> = Promise.resolve().then(async () => {
    const response = await fetch(path, { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(
        payload && typeof payload.error === 'string'
          ? payload.error
          : 'League data could not be loaded.',
      )
    }
    if (leagueViewRequests.get(path) === request) {
      leagueViewCache.set(path, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: payload,
      })
    }
    return payload as T
  })
  leagueViewRequests.set(path, request)
  try {
    return await request
  } finally {
    if (leagueViewRequests.get(path) === request) leagueViewRequests.delete(path)
  }
}

export async function prefetchLeagueViews(leagueId: string, season: string) {
  await Promise.allSettled(
    ['season', 'overview', 'standings', 'scores', 'prizes', 'memberships', 'history'].map(
      (resource) => loadLeagueView(leagueId, resource, { season }),
    ),
  )
}
