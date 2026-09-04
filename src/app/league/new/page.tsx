'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NewLeagueSetup from '@/components/NewLeagueSetup'
import { Button } from '@/components/ui/Button'
import { ContentState } from '@/components/ui/PageState'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { checkAdminAuth } from '@/lib/adminAuth'

export default function NewLeaguePage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    void checkAdminAuth().then((authorized) => {
      if (active) setIsAdmin(authorized)
    })
    return () => { active = false }
  }, [])

  if (isAdmin === null) {
    return (
      <SkeletonGroup className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6" label="Checking commissioner access">
        <Skeleton className="h-96 bg-app-surface" />
      </SkeletonGroup>
    )
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-10 sm:px-6">
        <ContentState
          action={<Button onClick={() => router.push('/')} variant="secondary">Back to home</Button>}
          description="Sign in from the home page before creating a league."
          title="Commissioner sign-in required"
        />
      </main>
    )
  }

  return <NewLeagueSetup />
}
