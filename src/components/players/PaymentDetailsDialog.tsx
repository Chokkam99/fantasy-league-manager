'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, Select, Textarea, TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'
import type { DuesStatus } from '@/lib/finance'
import type { FinancePayment } from '@/lib/financeClient'

interface PaymentDetailsDialogProps {
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (details: {
    notes: string | null
    paid_amount_cents: number | null
    payment_method: string | null
    status: DuesStatus
  }) => void
  open: boolean
  payment: FinancePayment
  playerName: string
}

function dollars(cents: number) {
  return (cents / 100).toFixed(2)
}

export default function PaymentDetailsDialog({
  busy,
  error,
  onClose,
  onSubmit,
  open,
  payment,
  playerName,
}: PaymentDetailsDialogProps) {
  const [status, setStatus] = useState<DuesStatus>(payment.status)
  const [amount, setAmount] = useState(dollars(payment.paid_amount_cents))
  const [method, setMethod] = useState(payment.payment_method || '')
  const [notes, setNotes] = useState(payment.notes || '')
  const statusRef = useRef<HTMLSelectElement>(null)

  const expected = dollars(payment.expected_amount_cents)
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const parsedDollars = Number(amount)
    const paidAmountCents =
      status === 'pending'
        ? 0
        : Number.isFinite(parsedDollars)
          ? Math.round(parsedDollars * 100)
          : null
    onSubmit({
      notes: notes.trim() || null,
      paid_amount_cents: paidAmountCents,
      payment_method: method.trim() || null,
      status,
    })
  }

  return (
    <Dialog
      busy={busy}
      className="max-w-lg"
      closeLabel="Close payment details"
      description={<>{playerName} owes ${expected} for this season. Use this only for a partial payment or an optional note.</>}
      initialFocusRef={statusRef}
      onClose={onClose}
      open={open}
      title="Payment details"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="payment-status" label="Status">
              <Select
                id="payment-status"
                onChange={(event) => {
                  const nextStatus = event.target.value as DuesStatus
                  setStatus(nextStatus)
                  if (nextStatus === 'pending') setAmount('0.00')
                  if (nextStatus === 'paid') setAmount(expected)
                }}
                ref={statusRef}
                value={status}
              >
                <option value="pending">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </Select>
            </FormField>
            <FormField htmlFor="payment-amount" label="Amount received">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted">$</span>
                <TextInput
                  className="pl-7"
                  disabled={status === 'pending'}
                  id="payment-amount"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setAmount(event.target.value)}
                  required={status !== 'pending'}
                  step="0.01"
                  type="number"
                  value={amount}
                />
              </div>
            </FormField>
          </div>
          <FormField htmlFor="payment-method" label="Method" optional>
            <TextInput
              id="payment-method"
              maxLength={40}
              onChange={(event) => setMethod(event.target.value)}
              placeholder="Zelle, cash, Venmo…"
              value={method}
            />
          </FormField>
          <FormField htmlFor="payment-notes" label="Note" optional>
            <Textarea
              id="payment-notes"
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="First half received"
              value={notes}
            />
          </FormField>

          {error && <Notice tone="danger">{error}</Notice>}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button disabled={busy} onClick={onClose} variant="secondary">Cancel</Button>
            <Button disabled={busy} type="submit">{busy ? 'Saving…' : 'Save payment'}</Button>
          </div>
      </form>
    </Dialog>
  )
}
