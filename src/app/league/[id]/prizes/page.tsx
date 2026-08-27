'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
import { useLeagueShell } from '@/components/league/LeagueShellContext'
import { PrizeMoneyOverview } from '@/components/prizes/PrizeMoneyOverview'
import { PayoutSummaryTable } from '@/components/prizes/PayoutSummaryTable'
import { SeasonAwardCards } from '@/components/prizes/SeasonAwardCards'
import { WeeklyPrizeWinners } from '@/components/prizes/WeeklyPrizeWinners'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { PageSkeleton, PageState } from '@/components/ui/PageState'
import { Toast } from '@/components/ui/Toast'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'
import {
  type FinanceAward,
  type FinanceSnapshot,
  loadFinanceSnapshot,
  performFinanceAction,
} from '@/lib/financeClient'
import { loadPrizeData } from '@/lib/prizeClient'
import type { PrizeMember, PrizeScore } from '@/lib/prizes'
import { buildPrizeViewModel } from '@/lib/prizeViewModel'

interface PrizesPageProps {
  params: Promise<{ id: string }>
}

function PrizePageSkeleton() {
  return (
    <PageSkeleton
      cardClassName="h-96"
      cardCount={2}
      gridClassName="gap-6 lg:grid-cols-2"
      heroClassName="h-56 bg-app-surface"
      label="Loading prizes"
    />
  )
}

