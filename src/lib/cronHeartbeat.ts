export type CronHeartbeatOutcome = 'fail' | 'success'

/**
 * Ping an external heartbeat monitor (Healthchecks.io-style URLs: the base
 * URL for success, `<url>/fail` for failure) so a missed or failed weekly run
 * produces an alert. A run that never starts — a wrong CRON_SECRET or no
 * invocation at all — sends no ping, and the monitor alerts on the silence.
 * Monitoring must never break the import, so every error is only logged.
 */
export async function reportCronHeartbeat(
  heartbeatUrl: string | undefined,
  outcome: CronHeartbeatOutcome,
  fetchImpl: typeof fetch = fetch,
) {
  if (!heartbeatUrl) return

  let target: URL
  try {
    target = new URL(heartbeatUrl)
  } catch {
    console.warn('Cron heartbeat skipped: CRON_HEARTBEAT_URL is not a valid URL.')
    return
  }
  if (target.protocol !== 'https:') {
    console.warn('Cron heartbeat skipped: CRON_HEARTBEAT_URL must use https.')
    return
  }
  if (outcome === 'fail') target.pathname = `${target.pathname.replace(/\/+$/, '')}/fail`

  try {
    const response = await fetchImpl(target, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) console.warn(`Cron heartbeat ping returned HTTP ${response.status}.`)
  } catch (error) {
    console.warn(
      'Cron heartbeat ping failed:',
      error instanceof Error ? error.message : 'Unknown error',
    )
  }
}
