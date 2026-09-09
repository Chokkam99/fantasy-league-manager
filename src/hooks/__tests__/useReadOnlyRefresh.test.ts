import { act, renderHook } from '@testing-library/react'
import { useReadOnlyRefresh, READ_ONLY_REFRESH_MS } from '../useReadOnlyRefresh'
import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'

jest.mock('@/lib/financeClient', () => ({ invalidateFinanceCache: jest.fn() }))
jest.mock('@/lib/leagueReadClient', () => ({ invalidateLeagueReadCache: jest.fn() }))

const defaults = { enabled: true, leagueId: 'league', season: '2026' }
const advance = async (ms: number) => {
  await act(async () => { jest.advanceTimersByTime(ms) })
}

describe('shared page freshness', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })
  afterEach(() => { jest.useRealTimers() })

  it('invalidates on entry and polls the current callback; stops on unmount', async () => {
    const first = jest.fn().mockResolvedValue(undefined)
    const latest = jest.fn().mockResolvedValue(undefined)
    const { rerender, unmount } = renderHook(({ onRefresh }) => useReadOnlyRefresh({ ...defaults, onRefresh }),
      { initialProps: { onRefresh: first } })
    expect(invalidateFinanceCache).toHaveBeenCalledWith('league', '2026')
    expect(invalidateLeagueReadCache).toHaveBeenCalledWith('league', '2026')
    expect(first).not.toHaveBeenCalled()
    rerender({ onRefresh: latest })
    await advance(READ_ONLY_REFRESH_MS)
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
    unmount()
    await advance(READ_ONLY_REFRESH_MS)
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(latest).toHaveBeenCalledTimes(1)
  })

  it('pauses hidden tabs and refreshes on return without duplicate focus requests', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined)
    renderHook(() => useReadOnlyRefresh({ ...defaults, onRefresh }))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    await advance(READ_ONLY_REFRESH_MS)
    expect(onRefresh).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not overlap pending refreshes and retries failures', async () => {
    let reject!: (error: Error) => void
    const onRefresh = jest.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
      .mockResolvedValue(undefined)
    renderHook(() => useReadOnlyRefresh({ ...defaults, onRefresh }))
    await advance(READ_ONLY_REFRESH_MS * 2)
    expect(onRefresh).toHaveBeenCalledTimes(1)
    await act(async () => { reject(new Error('offline')) })
    await advance(READ_ONLY_REFRESH_MS)
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  it('does not refresh or invalidate commissioner pages', async () => {
    const onRefresh = jest.fn()
    renderHook(() => useReadOnlyRefresh({ ...defaults, enabled: false, onRefresh }))
    await advance(READ_ONLY_REFRESH_MS)
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(onRefresh).not.toHaveBeenCalled()
    expect(invalidateFinanceCache).not.toHaveBeenCalled()
  })
})
