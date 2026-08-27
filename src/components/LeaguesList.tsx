'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LeagueCard } from '@/components/portfolio/LeagueCard'
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview'
import { Button } from '@/components/ui/Button'
import { ContentState } from '@/components/ui/PageState'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { summarizePortfolio, type PortfolioLeague } from '@/lib/portfolio'
import { loadCommissionerPortfolio } from '@/lib/portfolioClient'

interface LeaguesListProps {
  onCreateLeague: () => void
  refresh: number
}

function PortfolioSkeleton() {
  return (
    <SkeletonGroup label="Loading leagues" className="grid gap-4 lg:grid-cols-2">
      {[0, 1].map((item) => (
        <Skeleton className="h-80 bg-app-surface" key={item} />
      ))}
    </SkeletonGroup>
  )
}

export default function LeaguesList({
  onCreateLeague,
  refresh,
}: LeaguesListProps) {
  const [leagues, setLeagues] = useState<PortfolioLeague[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const fetchLeagues = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      setLeagues(await loadCommissionerPortfolio())
    } catch (err) {
      console.error('Error fetching leagues:', err)
      setError('The league portfolio could not be loaded. Check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      fetchLeagues()
    }, 0)

    return () => window.clearTimeout(loadTimer)
  }, [fetchLeagues, refresh])

  const portfolioSummary = useMemo(() => summarizePortfolio(leagues), [leagues])
  const activeLeagues = leagues.filter((league) => !league.archived_at)
  const archivedLeagues = leagues.filter((league) => league.archived_at)

  if (isLoading) return <PortfolioSkeleton />

  if (error) {
    return (
      <ContentState
        action={<Button onClick={fetchLeagues} variant="secondary">Try again</Button>}
        className="p-6 sm:p-8"
        description={error}
        title="Could not load leagues"
        tone="danger"
      />
    )
  }

  if (leagues.length === 0) {
    return (
      <ContentState
        action={<Button onClick={onCreateLeague}>Create league</Button>}
        description="Add a league and season to start tracking scores, dues, standings, and payouts."
        title="Create your first league office"
      />
    )
  }

  return (
    <div>
      <PortfolioOverview
        onCreateLeague={onCreateLeague}
        summary={portfolioSummary}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {activeLeagues.map((league) => (
          <LeagueCard key={league.id} league={league} />
        ))}
      </div>

      {archivedLeagues.length > 0 && (
        <section className="mt-8 border-t border-app-border pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-app-text">Archived leagues</h2>
              <p className="mt-1 text-sm text-app-text-muted">History stays available and can be restored from League Settings.</p>
            </div>
            <Button onClick={() => setShowArchived((visible) => !visible)} variant="secondary">
              {showArchived ? 'Hide' : `Show ${archivedLeagues.length}`}
            </Button>
          </div>
          {showArchived && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {archivedLeagues.map((league) => (
                <LeagueCard key={league.id} league={league} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
