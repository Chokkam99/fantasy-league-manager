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
  it('captures the rare partial-payment details in cents', async () => {
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

    await user.selectOptions(screen.getByLabelText('Status'), 'partial')
    await user.clear(screen.getByLabelText('Amount received'))
    await user.type(screen.getByLabelText('Amount received'), '25.50')
    await user.type(screen.getByLabelText(/Method/), 'Zelle')
    await user.type(screen.getByLabelText(/Note/), 'First half')
    await user.click(screen.getByRole('button', { name: 'Save payment' }))

    expect(onSubmit).toHaveBeenCalledWith({
      notes: 'First half',
      paid_amount_cents: 2550,
      payment_method: 'Zelle',
      status: 'partial',
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

    expect(screen.getByLabelText('Amount received')).toBeDisabled()
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
