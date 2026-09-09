'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
import { useLeagueShell } from '@/components/league/LeagueShellContext'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SeasonMoneySettings } from '@/components/league/SeasonMoneySettings'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Notice } from '@/components/ui/Notice'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { Toast } from '@/components/ui/Toast'
import {
  type LifecycleSnapshot,
  loadLifecycle,
  performLifecycleAction,
} from '@/lib/lifecycleClient'

interface SettingsPageProps {
  params: Promise<{ id: string }>
}

type PendingAction =
  | { archived: boolean; target: 'league' }
  | { archived: boolean; season: string; target: 'season' }

function formattedDate(value: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

export default function LeagueSettingsPage({ params }: SettingsPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const {
    isLeagueLoading,
    isAdmin,
    selectedSeason,
    league,
    leagueLoadError,
    reloadLeague,
  } = useLeagueShell()
  const [snapshot, setSnapshot] = useState<LifecycleSnapshot | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    if (!isAdmin) return
    setIsLoading(true)
    setError(null)
    try {
      setSnapshot(await loadLifecycle(id))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'League settings could not be loaded.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [id, isAdmin])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSettings(), 0)
    return () => window.clearTimeout(timer)
  }, [loadSettings])

  const applyAction = async () => {
    if (!pendingAction) return
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      if (pendingAction.target === 'league') {
        await performLifecycleAction(id, {
          action: 'set_league_archive',
          archived: pendingAction.archived,
        })
        setNotice(
          pendingAction.archived
            ? 'League archived. Automatic score sync is off and all history remains available.'
            : 'League restored. Automatic sync remains off until you enable it again.',
        )
      } else {
        await performLifecycleAction(id, {
          action: 'set_season_archive',
          archived: pendingAction.archived,
          season: pendingAction.season,
        })
        setNotice(
          `${pendingAction.season} ${pendingAction.archived ? 'archived' : 'restored'}. Historical data was not changed.`,
        )
      }
      setPendingAction(null)
      await Promise.all([loadSettings(), reloadLeague()])
    } catch (actionError) {
      setPendingAction(null)
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Archive state could not be updated.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLeagueLoading || (isAdmin && isLoading)) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <SkeletonGroup label="Loading league settings">
          <Skeleton className="h-40 bg-app-surface" />
          <Skeleton className="mt-6 h-80 bg-app-surface" />
        </SkeletonGroup>
      </main>
    )
  }

  if (!league) {
    return <LeagueUnavailable error={leagueLoadError} onRetry={reloadLeague} />
  }

  const overviewUrl = `/league/${id}?season=${league.current_season}`
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center sm:px-6">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-app-text">League settings are unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-app-text-muted">Only the commissioner can change league or season lifecycle state.</p>
          <Button className="mt-6" onClick={() => router.push(overviewUrl)} variant="secondary">Back to league</Button>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto min-w-0 max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader eyebrow="Commissioner / League management" title="League settings" description="Set this season’s entry fee and prize budget, or manage league history." action={<Button onClick={() => router.push(overviewUrl)} variant="secondary">Back to league</Button>} />

      <SeasonMoneySettings key={selectedSeason} leagueId={id} season={selectedSeason} />

      {error && <Notice className="mt-5" tone="danger">{error}</Notice>}
      <Toast message={notice} onDismiss={() => setNotice(null)} />

      {!snapshot?.schema_ready ? (
        <Card className="mt-6 p-6 text-center sm:p-8">
          <Badge variant="neutral">Coming soon</Badge>
          <h2 className="mt-4 text-xl font-bold text-app-text">Season archiving is not available yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-app-text-muted">Your saved seasons and league history are unaffected. Archive controls will appear here when this feature is ready.</p>
        </Card>
      ) : (
        <>
          <Card className="mt-6 overflow-hidden">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-app-text">{league.name}</h2>
                  <Badge variant={snapshot.league?.archived_at ? 'neutral' : 'success'}>
                    {snapshot.league?.archived_at ? 'Archived' : 'Active'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-app-text-muted">
                  {snapshot.league?.archived_at
                    ? `Archived ${formattedDate(snapshot.league.archived_at)}. All pages remain readable.`
                    : 'Archiving turns off automatic score sync. It never deletes league history.'}
                </p>
              </div>
              <Button
                className="w-full sm:w-auto"
                onClick={() => setPendingAction({ archived: !snapshot.league?.archived_at, target: 'league' })}
                variant={snapshot.league?.archived_at ? 'primary' : 'danger'}
              >
                {snapshot.league?.archived_at ? 'Restore league' : 'Archive league'}
              </Button>
            </div>
          </Card>

          <section aria-labelledby="season-lifecycle-heading" className="mt-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">Season history</p>
              <h2 className="mt-1 text-xl font-bold text-app-text sm:text-2xl" id="season-lifecycle-heading">Season archive</h2>
              <p className="mt-1 text-sm leading-6 text-app-text-muted">Archived seasons stay selectable and readable. The active season cannot be archived.</p>
            </div>
            <Card className="mt-4 divide-y divide-app-border overflow-hidden">
              {snapshot.seasons.map((season) => {
                const isCurrent = season.season === snapshot.league?.current_season
                return (
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" key={season.season}>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="text-lg font-bold text-app-text">{season.season}</p>
                      {isCurrent && <Badge variant="success">Current</Badge>}
                      {season.archived_at && <Badge variant="neutral">Archived</Badge>}
                      <p className="w-full text-sm text-app-text-muted sm:w-auto">
                        {season.archived_at
                          ? `Archived ${formattedDate(season.archived_at)}`
                          : isCurrent
                            ? 'Active season'
                            : 'Available history'}
                      </p>
                    </div>
                    <Button
                      className="w-full sm:w-auto"
                      disabled={isCurrent}
                      onClick={() => setPendingAction({ archived: !season.archived_at, season: season.season, target: 'season' })}
                      variant="secondary"
                    >
                      {isCurrent
                        ? 'Current season'
                        : season.archived_at
                          ? 'Restore season'
                          : 'Archive season'}
                    </Button>
                  </div>
                )
              })}
            </Card>
          </section>
        </>
      )}

      <ConfirmDialog
        busy={isSaving}
        confirmLabel={
          pendingAction?.archived
            ? pendingAction.target === 'league'
              ? 'Archive league'
              : 'Archive season'
            : 'Restore'
        }
        confirmVariant={pendingAction?.archived ? 'danger' : 'primary'}
        description={
          pendingAction?.target === 'league'
            ? pendingAction.archived
              ? 'Archive this league and turn off automatic score sync? All seasons and history remain readable, and you can restore it later.'
              : 'Restore this league? Automatic score sync will remain off until you deliberately enable it again.'
            : pendingAction
              ? `${pendingAction.archived ? 'Archive' : 'Restore'} the ${pendingAction.season} season? Scores, standings, players, dues, and payouts will not be deleted.`
              : ''
        }
        onClose={() => {
          if (!isSaving) setPendingAction(null)
        }}
        onConfirm={applyAction}
        open={Boolean(pendingAction)}
        title={pendingAction?.archived ? 'Archive without deleting?' : 'Restore this history?'}
        tone="warning"
      />
    </main>
  )
}
