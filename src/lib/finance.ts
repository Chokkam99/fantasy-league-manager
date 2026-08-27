export type DuesStatus = 'paid' | 'partial' | 'pending'
export type PayoutStatus = 'paid' | 'pending'

export type ValidFinanceAction =
  | {
      action: 'set_payment'
      member_id: string
      notes: string | null
      paid_amount_cents: number | null
      payment_method: string | null
      season: string
      status: DuesStatus
    }
  | {
      action: 'assign_award'
      award_id: string
      member_id: string | null
      season: string
    }
  | {
      action: 'set_payout_status'
      payout_id: string
      season: string
      status: PayoutStatus
    }
  | {
      action: 'set_player_payout_status'
      member_id: string
      season: string
      status: PayoutStatus
    }

export type FinanceActionValidation =
  | { is_valid: true; value: ValidFinanceAction }
  | { errors: string[]; is_valid: false }

export interface FinanceSummaryInput {
  payments?: Array<{
    expected_amount_cents: number
    paid_amount_cents: number
  }>
  payouts?: Array<{
    amount_cents: number
    status: PayoutStatus | string
  }>
}

export interface FinanceSummary {
  collected_cents: number
  expected_cents: number
  outstanding_cents: number
  paid_payouts_cents: number
  pending_payouts_cents: number
  planned_payouts_cents: number
  projected_balance_cents: number
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function optionalText(value: unknown) {
  if (typeof value !== 'string') return null
  return value.trim() || null
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim())
}

function safeCents(value: number) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function validateFinanceAction(input: unknown): FinanceActionValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['The finance request must be an object.'], is_valid: false }
  }

  const body = input as Record<string, unknown>
  const action = body.action
  const season = typeof body.season === 'string' ? body.season : ''
  const errors: string[] = []

  if (![
    'set_payment',
    'assign_award',
    'set_payout_status',
    'set_player_payout_status',
  ].includes(String(action))) {
    errors.push('Choose a supported finance action.')
  }
  if (!/^\d{4}$/.test(season)) errors.push('A valid season is required.')

  if (action === 'set_payment') {
    const status = body.status
    const amount = body.paid_amount_cents
    const method = optionalText(body.payment_method)
    const notes = optionalText(body.notes)

    if (!isUuid(body.member_id)) errors.push('A valid member is required.')
    if (!['pending', 'partial', 'paid'].includes(String(status))) {
      errors.push('Payment status must be pending, partial, or paid.')
    }
    if (
      amount !== null &&
      amount !== undefined &&
      (!Number.isSafeInteger(amount) || Number(amount) < 0 || Number(amount) > 100_000_000)
    ) {
      errors.push('Paid amount must be a whole number of cents between 0 and 100000000.')
    }
    if (status === 'partial' && (!Number.isSafeInteger(amount) || Number(amount) <= 0)) {
      errors.push('A partial payment needs an amount greater than zero.')
    }
    if (method && method.length > 40) {
      errors.push('Payment method must be 40 characters or fewer.')
    }
    if (notes && notes.length > 500) {
      errors.push('Payment notes must be 500 characters or fewer.')
    }

    if (errors.length > 0) return { errors, is_valid: false }
    return {
      is_valid: true,
      value: {
        action: 'set_payment',
        member_id: String(body.member_id).trim(),
        notes,
        paid_amount_cents:
          amount === null || amount === undefined ? null : Number(amount),
        payment_method: method,
        season,
        status: status as DuesStatus,
      },
    }
  }

  if (action === 'assign_award') {
    if (!isUuid(body.award_id)) errors.push('A valid award is required.')
    if (body.member_id !== null && !isUuid(body.member_id)) {
      errors.push('Choose a valid recipient or leave it unassigned.')
    }

    if (errors.length > 0) return { errors, is_valid: false }
    return {
      is_valid: true,
      value: {
        action: 'assign_award',
        award_id: String(body.award_id).trim(),
        member_id:
          body.member_id === null ? null : String(body.member_id).trim(),
        season,
      },
    }
  }

  if (action === 'set_payout_status') {
    if (!isUuid(body.payout_id)) errors.push('A valid payout is required.')
    if (!['pending', 'paid'].includes(String(body.status))) {
      errors.push('Payout status must be pending or paid.')
    }

    if (errors.length > 0) return { errors, is_valid: false }
    return {
      is_valid: true,
      value: {
        action: 'set_payout_status',
        payout_id: String(body.payout_id).trim(),
        season,
        status: body.status as PayoutStatus,
      },
    }
  }

  if (action === 'set_player_payout_status') {
    if (!isUuid(body.member_id)) errors.push('A valid player is required.')
    if (!['pending', 'paid'].includes(String(body.status))) {
      errors.push('Player payout status must be pending or paid.')
    }

    if (errors.length > 0) return { errors, is_valid: false }
    return {
      is_valid: true,
      value: {
        action: 'set_player_payout_status',
        member_id: String(body.member_id).trim(),
        season,
        status: body.status as PayoutStatus,
      },
    }
  }

  return { errors, is_valid: false }
}

export function summarizeFinance({
  payments = [],
  payouts = [],
}: FinanceSummaryInput): FinanceSummary {
  const expectedCents = payments.reduce(
    (total, payment) => total + safeCents(payment.expected_amount_cents),
    0,
  )
  const collectedCents = payments.reduce(
    (total, payment) => total + safeCents(payment.paid_amount_cents),
    0,
  )
  const paidPayoutsCents = payouts.reduce(
    (total, payout) =>
      total + (payout.status === 'paid' ? safeCents(payout.amount_cents) : 0),
    0,
  )
  const pendingPayoutsCents = payouts.reduce(
    (total, payout) =>
      total + (payout.status === 'pending' ? safeCents(payout.amount_cents) : 0),
    0,
  )
  const plannedPayoutsCents = paidPayoutsCents + pendingPayoutsCents

  return {
    collected_cents: collectedCents,
    expected_cents: expectedCents,
    outstanding_cents: Math.max(0, expectedCents - collectedCents),
    paid_payouts_cents: paidPayoutsCents,
    pending_payouts_cents: pendingPayoutsCents,
    planned_payouts_cents: plannedPayoutsCents,
    projected_balance_cents: expectedCents - plannedPayoutsCents,
  }
}

export function isMissingFinanceSchema(error: { code?: string } | null | undefined) {
  return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code || '')
}
