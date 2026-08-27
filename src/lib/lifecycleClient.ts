import type { ValidLifecycleAction } from './lifecycle'

export interface LifecycleSnapshot {
  league: {
    archived_at: string | null
    current_season: string
    id: string
  } | null
  schema_ready: boolean
  seasons: Array<{
    archived_at: string | null
    is_active: boolean | null
    season: string
  }>
  success: true
}

async function payload(response: Response) {
  return response.json().catch(() => null)
}

export async function loadLifecycle(leagueId: string): Promise<LifecycleSnapshot> {
  const response = await fetch(
    `/api/leagues/${encodeURIComponent(leagueId)}/lifecycle`,
    { cache: 'no-store' },
  )
  const body = await payload(response)
  if (!response.ok) {
    throw new Error(body?.error || 'Lifecycle settings could not be loaded.')
  }
  return body as LifecycleSnapshot
}

export async function performLifecycleAction(
  leagueId: string,
  action: ValidLifecycleAction,
) {
  const response = await fetch(
    `/api/leagues/${encodeURIComponent(leagueId)}/lifecycle`,
    {
      body: JSON.stringify(action),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )
  const body = await payload(response)
  if (!response.ok) {
    throw new Error(body?.error || 'Archive state could not be updated.')
  }
  return body
}
