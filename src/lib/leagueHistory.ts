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
  is_active?: boolean | null
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

export type LeagueHistoryResult =
  | 'champion'
  | 'runner-up'
  | 'third'
  | 'playoff'
  | 'participant'

export interface LeagueHistoryMatrixCell {
  result: LeagueHistoryResult
  season: string
  teamName: string
}

export interface LeagueHistoryMatrixRow {
  cells: Record<string, LeagueHistoryMatrixCell>
  id: string
  managerName: string
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

function managerIdentity(member: LeagueHistoryMember) {
  return member.manager_id?.trim() || member.manager_name.trim().toLocaleLowerCase()
}

function resultPriority(result: LeagueHistoryResult) {
  return {
    champion: 5,
    'runner-up': 4,
    third: 3,
    playoff: 2,
    participant: 1,
  }[result]
}

export function buildLeagueHistoryMatrix(
  snapshot: LeagueHistorySnapshot,
  historyRows = buildLeagueHistoryRows(snapshot),
): LeagueHistoryMatrixRow[] {
  const historyBySeason = new Map(
    historyRows.map((historyRow) => [historyRow.season, historyRow]),
  )
  const scoreMemberIds = new Set(snapshot.scores.map((score) => score.member_id))
  const matchupMemberIds = new Set(
    snapshot.matchups.flatMap((matchup) => [
      matchup.team1_member_id,
      matchup.team2_member_id,
    ]),
  )
  const players = new Map<
    string,
    LeagueHistoryMatrixRow & { newestSeason: string }
  >()

  snapshot.members.forEach((member) => {
    const history = historyBySeason.get(member.season)
    if (!history) return

    const recordedParticipant =
      member.is_active !== false ||
      scoreMemberIds.has(member.id) ||
      matchupMemberIds.has(member.id) ||
      history.champion?.id === member.id ||
      history.runnerUp?.id === member.id ||
      history.thirdPlace?.id === member.id
    if (!recordedParticipant) return

    let result: LeagueHistoryResult = 'participant'
    if (history.champion?.id === member.id) result = 'champion'
    else if (history.runnerUp?.id === member.id) result = 'runner-up'
    else if (history.thirdPlace?.id === member.id) result = 'third'
    else if (
      history.status === 'complete' &&
      history.playoffTeams.some((playoffMember) => playoffMember.id === member.id)
    ) {
      result = 'playoff'
    }

    const id = managerIdentity(member)
    const existing = players.get(id)
    const cell = { result, season: member.season, teamName: member.team_name }
    if (!existing) {
      players.set(id, {
        cells: { [member.season]: cell },
        id,
        managerName: member.manager_name,
        newestSeason: member.season,
      })
      return
    }

    const existingCell = existing.cells[member.season]
    if (!existingCell || resultPriority(result) > resultPriority(existingCell.result)) {
      existing.cells[member.season] = cell
    }
    if (member.season > existing.newestSeason) {
      existing.managerName = member.manager_name
      existing.newestSeason = member.season
    }
  })

  return [...players.values()]
    .sort(
      (left, right) =>
        right.newestSeason.localeCompare(left.newestSeason) ||
        left.managerName.localeCompare(right.managerName),
    )
    .map((player) => ({
      cells: player.cells,
      id: player.id,
      managerName: player.managerName,
    }))
}
