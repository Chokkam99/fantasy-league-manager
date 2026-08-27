import type { WeekImportData } from './types'

export interface ImportValidationSummary {
  expected_matchups: number
  expected_teams: number
  matchup_count: number
  score_count: number
}

export interface ImportValidationResult {
  can_import: boolean
  errors: string[]
  is_valid: boolean
  summary: ImportValidationSummary
  warnings: string[]
}

export function validateWeekImport(
  data: WeekImportData,
  expectedMemberIds: string[],
  expectedWeek: number,
): ImportValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const expectedIds = new Set(expectedMemberIds)
  const expectedMatchups = Math.floor(expectedMemberIds.length / 2)
  const scoreIds = data.scores.map((score) => score.member_id)
  const uniqueScoreIds = new Set(scoreIds)
  const matchupIds = data.matchups.flatMap((matchup) => [
    matchup.team1_member_id,
    matchup.team2_member_id,
  ])
  const uniqueMatchupIds = new Set(matchupIds)

  if (!Number.isInteger(data.week) || data.week !== expectedWeek) {
    errors.push(`Expected week ${expectedWeek}, but ESPN returned week ${data.week}.`)
  }

  if (expectedMemberIds.length === 0) {
    errors.push('No active league players are available for this season.')
  }

  if (uniqueScoreIds.size !== scoreIds.length) {
    errors.push('The preview contains duplicate team scores.')
  }

  if (data.scores.length !== expectedMemberIds.length) {
    errors.push(
      `Expected ${expectedMemberIds.length} team scores, but received ${data.scores.length}.`,
    )
  }

  const missingScores = expectedMemberIds.filter((id) => !uniqueScoreIds.has(id))
  const unknownScores = [...uniqueScoreIds].filter((id) => !expectedIds.has(id))

  if (missingScores.length > 0) {
    errors.push(`${missingScores.length} active team(s) are missing a score.`)
  }

  if (unknownScores.length > 0) {
    errors.push(`${unknownScores.length} score(s) do not match an active team.`)
  }

  if (
    data.scores.some(
      (score) => !Number.isFinite(score.points) || !score.team_name.trim(),
    )
  ) {
    errors.push('Every score must have a finite point total and team name.')
  }

  if (data.matchups.length !== expectedMatchups) {
    errors.push(
      `Expected ${expectedMatchups} matchup(s), but received ${data.matchups.length}.`,
    )
  }

  if (uniqueMatchupIds.size !== matchupIds.length) {
    errors.push('A team appears in more than one matchup.')
  }

  if (
    data.matchups.some(
      (matchup) =>
        matchup.team1_member_id === matchup.team2_member_id ||
        !uniqueScoreIds.has(matchup.team1_member_id) ||
        !uniqueScoreIds.has(matchup.team2_member_id),
    )
  ) {
    errors.push('Every matchup must contain two distinct teams with scores.')
  }

  const expectedUnmatchedTeams = expectedMemberIds.length % 2
  const unmatchedTeams = expectedMemberIds.filter(
    (id) => !uniqueMatchupIds.has(id),
  )

  if (unmatchedTeams.length !== expectedUnmatchedTeams) {
    errors.push('The matchup list does not cover the expected active teams.')
  } else if (expectedUnmatchedTeams === 1) {
    warnings.push('One active team has a bye this week.')
  }

  if (!data.is_complete) {
    warnings.push('ESPN still marks this week as in progress.')
  }

  const isValid = errors.length === 0

  return {
    can_import: isValid && data.is_complete,
    errors,
    is_valid: isValid,
    summary: {
      expected_matchups: expectedMatchups,
      expected_teams: expectedMemberIds.length,
      matchup_count: data.matchups.length,
      score_count: data.scores.length,
    },
    warnings,
  }
}
