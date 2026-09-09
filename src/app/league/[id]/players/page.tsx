'use client'

import { useRouter } from 'next/navigation'
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
import { useLeagueShell } from '@/components/league/LeagueShellContext'
import AddPlayerDialog from '@/components/players/AddPlayerDialog'
import EditTeamNameDialog from '@/components/players/EditTeamNameDialog'
import PaymentDetailsDialog from '@/components/players/PaymentDetailsDialog'
import { PlayerRosterSections } from '@/components/players/PlayerRosterSections'
import { PlayersOverview } from '@/components/players/PlayersOverview'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Notice } from '@/components/ui/Notice'
import { PageSkeleton, PageState } from '@/components/ui/PageState'
import { Toast } from '@/components/ui/Toast'
import { useReadOnlyRefresh } from '@/hooks/useReadOnlyRefresh'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'
import type { DuesStatus } from '@/lib/finance'
import {
  type FinanceSnapshot,
  performFinanceAction,
} from '@/lib/financeClient'
import {
  type PlayerDirectoryEntry,
  type PlayerMembership,
} from '@/lib/players'
import { performMemberAction } from '@/lib/memberClient'
import {
  applyConfirmedPaymentStatus,
  buildPlayerRosterViewModel,
  type DuesFilter,
  type PlayerRosterEntry,
} from '@/lib/playerRoster'
import { loadPlayerRoster } from '@/lib/playerRosterClient'

interface PlayersPageProps {
  params: Promise<{ id: string }>
}

function PlayersSkeleton() {
  return (
    <PageSkeleton
      cardClassName="h-64"
      heroClassName="h-52 bg-app-surface"
      label="Loading players"
    />
  )
}

