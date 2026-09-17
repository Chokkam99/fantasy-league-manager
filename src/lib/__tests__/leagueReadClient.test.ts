/** @jest-environment jsdom */

import {
  invalidateLeagueReadCache,
  loadLeagueView,
  prefetchLeagueViews,
} from '@/lib/leagueReadClient'

function successfulPayload(value: unknown) {
  return {
    json: jest.fn().mockResolvedValue(value),
    ok: true,
  } as unknown as Response
}

describe('league navigation cache', () => {
  beforeEach(() => {
    invalidateLeagueReadCache()
    global.fetch = jest.fn()
  })

  it('reuses a weekly read across navigation until it is invalidated', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>
    fetchMock
      .mockResolvedValueOnce(successfulPayload({ members: ['first'] }))
      .mockResolvedValueOnce(successfulPayload({ members: ['updated'] }))

    await expect(
      loadLeagueView('cache-league', 'standings', { season: '2026' }),
    ).resolves.toEqual({ members: ['first'] })
    await expect(
      loadLeagueView('cache-league', 'standings', { season: '2026' }),
    ).resolves.toEqual({ members: ['first'] })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    invalidateLeagueReadCache('cache-league', '2026')
    await expect(
      loadLeagueView('cache-league', 'standings', { season: '2026' }),
    ).resolves.toEqual({ members: ['updated'] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('prefetches each primary read once and then serves it from memory', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>
    fetchMock.mockImplementation(async (input) =>
      successfulPayload({ path: String(input) }),
    )

    await prefetchLeagueViews('prefetch-league', '2026')
    expect(fetchMock).toHaveBeenCalledTimes(7)

    await loadLeagueView('prefetch-league', 'prizes', { season: '2026' })
    await loadLeagueView('prefetch-league', 'history', { season: '2026' })
    expect(fetchMock).toHaveBeenCalledTimes(7)
  })
  it('rejects an invalid successful response without caching it, so retry can recover', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>
    fetchMock.mockResolvedValueOnce({ ok: true, json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token <')) } as unknown as Response)
      .mockResolvedValueOnce(successfulPayload({ members: ['recovered'] }))
    await expect(loadLeagueView('malformed', 'memberships')).rejects.toThrow('Reload the page')
    await expect(loadLeagueView('malformed', 'memberships')).resolves.toEqual({ members: ['recovered'] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

})
