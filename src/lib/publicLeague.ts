// Browser reads must never request the credential-bearing platform_config,
// espn_s2, or espn_swid columns. Keep this list aligned with the column grants
// in the authorization-foundation migration.
export const PUBLIC_LEAGUE_COLUMNS = `
  id,
  name,
  current_season,
  created_at,
  updated_at,
  platform_type,
  platform_league_id,
  auto_sync_enabled,
  sync_status,
  last_sync_at,
  last_sync_error
`

export const PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE = `
  ${PUBLIC_LEAGUE_COLUMNS},
  archived_at
`
