import type { League, LeagueSeason } from '@/lib/supabase'
import { normalizePlatformSyncHealth } from '@/lib/platformImport'

export interface PortfolioMemberRow {
  is_active: boolean | null
  league_id: string | null
  payment_status: string | null
  season: string | null
}

export interface PortfolioScoreRow {
  is_final_score: boolean | null
  league_id: string
  points: number
  season: string | null
  week_number: number
  week_status: string | null
}

export interface PortfolioLeague extends League {
  attentionReasons: string[]
  collectedAmount: number
  expectedAmount: number
  feeAmount: number
  latestWeek: number
  paidMembers: number
  pendingMembers: number
  totalMembers: number
  totalWeeks: number
}

export interface PortfolioSummary {
  activeLeagueCount: number
  attentionCount: number
  collectedAmount: number
  totalPlayers: number
}

interface PortfolioInput {
  leagues: League[]
  members: PortfolioMemberRow[]
  scores: PortfolioScoreRow[]
  seasons: LeagueSeason[]
}

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})

function scopeKey(leagueId: string, season: string) {
  return `${leagueId}\u0000${season}`
}

function prizeAllocation(season: LeagueSeason) {
  return (
    season.weekly_prize_amount * season.total_weeks +
    Object.values(season.prize_structure).reduce(
      (total, amount) => total + (Number(amount) || 0),
      0,
    )
  )
}

export function buildPortfolioLeagues({
  leagues,
  members,
  scores,
  seasons,
}: PortfolioInput): PortfolioLeague[] {
  const seasonByScope = new Map(
    seasons.map((season) => [
      scopeKey(season.league_id, season.season),
      season,
    ]),
  )
  const memberCounts = new Map<
    string,
    { paidMembers: number; totalMembers: number }
  >()
  const latestWeekByScope = new Map<string, number>()

  for (const member of members) {
    if (!member.league_id || !member.season || !member.is_active) continue
    const key = scopeKey(member.league_id, member.season)
    const counts = memberCounts.get(key) || { paidMembers: 0, totalMembers: 0 }
    counts.totalMembers += 1
    if (member.payment_status === 'paid') counts.paidMembers += 1
    memberCounts.set(key, counts)
  }

  for (const score of scores) {
    if (!score.season) continue
    if (
      score.week_status !== 'completed' &&
      !score.is_final_score &&
      Number(score.points) <= 0
    ) {
      continue
    }
    const key = scopeKey(score.league_id, score.season)
    latestWeekByScope.set(
      key,
      Math.max(latestWeekByScope.get(key) || 0, score.week_number),
    )
  }

  return leagues.map((league) => {
    const key = scopeKey(league.id, league.current_season)
    const season = seasonByScope.get(key)
    const counts = memberCounts.get(key) || { paidMembers: 0, totalMembers: 0 }
    const feeAmount = season?.fee_amount ?? 0
    const pendingMembers = counts.totalMembers - counts.paidMembers
    const expectedAmount = counts.totalMembers * feeAmount
    const collectedAmount = counts.paidMembers * feeAmount
    const availablePrizePool = expectedAmount - (season?.draft_food_cost ?? 0)
    const prizeDifference = season
      ? availablePrizePool - prizeAllocation(season)
      : 0
    const syncHealth = normalizePlatformSyncHealth({
      autoSyncEnabled: Boolean(league.auto_sync_enabled),
      lastSyncError: league.last_sync_error,
      syncStatus: league.sync_status || 'none',
      totalWeeks: season?.total_weeks ?? 0,
    })
    const attentionReasons = [
      !season ? 'Season configuration is missing' : null,
      syncHealth.syncStatus === 'error' ? 'The last score sync failed' : null,
      pendingMembers > 0
        ? `${pendingMembers} ${pendingMembers === 1 ? 'player has' : 'players have'} dues pending`
        : null,
      season && Math.abs(prizeDifference) > 0.01
        ? prizeDifference > 0
          ? `${currency.format(prizeDifference)} is not allocated to prizes`
          : `Prizes exceed the pool by ${currency.format(Math.abs(prizeDifference))}`
        : null,
    ].filter((reason): reason is string => Boolean(reason))

    return {
      ...league,
      last_sync_error: syncHealth.lastSyncError,
      sync_status: syncHealth.syncStatus,
      attentionReasons,
      collectedAmount,
      expectedAmount,
      feeAmount,
      latestWeek: latestWeekByScope.get(key) || 0,
      paidMembers: counts.paidMembers,
      pendingMembers,
      totalMembers: counts.totalMembers,
      totalWeeks: season?.total_weeks ?? 0,
    }
  })
}

export function summarizePortfolio(
  leagues: PortfolioLeague[],
): PortfolioSummary {
  return leagues.reduce<PortfolioSummary>(
    (summary, league) => {
      if (league.archived_at) return summary
      summary.activeLeagueCount += 1
      summary.attentionCount += Number(league.attentionReasons.length > 0)
      summary.collectedAmount += league.collectedAmount
      summary.totalPlayers += league.totalMembers
      return summary
    },
    {
      activeLeagueCount: 0,
      attentionCount: 0,
      collectedAmount: 0,
      totalPlayers: 0,
    },
  )
}
