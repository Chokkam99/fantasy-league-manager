import {
  loadOverviewData,
  type OverviewDataSource,
} from '@/lib/overviewClient'

function source(): jest.Mocked<OverviewDataSource> {
  return {
    loadFinance: jest.fn().mockResolvedValue({
      awards: [],
      is_commissioner: false,
      payouts: [],
      schema_ready: true,
      success: true,
      summary: null,
    }),
    loadMatchups: jest.fn().mockResolvedValue({ data: [], error: null }),
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
    loadScores: jest.fn().mockResolvedValue({ data: [], error: null }),
  }
}

describe('overview data loading', () => {
  it('uses four fixed season-scoped reads', async () => {
    const dataSource = source()

    await expect(
      loadOverviewData('league-one', '2026', dataSource),
    ).resolves.toMatchObject({
      financeError: null,
      members: [{ id: 'member-one' }],
      standingsError: null,
    })
    for (const loader of [
      dataSource.loadFinance,
      dataSource.loadMatchups,
      dataSource.loadMembers,
      dataSource.loadScores,
    ]) {
      expect(loader).toHaveBeenCalledTimes(1)
      expect(loader).toHaveBeenCalledWith('league-one', '2026')
    }
  })

  it('keeps optional finance and standings-preview failures non-fatal', async () => {
    const dataSource = source()
    dataSource.loadFinance.mockRejectedValue(new Error('Finance unavailable'))
    dataSource.loadMatchups.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Standings unavailable' },
    })

    await expect(
      loadOverviewData('league-one', '2026', dataSource),
    ).resolves.toMatchObject({
      finance: null,
      financeError: 'Finance unavailable',
      matchups: [],
      standingsError: 'Standings unavailable',
    })
  })

  it('fails closed when the roster or scores needed for core metrics are incomplete', async () => {
    const dataSource = source()
    dataSource.loadMembers.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    await expect(
      loadOverviewData('league-one', '2026', dataSource),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
