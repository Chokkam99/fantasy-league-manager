import { isMissingLifecycleSchema, validateLifecycleAction } from '../lifecycle'

describe('lifecycle actions', () => {
  it('accepts reversible league and season archive actions', () => {
    expect(
      validateLifecycleAction({
        action: 'set_league_archive',
        archived: true,
      }).is_valid,
    ).toBe(true)
    expect(
      validateLifecycleAction({
        action: 'set_season_archive',
        archived: false,
        season: '2025',
      }).is_valid,
    ).toBe(true)
  })

  it('rejects destructive or malformed lifecycle requests', () => {
    expect(
      validateLifecycleAction({ action: 'delete_league', archived: true })
        .is_valid,
    ).toBe(false)
    expect(
      validateLifecycleAction({
        action: 'set_season_archive',
        archived: 'yes',
        season: '25',
      }).is_valid,
    ).toBe(false)
  })

  it('recognizes pending lifecycle columns and functions', () => {
    expect(isMissingLifecycleSchema({ code: '42703' })).toBe(true)
    expect(isMissingLifecycleSchema({ code: 'PGRST202' })).toBe(true)
    expect(isMissingLifecycleSchema({ code: '23505' })).toBe(false)
  })
})
