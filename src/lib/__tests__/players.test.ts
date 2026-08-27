import { buildPlayerDirectory, type PlayerMembership } from '../players'

const memberships: PlayerMembership[] = [
  {
    id: 'old-a',
    is_active: true,
    manager_name: 'Alex Smith',
    payment_status: 'paid',
    season: '2024',
    team_name: 'Old Stars',
  },
  {
    division: 'East',
    id: 'new-a',
    is_active: true,
    manager_name: 'alex smith',
    payment_status: 'pending',
    season: '2025',
    team_name: 'New Stars',
  },
  {
    id: 'old-b',
    is_active: true,
    manager_name: 'Blair',
    payment_status: 'paid',
    season: '2024',
    team_name: 'Blair Team',
  },
]

describe('player directory', () => {
  it('groups season memberships and exposes the selected-season record', () => {
    const directory = buildPlayerDirectory(memberships, '2025')
    const alex = directory.find((player) =>
      player.managerName.toLowerCase().includes('alex'),
    )

    expect(directory).toHaveLength(2)
    expect(alex).toMatchObject({
      currentMemberId: 'new-a',
      currentTeamName: 'New Stars',
      division: 'East',
      isParticipating: true,
      paymentStatus: 'pending',
      seasons: ['2025', '2024'],
      sourceMemberId: 'new-a',
      teamNames: ['New Stars', 'Old Stars'],
    })
  })

  it('keeps historical managers available for a later season', () => {
    const blair = buildPlayerDirectory(memberships, '2025').find(
      (player) => player.managerName === 'Blair',
    )

    expect(blair).toMatchObject({
      currentMemberId: null,
      isParticipating: false,
      seasons: ['2024'],
      sourceMemberId: 'old-b',
    })
  })

  it('groups renamed managers by stable identity while preserving team snapshots', () => {
    const directory = buildPlayerDirectory(
      [
        {
          id: 'old-c',
          is_active: true,
          manager_id: 'manager-c',
          manager_name: 'Christopher Jones',
          payment_status: 'paid',
          season: '2024',
          team_name: 'Old Name',
        },
        {
          id: 'new-c',
          is_active: true,
          manager_id: 'manager-c',
          manager_name: 'Chris Jones',
          payment_status: 'pending',
          season: '2025',
          team_name: 'New Name',
        },
      ],
      '2025',
    )

    expect(directory).toHaveLength(1)
    expect(directory[0]).toMatchObject({
      currentMemberId: 'new-c',
      managerId: 'manager-c',
      managerName: 'Chris Jones',
      seasons: ['2025', '2024'],
      teamNames: ['New Name', 'Old Name'],
    })
  })
})
