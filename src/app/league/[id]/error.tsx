'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { PageState } from '@/components/ui/PageState'

export default function LeagueError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('League route failed:', error)
  }, [error])

  return (
    <PageState
      action={<Button onClick={reset}>Try this page again</Button>}
      description="This page ran into an unexpected problem. Try opening it again. If you were saving a change, check the latest data before repeating it."
      eyebrow="Unexpected error"
      title="This page couldn’t be displayed"
      tone="danger"
    />
  )
}
