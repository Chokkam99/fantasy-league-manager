'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'
import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'
import { validateSeasonMoney, type SeasonMoneySettings as MoneySettings } from '@/lib/seasonMoney'

interface Snapshot { settings: MoneySettings; revision: string; total_weeks: number; player_count: number; archived: boolean }
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fieldLabels = { fee_amount: 'Entry fee per player', draft_food_cost: 'Draft food and costs', weekly_prize_amount: 'Weekly prize' } as const
const prizeLabels: Record<string, string> = { first: '1st place', second: '2nd place', third: '3rd place', fourth: '4th place' }
const title = (key: string) => Object.hasOwn(prizeLabels, key) ? prizeLabels[key] : key.replaceAll('_', ' ')

export function SeasonMoneySettings({ leagueId, season }: { leagueId: string; season: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [settings, setSettings] = useState<MoneySettings | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [prizeName, setPrizeName] = useState('')
  const [reload, setReload] = useState(0)
  const submitting = useRef(false)
  const endpoint = `/api/leagues/${encodeURIComponent(leagueId)}/seasons/money`

  useEffect(() => {
    let active = true
    setBusy(true)
    void fetch(`${endpoint}?season=${season}`, { cache: 'no-store' }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Money settings could not be loaded.')
      if (active) { setSnapshot(data); setSettings(data.settings); setError('') }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Money settings could not be loaded.') })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [endpoint, season, reload])

  const save = async () => {
    if (!snapshot || !settings || !validateSeasonMoney(settings) || submitting.current) return
    submitting.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ season, revision: snapshot.revision, settings }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Money settings could not be saved.')
      invalidateFinanceCache(leagueId); invalidateLeagueReadCache(leagueId)
      setNotice(`${season} money settings saved. Recorded payments and private notes were preserved.`)
      setReload(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Money settings could not be saved.') }
    finally { submitting.current = false; setBusy(false) }
  }

  const expected = (settings?.fee_amount || 0) * (snapshot?.player_count || 0)
  const planned = settings ? settings.draft_food_cost + settings.weekly_prize_amount * (snapshot?.total_weeks || 0) + Object.values(settings.prize_structure).reduce((sum, value) => sum + value, 0) : 0
  const balance = expected - planned
  const valid = settings && validateSeasonMoney(settings)
  return <Card id="season-money" className="mt-6 scroll-mt-24 p-4 sm:p-6">
    <p className="section-kicker">{season} season</p>
    <h2 className="mt-2 text-xl font-bold text-app-text">Entry fee and prize budget</h2>
    <p className="mt-2 text-sm leading-6 text-app-text-muted">Update this season’s entry fee, expenses, and prizes here. ESPN does not manage these amounts.</p>
    {notice && <Notice className="mt-4" tone="success">{notice}</Notice>}
    {error && <Notice className="mt-4" tone="danger">{error}<Button className="mt-3" variant="secondary" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload money settings</Button></Notice>}
    {!settings || !snapshot ? <p className="mt-4 text-sm text-app-text-muted" role="status">{busy ? 'Loading money settings…' : 'Money settings are unavailable.'}</p> : <form className="mt-5" onSubmit={event => { event.preventDefault(); void save() }}>
      {snapshot.archived && <Notice className="mb-4" tone="warning">Restore this league or season below before editing its money settings.</Notice>}
      <fieldset disabled={busy || snapshot.archived} className="min-w-0 space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">{(Object.keys(fieldLabels) as Array<keyof typeof fieldLabels>).map(field => <FormField key={field} htmlFor={`money-${field}`} label={fieldLabels[field]}><TextInput id={`money-${field}`} type="number" inputMode="decimal" min={0} max={1000000} step="0.01" required value={Number.isNaN(settings[field]) ? '' : settings[field]} onChange={event => setSettings({ ...settings, [field]: event.target.value === '' ? NaN : Number(event.target.value) })} /></FormField>)}</div>
        <div><h3 className="font-semibold text-app-text">Final and special prizes</h3><div className="mt-3 space-y-3">{Object.entries(settings.prize_structure).map(([key, amount]) => <div className="flex items-end gap-2" key={key}><FormField className="min-w-0 flex-1" htmlFor={`prize-${key}`} label={title(key)}><TextInput id={`prize-${key}`} type="number" min={0} max={1000000} step="0.01" required value={Number.isNaN(amount) ? '' : amount} onChange={event => setSettings({ ...settings, prize_structure: { ...settings.prize_structure, [key]: event.target.value === '' ? NaN : Number(event.target.value) } })} /></FormField><Button variant="secondary" aria-label={`Remove ${title(key)} prize`} onClick={() => setSettings({ ...settings, prize_structure: Object.fromEntries(Object.entries(settings.prize_structure).filter(([name]) => name !== key)) })}>Remove</Button></div>)}</div>
          <div className="mt-4 flex items-end gap-2"><FormField className="min-w-0 flex-1" htmlFor="money-new-prize" label="Add a prize"><TextInput id="money-new-prize" placeholder="For example, Highest points" maxLength={64} value={prizeName} onChange={event => setPrizeName(event.target.value)} /></FormField><Button variant="secondary" disabled={!prizeName.trim() || Object.keys(settings.prize_structure).length >= 32} onClick={() => { const key = prizeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); if (!key || Object.hasOwn(settings.prize_structure, key)) { setError('Choose a unique prize name.'); return }; setSettings({ ...settings, prize_structure: { ...settings.prize_structure, [key]: 0 } }); setPrizeName('') }}>Add</Button></div>
        </div>
        {valid && <Notice tone={balance < -0.005 ? 'danger' : balance > 0.005 ? 'warning' : 'success'}><p>{snapshot.player_count} players × {money.format(settings.fee_amount)} = {money.format(expected)} expected. {money.format(planned)} planned.</p><p className="mt-1">{balance < -0.005 ? `${money.format(-balance)} over budget. You can save, then adjust the fee or prize amounts.` : balance > 0.005 ? `${money.format(balance)} remains unallocated.` : 'The plan balances.'}</p></Notice>}
        {!valid && <Notice tone="warning">Enter amounts from $0 to $1,000,000 with no more than two decimal places.</Notice>}
        <p className="text-sm leading-6 text-app-text-muted">Entry-fee changes update dues for active players in {season}. Amounts already received stay recorded; anyone who owes more will show as Unpaid. Other seasons and inactive players keep their existing dues.</p>
        <Button type="submit" disabled={busy || snapshot.archived || !valid}>{busy ? 'Saving…' : 'Save money settings'}</Button>
      </fieldset>
    </form>}
  </Card>
}
