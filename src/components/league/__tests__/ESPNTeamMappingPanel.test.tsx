import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ESPNTeamMappingPanel } from '@/components/league/ESPNTeamMappingPanel'
import type { ESPNTeamMappingSnapshot } from '@/lib/espn/types'

const snapshot: ESPNTeamMappingSnapshot = {
  assignments: [
    { espn_team_id: 1, member_id: 'member-1', source: 'automatic' },
  ],
  duplicate_matches: [],
  is_complete: false,
  members: [
    {
      manager_name: 'Alex Smith',
      member_id: 'member-1',
      team_name: 'New Name',
    },
    {
      manager_name: 'Jordan Lee',
      member_id: 'member-2',
      team_name: 'Fourth and Long',
    },
  ],
  teams: [
    {
      espn_owner_name: 'Alex Smith',
      espn_team_id: 1,
      espn_team_name: 'Sunday Scaries',
    },
    {
      espn_owner_name: 'Different ESPN Name',
      espn_team_id: 2,
      espn_team_name: 'Waiver Warriors',
    },
  ],
  unmapped_espn_team_ids: [2],
  unmapped_member_ids: ['member-2'],
}

describe('ESPNTeamMappingPanel', () => {
  it('prefills automatic matches and saves a complete one-to-one mapping', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn().mockResolvedValue(undefined)

    render(
      <ESPNTeamMappingPanel
        isSaving={false}
        onCancel={jest.fn()}
        onSave={onSave}
        season="2026"
        snapshot={snapshot}
      />,
    )

    expect(screen.getByText('1 of 2 assigned')).toBeInTheDocument()
    expect(
      screen.getByLabelText('League player for Sunday Scaries'),
    ).toHaveValue('member-1')
    expect(
      screen.getByRole('button', { name: 'Save 2026 assignments' }),
    ).toBeDisabled()

    await user.selectOptions(
      screen.getByLabelText('League player for Waiver Warriors'),
      'member-2',
    )
    await user.click(
      screen.getByRole('button', { name: 'Save 2026 assignments' }),
    )

    expect(onSave).toHaveBeenCalledWith({
      '1': 'member-1',
      '2': 'member-2',
    })
  })

  it('explains that assignments are season-specific and supports cancellation', async () => {
    const user = userEvent.setup()
    const onCancel = jest.fn()

    render(
      <ESPNTeamMappingPanel
        isSaving={false}
        onCancel={onCancel}
        onSave={jest.fn()}
        season="2026"
        snapshot={snapshot}
      />,
    )

    expect(screen.getByText(/apply only to 2026/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
