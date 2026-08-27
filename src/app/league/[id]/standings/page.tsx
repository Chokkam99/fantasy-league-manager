'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
import { StandingsTable } from '@/components/standings/StandingsTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { useLeagueShell } from '@/components/league/LeagueShellContext'
import { PageState } from '@/components/ui/PageState'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'
import {
  calculatePlayoffSeeds,
  calculateStandings,
  groupStandingsByDivision,
  orderStandingsByPlayoffPicture,
  resolveDivisionNames,
  STANDINGS_TIEBREAKERS,
  type StandingsMatchup,
  type StandingsScore,
} from '@/lib/standings'
import { loadStandingsData } from '@/lib/standingsClient'
import type { StandingsMember } from '@/lib/standings'

interface StandingsPageProps {
  params: Promise<{ id: string }>
}

export default function StandingsPage({ params }: StandingsPageProps) {
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
  const {
    error: seasonConfigError,
    loading: seasonConfigLoading,
    refetch: refetchSeasonConfig,
    seasonConfig,
  } = useSeasonConfig(resolvedParams.id, selectedSeason)
  const [members, setMembers] = useState<StandingsMember[]>([])
  const [scores, setScores] = useState<StandingsScore[]>([])
  const [matchups, setMatchups] = useState<StandingsMatchup[]>([])
  const [includePostseason, setIncludePostseason] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchStandingsData = useCallback(async () => {
    if (!selectedSeason) return

    setIsLoading(true)
    setLoadError(null)

    try {
      const snapshot = await loadStandingsData(
        resolvedParams.id,
        selectedSeason,
      )
      setMembers(snapshot.members)
      setScores(snapshot.scores)
      setMatchups(snapshot.matchups)
    } catch (error) {
      console.error('Failed to load standings:', error)
      setLoadError('Standings could not be loaded. Try again in a moment.')
    } finally {
      setIsLoading(false)
    }
  }, [resolvedParams.id, selectedSeason])

  useEffect(() => {
    fetchStandingsData()
  }, [fetchStandingsData])

  useEffect(() => {
    setIncludePostseason(false)
  }, [selectedSeason])

  const regularSeasonEnd = Math.max(
    1,
    (seasonConfig?.playoff_start_week || 15) - 1,
  )
  const totalWeeks = seasonConfig?.total_weeks || 17
  const displayMaximumWeek = includePostseason ? totalWeeks : regularSeasonEnd
  const divisions = useMemo(
    () => resolveDivisionNames(seasonConfig?.divisions, members),
    [members, seasonConfig?.divisions],
  )
  const regularStandings = useMemo(
    () => calculateStandings(members, scores, matchups, regularSeasonEnd),
    [matchups, members, regularSeasonEnd, scores],
  )
  const displayStandings = useMemo(
    () => calculateStandings(members, scores, matchups, displayMaximumWeek),
    [displayMaximumWeek, matchups, members, scores],
  )
  const playoffSeeds = useMemo(
    () =>
      calculatePlayoffSeeds(
        regularStandings,
        divisions,
        seasonConfig?.playoff_spots || 6,
      ),
    [divisions, regularStandings, seasonConfig?.playoff_spots],
  )
  const orderedStandings = useMemo(
    () =>
      includePostseason
        ? displayStandings
        : orderStandingsByPlayoffPicture(displayStandings, playoffSeeds),
    [displayStandings, includePostseason, playoffSeeds],
  )
  const seedByTeam = useMemo(
    () => new Map(playoffSeeds.map((seed) => [seed.team_id, seed])),
    [playoffSeeds],
  )
  const completedWeeks = new Set(
    scores
      .filter(
        (score) =>
          score.week_number >= 1 && score.week_number <= displayMaximumWeek,
      )
      .map((score) => score.week_number),
  ).size
  const divisionStandings = useMemo(
    () => groupStandingsByDivision(regularStandings, divisions),
    [divisions, regularStandings],
  )
  const hasMeaningfulDivisions =
    divisionStandings.filter((group) => group.division !== 'Other').length >= 2
  const postseasonWeeks = Math.max(totalWeeks - regularSeasonEnd, 0)
  const isPageLoading = isLeagueLoading || seasonConfigLoading || isLoading

  if (isPageLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <SkeletonGroup className="space-y-4" label="Loading standings">
          <Skeleton className="h-40" />
          <Skeleton className="h-96" />
        </SkeletonGroup>
      </main>
    )
  }

  if (!league) {
    return <LeagueUnavailable error={leagueLoadError} onRetry={reloadLeague} />
  }

  if (loadError) {
    return (
      <PageState
        action={<Button onClick={fetchStandingsData}>Try again</Button>}
        description="The roster, scores, and matchups could not all be loaded, so no partial standings are being shown."
        eyebrow={`${selectedSeason} season`}
        title="Standings couldn’t be loaded"
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
            ? 'Standings will appear after the commissioner publishes this season’s roster and results.'
            : 'Add the active roster before scores and standings can be calculated.'
        }
        eyebrow={`${selectedSeason} season`}
        title="No standings yet"
      />
    )
  }

  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {seasonConfigError && (
        <Notice tone="danger">
          <p>{seasonConfigError} Standings use safe week and playoff defaults until the season is configured.</p>
          <Button className="mt-3" onClick={refetchSeasonConfig} size="sm" variant="secondary">
            Retry season settings
          </Button>
        </Notice>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">
                {selectedSeason} season
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-app-text sm:text-3xl">
                Standings
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted">
                {includePostseason
                  ? `Combined regular-season and postseason results through week ${displayMaximumWeek}. Records and rankings use every recorded matchup.`
                  : hasMeaningfulDivisions
                    ? `Division standings through week ${regularSeasonEnd}. Division winners are seeded first, followed by the best remaining teams.`
                    : `Regular-season standings through week ${regularSeasonEnd}. The top ${playoffSeeds.length} teams qualify.`}
              </p>
            </div>
            <div aria-label="Standings scope" className="grid grid-cols-2 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface-subtle p-1">
              <button
                aria-pressed={!includePostseason}
                className={`min-h-10 rounded-[calc(var(--app-radius-sm)-0.2rem)] px-3 text-[0.8rem] font-semibold transition-colors ${
                  !includePostseason
                    ? 'bg-app-surface text-app-text shadow-sm'
                    : 'text-app-text-muted hover:text-app-text'
                }`}
                onClick={() => setIncludePostseason(false)}
                type="button"
              >
                Regular season
              </button>
              <button
                aria-pressed={includePostseason}
                className={`min-h-10 rounded-[calc(var(--app-radius-sm)-0.2rem)] px-3 text-[0.8rem] font-semibold transition-colors ${
                  includePostseason
                    ? 'bg-app-surface text-app-text shadow-sm'
                    : 'text-app-text-muted hover:text-app-text'
                }`}
                onClick={() => setIncludePostseason(true)}
                type="button"
              >
                Full season
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px border-t border-app-border bg-app-border">
          {(includePostseason
            ? [
                { label: 'Weeks', value: `${completedWeeks}/${displayMaximumWeek}` },
                { label: 'Playoff weeks', value: String(postseasonWeeks) },
                { label: 'Teams', value: String(members.length) },
              ]
            : [
                { label: 'Weeks', value: `${completedWeeks}/${displayMaximumWeek}` },
                { label: 'Spots', value: String(playoffSeeds.length) },
                {
                  label: hasMeaningfulDivisions ? 'Divisions' : 'Format',
                  value: hasMeaningfulDivisions
                    ? String(divisionStandings.length)
                    : 'One table',
                },
              ]
          ).map((item) => (
            <div className="min-w-0 bg-app-surface px-3 py-2.5 sm:px-4 sm:py-3" key={item.label}>
              <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wide text-app-text-muted">{item.label}</p>
              <p className="mt-0.5 truncate text-sm font-bold text-app-text sm:text-base">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {!includePostseason && hasMeaningfulDivisions ? (
        <section aria-labelledby="division-standings-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">Regular season</p>
              <h2 className="mt-1 text-xl font-semibold text-app-text" id="division-standings-heading">
                Standings by division
              </h2>
            </div>
            <Badge variant="info">Top {playoffSeeds.length} qualify</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {divisionStandings.map((group) => (
              <Card className="overflow-hidden" key={group.division}>
                <div className="flex items-center justify-between border-b border-app-border px-3 py-2.5">
                  <h3 className="font-semibold text-app-text">{group.division}</h3>
                  <span className="text-xs text-app-text-muted">{group.rows.length} teams</span>
                </div>
                <StandingsTable
                  playoffSeeds={seedByTeam}
                  rows={group.rows}
                  showExtendedMetrics={false}
                  useLocalPosition
                />
              </Card>
            ))}
          </div>
          <p className="mt-3 px-1 text-xs leading-5 text-app-text-muted">
            Seed labels show the current playoff order. Division winners receive the first seeds; the remaining spots are wildcards.
          </p>
        </section>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-app-border px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">
                {includePostseason ? 'All results' : 'Regular season'}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-app-text">
                {includePostseason ? 'Standings through the playoffs' : 'League standings'}
              </h2>
            </div>
            {!includePostseason && playoffSeeds.length > 0 && (
              <Badge variant="info">Top {playoffSeeds.length} qualify</Badge>
            )}
          </div>
          {orderedStandings.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-app-text">No completed standings yet</p>
              <p className="mt-1 text-sm leading-6 text-app-text-muted">
                Standings will appear after scores and matchup results are recorded.
              </p>
            </div>
          ) : (
            <StandingsTable
              playoffSeeds={includePostseason ? undefined : seedByTeam}
              rows={orderedStandings}
              showCutAfter={includePostseason ? undefined : playoffSeeds.length}
            />
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-app-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-app-brand sm:px-5">
            How these standings are ordered
            <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-app-text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="border-t border-app-border px-4 py-4 sm:px-5">
            <p className="text-sm leading-6 text-app-text-muted">
              {includePostseason
                ? 'All teams are ranked together using every recorded regular-season and postseason result.'
                : hasMeaningfulDivisions
                  ? 'Teams are ranked within each division. Division winners receive the first playoff seeds, followed by the best remaining teams.'
                  : 'All teams are ranked together, with the playoff cut line shown after the final qualifying spot.'}
            </p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-3">
              {STANDINGS_TIEBREAKERS.map((rule, index) => (
                <li className="flex gap-2 text-xs leading-5 text-app-text" key={rule}>
                  <span className="font-mono font-bold text-app-brand-strong">{index + 1}.</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs leading-5 text-app-text-muted">
              ESPN may use different league-specific settings; check ESPN if its published order differs.
            </p>
          </div>
        </details>
      </Card>
    </main>
  )
}
