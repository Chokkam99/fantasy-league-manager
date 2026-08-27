export interface StandingsMember {
  division?: string | null
  id: string
  manager_name: string
  team_name: string
}

export interface StandingsScore {
  member_id: string
  points: number
  week_number: number
}

export interface StandingsMatchup {
  is_tie: boolean
  team1_member_id: string
  team1_score: number | null
  team2_member_id: string
  team2_score: number | null
  week_number: number
  winner_member_id: string | null
}

export interface StandingRow<TMember extends StandingsMember = StandingsMember> {
  average_points: number
  games_played: number
  losses: number
  member: TMember
  points_for: number
  rank: number
  record_percentage: number
  ties: number
  weekly_wins: number
  weeks_won: number[]
  wins: number
}

export interface PlayoffSeed {
  division?: string
  is_division_winner: boolean
  seed: number
  team_id: string
}

export const STANDINGS_TIEBREAKERS = [
  'Winning percentage, with each tie counting as half a win',
  'Total points scored',
  'Manager name as a deterministic final fallback',
] as const

export function compareStandingRows(
  left: StandingRow,
  right: StandingRow,
) {
  if (right.record_percentage !== left.record_percentage) {
    return right.record_percentage - left.record_percentage
  }
  if (right.points_for !== left.points_for) {
    return right.points_for - left.points_for
  }
  return left.member.manager_name.localeCompare(right.member.manager_name)
}

