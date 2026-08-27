import { validateActiveSeasonAccess } from '../seasonAccess'

describe('active season access', () => {
  it('allows ESPN operations for the league active season', () => {
    expect(validateActiveSeasonAccess('2026', '2026')).toEqual({
      allowed: true,
    })
  })

  it('preserves a historical season from ESPN operations', () => {
    expect(validateActiveSeasonAccess('2025', '2026')).toEqual({
      allowed: false,
      message:
        'ESPN operations are limited to the active 2026 season. 2025 is preserved as historical data.',
    })
  })

  it.each([
    [undefined, '2026'],
    ['26', '2026'],
    [2026, '2026'],
  ])('fails closed for malformed requested seasons', (requested, current) => {
    expect(validateActiveSeasonAccess(requested, current)).toEqual({
      allowed: false,
      message: 'A valid season is required.',
    })
  })

  it.each([undefined, 'current', 2026])(
    'fails closed when the league active season is malformed',
    (current) => {
      expect(validateActiveSeasonAccess('2026', current)).toEqual({
        allowed: false,
        message: 'The league active season is not configured correctly.',
      })
    },
  )
})
