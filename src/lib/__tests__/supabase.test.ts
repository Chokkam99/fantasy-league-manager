import { hasConfiguredLeagueSeason } from '@/lib/leagueSeason'

describe('public Supabase view-model boundaries', () => {
  it('accepts a configured NFL season start year', () => {
    const league = { current_season: '2026', id: 'league-1' }

    expect(hasConfiguredLeagueSeason(league)).toBe(true)
  })

  it('rejects missing and malformed season values', () => {
    expect(hasConfiguredLeagueSeason({ current_season: null })).toBe(false)
    expect(hasConfiguredLeagueSeason({ current_season: '' })).toBe(false)
    expect(hasConfiguredLeagueSeason({ current_season: '26' })).toBe(false)
    expect(hasConfiguredLeagueSeason({ current_season: '2026-2027' })).toBe(false)
  })

  it('uses the NFL season start year without calendar rollover logic', () => {
    const league = { current_season: '2025' }

    expect(hasConfiguredLeagueSeason(league)).toBe(true)
    expect(league.current_season).toBe('2025')
  })
})
