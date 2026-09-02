import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeagueHistoryTable } from '@/components/overview/LeagueHistoryTable'
import { OverviewSidebar } from '@/components/overview/OverviewSidebar'
import { StandingsPreviewCard } from '@/components/overview/StandingsPreviewCard'
import { loadLeagueHistory } from '@/lib/leagueHistoryClient'
import type { OverviewViewModel } from '@/lib/overview'

jest.mock('@/lib/leagueHistoryClient', () => ({
  loadLeagueHistory: jest.fn(),
}))

const mockedLoadLeagueHistory = jest.mocked(loadLeagueHistory)

const overview: OverviewViewModel = {
  collected: 140,
  draftCost: 20,
  expected: 300,
  feeAmount: 100,
  finalPrizeTotal: 100,
  latestWeek: 1,
  latestWeeklyScore: 120,
  latestWeeklyWinners: ['Team One'],
  outstanding: 160,
  paidMembers: 1,
  partialMembers: 1,
  pendingMembers: 1,
  plannedOutflow: 290,
  seasonProgress: 5.88,
  standings: [],
  totalMembers: 3,
  unallocatedPrizes: 10,
  weeklyPrizeTotal: 170,
}

describe('Overview views', () => {
  beforeEach(() => {
    mockedLoadLeagueHistory.mockReset()
  })

  it('keeps commissioner attention out of the shared-player sidebar', () => {
    const props = {
      attentionItems: [{ href: '/players', label: '2 players need attention' }],
      historyHref: '/players',
      overview,
      playoffSpots: 2,
      playoffStartWeek: 15,
      rulesHref: '/rules',
      standingsHref: '/standings',
    }
    const { rerender } = render(<OverviewSidebar {...props} isViewOnly />)

    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument()
    expect(screen.getByText('League snapshot')).toBeInTheDocument()

    rerender(<OverviewSidebar {...props} isViewOnly={false} />)
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /2 players need attention/ })).toHaveAttribute('href', '/players')
  })

  it('shows an isolated standings error without hiding the rest of Overview', () => {
    render(
      <StandingsPreviewCard
        loadError="Standings unavailable"
        standings={[]}
        standingsHref="/standings"
      />,
    )

    expect(screen.getByText('Standings preview unavailable')).toBeInTheDocument()
    expect(screen.getByText('Standings unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Full standings/ })).toHaveAttribute('href', '/standings')
  })

  it('keeps playoff teams in a collapsed disclosure for each season', async () => {
    mockedLoadLeagueHistory.mockResolvedValue({
      matchups: [],
      members: [
        {
          division: null,
          id: 'one',
          manager_name: 'Manager One',
          season: '2025',
          team_name: 'Team One',
        },
        {
          division: null,
          id: 'two',
          manager_name: 'Manager Two',
          season: '2025',
          team_name: 'Team Two',
        },
      ],
      scores: [],
      seasons: [
        {
          divisions: [],
          final_winners: { first: 'one', second: 'two' },
          playoff_spots: 2,
          playoff_start_week: 15,
          season: '2025',
          total_weeks: 17,
        },
      ],
    })
    const user = userEvent.setup()

    render(<LeagueHistoryTable leagueId="league-one" selectedSeason="2025" />)

    const label = await screen.findByText('Playoff teams')
    const details = label.closest('details')

    expect(details).not.toHaveAttribute('open')
    expect(screen.queryByRole('columnheader', { name: 'Playoff field' })).not.toBeInTheDocument()

    await user.click(label)

    expect(details).toHaveAttribute('open')
    expect(screen.getByRole('list', { name: '2025 playoff teams' })).toBeInTheDocument()
  })
})
