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
    outstandingDues: [],
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

  it('keeps preseason dues collapsed until opened and links to the correct season', async () => {
    const user = userEvent.setup()
    mockLoadPortfolioLeagues.mockResolvedValue([portfolioLeague({
      latestWeek: 0, pendingMembers: 2, attentionReasons: ['2 players have dues pending'],
      outstandingDues: [
        { memberId: 'alex', managerName: 'Alex Smith', remainingCents: 10000, isPartial: false },
        { memberId: 'zoe', managerName: 'Zoe Jones', remainingCents: 2525, isPartial: true },
      ],
    })])
    render(<LeaguesList onCreateLeague={jest.fn()} />)
    const summary = await screen.findByText('2 players · $125.25 remaining')
    expect(screen.getByText('Alex Smith')).not.toBeVisible()
    expect(screen.queryByText('2 players have dues pending')).not.toBeInTheDocument()
    await user.click(summary)
    expect(screen.getByText('Alex Smith')).toBeVisible()
    expect(screen.getAllByText('Unpaid')).toHaveLength(2)
    expect(screen.getByText('$25.25')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Manage dues' })).toHaveAttribute('href', '/league/league-one/players?season=2026')
    await user.click(summary)
    expect(screen.getByText('Zoe Jones')).not.toBeVisible()
  })

  it.each(['started', 'settled', 'archived'])('hides the preseason disclosure when the league is %s', async state => {
    mockLoadPortfolioLeagues.mockResolvedValue([portfolioLeague({
      latestWeek: state === 'started' ? 1 : 0,
      archived_at: state === 'archived' ? '2026-01-01' : null,
      outstandingDues: state === 'settled' ? [] : [{ memberId: 'alex', managerName: 'Alex Smith', remainingCents: 10000, isPartial: false }],
    })])
    const user = userEvent.setup()
    render(<LeaguesList onCreateLeague={jest.fn()} />)
    if(state === 'archived') await user.click(await screen.findByRole('button', { name: 'Show 1' }))
    await screen.findByRole('link', { name: 'Open League One' })
    expect(screen.queryByText(/players? · .* remaining/)).not.toBeInTheDocument()
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
