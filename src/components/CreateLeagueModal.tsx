'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'

interface CreateLeagueModalProps {
  isOpen: boolean
  onClose: () => void
  onLeagueCreated: () => void
}

export default function CreateLeagueModal({ isOpen, onClose, onLeagueCreated }: CreateLeagueModalProps) {
  const [leagueName, setLeagueName] = useState('')
  const [season, setSeason] = useState(() => new Date().getFullYear().toString())
  const [feeAmount, setFeeAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const normalizedName = leagueName.trim()
      const normalizedSeason = season.trim()
      const parsedFeeAmount = Number(feeAmount)

      if (!normalizedName || !/^\d{4}$/.test(normalizedSeason)) {
        throw new Error('Enter a league name and a four-digit season.')
      }

      if (!Number.isFinite(parsedFeeAmount) || parsedFeeAmount < 0) {
        throw new Error('League fee must be zero or greater.')
      }

      const response = await fetch('/api/leagues', {
        body: JSON.stringify({
          fee_amount: parsedFeeAmount,
          name: normalizedName,
          season: normalizedSeason,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'The league could not be created.')
      }

      setLeagueName('')
      setSeason(new Date().getFullYear().toString())
      setFeeAmount('')
      onLeagueCreated()
      onClose()
    } catch (err) {
      console.error('League creation failed:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create league. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      busy={isLoading}
      closeLabel="Close create league dialog"
      description="Start with the current season and entry fee. Players and scoring can be added next."
      initialFocusRef={nameRef}
      onClose={onClose}
      open={isOpen}
      title="Create a league"
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField htmlFor="leagueName" label="League name">
            <TextInput
              type="text"
              id="leagueName"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              placeholder="Example: Gridiron Gurus"
              ref={nameRef}
              required
            />
          </FormField>

          <FormField htmlFor="season" label="Season">
            <TextInput
              type="text"
              id="season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="Example: 2026"
              inputMode="numeric"
              pattern="\d{4}"
              required
            />
          </FormField>

          <FormField htmlFor="feeAmount" label="Entry fee per player">
            <TextInput
              type="number"
              id="feeAmount"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </FormField>

          {error && <Notice tone="danger">{error}</Notice>}

          <div className="grid grid-cols-2 gap-3 pt-3">
            <Button disabled={isLoading} onClick={onClose} variant="secondary">
              Cancel
            </Button>
            <Button disabled={isLoading} type="submit">
              {isLoading ? 'Creating…' : 'Create league'}
            </Button>
          </div>
        </form>
    </Dialog>
  )
}
