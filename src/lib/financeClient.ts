import type { FinanceSummary, ValidFinanceAction } from './finance'
import {
  addCurrentShareToken,
  invalidateLeagueReadCache,
} from './leagueReadClient'

const FINANCE_CACHE_TTL_MS = 5 * 60 * 1000
const financeCache = new Map<
  string,
  { expiresAt: number; value: FinanceSnapshot }
>()
const financeRequests = new Map<string, Promise<FinanceSnapshot>>()

export function invalidateFinanceCache(leagueId?: string, season?: string) {
  const leagueFragment = leagueId
    ? `/api/leagues/${encodeURIComponent(leagueId)}/finance?`
    : null
  const seasonFragment = season ? `season=${encodeURIComponent(season)}` : null
  for (const key of new Set([...financeCache.keys(), ...financeRequests.keys()])) {
    if (leagueFragment && !key.startsWith(leagueFragment)) continue
    if (seasonFragment && !key.includes(seasonFragment)) continue
    financeCache.delete(key)
    financeRequests.delete(key)
  }
}

export interface FinanceAward {
  award_key: string
  award_type: 'final' | 'special' | 'weekly'
  category_key: string
  id: string
  label: string
  planned_amount_cents: number
  week_number: number | null
}

export interface FinancePayment {
  expected_amount_cents: number
  id: string
  league_member_id: string
  notes: string | null
  paid_amount_cents: number
  paid_at: string | null
  payment_method: string | null
  status: 'paid' | 'partial' | 'pending'
}

// Shared dues omit payment notes, methods, timestamps, and internal payment IDs.
export type FinanceDues = Pick<FinancePayment,
  'league_member_id' | 'status' | 'expected_amount_cents' | 'paid_amount_cents'
>

export interface FinancePayout {
  amount_cents: number
  award_id: string
  id: string
  league_member_id: string
  paid_at: string | null
  status: 'paid' | 'pending'
}

export interface FinancePlayerPayoutStatus {
  id: string
  league_member_id: string
  paid_at: string | null
  status: 'paid' | 'pending'
}

export interface FinanceSnapshot {
  awards: FinanceAward[]
  is_commissioner: boolean
  payments?: FinancePayment[]
  dues?: FinanceDues[]
  player_payout_tracking_ready?: boolean
  player_payouts?: FinancePlayerPayoutStatus[]
  payouts: FinancePayout[]
  schema_ready: boolean
  success: true
  summary: FinanceSummary | null
}

async function responseMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null)
  return {
    message:
      payload && typeof payload.error === 'string' ? payload.error : fallback,
    payload,
  }
}

export async function loadFinanceSnapshot(
  leagueId: string,
  season: string,
): Promise<FinanceSnapshot> {
  const query = new URLSearchParams({ season })
  addCurrentShareToken(query)
  const path = `/api/leagues/${encodeURIComponent(leagueId)}/finance?${query}`
  const cached = financeCache.get(path)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const pending = financeRequests.get(path)
  if (pending) return pending

  const request: Promise<FinanceSnapshot> = Promise.resolve().then(async () => {
    const response = await fetch(path, { cache: 'no-store' })
    const { message, payload } = await responseMessage(
      response,
      'Finance details could not be loaded.',
    )
    if (!response.ok) throw new Error(message)
    const snapshot = payload as FinanceSnapshot
    if (financeRequests.get(path) === request) {
      financeCache.set(path, {
        expiresAt: Date.now() + FINANCE_CACHE_TTL_MS,
        value: snapshot,
      })
    }
    return snapshot
  })
  financeRequests.set(path, request)
  try {
    return await request
  } finally {
    if (financeRequests.get(path) === request) financeRequests.delete(path)
  }
}

export async function performFinanceAction(
  leagueId: string,
  action: ValidFinanceAction,
) {
  const response = await fetch(
    `/api/leagues/${encodeURIComponent(leagueId)}/finance`,
    {
      body: JSON.stringify(action),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )
  const { message, payload } = await responseMessage(
    response,
    'The finance update failed.',
  )
  if (!response.ok) throw new Error(message)
  invalidateFinanceCache(leagueId, action.season)
  invalidateLeagueReadCache(leagueId, action.season)
  return payload
}
