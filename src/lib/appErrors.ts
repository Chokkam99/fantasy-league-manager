/** User-facing errors shared by API responses, client actions, and saved sync history. */
export const DEFAULT_ERROR_MESSAGE = 'The request could not be completed. Try again. If it keeps failing, contact the app maintainer.'

export function formatAppError(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  fallback = withRecovery(fallback)
  const details = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown; name?: unknown } : null
  const code = typeof details?.code === 'string' ? details.code : ''
  const raw = typeof error === 'string' ? error : typeof details?.message === 'string' ? details.message : ''
  const message = raw.replace(/^(?:(?:TypeError|Error):\s*)+/i, '').trim()

  if (/https?:\/\/|(?:espn_s2|swid|authorization|password|secret|token)\s*[=:]/i.test(message)) return fallback

  if (details?.name === 'SyntaxError' || /unexpected (?:token|end)|JSON\.parse/i.test(message)) {
    return 'The app received an unreadable response. Reload the latest data. If you were saving a change, check whether it was saved before trying again.'
  }

  if (['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code) || /(?:relation|column|function) .+ does not exist|schema cache|missing .*(?:environment|supabase)|(?:database|server|authentication|password verification).*(?:not configured|configuration)|apply .*migration|pending database update/i.test(message)) {
    return 'This feature is unavailable because the app’s database or server setup needs attention. Contact the app maintainer to repair it, then try again.'
  }
  if (['40001', '40P01', '55P03'].includes(code) || /deadlock detected|could not serialize|lock timeout/i.test(message)) {
    return 'Another update happened at the same time. Reload the latest data, review your changes, and try again.'
  }
  if (code === '23505' || /duplicate key value|unique constraint/i.test(message)) {
    return 'A matching record already exists. Reload the latest data and check for a duplicate before trying again.'
  }
  if (code === '23503' || /foreign key constraint/i.test(message)) {
    return 'A related player or season has changed, or still has records attached. Reload the latest data and review the affected player or season before trying again.'
  }
  if (code === '42501' || /row.level security|permission denied for/i.test(message)) {
    return 'The app could not access the required data. If you are the commissioner, sign in again. If this continues, contact the app maintainer.'
  }
  if (/^Commissioner sign-in is required\.?$/i.test(message)) {
    return 'Commissioner sign-in is required. Open the league menu, sign in, and try again.'
  }
  if (/^Invalid password\.?$/i.test(message)) return 'That password was not accepted. Check the commissioner password and try again.'
  if (/share link.*(?:not valid|invalid|revoked)/i.test(message)) return 'This share link is invalid or no longer active. Ask the commissioner for a new league link.'
  if (/^League not found\.?$/i.test(message)) return 'This league could not be found. Return to All leagues, or ask the commissioner for a new share link.'
  if (/^Season not found\.?$/i.test(message)) return 'This season could not be found. Choose another season, or ask the commissioner to import it from ESPN.'
  if (/not valid JSON|invalid authentication request|^Invalid action\.?$|^Unknown league view\.?$/i.test(message)) {
    return 'The app could not read this request. Reload the page and try again. If it keeps happening, contact the app maintainer.'
  }
  if (/ESPN.*(?:credentials|league is private)/i.test(message) && !/Open .*ESPN connection/i.test(message)) {
    return `${message} Open the ESPN connection settings, enter current private-league credentials, and test the connection again.`
  }
  if (/ESPN.*(?:request failed.*(?:429|rate)|too many requests)/i.test(message)) {
    return 'ESPN is limiting requests. Wait a few minutes, then try the sync again.'
  }
  if (/ESPN.*request failed.*404/i.test(message)) {
    return 'ESPN could not find this league or season. Check the ESPN league ID and selected season in the connection settings.'
  }
  if (/ESPN.*(?:request failed.*5\d\d|invalid response|no (?:team|schedule) data|invalid league data)/i.test(message)) {
    return 'ESPN did not return usable league data. Try again later. If it continues, check the ESPN league ID, season, and connection settings.'
  }
  if (/fetch failed|failed to fetch|network(?:error| request failed)|load failed|could not be reached|timed? ?out|timeout|operation was aborted|signal.*aborted/i.test(message) || details?.name === 'AbortError' || details?.name === 'TimeoutError') {
    const week = message.match(/\bweek (\d+)/i)?.[1]
    if (/ESPN/i.test(message)) return `ESPN could not be reached${week ? ` for week ${week}` : ''}. Retry when the connection is available.`
    return 'The connection was interrupted. Check your connection and reload the latest data. If you were saving a change, check whether it was saved before trying again.'
  }
  if (/unexpected (?:token|end)|JSON\.parse|not valid JSON|invalid .*result|invalid input syntax|violates .*constraint|null value in column|SQLSTATE|PostgrestError|SupabaseError|<!doctype|<html|\n\s*at |cannot (?:read|set) propert|is not a function|is not defined|\[object Object\]|https?:\/\/|(?:espn_s2|swid|authorization|password|secret|token)\s*[=:]/i.test(message) || /^(?:22|23|42|PGRST)/.test(code)) {
    return fallback
  }
  if (!message || /^(?:unknown (?:error|import error)|internal server error|request failed|fetch error|something went wrong)\.?$/i.test(message)) return fallback
  // Keep deliberate validation details (amounts, weeks, players, and conflict instructions).
  return withRecovery(message)
}

function withRecovery(message: string) {
  if (/(?:could not be (?:loaded|saved|updated|created|completed|cleared|removed|added|copied|revoked)|(?:request|update|setup|action|import) failed)\.$/i.test(message)) {
    return `${message} Reload the latest data before trying again. If this continues, contact the app maintainer.`
  }
  return message
}

/** Normalize transport errors without claiming that an unacknowledged write failed. */
export async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await (init === undefined ? fetch(input) : fetch(input, init))
  } catch (error) {
    const method = (init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase()
    const readOnly = method === 'GET' || method === 'HEAD'
    throw new Error(readOnly
      ? 'The connection was interrupted. Check your connection and try loading the page again.'
      : 'The connection was interrupted before the app could confirm the result. Reload the latest data and check whether your change was saved before trying again.', { cause: error })
  }
}
