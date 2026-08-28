'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import {
  buildLeagueHistoryMatrix,
  buildLeagueHistoryRows,
  type LeagueHistoryMember,
  type LeagueHistoryMatrixCell,
  type LeagueHistoryRow,
} from '@/lib/leagueHistory'
import { loadLeagueHistory } from '@/lib/leagueHistoryClient'

function TeamName({ member }: { member: LeagueHistoryMember | null }) {
  if (!member) return <span className="text-app-text-muted">Not set</span>
  return (
    <span className="block min-w-0">
      <span className="block truncate text-sm font-semibold text-app-text">
        {member.team_name}
      </span>
      <span className="block truncate text-xs text-app-text-muted">
        {member.manager_name}
      </span>
    </span>
  )
}

const resultDetails = {
  champion: {
    label: 'Champion',
    marker: '1',
    style: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300',
  },
  'runner-up': {
    label: 'Runner-up',
    marker: '2',
    style: 'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300',
  },
  third: {
    label: 'Third place',
    marker: '3',
    style: 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-300',
  },
  playoff: {
    label: 'Made playoffs',
    marker: '✓',
    style:
      'bg-app-info-soft text-app-info ring-1 ring-inset ring-app-info/20',
  },
  participant: {
    label: 'Participated',
    marker: '✓',
    style: 'text-app-text-muted ring-1 ring-inset ring-app-border',
  },
} as const

function ResultMark({
  cell,
  managerName,
}: {
  cell: LeagueHistoryMatrixCell
  managerName: string
}) {
  const detail = resultDetails[cell.result]
  const description = `${managerName}, ${cell.season}: ${detail.label} as ${cell.teamName}`

  return (
    <span
      aria-label={description}
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-bold ${detail.style}`}
      title={description}
    >
      {detail.marker}
    </span>
  )
}

function HistoryLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 text-[0.68rem] text-app-text-muted">
      {Object.entries(resultDetails).map(([result, detail]) => (
        <span className="inline-flex items-center gap-1.5" key={result}>
          <span
            aria-hidden="true"
            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.62rem] font-bold ${detail.style}`}
          >
            {detail.marker}
          </span>
          {detail.label}
        </span>
      ))}
    </div>
  )
}

export function LeagueHistoryTable({
  leagueId,
  selectedSeason,
}: {
  leagueId: string
  selectedSeason: string
}) {
  const [rows, setRows] = useState<LeagueHistoryRow[]>([])
  const [matrix, setMatrix] = useState<
    ReturnType<typeof buildLeagueHistoryMatrix>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snapshot = await loadLeagueHistory(leagueId, selectedSeason)
      const historyRows = buildLeagueHistoryRows(snapshot)
      setRows(historyRows)
      setMatrix(buildLeagueHistoryMatrix(snapshot, historyRows))
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'League history could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }, [leagueId, selectedSeason])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  if (loading) {
    return (
      <SkeletonGroup className="mt-6 space-y-3" label="Loading league history">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </SkeletonGroup>
    )
  }

  return (
    <Card className="mt-6 min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-border p-4 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
            League history
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">Season results</h2>
          <p className="mt-1 text-sm leading-5 text-app-text-muted">
            Playoff fields and final placements across every saved season.
          </p>
        </div>
        <Badge variant="neutral">{rows.length} seasons</Badge>
      </div>

      {error ? (
        <div className="p-5 sm:p-6">
          <p className="text-sm text-app-danger">{error}</p>
          <Button className="mt-3" onClick={loadHistory} size="sm" variant="secondary">
            Retry history
          </Button>
        </div>
      ) : rows.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] table-fixed">
              <thead className="bg-app-surface-subtle text-left text-[0.68rem] font-semibold uppercase tracking-wide text-app-text-muted">
                <tr>
                  <th className="sticky left-0 z-10 w-24 bg-app-surface-subtle px-4 py-2.5 sm:px-6">
                    Season
                  </th>
                  <th className="w-36 px-3 py-2.5">Champion</th>
                  <th className="w-36 px-3 py-2.5">Runner-up</th>
                  <th className="w-36 px-3 py-2.5">Third</th>
                  <th className="px-3 py-2.5 pr-6">Playoff field</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {rows.map((row) => (
                  <tr key={row.season}>
                    <td className="sticky left-0 z-10 bg-app-surface px-4 py-3 align-top sm:px-6">
                      <p className="font-bold tabular-nums text-app-text">
                        {row.season}
                      </p>
                      <p className="mt-0.5 text-xs text-app-text-muted">
                        {row.status === 'complete' ? 'Final' : 'In progress'}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <TeamName member={row.champion} />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <TeamName member={row.runnerUp} />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <TeamName member={row.thirdPlace} />
                    </td>
                    <td className="px-3 py-3 pr-6 align-top">
                      {row.playoffTeams.length > 0 ? (
                        <p className="text-xs leading-5 text-app-text">
                          {row.playoffTeams
                            .map((member) => member.team_name)
                            .join(' · ')}
                        </p>
                      ) : (
                        <span className="text-sm text-app-text-muted">
                          Not set
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-app-border">
            <div className="space-y-3 px-4 py-4 sm:px-6">
              <div>
                <h3 className="text-base font-bold text-app-text">Player history</h3>
                <p className="mt-1 text-sm leading-5 text-app-text-muted">
                  One row per manager, even when their team name changes.
                </p>
              </div>
              <HistoryLegend />
            </div>
            <div
              aria-label="Player results by season"
              className="overflow-x-auto"
              role="region"
              tabIndex={0}
            >
              <table className="min-w-max border-t border-app-border">
                <thead className="bg-app-surface-subtle text-[0.68rem] font-semibold uppercase tracking-wide text-app-text-muted">
                  <tr>
                    <th className="sticky left-0 z-10 w-36 min-w-36 bg-app-surface-subtle px-4 py-2.5 text-left sm:w-44 sm:min-w-44 sm:px-6">
                      Manager
                    </th>
                    {rows.map((row) => (
                      <th className="w-[4.5rem] min-w-[4.5rem] px-2 py-2.5 text-center tabular-nums" key={row.season}>
                        {row.season}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {matrix.map((player) => (
                    <tr key={player.id}>
                      <th className="sticky left-0 z-10 w-36 min-w-36 bg-app-surface px-4 py-3 text-left text-sm font-semibold text-app-text sm:w-44 sm:min-w-44 sm:px-6">
                        <span
                          className="block truncate"
                          title={player.managerName}
                        >
                          {player.managerName}
                        </span>
                      </th>
                      {rows.map((row) => {
                        const cell = player.cells[row.season]
                        return (
                          <td
                            className="w-[4.5rem] min-w-[4.5rem] px-2 py-2.5 text-center"
                            key={row.season}
                          >
                            {cell ? (
                              <ResultMark cell={cell} managerName={player.managerName} />
                            ) : (
                              <span
                                aria-label={`${player.managerName}, ${row.season}: Did not participate`}
                                className="text-sm text-app-border"
                              >
                                -
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="p-8 text-center">
          <p className="font-semibold text-app-text">No league history yet</p>
          <p className="mt-1 text-sm text-app-text-muted">
            Completed seasons will be summarized here.
          </p>
        </div>
      )}
    </Card>
  )
}
