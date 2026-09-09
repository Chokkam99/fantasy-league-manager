import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewLeagueSetup from '@/components/NewLeagueSetup'
import { espnSeasonData } from '../../../test/fixtures/espnSeason'
import { parseESPNSeasonSnapshot } from '@/lib/espn/seasonSnapshot'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('NewLeagueSetup', () => {
  beforeEach(() => {
    mockPush.mockReset()
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ league: { id: 'sunday-legends' }, success: true }),
      ok: true,
    }) as jest.Mock
  })

  it('creates a complete manual first season and uses a readable link', async () => {
    const user = userEvent.setup()
    render(<NewLeagueSetup />)

    await user.type(screen.getByLabelText('League name'), 'Sunday Legends')
    expect(screen.getByLabelText('League link')).toHaveValue('sunday-legends')
    await user.click(screen.getByRole('button', { name: 'Add player' }))
    await user.click(screen.getByRole('button', { name: 'Add player' }))

    const managerInputs = screen.getAllByLabelText('Manager name')
    const teamInputs = screen.getAllByLabelText('Team name')
    await user.type(managerInputs[0], 'Alex')
    await user.type(teamInputs[0], 'Sunday Stars')
    await user.type(managerInputs[1], 'Blake')
    await user.type(teamInputs[1], 'Desert Owls')
    await user.clear(screen.getByLabelText('Playoff teams'))
    await user.type(screen.getByLabelText('Playoff teams'), '2')

    await user.click(screen.getByRole('button', { name: 'Create league' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/leagues',
      expect.objectContaining({ method: 'POST' }),
    ))
    const request = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(JSON.parse(request.body)).toMatchObject({
      id: 'sunday-legends',
      members: [
        { manager_name: 'Alex', team_name: 'Sunday Stars' },
        { manager_name: 'Blake', team_name: 'Desert Owls' },
      ],
    })
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/league/sunday-legends?season=')))
  })

  it('makes ESPN the default source for the requested season', () => {
    render(<NewLeagueSetup />)
    expect(screen.getByText(/first tracked season together/i)).toBeInTheDocument()
    expect(screen.getByText(/begin with a past season and add the next season separately/i)).toHaveClass('sr-only')
    expect(screen.getByText(/Confirmed owners, teams, divisions, and format are filled automatically/i)).toBeInTheDocument()
  })

  it('fills confirmed ESPN data and requires confirmation only for an uncertain owner', async () => {
    const user = userEvent.setup()
    const imported = parseESPNSeasonSnapshot(espnSeasonData, '2026', [], {}, '123456')
    imported.teams[0].status = 'unconfirmed'
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        season_snapshot: imported,
        snapshot: { league_name: imported.league_name, teams: imported.teams },
      }),
    })
    render(<NewLeagueSetup />)
    await user.type(screen.getByLabelText('ESPN league URL or ID'), '123456')
    await user.click(screen.getByRole('button', { name: 'Import ESPN season' }))
    await waitFor(() => expect(screen.getByLabelText('League name')).toHaveValue('ESPN Friends'))
    expect(screen.getByLabelText('Playoff teams')).toHaveValue(2)
    expect(screen.getByLabelText('Playoff teams')).toHaveAttribute('readonly')
    expect(screen.getAllByLabelText('Manager name')[1]).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Add player' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create league' })).toBeDisabled()
    expect(screen.getAllByLabelText('I confirmed this player’s identity')).toHaveLength(1)
    await user.click(screen.getByLabelText('I confirmed this player’s identity'))
    await user.click(screen.getByRole('button', { name: 'Create league' }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/league/sunday-legends/season-import?season=')))
  })

  it('accepts a full ESPN team URL and previews only its league ID', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        cron_configured: true,
        snapshot: {
          league_name: 'Draft Night League',
          teams: [
            { manager_name: 'Alex', team_id: 1, team_name: 'Team One' },
            { manager_name: 'Blake', team_id: 2, team_name: 'Team Two' },
          ],
        },
      }),
      ok: true,
    })
    render(<NewLeagueSetup />)

    await user.type(
      screen.getByLabelText('ESPN league URL or ID'),
      'https://fantasy.espn.com/football/team?leagueId=9876543210&teamId=1',
    )
    expect(screen.getByText('League ID 9876543210 detected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import ESPN season' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/leagues/espn-preview',
      expect.objectContaining({ method: 'POST' }),
    ))
    const request = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(JSON.parse(request.body)).toMatchObject({ league_id: '9876543210' })
  })
})
