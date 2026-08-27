export const SHARE_TOKEN_BYTES = 32
export const SHARE_TOKEN_LENGTH = 43

export interface ShareLinkStatus {
  active: boolean
  created_at: string | null
  season: string
  token_prefix: string | null
}

export function isValidShareSeason(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}$/.test(value)
}

export function isValidShareToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === SHARE_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  )
}

export function buildSharePath(
  leagueId: string,
  season: string,
  token: string,
) {
  const query = new URLSearchParams({ season, share: token })
  return `/league/${encodeURIComponent(leagueId)}?${query.toString()}`
}
