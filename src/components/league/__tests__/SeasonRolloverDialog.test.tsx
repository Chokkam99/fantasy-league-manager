import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SeasonSetupForm from '../SeasonRolloverDialog'

const originalFetch = global.fetch

describe('SeasonSetupForm stable returning players', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('submits a renamed returning manager as the same source player', async () => {
    const user = userEvent.setup()
    const onStarted = jest.fn()
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          preview: {
            can_start: true,
            espn_connection: {
              auto_sync_enabled: true,
              is_configured: true,
              league_id: '123456',
            },
            members: [
              {
                id: '123e4567-e89b-42d3-a456-426614174000',
                last_season: '2025',
                manager_id: '223e4567-e89b-42d3-a456-426614174000',
                manager_name: 'Christopher Jones',
                selected_by_default: true,
                team_name: 'Old Team',
              },
              {
                id: '123e4567-e89b-42d3-a456-426614174001',
                last_season: '2025',
                manager_id: '223e4567-e89b-42d3-a456-426614174001',
                manager_name: 'Jordan Lee',
                selected_by_default: true,
                team_name: 'Second Team',
              },
              {
                id: '123e4567-e89b-42d3-a456-426614174002',
                last_season: '2023',
                manager_id: '223e4567-e89b-42d3-a456-426614174002',
                manager_name: 'Past Player',
                selected_by_default: false,
                team_name: 'Past Team',
              },
            ],
            source_configuration: {
              divisions: null,
              draft_food_cost: 0,
              fee_amount: 0,
              playoff_spots: 2,
              playoff_start_week: 15,
              prize_structure: {},
              total_weeks: 17,
              weekly_prize_amount: 0,
            },
            source_season: '2025',
            target_exists: false,
            target_season: '2026',
          },
        }),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: async () => ({ target_season: '2026' }),
        ok: true,
      })
    global.fetch = fetchMock as unknown as typeof fetch

    render(
      <SeasonSetupForm
        leagueId="fixture-league"
        onCancel={jest.fn()}
        onStarted={onStarted}
      />,
    )

    const managerInput = (await screen.findAllByLabelText('Manager name'))[0]
    expect(
      screen.getByText(/ESPN league 123456 and its securely stored connection carry forward/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/automatic weekly sync remains on/i)).toBeInTheDocument()
    await user.clear(managerInput)
    await user.type(managerInput, 'Chris Jones')
    await user.clear(screen.getAllByLabelText('Team name')[0])
    await user.type(screen.getAllByLabelText('Team name')[0], 'New Team')
    const pastPlayer = screen.getByRole('checkbox', { name: /Past Player/ })
    expect(pastPlayer).not.toBeChecked()
    expect(screen.getByText('Last played 2023')).toBeInTheDocument()
    await user.click(pastPlayer)
    expect(
      screen.getByRole('button', { name: 'Review and start 2026' }),
    ).toBeDisabled()
    expect(screen.getByText(/require an even number of teams/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add new player' }))
    const managerInputs = screen.getAllByLabelText('Manager name')
    const teamInputs = screen.getAllByLabelText('Team name')
    await user.type(managerInputs[managerInputs.length - 1], 'New Manager')
    await user.type(teamInputs[teamInputs.length - 1], 'Expansion Team')
    await user.click(
      screen.getByRole('button', { name: 'Review and start 2026' }),
    )
    await user.click(screen.getByRole('button', { name: 'Start 2026' }))

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('2026'))
    const postOptions = fetchMock.mock.calls[1][1] as RequestInit
    const body = JSON.parse(String(postOptions.body))
    expect(body.members).toEqual([
      {
        division: null,
        manager_name: 'Chris Jones',
        source_member_id: '123e4567-e89b-42d3-a456-426614174000',
        team_name: 'New Team',
      },
      {
        division: null,
        manager_name: 'Jordan Lee',
        source_member_id: '123e4567-e89b-42d3-a456-426614174001',
        team_name: 'Second Team',
      },
      {
        division: null,
        manager_name: 'Past Player',
        source_member_id: '123e4567-e89b-42d3-a456-426614174002',
        team_name: 'Past Team',
      },
      {
        division: null,
        manager_name: 'New Manager',
        source_member_id: null,
        team_name: 'Expansion Team',
      },
    ])
  })
})
