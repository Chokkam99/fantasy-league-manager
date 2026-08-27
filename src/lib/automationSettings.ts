export interface AutomationReadinessCheck {
  detail: string
  key: 'credentials' | 'cron' | 'league_id'
  label: string
  ready: boolean
}

export interface AutomationReadiness {
  can_enable_automatic: boolean
  can_save_connection: boolean
  checks: AutomationReadinessCheck[]
}

export interface AutomationSettingsInput {
  auto_sync_enabled: boolean
  espn_s2?: string
  league_id: string
  private_league: boolean
  season: string
  swid?: string
}

export type AutomationSettingsValidation =
  | { is_valid: true; value: AutomationSettingsInput }
  | { errors: string[]; is_valid: false }

function optionalCredential(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined
}

export function isValidESPNLeagueId(value: string) {
  return /^\d{1,20}$/.test(value.trim())
}

export function getAutomationReadiness({
  cronConfigured,
  hasEspnS2,
  hasSwid,
  leagueId,
  privateLeague,
}: {
  cronConfigured: boolean
  hasEspnS2: boolean
  hasSwid: boolean
  leagueId: string
  privateLeague: boolean
}): AutomationReadiness {
  const leagueIdReady = isValidESPNLeagueId(leagueId)
  const credentialsReady = !privateLeague || (hasEspnS2 && hasSwid)
  const checks: AutomationReadinessCheck[] = [
    {
      detail: leagueIdReady
        ? 'A numeric ESPN league ID is ready to test.'
        : 'Enter the numeric ID from the ESPN league URL.',
      key: 'league_id',
      label: 'ESPN league ID',
      ready: leagueIdReady,
    },
    {
      detail: credentialsReady
        ? privateLeague
          ? 'Both private-league cookies are available.'
          : 'Public leagues do not require ESPN cookies.'
        : 'Private leagues require both ESPN_S2 and SWID cookies.',
      key: 'credentials',
      label: 'League access',
      ready: credentialsReady,
    },
    {
      detail: cronConfigured
        ? 'The deployment has a cron authorization secret.'
        : 'CRON_SECRET must be configured in the deployment.',
      key: 'cron',
      label: 'Scheduled-run security',
      ready: cronConfigured,
    },
  ]

  return {
    can_enable_automatic: leagueIdReady && credentialsReady && cronConfigured,
    can_save_connection: leagueIdReady && credentialsReady,
    checks,
  }
}

export function validateAutomationSettings(
  input: unknown,
): AutomationSettingsValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      errors: ['The automation settings must be an object.'],
      is_valid: false,
    }
  }

  const body = input as Record<string, unknown>
  const leagueId =
    typeof body.league_id === 'string' ? body.league_id.trim() : ''
  const season = typeof body.season === 'string' ? body.season.trim() : ''
  const espnS2 = optionalCredential(body.espn_s2)
  const swid = optionalCredential(body.swid)
  const errors: string[] = []

  if (!isValidESPNLeagueId(leagueId)) {
    errors.push('Enter a valid numeric ESPN league ID.')
  }
  if (!/^\d{4}$/.test(season)) {
    errors.push('A valid season is required.')
  }
  if (typeof body.private_league !== 'boolean') {
    errors.push('Choose whether the ESPN league is private.')
  }
  if (typeof body.auto_sync_enabled !== 'boolean') {
    errors.push('Choose whether automatic sync is enabled.')
  }
  if (body.espn_s2 !== undefined && typeof body.espn_s2 !== 'string') {
    errors.push('ESPN_S2 must be text.')
  } else if ((espnS2?.length || 0) > 4096) {
    errors.push('ESPN_S2 is too long.')
  }
  if (body.swid !== undefined && typeof body.swid !== 'string') {
    errors.push('SWID must be text.')
  } else if ((swid?.length || 0) > 256) {
    errors.push('SWID is too long.')
  }

  if (errors.length > 0) return { errors, is_valid: false }

  return {
    is_valid: true,
    value: {
      auto_sync_enabled: body.auto_sync_enabled as boolean,
      espn_s2: espnS2,
      league_id: leagueId,
      private_league: body.private_league as boolean,
      season,
      swid,
    },
  }
}
