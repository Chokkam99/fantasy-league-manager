import type { WeekImportData } from '@/lib/espn/types'
import { validateWeekImport } from '@/lib/espn/validation'

const memberIds = ['a', 'b', 'c', 'd']

function completeWeek(overrides: Partial<WeekImportData> = {}): WeekImportData {
  return {
    is_complete: true,
    matchups: [
      { team1_member_id: 'a', team2_member_id: 'b' },
      { team1_member_id: 'c', team2_member_id: 'd' },
    ],
    scores: memberIds.map((memberId, index) => ({
      member_id: memberId,
      points: 100 + index,
      team_name: `Team ${memberId.toUpperCase()}`,
    })),
    week: 4,
    ...overrides,
  }
}

describe('ESPN week import validation', () => {
  it('allows a complete, fully mapped week', () => {
    const result = validateWeekImport(completeWeek(), memberIds, 4)

    expect(result.is_valid).toBe(true)
    expect(result.can_import).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('previews an incomplete week but prevents import', () => {
    const result = validateWeekImport(
      completeWeek({ is_complete: false }),
      memberIds,
      4,
    )

    expect(result.is_valid).toBe(true)
    expect(result.can_import).toBe(false)
    expect(result.warnings).toContain('ESPN still marks this week as in progress.')
  })

  it('rejects missing and duplicate team data', () => {
    const result = validateWeekImport(
      completeWeek({
        matchups: [{ team1_member_id: 'a', team2_member_id: 'a' }],
        scores: [
          { member_id: 'a', points: 100, team_name: 'A' },
          { member_id: 'a', points: 99, team_name: 'A' },
        ],
      }),
      memberIds,
      4,
    )

    expect(result.can_import).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'The preview contains duplicate team scores.',
        'A team appears in more than one matchup.',
      ]),
    )
  })

  it('allows exactly one bye for an odd team count', () => {
    const oddMembers = ['a', 'b', 'c']
    const result = validateWeekImport(
      completeWeek({
        matchups: [{ team1_member_id: 'a', team2_member_id: 'b' }],
        scores: oddMembers.map((memberId) => ({
          member_id: memberId,
          points: 100,
          team_name: memberId,
        })),
      }),
      oddMembers,
      4,
    )

    expect(result.can_import).toBe(true)
    expect(result.warnings).toContain('One active team has a bye this week.')
  })
})
