import { render, screen } from '@testing-library/react'
import { OverviewSidebar } from '@/components/overview/OverviewSidebar'
import { StandingsPreviewCard } from '@/components/overview/StandingsPreviewCard'
import type { OverviewViewModel } from '@/lib/overview'

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
})
