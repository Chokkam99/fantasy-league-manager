import { act, renderHook, waitFor } from '@testing-library/react'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'
import type { LeagueSeasonRow } from '@/lib/supabase'

const mockSingle = jest.fn()
const mockSecondEq = jest.fn(() => ({ single: mockSingle }))
const mockFirstEq = jest.fn(() => ({ eq: mockSecondEq }))
const mockSelect = jest.fn(() => ({ eq: mockFirstEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const savedSeason: LeagueSeasonRow = {
  created_at: '2026-08-01T00:00:00.000Z',
  divisions: { divisions: ['East', 'West'] },
  draft_food_cost: 80,
  fee_amount: 75,
  final_winners: { first: null },
  id: 'season-1',
  is_active: true,
  league_id: 'league-1',
  playoff_spots: 6,
  playoff_start_week: 15,
  prize_structure: { first: 300, second: 150, third: 75 },
  season: '2026',
  total_weeks: 17,
  updated_at: '2026-08-01T00:00:00.000Z',
  weekly_prize_amount: 10,
}

describe('useSeasonConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSingle.mockResolvedValue({ data: savedSeason, error: null })
  })

  it('ignores an older season response that arrives after the new season', async () => {
    let resolveOld!: (value: unknown) => void
    mockSingle.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce({ data: { ...savedSeason, season: '2025', fee_amount: 25 }, error: null })
    const { result, rerender } = renderHook(({ season }) => useSeasonConfig('league-1', season),
      { initialProps: { season: '2026' } })
    rerender({ season: '2025' })
    await waitFor(() => expect(result.current.seasonConfig?.fee_amount).toBe(25))
    await act(async () => { resolveOld({ data: savedSeason, error: null }) })
    expect(result.current.seasonConfig?.season).toBe('2025')
    expect(result.current.seasonConfig?.fee_amount).toBe(25)
  })

  it('loads and normalizes the saved season configuration', async () => {
    const { result } = renderHook(() => useSeasonConfig('league-1', '2026'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.seasonConfig).toMatchObject({
      divisions: { divisions: ['East', 'West'] },
      fee_amount: 75,
      id: 'season-1',
      league_id: 'league-1',
      season: '2026',
      weekly_prize_amount: 10,
    })
    expect(mockFrom).toHaveBeenCalledWith('league_seasons')
    expect(mockFirstEq).toHaveBeenCalledWith('league_id', 'league-1')
    expect(mockSecondEq).toHaveBeenCalledWith('season', '2026')
  })

  it('returns explicit unsaved defaults when the season row is missing', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })
    const { result } = renderHook(() => useSeasonConfig('league-1', '2027'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.seasonConfig).toMatchObject({
      fee_amount: 0,
      id: 'unsaved',
      league_id: 'league-1',
      season: '2027',
      total_weeks: 17,
    })
    expect(result.current.error).toBe(
      'No saved configuration exists for the 2027 season.',
    )
  })

  it('falls back safely and exposes a readable database error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error('Database unavailable'),
    })
    const { result } = renderHook(() => useSeasonConfig('league-1', '2026'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Database unavailable')
    expect(result.current.seasonConfig).toMatchObject({
      id: 'unsaved',
      league_id: 'league-1',
      season: '2026',
    })
  })

  it('does not query until both league and season are available', async () => {
    const { result } = renderHook(() => useSeasonConfig('', ''))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.seasonConfig).toBeNull()
  })

  it('supports an explicit refetch using the same scoped query', async () => {
    const { result } = renderHook(() => useSeasonConfig('league-1', '2026'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockSingle.mockResolvedValue({
      data: { ...savedSeason, weekly_prize_amount: 20 },
      error: null,
    })
    await act(async () => result.current.refetch())

    expect(result.current.seasonConfig?.weekly_prize_amount).toBe(20)
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })

  it('reloads when the requested season changes', async () => {
    const { rerender, result } = renderHook(
      ({ season }) => useSeasonConfig('league-1', season),
      { initialProps: { season: '2026' } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockSingle.mockResolvedValue({
      data: { ...savedSeason, id: 'season-2', season: '2027' },
      error: null,
    })
    rerender({ season: '2027' })

    await waitFor(() =>
      expect(result.current.seasonConfig?.season).toBe('2027'),
    )
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })
})
