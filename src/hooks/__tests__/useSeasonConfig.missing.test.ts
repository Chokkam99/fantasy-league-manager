import { renderHook, waitFor } from '@testing-library/react'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'

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

describe('useSeasonConfig missing configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })
  })

  it('returns unsaved defaults without performing a write', async () => {
    const { result } = renderHook(() =>
      useSeasonConfig('league-1', '2026'),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.seasonConfig).toMatchObject({
      id: 'unsaved',
      league_id: 'league-1',
      season: '2026',
      fee_amount: 0,
    })
    expect(result.current.error).toBe(
      'No saved configuration exists for the 2026 season.',
    )
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('league_seasons')
  })
})
