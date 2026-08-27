import {
  getConfiguredDivisions,
  getPrizeRuleRows,
  getScoreSourceRule,
  getSeasonScheduleRule,
} from '../rules'

describe('league rule presentation', () => {
  it('normalizes configured division shapes', () => {
    expect(getConfiguredDivisions([' East ', 'West', 'East'])).toEqual([
      'East',
      'West',
    ])
    expect(getConfiguredDivisions({ divisions: ['North', 'South'] })).toEqual([
      'North',
      'South',
    ])
    expect(getConfiguredDivisions({ divisions: 'invalid' })).toEqual([])
  })

  it('orders configured prize rules and labels flexible categories', () => {
    expect(
      getPrizeRuleRows({
        custom_bonus: 10,
        first: 200,
        highest_points: 50,
        second: 100,
        third: 0,
      }),
    ).toEqual([
      { amount: 200, key: 'first', label: '1st place' },
      { amount: 100, key: 'second', label: '2nd place' },
      {
        amount: 50,
        key: 'highest_points',
        label: 'Highest season points',
      },
      { amount: 10, key: 'custom_bonus', label: 'Custom Bonus' },
    ])
  })

  it('derives regular and playoff week counts from season settings', () => {
    expect(getSeasonScheduleRule(17, 15)).toEqual({
      playoffWeeks: 3,
      playoffsStartWeek: 15,
      regularSeasonWeeks: 14,
      totalWeeks: 17,
    })
  })

  it('describes ESPN automation without exposing credentials', () => {
    expect(
      getScoreSourceRule({
        autoSyncEnabled: true,
        platformLeagueId: '123',
        platformType: 'espn',
      }),
    ).toEqual({
      automation: 'Wednesday at 2:00 AM Phoenix time',
      source: 'ESPN Fantasy Football',
    })
    expect(
      getScoreSourceRule({ autoSyncEnabled: false, platformType: 'manual' }),
    ).toEqual({
      automation:
        'Automatic sync is off; the commissioner imports scores manually',
      source: 'Manual score entry',
    })
  })
})
