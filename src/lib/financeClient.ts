import type { FinanceSummary, ValidFinanceAction } from './finance'
import { addCurrentShareToken } from './leagueReadClient'

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

export interface FinancePayout {
  amount_cents: number
  award_id: string
  id: string
  league_member_id: string
  paid_at: string | null
  status: 'paid' | 'pending'
}

export interface FinanceSnapshot {
  awards: FinanceAward[]
  is_commissioner: boolean
  payments?: FinancePayment[]
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
  const response = await fetch(
    `/api/leagues/${encodeURIComponent(leagueId)}/finance?${query}`,
  )
  const { message, payload } = await responseMessage(
    response,
    'Finance details could not be loaded.',
  )
  if (!response.ok) throw new Error(message)
  return payload as FinanceSnapshot
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
  return payload
}
