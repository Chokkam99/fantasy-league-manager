'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAutomationReadiness } from '@/lib/automationSettings'
import type {
  ESPNTeamMappingSnapshot,
  WeekImportData,
} from '@/lib/espn/types'
import type { ImportValidationResult } from '@/lib/espn/validation'
import {
  connectionDraftFromSettings,
  nextManualImportWeek,
  type PlatformConnectionDraft,
  type PlatformImportNotice,
  type PlatformImportOperation,
} from '@/lib/platformImport'
import {
  loadAutomationSettings,
  loadESPNTeamMapping,
  PlatformImportRequestError,
  requestESPNImport,
  saveAutomationSettings,
  saveESPNTeamMapping,
  type AutomationSettingsSnapshot,
  type ImportResponse,
} from '@/lib/platformImportClient'

export interface PlatformImportPreview {
  data: WeekImportData
  validation: ImportValidationResult
}

const emptyDraft: PlatformConnectionDraft = {
  autoSyncEnabled: false,
  espnLeagueId: '',
  espnS2: '',
  privateLeague: false,
  swid: '',
}

export function usePlatformImport(leagueId: string, season: string) {
  const [settings, setSettings] =
    useState<AutomationSettingsSnapshot | null>(null)
  const [draft, setDraft] = useState<PlatformConnectionDraft>(emptyDraft)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  const [operation, setOperation] = useState<PlatformImportOperation>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [showManualFallback, setShowManualFallback] = useState(false)
  const [manualWeek, setManualWeek] = useState(1)
  const [preview, setPreview] = useState<PlatformImportPreview | null>(null)
  const [teamMapping, setTeamMapping] =
    useState<ESPNTeamMappingSnapshot | null>(null)
  const [notice, setNotice] = useState<PlatformImportNotice>(null)

  const applySettings = useCallback((next: AutomationSettingsSnapshot) => {
    setSettings(next)
    setDraft(connectionDraftFromSettings(next))
    setManualWeek(nextManualImportWeek(next))
  }, [])

  const loadImportHealth = useCallback(async () => {
    setIsLoadingConfig(true)
    try {
      applySettings(await loadAutomationSettings(leagueId, season))
    } catch (error) {
      console.error('Failed to load import health:', error)
      setNotice({
        kind: 'error',
        message: getErrorMessage(
          error,
          'Score import status could not be loaded.',
        ),
      })
    } finally {
      setIsLoadingConfig(false)
    }
  }, [applySettings, leagueId, season])

  useEffect(() => {
    loadImportHealth()
  }, [loadImportHealth])

  const readiness = useMemo(
    () =>
      getAutomationReadiness({
        cronConfigured: settings?.cron_configured || false,
        hasEspnS2: Boolean(settings?.has_espn_s2 || draft.espnS2.trim()),
        hasSwid: Boolean(settings?.has_swid || draft.swid.trim()),
        leagueId: draft.espnLeagueId,
        privateLeague: draft.privateLeague,
      }),
    [draft, settings],
  )

  const updateDraft = useCallback(
    <TKey extends keyof PlatformConnectionDraft>(
      key: TKey,
      value: PlatformConnectionDraft[TKey],
    ) => setDraft((current) => ({ ...current, [key]: value })),
    [],
  )

  const saveConnection = async () => {
    if (!readiness.can_save_connection) {
      const failedCheck = readiness.checks.find(
        (check) => check.key !== 'cron' && !check.ready,
      )
      setNotice({
        kind: 'error',
        message: failedCheck?.detail || 'Complete the ESPN connection first.',
      })
      return
    }
    if (draft.autoSyncEnabled && !readiness.can_enable_automatic) {
      setNotice({
        kind: 'error',
        message: 'Configure CRON_SECRET before enabling automatic sync.',
      })
      return
    }

    setOperation('config')
    setNotice(null)
    try {
      const result = await saveAutomationSettings(leagueId, {
        auto_sync_enabled: draft.autoSyncEnabled,
        espn_s2: draft.privateLeague ? draft.espnS2 || undefined : undefined,
        league_id: draft.espnLeagueId,
        private_league: draft.privateLeague,
        season,
        swid: draft.privateLeague ? draft.swid || undefined : undefined,
      })
      applySettings(result.settings)
      setShowConfig(false)
      setNotice({ kind: 'success', message: result.message })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: getErrorMessage(error, 'ESPN setup failed.'),
      })
    } finally {
      setOperation(null)
    }
  }

  const loadTeamMapping = async () => {
    setOperation('mapping-load')
    setNotice(null)
    try {
      setTeamMapping(await loadESPNTeamMapping(leagueId, season))
    } catch (error) {
      setNotice({
        kind: 'error',
        message: getErrorMessage(
          error,
          'ESPN team assignments could not be loaded.',
        ),
      })
    } finally {
      setOperation(null)
    }
  }

  const saveTeamMapping = async (mappings: Record<string, string>) => {
    setOperation('mapping-save')
    setNotice(null)
    try {
      const result = await saveESPNTeamMapping(
        leagueId,
        season,
        mappings,
      )
      setTeamMapping(null)
      setPreview(null)
      setNotice({ kind: 'success', message: result.message })
    } catch (error) {
      const payload = requestErrorPayload<{ mapping?: ESPNTeamMappingSnapshot }>(
        error,
      )
      if (payload?.mapping) setTeamMapping(payload.mapping)
      setNotice({
        kind: 'error',
        message: getErrorMessage(
          error,
          'ESPN team assignments could not be saved.',
        ),
      })
    } finally {
      setOperation(null)
    }
  }

  const runImport = async (
    action: 'preview' | 'sync',
    week: number | 'latest',
  ) => {
    setOperation(action)
    setNotice(null)
    if (action === 'preview') setPreview(null)

    try {
      const payload = await requestESPNImport(leagueId, season, action, week)
      if (action === 'preview' && payload.preview && payload.validation) {
        setPreview({ data: payload.preview, validation: payload.validation })
        setNotice({
          kind: payload.validation.can_import ? 'success' : 'error',
          message: payload.validation.can_import
            ? `Week ${payload.week} is complete and ready to import.`
            : `Week ${payload.week} can be reviewed but is not ready to import.`,
        })
        return
      }

      setPreview(null)
      setNotice({
        kind: 'success',
        message:
          payload.result?.message ||
          `Week ${payload.week} synced successfully.`,
      })
      await loadImportHealth()
      window.dispatchEvent(
        new CustomEvent('league-scores-imported', {
          detail: { week: payload.week },
        }),
      )
    } catch (error) {
      const payload = requestErrorPayload<ImportResponse>(error)
      if (payload?.code === 'TEAM_MAPPING_REQUIRED' && payload.mapping) {
        setTeamMapping(payload.mapping)
        setNotice({
          kind: 'error',
          message:
            payload.error || 'Review the ESPN team assignments first.',
        })
        return
      }
      setNotice({
        kind: 'error',
        message: getErrorMessage(error, 'The ESPN request failed.'),
      })
      await loadImportHealth()
    } finally {
      setOperation(null)
    }
  }

  return {
    closeMapping: () => setTeamMapping(null),
    draft,
    isBusy: operation !== null,
    isLoadingConfig,
    loadImportHealth,
    loadTeamMapping,
    manualWeek,
    notice,
    operation,
    preview,
    readiness,
    runImport,
    saveConnection,
    saveTeamMapping,
    setManualWeek,
    setShowConfig,
    setShowManualFallback,
    settings,
    showConfig,
    showManualFallback,
    teamMapping,
    updateDraft,
  }
}

function requestErrorPayload<T>(error: unknown) {
  return error instanceof PlatformImportRequestError
    ? (error.payload as T | null)
    : null
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
