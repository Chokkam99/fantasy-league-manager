import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { Toast } from '@/components/ui/Toast'

function DialogHarness({ busy = false }: { busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">Open editor</button>
      <Dialog
        busy={busy}
        description="Edit one value without leaving the page."
        initialFocusRef={inputRef}
        onClose={() => setOpen(false)}
        open={open}
        title="Edit value"
      >
        <FormField htmlFor="value" label="Value">
          <TextInput id="value" ref={inputRef} />
        </FormField>
        <Button className="mt-4">Save</Button>
      </Dialog>
    </>
  )
}

describe('shared UI foundations', () => {
  it('traps dialog focus, closes with Escape, restores focus, and unlocks scrolling', () => {
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Open editor' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Edit value' })
    const input = screen.getByLabelText('Value')
    const close = screen.getByRole('button', { name: 'Close dialog' })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(input).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    save.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()
    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(save).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps a busy dialog open and disables its close control', () => {
    render(<DialogHarness busy />)
    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  })

  it('assigns semantic roles to persistent feedback and loading groups', () => {
    render(
      <>
        <Notice tone="danger">Could not save</Notice>
        <Notice tone="success">Saved</Notice>
        <SkeletonGroup label="Loading cards">
          <Skeleton className="h-10" />
        </SkeletonGroup>
      </>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(screen.getByLabelText('Loading cards')).toHaveAttribute('aria-busy', 'true')
  })

  it('announces, dismisses, and automatically expires a toast', () => {
    jest.useFakeTimers()
    const onDismiss = jest.fn()
    render(<Toast duration={1000} message="Player saved" onDismiss={onDismiss} />)

    expect(screen.getByRole('status')).toHaveTextContent('Player saved')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1000)
    expect(onDismiss).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })
})
