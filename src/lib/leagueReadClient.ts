function currentShareToken() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('share')
}

export function addCurrentShareToken(query: URLSearchParams) {
  const token = currentShareToken()
  if (token) query.set('share', token)
  return query
}

export async function loadLeagueView<T>(
  leagueId: string,
  resource: string,
  options: { season?: string; shareToken?: string; week?: number } = {},
): Promise<T> {
  const query = new URLSearchParams({ resource })
  if (options.season) query.set('season', options.season)
  if (options.week) query.set('week', String(options.week))
  if (options.shareToken) query.set('share', options.shareToken)
  else addCurrentShareToken(query)

  const response = await fetch(
    `/api/leagues/${encodeURIComponent(leagueId)}/view?${query.toString()}`,
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === 'string'
        ? payload.error
        : 'League data could not be loaded.',
    )
  }
  return payload as T
}
