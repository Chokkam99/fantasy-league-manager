'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField, TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { SeasonRosterBuilder } from './SeasonRosterBuilder'
import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'
import { createSeasonSetupDraft, draftIssues, draftMembers, draftRequest, numberValue, restoreSeasonSetupDraft, rosterIssue, type RolloverPreview, type SeasonSetupDraft, type SettingsDraft } from '@/lib/seasonSetupDraft'

const steps = ['Players', 'Format', 'Money', 'Review']
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const draftKey = (leagueId: string, season: string) => `flm-season-draft:${leagueId}:${season}`

export default function SeasonSetupForm({ leagueId, onCancel, onStarted }: {
  leagueId: string; onCancel: () => void; onStarted: (season: string) => Promise<void> | void
}) {
  const [preview, setPreview] = useState<RolloverPreview | null>(null)
  const [draft, setDraft] = useState<SeasonSetupDraft | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [restored, setRestored] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [createdSeason, setCreatedSeason] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const stepsRef = useRef<HTMLElement>(null)
  const submitting = useRef(false)
  const prizeSequence = useRef(0)

  useEffect(() => {
    let cancelled = false
    setPreview(null); setDraft(null); setError(''); setCreatedSeason(''); setRestored(false)
    const load = async () => {
      try {
        const response = await fetch(`/api/leagues/${encodeURIComponent(leagueId)}/seasons/rollover`, { cache: 'no-store' })
        const payload = await response.json() as { preview?: RolloverPreview; error?: string }
        if (!response.ok || !payload.preview) throw new Error(payload.error || 'Season setup could not be loaded.')
        if (cancelled) return
        const next = payload.preview
        let saved: SeasonSetupDraft | null = null
        try { saved = restoreSeasonSetupDraft(sessionStorage.getItem(draftKey(leagueId, next.target_season)), next) } catch { setStorageAvailable(false) }
        setPreview(next); setDraft(saved || createSeasonSetupDraft(next)); setRestored(Boolean(saved))
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Season setup could not be loaded.') }
    }
    void load()
    return () => { cancelled = true }
  }, [leagueId, attempt])

  useEffect(() => {
    if (!preview || !draft || createdSeason || preview.target_exists) return
    try {
      if (JSON.stringify(draft) === JSON.stringify(createSeasonSetupDraft(preview))) {
        sessionStorage.removeItem(draftKey(leagueId, preview.target_season))
        return
      }
      sessionStorage.setItem(draftKey(leagueId, preview.target_season), JSON.stringify({ version: 1, source: preview.source_season, target: preview.target_season, draft }))
    } catch { setStorageAvailable(false) }
  }, [leagueId, preview, draft, createdSeason])

  const changeDraft = (next: SeasonSetupDraft) => { setDraft(next); setError('') }
  const goToStep = (step: number) => {
    if (!draft || step === draft.step) return
    changeDraft({ ...draft, step })
    requestAnimationFrame(() => { headingRef.current?.focus({ preventScroll: true }); stepsRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }) })
  }
  const openCreated = async (season: string) => {
    try { await onStarted(season) } catch { setError('The season was created, but could not be opened. Use Open players & dues to try again.') }
  }
  const start = async () => {
    if (!preview || !draft || submitting.current || createdSeason) return
    const issues = draftIssues(preview, draft)
    if (issues.length) { setError(issues.join(' ')); return }
    submitting.current = true; setIsStarting(true); setError('')
    try {
      const response = await fetch(`/api/leagues/${encodeURIComponent(leagueId)}/seasons/rollover`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draftRequest(preview, draft)),
      })
      const payload = await response.json() as { target_season?: string; error?: string }
      if (!response.ok || !payload.target_season) throw new Error(payload.error || 'The season could not be created. Your draft is still here.')
      setCreatedSeason(payload.target_season)
      invalidateFinanceCache(leagueId)
      invalidateLeagueReadCache(leagueId)
      try { sessionStorage.removeItem(draftKey(leagueId, preview.target_season)) } catch { /* Creation succeeded even if local storage is unavailable. */ }
      await openCreated(payload.target_season)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The season could not be created. Your draft is still here.') }
    finally { submitting.current = false; setIsStarting(false) }
  }

  if (!preview || !draft) return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    {error ? <Notice tone="danger"><p>{error}</p><Button className="mt-3" onClick={() => setAttempt(value => value + 1)} variant="secondary">Retry season setup</Button></Notice> : <SkeletonGroup label="Loading season setup"><Skeleton className="h-24" /><Skeleton className="mt-6 h-96" /></SkeletonGroup>}
    <Button className="mt-4" onClick={onCancel} variant="ghost">Back to league</Button>
  </main>

  if (createdSeason || preview.target_exists || !preview.can_start) return <main className="mx-auto max-w-xl px-4 py-12 sm:px-6"><div className="rounded-2xl border border-app-border bg-app-surface p-6 sm:p-8">
    <p className="text-xs font-bold uppercase tracking-widest text-app-brand">New season</p>
    <h1 className="mt-3 text-2xl font-bold text-app-text">{createdSeason ? `${createdSeason} is ready` : preview.target_exists ? `${preview.target_season} already exists` : 'Season setup is unavailable'}</h1>
    <p className="mt-3 text-sm leading-6 text-app-text-muted">{createdSeason || preview.target_exists ? 'Open the roster to manage players and start collecting dues.' : 'Return to the league to review its current status.'}</p>
    {error && <Notice className="mt-4" tone="danger">{error}</Notice>}
    <div className="mt-6 flex flex-wrap gap-2">{(createdSeason || preview.target_exists) && <Button disabled={isStarting} onClick={() => void openCreated(createdSeason || preview.target_season)}>Open players & dues</Button>}<Button onClick={onCancel} variant="secondary">Back to league</Button></div>
  </div></main>

  const members = draftMembers(preview, draft)
  const rosterError = rosterIssue(preview, draft)
  const issues = draftIssues(preview, draft)
  // Validate format independently of money so incomplete later steps never block earlier ones.
  const formatDraft = { ...draft, prizes: [], settings: { ...draft.settings, entryFee: '0', draftCost: '0', weeklyPrize: '0' } }
  const stepIssues = draft.step === 0 ? (rosterError ? [rosterError] : []) : draft.step === 1 ? draftIssues(preview, formatDraft) : issues
  const expected = members.length * (numberValue(draft.settings.entryFee) || 0)
  const weeklyTotal = (numberValue(draft.settings.weeklyPrize) || 0) * (numberValue(draft.settings.totalWeeks) || 0)
  const finalTotal = draft.prizes.reduce((sum, prize) => sum + (numberValue(prize.amount) || 0), 0)
  const planned = (numberValue(draft.settings.draftCost) || 0) + weeklyTotal + finalTotal
  const balance = Math.round((expected - planned) * 100) / 100
  const returning = preview.members.filter(member => member.selected_by_default && draft.members[member.id]?.selected).length
  const comeback = members.length - returning - draft.newMembers.length
  const sittingOut = preview.members.filter(member => member.selected_by_default && !draft.members[member.id]?.selected)
  const setting = (key: keyof SettingsDraft, label: string, max: number, hint?: string) => <FormField htmlFor={`setup-${key}`} label={label} description={hint}><TextInput id={`setup-${key}`} type="number" min={key === 'playoffSpots' ? 2 : key === 'totalWeeks' || key === 'playoffStartWeek' ? 1 : 0} max={max} step={['entryFee', 'draftCost', 'weeklyPrize'].includes(key) ? '0.01' : '1'} value={draft.settings[key]} onChange={event => changeDraft({ ...draft, settings: { ...draft.settings, [key]: event.target.value } })} /></FormField>
  const moneySummary = <div className={`rounded-xl border p-4 ${balance < 0 ? 'border-app-danger/30 bg-app-danger-soft' : balance === 0 ? 'border-app-success/30 bg-app-success-soft' : 'border-app-border bg-app-surface-subtle'}`}>
    <div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-app-text-muted">Expected dues</p><p className="mt-1 text-xl font-bold text-app-text">{currency.format(expected)}</p></div><div><p className="text-app-text-muted">Planned spending</p><p className="mt-1 text-xl font-bold text-app-text">{currency.format(planned)}</p></div></div>
    <p className="mt-3 text-sm font-semibold text-app-text">{balance === 0 ? 'Every dollar is assigned.' : balance < 0 ? `${currency.format(-balance)} over budget. Adjust payouts or dues, or plan for extra funding.` : `${currency.format(balance)} unassigned. You can allocate it now or later.`}</p>
  </div>

  return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-app-brand">A fresh start</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl text-app-text">Set up {preview.target_season}</h1><p className="mt-2 text-sm text-app-text-muted">Start with {preview.source_season}, then make this season your own.</p></div>
      <Button disabled={isStarting} onClick={onCancel} variant="ghost">{storageAvailable ? 'Save & exit' : 'Exit setup'}</Button>
    </div>
    <p className="mt-4 text-xs leading-5 text-app-text-muted" role="status">{storageAvailable ? restored ? 'Draft restored. Changes are saved in this browser tab until you create the season.' : 'Your draft saves in this browser tab. Nothing changes in the league until you create the season.' : 'This browser cannot save your draft. Keep this tab open until you create the season.'}</p>
    <nav ref={stepsRef} aria-label="Season setup steps" className="my-6 scroll-mt-24 md:scroll-mt-36 xl:scroll-mt-24 grid grid-cols-4 gap-1 rounded-xl border border-app-border bg-app-surface p-1">
      {steps.map((label, index) => <button aria-current={draft.step === index ? 'step' : undefined} className={`min-h-12 rounded-lg px-1 text-xs font-semibold sm:text-sm ${draft.step === index ? 'bg-app-brand text-white' : 'text-app-text-muted hover:bg-app-surface-subtle disabled:opacity-50'}`} disabled={isStarting || index > draft.step} key={label} onClick={() => goToStep(index)}><span className="mr-1 opacity-70">{index + 1}.</span>{label}</button>)}
    </nav>
    <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-7">
      <h2 className="sr-only scroll-mt-24" ref={headingRef} tabIndex={-1}>{steps[draft.step]} · Step {draft.step + 1} of 4</h2>
      {draft.step === 0 && <SeasonRosterBuilder preview={preview} draft={draft} onChange={changeDraft} />}
      {draft.step === 1 && <div className="space-y-6">
        <div><h2 className="text-xl font-bold text-app-text">Shape the season</h2><p className="mt-1 text-sm leading-6 text-app-text-muted">These settings carry over from {preview.source_season}. Check that they fit your {members.length}-player roster.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">{setting('totalWeeks', 'Total weeks', 25)}{setting('playoffStartWeek', 'Playoffs start in week', 25)}{setting('playoffSpots', 'Playoff teams', members.length, `${members.length} teams are on your roster.`)}</div>
        <FormField htmlFor="setup-groups" label="Divisions" optional description="Separate names with commas. Leave blank for one league-wide standings table."><TextInput id="setup-groups" value={draft.settings.groups} onChange={event => changeDraft({ ...draft, settings: { ...draft.settings, groups: event.target.value } })} placeholder="East, West" /></FormField>
        {draft.settings.groups.trim() && <p className="text-sm leading-6 text-app-text-muted">To assign a player to a division, return to Players and choose Edit. Players without a division stay unassigned.</p>}
      </div>}
      {draft.step === 2 && <div className="space-y-6">
        <div><h2 className="text-xl font-bold text-app-text">Set dues and payouts</h2><p className="mt-1 text-sm leading-6 text-app-text-muted">Start with last season’s amounts. New-season dues begin unpaid; prior payments stay with their original season.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">{setting('entryFee', 'Entry fee per player ($)', 1000000)}{setting('draftCost', 'Draft food / expenses ($)', 1000000)}{setting('weeklyPrize', 'Weekly prize ($)', 1000000, `Budgeted for all ${draft.settings.totalWeeks} weeks: ${currency.format(weeklyTotal)}.`)}</div>
        <section aria-label="Season payouts"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold text-app-text">Season payouts</h3><Button disabled={draft.prizes.length >= 32} onClick={() => changeDraft({ ...draft, prizes: [...draft.prizes, { id: `new-${Date.now()}-${++prizeSequence.current}`, label: '', amount: '0' }] })} size="sm" variant="secondary">Add payout</Button></div>
          {!draft.prizes.length && <p className="rounded-xl border border-dashed border-app-border p-4 text-sm text-app-text-muted">No season payouts yet. Add places or special awards, or decide later.</p>}
          <div className="space-y-3">{draft.prizes.map((prize, index) => <div className="flex flex-wrap items-end gap-2 rounded-xl bg-app-surface-subtle p-3" key={prize.id}><div className="min-w-0 flex-1 basis-36"><FormField htmlFor={`payout-${prize.id}`} label={`Payout ${index + 1}`}><TextInput id={`payout-${prize.id}`} maxLength={80} value={prize.label} placeholder="1st place" onChange={event => changeDraft({ ...draft, prizes: draft.prizes.map(item => item.id === prize.id ? { ...item, label: event.target.value } : item) })} /></FormField></div><div className="w-28"><FormField htmlFor={`amount-${prize.id}`} label="Amount ($)"><TextInput id={`amount-${prize.id}`} type="number" min={0} max={1000000} step="0.01" value={prize.amount} onChange={event => changeDraft({ ...draft, prizes: draft.prizes.map(item => item.id === prize.id ? { ...item, amount: event.target.value } : item) })} /></FormField></div><Button aria-label={`Remove payout ${index + 1}`} onClick={() => changeDraft({ ...draft, prizes: draft.prizes.filter(item => item.id !== prize.id) })} variant="dangerGhost">Remove</Button></div>)}</div>
        </section>{moneySummary}
      </div>}
      {draft.step === 3 && <div className="space-y-6">
        <div><h2 className="text-xl font-bold text-app-text">Ready for {preview.target_season}?</h2><p className="mt-1 text-sm leading-6 text-app-text-muted">Review the lineup and budget. Creating this season makes it the current season. All earlier rosters, results, and payments are preserved.</p></div>
        <section><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-app-text">{members.length} players</h3><Button onClick={() => goToStep(0)} disabled={isStarting} size="sm" variant="ghost">Edit players</Button></div><p className="mb-3 text-xs text-app-text-muted">{returning} returning · {comeback} coming back · {draft.newMembers.length} new</p><ul className="divide-y divide-app-border rounded-xl border border-app-border px-3">{members.map((member, index) => <li key={member.source_member_id || `new-${index}`} className="py-3 text-sm"><span className="break-words font-semibold text-app-text">{member.manager_name}</span><span className="mt-0.5 block break-words text-app-text-muted">{member.team_name}{member.division ? ` · ${member.division}` : ''}</span></li>)}</ul>{sittingOut.length > 0 && <p className="mt-3 text-xs leading-5 text-app-text-muted">Sitting out: {sittingOut.map(member => member.manager_name).join(', ')}. They can return in a later season.</p>}</section>
        <section><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-app-text">Season format</h3><Button onClick={() => goToStep(1)} disabled={isStarting} size="sm" variant="ghost">Edit format</Button></div><p className="text-sm leading-6 text-app-text-muted">{draft.settings.totalWeeks} weeks · {draft.settings.playoffSpots} playoff teams · Playoffs start week {draft.settings.playoffStartWeek}</p><p className="text-sm text-app-text-muted">{draft.settings.groups.trim() ? `Divisions: ${draft.settings.groups}` : 'No divisions'}</p></section>
        <section><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-semibold text-app-text">Dues & payouts</h3><Button onClick={() => goToStep(2)} disabled={isStarting} size="sm" variant="ghost">Edit money</Button></div><p className="mb-3 text-sm leading-6 text-app-text-muted">{currency.format(numberValue(draft.settings.entryFee) || 0)} per player · {currency.format(numberValue(draft.settings.weeklyPrize) || 0)} weekly · {currency.format(numberValue(draft.settings.draftCost) || 0)} expenses</p>{draft.prizes.length > 0 && <ul className="mb-4 space-y-1 text-sm text-app-text-muted">{draft.prizes.map(prize => <li className="flex justify-between gap-3" key={prize.id}><span className="break-words">{prize.label}</span><span>{currency.format(numberValue(prize.amount) || 0)}</span></li>)}</ul>}{moneySummary}</section>
        {preview.espn_connection?.is_configured && <Notice tone="info">ESPN league {preview.espn_connection.league_id} and its securely stored connection carry forward. {preview.espn_connection.auto_sync_enabled ? 'Automatic weekly sync remains on.' : 'Automatic weekly sync remains off.'}</Notice>}
        <Notice tone="info">Next, you’ll land on Players & dues to track payments for your new roster.</Notice>
      </div>}
      {stepIssues.length > 0 && <Notice className="mt-5" tone="warning">{stepIssues.map(issue => <p key={issue}>{issue}</p>)}</Notice>}
      {error && <Notice className="mt-5" tone="danger">{error}</Notice>}
    </div>
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-5 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface p-3 shadow-lg md:bottom-4">
      <Button disabled={isStarting} onClick={() => draft.step === 0 ? onCancel() : goToStep(draft.step - 1)} variant="secondary">{draft.step === 0 ? storageAvailable ? 'Save & exit' : 'Exit setup' : 'Back'}</Button>
      {draft.step < 3 ? <Button disabled={Boolean(stepIssues.length)} onClick={() => goToStep(draft.step + 1)}>Continue to {steps[draft.step + 1].toLowerCase()}</Button> : <Button disabled={isStarting || issues.length > 0} onClick={() => void start()}>{isStarting ? 'Creating season…' : `Create ${preview.target_season} season`}</Button>}
    </div>
    <div className="mt-5 flex justify-center"><Button disabled={isStarting} onClick={() => setResetOpen(true)} size="sm" variant="ghost">Start over</Button></div>
    <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} title="Start this draft over?" description={`Your unsaved roster and settings will be replaced with the defaults from ${preview.source_season}. Existing seasons are unchanged.`} confirmLabel="Reset draft" onConfirm={() => { changeDraft(createSeasonSetupDraft(preview)); setRestored(false); setResetOpen(false) }} />
  </main>
}
