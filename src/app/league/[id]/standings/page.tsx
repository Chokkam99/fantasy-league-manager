'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
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
  compareStandingRows,
  orderStandingsByPlayoffPicture,
  resolveDivisionNames,
  STANDINGS_TIEBREAKERS,
  type PlayoffSeed,
  type StandingRow,
  type StandingsMatchup,
  type StandingsScore,
} from '@/lib/standings'
import { loadStandingsData } from '@/lib/standingsClient'
import type { StandingsMember } from '@/lib/standings'

interface StandingsPageProps {
  params: Promise<{ id: string }>
}

function formatRecord(row: StandingRow) {
  return row.ties > 0
    ? `${row.wins}-${row.losses}-${row.ties}`
    : `${row.wins}-${row.losses}`
}

function formatWeeklyWins(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getStatus(
  row: StandingRow,
  seed: PlayoffSeed | undefined,
  firstOutsideId: string | undefined,
) {
  if (seed?.is_division_winner) {
    return { label: 'Division leader', variant: 'success' as const }
  }
  if (seed) return { label: 'Playoff position', variant: 'info' as const }
  if (row.member.id === firstOutsideId) {
    return { label: 'First team out', variant: 'warning' as const }
  }
  return { label: 'Outside', variant: 'neutral' as const }
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
  const firstOutsideId = includePostseason
    ? undefined
    : orderedStandings[playoffSeeds.length]?.member.id
  const completedWeeks = new Set(
    scores
      .filter(
        (score) =>
          score.week_number >= 1 && score.week_number <= displayMaximumWeek,
      )
      .map((score) => score.week_number),
  ).size
  const divisionLeaders = useMemo(
    () =>
      divisions.flatMap((division) => {
        const leader = regularStandings
          .filter((row) => row.member.division === division)
          .sort(compareStandingRows)[0]
        return leader ? [{ division, leader }] : []
      }),
    [divisions, regularStandings],
  )
  const hasMeaningfulDivisions = divisionLeaders.length >= 2
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
        <div className="border-b border-app-border p-4 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">
                {selectedSeason} season
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-app-text sm:text-3xl">
                Playoff picture
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted">
                {includePostseason
                  ? `Full-season results through week ${displayMaximumWeek}. Playoff seed badges remain based on the regular season.`
                  : `Regular-season standings through week ${regularSeasonEnd}, ordered into the current playoff field.`}
              </p>
            </div>
            <div aria-label="Standings scope" className="grid grid-cols-2 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface-subtle p-1">
              <button
                aria-pressed={!includePostseason}
                className={`min-h-11 rounded-[calc(var(--app-radius-sm)-0.2rem)] px-3 text-sm font-semibold transition-colors ${
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
                className={`min-h-11 rounded-[calc(var(--app-radius-sm)-0.2rem)] px-3 text-sm font-semibold transition-colors ${
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

        <div className="grid grid-cols-2 gap-px bg-app-border sm:grid-cols-4">
          {[
            { label: 'Weeks counted', value: `${completedWeeks}/${displayMaximumWeek}` },
            { label: 'Playoff spots', value: String(playoffSeeds.length) },
            { label: 'Teams', value: String(members.length) },
            {
              label: 'Format',
              value: hasMeaningfulDivisions
                ? `${divisionLeaders.length} divisions`
                : 'One table',
            },
          ].map((item) => (
            <div className="bg-app-surface p-3 sm:p-4" key={item.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">{item.label}</p>
              <p className="mt-1 text-lg font-bold text-app-text">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {hasMeaningfulDivisions && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">Division race</p>
              <h2 className="mt-1 text-xl font-semibold text-app-text">Current division leaders</h2>
            </div>
            <Badge variant="success">Top seeds</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {divisionLeaders.map(({ division, leader }) => {
              const seed = seedByTeam.get(leader.member.id)
              return (
                <div className="rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface-subtle p-4" key={division}>
                  <div className="flex items-center justify-between gap-2">
                    <Badge>{division}</Badge>
                    {seed && <Badge variant="success">Seed {seed.seed}</Badge>}
                  </div>
                  <p className="mt-3 truncate font-semibold text-app-text">{leader.member.team_name}</p>
                  <p className="truncate text-sm text-app-text-muted">{leader.member.manager_name}</p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold text-app-text">{formatRecord(leader)}</span>
                    <span className="font-mono text-app-text-muted">{leader.points_for.toFixed(2)} PF</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-app-border p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">Standings</p>
              <h2 className="mt-1 text-xl font-semibold text-app-text">
                {includePostseason ? 'Full-season record' : 'Current playoff field'}
              </h2>
            </div>
            {!includePostseason && playoffSeeds.length > 0 && (
              <Badge variant="info">Top {playoffSeeds.length} qualify</Badge>
            )}
          </div>
        </div>

        {orderedStandings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-app-text">No completed standings yet</p>
            <p className="mt-1 text-sm leading-6 text-app-text-muted">
              Standings will appear after scores and matchup results are recorded.
            </p>
          </div>
        ) : (
          <>
            <div className="lg:hidden">
              {orderedStandings.map((row, index) => {
                const seed = seedByTeam.get(row.member.id)
                const status = getStatus(row, seed, firstOutsideId)
                const showCutLine =
                  !includePostseason &&
                  playoffSeeds.length > 0 &&
                  index === playoffSeeds.length

                return (
                  <div key={row.member.id}>
                    {showCutLine && (
                      <div className="flex items-center gap-3 border-y border-app-warning/30 bg-app-warning-soft px-4 py-2 text-xs font-semibold uppercase tracking-wide text-app-warning">
                        <span className="h-px flex-1 bg-app-warning/40" />
                        Playoff cut line
                        <span className="h-px flex-1 bg-app-warning/40" />
                      </div>
                    )}
                    <article className={`p-4 ${index > 0 && !showCutLine ? 'border-t border-app-border' : ''} ${seed && !includePostseason ? 'bg-app-info-soft/30' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-surface-subtle font-mono text-sm font-bold text-app-text">
                          {row.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold text-app-text">{row.member.team_name}</h3>
                            {seed && <Badge variant="info">Seed {seed.seed}</Badge>}
                          </div>
                          <p className="mt-0.5 truncate text-sm text-app-text-muted">
                            {row.member.manager_name}
                            {row.member.division ? ` · ${row.member.division}` : ''}
                          </p>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-2 rounded-[var(--app-radius-sm)] bg-app-surface-subtle p-3 sm:grid-cols-4">
                        <div>
                          <dt className="text-xs text-app-text-muted">Record</dt>
                          <dd className="mt-0.5 font-semibold text-app-text">{formatRecord(row)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-app-text-muted">Points for</dt>
                          <dd className="mt-0.5 font-mono font-semibold text-app-text">{row.points_for.toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-app-text-muted">Average</dt>
                          <dd className="mt-0.5 font-mono font-semibold text-app-text">{row.average_points.toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-app-text-muted">Weekly wins</dt>
                          <dd className="mt-0.5 font-semibold text-app-text">{formatWeeklyWins(row.weekly_wins)}</dd>
                        </div>
                      </dl>
                    </article>
                  </div>
                )
              })}
            </div>

            <div className="hidden lg:block">
              <table className="w-full table-fixed">
                <thead className="bg-app-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-app-text-muted">
                  <tr>
                    <th className="w-20 px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="w-28 px-4 py-3 text-right">Record</th>
                    <th className="w-32 px-4 py-3 text-right">Points for</th>
                    <th className="w-28 px-4 py-3 text-right">Average</th>
                    <th className="w-28 px-4 py-3 text-right">Weekly wins</th>
                    <th className="w-44 px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedStandings.map((row, index) => {
                    const seed = seedByTeam.get(row.member.id)
                    const status = getStatus(row, seed, firstOutsideId)
                    const showCutLine =
                      !includePostseason &&
                      playoffSeeds.length > 0 &&
                      index === playoffSeeds.length

                    return (
                      <tr
                        className={`border-t ${showCutLine ? 'border-app-warning bg-app-warning-soft/40' : 'border-app-border'} ${seed && !includePostseason ? 'bg-app-info-soft/20' : ''}`}
                        key={row.member.id}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-app-text">#{row.rank}</span>
                            {showCutLine && <span className="sr-only">Below playoff cut line</span>}
                          </div>
                        </td>
                        <td className="min-w-0 px-4 py-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-app-text">{row.member.team_name}</p>
                              <p className="truncate text-sm text-app-text-muted">
                                {row.member.manager_name}{row.member.division ? ` · ${row.member.division}` : ''}
                              </p>
                            </div>
                            {seed && <Badge variant="info">Seed {seed.seed}</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-app-text">{formatRecord(row)}</td>
                        <td className="px-4 py-4 text-right font-mono font-semibold text-app-text">{row.points_for.toFixed(2)}</td>
                        <td className="px-4 py-4 text-right font-mono text-app-text-muted">{row.average_points.toFixed(2)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-app-text">{formatWeeklyWins(row.weekly_wins)}</td>
                        <td className="px-4 py-4"><Badge variant={status.variant}>{status.label}</Badge></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">How ordering works</p>
            <h2 className="mt-1 text-xl font-semibold text-app-text">Published tiebreaker order</h2>
            <p className="mt-2 text-sm leading-6 text-app-text-muted">
              This is the order used for the standings shown here. ESPN may use different league-specific settings, so check ESPN if the published order differs.
            </p>
          </div>
          <ol className="space-y-2">
            {STANDINGS_TIEBREAKERS.map((rule, index) => (
              <li className="flex gap-3 rounded-[var(--app-radius-sm)] bg-app-surface-subtle p-3 text-sm text-app-text" key={rule}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-app-surface font-mono text-xs font-bold text-app-brand-strong">{index + 1}</span>
                <span className="leading-6">{rule}</span>
              </li>
            ))}
          </ol>
        </div>
      </Card>
    </main>
  )
}
