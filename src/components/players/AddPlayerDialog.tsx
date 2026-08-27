'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'

interface AddPlayerDialogProps {
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (player: { manager_name: string; team_name: string }) => void
  open: boolean
  season: string
}

export default function AddPlayerDialog({
  busy,
  error,
  onClose,
  onSubmit,
  open,
  season,
}: AddPlayerDialogProps) {
  const [managerName, setManagerName] = useState('')
  const [teamName, setTeamName] = useState('')
  const managerInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ manager_name: managerName, team_name: teamName })
  }

  return (
    <Dialog
      busy={busy}
      closeLabel="Close add player dialog"
      description={<>Add a new manager and team to the {season} roster. Dues start as unpaid.</>}
      initialFocusRef={managerInputRef}
      onClose={onClose}
      open={open}
      title="Add player"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField htmlFor="new-manager-name" label="Manager name">
            <TextInput
              autoComplete="name"
              id="new-manager-name"
              maxLength={80}
              onChange={(event) => setManagerName(event.target.value)}
              placeholder="Rithvik Chokkam"
              ref={managerInputRef}
              required
              value={managerName}
            />
          </FormField>
          <FormField htmlFor="new-team-name" label="Team name">
            <TextInput
              id="new-team-name"
              maxLength={80}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Nacua Matata"
              required
              value={teamName}
            />
          </FormField>

          {error && <Notice tone="danger">{error}</Notice>}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button disabled={busy} onClick={onClose} variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={busy || !managerName.trim() || !teamName.trim()}
              type="submit"
            >
              {busy ? 'Adding…' : `Add to ${season}`}
            </Button>
          </div>
      </form>
    </Dialog>
  )
}
