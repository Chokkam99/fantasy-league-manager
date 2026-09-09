import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayerRosterSections } from '@/components/players/PlayerRosterSections'
import { PlayersOverview } from '@/components/players/PlayersOverview'
import type { PlayerDirectoryEntry } from '@/lib/players'
import type { PlayerRosterEntry } from '@/lib/playerRoster'

const currentPlayer: PlayerRosterEntry = {
  currentMemberId: 'member-one',
  currentTeamName: 'Current Team',
  division: 'East',
  duesStatus: 'partial',
  isParticipating: true,
  managerId: 'manager-one',
  managerName: 'Manager One',
  payment: {
    expected_amount_cents: 10000,
    id: 'payment-one',
    league_member_id: 'member-one',
    notes: null,
    paid_amount_cents: 5000,
    paid_at: null,
    payment_method: null,
    status: 'partial',
  },
  paymentStatus: 'pending',
  seasons: ['2026', '2025'],
  sourceMemberId: 'member-one',
  teamNames: ['Current Team', 'Old Team'],
}

const formerPlayer: PlayerDirectoryEntry = {
  currentMemberId: null,
  currentTeamName: null,
  division: null,
  isParticipating: false,
  managerId: 'manager-two',
  managerName: 'Manager Two',
  paymentStatus: null,
  seasons: ['2025'],
  sourceMemberId: 'member-two',
  teamNames: ['History Team'],
}

describe('Players roster views', () => {
  it('keeps commissioner search, dues filter, and add controls accessible', async () => {
    const user = userEvent.setup()
    const onAddPlayer = jest.fn()
    const onDuesFilterChange = jest.fn()
    const onSearchChange = jest.fn()

    render(
      <PlayersOverview
        alumniCount={1}
        collectedAmount={50}
        currentPlayerCount={1}
        duesFilter="all"
        expectedAmount={100}
        isViewOnly={false}
        onAddPlayer={onAddPlayer}
        onDuesFilterChange={onDuesFilterChange}
        onSearchChange={onSearchChange}
        paidPlayers={0}
        partialPlayers={1}
        pendingPlayers={0}
        representedSeasons={2}
        returningPlayers={1}
        search=""
        selectedSeason="2026"
      />,
    )

    expect(screen.getByText('$50.00 / $100.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add player' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search players' }), 'man')
    await user.click(screen.getByRole('button', { name: /unpaid/i }))
    expect(onAddPlayer).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenLastCalledWith('n')
    expect(onDuesFilterChange).toHaveBeenCalledWith('pending')
  })

  it('exposes roster actions only to commissioners', async () => {
    const user = userEvent.setup()
    const onActivate = jest.fn()
    const onDeactivate = jest.fn()
    const onOpenPayment = jest.fn()
    const onPaymentChange = jest.fn()
    const onEditTeam = jest.fn()
    const { rerender } = render(
      <PlayerRosterSections
        busyMemberId={null}
        currentPlayerCount={1}
        currentPlayers={[currentPlayer]}
        formerPlayers={[formerPlayer]}
        isViewOnly={false}
        onActivate={onActivate}
        onDeactivate={onDeactivate}
        onEditTeam={onEditTeam}
        onOpenPayment={onOpenPayment}
        onPaymentChange={onPaymentChange}
        search=""
        selectedSeason="2026"
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Mark Manager One paid' }),
    ).toHaveTextContent('Unpaid')
    expect(screen.getByText('Previously: Old Team')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark Manager One paid' }))
    await user.click(screen.getByRole('button', { name: 'Payment details for Manager One' }))
    await user.click(screen.getByRole('button', { name: 'Edit team name for Manager One' }))
    const remove = screen.getByRole('button', { name: 'Remove Manager One from 2026' })
    expect(remove).toHaveClass('text-app-danger')
    await user.click(remove)
    await user.click(screen.getByRole('button', { name: 'Add Manager Two to 2026' }))
    expect(onPaymentChange).toHaveBeenCalledWith(currentPlayer)
    expect(onOpenPayment).toHaveBeenCalledWith(currentPlayer)
    expect(onEditTeam).toHaveBeenCalledWith(currentPlayer)
    expect(onDeactivate).toHaveBeenCalledWith(currentPlayer)
    expect(onActivate).toHaveBeenCalledWith(formerPlayer)

    rerender(
      <PlayerRosterSections
        busyMemberId={null}
        currentPlayerCount={1}
        currentPlayers={[currentPlayer]}
        formerPlayers={[formerPlayer]}
        isViewOnly
        onActivate={onActivate}
        onDeactivate={onDeactivate}
        onEditTeam={onEditTeam}
        onOpenPayment={onOpenPayment}
        onPaymentChange={onPaymentChange}
        search=""
        selectedSeason="2026"
      />,
    )
    expect(screen.queryByRole('button', { name: /Manager One/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Dues for Manager One: Unpaid')).toHaveTextContent('Dues: Unpaid')
  })
})
