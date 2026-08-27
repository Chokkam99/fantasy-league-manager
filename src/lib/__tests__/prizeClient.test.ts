import { loadPrizeData, type PrizeDataSource } from '@/lib/prizeClient'

function source(): jest.Mocked<PrizeDataSource> {
  return {
    loadFinance: jest.fn().mockResolvedValue({
      awards: [],
      is_commissioner: false,
      payouts: [],
      schema_ready: true,
      success: true,
      summary: null,
    }),
    loadMembers: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'member-one',
          manager_name: 'Manager One',
          payment_status: 'paid',
          team_name: 'Team One',
        },
      ],
      error: null,
    }),
    loadScores: jest.fn().mockResolvedValue({
      data: [{ member_id: 'member-one', points: 123, week_number: 1 }],
      error: null,
    }),
  }
}

describe('prize data loading', () => {
  it('uses one member read, one score read, and one protected finance request', async () => {
    const dataSource = source()

    await expect(
      loadPrizeData('league-one', '2026', dataSource),
    ).resolves.toMatchObject({
      financeError: null,
      members: [{ id: 'member-one' }],
      scores: [{ week_number: 1 }],
    })
    expect(dataSource.loadMembers).toHaveBeenCalledWith('league-one', '2026')
    expect(dataSource.loadScores).toHaveBeenCalledWith('league-one', '2026')
    expect(dataSource.loadFinance).toHaveBeenCalledWith('league-one', '2026')
  })

  it('keeps finance failure non-fatal so the configured prize plan remains visible', async () => {
    const dataSource = source()
    dataSource.loadFinance.mockRejectedValue(new Error('Finance unavailable'))

    await expect(
      loadPrizeData('league-one', '2026', dataSource),
    ).resolves.toMatchObject({ finance: null, financeError: 'Finance unavailable' })
  })

  it('fails the snapshot when either score or member data is incomplete', async () => {
    const dataSource = source()
    dataSource.loadScores.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    await expect(
      loadPrizeData('league-one', '2026', dataSource),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
