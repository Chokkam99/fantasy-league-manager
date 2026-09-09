'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
import { useLeagueShell } from '@/components/league/LeagueShellContext'
import { OverviewHeader, OverviewMetrics } from '@/components/overview/OverviewHeader'
import { LeagueHistoryTable } from '@/components/overview/LeagueHistoryTable'
import { OverviewMoneyCard } from '@/components/overview/OverviewMoneyCard'
import {
  OverviewSidebar,
  OverviewAttention,
  type OverviewAttentionItem,
} from '@/components/overview/OverviewSidebar'
import { SeasonProgressCard } from '@/components/overview/SeasonProgressCard'
import { StandingsPreviewCard } from '@/components/overview/StandingsPreviewCard'
import { Button } from '@/components/ui/Button'
import { PageSkeleton, PageState } from '@/components/ui/PageState'
import { useReadOnlyRefresh } from '@/hooks/useReadOnlyRefresh'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'
import {
  buildOverviewAttentionReasons,
  buildOverviewViewModel,
} from '@/lib/overview'
import {
  loadOverviewData,
  type OverviewDataSnapshot,
} from '@/lib/overviewClient'
import { normalizePlatformSyncHealth } from '@/lib/platformImport'

interface LeagueDetailsProps {
  params: Promise<{ id: string }>
}

function OverviewSkeleton() {
  return (
    <PageSkeleton
      cardClassName="h-32"
      cardCount={4}
      gridClassName="grid-cols-1 min-[340px]:grid-cols-2 lg:grid-cols-4"
      label="Loading league overview"
    />
  )
}

const emptyData: OverviewDataSnapshot = {
  finance: null,
  financeError: null,
  matchups: [],
  members: [],
  scores: [],
  standingsError: null,
}

