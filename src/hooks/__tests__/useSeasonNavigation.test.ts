import { act, renderHook, waitFor } from '@testing-library/react'
import { useSeasonNavigation } from '../useSeasonNavigation'
import { LEAGUE_DATA_CHANGED, loadLeagueView } from '@/lib/leagueReadClient'
jest.mock('@/lib/leagueReadClient', () => ({ LEAGUE_DATA_CHANGED: 'league-data-changed', loadLeagueView: jest.fn() }))
const read = loadLeagueView as jest.Mock
const snapshot = { season: '2026', phase: 'preseason', duesRemaining: 3, playerCount: 4 }
afterEach(() => jest.clearAllMocks())
it('refreshes dues after scoped writes and forces fresh data on window focus', async () => {
  read.mockResolvedValue(snapshot)
  const { result } = renderHook(() => useSeasonNavigation('league', '2026', true))
  await waitFor(() => expect(result.current).toEqual(snapshot))
  act(() => window.dispatchEvent(new CustomEvent(LEAGUE_DATA_CHANGED, { detail: { leagueId: 'other' } })))
  expect(read).toHaveBeenCalledTimes(1)
  read.mockResolvedValue({ ...snapshot, duesRemaining: 2 })
  act(() => window.dispatchEvent(new CustomEvent(LEAGUE_DATA_CHANGED, { detail: { leagueId: 'league', season: '2026' } })))
  await waitFor(() => expect(result.current?.duesRemaining).toBe(2))
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(read).toHaveBeenLastCalledWith('league', 'navigation', { season: '2026', force: true }))
})
it('does not load navigation for shared viewers and discards old-season responses', async () => {
  let resolve!: (value: unknown) => void
  read.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const { result, rerender } = renderHook(({ season, enabled }) => useSeasonNavigation('league', season, enabled), { initialProps: { season: '2026', enabled: true } })
  rerender({ season: '2025', enabled: true })
  await act(async () => resolve(snapshot))
  expect(result.current).toBeNull()
  read.mockClear()
  rerender({ season: '2025', enabled: false })
  expect(read).not.toHaveBeenCalled()
})
