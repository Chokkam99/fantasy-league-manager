import { Fragment } from 'react'
import type { PlayoffSeed, StandingRow } from '@/lib/standings'

interface StandingsTableProps {
  playoffSeeds?: Map<string, PlayoffSeed>
  rows: StandingRow[]
  showCutAfter?: number
  showExtendedMetrics?: boolean
  useLocalPosition?: boolean
}

function formatRecord(row: StandingRow) {
  return row.ties > 0
    ? `${row.wins}-${row.losses}-${row.ties}`
    : `${row.wins}-${row.losses}`
}

function formatWeeklyWins(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function StandingsTable({
  playoffSeeds,
  rows,
  showCutAfter,
  showExtendedMetrics = true,
  useLocalPosition = false,
}: StandingsTableProps) {
  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed">
        <thead className="border-b border-app-border bg-app-surface-subtle text-left text-[0.68rem] font-semibold uppercase tracking-wide text-app-text-muted">
          <tr>
            <th className="w-11 px-3 py-2.5 text-center">Pos</th>
            <th className="px-2 py-2.5">Team</th>
            <th className="w-14 px-2 py-2.5 text-right">Record</th>
            <th className="w-[4.7rem] px-3 py-2.5 text-right">PF</th>
            <th className={showExtendedMetrics ? 'hidden w-24 px-3 py-2.5 text-right md:table-cell' : 'hidden'}>Average</th>
            <th className={showExtendedMetrics ? 'hidden w-24 px-3 py-2.5 text-right lg:table-cell' : 'hidden'}>Weekly wins</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const seed = playoffSeeds?.get(row.member.id)
            const showCutLine = Boolean(showCutAfter && index === showCutAfter)

            return (
              <Fragment key={row.member.id}>
                {showCutLine && (
                  <tr className="border-y border-app-warning/30 bg-app-warning-soft">
                    <td
                      className="px-3 py-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-app-warning"
                      colSpan={6}
                    >
                      Playoff cut line
                    </td>
                  </tr>
                )}
                <tr
                  className={`border-b border-app-border last:border-b-0 ${seed ? 'bg-app-info-soft/20' : 'bg-app-surface'}`}
                >
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span className="font-mono text-sm font-bold text-app-text">
                      {useLocalPosition ? index + 1 : row.rank}
                    </span>
                  </td>
                  <td className="min-w-0 px-2 py-2.5 align-middle">
                    <p className="truncate text-sm font-semibold leading-5 text-app-text">
                      {row.member.team_name}
                    </p>
                    <p className="truncate text-[0.7rem] leading-4 text-app-text-muted">
                      {row.member.manager_name}
                      {seed ? ` · Seed ${seed.seed}` : ''}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 text-right align-middle text-sm font-semibold tabular-nums text-app-text">
                    {formatRecord(row)}
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono text-xs font-semibold tabular-nums text-app-text">
                    {row.points_for.toFixed(2)}
                  </td>
                  <td className={showExtendedMetrics ? 'hidden px-3 py-2.5 text-right align-middle font-mono text-xs tabular-nums text-app-text-muted md:table-cell' : 'hidden'}>
                    {row.average_points.toFixed(2)}
                  </td>
                  <td className={showExtendedMetrics ? 'hidden px-3 py-2.5 text-right align-middle text-sm font-medium tabular-nums text-app-text lg:table-cell' : 'hidden'}>
                    {formatWeeklyWins(row.weekly_wins)}
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
