'use client'

import Link from 'next/link'
import { useState, useEffect, use, useCallback } from 'react'
import WeeklyScores from '@/components/WeeklyScores'
import PlatformImport from '@/components/PlatformImport'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
import { useLeagueShell } from '@/components/league/LeagueShellContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Notice } from '@/components/ui/Notice'
import { PageSkeleton, PageState } from '@/components/ui/PageState'
import { Toast } from '@/components/ui/Toast'
import {
  loadScoresPageData,
  type ScoreRosterMember,
} from '@/lib/scoresClient'

interface WeeklyScoresPageProps {
  params: Promise<{
    id: string
  }>
}

export default function WeeklyScoresPage({ params }: WeeklyScoresPageProps) {
  const resolvedParams = use(params)
  const {
    isLeagueLoading,
    isViewOnly,
    league,
    leagueLoadError,
    reloadLeague,
    selectedSeason,
    shareToken,
  } = useLeagueShell()
  const [members, setMembers] = useState<ScoreRosterMember[]>([])
  const [latestRecordedWeek, setLatestRecordedWeek] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [notice, setNotice] = useState<{
    kind: 'error' | 'success'
    message: string
  } | null>(null)

  const fetchLeagueData = useCallback(async () => {
    if (!selectedSeason) return

    try {
      setIsLoading(true)
      setLoadError(null)
      const snapshot = await loadScoresPageData(
        resolvedParams.id,
        selectedSeason,
      )
      setMembers(snapshot.members)
      setLatestRecordedWeek(snapshot.latestRecordedWeek)
    } catch (err) {
      console.error('Error fetching league data:', err)
      setMembers([])
      setLoadError('The active players for this season could not be loaded.')
    } finally {
      setIsLoading(false)
    }
  }, [resolvedParams.id, selectedSeason])

  const clearAllScores = async () => {
    setIsClearing(true)
    setNotice(null)

    try {
      const response = await fetch(
        `/api/leagues/${resolvedParams.id}/scores/manual`,
        {
          body: JSON.stringify({
            action: 'clear_season',
            season: selectedSeason,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const payload = (await response.json()) as {
        error?: string
        message?: string
        success: boolean
      }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Season scores could not be cleared.')
      }

      setNotice({
        kind: 'success',
        message: payload.message || `${selectedSeason} season scores cleared.`,
      })
      window.dispatchEvent(new CustomEvent('league-scores-imported'))
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Season scores could not be cleared.',
      })
    } finally {
      setIsClearing(false)
      setShowClearConfirm(false)
    }
  }

  useEffect(() => {
    fetchLeagueData()
  }, [fetchLeagueData])

  if (isLeagueLoading || isLoading) {
    return <PageSkeleton label="Loading scores" />
  }

  if (!league) {
    return <LeagueUnavailable error={leagueLoadError} onRetry={reloadLeague} />
  }

  if (loadError) {
    return (
      <PageState
        action={<Button onClick={fetchLeagueData}>Try again</Button>}
        description="Scores are hidden because the season roster could not be loaded safely. No score data has been changed."
        eyebrow={`${selectedSeason} season`}
        title="Scores couldn’t be loaded"
        tone="danger"
      />
    )
  }

  if (members.length === 0) {
    const query = new URLSearchParams({ season: selectedSeason })
    if (shareToken) query.set('share', shareToken)

    return (
      <PageState
        action={!isViewOnly ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--app-radius-sm)] bg-app-brand px-4 text-sm font-semibold text-white"
            href={`/league/${resolvedParams.id}/players?${query.toString()}`}
          >
            Add season players
          </Link>
        ) : undefined}
        description={
          isViewOnly
            ? 'The commissioner has not published a roster for this season yet.'
            : 'Add the active season roster before importing or entering weekly scores.'
        }
        eyebrow={`${selectedSeason} season`}
        title="No players in this season"
      />
    )
  }

  return (
    <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">
          {selectedSeason} season
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-app-text sm:text-3xl">
          Weekly scores
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted sm:text-base">
          Review each week&apos;s high score, full ranking, and head-to-head results.
        </p>
      </div>

      {notice?.kind === 'error' && <Notice className="mb-4" tone="danger">{notice.message}</Notice>}
      <Toast
        message={notice?.kind === 'success' ? notice.message : null}
        onDismiss={() => setNotice(null)}
      />

      {!isViewOnly && selectedSeason === league.current_season && (
        <PlatformImport leagueId={resolvedParams.id} season={selectedSeason} />
      )}
      {!isViewOnly && selectedSeason !== league.current_season && (
        <Card className="mb-6 border-app-info/20 bg-app-info-soft p-4 sm:p-5">
          <h2 className="font-semibold text-app-text">Score imports unavailable</h2>
          <p className="mt-1 text-sm leading-6 text-app-text-muted">
            ESPN imports are limited to the active {league.current_season} season so saved historical results cannot be overwritten. You can still review or manually correct {selectedSeason} scores below.
          </p>
        </Card>
      )}
      <WeeklyScores
        initialWeek={latestRecordedWeek}
        key={`${selectedSeason}-${latestRecordedWeek}`}
        leagueId={resolvedParams.id}
        members={members}
        readOnly={isViewOnly}
        season={selectedSeason}
      />

      {!isViewOnly && (
        <Card className="mb-8 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-app-text">Season data</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-app-text-muted">
                Clear every weekly score only when you intend to rebuild the entire {selectedSeason} season. Saved matchup scheduling is preserved.
              </p>
            </div>
            <Button onClick={() => setShowClearConfirm(true)} variant="danger">
              Clear season scores
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        busy={isClearing}
        confirmLabel={`Clear ${selectedSeason} scores`}
        description={`This permanently deletes every weekly score for the ${selectedSeason} season. Matchup scheduling remains intact, but this action cannot be undone.`}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={clearAllScores}
        open={showClearConfirm}
        title={`Clear all ${selectedSeason} season scores?`}
      />
    </main>
  )
}
