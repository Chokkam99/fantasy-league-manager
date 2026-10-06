import { createHmac } from 'node:crypto'
import {
  type AppSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabaseServer'

type ThrottleDatabase = Pick<AppSupabaseClient, 'rpc'>

export interface LoginThrottleCheck {
  allowed: boolean
  retryAfterSeconds: number
}

const DEFAULT_LOCKOUT_SECONDS = 15 * 60

/**
 * Identify a sign-in client by a keyed hash of its IP address. Vercel sets
 * x-real-ip and x-forwarded-for itself and does not forward client-supplied
 * values, so the address cannot be chosen by the caller there.
 */
export function loginClientKey(headers: Headers, secret: string) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const address = headers.get('x-real-ip')?.trim() || forwarded || 'unknown'
  return createHmac('sha256', secret).update(`admin-login:${address}`).digest('hex')
}

function warnUnavailable(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? ` (${String(error.code)})` : ''
  console.warn(`Commissioner sign-in throttling is unavailable${code}; allowing the attempt.`)
}

/**
 * Database-backed sign-in throttling shared by every server instance. It
 * fails open: a missing migration or database outage must not lock the
 * commissioner out, so those cases are only logged.
 */
export function createLoginThrottle(
  headers: Headers,
  secret: string,
  createDatabase: () => ThrottleDatabase = createServerSupabaseClient,
) {
  const clientKey = loginClientKey(headers, secret)
  let database: ThrottleDatabase | null | undefined

  function connect() {
    if (database === undefined) {
      try {
        database = createDatabase()
      } catch (error) {
        warnUnavailable(error)
        database = null
      }
    }
    return database
  }

  async function call(name: 'check_admin_login_throttle' | 'clear_admin_login_failures' | 'record_admin_login_failure') {
    const connection = connect()
    if (!connection) return null
    try {
      const { data, error } = await connection.rpc(name, { p_client_key: clientKey })
      if (error) throw error
      return data
    } catch (error) {
      warnUnavailable(error)
      return null
    }
  }

  return {
    async check(): Promise<LoginThrottleCheck> {
      const result = await call('check_admin_login_throttle') as { allowed?: unknown; retry_after_seconds?: unknown } | null
      if (result?.allowed !== false) return { allowed: true, retryAfterSeconds: 0 }
      const retryAfter = Number(result.retry_after_seconds)
      return {
        allowed: false,
        retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : DEFAULT_LOCKOUT_SECONDS,
      }
    },
    async recordFailure() {
      await call('record_admin_login_failure')
    },
    async clear() {
      await call('clear_admin_login_failures')
    },
  }
}
