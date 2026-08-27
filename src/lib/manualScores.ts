export interface ManualScoreInput {
  member_id: string
  points: number
}

export interface ManualScoreValidationResult {
  errors: string[]
  is_valid: boolean
  scores: ManualScoreInput[]
}

export type ManualScoreAction = 'clear_season' | 'clear_week' | 'save_week'

export interface AtomicManualWeekResult {
  action: ManualScoreAction
  matchup_count: number
  score_count: number
  season: string
  success: true
  week: number | null
}

const SEASON_PATTERN = /^\d{4}$/

export function isMissingAtomicManualWeekSchema(
  error: { code?: string; message?: string } | null | undefined,
) {
  if (!error) return false
  if (['42883', 'PGRST202'].includes(error.code || '')) return true
  return (
    /mutate_manual_week_atomically/i.test(error.message || '') &&
    /function|schema cache/i.test(error.message || '')
  )
}

export function parseAtomicManualWeekResult(
  value: unknown,
): AtomicManualWeekResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Record<string, unknown>
  const action = String(result.action)
  const hasValidWeek =
    (action === 'clear_season' && result.week === null) ||
    (action !== 'clear_season' &&
      Number.isSafeInteger(result.week) &&
      Number(result.week) >= 1 &&
      Number(result.week) <= 25)
  if (
    result.success !== true ||
    !['clear_season', 'clear_week', 'save_week'].includes(action) ||
    typeof result.season !== 'string' ||
    !SEASON_PATTERN.test(result.season) ||
    !Number.isSafeInteger(result.score_count) ||
    Number(result.score_count) < 0 ||
    !Number.isSafeInteger(result.matchup_count) ||
    Number(result.matchup_count) < 0 ||
    !hasValidWeek
  ) {
    return null
  }

  return {
    action: action as ManualScoreAction,
    matchup_count: Number(result.matchup_count),
    score_count: Number(result.score_count),
    season: result.season,
    success: true,
    week: result.week === null ? null : Number(result.week),
  }
}

export function validateManualScores(
  value: unknown,
  activeMemberIds: string[],
): ManualScoreValidationResult {
  const errors: string[] = []
  const expectedIds = new Set(activeMemberIds)

  if (!Array.isArray(value)) {
    return {
      errors: ['Scores must be provided as a list.'],
      is_valid: false,
      scores: [],
    }
  }

  const scores = value.flatMap((entry): ManualScoreInput[] => {
    if (!entry || typeof entry !== 'object') return []

    const candidate = entry as Record<string, unknown>
    if (
      typeof candidate.member_id !== 'string' ||
      typeof candidate.points !== 'number'
    ) {
      return []
    }

    return [{ member_id: candidate.member_id, points: candidate.points }]
  })
  const scoreIds = scores.map((score) => score.member_id)
  const uniqueScoreIds = new Set(scoreIds)

  if (activeMemberIds.length === 0) {
    errors.push('No active players are available for this season.')
  }

  if (scores.length !== value.length) {
    errors.push('Every score must include a player ID and numeric point total.')
  }

  if (scores.length !== activeMemberIds.length) {
    errors.push(
      `Enter one score for each of the ${activeMemberIds.length} active players.`,
    )
  }

  if (uniqueScoreIds.size !== scoreIds.length) {
    errors.push('A player can only have one score for the week.')
  }

  if (scores.some((score) => !Number.isFinite(score.points))) {
    errors.push('Every point total must be a finite number.')
  }

  const missingIds = activeMemberIds.filter((id) => !uniqueScoreIds.has(id))
  const unknownIds = [...uniqueScoreIds].filter((id) => !expectedIds.has(id))

  if (missingIds.length > 0) {
    errors.push(`${missingIds.length} active player score(s) are missing.`)
  }

  if (unknownIds.length > 0) {
    errors.push(`${unknownIds.length} score(s) do not belong to this season.`)
  }

  return { errors, is_valid: errors.length === 0, scores }
}
