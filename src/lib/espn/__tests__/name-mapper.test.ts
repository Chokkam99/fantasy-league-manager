import { ESPNNameMapper } from '@/lib/espn/name-mapper'

const espnMembers = [
  { firstName: 'Alex', id: 'owner-1', lastName: 'Smith' },
  { firstName: 'Jordan', id: 'owner-2', lastName: 'Lee' },
]
const espnTeams = [
  { id: 1, name: 'Sunday Scaries', owners: ['owner-1'] },
  { id: 2, name: 'Fourth and Long', owners: ['owner-2'] },
]
const leagueMembers = [
  { id: 'member-1', manager_name: 'Alex Smith', team_name: 'New Name' },
  { id: 'member-2', manager_name: 'Jordan Lee', team_name: 'Another Name' },
]

describe('ESPN team mapping', () => {
  it('automatically maps exact normalized owner names', () => {
    const result = ESPNNameMapper.createTeamMapping(
      espnMembers,
      espnTeams,
      leagueMembers,
    )

    expect(result.mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          db_member_id: 'member-1',
          espn_team_id: 1,
          source: 'automatic',
        }),
        expect.objectContaining({
          db_member_id: 'member-2',
          espn_team_id: 2,
          source: 'automatic',
        }),
      ]),
    )
    expect(ESPNNameMapper.validateMapping(result).isValid).toBe(true)
  })

  it('uses a saved season mapping even when names do not match', () => {
    const result = ESPNNameMapper.createTeamMapping(
      [{ firstName: 'Different', id: 'owner-1', lastName: 'Person' }],
      [espnTeams[0]],
      [leagueMembers[0]],
      { '1': 'member-1' },
    )

    expect(result.mappings[0]).toEqual(
      expect.objectContaining({
        db_member_id: 'member-1',
        espn_team_id: 1,
        source: 'saved',
      }),
    )
  })

  it('rejects duplicate assignments and exposes resolution choices', () => {
    const result = ESPNNameMapper.createTeamMapping(
      espnMembers,
      espnTeams,
      leagueMembers,
      { '1': 'member-1', '2': 'member-1' },
    )
    const snapshot = ESPNNameMapper.createSnapshot(
      result,
      espnMembers,
      espnTeams,
      leagueMembers,
    )

    expect(ESPNNameMapper.validateMapping(result).isValid).toBe(false)
    expect(snapshot.is_complete).toBe(false)
    expect(snapshot.duplicate_matches[0]).toContain('More than one ESPN team')
    expect(snapshot.teams).toHaveLength(2)
    expect(snapshot.members).toHaveLength(2)
  })

  it('leaves unknown owners unresolved for commissioner review', () => {
    const result = ESPNNameMapper.createTeamMapping(
      [{ firstName: 'Unknown', id: 'owner-1', lastName: 'Manager' }],
      [espnTeams[0]],
      leagueMembers,
    )

    expect(result.unmappedEspnTeams).toEqual([espnTeams[0]])
    expect(ESPNNameMapper.validateMapping(result).errors[0]).toContain(
      'need a league-player assignment',
    )
  })
})
