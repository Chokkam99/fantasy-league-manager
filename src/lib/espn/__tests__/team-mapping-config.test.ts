import {
  getSeasonTeamMappings,
  isCompleteTeamMappingSubmission,
  parseTeamMappingInput,
  withSeasonTeamMappings,
} from '@/lib/espn/team-mapping-config'

describe('season ESPN team mapping configuration', () => {
  it('preserves other platform settings and seasons when saving mappings', () => {
    const updated = withSeasonTeamMappings(
      {
        credentials: { espn_s2: 'secret' },
        team_mappings: { '2025': { '1': 'old-member' } },
      },
      '2026',
      { '2': 'new-member' },
    )

    expect(updated).toEqual({
      credentials: { espn_s2: 'secret' },
      team_mappings: {
        '2025': { '1': 'old-member' },
        '2026': { '2': 'new-member' },
      },
    })
  })

  it('filters malformed stored values', () => {
    expect(
      getSeasonTeamMappings(
        { team_mappings: { '2026': { '1': 'member-1', bad: 42 } } },
        '2026',
      ),
    ).toEqual({ '1': 'member-1' })
  })

  it('accepts a non-empty team-to-member mapping payload', () => {
    expect(parseTeamMappingInput({ '1': ' member-1 ', '2': 'member-2' })).toEqual({
      '1': 'member-1',
      '2': 'member-2',
    })
  })

  it('rejects empty and malformed mapping payloads', () => {
    expect(parseTeamMappingInput({})).toBeNull()
    expect(parseTeamMappingInput({ team: 'member-1' })).toBeNull()
    expect(parseTeamMappingInput({ '1': '' })).toBeNull()
  })

  it('requires exactly one unique assignment for every current ESPN team', () => {
    const snapshot = {
      assignments: [],
      duplicate_matches: [],
      is_complete: true,
      members: [],
      teams: [
        { espn_owner_name: 'One', espn_team_id: 1, espn_team_name: 'One' },
        { espn_owner_name: 'Two', espn_team_id: 2, espn_team_name: 'Two' },
      ],
      unmapped_espn_team_ids: [],
      unmapped_member_ids: [],
    }

    expect(
      isCompleteTeamMappingSubmission(snapshot, {
        '1': 'member-1',
        '2': 'member-2',
      }),
    ).toBe(true)
    expect(
      isCompleteTeamMappingSubmission(snapshot, { '1': 'member-1' }),
    ).toBe(false)
    expect(
      isCompleteTeamMappingSubmission(snapshot, {
        '1': 'member-1',
        '2': 'member-1',
      }),
    ).toBe(false)
    expect(
      isCompleteTeamMappingSubmission(snapshot, {
        '1': 'member-1',
        '2': 'member-2',
        '3': 'stale-member',
      }),
    ).toBe(false)
  })
})
