import { performMemberAction } from '@/lib/memberClient'

const originalFetch = global.fetch

describe('member action client', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('posts one encoded protected-route action and returns its message', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ message: 'Player added.', success: true }),
      ok: true,
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(
      performMemberAction('league / one', {
        action: 'activate',
        member_id: 'member-one',
        season: '2026',
      }),
    ).resolves.toBe('Player added.')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/leagues/league%20%2F%20one/members',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('surfaces server errors and handles malformed responses safely', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({ error: 'Archived season.' }),
      ok: false,
    }) as unknown as typeof fetch
    await expect(
      performMemberAction('league-one', { action: 'deactivate' }),
    ).rejects.toThrow('Archived season.')

    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => {
        throw new Error('invalid json')
      },
      ok: false,
    }) as unknown as typeof fetch
    await expect(
      performMemberAction('league-one', { action: 'deactivate' }),
    ).rejects.toThrow('The player action failed.')
  })
})
