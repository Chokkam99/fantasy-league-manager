'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
import { useLeagueShell } from '@/components/league/LeagueShellContext'
import SeasonSetupForm from '@/components/league/SeasonRolloverDialog'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'

interface SeasonSetupPageProps {
  params: Promise<{ id: string }>
}

export default function SeasonSetupPage({ params }: SeasonSetupPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const {
    isLeagueLoading,
    isViewOnly,
    league,
    leagueLoadError,
    reloadLeague,
  } = useLeagueShell()

  if (isLeagueLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <SkeletonGroup label="Loading season setup">
          <Skeleton className="h-24 bg-app-surface" />
          <Skeleton className="mt-6 h-[40rem] bg-app-surface" />
        </SkeletonGroup>
      </main>
    )
  }

  if (!league) {
    return <LeagueUnavailable error={leagueLoadError} onRetry={reloadLeague} />
  }

  const overviewUrl = `/league/${id}?season=${league.current_season}`

  if (isViewOnly) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center sm:px-6">
        <div className="rounded-[var(--app-radius-lg)] border border-app-border bg-app-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-app-text">Season setup is unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-app-text-muted">
            Only the league manager can create and activate a new season.
          </p>
          <Button className="mt-6" onClick={() => router.push(overviewUrl)} variant="secondary">
            Back to league
          </Button>
        </div>
      </main>
    )
  }

  return (
    <SeasonSetupForm
      leagueId={id}
      onCancel={() => router.push(overviewUrl)}
      onStarted={async (season) => {
        await reloadLeague()
        router.replace(`/league/${id}?season=${season}`)
      }}
    />
  )
}
