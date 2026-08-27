import {
  createReturningMemberPayloads,
  createRolloverSeasonPayload,
  getNextSeason,
  isMissingAtomicRolloverSchema,
  parseAtomicSeasonRolloverResult,
  validateSeasonRolloverRequest,
} from '../seasonRollover'

const MEMBER_ONE = '123e4567-e89b-12d3-a456-426614174000'
const MEMBER_TWO = '123e4567-e89b-12d3-a456-426614174001'

const configuration = {
  divisions: ['North', 'South'],
  draft_food_cost: 125,
  fee_amount: 75,
  playoff_spots: 8,
  playoff_start_week: 14,
  prize_structure: { first: 400, second: 200, toilet_bowl: 25 },
  total_weeks: 17,
  weekly_prize_amount: 10,
}

describe('season rollover', () => {
  it('derives the next season without using the calendar year', () => {
    expect(getNextSeason('2025')).toBe('2026')
    expect(getNextSeason('season-2025')).toBeNull()
  })

  it('recognizes only a missing atomic-rollover schema as fallback-compatible', () => {
    expect(
      isMissingAtomicRolloverSchema({
        code: 'PGRST202',
        message: 'Function not found',
      }),
    ).toBe(true)
    expect(
      isMissingAtomicRolloverSchema({
        code: '23505',
        message: 'Target season exists',
      }),
    ).toBe(false)
  })

  it('accepts only a complete atomic rollover result', () => {
    expect(
      parseAtomicSeasonRolloverResult({
        copied_players: 12,
        source_season: '2025',
        success: true,
        target_season: '2026',
      }),
    ).toEqual({
      copied_players: 12,
      source_season: '2025',
      success: true,
      target_season: '2026',
    })
    expect(
      parseAtomicSeasonRolloverResult({
        copied_players: -1,
        source_season: '2025',
        success: true,
        target_season: '2026',
      }),
    ).toBeNull()
  })

  it('normalizes independent season settings and returning teams', () => {
    expect(
      validateSeasonRolloverRequest(
        {
          configuration: {
            ...configuration,
            divisions: [' North ', 'South'],
          },
          confirmed: true,
          members: [
            {
              division: 'North',
              manager_name: 'Alex',
              source_member_id: ` ${MEMBER_ONE} `,
              team_name: ' New Team Name ',
            },
          ],
          source_season: '2025',
          target_season: '2026',
        },
        '2025',
      ),
    ).toEqual({
      is_valid: true,
      value: {
        configuration,
        confirmed: true,
        members: [
          {
            division: 'North',
            manager_name: 'Alex',
            source_member_id: MEMBER_ONE,
            team_name: 'New Team Name',
          },
        ],
        source_season: '2025',
        target_season: '2026',
      },
    })
  })

  it('rejects invalid schedule, money, groups, and player assignments', () => {
    const result = validateSeasonRolloverRequest(
      {
        configuration: {
          ...configuration,
          divisions: ['Same', 'same'],
          fee_amount: -1,
          playoff_spots: 0,
          playoff_start_week: 18,
        },
        confirmed: true,
        members: [
          {
            division: 'Missing',
            manager_name: 'Alex',
            source_member_id: MEMBER_ONE,
            team_name: '',
          },
        ],
        source_season: '2025',
        target_season: '2026',
      },
      '2025',
    )

    expect(result.is_valid).toBe(false)
    if (!result.is_valid) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Playoffs must start within the configured season weeks.',
          'Playoff spots must be between 2 and 64.',
          'Entry fee must be between $0 and $1,000,000.',
          'Group names must be unique.',
          'Every returning player needs a team name of 80 characters or fewer.',
          'Every player group must match a configured group.',
        ]),
      )
    }
  })

  it('rejects skipped years, stale sources, duplicate players, and missing confirmation', () => {
    const result = validateSeasonRolloverRequest(
      {
        configuration,
        confirmed: false,
        members: [
          {
            division: null,
            manager_name: 'Alex',
            source_member_id: MEMBER_ONE,
            team_name: 'A',
          },
          {
            division: null,
            manager_name: 'Alex',
            source_member_id: MEMBER_ONE,
            team_name: 'B',
          },
        ],
        source_season: '2024',
        target_season: '2027',
      },
      '2025',
    )

    expect(result.is_valid).toBe(false)
    if (!result.is_valid) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'A new season can only start from the league active season.',
          'The next season must be 2026.',
          'Confirm that the new season should become active.',
          'Each returning player can only be selected once.',
        ]),
      )
    }
  })

  it('persists the configured season values and clears outcomes', () => {
    expect(
      createRolloverSeasonPayload('league-one', '2026', configuration),
    ).toEqual({
      divisions: { divisions: ['North', 'South'] },
      draft_food_cost: 125,
      fee_amount: 75,
      final_winners: null,
      is_active: true,
      league_id: 'league-one',
      playoff_spots: 8,
      playoff_start_week: 14,
      prize_structure: { first: 400, second: 200, toilet_bowl: 25 },
      season: '2026',
      total_weeks: 17,
      weekly_prize_amount: 10,
    })
  })

  it('uses the configured team and group while resetting payments', () => {
    expect(
      createReturningMemberPayloads(
        'league-one',
        '2026',
        [
          {
            division: 'Old group',
            id: MEMBER_ONE,
            manager_id: '223e4567-e89b-42d3-a456-426614174000',
            manager_name: 'Alex',
            team_name: 'Old Team',
          },
          {
            division: null,
            id: MEMBER_TWO,
            manager_name: 'Blake',
            team_name: 'B Team',
          },
        ],
        [
          {
            division: 'North',
            manager_name: 'Ignored client value',
            source_member_id: MEMBER_ONE,
            team_name: 'Brand New Team',
          },
        ],
      ),
    ).toEqual([
      {
        division: 'North',
        is_active: true,
        league_id: 'league-one',
        manager_id: '223e4567-e89b-42d3-a456-426614174000',
        manager_name: 'Ignored client value',
        payment_status: 'pending',
        season: '2026',
        team_name: 'Brand New Team',
      },
    ])
  })

  it('creates brand-new managers as part of season setup', () => {
    expect(
      createReturningMemberPayloads('league-one', '2026', [], [
        {
          division: null,
          manager_name: 'Casey',
          source_member_id: null,
          team_name: 'Expansion Team',
        },
      ]),
    ).toEqual([
      {
        division: null,
        is_active: true,
        league_id: 'league-one',
        manager_name: 'Casey',
        payment_status: 'pending',
        season: '2026',
        team_name: 'Expansion Team',
      },
    ])
  })
})