export default function PlayersPage({ params }: PlayersPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const {
    isLeagueLoading,
    isViewOnly,
    league,
    leagueLoadError,
    reloadLeague,
    selectedSeason,
  } = useLeagueShell()
  const [memberships, setMemberships] = useState<PlayerMembership[]>([])
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [financeError, setFinanceError] = useState<string | null>(null)
  const [finance, setFinance] = useState<FinanceSnapshot | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [duesFilter, setDuesFilter] = useState<DuesFilter>('all')
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [paymentDialogError, setPaymentDialogError] = useState<string | null>(null)
  const [paymentDialogPlayer, setPaymentDialogPlayer] =
    useState<PlayerRosterEntry | null>(null)
  const [playerToDeactivate, setPlayerToDeactivate] =
    useState<PlayerRosterEntry | null>(null)
  const [playerToEdit, setPlayerToEdit] = useState<PlayerRosterEntry | null>(null)
  const [editTeamError, setEditTeamError] = useState<string | null>(null)
  const {
    error: seasonConfigError,
    refetch: refetchSeasonConfig,
    seasonConfig,
  } = useSeasonConfig(id, selectedSeason)

  const applyPaymentLocally = useCallback((
    memberId: string,
    status: DuesStatus,
    paidAmountCents?: number | null,
    notes?: string | null,
    paymentMethod?: string | null,
  ) => {
    setMemberships((currentMemberships) =>
      applyConfirmedPaymentStatus({
        finance: null,
        memberId,
        memberships: currentMemberships,
        notes,
        paidAmountCents,
        paymentMethod,
        status,
      }).memberships,
    )
    setFinance((currentFinance) =>
      applyConfirmedPaymentStatus({
        finance: currentFinance,
        memberId,
        memberships: [],
        notes,
        paidAmountCents,
        paymentMethod,
        status,
      }).finance,
    )
  }, [])

  const requestVersion = useRef(0)
  const fetchPlayers = useCallback(async (background = false) => {
    if (!selectedSeason) return

    const version = ++requestVersion.current
    if (!background) {
      setIsDataLoading(true)
      setDataError(null)
    }
    if (!background) setFinanceError(null)
    try {
      const snapshot = await loadPlayerRoster(id, selectedSeason)
      if (version !== requestVersion.current) return
      setDataError(null)
      setMemberships(snapshot.memberships)
      setFinance(snapshot.finance)
      setFinanceError(snapshot.financeError)
    } catch (error) {
      if (version !== requestVersion.current) return
      console.error('Failed to load players:', error)
      setDataError(
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Players could not be loaded.',
      )
      setMemberships([])
      setFinance(null)
    } finally {
      if (version === requestVersion.current) setIsDataLoading(false)
    }
  }, [id, selectedSeason])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => fetchPlayers(), 0)
    return () => {
      window.clearTimeout(loadTimer)
      requestVersion.current += 1
    }
  }, [fetchPlayers])

  useReadOnlyRefresh({
    enabled: isViewOnly,
    leagueId: id,
    season: selectedSeason,
    onRefresh: () => fetchPlayers(true),
  })

  const roster = useMemo(
    () =>
      buildPlayerRosterViewModel({
        duesFilter,
        finance,
        isViewOnly,
        memberships,
        search,
        selectedSeason,
      }),
    [duesFilter, finance, isViewOnly, memberships, search, selectedSeason],
  )
  const {
    currentPlayers,
    filteredCurrentPlayers,
    filteredFormerPlayers,
    formerPlayers,
    paidPlayers,
    partialPlayers,
    pendingPlayers,
    representedSeasons,
    returningPlayers,
  } = roster

  const handlePaymentChange = async (player: PlayerRosterEntry) => {
    if (!player.currentMemberId || !player.paymentStatus) return

    setBusyMemberId(player.currentMemberId)
    setDataError(null)
    setNotice(null)
    try {
      const payment = player.payment
      const currentStatus = player.duesStatus
      const nextStatus = currentStatus === 'paid' ? 'pending' : 'paid'

      if (finance?.schema_ready && payment) {
        await performFinanceAction(id, {
          action: 'set_payment',
          member_id: player.currentMemberId,
          notes: payment.notes,
          paid_amount_cents: nextStatus === 'pending' ? 0 : null,
          payment_method: payment.payment_method,
          season: selectedSeason,
          status: nextStatus,
        })
        applyPaymentLocally(player.currentMemberId, nextStatus)
        setNotice(`${player.managerName} marked ${nextStatus}.`)
      } else {
        const message = await performMemberAction(id, {
          action: 'set_payment',
          member_id: player.currentMemberId,
          payment_status: nextStatus,
          season: selectedSeason,
        })
        applyPaymentLocally(player.currentMemberId, nextStatus)
        setNotice(message)
      }
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Payment status could not be updated.',
      )
    } finally {
      setBusyMemberId(null)
    }
  }

  const handleDetailedPayment = async (details: {
    notes: string | null
    paid_amount_cents: number | null
    payment_method: string | null
    status: DuesStatus
  }) => {
    const memberId = paymentDialogPlayer?.currentMemberId
    if (!memberId) return

    setBusyMemberId(memberId)
    setPaymentDialogError(null)
    setNotice(null)
    try {
      await performFinanceAction(id, {
        action: 'set_payment',
        member_id: memberId,
        notes: details.notes,
        paid_amount_cents: details.paid_amount_cents,
        payment_method: details.payment_method,
        season: selectedSeason,
        status: details.status,
      })
      applyPaymentLocally(
        memberId,
        details.status,
        details.paid_amount_cents,
        details.notes,
        details.payment_method,
      )
      const playerName = paymentDialogPlayer.managerName
      setPaymentDialogPlayer(null)
      setNotice(`${playerName}’s payment details were saved.`)
    } catch (error) {
      setPaymentDialogError(
        error instanceof Error ? error.message : 'Payment could not be saved.',
      )
    } finally {
      setBusyMemberId(null)
    }
  }

  const handleActivate = async (player: PlayerDirectoryEntry) => {
    setBusyMemberId(player.sourceMemberId)
    setDataError(null)
    setNotice(null)
    try {
      const message = await performMemberAction(id, {
        action: 'activate',
        member_id: player.sourceMemberId,
        season: selectedSeason,
      })
      setNotice(message)
      await fetchPlayers()
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Player could not be added.',
      )
    } finally {
      setBusyMemberId(null)
    }
  }

  const handleAddPlayer = async (player: {
    manager_name: string
    team_name: string
  }) => {
    setIsAdding(true)
    setAddError(null)
    setNotice(null)
    try {
      const message = await performMemberAction(id, {
        action: 'add',
        manager_name: player.manager_name,
        season: selectedSeason,
        team_name: player.team_name,
      })
      setNotice(message)
      setIsAddDialogOpen(false)
      await fetchPlayers()
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : 'Player could not be added.',
      )
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeactivate = async () => {
    if (!playerToDeactivate?.currentMemberId) return

    const memberId = playerToDeactivate.currentMemberId
    setBusyMemberId(memberId)
    setDataError(null)
    setNotice(null)
    try {
      const message = await performMemberAction(id, {
        action: 'deactivate',
        member_id: memberId,
        season: selectedSeason,
      })
      setNotice(message)
      setPlayerToDeactivate(null)
      await fetchPlayers()
    } catch (error) {
      setPlayerToDeactivate(null)
      setDataError(
        error instanceof Error ? error.message : 'Player could not be removed.',
      )
    } finally {
      setBusyMemberId(null)
    }
  }

  const handleEditTeam = async (teamName: string) => {
    const memberId = playerToEdit?.currentMemberId
    if (!memberId) return

    setBusyMemberId(memberId)
    setEditTeamError(null)
    setNotice(null)
    try {
      const message = await performMemberAction(id, {
        action: 'edit_team',
        member_id: memberId,
        season: selectedSeason,
        team_name: teamName,
      })
      setNotice(message)
      setPlayerToEdit(null)
      await fetchPlayers()
    } catch (error) {
      setEditTeamError(error instanceof Error ? error.message : 'Team name could not be updated.')
    } finally {
      setBusyMemberId(null)
    }
  }

  if (isLeagueLoading || isDataLoading) return <PlayersSkeleton />

  if (!league) {
    return <LeagueUnavailable error={leagueLoadError} onRetry={reloadLeague} />
  }

  if (dataError && memberships.length === 0) {
    return (
      <PageState
        action={<Button onClick={() => void fetchPlayers()}>Try again</Button>}
        description="The roster could not be loaded. Existing players and payment statuses have not been changed."
        eyebrow={`${selectedSeason} season`}
        title="Players couldn’t be loaded"
        tone="danger"
      />
    )
  }

  return (
    <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {dataError && (
        <Notice className="mb-5" tone="danger">{dataError}</Notice>
      )}
      {financeError && (
        <Notice className="mb-5" role="alert" tone="warning">
          {isViewOnly ? 'Current dues status is temporarily unavailable. It will refresh automatically.' : `${financeError} Basic paid and unpaid controls remain available.`}
        </Notice>
      )}
      <Toast message={notice} onDismiss={() => setNotice(null)} />
      {seasonConfigError && (
        <Notice className="mb-5" tone="warning">
          {seasonConfigError} Expected dues use a safe $0 fee until the season is configured.
          <Button className="mt-3" onClick={refetchSeasonConfig} size="sm" variant="secondary">
            Retry season settings
          </Button>
        </Notice>
      )}

      <PlayersOverview
        alumniCount={formerPlayers.length}
        collectedAmount={
          finance?.summary
            ? finance.summary.collected_cents / 100
            : paidPlayers * (seasonConfig?.fee_amount || 0)
        }
        currentPlayerCount={currentPlayers.length}
        duesFilter={duesFilter}
        expectedAmount={
          finance?.summary
            ? finance.summary.expected_cents / 100
            : currentPlayers.length * (seasonConfig?.fee_amount || 0)
        }
        isViewOnly={isViewOnly}
        onAddPlayer={() => {
          setAddError(null)
          setIsAddDialogOpen(true)
        }}
        onImportSeason={() => router.push(`/league/${id}/season-import?season=${selectedSeason}`)}
        onEditMoney={() => router.push(`/league/${id}/settings?season=${selectedSeason}#season-money`)}
        onDuesFilterChange={setDuesFilter}
        onSearchChange={setSearch}
        paidPlayers={paidPlayers}
        partialPlayers={partialPlayers}
        pendingPlayers={pendingPlayers}
        representedSeasons={representedSeasons}
        returningPlayers={returningPlayers}
        search={search}
        selectedSeason={selectedSeason}
      />

      <PlayerRosterSections
        duesUnavailable={Boolean(financeError)}
        busyMemberId={busyMemberId}
        currentPlayerCount={currentPlayers.length}
        currentPlayers={filteredCurrentPlayers}
        formerPlayers={filteredFormerPlayers}
        isViewOnly={isViewOnly}
        onActivate={handleActivate}
        onDeactivate={setPlayerToDeactivate}
        onEditTeam={(player) => {
          setEditTeamError(null)
          setPlayerToEdit(player)
        }}
        onOpenPayment={(player) => {
          setPaymentDialogError(null)
          setPaymentDialogPlayer(player)
        }}
        onPaymentChange={handlePaymentChange}
        search={search}
        selectedSeason={selectedSeason}
      />

      {playerToEdit && (
        <EditTeamNameDialog
          busy={Boolean(playerToEdit.currentMemberId && busyMemberId === playerToEdit.currentMemberId)}
          error={editTeamError}
          managerName={playerToEdit.managerName}
          onClose={() => {
            if (busyMemberId) return
            setPlayerToEdit(null)
            setEditTeamError(null)
          }}
          onSubmit={(teamName) => void handleEditTeam(teamName)}
          teamName={playerToEdit.currentTeamName || ''}
        />
      )}

      {!isViewOnly && (
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-app-text-muted">
          League history keeps the same person together across seasons, even when their manager display or team name changes.
        </p>
      )}

      {!isViewOnly && isAddDialogOpen && (
        <AddPlayerDialog
          busy={isAdding}
          error={addError}
          onClose={() => {
            if (!isAdding) setIsAddDialogOpen(false)
          }}
          onSubmit={handleAddPlayer}
          open={isAddDialogOpen}
          season={selectedSeason}
        />
      )}
      {!isViewOnly && paymentDialogPlayer?.currentMemberId && (() => {
        const payment = paymentDialogPlayer.payment
        if (!payment) return null
        return (
          <PaymentDetailsDialog
            busy={busyMemberId === paymentDialogPlayer.currentMemberId}
            error={paymentDialogError}
            key={paymentDialogPlayer.currentMemberId}
            onClose={() => {
              if (!busyMemberId) setPaymentDialogPlayer(null)
            }}
            onSubmit={handleDetailedPayment}
            open
            payment={payment}
            playerName={paymentDialogPlayer.managerName}
          />
        )
      })()}
      <ConfirmDialog
        busy={Boolean(
          playerToDeactivate?.currentMemberId &&
            busyMemberId === playerToDeactivate.currentMemberId,
        )}
        confirmLabel="Remove from season"
        description={`Remove ${playerToDeactivate?.managerName || 'this player'} from the ${selectedSeason} active roster? This is allowed only before they have scores or matchups; historical data is never deleted.`}
        onClose={() => {
          if (!busyMemberId) setPlayerToDeactivate(null)
        }}
        onConfirm={handleDeactivate}
        open={Boolean(playerToDeactivate)}
        title="Remove player from this season?"
      />
    </main>
  )
}
