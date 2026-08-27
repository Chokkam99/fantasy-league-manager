import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'

export async function performMemberAction(
  leagueId: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/leagues/${encodeURIComponent(leagueId)}/members`,
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )
  const payload = (await response.json().catch(() => null)) as {
    error?: string
    message?: string
    success?: boolean
  } | null

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'The player action failed.')
  }

  const season = typeof body.season === 'string' ? body.season : undefined
  invalidateLeagueReadCache(leagueId, season)
  invalidateFinanceCache(leagueId, season)

  return payload.message || 'Player updated.'
}
