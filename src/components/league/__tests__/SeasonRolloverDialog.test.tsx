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
            members: [
              {
                id: '123e4567-e89b-42d3-a456-426614174000',
                manager_id: '223e4567-e89b-42d3-a456-426614174000',
                manager_name: 'Christopher Jones',
                team_name: 'Old Team',
              },
            ],
            source_configuration: {
              divisions: null,
              draft_food_cost: 0,
              fee_amount: 0,
              playoff_spots: 6,
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

    const managerInput = await screen.findByLabelText('Manager name')
    await user.clear(managerInput)
    await user.type(managerInput, 'Chris Jones')
    await user.clear(screen.getByLabelText('Team name'))
    await user.type(screen.getByLabelText('Team name'), 'New Team')
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
    ])
  })
})
