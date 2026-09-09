import { invalidateFinanceCache, loadFinanceSnapshot } from '../financeClient'
import { invalidateLeagueReadCache, loadLeagueView } from '../leagueReadClient'

const response = (version: string) => ({ ok: true, json: async () => ({ version }) }) as Response

describe.each([
  ['finance', () => loadFinanceSnapshot('race-league', '2026'), () => invalidateFinanceCache('race-league', '2026')],
  ['league', () => loadLeagueView('race-league', 'memberships', { season: '2026' }), () => invalidateLeagueReadCache('race-league', '2026')],
] as const)('%s cache invalidation', (_, load, invalidate) => {
  beforeEach(() => {
    invalidate()
    global.fetch = jest.fn()
  })

  it('ignores a stale in-flight response after fresh data has arrived', async () => {
    let resolveOld!: (value: Response) => void
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce(response('fresh'))
    const oldRequest = load()
    await Promise.resolve()
    invalidate()
    await expect(load()).resolves.toEqual({ version: 'fresh' })
    resolveOld(response('stale'))
    await oldRequest
    await expect(load()).resolves.toEqual({ version: 'fresh' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), { cache: 'no-store' })
  })

  it('keeps a newer pending request when an invalidated request finishes', async () => {
    let resolveOld!: (value: Response) => void
    let resolveNew!: (value: Response) => void
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve }))
    const oldRequest = load()
    await Promise.resolve()
    invalidate()
    const newRequest = load()
    await Promise.resolve()
    resolveOld(response('stale'))
    await oldRequest
    const concurrentRequest = load()
    resolveNew(response('fresh'))
    await expect(newRequest).resolves.toEqual({ version: 'fresh' })
    await expect(concurrentRequest).resolves.toEqual({ version: 'fresh' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
