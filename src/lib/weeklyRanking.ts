export interface RankingMember {
  id: string
  manager_name: string
}

export interface RankingScore {
  member_id: string
  points: number
}

export interface RankedMember<TMember extends RankingMember> {
  member: TMember
  points: number | null
  rank: number | null
}

export function getLatestRecordedWeek(
  scores: Array<{ week_number: number }>,
) {
  const recordedWeeks = scores
    .map((score) => Number(score.week_number))
    .filter((week) => Number.isInteger(week) && week > 0)

  return recordedWeeks.length > 0 ? Math.max(...recordedWeeks) : 1
}

export function buildWeeklyRanking<TMember extends RankingMember>(
  members: TMember[],
  scores: RankingScore[],
): RankedMember<TMember>[] {
  const scoreByMember = new Map(
    scores.map((score) => [score.member_id, Number(score.points)]),
  )
  const sorted = members
    .map((member) => ({
      member,
      points: scoreByMember.has(member.id)
        ? (scoreByMember.get(member.id) ?? null)
        : null,
    }))
    .sort((left, right) => {
      if (left.points === null && right.points === null) {
        return left.member.manager_name.localeCompare(right.member.manager_name)
      }
      if (left.points === null) return 1
      if (right.points === null) return -1
      return (
        right.points - left.points ||
        left.member.manager_name.localeCompare(right.member.manager_name)
      )
    })

  let priorPoints: number | null = null
  let priorRank = 0

  return sorted.map((entry, index) => {
    const rank =
      entry.points === null
        ? null
        : index > 0 && entry.points === priorPoints
          ? priorRank
          : index + 1

    if (entry.points !== null) {
      priorPoints = entry.points
      priorRank = rank || index + 1
    }

    return { ...entry, rank }
  })
}
