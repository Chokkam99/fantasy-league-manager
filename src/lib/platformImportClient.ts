import type { AutomationReadiness } from '@/lib/automationSettings'
import type {
  ESPNTeamMappingSnapshot,
  WeekImportData,
} from '@/lib/espn/types'
import type { ImportValidationResult } from '@/lib/espn/validation'
import type { ImportRunSummary } from '@/lib/platformImport'

export interface AutomationSettingsSnapshot {
  auto_sync_enabled: boolean
  cron_configured: boolean
  has_espn_s2: boolean
  has_swid: boolean
  is_configured: boolean
  last_sync_at: string | null
  last_sync_error: string | null
  latest_imported_week: number
  latest_import_run: ImportRunSummary | null
  league_id: string
  private_league: boolean
  readiness: AutomationReadiness
  season: string
  sync_status: string
  total_weeks: number
}

export interface AutomationSettingsDraft {
  auto_sync_enabled: boolean
  espn_s2?: string
  league_id: string
  private_league: boolean
  season: string
  swid?: string
}

export interface ImportResponse {
  code?: string
  error?: string
  mapping?: ESPNTeamMappingSnapshot
  preview?: WeekImportData
  result?: { message: string }
  success: boolean
  validation?: ImportValidationResult
  week?: number
}

interface AutomationResponse {
  error?: string
  message?: string
  settings?: AutomationSettingsSnapshot
  success: boolean
}

interface MappingResponse {
  error?: string
  mapping?: ESPNTeamMappingSnapshot
  message?: string
  success: boolean
}

export class PlatformImportRequestError<TPayload = unknown> extends Error {
  constructor(
    message: string,
    readonly payload: TPayload | null,
  ) {
    super(message)
    this.name = 'PlatformImportRequestError'
  }
}

async function readPayload<T>(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as T | null
  if (!response.ok) {
    const error = payload as { error?: unknown } | null
    throw new PlatformImportRequestError(
      typeof error?.error === 'string' ? error.error : fallback,
      payload,
    )
  }
  if (!payload) throw new PlatformImportRequestError(fallback, null)
  return payload
}

function automationPath(leagueId: string) {
  return `/api/leagues/${encodeURIComponent(leagueId)}/automation`
}

export async function loadAutomationSettings(
  leagueId: string,
  season: string,
) {
  const query = new URLSearchParams({ season })
  const response = await fetch(`${automationPath(leagueId)}?${query}`)
  const payload = await readPayload<AutomationResponse>(
    response,
    'Score import status could not be loaded.',
  )
  if (!payload.success || !payload.settings) {
    throw new PlatformImportRequestError(
      payload.error || 'Score import status could not be loaded.',
      payload,
    )
  }
  return payload.settings
}

export async function saveAutomationSettings(
  leagueId: string,
  draft: AutomationSettingsDraft,
) {
  const response = await fetch(automationPath(leagueId), {
    body: JSON.stringify(draft),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const payload = await readPayload<AutomationResponse>(
    response,
    'ESPN setup failed.',
  )
  if (!payload.success || !payload.settings) {
    throw new PlatformImportRequestError(
      payload.error || 'ESPN setup failed.',
      payload,
    )
  }
  return {
    message: payload.message || 'ESPN connection saved and tested.',
    settings: payload.settings,
  }
}

function mappingPath(leagueId: string) {
  return `${automationPath(leagueId)}/mapping`
}

export async function loadESPNTeamMapping(
  leagueId: string,
  season: string,
) {
  const query = new URLSearchParams({ season })
  const response = await fetch(`${mappingPath(leagueId)}?${query}`)
  const payload = await readPayload<MappingResponse>(
    response,
    'ESPN team assignments could not be loaded.',
  )
  if (!payload.success || !payload.mapping) {
    throw new PlatformImportRequestError(
      payload.error || 'ESPN team assignments could not be loaded.',
      payload,
    )
  }
  return payload.mapping
}

export async function saveESPNTeamMapping(
  leagueId: string,
  season: string,
  mappings: Record<string, string>,
) {
  const response = await fetch(mappingPath(leagueId), {
    body: JSON.stringify({ mappings, season }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const payload = await readPayload<MappingResponse>(
    response,
    'ESPN team assignments could not be saved.',
  )
  if (!payload.success || !payload.mapping) {
    throw new PlatformImportRequestError(
      payload.error || 'ESPN team assignments could not be saved.',
      payload,
    )
  }
  return {
    mapping: payload.mapping,
    message: payload.message || `ESPN team assignments saved for ${season}.`,
  }
}

export async function requestESPNImport(
  leagueId: string,
  season: string,
  action: 'preview' | 'sync',
  week: number | 'latest',
) {
  const response = await fetch(
    `/api/leagues/${encodeURIComponent(leagueId)}/scores/import`,
    {
      body: JSON.stringify({ action, season, week }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )
  const payload = await readPayload<ImportResponse>(
    response,
    'The ESPN request failed.',
  )
  if (!payload.success) {
    throw new PlatformImportRequestError(
      payload.error || 'The ESPN request failed.',
      payload,
    )
  }
  if (
    !Number.isInteger(payload.week) ||
    (action === 'preview' && (!payload.preview || !payload.validation))
  ) {
    throw new PlatformImportRequestError(
      'The ESPN response was incomplete. No scores were changed.',
      payload,
    )
  }
  return payload
}
