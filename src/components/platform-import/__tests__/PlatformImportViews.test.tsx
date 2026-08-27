import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ESPNConnectionPanel } from '@/components/platform-import/ESPNConnectionPanel'
import { PlatformImportActions } from '@/components/platform-import/PlatformImportActions'
import { PlatformImportSummary } from '@/components/platform-import/PlatformImportSummary'
import { getAutomationReadiness } from '@/lib/automationSettings'
import type { AutomationSettingsSnapshot } from '@/lib/platformImportClient'

const settings: AutomationSettingsSnapshot = {
  auto_sync_enabled: true,
  cron_configured: true,
  has_espn_s2: false,
  has_swid: false,
  is_configured: true,
  last_sync_at: '2026-08-26T09:00:00.000Z',
  last_sync_error: null,
  latest_imported_week: 3,
  latest_import_run: null,
  league_id: '123',
  private_league: false,
  readiness: {
    can_enable_automatic: true,
    can_save_connection: true,
    checks: [],
  },
  season: '2026',
  sync_status: 'active',
  total_weeks: 17,
}

describe('Platform import views', () => {
  it('publishes the exact Phoenix schedule and sanitized connection status', () => {
    render(
      <PlatformImportSummary
        isLoading={false}
        onToggleConfig={jest.fn()}
        settings={settings}
        showConfig={false}
      />,
    )

    expect(screen.getByText('Automatic weekly')).toBeInTheDocument()
    expect(screen.getByText('Wednesday, 2:00 AM Phoenix')).toBeInTheDocument()
    expect(screen.getByText('2026 · 17 weeks')).toBeInTheDocument()
    expect(screen.queryByText(/ESPN_S2|SWID/)).not.toBeInTheDocument()
  })

  it('keeps completed-week actions primary and selected-week sync tucked away', async () => {
    const user = userEvent.setup()
    const onRunImport = jest.fn()
    const onToggleManual = jest.fn()
    const { rerender } = render(
      <PlatformImportActions
        isBusy={false}
        manualWeek={4}
        onLoadMapping={jest.fn()}
        onManualWeekChange={jest.fn()}
        onRunImport={onRunImport}
        onToggleManual={onToggleManual}
        operation={null}
        showManualFallback={false}
        syncHasError={false}
        totalWeeks={17}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Sync completed week' }))
    await user.click(screen.getByRole('button', { name: 'Need a different week?' }))
    expect(onRunImport).toHaveBeenCalledWith('sync', 'latest')
    expect(onToggleManual).toHaveBeenCalledTimes(1)

    rerender(
      <PlatformImportActions
        isBusy={false}
        manualWeek={4}
        onLoadMapping={jest.fn()}
        onManualWeekChange={jest.fn()}
        onRunImport={onRunImport}
        onToggleManual={onToggleManual}
        operation={null}
        showManualFallback
        syncHasError={false}
        totalWeeks={17}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Preview week 4' }))
    expect(onRunImport).toHaveBeenCalledWith('preview', 4)
  })

  it('explains credential privacy and the bounded correction pass', () => {
    const draft = {
      autoSyncEnabled: true,
      espnLeagueId: '123',
      espnS2: '',
      privateLeague: true,
      swid: '',
    }
    render(
      <ESPNConnectionPanel
        draft={draft}
        hasStoredEspnS2
        hasStoredSwid
        isBusy={false}
        isSaving={false}
        onCancel={jest.fn()}
        onSave={jest.fn()}
        onUpdate={jest.fn()}
        readiness={getAutomationReadiness({
          cronConfigured: true,
          hasEspnS2: true,
          hasSwid: true,
          leagueId: '123',
          privateLeague: true,
        })}
      />,
    )

    expect(screen.getAllByPlaceholderText('Stored — leave blank to keep')).toHaveLength(2)
    expect(screen.getByText(/never returned to this page/)).toBeInTheDocument()
    expect(screen.getByText(/rechecks one prior week/)).toBeInTheDocument()
  })
})