export default function LeagueDetails({ params }: LeagueDetailsProps) {
  const { id } = use(params)
  const {
    isLeagueLoading,
    isViewOnly,
    league,
    leagueLoadError,
    reloadLeague,
    selectedSeason,
    shareToken,
  } = useLeagueShell()
  const [data, setData] = useState<OverviewDataSnapshot>(emptyData)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const {
    error: seasonConfigError,
    loading: isSeasonConfigLoading,
    refetch: refetchSeasonConfig,
    seasonConfig,
  } = useSeasonConfig(id, selectedSeason)

  const requestVersion = useRef(0)
  const fetchOverviewData = useCallback(async (background = false) => {
    if (!selectedSeason) return
    const version = ++requestVersion.current
    if (!background) {
      setIsDataLoading(true)
      setDataError(null)
    }

    try {
      const snapshot = await loadOverviewData(id, selectedSeason)
      if (version !== requestVersion.current) return
      setDataError(null)
      setData(snapshot)
    } catch (error) {
      if (version !== requestVersion.current) return
      const message = getErrorMessage(error, 'The overview could not be loaded.')
      setDataError(message)
      console.error('Failed to load league overview:', message)
    } finally {
      if (version === requestVersion.current) setIsDataLoading(false)
    }
  }, [id, selectedSeason])

  useEffect(() => {
    const loadTimer = window.setTimeout(fetchOverviewData, 0)
    return () => {
      window.clearTimeout(loadTimer)
      requestVersion.current += 1
    }
  }, [fetchOverviewData])

  useReadOnlyRefresh({
    enabled: isViewOnly,
    leagueId: id,
    season: selectedSeason,
    onRefresh: () => fetchOverviewData(true),
  })

  const settings = useMemo(
    () => ({
      divisions: seasonConfig?.divisions,
      draft_food_cost: seasonConfig?.draft_food_cost || 0,
      fee_amount: seasonConfig?.fee_amount || 0,
      playoff_spots: seasonConfig?.playoff_spots || 0,
      playoff_start_week: seasonConfig?.playoff_start_week || 0,
      prize_structure: seasonConfig?.prize_structure || {},
      total_weeks: seasonConfig?.total_weeks || 0,
      weekly_prize_amount: seasonConfig?.weekly_prize_amount || 0,
    }),
    [seasonConfig],
  )
  const overview = useMemo(
    () =>
      buildOverviewViewModel({
        finance: data.finance,
        matchups: data.matchups,
        members: data.members,
        scores: data.scores,
        settings,
      }),
    [data, settings],
  )

  if (isLeagueLoading || isDataLoading || isSeasonConfigLoading) {
    return <OverviewSkeleton />
  }

  if (!league) {
    return <LeagueUnavailable error={leagueLoadError} onRetry={reloadLeague} />
  }

  if (dataError) {
    return (
      <PageState
        action={<Button onClick={() => void fetchOverviewData()}>Try again</Button>}
        description="The season summary could not be assembled, so totals and progress are hidden rather than showing incomplete values."
        eyebrow={`${selectedSeason} season`}
        title="Overview data couldn’t be loaded"
        tone="danger"
      />
    )
  }

  const buildPageHref = (segment: string) => {
    const query = new URLSearchParams({ season: selectedSeason })
    if (shareToken) query.set('share', shareToken)
    return `/league/${id}/${segment}?${query.toString()}`
  }

  if (data.members.length === 0) {
    return (
      <PageState
        action={!isViewOnly ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--app-radius-sm)] bg-app-brand px-4 text-sm font-semibold text-white"
            href={buildPageHref('players')}
          >
            Add season players
          </Link>
        ) : undefined}
        description={
          isViewOnly
            ? 'The commissioner has not published a roster or season results yet.'
            : 'Add the active roster to begin tracking dues, scores, standings, and prizes.'
        }
        eyebrow={`${selectedSeason} season`}
        title="This season hasn’t started"
      />
    )
  }

  const syncHealth = normalizePlatformSyncHealth({
    autoSyncEnabled: Boolean(league.auto_sync_enabled),
    lastSyncError: league.last_sync_error,
    syncStatus: league.sync_status || 'none',
    totalWeeks: settings.total_weeks,
  })
  const syncHasError = syncHealth.syncStatus === 'error'
  const syncIsConnected = Boolean(
    league.platform_type || league.platform_league_id,
  )
  const attentionItems: OverviewAttentionItem[] = buildOverviewAttentionReasons({
    financeError: data.financeError,
    overview,
    seasonConfigError,
    syncError: syncHasError
      ? syncHealth.lastSyncError || 'The last score sync failed'
      : null,
  }).map((reason) => ({
    href: buildPageHref(reason.target),
    label: reason.label,
  }))

  return (
    <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <OverviewHeader
        overview={overview}
        scoresHref={buildPageHref('scores')}
        selectedSeason={selectedSeason}
        totalWeeks={settings.total_weeks}
      />

      {!isViewOnly && <div className="mt-4"><OverviewAttention attentionItems={attentionItems} /></div>}
      <OverviewMetrics overview={overview} isViewOnly={isViewOnly} />

      {seasonConfigError && (
        <div
          className="mt-6 rounded-[var(--app-radius-md)] border border-app-warning/30 bg-app-warning-soft p-4 text-sm leading-6 text-app-text"
          role="status"
        >
          {seasonConfigError} Money and schedule values below use safe display defaults until the season is configured.
          <Button className="mt-3" onClick={refetchSeasonConfig} size="sm" variant="secondary">
            Retry season settings
          </Button>
        </div>
      )}

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.85fr)]">
        <div className="min-w-0 space-y-6">
          <StandingsPreviewCard
            loadError={data.standingsError}
            standings={overview.standings}
            standingsHref={buildPageHref('standings')}
          />
          <OverviewMoneyCard
            overview={overview}
            prizesHref={buildPageHref('prizes')}
          />
        </div>

        <div className="min-w-0 space-y-5">
          <SeasonProgressCard
            autoSyncEnabled={Boolean(league.auto_sync_enabled)}
            isViewOnly={isViewOnly}
            lastSyncAt={league.last_sync_at}
            overview={overview}
            syncHasError={syncHasError}
            syncIsConnected={syncIsConnected}
            totalWeeks={settings.total_weeks}
          />
          <OverviewSidebar
            attentionItems={attentionItems}
            showAttention={false}
            historyHref="#league-history"
            isViewOnly={isViewOnly}
            overview={overview}
            playoffSpots={settings.playoff_spots}
            playoffStartWeek={settings.playoff_start_week}
            rulesHref={buildPageHref('rules')}
            standingsHref={buildPageHref('standings')}
          />
        </div>
      </div>
      <LeagueHistoryTable leagueId={id} selectedSeason={selectedSeason} />
    </main>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return fallback
}
