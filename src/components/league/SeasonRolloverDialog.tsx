'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Notice } from '@/components/ui/Notice'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { getConfiguredDivisions } from '@/lib/rules'

interface RolloverMember {
  division?: string | null
  id: string
  last_season: string
  manager_id?: string | null
  manager_name: string
  selected_by_default: boolean
  team_name: string
}

interface RolloverPreview {
  can_start: boolean
  members: RolloverMember[]
  source_configuration: {
    divisions?: unknown
    draft_food_cost?: number | null
    fee_amount?: number | null
    playoff_spots?: number | null
    playoff_start_week?: number | null
    prize_structure?: Record<string, unknown> | null
    total_weeks?: number | null
    weekly_prize_amount?: number | null
  }
  source_season: string
  target_exists: boolean
  target_season: string
}

interface MemberDraft {
  division: string
  managerName: string
  selected: boolean
  teamName: string
}

interface NewMemberDraft {
  division: string
  key: string
  managerName: string
  teamName: string
}

interface PrizeDraft {
  amount: string
  id: string
  label: string
  originalKey?: string
}

interface SettingsDraft {
  draftCost: string
  entryFee: string
  groups: string
  playoffSpots: string
  playoffStartWeek: string
  totalWeeks: string
  weeklyPrize: string
}

interface SeasonSetupFormProps {
  leagueId: string
  onCancel: () => void
  onStarted: (season: string) => Promise<void> | void
}

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  style: 'currency',
})

const prizeLabels: Record<string, string> = {
  first: '1st place',
  fourth: '4th place',
  highest_points: 'Highest season points',
  highest_weekly: 'Highest weekly score',
  lowest_weekly: 'Lowest weekly score',
  second: '2nd place',
  third: '3rd place',
}

const inputClass =
  'min-h-11 w-full rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-base text-app-text outline-none focus:border-app-brand focus:ring-2 focus:ring-app-brand/20 disabled:bg-app-surface-subtle disabled:text-app-text-muted sm:text-sm'

