'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FormField, TextInput, Select } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'
import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'
import { resolveSeasonImport, type SeasonImportPreview, type SeasonImportResolution } from '@/lib/espn/seasonImport'

interface Metadata { season: string; current_season: string; exists: boolean; connection: { is_configured: boolean; league_id: string; private_league: boolean; has_credentials: boolean } }
interface Connection { league_id: string; private_league: boolean; espn_s2: string; swid: string }
const emptyConnection: Connection = { league_id: '', private_league: false, espn_s2: '', swid: '' }
const label = (key: string) => ({ total_weeks: 'Total weeks', playoff_start_week: 'Playoffs start in week', playoff_spots: 'Playoff teams', divisions: 'Divisions (comma-separated)' }[key] || key)

export function ESPNSeasonImport({ leagueId, requestedSeason, onImported, onManualSetup, onCancel }: {
  leagueId: string; requestedSeason?: string; onImported: (season: string) => Promise<void> | void; onManualSetup?: () => void; onCancel: () => void
}) {
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [season, setSeason] = useState(requestedSeason || '')
  const [connection, setConnection] = useState<Connection>(emptyConnection)
  const [showConnection, setShowConnection] = useState(false)
  const [preview, setPreview] = useState<SeasonImportPreview | null>(null)
  const [resolutions, setResolutions] = useState<Record<number, SeasonImportResolution>>({})
  const [missing, setMissing] = useState<Record<string, unknown>>({})
  const [confirmedSettings, setConfirmedSettings] = useState(false)
  const [confirmDepartures, setConfirmDepartures] = useState(false)
  const [busy, setBusy] = useState<'loading' | 'preview' | 'apply' | null>('loading')
  const [error, setError] = useState('')
  const [applied, setApplied] = useState('')
  const version = useRef(0)
  const submitting = useRef(false)
  const endpoint = `/api/leagues/${encodeURIComponent(leagueId)}/seasons/espn`
  const adoptPreview = (next: SeasonImportPreview) => {
    setPreview(next); setResolutions({}); setConfirmDepartures(false); setConfirmedSettings(false)
    setMissing(Object.fromEntries(next.missing_fields.map(field => [field, next.configuration[field as keyof typeof next.configuration]])))
  }
  const loadPreview = async (selectedSeason = season, selectedConnection = connection) => {
    const request = ++version.current
    setBusy('preview'); setError(''); setPreview(null)
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'preview', season: selectedSeason, connection: selectedConnection }) })
      const data = await response.json()
      if (!response.ok || !data.preview) throw new Error(data.error || 'ESPN could not confirm this season.')
      if (request === version.current) { adoptPreview(data.preview); setShowConnection(false) }
    } catch (reason) { if (request === version.current) { setError(reason instanceof Error ? reason.message : 'ESPN import could not be loaded.'); setShowConnection(true) } }
    finally { if (request === version.current) setBusy(null) }
  }
  useEffect(() => {
    const request = ++version.current
    const load = async () => {
      setBusy('loading'); setError(''); setPreview(null); setApplied('')
      try {
        const response = await fetch(`${endpoint}${requestedSeason ? `?season=${encodeURIComponent(requestedSeason)}` : ''}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Season import could not be loaded.')
        if (request !== version.current) return
        const next = data as Metadata
        const saved = { ...emptyConnection, league_id: next.connection.league_id, private_league: next.connection.private_league }
        setMetadata(next); setSeason(next.season); setConnection(saved); setShowConnection(!next.connection.is_configured)
        if (next.connection.is_configured) await loadPreview(next.season, saved)
        else setBusy(null)
      } catch (reason) { if (request === version.current) { setError(reason instanceof Error ? reason.message : 'Season import could not be loaded.'); setBusy(null) } }
    }
    void load()
    // This numeric request generation deliberately invalidates the latest pending read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { version.current++ }
    // The initial read is scoped to the requested league/season; user changes use the refresh action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, requestedSeason])

  const input = { resolutions: Object.values(resolutions), missing_values: confirmedSettings ? missing : {}, confirm_departures: confirmDepartures }
  const resolved = preview ? resolveSeasonImport(preview, input) : null
  const conflicts = preview?.espn.teams.filter(team => team.status === 'unconfirmed') || []
  const unresolved = conflicts.filter(team => !resolutions[team.team_id]?.confirmed)
  const uniqueHistory = preview ? [...preview.history].sort((a,b) => b.season.localeCompare(a.season)).filter((member, index, list) => list.findIndex(value => (value.manager_id || value.id) === (member.manager_id || member.id)) === index) : []
  const openResult = async (target: string) => { try { await onImported(target) } catch { setError('The import completed, but the season could not be opened. Try Open season again.') } }
  const apply = async () => {
    if (!preview || !resolved || resolved.errors.length || submitting.current || applied) return
    submitting.current = true; setBusy('apply'); setError('')
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'apply', season, connection, revision: preview.revision, confirmed: true, ...input }) })
      const data = await response.json()
      if (!response.ok || !data.success) { if (data.preview) adoptPreview(data.preview); throw new Error(data.error || 'The import was not completed. Your review is still here.') }
      setApplied(data.season)
      invalidateFinanceCache(leagueId); invalidateLeagueReadCache(leagueId)
      await openResult(data.season)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The import could not be completed.') }
    finally { submitting.current = false; setBusy(null) }
  }
  const changeConnection = (next: Connection) => { setConnection(next); setPreview(null); setError('') }

  return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
    <p className="text-xs font-bold uppercase tracking-widest text-app-brand">ESPN season import</p>
    <h1 className="mt-2 text-2xl font-bold text-app-text sm:text-3xl">{applied ? `${applied} is up to date` : `Bring ${season || 'your season'} into League Office`}</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted">ESPN supplies the roster, divisions, season format, and confirmed results. You only need to resolve uncertain matches or missing information.</p>
    {error && <Notice className="mt-5" tone="danger">{error}</Notice>}
    {applied ? <div className="mt-6"><Notice tone="success">The import is complete. Existing payments and private payment notes were preserved.</Notice><Button className="mt-4" onClick={() => void openResult(applied)}>Open season</Button></div> : <fieldset disabled={Boolean(busy)} className="min-w-0">
      <section className="mt-6 rounded-2xl border border-app-border bg-app-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-app-text">{metadata?.connection.is_configured ? 'Your ESPN connection' : 'Connect ESPN to get started'}</h2><p className="mt-1 text-sm text-app-text-muted">{connection.league_id ? `ESPN league ${connection.league_id}` : 'Paste your league link. Private leagues need access cookies once.'}</p></div><Button disabled={Boolean(busy)} onClick={() => setShowConnection(value => !value)} variant="ghost">{showConnection ? 'Hide connection' : 'Change season or connection'}</Button></div>
        {showConnection && <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]"><FormField htmlFor="import-league" label="ESPN league URL or ID"><TextInput id="import-league" autoComplete="off" value={connection.league_id} onChange={event => changeConnection({ ...connection, league_id: event.target.value })} /></FormField><FormField htmlFor="import-season" label="Season"><TextInput id="import-season" type="number" min={2000} max={Number(metadata?.current_season || season) + 1} value={season} onChange={event => { setSeason(event.target.value); setPreview(null) }} /></FormField></div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-app-text"><input type="checkbox" checked={connection.private_league} onChange={event => changeConnection({ ...connection, private_league: event.target.checked })} />Private ESPN league</label>
          {connection.private_league && <div className="grid gap-4 sm:grid-cols-2">{(['espn_s2','swid'] as const).map(key => <FormField htmlFor={`import-${key}`} label={key === 'swid' ? 'SWID cookie' : 'ESPN_S2 cookie'} key={key}><TextInput id={`import-${key}`} type="password" autoComplete="new-password" placeholder={metadata?.connection.has_credentials ? 'Stored — leave blank to keep' : 'Paste cookie value'} value={connection[key]} onChange={event => changeConnection({ ...connection, [key]: event.target.value })} /></FormField>)}</div>}
        </div>}
        <Button className="mt-4" disabled={Boolean(busy) || !connection.league_id.trim() || !/^\d{4}$/.test(season)} onClick={() => void loadPreview()} variant={preview ? 'secondary' : 'primary'}>{busy === 'loading' ? 'Loading connection…' : busy === 'preview' ? 'Reading ESPN…' : preview ? 'Refresh ESPN preview' : 'Import from ESPN'}</Button>
        {busy === 'preview' && <p className="mt-3 text-sm text-app-text-muted" role="status">Checking this season’s teams, owners, format, and completed weeks…</p>}
      </section>
      {preview && <div className="mt-6 space-y-5">
        <section className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-app-text">{preview.espn.league_name} · {preview.season}</h2><Badge variant={unresolved.length || preview.missing_fields.length && !confirmedSettings ? 'warning' : 'success'}>{unresolved.length ? `${unresolved.length} ${unresolved.length === 1 ? 'player needs' : 'players need'} review` : 'Roster confirmed'}</Badge></div><p className="mt-2 text-sm leading-6 text-app-text-muted">{preview.espn.teams.length} players · {preview.espn.weeks.length} completed {preview.espn.weeks.length === 1 ? 'week' : 'weeks'} ready · {preview.exists ? 'Update this season' : Number(preview.season) > Number(preview.current_season) ? 'Create and activate the new season' : 'Add historical season'}</p>
          <details className="mt-4 rounded-xl bg-app-surface-subtle p-3"><summary className="cursor-pointer text-sm font-semibold text-app-text">Confirmed data from ESPN</summary><p className="mt-3 text-sm text-app-text-muted">{preview.espn.format.total_weeks ?? 'Unconfirmed'} weeks · {preview.espn.format.playoff_spots ?? 'Unconfirmed'} playoff teams · Playoffs start week {preview.espn.format.playoff_start_week ?? 'unconfirmed'}</p><ul className="mt-3 divide-y divide-app-border">{preview.espn.teams.filter(team => team.status !== 'unconfirmed').map(team => <li className="py-3 text-sm" key={team.team_id}><span className="font-semibold text-app-text">{team.manager_name}</span><span className="mt-1 block text-app-text-muted">{team.team_name}{team.division ? ` · ${team.division}` : ''} · {team.status === 'new' ? 'New player' : 'History matched'}</span></li>)}</ul></details>
        </section>
        {conflicts.length > 0 && <section className="space-y-4" aria-label="Players needing confirmation"><h2 className="text-lg font-bold text-app-text">Confirm these players</h2>{conflicts.map(team => {
          const resolution = resolutions[team.team_id] || { team_id: team.team_id, source_member_id: null, manager_name: team.manager_name, team_name: team.team_name, confirmed: false }
          const update = (patch: Partial<SeasonImportResolution>) => setResolutions(current => ({ ...current, [team.team_id]: { ...resolution, ...patch } }))
          return <div className="rounded-xl border border-app-warning/30 bg-app-surface p-4 sm:p-5" key={team.team_id}><h3 className="font-bold text-app-text">{team.team_name || `ESPN team ${team.team_id}`}</h3><p className="mt-1 text-sm leading-6 text-app-text-muted">{team.reason}</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><FormField htmlFor={`identity-${team.team_id}`} label="Who is this player?"><Select id={`identity-${team.team_id}`} value={resolution.confirmed ? resolution.source_member_id || 'new' : ''} onChange={event => update({ source_member_id: event.target.value === 'new' ? null : event.target.value || null, confirmed: Boolean(event.target.value) })}><option value="">Choose a player</option><option value="new">Someone new to this league</option>{uniqueHistory.map(member => <option value={member.id} key={member.id}>{member.manager_name} · {member.season}</option>)}</Select></FormField><FormField htmlFor={`manager-${team.team_id}`} label="Manager name"><TextInput id={`manager-${team.team_id}`} maxLength={80} value={resolution.manager_name} onChange={event => update({ manager_name: event.target.value })} /></FormField>{!team.team_name && <FormField htmlFor={`team-${team.team_id}`} label="Team name"><TextInput id={`team-${team.team_id}`} maxLength={80} value={resolution.team_name} onChange={event => update({ team_name: event.target.value })} /></FormField>}</div></div>
        })}</section>}
        {preview.missing_fields.length > 0 && <section className="rounded-xl border border-app-warning/30 bg-app-surface p-4 sm:p-6"><h2 className="text-lg font-bold text-app-text">ESPN could not confirm these settings</h2><p className="mt-1 text-sm text-app-text-muted">We’ve suggested existing values where available. Confirm or correct only these fields.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{preview.missing_fields.map(field => <FormField htmlFor={`missing-${field}`} label={label(field)} key={field}><TextInput id={`missing-${field}`} type={field === 'divisions' ? 'text' : 'number'} value={Array.isArray(missing[field]) ? (missing[field] as string[]).join(', ') : String(missing[field] ?? '')} onChange={event => { setMissing(current => ({ ...current, [field]: field === 'divisions' ? event.target.value.split(',').map(value => value.trim()).filter(Boolean) : event.target.value })); setConfirmedSettings(false) }} /></FormField>)}</div><label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-app-text"><input type="checkbox" checked={confirmedSettings} onChange={event => setConfirmedSettings(event.target.checked)} />These missing settings are correct</label></section>}
        {resolved && resolved.departing.length > 0 && !unresolved.length && <Notice tone="warning"><p>These existing players are absent from the resolved ESPN roster: {resolved.departing.map(member => member.manager_name).join(', ')}.</p><label className="mt-3 flex min-h-11 items-start gap-3"><input className="mt-1" type="checkbox" checked={confirmDepartures} onChange={event => setConfirmDepartures(event.target.checked)} /><span>Mark them inactive for this season. Their payment records and earlier seasons remain intact.</span></label></Notice>}
        {preview.espn.warnings.length > 0 && <Notice tone="warning">{preview.espn.warnings.map(warning => <p key={warning}>{warning}</p>)}</Notice>}
        <Notice tone="info"><p>{preview.exists ? 'Existing dues, payment records, private notes, and prize budgets stay intact.' : `Dues and prize budgets ${Number(preview.season) > Number(preview.current_season) ? `carry forward from ${preview.current_season}` : 'start at zero for a historical season'}. Payments begin unpaid.`} Entry fee: ${preview.configuration.fee_amount} per player.</p><p className="mt-2">{preview.espn.weeks.length ? `Importing replaces scores and matchups for the ${preview.espn.weeks.length} confirmed ${preview.espn.weeks.length === 1 ? 'week' : 'weeks'} in ${preview.season}, including any manual corrections in those weeks.` : 'No completed weeks are confirmed yet. The roster and format can still be imported.'}</p></Notice>
        {resolved && resolved.errors.length > 0 && !unresolved.length && (!preview.missing_fields.length || confirmedSettings) && (confirmDepartures || !resolved.departing.length) && <Notice tone="warning">{resolved.errors.map(message => <p key={message}>{message}</p>)}</Notice>}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface p-3 shadow-lg md:bottom-4"><Button disabled={Boolean(busy)} onClick={onCancel} variant="secondary">Back</Button><Button disabled={Boolean(busy) || Boolean(resolved?.errors.length)} onClick={() => void apply()}>{busy === 'apply' ? 'Importing season…' : `${preview.exists ? 'Update' : 'Create'} ${preview.season} from ESPN`}</Button></div>
      </div>}
      {onManualSetup && <details className="mt-6 text-sm text-app-text-muted"><summary className="cursor-pointer py-3">ESPN unavailable or using a different platform?</summary><p className="mt-2 leading-6">Manual setup is available as a fallback. You can reconcile the season with ESPN later.</p><Button className="mt-3" disabled={Boolean(busy)} onClick={onManualSetup} variant="secondary">Set up manually</Button></details>}
    </fieldset>}
  </main>
}
