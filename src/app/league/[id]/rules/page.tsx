'use client'

import Link from 'next/link'
import { use } from 'react'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
import { useLeagueShell } from '@/components/league/LeagueShellContext'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { PageSkeleton } from '@/components/ui/PageState'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'
import {
  getConfiguredDivisions,
  getPrizeRuleRows,
  getScoreSourceRule,
  getSeasonScheduleRule,
} from '@/lib/rules'
import { STANDINGS_TIEBREAKERS } from '@/lib/standings'

interface RulesPageProps {
  params: Promise<{ id: string }>
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function RulesSkeleton() {
  return (
    <PageSkeleton
      cardClassName="h-80"
      cardCount={4}
      gridClassName="gap-6 lg:grid-cols-2"
      heroClassName="h-56 bg-app-surface"
      label="Loading league rules"
    />
  )
}

function RuleMetric({ detail, label }: { detail: string; label: string }) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-lg font-bold tracking-tight text-app-text sm:text-xl">
        {detail}
      </dd>
    </div>
  )
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-app-text-muted">{label}</dt>
      <dd className="max-w-[60%] text-right font-semibold text-app-text">{value}</dd>
    </div>
  )
}

export default function RulesPage({ params }: RulesPageProps) {
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
  const {
    error: seasonConfigError,
    loading: isSeasonConfigLoading,
    refetch: refetchSeasonConfig,
    seasonConfig,
  } = useSeasonConfig(id, selectedSeason)

  if (isLeagueLoading || isSeasonConfigLoading) return <RulesSkeleton />

  if (!league) {
    return <LeagueUnavailable error={leagueLoadError} onRetry={reloadLeague} />
  }

  const schedule = getSeasonScheduleRule(
    seasonConfig?.total_weeks || 0,
    seasonConfig?.playoff_start_week || 0,
  )
  const divisions = getConfiguredDivisions(seasonConfig?.divisions)
  const prizeRules = getPrizeRuleRows(seasonConfig?.prize_structure)
  const scoreSource = getScoreSourceRule({
    autoSyncEnabled: Boolean(league.auto_sync_enabled),
    platformLeagueId: league.platform_league_id,
    platformType: league.platform_type,
  })
  const playoffRange =
    schedule.totalWeeks === 0
      ? 'Not configured'
      : schedule.playoffsStartWeek === schedule.totalWeeks
      ? `Week ${schedule.playoffsStartWeek}`
      : `Weeks ${schedule.playoffsStartWeek}-${schedule.totalWeeks}`
  const regularSeasonLabel =
    schedule.regularSeasonWeeks > 0
      ? `Weeks 1-${schedule.regularSeasonWeeks}`
      : 'Not configured'
  const buildPageHref = (segment: string) => {
    const query = new URLSearchParams({ season: selectedSeason })
    if (shareToken) query.set('share', shareToken)
    return `/league/${id}/${segment}?${query.toString()}`
  }

  return (
    <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {seasonConfigError && (
        <Notice className="mb-5" tone="warning">
          {seasonConfigError} The values below use safe display defaults until
          this season is configured.
          <Button className="mt-3" onClick={refetchSeasonConfig} size="sm" variant="secondary">
            Retry season settings
          </Button>
        </Notice>
      )}

      <section>
        <PageHeader eyebrow={`${selectedSeason} season / The playbook`} title="League rules" description="The format, the stakes, and the fine print. Everyone plays by the same rules." />
        {!isViewOnly && <Link className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-text" href={`${buildPageHref('settings')}#season-money`}>Edit entry fee &amp; prizes</Link>}

        <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-app-border bg-app-surface lg:grid-cols-4 [&>div+div]:border-l [&>div+div]:border-app-border">
          <RuleMetric
            detail={currency.format(seasonConfig?.fee_amount || 0)}
            label="Entry fee"
          />
          <RuleMetric detail={regularSeasonLabel} label="Regular season" />
          <RuleMetric
            detail={
              (seasonConfig?.playoff_spots || 0) > 0
                ? `${seasonConfig?.playoff_spots} teams`
                : 'Not configured'
            }
            label="Playoff field"
          />
          <RuleMetric
            detail={currency.format(seasonConfig?.weekly_prize_amount || 0)}
            label="Weekly prize"
          />
        </dl>
      </section>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
            Season format
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">
            Schedule and playoffs
          </h2>
          <dl className="mt-5 divide-y divide-app-border text-sm">
            <RuleRow label="Total scoring weeks" value={String(schedule.totalWeeks)} />
            <RuleRow label="Regular season" value={regularSeasonLabel} />
            <RuleRow label="Playoffs" value={playoffRange} />
            <RuleRow
              label="Playoff spots"
              value={
                (seasonConfig?.playoff_spots || 0) > 0
                  ? String(seasonConfig?.playoff_spots)
                  : 'Not configured'
              }
            />
            <RuleRow
              label="Standings format"
              value={
                divisions.length > 0
                  ? `${divisions.length} divisions`
                  : 'Single table'
              }
            />
          </dl>

          {divisions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
                Divisions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {divisions.map((division) => (
                  <Badge key={division} variant="neutral">
                    {division}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 rounded-[var(--app-radius-sm)] bg-app-surface-subtle px-3 py-2.5 text-xs leading-5 text-app-text-muted">
            {divisions.length > 0
              ? 'Division winners receive the leading seeds. Remaining playoff places go to the highest-ranked wildcards.'
              : (seasonConfig?.playoff_spots || 0) > 0
                ? `The top ${seasonConfig?.playoff_spots} teams in the regular-season table qualify.`
                : 'Playoff qualification is not configured for this season.'}
          </p>
        </Card>

        <Card className="min-w-0 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
            League money
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">Fees and prizes</h2>
          <dl className="mt-5 divide-y divide-app-border text-sm">
            <RuleRow
              label="Entry fee per player"
              value={currency.format(seasonConfig?.fee_amount || 0)}
            />
            <RuleRow
              label="Draft food and costs"
              value={
                (seasonConfig?.draft_food_cost || 0) > 0
                  ? currency.format(seasonConfig?.draft_food_cost || 0)
                  : 'None configured'
              }
            />
            <RuleRow
              label="Weekly high-score prize"
              value={currency.format(seasonConfig?.weekly_prize_amount || 0)}
            />
            <RuleRow
              label="Weekly prize allocation"
              value={currency.format(
                (seasonConfig?.weekly_prize_amount || 0) * schedule.totalWeeks,
              )}
            />
          </dl>

          <div className="mt-5 border-t border-app-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
              Final and special prizes
            </p>
            {prizeRules.length > 0 ? (
              <dl className="mt-2 divide-y divide-app-border text-sm">
                {prizeRules.map((rule) => (
                  <RuleRow
                    key={rule.key}
                    label={rule.label}
                    value={currency.format(rule.amount)}
                  />
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-app-text-muted">
                No final prize amounts are configured.
              </p>
            )}
          </div>
        </Card>

        <Card className="min-w-0 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
            Published ordering
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">
            Standings tiebreakers
          </h2>
          <p className="mt-2 text-sm leading-6 text-app-text-muted">
            This is the exact order used by this companion&apos;s published table.
          </p>
          <ol className="mt-5 space-y-3">
            {STANDINGS_TIEBREAKERS.map((tiebreaker, index) => (
              <li className="flex items-start gap-3" key={tiebreaker}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-app-brand-soft text-xs font-black text-app-brand-strong">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-sm leading-6 text-app-text">
                  {tiebreaker}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-[var(--app-radius-sm)] bg-app-warning-soft px-3 py-2.5 text-xs leading-5 text-app-text-muted">
            This companion does not currently import ESPN&apos;s league-specific
            tiebreaker setting. If ESPN differs after points scored, ESPN&apos;s
            published seed remains authoritative.
          </p>
        </Card>

        <Card className="min-w-0 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
            Score operations
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">Source and timing</h2>
          <dl className="mt-5 divide-y divide-app-border text-sm">
            <RuleRow label="Score source" value={scoreSource.source} />
            <RuleRow label="Automatic check" value={scoreSource.automation} />
            <RuleRow label="Manual fallback" value="Available to the commissioner" />
          </dl>
          <p className="mt-4 rounded-[var(--app-radius-sm)] bg-app-info-soft px-3 py-2.5 text-xs leading-5 text-app-text-muted">
            Scores are imported only after ESPN reports a completed week and the
            payload passes team, matchup, and coverage validation. Wednesday
            automation also rechecks one prior week for late stat corrections.
            Manual entry remains available if ESPN cannot be reached, but ESPN
            can replace manual values in either automatically checked week.
          </p>
        </Card>
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
              This companion tracks
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-app-text">
              <li>• Dues status and the planned prize pool</li>
              <li>• Weekly scores, winners, and matchup results</li>
              <li>• Published standings, playoff position, and league history</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
              Fantasy platform remains responsible for
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-app-text">
              <li>• Drafts, rosters, trades, and waiver activity</li>
              <li>• Live scoring and official stat corrections</li>
              <li>• Platform-specific matchup and playoff settings</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-text hover:bg-app-surface-subtle"
          href={buildPageHref('standings')}
        >
          View standings
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--app-radius-sm)] bg-app-brand px-4 text-sm font-semibold text-white hover:bg-app-brand-strong"
          href={buildPageHref('prizes')}
        >
          View prize details
        </Link>
      </div>
    </main>
  )
}