export default function PrizesPage({ params }: PrizesPageProps) {
  const { id } = use(params)
  const {
    isLeagueLoading,
    isViewOnly,
    league,
    leagueLoadError,
    reloadLeague,
    selectedSeason,
  } = useLeagueShell()
  const [members, setMembers] = useState<PrizeMember[]>([])
  const [scores, setScores] = useState<PrizeScore[]>([])
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [finance, setFinance] = useState<FinanceSnapshot | null>(null)
  const [financeError, setFinanceError] = useState<string | null>(null)
  const [financeNotice, setFinanceNotice] = useState<string | null>(null)
  const [busyFinanceId, setBusyFinanceId] = useState<string | null>(null)
  const {
    error: seasonConfigError,
    loading: isSeasonConfigLoading,
    refetch: refetchSeasonConfig,
    seasonConfig,
  } = useSeasonConfig(id, selectedSeason)

  const loadPageData = useCallback(async () => {
    if (!selectedSeason) return
    setIsDataLoading(true)
    setDataError(null)
    setFinanceError(null)

    try {
      const snapshot = await loadPrizeData(id, selectedSeason)
      setMembers(snapshot.members)
      setScores(snapshot.scores)
      setFinance(snapshot.finance)
      setFinanceError(snapshot.financeError)
    } catch (error) {
      const message = getErrorMessage(error, 'Prize details could not be loaded.')
      setDataError(message)
      console.error('Failed to load prize details:', message)
    } finally {
      setIsDataLoading(false)
    }
  }, [id, selectedSeason])

  useEffect(() => {
    const loadTimer = window.setTimeout(loadPageData, 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadPageData])

  const refreshFinance = useCallback(async () => {
    if (!selectedSeason) return
    try {
      const snapshot = await loadFinanceSnapshot(id, selectedSeason)
      setFinance(snapshot)
      setFinanceError(null)
    } catch (error) {
      setFinanceError(getErrorMessage(error, 'Payout details could not be loaded.'))
    }
  }, [id, selectedSeason])

  const handleRecipientChange = async (
    award: FinanceAward,
    memberId: string | null,
  ) => {
    setBusyFinanceId(award.id)
    setFinanceError(null)
    setFinanceNotice(null)
    try {
      await performFinanceAction(id, {
        action: 'assign_award',
        award_id: award.id,
        member_id: memberId,
        season: selectedSeason,
      })
      await refreshFinance()
      setFinanceNotice(
        memberId ? `${award.label} recipient saved.` : `${award.label} cleared.`,
      )
    } catch (error) {
      setFinanceError(getErrorMessage(error, 'Recipient could not be saved.'))
    } finally {
      setBusyFinanceId(null)
    }
  }

  const handlePayoutStatus = async (
    payoutId: string,
    status: 'paid' | 'pending',
  ) => {
    setBusyFinanceId(payoutId)
    setFinanceError(null)
    setFinanceNotice(null)
    try {
      await performFinanceAction(id, {
        action: 'set_payout_status',
        payout_id: payoutId,
        season: selectedSeason,
        status,
      })
      await refreshFinance()
      setFinanceNotice(`Payout marked ${status}.`)
    } catch (error) {
      setFinanceError(getErrorMessage(error, 'Payout could not be updated.'))
    } finally {
      setBusyFinanceId(null)
    }
  }

  const settings = useMemo(
    () => ({
      draft_food_cost: seasonConfig?.draft_food_cost || 0,
      fee_amount: seasonConfig?.fee_amount || 0,
      final_winners: seasonConfig?.final_winners,
      prize_structure: seasonConfig?.prize_structure || {},
      total_weeks: seasonConfig?.total_weeks || 0,
      weekly_prize_amount: seasonConfig?.weekly_prize_amount || 0,
    }),
    [seasonConfig],
  )
  const viewModel = useMemo(
    () => buildPrizeViewModel({ finance, members, scores, settings }),
    [finance, members, scores, settings],
  )

  if (isLeagueLoading || isDataLoading || isSeasonConfigLoading) {
    return <PrizePageSkeleton />
  }

  if (!league) {
    return <LeagueUnavailable error={leagueLoadError} onRetry={reloadLeague} />
  }

  if (dataError) {
    return (
      <PageState
        action={<Button onClick={loadPageData}>Try again</Button>}
        description="Player payments and weekly scores could not both be loaded, so prize totals are hidden rather than showing an incomplete calculation."
        eyebrow={`${selectedSeason} season`}
        title="Prize details couldn’t be loaded"
        tone="danger"
      />
    )
  }

  const canManagePayouts = !isViewOnly && finance?.is_commissioner === true

  return (
    <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {seasonConfigError && (
        <Notice className="mb-5" tone="warning">
          {seasonConfigError} Prize amounts below use safe display defaults until the season is configured.
          <Button className="mt-3" onClick={refetchSeasonConfig} size="sm" variant="secondary">
            Retry season settings
          </Button>
        </Notice>
      )}
      {financeError && (
        <Notice className="mb-5 max-w-3xl" role="alert" tone="warning">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold">Payout tracking is temporarily unavailable</p>
              <p className="mt-0.5 leading-5 text-app-text-muted">
                The saved prize plan and calculated weekly winners are still shown below.
              </p>
            </div>
            <Button className="shrink-0 self-start sm:self-auto" onClick={refreshFinance} size="sm" variant="secondary">
              Retry
            </Button>
          </div>
        </Notice>
      )}
      <Toast message={financeNotice} onDismiss={() => setFinanceNotice(null)} />
      {members.length === 0 && (
        <Notice className="mb-5" tone="info">
          No active players are saved for this season. Prize rules remain visible, but collected and expected totals are $0 until the roster is added.
        </Notice>
      )}

      <PrizeMoneyOverview
        collectedFees={viewModel.collectedFees}
        expectedFees={viewModel.expectedFees}
        finalRules={viewModel.finalRules}
        outstandingFees={viewModel.outstandingFees}
        paidPlayers={viewModel.paidPlayers}
        partialPlayers={viewModel.partialPlayers}
        prizePlan={viewModel.prizePlan}
        selectedSeason={selectedSeason}
        totalWeeks={settings.total_weeks}
        weeklyPrizeAmount={settings.weekly_prize_amount}
      />
      <SeasonAwardCards
        awards={viewModel.seasonAwards}
        busyFinanceId={busyFinanceId}
        canManagePayouts={canManagePayouts}
        members={members}
        onPayoutStatusChange={handlePayoutStatus}
        onRecipientChange={handleRecipientChange}
        schemaReady={viewModel.usesCanonicalAwards}
      />
      <PayoutSummaryTable summaries={viewModel.playerWinnings} />
      <WeeklyPrizeWinners
        completedResults={viewModel.completedWeeklyResults}
        results={viewModel.weeklyResults}
        totalWeeks={settings.total_weeks}
      />
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
