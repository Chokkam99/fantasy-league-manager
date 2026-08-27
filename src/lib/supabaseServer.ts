import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export type AppSupabaseClient = SupabaseClient<Database>

export class ServerSupabaseConfigurationError extends Error {
  constructor() {
    super('Server database access is not configured.')
    this.name = 'ServerSupabaseConfigurationError'
  }
}

/**
 * Creates a stateless privileged client for authenticated server routes only.
 *
 * Keep this module out of client components. The secret key bypasses RLS and
 * must only be used after the route has verified commissioner or cron access.
 */
export function createServerSupabaseClient(): AppSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !secretKey) {
    throw new ServerSupabaseConfigurationError()
  }

  return createClient<Database>(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

export function isServerSupabaseConfigurationError(
  error: unknown,
): error is ServerSupabaseConfigurationError {
  return error instanceof ServerSupabaseConfigurationError
}
