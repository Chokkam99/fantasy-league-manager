import { validateMemberAction } from '../memberActions'

const memberId = '123e4567-e89b-42d3-a456-426614174000'

describe('member action validation', () => {
  it('normalizes a valid new player', () => {
    expect(
      validateMemberAction({
        action: 'add',
        manager_name: '  Alex   Smith ',
        season: '2025',
        team_name: ' Sunday   Stars ',
      }),
    ).toEqual({
      is_valid: true,
      value: {
        action: 'add',
        manager_name: 'Alex Smith',
        season: '2025',
        team_name: 'Sunday Stars',
      },
    })
  })

  it('accepts ID-scoped payment and participation actions', () => {
    expect(
      validateMemberAction({
        action: 'set_payment',
        member_id: memberId,
        payment_status: 'paid',
        season: '2025',
      }).is_valid,
    ).toBe(true)
    expect(
      validateMemberAction({
        action: 'edit_team',
        member_id: memberId,
        season: '2025',
        team_name: ' New   Team Name ',
      }),
    ).toEqual({
      is_valid: true,
      value: {
        action: 'edit_team',
        member_id: memberId,
        season: '2025',
        team_name: 'New Team Name',
      },
    })
    expect(
      validateMemberAction({
        action: 'activate',
        member_id: memberId,
        season: '2025',
      }).is_valid,
    ).toBe(true)
    expect(
      validateMemberAction({
        action: 'deactivate',
        member_id: memberId,
        season: '2025',
      }).is_valid,
    ).toBe(true)
  })

  it('rejects malformed names, IDs, seasons, and payment states', () => {
    const addResult = validateMemberAction({
      action: 'add',
      manager_name: '',
      season: '25',
      team_name: 'x'.repeat(81),
    })
    const paymentResult = validateMemberAction({
      action: 'set_payment',
      member_id: 'not-an-id',
      payment_status: 'partial',
      season: '2025',
    })

    expect(addResult.is_valid).toBe(false)
    expect(paymentResult.is_valid).toBe(false)
    if (!addResult.is_valid) expect(addResult.errors).toHaveLength(3)
    if (!paymentResult.is_valid) expect(paymentResult.errors).toHaveLength(2)
  })
})
