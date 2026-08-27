import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeasonAwardCards } from '@/components/prizes/SeasonAwardCards'
import { PayoutSummaryTable } from '@/components/prizes/PayoutSummaryTable'
import type { FinanceAward, FinancePayout } from '@/lib/financeClient'
import type { PrizeMember } from '@/lib/prizes'
import type { SeasonAwardView } from '@/lib/prizeViewModel'

const members: PrizeMember[] = [
  { id: 'member-one', manager_name: 'Manager One', team_name: 'Team One' },
  { id: 'member-two', manager_name: 'Manager Two', team_name: 'Team Two' },
]
const award: FinanceAward = {
  award_key: 'final:first',
  award_type: 'final',
  category_key: 'first',
  id: 'award-one',
  label: 'Champion',
  planned_amount_cents: 12000,
  week_number: null,
}
const payout: FinancePayout = {
  amount_cents: 12000,
  award_id: award.id,
  id: 'payout-one',
  league_member_id: 'member-one',
  paid_at: null,
  status: 'pending',
}
const awards: SeasonAwardView[] = [
  {
    amount: 120,
    award,
    id: award.id,
    label: award.label,
    payout,
    recipient: members[0],
    status: 'pending',
  },
]

function view(canManagePayouts: boolean) {
  return (
    <SeasonAwardCards
      awards={awards}
      busyFinanceId={null}
      canManagePayouts={canManagePayouts}
      members={members}
      onRecipientChange={jest.fn()}
      schemaReady
    />
  )
}

describe('Prize views', () => {
  it('shows public-safe recipient and payout status without mutation controls', () => {
    render(view(false))

    expect(screen.getByText('Champion')).toBeInTheDocument()
    expect(screen.getByText('$120')).toBeInTheDocument()
    expect(screen.getByText('Team One')).toBeInTheDocument()
    expect(screen.getByText('Manager One')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps season awards compact and focused on recipient assignment', async () => {
    const user = userEvent.setup()
    const onRecipientChange = jest.fn()
    render(
      <SeasonAwardCards
        awards={awards}
        busyFinanceId={null}
        canManagePayouts
        members={members}
        onRecipientChange={onRecipientChange}
        schemaReady
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Recipient for Champion' }),
      'member-two',
    )
    expect(onRecipientChange).toHaveBeenCalledWith(award, 'member-two')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('tracks the full player handout in the payout tally', async () => {
    const user = userEvent.setup()
    const onPayoutStatusChange = jest.fn()
    render(
      <PayoutSummaryTable
        busyMemberId={null}
        canManagePayouts
        onPayoutStatusChange={onPayoutStatusChange}
        summaries={[
          {
            finalAmount: 120,
            finalAwards: ['Champion'],
            member: members[0],
            payoutStatus: 'pending',
            totalAmount: 135,
            weeklyAmount: 15,
            weeklyWins: [1, 4],
          },
        ]}
        trackingReady
      />,
    )

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Paid: Team One total payout',
      }),
    )
    expect(onPayoutStatusChange).toHaveBeenCalledWith('member-one', 'paid')
  })
})