export function calculateStandings<TMember extends StandingsMember>(
  members: TMember[],
  scores: StandingsScore[],
  matchups: StandingsMatchup[],
  maximumWeek: number,
): StandingRow<TMember>[] {
  const stats = new Map<
    string,
    {
      gamesPlayed: number
      losses: number
      pointsFor: number
      ties: number
      weeklyWins: number
      weeksWon: number[]
      wins: number
    }
  >(
    members.map((member) => [
      member.id,
      {
        gamesPlayed: 0,
        losses: 0,
        pointsFor: 0,
        ties: 0,
        weeklyWins: 0,
        weeksWon: [],
        wins: 0,
      },
    ]),
  )
  const includedScores = scores.filter(
    (score) => score.week_number >= 1 && score.week_number <= maximumWeek,
  )

  includedScores.forEach((score) => {
    const memberStats = stats.get(score.member_id)
    if (!memberStats || !Number.isFinite(Number(score.points))) return

    memberStats.pointsFor += Number(score.points)
    memberStats.gamesPlayed += 1
  })

  const scoreWeeks = [...new Set(includedScores.map((score) => score.week_number))]
  scoreWeeks.forEach((week) => {
    const weekScores = includedScores.filter(
      (score) =>
        score.week_number === week && Number.isFinite(Number(score.points)),
    )
    if (weekScores.length === 0) return

    const highScore = Math.max(...weekScores.map((score) => Number(score.points)))
    const winners = weekScores.filter(
      (score) => Number(score.points) === highScore,
    )

    winners.forEach((winner) => {
      const memberStats = stats.get(winner.member_id)
      if (!memberStats) return

      memberStats.weeklyWins += 1 / winners.length
      memberStats.weeksWon.push(week)
    })
  })

  matchups
    .filter(
      (matchup) =>
        matchup.week_number >= 1 &&
        matchup.week_number <= maximumWeek &&
        matchup.team1_score !== null &&
        matchup.team2_score !== null,
    )
    .forEach((matchup) => {
      const team1 = stats.get(matchup.team1_member_id)
      const team2 = stats.get(matchup.team2_member_id)
      if (!team1 || !team2) return

      const isTie =
        matchup.is_tie || matchup.team1_score === matchup.team2_score
      const winnerId =
        matchup.winner_member_id ||
        (isTie
          ? null
          : (matchup.team1_score || 0) > (matchup.team2_score || 0)
            ? matchup.team1_member_id
            : matchup.team2_member_id)

      if (isTie) {
        team1.ties += 1
        team2.ties += 1
      } else if (winnerId === matchup.team1_member_id) {
        team1.wins += 1
        team2.losses += 1
      } else if (winnerId === matchup.team2_member_id) {
        team2.wins += 1
        team1.losses += 1
      }
    })

  const rows = members.map((member) => {
    const memberStats = stats.get(member.id)!
    const recordGames =
      memberStats.wins + memberStats.losses + memberStats.ties

    return {
      average_points:
        memberStats.gamesPlayed > 0
          ? memberStats.pointsFor / memberStats.gamesPlayed
          : 0,
      games_played: memberStats.gamesPlayed,
      losses: memberStats.losses,
      member,
      points_for: memberStats.pointsFor,
      rank: 0,
      record_percentage:
        recordGames > 0
          ? (memberStats.wins + memberStats.ties * 0.5) / recordGames
          : 0,
      ties: memberStats.ties,
      weekly_wins: memberStats.weeklyWins,
      weeks_won: memberStats.weeksWon.sort((left, right) => left - right),
      wins: memberStats.wins,
    }
  })

  return rows
    .sort(compareStandingRows)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

export function resolveDivisionNames(
  configuredDivisions: unknown,
  members: StandingsMember[],
) {
  const configured =
    Array.isArray(configuredDivisions)
      ? configuredDivisions
      : configuredDivisions && typeof configuredDivisions === 'object'
        ? (configuredDivisions as { divisions?: unknown }).divisions
        : []
  const names = Array.isArray(configured)
    ? configured.filter(
        (division): division is string =>
          typeof division === 'string' && Boolean(division.trim()),
      )
    : []
  const memberDivisions = members
    .map((member) => member.division)
    .filter(
      (division): division is string =>
        typeof division === 'string' && Boolean(division.trim()),
    )

  return [...new Set([...names, ...memberDivisions])]
}

export function groupStandingsByDivision<
  TMember extends StandingsMember,
>(
  standings: StandingRow<TMember>[],
  divisions: string[],
) {
  const groupedMemberIds = new Set<string>()
  const groups = divisions.flatMap((division) => {
    const rows = standings
      .filter((row) => row.member.division === division)
      .sort(compareStandingRows)

    rows.forEach((row) => groupedMemberIds.add(row.member.id))
    return rows.length > 0 ? [{ division, rows }] : []
  })
  const unassignedRows = standings
    .filter((row) => !groupedMemberIds.has(row.member.id))
    .sort(compareStandingRows)

  if (unassignedRows.length > 0) {
    groups.push({ division: 'Other', rows: unassignedRows })
  }

  return groups
}

export function calculatePlayoffSeeds(
  standings: StandingRow[],
  divisions: string[],
  requestedSpots: number,
): PlayoffSeed[] {
  const playoffSpots = Math.max(
    0,
    Math.min(Math.floor(requestedSpots), standings.length),
  )
  if (playoffSpots === 0) return []

  const activeDivisions = divisions.filter((division) =>
    standings.some((row) => row.member.division === division),
  )

  if (activeDivisions.length < 2) {
    return standings.slice(0, playoffSpots).map((row, index) => ({
      is_division_winner: false,
      seed: index + 1,
      team_id: row.member.id,
    }))
  }

  const divisionWinners = activeDivisions
    .map((division) =>
      standings
        .filter((row) => row.member.division === division)
        .sort(compareStandingRows)[0],
    )
    .filter(Boolean)
    .sort(compareStandingRows)
    .slice(0, playoffSpots)
  const winnerIds = new Set(divisionWinners.map((row) => row.member.id))
  const wildcards = standings
    .filter((row) => !winnerIds.has(row.member.id))
    .sort(compareStandingRows)
    .slice(0, playoffSpots - divisionWinners.length)

  return [...divisionWinners, ...wildcards].map((row, index) => ({
    division: row.member.division || undefined,
    is_division_winner: winnerIds.has(row.member.id),
    seed: index + 1,
    team_id: row.member.id,
  }))
}

export function orderStandingsByPlayoffPicture(
  standings: StandingRow[],
  seeds: PlayoffSeed[],
) {
  const rowById = new Map(standings.map((row) => [row.member.id, row]))
  const qualifierIds = new Set(seeds.map((seed) => seed.team_id))
  const qualifiers = seeds.flatMap((seed) => {
    const row = rowById.get(seed.team_id)
    return row ? [row] : []
  })
  const outside = standings
    .filter((row) => !qualifierIds.has(row.member.id))
    .sort(compareStandingRows)

  return [...qualifiers, ...outside]
}
