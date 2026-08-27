import {
  loadAutomationSettings,
  PlatformImportRequestError,
  requestESPNImport,
  saveAutomationSettings,
} from '@/lib/platformImportClient'

const mockFetch = jest.fn()

function response(ok: boolean, payload: unknown) {
  return { json: jest.fn().mockResolvedValue(payload), ok } as unknown as Response
}

describe('platform import client boundary', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    global.fetch = mockFetch
  })

  it('loads encoded season-scoped status without exposing credentials', async () => {
    mockFetch.mockResolvedValue(
      response(true, {
        settings: { is_configured: false, season: '2026' },
        success: true,
      }),
    )

    await expect(
      loadAutomationSettings('league/one', '2026'),
    ).resolves.toMatchObject({ season: '2026' })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/leagues/league%2Fone/automation?season=2026',
    )
  })

  it('posts connection and import actions through protected routes', async () => {
    mockFetch
      .mockResolvedValueOnce(
        response(true, {
          message: 'Saved',
          settings: { is_configured: true },
          success: true,
        }),
      )
      .mockResolvedValueOnce(
        response(true, { success: true, week: 7, result: { message: 'Synced' } }),
      )

    await saveAutomationSettings('league-one', {
      auto_sync_enabled: false,
      league_id: '123',
      private_league: false,
      season: '2026',
    })
    await requestESPNImport('league-one', '2026', 'sync', 7)

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/leagues/league-one/automation',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/leagues/league-one/scores/import',
      expect.objectContaining({
        body: JSON.stringify({ action: 'sync', season: '2026', week: 7 }),
        method: 'POST',
      }),
    )
  })

  it('preserves structured mapping recovery details on server errors', async () => {
    const mapping = { assignments: [], teams: [] }
    mockFetch.mockResolvedValue(
      response(false, {
        code: 'TEAM_MAPPING_REQUIRED',
        error: 'Review assignments',
        mapping,
        success: false,
      }),
    )

    await expect(
      requestESPNImport('league-one', '2026', 'preview', 'latest'),
    ).rejects.toMatchObject<Partial<PlatformImportRequestError>>({
      message: 'Review assignments',
      payload: expect.objectContaining({
        code: 'TEAM_MAPPING_REQUIRED',
        mapping,
      }),
    })
  })

  it('uses a safe error when a protected route returns malformed JSON', async () => {
    mockFetch.mockResolvedValue({
      json: jest.fn().mockRejectedValue(new Error('bad json')),
      ok: false,
    })

    await expect(
      loadAutomationSettings('league-one', '2026'),
    ).rejects.toThrow('Score import status could not be loaded.')
  })

  it('does not report a malformed preview response as a successful sync', async () => {
    mockFetch.mockResolvedValue(
      response(true, { success: true, week: 4 }),
    )

    await expect(
      requestESPNImport('league-one', '2026', 'preview', 4),
    ).rejects.toThrow('The ESPN response was incomplete. No scores were changed.')
  })
})
