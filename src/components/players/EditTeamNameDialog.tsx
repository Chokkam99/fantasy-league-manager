'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'

interface EditTeamNameDialogProps {
  busy: boolean
  error: string | null
  managerName: string
  onClose: () => void
  onSubmit: (teamName: string) => void
  teamName: string
}

export default function EditTeamNameDialog({
  busy,
  error,
  managerName,
  onClose,
  onSubmit,
  teamName,
}: EditTeamNameDialogProps) {
  const [value, setValue] = useState(teamName)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Dialog
      busy={busy}
      closeLabel="Close team name editor"
      description={`${managerName}'s manager identity and prior seasons will not change.`}
      initialFocusRef={inputRef}
      onClose={onClose}
      open
      title="Edit team name"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(value)
        }}
      >
        <FormField htmlFor="editedTeamName" label="Team name">
          <TextInput
            id="editedTeamName"
            maxLength={80}
            onChange={(event) => setValue(event.target.value)}
            ref={inputRef}
            value={value}
          />
        </FormField>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={busy} onClick={onClose} variant="secondary">Cancel</Button>
          <Button disabled={busy || !value.trim() || value.trim() === teamName} type="submit">
            {busy ? 'Saving…' : 'Save team name'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
