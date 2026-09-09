'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Notice } from '@/components/ui/Notice'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'
import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'
import type { ScoreRosterMember } from '@/lib/scoresClient'
import {
  loadWeeklyScoresData,
  type WeeklyMatchupSummary,
  type WeeklyScoreSummary,
} from '@/lib/weeklyScoresClient'
import { buildWeeklyRanking } from '@/lib/weeklyRanking'

interface ManualScoreResponse {
  error?: string
  message?: string
  success: boolean
  week?: number
}

interface WeeklyScoresProps {
  initialWeek?: number
  leagueId: string
  members: ScoreRosterMember[]
  readOnly?: boolean
  season?: string
}

type Notice = { kind: 'error' | 'success'; message: string } | null

function formatPoints(points: number | null) {
  return points === null ? '-' : points.toFixed(2)
}

export default function WeeklyScores({
  initialWeek = 1,
  leagueId,
  members,
  readOnly = false,
  season,
}: WeeklyScoresProps) {
  const currentSeason = season || members[0]?.season || ''
  const {
    error: seasonConfigError,
    refetch: refetchSeasonConfig,
    seasonConfig,
  } = useSeasonConfig(leagueId, currentSeason)
  const [selectedWeek, setSelectedWeek] = useState(initialWeek)
  const [weeklyScores, setWeeklyScores] = useState<WeeklyScoreSummary[]>([])
  const [matchups, setMatchups] = useState<WeeklyMatchupSummary[]>([])
  const [draftScores, setDraftScores] = useState<Record<string, string>>({})
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [showClearWeekConfirm, setShowClearWeekConfirm] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const requestVersion = useRef(0)
  const loadWeekData = useCallback(async () => {
    if (!currentSeason) return

    const version = ++requestVersion.current
    setIsDataLoading(true)
    setLoadError(null)

    try {
      const snapshot = await loadWeeklyScoresData(
        leagueId,
        currentSeason,
        selectedWeek,
      )
      if (version !== requestVersion.current) return
      const loadedScores = snapshot.scores
      const scoreByMember = new Map(
        loadedScores.map((score) => [score.member_id, Number(score.points)]),
      )

      setWeeklyScores(loadedScores)
      setMatchups(snapshot.matchups)
      setDraftScores(
        Object.fromEntries(
          members.map((member) => [
            member.id,
            scoreByMember.has(member.id)
              ? String(scoreByMember.get(member.id))
              : '',
          ]),
        ),
      )
    } catch (error) {
      if (version !== requestVersion.current) return
      console.error('Failed to load weekly scores:', error)
      setLoadError('This week could not be loaded. Try again in a moment.')
    } finally {
      if (version === requestVersion.current) setIsDataLoading(false)
    }
  }, [currentSeason, leagueId, members, selectedWeek])

  useEffect(() => {
    loadWeekData()
    return () => { requestVersion.current += 1 }
  }, [loadWeekData])

  useEffect(() => {
    const refreshImportedWeek = (event: Event) => {
      const importedWeek = (event as CustomEvent<{ week?: number }>).detail?.week

      if (importedWeek && importedWeek !== selectedWeek) {
        setSelectedWeek(importedWeek)
        setIsEditing(false)
        return
      }

      loadWeekData()
    }

    window.addEventListener('league-scores-imported', refreshImportedWeek)
    return () =>
      window.removeEventListener('league-scores-imported', refreshImportedWeek)
  }, [loadWeekData, selectedWeek])

  const scoreByMember = useMemo(
    () =>
      new Map(
        weeklyScores.map((score) => [score.member_id, Number(score.points)]),
      ),
    [weeklyScores],
  )

  const rankedMembers = useMemo(() => {
    return buildWeeklyRanking(members, weeklyScores)
  }, [members, weeklyScores])

  const weeklyLeaders = rankedMembers.filter((entry) => entry.rank === 1)
  const completedScoreCount = weeklyScores.filter((score) =>
    Number.isFinite(Number(score.points)),
  ).length
  const totalWeeks = seasonConfig?.total_weeks || 17
  const weeklyPrize = seasonConfig?.weekly_prize_amount || 0

  const changeWeek = (week: number) => {
    setSelectedWeek(week)
    setIsEditing(false)
    setNotice(null)
  }

  const beginEditing = () => {
    setDraftScores(
      Object.fromEntries(
        members.map((member) => [
          member.id,
          scoreByMember.has(member.id)
            ? String(scoreByMember.get(member.id))
            : '',
        ]),
      ),
    )
    setNotice(null)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setNotice(null)
  }

  const saveWeek = async () => {
    const scores = members.map((member) => ({
      member_id: member.id,
      points: Number(draftScores[member.id]),
      raw: draftScores[member.id]?.trim() || '',
    }))

    if (
      scores.some(
        (score) => !score.raw || !Number.isFinite(score.points),
      )
    ) {
      setNotice({
        kind: 'error',
        message: 'Enter a valid score for every active player before saving.',
      })
      return
    }

    setIsSaving(true)
    setNotice(null)

    try {
      const response = await fetch(`/api/leagues/${leagueId}/scores/manual`, {
        body: JSON.stringify({
          action: 'save_week',
          scores: scores.map(({ member_id, points }) => ({ member_id, points })),
          season: currentSeason,
          week: selectedWeek,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = (await response.json()) as ManualScoreResponse

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'The week could not be saved.')
      }

      setIsEditing(false)
      setNotice({
        kind: 'success',
        message: payload.message || `Week ${selectedWeek} scores saved.`,
      })
      invalidateLeagueReadCache(leagueId, currentSeason)
      invalidateFinanceCache(leagueId, currentSeason)
      await loadWeekData()
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'The week could not be saved.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const clearWeek = async () => {
    setIsClearing(true)
    setNotice(null)

    try {
      const response = await fetch(`/api/leagues/${leagueId}/scores/manual`, {
        body: JSON.stringify({
          action: 'clear_week',
          season: currentSeason,
          week: selectedWeek,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = (await response.json()) as ManualScoreResponse

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'The week could not be cleared.')
      }

      setShowClearWeekConfirm(false)
      setIsEditing(false)
      setNotice({
        kind: 'success',
        message: payload.message || `Week ${selectedWeek} scores cleared.`,
      })
      invalidateLeagueReadCache(leagueId, currentSeason)
      invalidateFinanceCache(leagueId, currentSeason)
      await loadWeekData()
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'The week could not be cleared.',
      })
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <>
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-app-border p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">
                Weekly results
              </p>
              <h2 className="mt-1 text-xl font-semibold text-app-text">
                Week {selectedWeek} ranking
              </h2>
              <p className="mt-1 text-sm text-app-text-muted">
                {completedScoreCount} of {members.length} scores recorded
              </p>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
              <label className="sr-only" htmlFor="weekly-score-week">Week</label>
              <div className="relative w-28 shrink-0">
                <select
                  className="min-h-11 w-full appearance-none rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface py-2 pl-3 pr-9 text-base font-semibold text-app-text outline-none focus:border-app-brand focus:ring-2 focus:ring-app-brand-soft sm:text-sm"
                  disabled={isSaving || isClearing || isEditing}
                  id="weekly-score-week"
                  onChange={(event) => changeWeek(Number(event.target.value))}
                  value={selectedWeek}
                >
                  {Array.from({ length: totalWeeks }, (_, index) => index + 1).map((week) => (
                    <option key={week} value={week}>Week {week}</option>
                  ))}
                </select>
                <SelectChevron />
              </div>
              {!readOnly && !isEditing && (
                <Button disabled={isDataLoading || members.length === 0} onClick={beginEditing} variant="secondary">
                  Edit scores
                </Button>
              )}
            </div>
          </div>
        </div>

        {seasonConfigError && (
          <Notice className="mx-4 mt-4 sm:mx-6" tone="warning">
            {seasonConfigError} Week count and weekly-prize values use safe display defaults.
            <Button className="mt-3" onClick={refetchSeasonConfig} size="sm" variant="secondary">
              Retry season settings
            </Button>
          </Notice>
        )}

        {notice && (
          <Notice
            className="mx-4 mt-4 sm:mx-6"
            tone={notice.kind === 'error' ? 'danger' : 'success'}
          >
            {notice.message}
          </Notice>
        )}

        {loadError && (
          <Notice className="m-4 sm:m-6" tone="danger">
            {loadError}
            <Button className="mt-3" onClick={loadWeekData} size="sm" variant="secondary">Try again</Button>
          </Notice>
        )}

        {!loadError && isDataLoading && (
          <SkeletonGroup label="Loading weekly results" className="space-y-3 p-4 sm:p-6">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-16" key={index} />
            ))}
          </SkeletonGroup>
        )}

        {!loadError && !isDataLoading && isEditing && (
          <div className="p-4 sm:p-6">
            <div className="rounded-[var(--app-radius-sm)] border border-app-border">
              {members.map((member, index) => (
                <label
                  className={`grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:p-4 ${
                    index > 0 ? 'border-t border-app-border' : ''
                  }`}
                  key={member.id}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-app-text">{member.team_name}</span>
                    <span className="mt-0.5 block truncate text-xs text-app-text-muted">{member.manager_name}</span>
                  </span>
                  <span className="relative">
                    <input
                      aria-label={`Score for ${member.manager_name}`}
                      className="min-h-11 w-full rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 pr-8 text-right font-mono text-base font-semibold text-app-text outline-none focus:border-app-brand focus:ring-2 focus:ring-app-brand/20 sm:text-sm"
                      disabled={isSaving || isClearing}
                      inputMode="decimal"
                      onChange={(event) =>
                        setDraftScores((current) => ({
                          ...current,
                          [member.id]: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={draftScores[member.id] || ''}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-app-text-muted">pts</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="sticky bottom-20 z-20 -mx-4 mt-4 border-y border-app-border bg-app-surface/95 p-3 shadow-[var(--app-shadow-md)] backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              <Button
                className="mb-2 w-full sm:mb-0 sm:w-auto"
                disabled={isSaving || isClearing || weeklyScores.length === 0}
                onClick={() => setShowClearWeekConfirm(true)}
                variant="ghost"
              >
                Clear this week
              </Button>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button disabled={isSaving || isClearing} onClick={cancelEditing} variant="secondary">Cancel</Button>
                <Button disabled={isSaving || isClearing} onClick={saveWeek}>
                  {isSaving ? 'Saving…' : `Save week ${selectedWeek}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {!loadError && !isDataLoading && !isEditing && (
          <div className="p-4 sm:p-6">
            {weeklyLeaders.length > 0 && (
              <div className="mb-5 grid gap-3 rounded-[var(--app-radius-md)] border border-app-ink bg-app-ink p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-app-lime">
                    {weeklyLeaders.length > 1 ? 'Tied weekly leaders' : 'Weekly leader'}
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {weeklyLeaders.map(({ member }) => member.team_name).join(' · ')}
                  </p>
                  <p className="mt-0.5 text-sm text-white/65">
                    {weeklyLeaders.map(({ member }) => member.manager_name).join(' · ')}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="font-mono text-xl font-bold text-app-lime sm:text-2xl">
                    {formatPoints(weeklyLeaders[0].points)}
                  </p>
                  {weeklyPrize > 0 && (
                    <p className="text-xs font-semibold text-app-lime">${weeklyPrize} weekly prize</p>
                  )}
                </div>
              </div>
            )}

            {completedScoreCount === 0 ? (
              <div className="rounded-[var(--app-radius-sm)] border border-dashed border-app-border p-6 text-center">
                <p className="font-semibold text-app-text">No scores recorded for week {selectedWeek}</p>
                <p className="mt-1 text-sm leading-6 text-app-text-muted">
                  {readOnly
                    ? 'The commissioner has not published this week yet.'
                    : 'Import the completed ESPN week or use Edit scores for manual entry.'}
                </p>
              </div>
            ) : (
              <ol className="overflow-hidden rounded-[var(--app-radius-sm)] border border-app-border">
                {rankedMembers.map(({ member, points, rank }, index) => (
                  <li
                    className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 p-3 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-4 sm:p-4 ${
                      index > 0 ? 'border-t border-app-border' : ''
                    } ${rank === 1 ? 'bg-app-brand-soft/60' : 'bg-app-surface'}`}
                    key={member.id}
                  >
                    <span className="font-mono text-sm font-semibold text-app-text-muted">
                      {rank ? `#${rank}` : '-'}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-app-text">{member.team_name}</span>
                        {rank === 1 && <Badge variant="success">Leader</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-app-text-muted">{member.manager_name}</span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-base font-bold text-app-text sm:text-lg">
                      {formatPoints(points)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-8 overflow-hidden">
        <div className="border-b border-app-border p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-brand-strong">Head to head</p>
              <h2 className="mt-1 text-xl font-semibold text-app-text">Week {selectedWeek} matchups</h2>
            </div>
            <Badge variant={matchups.length > 0 ? 'neutral' : 'warning'}>
              {matchups.length} matchup{matchups.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </div>

        {isDataLoading ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton className="h-36" key={index} />
            ))}
          </div>
        ) : matchups.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-semibold text-app-text">No matchup schedule found</p>
            <p className="mt-1 text-sm leading-6 text-app-text-muted">
              Scores can still be ranked even when this week has no saved matchups.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
            {matchups.map((matchup, index) => {
              const team1 = members.find((member) => member.id === matchup.team1_member_id)
              const team2 = members.find((member) => member.id === matchup.team2_member_id)
              const team1Score = matchup.team1_score ?? scoreByMember.get(matchup.team1_member_id) ?? null
              const team2Score = matchup.team2_score ?? scoreByMember.get(matchup.team2_member_id) ?? null
              const isComplete = team1Score !== null && team2Score !== null
              const isFinal = isComplete && [matchup.team1_member_id, matchup.team2_member_id].every((memberId) => {
                const score = weeklyScores.find((record) => record.member_id === memberId)
                return score && (score.is_final_score === true || score.week_status === 'completed' ||
                  (score.is_final_score == null && score.week_status == null))
              })
              const team1Won = isFinal && matchup.winner_member_id === matchup.team1_member_id
              const team2Won = isFinal && matchup.winner_member_id === matchup.team2_member_id

              return (
                <article className="rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface" key={matchup.id}>
                  <div className="flex items-center justify-between border-b border-app-border px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">Matchup {index + 1}</p>
                    <Badge variant={!isFinal ? 'warning' : matchup.is_tie ? 'info' : 'success'}>
                      {!isComplete ? 'Pending' : !isFinal ? 'In progress' : matchup.is_tie ? 'Tie' : 'Final'}
                    </Badge>
                  </div>
                  {[
                    { member: team1, points: team1Score, won: team1Won },
                    { member: team2, points: team2Score, won: team2Won },
                  ].map((team, teamIndex) => (
                    <div
                      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 ${
                        teamIndex > 0 ? 'border-t border-app-border' : ''
                      } ${team.won ? 'bg-app-brand-soft/60' : ''}`}
                      key={team.member?.id || `unknown-${teamIndex}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-app-text">{team.member?.team_name || 'Unknown team'}</p>
                          {team.won && <Badge variant="success">Winner</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-app-text-muted">{team.member?.manager_name || 'Unmapped player'}</p>
                      </div>
                      <p className="font-mono text-lg font-bold text-app-text">{formatPoints(team.points)}</p>
                    </div>
                  ))}
                </article>
              )
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        busy={isClearing}
        confirmLabel={`Clear week ${selectedWeek}`}
        description={`This permanently deletes every saved score for week ${selectedWeek} of the ${currentSeason} season. Matchup scheduling remains intact, but this action cannot be undone.`}
        onClose={() => setShowClearWeekConfirm(false)}
        onConfirm={clearWeek}
        open={showClearWeekConfirm}
        title={`Clear week ${selectedWeek} scores?`}
        tone="warning"
      />
    </>
  )
}

function SelectChevron() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-text-muted"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}
