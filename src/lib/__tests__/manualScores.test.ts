import {
  isMissingAtomicManualWeekSchema,
  parseAtomicManualWeekResult,
  validateManualScores,
} from '@/lib/manualScores'

describe('manual score validation', () => {
  it('recognizes only a missing atomic manual-week function', () => {
    expect(
      isMissingAtomicManualWeekSchema({
        code: 'PGRST202',
        message: 'Function not found in schema cache',
      }),
    ).toBe(true)
    expect(
      isMissingAtomicManualWeekSchema({
        code: '55P03',
        message: 'Score correction is locked',
      }),
    ).toBe(false)
  })

  it('accepts only complete atomic manual-week results', () => {
    expect(
      parseAtomicManualWeekResult({
        action: 'save_week',
        matchup_count: 6,
        score_count: 12,
        season: '2026',
        success: true,
        week: 15,
      }),
    ).toEqual({
      action: 'save_week',
      matchup_count: 6,
      score_count: 12,
      season: '2026',
      success: true,
      week: 15,
    })
    expect(
      parseAtomicManualWeekResult({
        action: 'save_week',
        matchup_count: -1,
        score_count: 12,
        season: '2026',
        success: true,
        week: 15,
      }),
    ).toBeNull()
  })

  it('accepts one finite score for every active player, including zero and negatives', () => {
    const result = validateManualScores(
      [
        { member_id: 'a', points: 0 },
        { member_id: 'b', points: -2.5 },
      ],
      ['a', 'b'],
    )

    expect(result.is_valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects partial, duplicate, and unknown player scores', () => {
    const result = validateManualScores(
      [
        { member_id: 'a', points: 10 },
        { member_id: 'a', points: 12 },
        { member_id: 'outside', points: 8 },
      ],
      ['a', 'b', 'c'],
    )

    expect(result.is_valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'A player can only have one score for the week.',
        '2 active player score(s) are missing.',
        '1 score(s) do not belong to this season.',
      ]),
    )
  })

  it('rejects malformed or non-finite values', () => {
    const result = validateManualScores(
      [
        { member_id: 'a', points: Number.NaN },
        { member_id: 'b', points: '100' },
      ],
      ['a', 'b'],
    )

    expect(result.is_valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Every score must include a player ID and numeric point total.',
        'Every point total must be a finite number.',
      ]),
    )
  })
})
