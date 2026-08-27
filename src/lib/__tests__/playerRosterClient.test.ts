import {
  loadPlayerRoster,
  type PlayerRosterDataSource,
} from '@/lib/playerRosterClient'

function source(): jest.Mocked<PlayerRosterDataSource> {
  return {
    loadCanonicalMemberships: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'member-one',
          is_active: true,
          manager_id: 'manager-one',
          manager_name: 'Manager One',
          payment_status: 'pending',
          season: '2026',
          team_name: 'Team One',
        },
      ],
      error: null,
    }),
    loadFinance: jest.fn().mockResolvedValue({
      awards: [],
      is_commissioner: true,
      payouts: [],
      schema_ready: false,
      success: true,
      summary: null,
    }),
    loadLegacyMemberships: jest.fn(),
  }
}

describe('player roster loading', () => {
  it('uses one membership read and one finance request', async () => {
    const dataSource = source()

    await expect(
      loadPlayerRoster('league-one', '2026', dataSource),
    ).resolves.toMatchObject({ financeError: null, memberships: [{ id: 'member-one' }] })
    expect(dataSource.loadCanonicalMemberships).toHaveBeenCalledWith('league-one')
    expect(dataSource.loadFinance).toHaveBeenCalledWith('league-one', '2026')
    expect(dataSource.loadLegacyMemberships).not.toHaveBeenCalled()
  })

  it('adds only the exact manager-id compatibility read when migration 003 is pending', async () => {
    const dataSource = source()
    dataSource.loadCanonicalMemberships.mockResolvedValue({
      data: null,
      error: { code: '42703', message: 'column manager_id does not exist' },
    })
    dataSource.loadLegacyMemberships.mockResolvedValue({ data: [], error: null })

    await expect(
      loadPlayerRoster('league-one', '2026', dataSource),
    ).resolves.toMatchObject({ memberships: [] })
    expect(dataSource.loadLegacyMemberships).toHaveBeenCalledTimes(1)
  })

  it('keeps finance failure non-fatal but exposes membership failure', async () => {
    const financeFailure = source()
    financeFailure.loadFinance.mockRejectedValue(new Error('Finance unavailable'))
    await expect(
      loadPlayerRoster('league-one', '2026', financeFailure),
    ).resolves.toMatchObject({ finance: null, financeError: 'Finance unavailable' })

    const memberFailure = source()
    memberFailure.loadCanonicalMemberships.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })
    await expect(
      loadPlayerRoster('league-one', '2026', memberFailure),
    ).rejects.toMatchObject({ code: '42501' })
    expect(memberFailure.loadLegacyMemberships).not.toHaveBeenCalled()
  })
})
