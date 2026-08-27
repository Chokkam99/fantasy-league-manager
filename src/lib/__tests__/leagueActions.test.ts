import { validateCreateLeagueRequest } from '@/lib/leagueActions'

describe('league actions', () => {
  it('normalizes a valid league creation request', () => {
    expect(
      validateCreateLeagueRequest({
        fee_amount: '150.50',
        name: '  Sunday League  ',
        season: ' 2026 ',
      }),
    ).toEqual({
      errors: [],
      is_valid: true,
      value: {
        fee_amount: 150.5,
        name: 'Sunday League',
        season: '2026',
      },
    })
  })

  it.each([
    [{}, 'Enter a league name.'],
    [{ fee_amount: 0, name: 'League', season: '26' }, 'Enter a four-digit season start year.'],
    [{ fee_amount: -1, name: 'League', season: '2026' }, 'Entry fee must be between $0 and $1,000,000.'],
    [{ fee_amount: '', name: 'League', season: '2026' }, 'Entry fee must be between $0 and $1,000,000.'],
  ])('rejects invalid creation input', (input, expectedError) => {
    const result = validateCreateLeagueRequest(input)

    expect(result.is_valid).toBe(false)
    expect(result.value).toBeNull()
    expect(result.errors).toContain(expectedError)
  })
})
