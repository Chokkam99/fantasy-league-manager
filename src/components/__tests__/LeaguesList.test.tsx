import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeaguesList from '@/components/LeaguesList'
import type { PortfolioLeague } from '@/lib/portfolio'

const mockLoadPortfolioLeagues = jest.fn()

jest.mock('@/lib/portfolioClient', () => ({
  loadCommissionerPortfolio: () => mockLoadPortfolioLeagues(),
}))

function portfolioLeague(
  overrides: Partial<PortfolioLeague> = {},
): PortfolioLeague {
  return {
    archived_at: null,
    attentionReasons: [],
    auto_sync_enabled: false,
    collectedAmount: 100,
    created_at: null,
    current_season: '2026',
    expectedAmount: 200,
    feeAmount: 100,
    id: 'league-one',
    last_sync_at: null,
    last_sync_error: null,
    latestWeek: 3,
    name: 'League One',
    paidMembers: 1,
    pendingMembers: 1,
    platform_league_id: null,
    platform_type: 'manual',
    sync_status: 'active',
    totalMembers: 2,
    totalWeeks: 17,
    updated_at: null,
    ...overrides,
  }
}

describe('LeaguesList', () => {
  beforeEach(() => {
    mockLoadPortfolioLeagues.mockReset()
  })

  it('renders the batched portfolio model and keeps archived history collapsed', async () => {
    const user = userEvent.setup()
    mockLoadPortfolioLeagues.mockResolvedValue([
      portfolioLeague({ attentionReasons: ['1 player has dues pending'] }),
      portfolioLeague({
        archived_at: '2026-08-25T00:00:00.000Z',
        id: 'league-archived',
        name: 'Archived League',
      }),
    ])

    render(<LeaguesList onCreateLeague={jest.fn()} />)

    expect(
      await screen.findByRole('link', { name: 'Open League One' }),
    ).toHaveAttribute('href', '/league/league-one?season=2026')
    expect(mockLoadPortfolioLeagues).toHaveBeenCalledTimes(1)

    const summary = screen.getByRole('region', { name: 'Portfolio summary' })
    expect(within(summary).getByText('1', { selector: 'p' })).toBeInTheDocument()
    expect(within(summary).getByText('2')).toBeInTheDocument()
    expect(within(summary).getByText('$100')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Open Archived League' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show 1' }))
    expect(
      screen.getByRole('link', { name: 'Open Archived League' }),
    ).toBeInTheDocument()
  })
})
