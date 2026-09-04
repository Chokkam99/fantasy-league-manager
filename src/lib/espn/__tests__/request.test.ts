import {
  requestESPNData,
  requestESPNOnboardingData,
} from '@/lib/espn/request'

describe('ESPN requests', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('retries a private league on the league API host with its cookies', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 123 }),
      }) as jest.Mock

    await expect(requestESPNData({
      espn_s2: 'private-cookie',
      league_id: '9876543210',
      private_league: true,
      swid: '{ABC}',
      year: 2026,
    }, '', { view: 'mSettings,mTeam' })).resolves.toMatchObject({ id: 123 })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    const [retryUrl, retryOptions] = (global.fetch as jest.Mock).mock.calls[1]
    expect(String(retryUrl)).toContain(
      'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/9876543210',
    )
    expect(retryOptions).toMatchObject({
      headers: expect.objectContaining({
        Cookie: 'espn_s2=private-cookie; SWID={ABC};',
      }),
    })
  })

  it('loads settings and teams as separate ESPN views before merging them', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: URL) => {
      const view = url.searchParams.get('view')
      const body = view === 'mSettings'
        ? { settings: { name: 'Friends League' } }
        : {
            members: [{ firstName: 'Alex', id: 'owner-1', lastName: 'Smith' }],
            teams: [{ id: 1, name: 'Sunday Stars', owners: ['owner-1'] }],
          }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
      }
    }) as jest.Mock

    await expect(requestESPNOnboardingData({
      league_id: '9876543210',
      year: 2026,
    })).resolves.toMatchObject({
      members: [{ id: 'owner-1' }],
      settings: { name: 'Friends League' },
      teams: [{ id: 1, name: 'Sunday Stars' }],
    })

    const views = (global.fetch as jest.Mock).mock.calls.map(([url]) =>
      (url as URL).searchParams.get('view'))
    expect(views).toEqual(['mSettings', 'mTeam'])
  })
})
