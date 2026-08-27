export interface PrizeRuleRow {
  amount: number
  key: string
  label: string
}

export interface SeasonScheduleRule {
  playoffWeeks: number
  playoffsStartWeek: number
  regularSeasonWeeks: number
  totalWeeks: number
}

export interface ScoreSourceRule {
  automation: string
  source: string
}

const PRIZE_LABELS: Record<string, string> = {
  first: '1st place',
  second: '2nd place',
  third: '3rd place',
  fourth: '4th place',
  highest_points: 'Highest season points',
  highest_weekly: 'Highest weekly score',
  lowest_weekly: 'Lowest weekly score',
}

const PRIZE_ORDER = [
  'first',
  'second',
  'third',
  'fourth',
  'highest_points',
  'highest_weekly',
  'lowest_weekly',
]

function positiveAmount(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function getConfiguredDivisions(value: unknown): string[] {
  const rawDivisions = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'divisions' in value
      ? (value as { divisions?: unknown }).divisions
      : []

  if (!Array.isArray(rawDivisions)) return []

  return [
    ...new Set(
      rawDivisions
        .filter((division): division is string => typeof division === 'string')
        .map((division) => division.trim())
        .filter(Boolean),
    ),
  ]
}

export function getPrizeRuleRows(
  prizeStructure: object | null | undefined,
): PrizeRuleRow[] {
  const entries = Object.entries(prizeStructure || {})
    .map(([key, value]) => [key, positiveAmount(value)] as const)
    .filter(([, amount]) => amount > 0)
  const keys = [
    ...PRIZE_ORDER.filter((key) => entries.some(([entryKey]) => entryKey === key)),
    ...entries
      .map(([key]) => key)
      .filter((key) => !PRIZE_ORDER.includes(key))
      .sort(),
  ]
  const amounts = new Map(entries)

  return keys.map((key) => ({
    amount: amounts.get(key) || 0,
    key,
    label: PRIZE_LABELS[key] || titleCase(key),
  }))
}

export function getSeasonScheduleRule(
  totalWeeks: number,
  playoffStartWeek: number,
): SeasonScheduleRule {
  const normalizedTotalWeeks = Math.max(Math.trunc(Number(totalWeeks) || 0), 0)
  const requestedPlayoffStart = Math.max(
    Math.trunc(Number(playoffStartWeek) || 0),
    0,
  )
  const playoffsStartWeek = Math.min(
    Math.max(requestedPlayoffStart, 1),
    Math.max(normalizedTotalWeeks, 1),
  )
  const regularSeasonWeeks = Math.min(
    Math.max(playoffsStartWeek - 1, 0),
    normalizedTotalWeeks,
  )

  return {
    playoffWeeks:
      normalizedTotalWeeks > 0
        ? normalizedTotalWeeks - regularSeasonWeeks
        : 0,
    playoffsStartWeek,
    regularSeasonWeeks,
    totalWeeks: normalizedTotalWeeks,
  }
}

export function getScoreSourceRule({
  autoSyncEnabled,
  espnLeagueId,
  platformLeagueId,
  platformType,
}: {
  autoSyncEnabled?: boolean
  espnLeagueId?: string | null
  platformLeagueId?: string | null
  platformType?: string | null
}): ScoreSourceRule {
  const normalizedPlatform = platformType?.trim().toLocaleLowerCase()
  const usesESPN =
    normalizedPlatform === 'espn' ||
    Boolean(espnLeagueId) ||
    (!normalizedPlatform && Boolean(platformLeagueId))
  const source = usesESPN
    ? 'ESPN Fantasy Football'
    : normalizedPlatform && normalizedPlatform !== 'manual'
      ? titleCase(normalizedPlatform)
      : 'Manual score entry'

  return {
    automation: autoSyncEnabled
      ? 'Wednesday at 2:00 AM Phoenix time'
      : 'Automatic sync is off; the commissioner imports scores manually',
    source,
  }
}
