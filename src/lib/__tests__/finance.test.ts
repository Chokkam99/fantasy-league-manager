import {
  isMissingFinanceSchema,
  summarizeFinance,
  validateFinanceAction,
} from '../finance'

const memberId = '123e4567-e89b-42d3-a456-426614174000'
const awardId = '223e4567-e89b-42d3-a456-426614174000'
const payoutId = '323e4567-e89b-42d3-a456-426614174000'

describe('finance actions', () => {
  it('normalizes detailed partial payments', () => {
    expect(
      validateFinanceAction({
        action: 'set_payment',
        member_id: memberId,
        notes: '  First half  ',
        paid_amount_cents: 2500,
        payment_method: ' Zelle ',
        season: '2026',
        status: 'partial',
      }),
    ).toEqual({
      is_valid: true,
      value: {
        action: 'set_payment',
        member_id: memberId,
        notes: 'First half',
        paid_amount_cents: 2500,
        payment_method: 'Zelle',
        season: '2026',
        status: 'partial',
      },
    })
  })

  it('accepts recipient clearing and payout status changes', () => {
    expect(
      validateFinanceAction({
        action: 'assign_award',
        award_id: awardId,
        member_id: null,
        season: '2026',
      }).is_valid,
    ).toBe(true)
    expect(
      validateFinanceAction({
        action: 'set_payout_status',
        payout_id: payoutId,
        season: '2026',
        status: 'paid',
      }).is_valid,
    ).toBe(true)
  })

  it('rejects malformed IDs, amounts, status, and long private fields', () => {
    const result = validateFinanceAction({
      action: 'set_payment',
      member_id: 'bad-id',
      notes: 'x'.repeat(501),
      paid_amount_cents: 0,
      payment_method: 'x'.repeat(41),
      season: '26',
      status: 'partial',
    })

    expect(result.is_valid).toBe(false)
    if (!result.is_valid) expect(result.errors).toHaveLength(5)
  })
})

describe('finance summary', () => {
  it('reconciles money in and money out in integer cents', () => {
    expect(
      summarizeFinance({
        payments: [
          { expected_amount_cents: 5000, paid_amount_cents: 5000 },
          { expected_amount_cents: 5000, paid_amount_cents: 2500 },
        ],
        payouts: [
          { amount_cents: 3000, status: 'paid' },
          { amount_cents: 6000, status: 'pending' },
        ],
      }),
    ).toEqual({
      collected_cents: 7500,
      expected_cents: 10000,
      outstanding_cents: 2500,
      paid_payouts_cents: 3000,
      pending_payouts_cents: 6000,
      planned_payouts_cents: 9000,
      projected_balance_cents: 1000,
    })
  })

  it('recognizes missing table and RPC schema errors', () => {
    expect(isMissingFinanceSchema({ code: 'PGRST205' })).toBe(true)
    expect(isMissingFinanceSchema({ code: 'PGRST202' })).toBe(true)
    expect(isMissingFinanceSchema({ code: '23503' })).toBe(false)
  })
})