function prizeLabel(key: string) {
  return (
    prizeLabels[key] ||
    key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

function prizeKey(label: string) {
  return label
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}

function numberValue(value: string) {
  return value.trim() ? Number(value) : Number.NaN
}

export default function SeasonSetupForm({
  leagueId,
  onCancel,
  onStarted,
}: SeasonSetupFormProps) {
  const [preview, setPreview] = useState<RolloverPreview | null>(null)
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberDraft>>({})
  const [newMembers, setNewMembers] = useState<NewMemberDraft[]>([])
  const [prizes, setPrizes] = useState<PrizeDraft[]>([])
  const [settings, setSettings] = useState<SettingsDraft>({
    draftCost: '0',
    entryFee: '0',
    groups: '',
    playoffSpots: '6',
    playoffStartWeek: '15',
    totalWeeks: '17',
    weeklyPrize: '0',
  })
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const newMemberSequence = useRef(0)
  const prizeSequence = useRef(0)

  const groupNames = useMemo(
    () =>
      [...new Set(
        settings.groups
          .split(',')
          .map((group) => group.trim().replace(/\s+/g, ' '))
          .filter(Boolean),
      )],
    [settings.groups],
  )

  const selectedReturningMembers = useMemo(
    () =>
      preview?.members.filter((member) => memberDrafts[member.id]?.selected) || [],
    [memberDrafts, preview],
  )
  const configuredTeamCount = selectedReturningMembers.length + newMembers.length
  const playoffSpots = numberValue(settings.playoffSpots)
  const rosterIssue =
    configuredTeamCount < 2
      ? 'Choose at least two teams.'
      : configuredTeamCount % 2 !== 0
        ? 'Add or remove one team. Head-to-head seasons require an even number of teams.'
        : !Number.isInteger(playoffSpots) || playoffSpots < 2
          ? 'Configure at least two playoff teams.'
          : playoffSpots > configuredTeamCount
            ? 'Playoff teams cannot exceed the total number of teams.'
            : ''
  const allReturningSelected =
    Boolean(preview?.members.length) &&
    selectedReturningMembers.length === preview?.members.length

  const moneySummary = useMemo(() => {
    const entryFee = numberValue(settings.entryFee) || 0
    const draftCost = numberValue(settings.draftCost) || 0
    const weeklyPrize = numberValue(settings.weeklyPrize) || 0
    const totalWeeks = numberValue(settings.totalWeeks) || 0
    const finalPrizes = prizes.reduce(
      (total, prize) => total + (numberValue(prize.amount) || 0),
      0,
    )
    const expected = configuredTeamCount * entryFee
    const planned = draftCost + weeklyPrize * totalWeeks + finalPrizes

    return { balance: expected - planned, expected, planned }
  }, [configuredTeamCount, prizes, settings])

  useEffect(() => {
    let cancelled = false
    const loadPreview = async () => {
      setIsLoading(true)
      setError('')
      setPreview(null)
      setConfirmationOpen(false)
      setNewMembers([])

      try {
        const response = await fetch(
          `/api/leagues/${encodeURIComponent(leagueId)}/seasons/rollover`,
          { cache: 'no-store' },
        )
        const payload = (await response.json()) as {
          error?: string
          preview?: RolloverPreview
        }

        if (!response.ok || !payload.preview) {
          throw new Error(payload.error || 'The next season setup could not be loaded.')
        }
        if (cancelled) return

        const nextPreview = payload.preview
        const divisions = getConfiguredDivisions(
          nextPreview.source_configuration.divisions,
        )
        setPreview(nextPreview)
        setSettings({
          draftCost: String(nextPreview.source_configuration.draft_food_cost ?? 0),
          entryFee: String(nextPreview.source_configuration.fee_amount ?? 0),
          groups: divisions.join(', '),
          playoffSpots: String(nextPreview.source_configuration.playoff_spots ?? 6),
          playoffStartWeek: String(
            nextPreview.source_configuration.playoff_start_week ?? 15,
          ),
          totalWeeks: String(nextPreview.source_configuration.total_weeks ?? 17),
          weeklyPrize: String(
            nextPreview.source_configuration.weekly_prize_amount ?? 0,
          ),
        })
        setMemberDrafts(
          Object.fromEntries(
            nextPreview.members.map((member) => [
              member.id,
              {
                division:
                  member.division && divisions.includes(member.division)
                    ? member.division
                    : '',
                managerName: member.manager_name,
                selected: member.selected_by_default,
                teamName: member.team_name,
              },
            ]),
          ),
        )
        setPrizes(
          Object.entries(nextPreview.source_configuration.prize_structure || {})
            .filter(([, amount]) => Number.isFinite(Number(amount)))
            .map(([key, amount]) => ({
              amount: String(amount),
              id: `saved-${key}`,
              label: prizeLabel(key),
              originalKey: key,
            })),
        )
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'The next season setup could not be loaded.',
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [leagueId])

  const updateSetting = (key: keyof SettingsDraft, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const updateMember = (memberId: string, changes: Partial<MemberDraft>) => {
    setMemberDrafts((current) => ({
      ...current,
      [memberId]: { ...current[memberId], ...changes },
    }))
  }

  const addNewMember = () => {
    newMemberSequence.current += 1
    setNewMembers((current) => [
      ...current,
      {
        division: '',
        key: `new-member-${newMemberSequence.current}`,
        managerName: '',
        teamName: '',
      },
    ])
  }

  const addPrize = () => {
    prizeSequence.current += 1
    setPrizes((current) => [
      ...current,
      {
        amount: '0',
        id: `new-prize-${prizeSequence.current}`,
        label: '',
      },
    ])
  }

  const startSeason = async () => {
    if (!preview || !preview.can_start) return

    const prizeEntries = prizes.map((prize) => [
      prize.originalKey && prize.label.trim() === prizeLabel(prize.originalKey)
        ? prize.originalKey
        : prizeKey(prize.label),
      numberValue(prize.amount),
    ] as const)
    if (prizeEntries.some(([key]) => !key)) {
      setConfirmationOpen(false)
      setError('Every payout needs a name.')
      return
    }
    if (new Set(prizeEntries.map(([key]) => key)).size !== prizeEntries.length) {
      setConfirmationOpen(false)
      setError('Every payout needs a unique name.')
      return
    }

    const returningMembers = selectedReturningMembers.map((member) => {
      const draft = memberDrafts[member.id]
      return {
        division: groupNames.includes(draft.division) ? draft.division : null,
        manager_name: draft.managerName,
        source_member_id: member.id,
        team_name: draft.teamName,
      }
    })
    const addedMembers = newMembers.map((member) => ({
      division: groupNames.includes(member.division) ? member.division : null,
      manager_name: member.managerName,
      source_member_id: null,
      team_name: member.teamName,
    }))

    setIsStarting(true)
    setError('')

    try {
      const response = await fetch(
        `/api/leagues/${encodeURIComponent(leagueId)}/seasons/rollover`,
        {
          body: JSON.stringify({
            configuration: {
              divisions: groupNames,
              draft_food_cost: numberValue(settings.draftCost),
              fee_amount: numberValue(settings.entryFee),
              playoff_spots: numberValue(settings.playoffSpots),
              playoff_start_week: numberValue(settings.playoffStartWeek),
              prize_structure: Object.fromEntries(prizeEntries),
              total_weeks: numberValue(settings.totalWeeks),
              weekly_prize_amount: numberValue(settings.weeklyPrize),
            },
            confirmed: true,
            members: [...returningMembers, ...addedMembers],
            source_season: preview.source_season,
            target_season: preview.target_season,
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      )
      const payload = (await response.json()) as {
        error?: string
        target_season?: string
      }

      if (!response.ok || !payload.target_season) {
        throw new Error(payload.error || 'The new season could not be started.')
      }

      await onStarted(payload.target_season)
    } catch (startError) {
      setConfirmationOpen(false)
      setError(
        startError instanceof Error
          ? startError.message
          : 'The new season could not be started.',
      )
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-app-brand">Season setup</p>
            <h1 className="mt-1 text-2xl font-bold text-app-text sm:text-3xl">
              {preview ? `Set up the ${preview.target_season} season` : 'Set up the next season'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted">Last season provides editable starting values. Nothing is saved until the final review, and the historical season remains unchanged.</p>
          </div>
          <Button
            className="shrink-0 self-start"
            disabled={isStarting}
            onClick={onCancel}
            variant="secondary"
          >
            Back to league
          </Button>
        </div>

        <div className="mt-6 rounded-[var(--app-radius-lg)] border border-app-border bg-app-surface p-4 shadow-sm sm:p-6">
          {isLoading && (
            <SkeletonGroup className="space-y-3" label="Loading season setup">
              <Skeleton className="h-40" />
              <Skeleton className="h-64" />
            </SkeletonGroup>
          )}

          {preview && (
            <div className="space-y-6">
              <section>
                <div>
                  <h3 className="text-lg font-bold text-app-text">League format</h3>
                  <p className="mt-1 text-sm leading-6 text-app-text-muted">Set this season’s schedule, playoffs, and optional groups independently. The season uses its NFL start year, so January playoff weeks remain part of the prior year’s season.</p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-semibold text-app-text">Total weeks
                    <input className={`${inputClass} mt-1`} inputMode="numeric" max="25" min="1" onChange={(event) => updateSetting('totalWeeks', event.target.value)} type="number" value={settings.totalWeeks} />
                  </label>
                  <label className="text-sm font-semibold text-app-text">Playoffs start
                    <input className={`${inputClass} mt-1`} inputMode="numeric" max="25" min="1" onChange={(event) => updateSetting('playoffStartWeek', event.target.value)} type="number" value={settings.playoffStartWeek} />
                  </label>
                  <label className="text-sm font-semibold text-app-text">Playoff teams
                    <input className={`${inputClass} mt-1`} inputMode="numeric" max="64" min="2" onChange={(event) => updateSetting('playoffSpots', event.target.value)} type="number" value={settings.playoffSpots} />
                  </label>
                </div>
                <label className="mt-3 block text-sm font-semibold text-app-text">Groups or divisions <span className="font-normal text-app-text-muted">(optional)</span>
                  <input className={`${inputClass} mt-1`} onChange={(event) => updateSetting('groups', event.target.value)} placeholder="Example: East, West" type="text" value={settings.groups} />
                  <span className="mt-1 block text-xs font-normal text-app-text-muted">Separate group names with commas. Leave blank for one standings table.</span>
                </label>
              </section>

              <section className="border-t border-app-border pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-app-text">Players and teams</h3>
                    <p className="mt-1 text-sm leading-6 text-app-text-muted">{configuredTeamCount} teams configured. Last season’s players are selected by default; earlier league players remain available below. Manager and team names are editable for the new season, and dues begin as pending.</p>
                    {rosterIssue ? <p className="mt-1 text-sm font-semibold text-app-danger">{rosterIssue}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {preview.members.length > 0 && (
                      <Button onClick={() => setMemberDrafts((current) => Object.fromEntries(Object.entries(current).map(([id, draft]) => [id, { ...draft, selected: !allReturningSelected }]))) } size="sm" variant="secondary">
                        {allReturningSelected ? 'Clear all' : 'Select all'}
                      </Button>
                    )}
                    <Button onClick={addNewMember} size="sm" variant="secondary">Add new player</Button>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {preview.members.map((member, index) => {
                    const draft = memberDrafts[member.id]
                    if (!draft) return null
                    const selectedDivision = groupNames.includes(draft.division) ? draft.division : ''
                    const beginsEarlierPlayers =
                      !member.selected_by_default &&
                      (index === 0 || preview.members[index - 1]?.selected_by_default)

                    return (
                      <Fragment key={member.id}>
                        {index === 0 && member.selected_by_default ? (
                          <div className="pt-1">
                            <h4 className="text-sm font-bold text-app-text">Last season</h4>
                            <p className="mt-0.5 text-xs text-app-text-muted">Selected automatically from {preview.source_season}.</p>
                          </div>
                        ) : null}
                        {beginsEarlierPlayers ? (
                          <div className="border-t border-app-border pt-4">
                            <h4 className="text-sm font-bold text-app-text">Earlier league players</h4>
                            <p className="mt-0.5 text-xs text-app-text-muted">Available to bring back and unchecked by default.</p>
                          </div>
                        ) : null}
                        <div className="min-w-0 rounded-[var(--app-radius-md)] border border-app-border p-3">
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-app-text">
                            <input checked={draft.selected} className="h-5 w-5 shrink-0 accent-app-brand" onChange={(event) => updateMember(member.id, { selected: event.target.checked })} type="checkbox" />
                            <span className="min-w-0 truncate">{draft.managerName || member.manager_name}</span>
                            <span className="ml-auto shrink-0 text-xs font-semibold text-app-text-muted">{member.selected_by_default ? 'Last season' : `Last played ${member.last_season}`}</span>
                          </label>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <label className="text-xs font-semibold text-app-text-muted">Manager name
                              <input className={`${inputClass} mt-1`} disabled={!draft.selected} maxLength={80} onChange={(event) => updateMember(member.id, { managerName: event.target.value })} type="text" value={draft.managerName} />
                            </label>
                            <label className="text-xs font-semibold text-app-text-muted">Team name
                              <input className={`${inputClass} mt-1`} disabled={!draft.selected} maxLength={80} onChange={(event) => updateMember(member.id, { teamName: event.target.value })} type="text" value={draft.teamName} />
                            </label>
                            <label className="text-xs font-semibold text-app-text-muted">Group
                              <select className={`${inputClass} mt-1`} disabled={!draft.selected || groupNames.length === 0} onChange={(event) => updateMember(member.id, { division: event.target.value })} value={selectedDivision}>
                                <option value="">No group</option>
                                {groupNames.map((group) => <option key={group} value={group}>{group}</option>)}
                              </select>
                            </label>
                          </div>
                        </div>
                      </Fragment>
                    )
                  })}

                  {newMembers.map((member, index) => (
                    <div className="min-w-0 rounded-[var(--app-radius-md)] border border-app-brand/30 bg-app-brand-soft p-3" key={member.key}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-app-text">New player {index + 1}</p>
                        <button className="min-h-10 rounded-[var(--app-radius-sm)] px-3 text-xs font-bold text-app-danger hover:bg-app-danger-soft" onClick={() => setNewMembers((current) => current.filter((item) => item.key !== member.key))} type="button">Remove</button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <label className="text-xs font-semibold text-app-text-muted">Manager name
                          <input className={`${inputClass} mt-1`} maxLength={80} onChange={(event) => setNewMembers((current) => current.map((item) => item.key === member.key ? { ...item, managerName: event.target.value } : item))} type="text" value={member.managerName} />
                        </label>
                        <label className="text-xs font-semibold text-app-text-muted">Team name
                          <input className={`${inputClass} mt-1`} maxLength={80} onChange={(event) => setNewMembers((current) => current.map((item) => item.key === member.key ? { ...item, teamName: event.target.value } : item))} type="text" value={member.teamName} />
                        </label>
                        <label className="text-xs font-semibold text-app-text-muted">Group
                          <select className={`${inputClass} mt-1`} disabled={groupNames.length === 0} onChange={(event) => setNewMembers((current) => current.map((item) => item.key === member.key ? { ...item, division: event.target.value } : item))} value={groupNames.includes(member.division) ? member.division : ''}>
                            <option value="">No group</option>
                            {groupNames.map((group) => <option key={group} value={group}>{group}</option>)}
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-t border-app-border pt-5">
                <div>
                  <h3 className="text-lg font-bold text-app-text">Money plan</h3>
                  <p className="mt-1 text-sm leading-6 text-app-text-muted">Every amount is editable for {preview.target_season}; none of these changes affect {preview.source_season}.</p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-semibold text-app-text">Buy-in per player
                    <input className={`${inputClass} mt-1`} min="0" onChange={(event) => updateSetting('entryFee', event.target.value)} step="0.01" type="number" value={settings.entryFee} />
                  </label>
                  <label className="text-sm font-semibold text-app-text">Draft food and costs
                    <input className={`${inputClass} mt-1`} min="0" onChange={(event) => updateSetting('draftCost', event.target.value)} step="0.01" type="number" value={settings.draftCost} />
                  </label>
                  <label className="text-sm font-semibold text-app-text">Weekly prize
                    <input className={`${inputClass} mt-1`} min="0" onChange={(event) => updateSetting('weeklyPrize', event.target.value)} step="0.01" type="number" value={settings.weeklyPrize} />
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <h4 className="font-bold text-app-text">Final and special payouts</h4>
                  <Button onClick={addPrize} size="sm" variant="secondary">Add payout</Button>
                </div>
                {prizes.length === 0 ? (
                  <p className="mt-2 rounded-[var(--app-radius-sm)] border border-dashed border-app-border p-3 text-sm text-app-text-muted">No final or special payouts configured.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {prizes.map((prize) => (
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]" key={prize.id}>
                        <label className="sr-only" htmlFor={`${prize.id}-name`}>Payout name</label>
                        <input className={inputClass} id={`${prize.id}-name`} maxLength={64} onChange={(event) => setPrizes((current) => current.map((item) => item.id === prize.id ? { ...item, label: event.target.value } : item))} placeholder="Payout name" type="text" value={prize.label} />
                        <label className="sr-only" htmlFor={`${prize.id}-amount`}>Payout amount</label>
                        <input className={`${inputClass} col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1`} id={`${prize.id}-amount`} min="0" onChange={(event) => setPrizes((current) => current.map((item) => item.id === prize.id ? { ...item, amount: event.target.value } : item))} step="0.01" type="number" value={prize.amount} />
                        <button aria-label={`Remove ${prize.label || 'payout'}`} className="col-start-2 row-start-1 min-h-11 min-w-11 rounded-[var(--app-radius-sm)] text-app-danger hover:bg-app-danger-soft sm:col-start-3" onClick={() => setPrizes((current) => current.filter((item) => item.id !== prize.id))} type="button">×</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className={`mt-4 rounded-[var(--app-radius-md)] border p-4 ${moneySummary.balance === 0 ? 'border-app-success/30 bg-app-success-soft' : 'border-app-warning/40 bg-app-warning-soft'}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold text-app-text">New-season check</p>
                    <p className="text-sm font-bold text-app-text">{configuredTeamCount} teams</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-app-text-muted">{currency.format(moneySummary.expected)} expected − {currency.format(moneySummary.planned)} planned = <span className="font-bold text-app-text">{currency.format(moneySummary.balance)} remaining</span></p>
                </div>
              </section>

              <section className="rounded-[var(--app-radius-md)] border border-app-warning/40 bg-app-warning-soft p-4">
                <h3 className="font-bold text-app-text">Fresh for {preview.target_season}</h3>
                <p className="mt-1 text-sm leading-6 text-app-text-muted">Scores, matchups, winners, paid status, and ESPN team mappings are not copied. Automatic sync stays off until the new connection and mappings are tested.</p>
              </section>

              {preview.target_exists ? (
                <Notice tone="danger">{preview.target_season} is already configured. No changes can be made here.</Notice>
              ) : null}
            </div>
          )}

          {error && <Notice className="mt-4" tone="danger">{error}</Notice>}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 rounded-[var(--app-radius-md)] border border-app-border bg-app-surface p-3 shadow-[var(--app-shadow-sm)] sm:sticky sm:bottom-4 sm:z-20 sm:flex-row sm:items-center sm:justify-between sm:bg-app-surface/95 sm:shadow-[var(--app-shadow-md)] sm:backdrop-blur">
          <p className="px-1 text-sm text-app-text-muted">
            {configuredTeamCount} teams · {currency.format(moneySummary.balance)} remaining
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button disabled={isStarting} onClick={onCancel} variant="secondary">Cancel</Button>
            <Button disabled={!preview?.can_start || Boolean(rosterIssue) || isLoading || isStarting} onClick={() => setConfirmationOpen(true)}>
              {preview ? `Review and start ${preview.target_season}` : 'Review season'}
            </Button>
          </div>
        </div>
      </main>

      <ConfirmDialog
        busy={isStarting}
        confirmLabel={preview ? `Start ${preview.target_season}` : 'Start season'}
        confirmVariant="primary"
        description={
          preview
            ? `Create the ${preview.target_season} season with ${configuredTeamCount} teams and make it active. The ${preview.source_season} season remains unchanged as history, and ESPN automation stays off.`
            : 'Create this season and make it active.'
        }
        onClose={() => setConfirmationOpen(false)}
        onConfirm={() => void startSeason()}
        open={confirmationOpen}
        title={preview ? `Start the ${preview.target_season} season?` : 'Start this season?'}
        tone="warning"
      />
    </>
  )
}
