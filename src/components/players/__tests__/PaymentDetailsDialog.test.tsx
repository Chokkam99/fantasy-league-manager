import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PaymentDetailsDialog from '../PaymentDetailsDialog'

const payment = {
  expected_amount_cents: 6000,
  id: '123e4567-e89b-42d3-a456-426614174000',
  league_member_id: '223e4567-e89b-42d3-a456-426614174000',
  notes: null,
  paid_amount_cents: 0,
  paid_at: null,
  payment_method: null,
  status: 'pending' as const,
}

describe('PaymentDetailsDialog', () => {
  it('preserves an existing receipt when only editing notes while showing binary status', async () => {
    const user = userEvent.setup(); const onSubmit = jest.fn()
    render(<PaymentDetailsDialog busy={false} error={null} onClose={jest.fn()} onSubmit={onSubmit} open payment={{ ...payment, status: 'partial', paid_amount_cents: 2550 }} playerName="Alex Smith" />)
    expect(screen.getByLabelText('Status')).toHaveValue('pending')
    expect(screen.queryByRole('option', { name: 'Partial' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/Note/), 'Receipt retained')
    await user.click(screen.getByRole('button', { name: 'Save payment' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Receipt retained', paid_amount_cents: 2550, status: 'partial' }))
  })
  it('offers only paid/unpaid and records the full fee when paid', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(
      <PaymentDetailsDialog
        busy={false}
        error={null}
        onClose={jest.fn()}
        onSubmit={onSubmit}
        open
        payment={payment}
        playerName="Alex Smith"
      />,
    )

    expect(screen.queryByRole('option', { name: 'Partial' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Status'), 'paid')
    await user.type(screen.getByLabelText(/Method/), 'Zelle')
    await user.type(screen.getByLabelText(/Note/), 'First half')
    await user.click(screen.getByRole('button', { name: 'Save payment' }))

    expect(onSubmit).toHaveBeenCalledWith({
      notes: 'First half',
      paid_amount_cents: 6000,
      payment_method: 'Zelle',
      status: 'paid',
    })
  })

  it('keeps pending as zero and closes with Escape', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    const onSubmit = jest.fn()
    render(
      <PaymentDetailsDialog
        busy={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
        open
        payment={{ ...payment, notes: 'Old note' }}
        playerName="Alex Smith"
      />,
    )

    expect(screen.queryByLabelText('Amount received')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save payment' }))
    expect(onSubmit).toHaveBeenCalledWith({
      notes: 'Old note',
      paid_amount_cents: 0,
      payment_method: null,
      status: 'pending',
    })

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
