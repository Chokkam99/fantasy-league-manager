'use client'

import { ESPNTeamMappingPanel } from '@/components/league/ESPNTeamMappingPanel'
import { ESPNConnectionPanel } from '@/components/platform-import/ESPNConnectionPanel'
import { PlatformImportActions } from '@/components/platform-import/PlatformImportActions'
import { PlatformImportPreview } from '@/components/platform-import/PlatformImportPreview'
import { PlatformImportSummary } from '@/components/platform-import/PlatformImportSummary'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { usePlatformImport } from '@/hooks/usePlatformImport'

interface PlatformImportProps {
  leagueId: string
  season: string
}

export default function PlatformImport({ leagueId, season }: PlatformImportProps) {
  const platformImport = usePlatformImport(leagueId, season)
  const {
    draft,
    isBusy,
    isLoadingConfig,
    manualWeek,
    notice,
    operation,
    preview,
    readiness,
    settings,
    showConfig,
    showManualFallback,
    teamMapping,
  } = platformImport
  const isConfigured = settings?.is_configured || false

  return (
    <Card className="mb-6 overflow-hidden">
      <PlatformImportSummary
        isLoading={isLoadingConfig}
        onToggleConfig={() => platformImport.setShowConfig((current) => !current)}
        settings={settings}
        showConfig={showConfig}
      />

      {showConfig && (
        <ESPNConnectionPanel
          draft={draft}
          hasStoredEspnS2={settings?.has_espn_s2 || false}
          hasStoredSwid={settings?.has_swid || false}
          isBusy={isBusy}
          isSaving={operation === 'config'}
          onCancel={() => platformImport.setShowConfig(false)}
          onSave={platformImport.saveConnection}
          onUpdate={platformImport.updateDraft}
          readiness={readiness}
        />
      )}

      {isConfigured && !showConfig && !isLoadingConfig && (
        <PlatformImportActions
          isBusy={isBusy}
          manualWeek={manualWeek}
          onLoadMapping={platformImport.loadTeamMapping}
          onManualWeekChange={platformImport.setManualWeek}
          onRunImport={platformImport.runImport}
          onToggleManual={() =>
            platformImport.setShowManualFallback((current) => !current)
          }
          operation={operation}
          showManualFallback={showManualFallback}
          syncHasError={settings?.sync_status === 'error'}
          totalWeeks={settings?.total_weeks || 17}
        />
      )}

      {teamMapping && (
        <ESPNTeamMappingPanel
          isSaving={operation === 'mapping-save'}
          key={teamMapping.assignments
            .map(
              (assignment) =>
                `${assignment.espn_team_id}:${assignment.member_id}`,
            )
            .join('|')}
          onCancel={platformImport.closeMapping}
          onSave={platformImport.saveTeamMapping}
          season={season}
          snapshot={teamMapping}
        />
      )}

      {!isConfigured && !showConfig && !isLoadingConfig && (
        <div className="p-4 text-sm leading-6 text-app-text-muted sm:p-6">
          ESPN is not connected for this league. Weekly scores can still be entered manually below.
        </div>
      )}

      {notice && (
        <Notice
          className="mx-4 mb-4 sm:mx-6 sm:mb-6"
          tone={notice.kind === 'error' ? 'danger' : 'success'}
        >
          {notice.message}
        </Notice>
      )}

      {preview && <PlatformImportPreview preview={preview} />}
    </Card>
  )
}
