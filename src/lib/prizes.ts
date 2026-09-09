export interface PrizeMember {
  id: string
  manager_name: string
  team_name: string
  payment_status?: string | null
}

export interface PrizeScore {
  member_id: string
  week_number: number
  points: number
  is_final_score?: boolean | null
  week_status?: string | null
}

export type PrizeBalanceStatus = 'balanced' | 'unallocated' | 'overallocated'

export interface PrizePlan {
  activePlayers: number
  paidPlayers: number
  entryFee: number
  expectedFees: number
  collectedFees: number
  outstandingFees: number
  draftCost: number
  availablePool: number
  weeklyAllocation: number
  finalAllocation: number
  totalAllocation: number
  totalOutflow: number
  balance: number
  status: PrizeBalanceStatus
}

export interface WeeklyPrizeResult {
  week: number
  complete: boolean
  score: number | null
  winners: PrizeMember[]
  prizeAmount: number
  sharePerWinner: number
  recordedTeams: number
  expectedTeams: number
}

export interface FinalPrizeRule {
  key: string
  label: string
  amount: number
  recipientId: string | null
  recipient: PrizeMember | null
}

const RULE_LABELS: Record<string, string> = {
  first: '1st place',
  second: '2nd place',
  third: '3rd place',
  fourth: '4th place',
  highest_points: 'Highest points',
  highest_weekly: 'Highest weekly score',
  lowest_weekly: 'Lowest weekly score',
}

const RULE_ORDER = [
  'first',
  'second',
  'third',
  'fourth',
  'highest_points',
  'highest_weekly',
  'lowest_weekly',
]

function amount(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0
}

function ruleLabel(key: string) {
  return (
    (Object.hasOwn(RULE_LABELS, key) ? RULE_LABELS[key] : '') ||
    key
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase())
  )
}

function prizeEntries(prizeStructure: object | null | undefined) {
  return Object.entries(prizeStructure || {})
    .map(([key, value]) => [key, amount(value)] as const)
    .filter(([, value]) => value > 0)
}

export function calculatePrizePlan({
  members,
  entryFee,
  draftCost,
  weeklyPrizeAmount,
  totalWeeks,
  prizeStructure,
}: {
  members: PrizeMember[]
  entryFee: number
  draftCost: number
  weeklyPrizeAmount: number
  totalWeeks: number
  prizeStructure: object | null | undefined
}): PrizePlan {
  const normalizedEntryFee = amount(entryFee)
  const normalizedDraftCost = amount(draftCost)
  const normalizedWeeklyPrize = amount(weeklyPrizeAmount)
  const normalizedWeeks = Math.max(Math.trunc(Number(totalWeeks) || 0), 0)
  const paidPlayers = members.filter(
    (member) => member.payment_status === 'paid',
  ).length
  const expectedFees = members.length * normalizedEntryFee
  const collectedFees = paidPlayers * normalizedEntryFee
  const outstandingFees = Math.max(expectedFees - collectedFees, 0)
  const availablePool = expectedFees - normalizedDraftCost
  const weeklyAllocation = normalizedWeeklyPrize * normalizedWeeks
  const finalAllocation = prizeEntries(prizeStructure).reduce(
    (total, [, value]) => total + value,
    0,
  )
  const totalAllocation = weeklyAllocation + finalAllocation
  const totalOutflow = normalizedDraftCost + totalAllocation
  const balance = expectedFees - totalOutflow
  const status: PrizeBalanceStatus =
    Math.abs(balance) < 0.01
      ? 'balanced'
      : balance > 0
        ? 'unallocated'
        : 'overallocated'

  return {
    activePlayers: members.length,
    paidPlayers,
    entryFee: normalizedEntryFee,
    expectedFees,
    collectedFees,
    outstandingFees,
    draftCost: normalizedDraftCost,
    availablePool,
    weeklyAllocation,
    finalAllocation,
    totalAllocation,
    totalOutflow,
    balance,
    status,
  }
}

export function calculateWeeklyPrizeResults(
  members: PrizeMember[],
  scores: PrizeScore[],
  weeklyPrizeAmount: number,
  totalWeeks: number,
): WeeklyPrizeResult[] {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const scoresByWeek = new Map<
    number,
    Map<string, { points: number; isFinal: boolean }>
  >()
  const maximumWeek = Math.max(Math.trunc(Number(totalWeeks) || 0), 0)

  scores.forEach((score) => {
    const week = Number(score.week_number)
    const points = Number(score.points)

    if (
      !Number.isInteger(week) ||
      week < 1 ||
      (maximumWeek > 0 && week > maximumWeek) ||
      !Number.isFinite(points) ||
      !membersById.has(score.member_id)
    ) {
      return
    }

    const weekScores =
      scoresByWeek.get(week) ||
      new Map<string, { points: number; isFinal: boolean }>()
    weekScores.set(score.member_id, {
      points,
      isFinal:
        score.is_final_score === true || score.week_status === 'completed',
    })
    scoresByWeek.set(week, weekScores)
  })

  const latestRecordedWeek = Math.max(0, ...scoresByWeek.keys())

  return [...scoresByWeek.entries()]
    .sort(([weekA], [weekB]) => weekB - weekA)
    .map(([week, weekScores]) => {
      const allRecordedScoresAreFinal =
        weekScores.size > 0 &&
        [...weekScores.values()].every((score) => score.isFinal)
      const complete =
        members.length > 0 &&
        (week < latestRecordedWeek ||
          weekScores.size === members.length ||
          allRecordedScoresAreFinal)
      const highScore = complete
        ? Math.max(...[...weekScores.values()].map((score) => score.points))
        : null
      const winners = complete
        ? [...weekScores.entries()]
            .filter(([, score]) => score.points === highScore)
            .map(([memberId]) => membersById.get(memberId))
            .filter((member): member is PrizeMember => Boolean(member))
            .sort((a, b) => a.manager_name.localeCompare(b.manager_name))
        : []
      const prizeAmount = amount(weeklyPrizeAmount)

      return {
        week,
        complete,
        score: highScore,
        winners,
        prizeAmount,
        sharePerWinner: winners.length > 0 ? prizeAmount / winners.length : 0,
        recordedTeams: weekScores.size,
        expectedTeams: members.length,
      }
    })
}

export function getFinalPrizeRules(
  prizeStructure: object | null | undefined,
  finalWinners: Record<string, unknown> | null | undefined,
  members: PrizeMember[],
): FinalPrizeRule[] {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const entries = prizeEntries(prizeStructure)
  const orderedKeys = [
    ...RULE_ORDER.filter((key) => entries.some(([entryKey]) => entryKey === key)),
    ...entries
      .map(([key]) => key)
      .filter((key) => !RULE_ORDER.includes(key))
      .sort(),
  ]
  const valuesByKey = new Map(entries)

  return orderedKeys.map((key) => {
    const savedValue = finalWinners?.[key]
    const recipientId =
      typeof savedValue === 'string' && savedValue.length > 0
        ? savedValue
        : null

    return {
      key,
      label: ruleLabel(key),
      amount: valuesByKey.get(key) || 0,
      recipientId,
      recipient: recipientId ? membersById.get(recipientId) || null : null,
    }
  })
}
