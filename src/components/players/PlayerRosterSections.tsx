import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { PlayerDirectoryEntry } from '@/lib/players'
import type { PlayerRosterEntry } from '@/lib/playerRoster'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  style: 'currency',
})

function Initials({ managerName }: { managerName: string }) {
  const initials = managerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-brand-soft text-sm font-black text-app-brand-strong">
      {initials || '?'}
    </span>
  )
}

function SeasonChips({ seasons }: { seasons: string[] }) {
  return (
    <div aria-label="Seasons played" className="flex flex-wrap gap-1.5">
      {seasons.map((season) => (
        <span
          className="rounded-full bg-app-surface-subtle px-2.5 py-1 text-xs font-semibold text-app-text-muted"
          key={season}
        >
          {season}
        </span>
      ))}
    </div>
  )
}

interface PlayerRosterSectionsProps {
  busyMemberId: string | null
  currentPlayerCount: number
  currentPlayers: PlayerRosterEntry[]
  formerPlayers: PlayerDirectoryEntry[]
  isViewOnly: boolean
  onActivate: (player: PlayerDirectoryEntry) => void
  onDeactivate: (player: PlayerRosterEntry) => void
  onOpenPayment: (player: PlayerRosterEntry) => void
  onPaymentChange: (player: PlayerRosterEntry) => void
  search: string
  selectedSeason: string
}

export function PlayerRosterSections({
  busyMemberId,
  currentPlayerCount,
  currentPlayers,
  formerPlayers,
  isViewOnly,
  onActivate,
  onDeactivate,
  onOpenPayment,
  onPaymentChange,
  search,
  selectedSeason,
}: PlayerRosterSectionsProps) {
  return (
    <>
      <section aria-labelledby="current-roster-heading" className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
              Current season
            </p>
            <h2 className="mt-1 text-2xl font-bold text-app-text" id="current-roster-heading">
              Active roster
            </h2>
          </div>
          <Badge variant="info">{currentPlayers.length} shown</Badge>
        </div>

        {currentPlayers.length > 0 ? (
          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {currentPlayers.map((player) => {
              const previousTeamNames = player.teamNames.filter(
                (teamName) => teamName !== player.currentTeamName,
              )
              const isBusy = busyMemberId === player.currentMemberId

              return (
                <Card className="flex min-w-0 flex-col p-4 sm:p-5" key={player.currentMemberId}>
                  <div className="flex min-w-0 items-start gap-3">
                    <Initials managerName={player.managerName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="break-words font-bold text-app-text">
                            {player.currentTeamName}
                          </h3>
                          <p className="mt-0.5 break-words text-sm text-app-text-muted">
                            {player.managerName}
                          </p>
                        </div>
                        {!isViewOnly && (
                          <Badge variant={player.duesStatus === 'paid' ? 'success' : 'warning'}>
                            {player.duesStatus === 'paid'
                              ? 'Paid'
                              : player.duesStatus === 'partial'
                                ? `${currency.format((player.payment?.paid_amount_cents || 0) / 100)} partial`
                                : 'Pending'}
                          </Badge>
                        )}
                      </div>
                      {player.division && (
                        <Badge className="mt-2" variant="neutral">
                          {player.division}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-app-border pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
                      League history
                    </p>
                    <SeasonChips seasons={player.seasons} />
                    {previousTeamNames.length > 0 && (
                      <p className="mt-3 break-words text-xs leading-5 text-app-text-muted">
                        Previous teams: {previousTeamNames.join(', ')}
                      </p>
                    )}
                  </div>

                  {!isViewOnly && (
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                      <Button
                        className="col-span-2"
                        disabled={isBusy}
                        onClick={() => onPaymentChange(player)}
                        variant={player.duesStatus === 'paid' ? 'secondary' : 'primary'}
                      >
                        {isBusy
                          ? 'Updating…'
                          : player.duesStatus === 'paid'
                            ? 'Mark pending'
                            : 'Mark paid'}
                      </Button>
                      {player.payment ? (
                        <Button
                          disabled={isBusy}
                          onClick={() => onOpenPayment(player)}
                          variant="secondary"
                        >
                          Payment details
                        </Button>
                      ) : (
                        <span />
                      )}
                      <Button
                        className="text-app-danger hover:bg-app-danger-soft hover:text-app-danger"
                        disabled={isBusy}
                        onClick={() => onDeactivate(player)}
                        variant="ghost"
                      >
                        Remove from season
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="mt-4 border-dashed p-8 text-center">
            <p className="font-semibold text-app-text">
              {currentPlayerCount === 0 && !search
                ? `No players in ${selectedSeason}`
                : 'No roster matches'}
            </p>
            <p className="mt-1 text-sm text-app-text-muted">
              {currentPlayerCount === 0 && !search
                ? isViewOnly
                  ? 'The commissioner has not published this season’s roster yet.'
                  : 'Add a new player or bring back someone from league history.'
                : 'Try another search or dues filter.'}
            </p>
          </Card>
        )}
      </section>

      <section aria-labelledby="league-history-heading" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
              League history
            </p>
            <h2 className="mt-1 text-2xl font-bold text-app-text" id="league-history-heading">
              {isViewOnly ? 'Past participants' : 'Available players'}
            </h2>
          </div>
          <Badge variant="neutral">{formerPlayers.length} shown</Badge>
        </div>

        {formerPlayers.length > 0 ? (
          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {formerPlayers.map((player) => (
              <Card className="flex min-w-0 flex-col p-4 sm:p-5" key={player.sourceMemberId}>
                <div className="flex min-w-0 items-start gap-3">
                  <Initials managerName={player.managerName} />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-bold text-app-text">
                      {player.managerName}
                    </h3>
                    <p className="mt-1 break-words text-sm text-app-text-muted">
                      {player.teamNames.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-app-border pt-4">
                  <SeasonChips seasons={player.seasons} />
                </div>
                {!isViewOnly && (
                  <Button
                    className="mt-5 w-full"
                    disabled={busyMemberId === player.sourceMemberId}
                    onClick={() => onActivate(player)}
                    variant="secondary"
                  >
                    {busyMemberId === player.sourceMemberId
                      ? 'Adding…'
                      : `Add to ${selectedSeason}`}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4 border-dashed p-8 text-center">
            <p className="font-semibold text-app-text">
              {search ? 'No historical players match' : 'No former players'}
            </p>
            <p className="mt-1 text-sm text-app-text-muted">
              {search
                ? 'Try a different manager, team, or season.'
                : 'Players from earlier seasons will appear here.'}
            </p>
          </Card>
        )}
      </section>
    </>
  )
}
