import { isMissingLifecycleSchema } from './lifecycle'
import type { AppSupabaseClient } from './supabaseServer'

export async function getLifecycleWriteBlock(
  database: AppSupabaseClient,
  leagueId: string,
  season?: string,
) {
  const leagueResult = await database
    .from('leagues')
    .select('archived_at')
    .eq('id', leagueId)
    .maybeSingle()

  if (isMissingLifecycleSchema(leagueResult.error)) return null
  if (leagueResult.error) throw leagueResult.error
  if (leagueResult.data?.archived_at) {
    return 'This league is archived. Restore it in League Settings before making changes.'
  }
  if (!season) return null

  const seasonResult = await database
    .from('league_seasons')
    .select('archived_at')
    .eq('league_id', leagueId)
    .eq('season', season)
    .maybeSingle()

  if (isMissingLifecycleSchema(seasonResult.error)) return null
  if (seasonResult.error) throw seasonResult.error
  if (seasonResult.data?.archived_at) {
    return `${season} is archived. Restore it in League Settings before making changes.`
  }
  return null
}
