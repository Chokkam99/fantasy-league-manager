import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { AutomationReadiness } from '@/lib/automationSettings'
import type { PlatformConnectionDraft } from '@/lib/platformImport'

interface ESPNConnectionPanelProps {
  draft: PlatformConnectionDraft
  hasStoredEspnS2: boolean
  hasStoredSwid: boolean
  isBusy: boolean
  isSaving: boolean
  onCancel: () => void
  onSave: () => void
  onUpdate: <TKey extends keyof PlatformConnectionDraft>(
    key: TKey,
    value: PlatformConnectionDraft[TKey],
  ) => void
  readiness: AutomationReadiness
}

const inputClass =
  'mt-1 min-h-11 w-full rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-base font-normal text-app-text outline-none focus:border-app-brand focus:ring-2 focus:ring-app-brand/20 sm:text-sm'

export function ESPNConnectionPanel({
  draft,
  hasStoredEspnS2,
  hasStoredSwid,
  isBusy,
  isSaving,
  onCancel,
  onSave,
  onUpdate,
  readiness,
}: ESPNConnectionPanelProps) {
  return (
    <div className="border-b border-app-border bg-app-surface-subtle p-4 sm:p-6">
      <h3 className="font-semibold text-app-text">ESPN connection</h3>
      <p className="mt-1 text-sm leading-6 text-app-text-muted">
        Public leagues only need the league ID. Private leagues also need ESPN cookies. Settings are tested and stored through the commissioner-only server route.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-app-text">
          ESPN league ID *
          <input
            autoComplete="off"
            className={inputClass}
            inputMode="numeric"
            onChange={(event) => onUpdate('espnLeagueId', event.target.value)}
            placeholder="Example: 123456789"
            value={draft.espnLeagueId}
          />
        </label>

        <label className="flex min-h-11 items-start gap-3 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface p-3 text-sm sm:mt-6">
          <input
            checked={draft.privateLeague}
            className="mt-1"
            onChange={(event) => onUpdate('privateLeague', event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-semibold text-app-text">Private ESPN league</span>
            <span className="mt-1 block text-app-text-muted">Requires ESPN_S2 and SWID cookies.</span>
          </span>
        </label>
      </div>

      {draft.privateLeague && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CredentialField
            label="ESPN_S2 cookie *"
            onChange={(value) => onUpdate('espnS2', value)}
            placeholder={hasStoredEspnS2 ? 'Stored — leave blank to keep' : 'Paste ESPN_S2'}
            value={draft.espnS2}
          />
          <CredentialField
            label="SWID cookie *"
            onChange={(value) => onUpdate('swid', value)}
            placeholder={hasStoredSwid ? 'Stored — leave blank to keep' : 'Paste SWID'}
            value={draft.swid}
          />
          <p className="text-xs leading-5 text-app-text-muted sm:col-span-2">
            Cookie values are sent only when you save, are never returned to this page, and blank fields keep the stored values.
          </p>
        </div>
      )}

      <div className="mt-5 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface p-3 sm:p-4">
        <p className="text-sm font-semibold text-app-text">Connection readiness</p>
        <ul className="mt-3 grid gap-2">
          {readiness.checks.map((check) => (
            <li className="flex items-start justify-between gap-3 text-sm" key={check.key}>
              <span className="min-w-0">
                <span className="block font-medium text-app-text">{check.label}</span>
                <span className="mt-0.5 block leading-5 text-app-text-muted">{check.detail}</span>
              </span>
              <Badge variant={check.ready ? 'success' : 'warning'}>
                {check.ready ? 'Ready' : 'Needed'}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <label className="mt-4 flex min-h-11 items-start gap-3 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface p-3 text-sm">
        <input
          checked={draft.autoSyncEnabled}
          className="mt-1"
          disabled={!draft.autoSyncEnabled && !readiness.can_enable_automatic}
          onChange={(event) => onUpdate('autoSyncEnabled', event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="block font-semibold text-app-text">Import completed scores automatically</span>
          <span className="mt-1 block leading-5 text-app-text-muted">
            Runs Wednesday at 2:00 AM Phoenix. It imports the latest completed week and rechecks one prior week for late ESPN corrections. A scheduled sync can replace manual scores for those weeks.
          </span>
        </span>
      </label>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel} variant="secondary">Cancel</Button>
        <Button
          disabled={
            isBusy ||
            !readiness.can_save_connection ||
            (draft.autoSyncEnabled && !readiness.can_enable_automatic)
          }
          onClick={onSave}
        >
          {isSaving ? 'Testing connection…' : 'Save and test'}
        </Button>
      </div>
    </div>
  )
}

function CredentialField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <label className="block text-sm font-semibold text-app-text">
      {label}
      <input
        autoComplete="new-password"
        className={inputClass}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="password"
        value={value}
      />
    </label>
  )
}
