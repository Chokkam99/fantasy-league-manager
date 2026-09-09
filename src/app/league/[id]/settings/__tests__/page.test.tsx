import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeagueSettingsPage from '../page'

const mockReloadLeague = jest.fn().mockResolvedValue(undefined)
jest.mock('@/components/league/SeasonMoneySettings', () => ({ SeasonMoneySettings: () => null }))

jest.mock('@/components/league/LeagueShellContext', () => ({
  useLeagueShell: () => ({
    isAdmin: true,
    isLeagueLoading: false,
    isViewOnly: false,
    league: {
      current_season: '2026',
      id: 'fixture-league',
      name: 'Fixture League',
    },
    leagueLoadError: null,
    reloadLeague: mockReloadLeague,
  }),
}))

const originalFetch = global.fetch

function snapshot(archived = false) {
  return {
    league: {
      archived_at: null,
      current_season: '2026',
      id: 'fixture-league',
    },
    schema_ready: true,
    seasons: [
      { archived_at: null, is_active: true, season: '2026' },
      {
        archived_at: archived ? '2026-08-25T00:00:00.000Z' : null,
        is_active: false,
        season: '2025',
      },
    ],
    success: true,
  }
}

describe('LeagueSettingsPage', () => {
  afterEach(() => {
    global.fetch = originalFetch
    mockReloadLeague.mockClear()
  })

  it('protects the active season and confirms reversible historical archival', async () => {
    const user = userEvent.setup()
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ json: async () => snapshot(), ok: true })
      .mockResolvedValueOnce({ json: async () => ({ success: true }), ok: true })
      .mockResolvedValueOnce({ json: async () => snapshot(true), ok: true })
    global.fetch = fetchMock as unknown as typeof fetch

    const params = Object.assign(Promise.resolve({ id: 'fixture-league' }), {
      status: 'fulfilled',
      value: { id: 'fixture-league' },
    })

    render(
      <LeagueSettingsPage
        params={params}
      />,
    )

    expect(
      await screen.findByRole('button', { name: 'Current season' }),
    ).toBeDisabled()
    const historicalRow = screen.getByText('2025').closest('div')?.parentElement
    expect(historicalRow).not.toBeNull()
    await user.click(
      within(historicalRow as HTMLElement).getByRole('button', {
        name: 'Archive season',
      }),
    )
    const dialog = screen.getByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Archive season' }),
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      action: 'set_season_archive',
      archived: true,
      season: '2025',
    })
    expect(mockReloadLeague).toHaveBeenCalled()
    expect(await screen.findByText(/2025 archived/)).toBeInTheDocument()
  })
})
