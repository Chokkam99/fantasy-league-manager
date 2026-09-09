import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { PlayerDirectoryEntry } from '@/lib/players'
import type { PlayerRosterEntry } from '@/lib/playerRoster'

function Initials({ managerName }: { managerName: string }) {
  const initials = managerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-brand-soft text-xs font-black text-app-brand-strong">
      {initials || '?'}
    </span>
  )
}

function DuesStatusToggle({
  disabled,
  onClick,
  player,
}: {
  disabled: boolean
  onClick: () => void
  player: PlayerRosterEntry
}) {
  const isPaid = player.duesStatus === 'paid'
  const visibleStatus = isPaid ? 'Paid' : 'Unpaid'
  const action = isPaid
    ? `Mark ${player.managerName} unpaid`
    : `Mark ${player.managerName} paid`

  return (
    <button
      aria-label={action}
      aria-pressed={isPaid}
      className={`inline-flex min-h-10 w-[5.5rem] items-center justify-center gap-2 rounded-full border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        isPaid
          ? 'border-app-success/25 bg-app-success-soft text-app-success'
          : 'border-app-border bg-app-surface text-app-text-muted hover:text-app-text'
      }`}
      disabled={disabled}
      onClick={onClick}
      title={action}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
          isPaid
            ? 'border-app-success bg-app-success text-white'
            : 'border-current'
        }`}
      >
        {isPaid && (
          <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="m5 12 4 4L19 6" />
          </svg>
        )}
      </span>
      {disabled ? 'Saving…' : visibleStatus}
    </button>
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
  duesUnavailable?: boolean
  busyMemberId: string | null
  currentPlayerCount: number
  currentPlayers: PlayerRosterEntry[]
  formerPlayers: PlayerDirectoryEntry[]
  isViewOnly: boolean
  onActivate: (player: PlayerDirectoryEntry) => void
  onDeactivate: (player: PlayerRosterEntry) => void
  onEditTeam: (player: PlayerRosterEntry) => void
  onOpenPayment: (player: PlayerRosterEntry) => void
  onPaymentChange: (player: PlayerRosterEntry) => void
  search: string
  selectedSeason: string
}

export function PlayerRosterSections({
  duesUnavailable = false,
  busyMemberId,
  currentPlayerCount,
  currentPlayers,
  formerPlayers,
  isViewOnly,
  onActivate,
  onDeactivate,
  onEditTeam,
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
            <h2 className="mt-1 text-xl font-bold text-app-text sm:text-2xl" id="current-roster-heading">
              Active roster
            </h2>
          </div>
          <Badge variant="info">{currentPlayers.length} shown</Badge>
        </div>

        {currentPlayers.length > 0 ? (
          <Card className="mt-4 min-w-0 overflow-hidden">
            {currentPlayers.map((player) => {
              const previousTeamNames = player.teamNames.filter(
                (teamName) => teamName !== player.currentTeamName,
              )
              const isBusy = busyMemberId === player.currentMemberId
              const publicStatus = duesUnavailable ? 'Unavailable' : player.duesStatus === 'paid' ? 'Paid' : 'Unpaid'

              return (
                <article
                  className="grid min-w-0 gap-3 border-b border-app-border p-3 last:border-b-0 sm:grid-cols-[minmax(0,1.25fr)_minmax(10rem,0.9fr)_13rem] sm:items-center sm:px-4"
                  key={player.currentMemberId}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Initials managerName={player.managerName} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-app-text">
                        {player.currentTeamName}
                      </h3>
                      <p className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-app-text-muted">
                        <span className="truncate">{player.managerName}</span>
                        {player.division && (
                          <span className="shrink-0">· {player.division}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 sm:border-l sm:border-app-border sm:pl-4">
                    <SeasonChips seasons={player.seasons} />
                    {previousTeamNames.length > 0 && (
                      <p className="mt-1.5 truncate text-xs text-app-text-muted">
                        Previously: {previousTeamNames.join(', ')}
                      </p>
                    )}
                  </div>

                  {isViewOnly && (
                    <div className="sm:justify-self-end">
                      <Badge
                        aria-label={`Dues for ${player.managerName}: ${publicStatus}`}
                        variant={duesUnavailable ? 'neutral' : player.duesStatus === 'paid' ? 'success' : 'neutral'}
                      >
                        Dues: {publicStatus}
                      </Badge>
                    </div>
                  )}
                  {!isViewOnly && (
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <DuesStatusToggle
                        disabled={isBusy}
                        onClick={() => onPaymentChange(player)}
                        player={player}
                      />
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          aria-label={`Edit team name for ${player.managerName}`}
                          disabled={isBusy}
                          onClick={() => onEditTeam(player)}
                          size="compactIcon"
                          title="Edit team name"
                          variant="ghost"
                        >
                          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
                            <path d="m14 7 3 3" />
                          </svg>
                        </Button>
                        {player.payment && (
                          <Button
                            aria-label={`Payment details for ${player.managerName}`}
                            disabled={isBusy}
                            onClick={() => onOpenPayment(player)}
                            size="compactIcon"
                            title="Payment details"
                            variant="ghost"
                          >
                            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M5 4h14v16H5zM8 8h8M8 12h5M8 16h3" />
                            </svg>
                          </Button>
                        )}
                        <Button
                          aria-label={`Remove ${player.managerName} from ${selectedSeason}`}
                          disabled={isBusy}
                          onClick={() => onDeactivate(player)}
                          size="compactIcon"
                          title={`Remove from ${selectedSeason}`}
                          variant="dangerGhost"
                        >
                          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="9" cy="8" r="3" />
                            <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 11h5" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </Card>
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
            <h2 className="mt-1 text-xl font-bold text-app-text sm:text-2xl" id="league-history-heading">
              {isViewOnly ? 'Past participants' : 'Available players'}
            </h2>
          </div>
          <Badge variant="neutral">{formerPlayers.length} shown</Badge>
        </div>

        {formerPlayers.length > 0 ? (
          <Card className="mt-4 min-w-0 overflow-hidden">
            {formerPlayers.map((player) => (
              <article
                className="grid min-w-0 gap-3 border-b border-app-border p-3 last:border-b-0 sm:grid-cols-[minmax(0,1.25fr)_minmax(10rem,0.9fr)_auto] sm:items-center sm:px-4"
                key={player.sourceMemberId}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Initials managerName={player.managerName} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-app-text">
                      {player.managerName}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-app-text-muted">
                      {player.teamNames.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 sm:border-l sm:border-app-border sm:pl-4">
                  <SeasonChips seasons={player.seasons} />
                </div>
                {!isViewOnly && (
                  <div className="flex justify-end">
                    <Button
                      aria-label={
                        busyMemberId === player.sourceMemberId
                          ? `Adding ${player.managerName} to ${selectedSeason}`
                          : `Add ${player.managerName} to ${selectedSeason}`
                      }
                      disabled={busyMemberId === player.sourceMemberId}
                      onClick={() => onActivate(player)}
                      size="compactIcon"
                      title={`Add to ${selectedSeason}`}
                      variant="secondary"
                    >
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </Card>
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
