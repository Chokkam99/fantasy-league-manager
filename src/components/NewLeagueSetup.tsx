'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { normalizeESPNLeagueId } from '@/lib/automationSettings'
import type { ESPNOnboardingSnapshot } from '@/lib/espn/onboarding'
import { leagueSlug } from '@/lib/newLeagueSetup'

interface MemberDraft {
  division: string
  espnTeamId: number | null
  key: string
  managerName: string
  teamName: string
}

interface PrizeDraft {
  amount: string
  key: string
  label: string
}

const inputClass =
  'mt-1 min-h-11 min-w-0 w-full rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-base text-app-text outline-none focus:border-app-brand focus:ring-2 focus:ring-app-brand/20 sm:text-sm'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  style: 'currency',
})

function suggestedSeason() {
  const today = new Date()
  return String(today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear())
}

function amount(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function payoutKey(value: string) {
  return leagueSlug(value).replaceAll('-', '_')
}

export default function NewLeagueSetup() {
  const router = useRouter()
  const memberSequence = useRef(0)
  const payoutSequence = useRef(0)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [season, setSeason] = useState(suggestedSeason)
  const [totalWeeks, setTotalWeeks] = useState('17')
  const [playoffStartWeek, setPlayoffStartWeek] = useState('15')
  const [playoffSpots, setPlayoffSpots] = useState('6')
  const [groups, setGroups] = useState('')
  const [entryFee, setEntryFee] = useState('0')
  const [draftCost, setDraftCost] = useState('0')
  const [weeklyPrize, setWeeklyPrize] = useState('0')
  const [prizes, setPrizes] = useState<PrizeDraft[]>([
    { amount: '0', key: 'first', label: '1st place' },
    { amount: '0', key: 'second', label: '2nd place' },
    { amount: '0', key: 'third', label: '3rd place' },
  ])
  const [members, setMembers] = useState<MemberDraft[]>([])
  const [espnLeagueId, setEspnLeagueId] = useState('')
  const [privateLeague, setPrivateLeague] = useState(false)
  const [espnS2, setEspnS2] = useState('')
  const [swid, setSwid] = useState('')
  const [espnSnapshot, setEspnSnapshot] = useState<ESPNOnboardingSnapshot | null>(null)
  const [cronConfigured, setCronConfigured] = useState(false)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [espnError, setEspnError] = useState('')
  const [espnNotice, setEspnNotice] = useState('')
  const normalizedEspnLeagueId = normalizeESPNLeagueId(espnLeagueId)
  const canPullESPN = Boolean(
    normalizedEspnLeagueId &&
    /^\d{4}$/.test(season) &&
    (!privateLeague || (espnS2.trim() && swid.trim())),
  )

  const groupNames = useMemo(
    () => [...new Set(groups.split(',').map((group) => group.trim().replace(/\s+/g, ' ')).filter(Boolean))],
    [groups],
  )
  const expected = members.length * amount(entryFee)
  const planned = amount(draftCost) + amount(weeklyPrize) * amount(totalWeeks) +
    prizes.reduce((total, prize) => total + amount(prize.amount), 0)
  const balance = expected - planned
  const slugIssue = !slug.trim()
    ? 'Enter a league link.'
    : slug === 'new'
      ? 'Choose a different league link.'
      : ''

  const rosterIssue = useMemo(() => {
    if (members.length < 2) return 'Add at least two teams.'
    if (members.length % 2 !== 0) return 'Head-to-head seasons require an even number of teams.'
    if (members.some((member) => !member.managerName.trim() || !member.teamName.trim())) {
      return 'Every team needs a manager name and team name.'
    }
    const managerNames = members.map((member) => member.managerName.trim().toLocaleLowerCase())
    if (new Set(managerNames).size !== managerNames.length) return 'Each manager can only appear once.'
    const teamNames = members.map((member) => member.teamName.trim().toLocaleLowerCase())
    if (new Set(teamNames).size !== teamNames.length) return 'Each team name must be unique.'
    const playoffCount = Number(playoffSpots)
    if (!Number.isInteger(playoffCount) || playoffCount < 2 || playoffCount > members.length) {
      return 'Playoff teams must be between 2 and the roster size.'
    }
    return ''
  }, [members, playoffSpots])

  const updateName = (value: string) => {
    setName(value)
    if (!slugEdited) setSlug(leagueSlug(value))
  }

  const invalidateESPNPreview = () => {
    setEspnSnapshot(null)
    setAutoSyncEnabled(false)
    setEspnError('')
    setEspnNotice('')
  }

  const pullESPNTeams = async () => {
    setIsPulling(true)
    setError('')
    setEspnError('')
    setEspnNotice('')
    try {
      const response = await fetch('/api/leagues/espn-preview', {
        body: JSON.stringify({
          espn_s2: privateLeague ? espnS2 : undefined,
          league_id: normalizedEspnLeagueId,
          private_league: privateLeague,
          season,
          swid: privateLeague ? swid : undefined,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const payload = await response.json().catch(() => null) as {
        cron_configured?: boolean
        error?: string
        snapshot?: ESPNOnboardingSnapshot
      } | null
      if (!response.ok || !payload?.snapshot) {
        throw new Error(payload?.error || 'The ESPN teams could not be loaded.')
      }

      setEspnSnapshot(payload.snapshot)
      setCronConfigured(Boolean(payload.cron_configured))
      setMembers(payload.snapshot.teams.map((team) => ({
        division: '',
        espnTeamId: team.team_id,
        key: `espn-${team.team_id}`,
        managerName: team.manager_name,
        teamName: team.team_name,
      })))
      if (!name.trim()) updateName(payload.snapshot.league_name)
      setEspnNotice(
        `${payload.snapshot.teams.length} current ${season} teams loaded from ESPN. Review every manager and team name before creating the league.`,
      )
    } catch (loadError) {
      setEspnError(loadError instanceof Error ? loadError.message : 'The ESPN teams could not be loaded.')
    } finally {
      setIsPulling(false)
    }
  }

  const addMember = () => {
    memberSequence.current += 1
    setMembers((current) => [...current, {
      division: '',
      espnTeamId: null,
      key: `manual-${memberSequence.current}`,
      managerName: '',
      teamName: '',
    }])
  }

  const updateMember = (key: string, changes: Partial<MemberDraft>) => {
    setMembers((current) => current.map((member) => member.key === key ? { ...member, ...changes } : member))
  }

  const createLeague = async () => {
    setError('')
    if (rosterIssue) {
      setError(rosterIssue)
      return
    }
    if (!name.trim() || !slug.trim()) {
      setError('Enter a league name and league link.')
      return
    }
    if (espnSnapshot && members.some((member) => member.espnTeamId === null)) {
      setError('An ESPN-connected setup must contain exactly the teams pulled from ESPN.')
      return
    }

    const payoutEntries = prizes.map((prize) => [payoutKey(prize.label), amount(prize.amount)] as const)
    if (payoutEntries.some(([key]) => !key) || new Set(payoutEntries.map(([key]) => key)).size !== payoutEntries.length) {
      setError('Every final payout needs a unique name.')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/leagues', {
        body: JSON.stringify({
          configuration: {
            divisions: groupNames,
            draft_food_cost: amount(draftCost),
            fee_amount: amount(entryFee),
            playoff_spots: Number(playoffSpots),
            playoff_start_week: Number(playoffStartWeek),
            prize_structure: Object.fromEntries(payoutEntries),
            total_weeks: Number(totalWeeks),
            weekly_prize_amount: amount(weeklyPrize),
          },
          espn_connection: espnSnapshot ? {
            auto_sync_enabled: autoSyncEnabled,
            espn_s2: privateLeague ? espnS2 : undefined,
            league_id: normalizedEspnLeagueId,
            private_league: privateLeague,
            swid: privateLeague ? swid : undefined,
          } : null,
          id: slug,
          members: members.map((member) => ({
            division: groupNames.includes(member.division) ? member.division : null,
            espn_team_id: member.espnTeamId,
            manager_name: member.managerName,
            team_name: member.teamName,
          })),
          name,
          season,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const payload = await response.json().catch(() => null) as {
        error?: string
        league?: { id: string }
      } | null
      if (!response.ok || !payload?.league) {
        throw new Error(payload?.error || 'The league could not be created.')
      }
      router.push(`/league/${encodeURIComponent(payload.league.id)}?season=${season}`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The league could not be created.')
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-app-brand">New league</p>
          <h1 className="mt-1 text-2xl font-bold text-app-text sm:text-3xl">Set up the league office</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted">Create the league and its first tracked season together. The league link remains the same as you add future seasons.</p>
        </div>
        <Button className="self-start" disabled={isSaving} onClick={() => router.push('/')} variant="secondary">Cancel</Button>
      </div>

      {error && <Notice className="mt-5" tone="danger">{error}</Notice>}

      <div className="mt-6 space-y-5">
        <Card className="p-4 sm:p-6">
          <h2 className="text-lg font-bold text-app-text">League basics</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <label className="text-sm font-semibold text-app-text">League name
              <input className={inputClass} maxLength={100} onChange={(event) => updateName(event.target.value)} placeholder="Example: Sunday Legends" value={name} />
            </label>
            <label className="text-sm font-semibold text-app-text" title="Use the NFL season start year. You can add the next season separately.">First tracked season
              <input aria-describedby="first-season-description" className={inputClass} inputMode="numeric" maxLength={4} onChange={(event) => { setSeason(event.target.value); invalidateESPNPreview() }} value={season} />
              <span className="sr-only" id="first-season-description">Use the NFL season start year. You can begin with a past season and add the next season separately.</span>
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-app-text" htmlFor="new-league-slug">League link</label>
            <div className="mt-1 flex min-h-11 items-center rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface focus-within:border-app-brand focus-within:ring-2 focus-within:ring-app-brand/20">
              <span className="shrink-0 pl-3 text-sm text-app-text-muted">/league/</span>
              <input className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-app-text outline-none sm:text-sm" id="new-league-slug" maxLength={64} onChange={(event) => { setSlugEdited(true); setSlug(leagueSlug(event.target.value)) }} placeholder="sunday-legends" value={slug} />
            </div>
          <span className="mt-1 block text-xs font-normal text-app-text-muted">This readable link represents the whole league across seasons.</span>
          {slugIssue && slug.trim() && <span className="mt-1 block text-xs font-semibold text-app-danger">{slugIssue}</span>}
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-app-text">Current ESPN roster <span className="font-normal text-app-text-muted">(optional)</span></h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-app-text-muted">Pull owners and teams for {season || 'this season'} before the draft or afterward. ESPN does not provide this app with reliable prior-season rosters or scores.</p>
              </div>
              {espnSnapshot && <Badge variant="success">{espnSnapshot.teams.length} teams loaded</Badge>}
            </div>
            <label className="mt-4 block text-sm font-semibold text-app-text" htmlFor="new-espn-league">ESPN league URL or ID</label>
            <div className="mt-1 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <input autoComplete="off" className={`${inputClass} !mt-0`} id="new-espn-league" onChange={(event) => { setEspnLeagueId(event.target.value); invalidateESPNPreview() }} placeholder="Paste the ESPN league URL" value={espnLeagueId} />
              <Button disabled={isPulling || !canPullESPN} onClick={() => void pullESPNTeams()}>
                {isPulling ? 'Loading teams…' : espnSnapshot ? 'Refresh teams' : 'Pull current teams'}
              </Button>
            </div>
            {normalizedEspnLeagueId && espnLeagueId.trim() !== normalizedEspnLeagueId && (
              <span className="mt-1 block text-xs font-normal text-app-text-muted">League ID {normalizedEspnLeagueId} detected</span>
            )}
            {espnError && (
              <Notice className="mt-3" tone="danger">
                <span className="block font-semibold">ESPN could not verify access to this league.</span>
                <span className="mt-1 block">{espnError} Sign out of ESPN and sign back in, then copy the current Value cells for espn_s2 and SWID and try again.</span>
              </Notice>
            )}
            {espnNotice && <Notice className="mt-3" tone="success">{espnNotice}</Notice>}
            <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-app-text">
              <input checked={privateLeague} className="h-5 w-5 accent-app-brand" onChange={(event) => { setPrivateLeague(event.target.checked); invalidateESPNPreview() }} type="checkbox" />
              <span><span className="font-semibold">Private ESPN league</span> <span className="text-app-text-muted">requires ESPN cookies</span></span>
            </label>
            {privateLeague && (
              <div className="mt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-app-text">espn_s2 cookie
                  <input autoComplete="new-password" className={inputClass} onChange={(event) => { setEspnS2(event.target.value); invalidateESPNPreview() }} spellCheck={false} type="password" value={espnS2} />
                </label>
                <label className="text-sm font-semibold text-app-text">SWID cookie
                  <input autoComplete="new-password" className={inputClass} onChange={(event) => { setSwid(event.target.value); invalidateESPNPreview() }} spellCheck={false} type="password" value={swid} />
                </label>
                </div>
                <details className="mt-3 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface-subtle px-3 py-2 text-sm">
                  <summary className="min-h-10 cursor-pointer content-center font-semibold text-app-brand">Where to find these cookies</summary>
                  <div className="pb-2 leading-6 text-app-text-muted">
                    <ol className="ml-5 list-decimal space-y-1">
                      <li>Sign in to ESPN Fantasy in your usual browser and open this league.</li>
                      <li>Open Developer Tools, then choose Application in Chrome or Edge, or Storage in Safari or Firefox.</li>
                      <li>Under Cookies, select fantasy.espn.com or espn.com.</li>
                      <li>Copy the complete Value for <code className="font-semibold text-app-text">espn_s2</code> and <code className="font-semibold text-app-text">SWID</code>. Keep the braces around SWID.</li>
                    </ol>
                    <p className="mt-2 font-medium text-app-text">Treat both values like passwords. Paste them only here and never share them in chat, screenshots, or source control.</p>
                  </div>
                </details>
                {(!espnS2.trim() || !swid.trim()) && (
                  <p className="mt-2 text-xs font-medium text-app-text-muted">Enter both cookie values to enable the private roster preview.</p>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="text-lg font-bold text-app-text">Season format</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold text-app-text">Total weeks
              <input className={inputClass} max={25} min={1} onChange={(event) => setTotalWeeks(event.target.value)} type="number" value={totalWeeks} />
            </label>
            <label className="text-sm font-semibold text-app-text">Playoffs start
              <input className={inputClass} max={25} min={1} onChange={(event) => setPlayoffStartWeek(event.target.value)} type="number" value={playoffStartWeek} />
            </label>
            <label className="text-sm font-semibold text-app-text">Playoff teams
              <input className={inputClass} max={64} min={2} onChange={(event) => setPlayoffSpots(event.target.value)} type="number" value={playoffSpots} />
            </label>
          </div>
          <label className="mt-3 block text-sm font-semibold text-app-text">Groups or divisions <span className="font-normal text-app-text-muted">(optional)</span>
            <input className={inputClass} onChange={(event) => setGroups(event.target.value)} placeholder="Example: East, West" value={groups} />
            <span className="mt-1 block text-xs font-normal text-app-text-muted">Separate names with commas, then assign each team below.</span>
          </label>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-app-text">Players and teams</h2>
              <p className="mt-1 text-sm text-app-text-muted">Review ESPN results or build the current roster manually. Team names are saved only for this season.</p>
            </div>
            <Button onClick={addMember} size="sm" variant="secondary">Add player</Button>
          </div>
          {rosterIssue && members.length > 0 && <p className="mt-3 text-sm font-semibold text-app-danger">{rosterIssue}</p>}
          {members.length === 0 ? (
            <div className="mt-4 rounded-[var(--app-radius-md)] border border-dashed border-app-border p-6 text-center text-sm text-app-text-muted">Pull the current ESPN teams or add players manually.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {members.map((member, index) => (
                <div className="rounded-[var(--app-radius-md)] border border-app-border p-3" key={member.key}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-app-text">Team {index + 1}</p>
                    <button aria-label={`Remove team ${index + 1}`} className="min-h-10 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold text-app-danger hover:bg-app-danger-soft" onClick={() => setMembers((current) => current.filter((item) => item.key !== member.key))} type="button">Remove</button>
                  </div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-app-text-muted">Manager name
                      <input className={inputClass} maxLength={80} onChange={(event) => updateMember(member.key, { managerName: event.target.value })} value={member.managerName} />
                    </label>
                    <label className="text-xs font-semibold text-app-text-muted">Team name
                      <input className={inputClass} maxLength={80} onChange={(event) => updateMember(member.key, { teamName: event.target.value })} value={member.teamName} />
                    </label>
                    <label className="text-xs font-semibold text-app-text-muted">Group
                      <span className="relative mt-1 block">
                        <select className={`${inputClass} !mt-0 appearance-none pr-10`} disabled={groupNames.length === 0} onChange={(event) => updateMember(member.key, { division: event.target.value })} value={groupNames.includes(member.division) ? member.division : ''}>
                          <option value="">No group</option>
                          {groupNames.map((group) => <option key={group} value={group}>{group}</option>)}
                        </select>
                        <svg aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-text-muted" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="m7 10 5 5 5-5" />
                        </svg>
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-app-text">Money plan</h2>
            <p className="mt-1 text-sm text-app-text-muted">Confirm that expected fees cover draft costs, weekly prizes, and final payouts.</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold text-app-text">Buy-in per player
              <input className={inputClass} min={0} onChange={(event) => setEntryFee(event.target.value)} step="0.01" type="number" value={entryFee} />
            </label>
            <label className="text-sm font-semibold text-app-text">Draft food and costs
              <input className={inputClass} min={0} onChange={(event) => setDraftCost(event.target.value)} step="0.01" type="number" value={draftCost} />
            </label>
            <label className="text-sm font-semibold text-app-text">Weekly prize
              <input className={inputClass} min={0} onChange={(event) => setWeeklyPrize(event.target.value)} step="0.01" type="number" value={weeklyPrize} />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-app-text">Final and special payouts</h3>
            <Button onClick={() => {
              payoutSequence.current += 1
              setPrizes((current) => [...current, { amount: '0', key: `payout-${payoutSequence.current}`, label: '' }])
            }} size="sm" variant="secondary">Add payout</Button>
          </div>
          <div className="mt-2 space-y-2">
            {prizes.map((prize) => (
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]" key={prize.key}>
                <input aria-label="Payout name" className={inputClass} maxLength={64} onChange={(event) => setPrizes((current) => current.map((item) => item.key === prize.key ? { ...item, label: event.target.value } : item))} placeholder="Payout name" value={prize.label} />
                <input aria-label={`${prize.label || 'Payout'} amount`} className={`${inputClass} col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1`} min={0} onChange={(event) => setPrizes((current) => current.map((item) => item.key === prize.key ? { ...item, amount: event.target.value } : item))} step="0.01" type="number" value={prize.amount} />
                <button aria-label={`Remove ${prize.label || 'payout'}`} className="col-start-2 row-start-1 mt-1 min-h-11 min-w-11 rounded-[var(--app-radius-sm)] text-app-danger hover:bg-app-danger-soft sm:col-start-3" onClick={() => setPrizes((current) => current.filter((item) => item.key !== prize.key))} type="button">×</button>
              </div>
            ))}
          </div>
          <div className={`mt-4 rounded-[var(--app-radius-md)] border p-4 ${balance === 0 ? 'border-app-success/30 bg-app-success-soft' : 'border-app-warning/40 bg-app-warning-soft'}`}>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p><span className="block text-xs text-app-text-muted">Expected fees</span><span className="font-bold text-app-text">{currency.format(expected)}</span></p>
              <p><span className="block text-xs text-app-text-muted">Planned out</span><span className="font-bold text-app-text">{currency.format(planned)}</span></p>
              <p><span className="block text-xs text-app-text-muted">Remaining</span><span className="font-bold text-app-text">{currency.format(balance)}</span></p>
            </div>
          </div>
        </Card>

        {espnSnapshot && (
          <Card className="p-4 sm:p-6">
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input checked={autoSyncEnabled} className="mt-1 h-5 w-5 accent-app-brand" disabled={!cronConfigured} onChange={(event) => setAutoSyncEnabled(event.target.checked)} type="checkbox" />
              <span>
                <span className="block font-bold text-app-text">Import completed scores automatically</span>
                <span className="mt-1 block leading-5 text-app-text-muted">Runs Wednesday at 2:00 AM Phoenix and rechecks one prior week. You can still sync on demand.</span>
                {!cronConfigured && <span className="mt-1 block text-app-warning">The deployment cron secret is not configured, so automatic sync cannot be enabled.</span>}
              </span>
            </label>
          </Card>
        )}
      </div>

      <div className="sticky bottom-0 z-20 mt-5 border-t border-app-border bg-app-canvas/95 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-app-text-muted">{members.length} teams, {currency.format(balance)} remaining</p>
          <div className="flex gap-2">
            <Button className="flex-1 sm:flex-none" disabled={isSaving} onClick={() => router.push('/')} variant="secondary">Cancel</Button>
            <Button className="flex-1 sm:flex-none" disabled={isSaving || Boolean(rosterIssue) || Boolean(slugIssue) || !name.trim()} onClick={() => void createLeague()}>
              {isSaving ? 'Creating league…' : 'Create league'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
