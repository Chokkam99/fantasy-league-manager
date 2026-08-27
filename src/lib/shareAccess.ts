export const SHARE_TOKEN_BYTES = 32
export const SHARE_TOKEN_LENGTH = 43
export const SHARE_SLUG_LENGTH = 12
export const PLAYER_SHARE_COOKIE = 'flm-player-share'

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
    (value.length === SHARE_TOKEN_LENGTH || value.length === SHARE_SLUG_LENGTH) &&
    /^[A-Za-z0-9_-]+$/.test(value)
  )
}

export function buildSharePath(
  _leagueId: string,
  _season: string,
  token: string,
) {
  return `/s/${encodeURIComponent(token)}`
}
