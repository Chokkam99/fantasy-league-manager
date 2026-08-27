export type ActiveSeasonAccess =
  | { allowed: true }
  | { allowed: false; message: string }

const SEASON_PATTERN = /^\d{4}$/

/**
 * ESPN operations are intentionally limited to a league's active season.
 * Historical seasons may contain manually curated data that must not be
 * replaced by a platform response.
 */
export function validateActiveSeasonAccess(
  requestedSeason: unknown,
  currentSeason: unknown,
): ActiveSeasonAccess {
  if (
    typeof currentSeason !== 'string' ||
    !SEASON_PATTERN.test(currentSeason)
  ) {
    return {
      allowed: false,
      message: 'The league active season is not configured correctly.',
    }
  }

  if (
    typeof requestedSeason !== 'string' ||
    !SEASON_PATTERN.test(requestedSeason)
  ) {
    return {
      allowed: false,
      message: 'A valid season is required.',
    }
  }

  if (requestedSeason !== currentSeason) {
    return {
      allowed: false,
      message: `ESPN operations are limited to the active ${currentSeason} season. ${requestedSeason} is preserved as historical data.`,
    }
  }

  return { allowed: true }
}
