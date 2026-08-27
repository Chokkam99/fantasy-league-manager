import {
  findLatestCompletedWeek,
  getCompletedWeekCandidates,
  getScheduledImportTargets,
} from '@/lib/espn/week-selection'

describe('completed ESPN week selection', () => {
  it('checks the current ESPN period and the prior period', () => {
    expect(getCompletedWeekCandidates(8)).toEqual([8, 7])
    expect(getCompletedWeekCandidates(1)).toEqual([1])
  })

  it('respects the configured season week limit', () => {
    expect(getCompletedWeekCandidates(18, 17)).toEqual([17, 16])
  })

  it('uses the current period when ESPN marks it complete', async () => {
    const loadWeek = jest.fn(async (week: number) => ({
      week,
      is_complete: true,
    }))

    await expect(findLatestCompletedWeek(7, loadWeek)).resolves.toBe(7)
    expect(loadWeek).toHaveBeenCalledTimes(1)
  })

  it('falls back to the prior period when the current one is incomplete', async () => {
    const loadWeek = jest.fn(async (week: number) => ({
      week,
      is_complete: week === 6,
    }))

    await expect(findLatestCompletedWeek(7, loadWeek)).resolves.toBe(6)
  })

  it('continues when the upcoming ESPN period has no matchup data', async () => {
    const loadWeek = jest.fn(async (week: number) => {
      if (week === 8) throw new Error('No matchups found')
      return { week, is_complete: true }
    })

    await expect(findLatestCompletedWeek(8, loadWeek)).resolves.toBe(7)
  })

  it('returns null when checked periods are not complete', async () => {
    await expect(
      findLatestCompletedWeek(4, async (week) => ({
        week,
        is_complete: false,
      })),
    ).resolves.toBeNull()
  })

  it('surfaces an outage when neither period can be checked', async () => {
    await expect(
      findLatestCompletedWeek(4, async () => {
        throw new Error('ESPN unavailable')
      }),
    ).rejects.toThrow('ESPN unavailable')
  })

  it('rechecks exactly one prior week before the primary import', () => {
    expect(getScheduledImportTargets(8)).toEqual([
      {
        purpose: 'correction',
        trigger_mode: 'scheduled_correction',
        week: 7,
      },
      { purpose: 'primary', trigger_mode: 'scheduled', week: 8 },
    ])
  })

  it('does not look before week one or accept invalid completed weeks', () => {
    expect(getScheduledImportTargets(1)).toEqual([
      { purpose: 'primary', trigger_mode: 'scheduled', week: 1 },
    ])
    expect(getScheduledImportTargets(0)).toEqual([])
    expect(getScheduledImportTargets(2.5)).toEqual([])
  })
})
