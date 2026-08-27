export type ValidLifecycleAction =
  | {
      action: 'set_league_archive'
      archived: boolean
    }
  | {
      action: 'set_season_archive'
      archived: boolean
      season: string
    }

export type LifecycleValidation =
  | { is_valid: true; value: ValidLifecycleAction }
  | { errors: string[]; is_valid: false }

export function validateLifecycleAction(input: unknown): LifecycleValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['The lifecycle request must be an object.'], is_valid: false }
  }

  const body = input as Record<string, unknown>
  const errors: string[] = []
  if (!['set_league_archive', 'set_season_archive'].includes(String(body.action))) {
    errors.push('Choose a supported lifecycle action.')
  }
  if (typeof body.archived !== 'boolean') {
    errors.push('Archive state must be true or false.')
  }

  if (body.action === 'set_season_archive') {
    if (typeof body.season !== 'string' || !/^\d{4}$/.test(body.season)) {
      errors.push('A valid season is required.')
    }
  }

  if (errors.length > 0) return { errors, is_valid: false }
  if (body.action === 'set_season_archive') {
    return {
      is_valid: true,
      value: {
        action: 'set_season_archive',
        archived: body.archived as boolean,
        season: body.season as string,
      },
    }
  }
  return {
    is_valid: true,
    value: {
      action: 'set_league_archive',
      archived: body.archived as boolean,
    },
  }
}

export function isMissingLifecycleSchema(
  error: { code?: string; message?: string } | null | undefined,
) {
  if (!error) return false
  if (['42703', '42883', 'PGRST202', 'PGRST204'].includes(error.code || '')) {
    return true
  }
  return /archived_at|archive_status/i.test(error.message || '') &&
    /column|function|schema cache/i.test(error.message || '')
}
