import {
  calculatePlayoffSeeds,
  calculateStandings,
  resolveDivisionNames,
  type StandingsMatchup,
  type StandingsMember,
  type StandingsScore,
} from '@/lib/standings'

export interface LeagueHistorySeason {
  divisions: unknown
  final_winners: unknown
  playoff_spots: number
  playoff_start_week: number
  season: string
  total_weeks: number
}

export interface LeagueHistoryMember extends StandingsMember {
  manager_id?: string | null
  season: string
}

export interface LeagueHistoryScore extends StandingsScore {
  season: string
}

export interface LeagueHistoryMatchup extends StandingsMatchup {
  season: string
}

export interface LeagueHistorySnapshot {
  matchups: LeagueHistoryMatchup[]
  members: LeagueHistoryMember[]
  scores: LeagueHistoryScore[]
  seasons: LeagueHistorySeason[]
}

export interface LeagueHistoryRow {
  champion: LeagueHistoryMember | null
  playoffTeams: LeagueHistoryMember[]
  runnerUp: LeagueHistoryMember | null
  season: string
  status: 'complete' | 'in-progress'
  thirdPlace: LeagueHistoryMember | null
}

function finalWinnerIds(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && Boolean(entry[1]),
  )
  return Object.fromEntries(entries)
}

export function buildLeagueHistoryRows(
  snapshot: LeagueHistorySnapshot,
): LeagueHistoryRow[] {
  return [...snapshot.seasons]
    .sort((left, right) => right.season.localeCompare(left.season))
    .map((seasonConfig) => {
      const members = snapshot.members.filter(
        (member) => member.season === seasonConfig.season,
      )
      const memberById = new Map(members.map((member) => [member.id, member]))
      const scores = snapshot.scores.filter(
        (score) => score.season === seasonConfig.season,
      )
      const matchups = snapshot.matchups.filter(
        (matchup) => matchup.season === seasonConfig.season,
      )
      const regularSeasonEnd = Math.max(
        1,
        Math.min(
          seasonConfig.total_weeks || 17,
          (seasonConfig.playoff_start_week || 15) - 1,
        ),
      )
      const standings = calculateStandings(
        members,
        scores,
        matchups,
        regularSeasonEnd,
      )
      const divisions = resolveDivisionNames(seasonConfig.divisions, members)
      const playoffTeams = calculatePlayoffSeeds(
        standings,
        divisions,
        seasonConfig.playoff_spots || 0,
      ).flatMap((seed) => {
        const member = memberById.get(seed.team_id)
        return member ? [member] : []
      })
      const winners = finalWinnerIds(seasonConfig.final_winners)
      const champion = memberById.get(winners.first) || null

      return {
        champion,
        playoffTeams,
        runnerUp: memberById.get(winners.second) || null,
        season: seasonConfig.season,
        status: champion ? 'complete' : 'in-progress',
        thirdPlace: memberById.get(winners.third) || null,
      }
    })
}
