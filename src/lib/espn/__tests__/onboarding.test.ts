import { parseESPNOnboardingSnapshot } from '@/lib/espn/onboarding'

describe('ESPN onboarding snapshot', () => {
  it('returns only current league identity, owners, and teams', () => {
    expect(parseESPNOnboardingSnapshot({
      members: [
        { firstName: 'Alex', id: 'owner-1', lastName: 'Smith' },
        { firstName: 'Blake', id: 'owner-2', lastName: 'Jones' },
      ],
      settings: { name: 'Draft Night' },
      teams: [
        { id: 2, location: 'Desert', nickname: 'Owls', owners: ['owner-2'] },
        { id: 1, name: 'Sunday Stars', primaryOwner: 'owner-1' },
      ],
    })).toEqual({
      league_name: 'Draft Night',
      teams: [
        { manager_name: 'Alex Smith', team_id: 1, team_name: 'Sunday Stars' },
        { manager_name: 'Blake Jones', team_id: 2, team_name: 'Desert Owls' },
      ],
    })
  })

  it('requires a non-empty current team response', () => {
    expect(parseESPNOnboardingSnapshot({ settings: { name: 'Empty' }, teams: [] })).toBeNull()
  })
})
