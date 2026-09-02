export interface SeasonSetupConfiguration {
  divisions: string[]
  draft_food_cost: number
  fee_amount: number
  playoff_spots: number
  playoff_start_week: number
  prize_structure: Record<string, number>
  total_weeks: number
  weekly_prize_amount: number
}

export interface SeasonMemberSetup {
  division: string | null
  manager_name: string
  source_member_id: string | null
  team_name: string
}

export interface SeasonRolloverRequest {
  configuration: SeasonSetupConfiguration
  confirmed: true
  members: SeasonMemberSetup[]
  source_season: string
  target_season: string
}

export type SeasonRolloverValidation =
  | { is_valid: true; value: SeasonRolloverRequest }
  | { errors: string[]; is_valid: false }

export interface ReusableSeasonConfiguration {
  divisions?: unknown
  draft_food_cost?: number | null
  fee_amount?: number | null
  playoff_spots?: number | null
  playoff_start_week?: number | null
  prize_structure?: unknown
  total_weeks?: number | null
  weekly_prize_amount?: number | null
}

export interface ReturningMember {
  division?: string | null
  id: string
  is_active?: boolean
  manager_id?: string | null
  manager_name: string
  season?: string
  team_name: string
}

export interface RolloverMemberOption extends ReturningMember {
  last_season: string
  selected_by_default: boolean
}

export interface AtomicSeasonRolloverResult {
  copied_players: number
  source_season: string
  success: true
  target_season: string
}

const SEASON_PATTERN = /^\d{4}$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PRIZE_KEY_PATTERN = /^[a-z0-9_]{1,64}$/

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function memberIdentity(member: ReturningMember) {
  return member.manager_id || `legacy:${normalizeName(member.manager_name).toLocaleLowerCase()}`
}

export function buildRolloverMemberOptions(
  members: ReturningMember[],
  sourceSeason: string,
): RolloverMemberOption[] {
  const byManager = new Map<string, ReturningMember>()

  for (const member of members) {
    if (!member.season || member.season > sourceSeason) continue

    const identity = memberIdentity(member)
    const existing = byManager.get(identity)
    const memberIsDefault = member.season === sourceSeason && member.is_active === true
    const existingIsDefault =
      existing?.season === sourceSeason && existing.is_active === true

    if (
      !existing ||
      (memberIsDefault && !existingIsDefault) ||
      (memberIsDefault === existingIsDefault &&
        member.season > (existing.season || ''))
    ) {
      byManager.set(identity, member)
    }
  }

  return [...byManager.values()]
    .map((member) => ({
      ...member,
      last_season: member.season || sourceSeason,
      selected_by_default:
        member.season === sourceSeason && member.is_active === true,
    }))
    .sort((left, right) => {
      if (left.selected_by_default !== right.selected_by_default) {
        return left.selected_by_default ? -1 : 1
      }
      return left.manager_name.localeCompare(right.manager_name)
    })
}

function isMoney(value: unknown) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000
  )
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum
}

export function getNextSeason(currentSeason: string) {
  if (!SEASON_PATTERN.test(currentSeason)) return null

  const nextSeason = Number.parseInt(currentSeason, 10) + 1
  return String(nextSeason).padStart(4, '0')
}

export function isMissingAtomicRolloverSchema(
  error: { code?: string; message?: string } | null | undefined,
) {
  if (!error) return false
  if (['42883', 'PGRST202'].includes(error.code || '')) return true
  return /rollover_league_season_atomically/i.test(error.message || '') &&
    /function|schema cache/i.test(error.message || '')
}

export function parseAtomicSeasonRolloverResult(
  value: unknown,
): AtomicSeasonRolloverResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Record<string, unknown>
  if (
    result.success !== true ||
    !Number.isSafeInteger(result.copied_players) ||
    Number(result.copied_players) < 0 ||
    typeof result.source_season !== 'string' ||
    !SEASON_PATTERN.test(result.source_season) ||
    typeof result.target_season !== 'string' ||
    !SEASON_PATTERN.test(result.target_season)
  ) {
    return null
  }

  return {
    copied_players: Number(result.copied_players),
    source_season: result.source_season,
    success: true,
    target_season: result.target_season,
  }
}

export function validateSeasonRolloverRequest(
  input: unknown,
  currentSeason: string,
): SeasonRolloverValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      errors: ['The season setup request must be an object.'],
      is_valid: false,
    }
  }

  const body = input as Record<string, unknown>
  const sourceSeason =
    typeof body.source_season === 'string' ? body.source_season.trim() : ''
  const targetSeason =
    typeof body.target_season === 'string' ? body.target_season.trim() : ''
  const rawConfiguration =
    body.configuration &&
    typeof body.configuration === 'object' &&
    !Array.isArray(body.configuration)
      ? (body.configuration as Record<string, unknown>)
      : null
  const rawMembers = Array.isArray(body.members)
    ? body.members
    : []
  const errors: string[] = []
  const nextSeason = getNextSeason(currentSeason)

  if (!SEASON_PATTERN.test(currentSeason) || !nextSeason) {
    errors.push('The league active season is not configured correctly.')
  }
  if (!SEASON_PATTERN.test(sourceSeason)) {
    errors.push('A valid source season is required.')
  } else if (sourceSeason !== currentSeason) {
    errors.push('A new season can only start from the league active season.')
  }
  if (!SEASON_PATTERN.test(targetSeason)) {
    errors.push('A valid new season is required.')
  } else if (nextSeason && targetSeason !== nextSeason) {
    errors.push(`The next season must be ${nextSeason}.`)
  }

  if (!rawConfiguration) errors.push('Season settings are required.')

  const totalWeeks = rawConfiguration?.total_weeks
  const playoffStartWeek = rawConfiguration?.playoff_start_week
  const playoffSpots = rawConfiguration?.playoff_spots
  if (!isIntegerBetween(totalWeeks, 1, 25)) {
    errors.push('Total weeks must be between 1 and 25.')
  }
  if (
    !isIntegerBetween(playoffStartWeek, 1, 25) ||
    (typeof totalWeeks === 'number' &&
      typeof playoffStartWeek === 'number' &&
      playoffStartWeek > totalWeeks)
  ) {
    errors.push('Playoffs must start within the configured season weeks.')
  }
  if (!isIntegerBetween(playoffSpots, 2, 64)) {
    errors.push('Playoff spots must be between 2 and 64.')
  } else if (rawMembers.length > 0 && Number(playoffSpots) > rawMembers.length) {
    errors.push('Playoff spots cannot exceed the number of teams.')
  }

  for (const [key, label] of [
    ['fee_amount', 'Entry fee'],
    ['draft_food_cost', 'Draft cost'],
    ['weekly_prize_amount', 'Weekly prize'],
  ] as const) {
    if (!isMoney(rawConfiguration?.[key])) {
      errors.push(`${label} must be between $0 and $1,000,000.`)
    }
  }

  const rawDivisions = rawConfiguration?.divisions
  const divisions = Array.isArray(rawDivisions)
    ? rawDivisions.map(normalizeName).filter(Boolean)
    : []
  if (!Array.isArray(rawDivisions)) {
    errors.push('Groups must be a list.')
  } else if (divisions.length > 16) {
    errors.push('A season cannot have more than 16 groups.')
  } else if (divisions.some((division) => division.length > 40)) {
    errors.push('Group names must be 40 characters or fewer.')
  } else if (
    new Set(divisions.map((division) => division.toLocaleLowerCase())).size !==
    divisions.length
  ) {
    errors.push('Group names must be unique.')
  }

  const rawPrizeStructure = rawConfiguration?.prize_structure
  const prizeEntries =
    rawPrizeStructure &&
    typeof rawPrizeStructure === 'object' &&
    !Array.isArray(rawPrizeStructure)
      ? Object.entries(rawPrizeStructure)
      : []
  if (
    !rawPrizeStructure ||
    typeof rawPrizeStructure !== 'object' ||
    Array.isArray(rawPrizeStructure)
  ) {
    errors.push('Prize amounts must be an object.')
  } else if (prizeEntries.length > 32) {
    errors.push('A season cannot have more than 32 prize categories.')
  } else if (
    prizeEntries.some(
      ([key, value]) => !PRIZE_KEY_PATTERN.test(key) || !isMoney(value),
    )
  ) {
    errors.push('Every prize category must have a valid non-negative amount.')
  }

  if (!Array.isArray(body.members)) {
    errors.push('Season players must be a list.')
  } else if (rawMembers.length > 64) {
    errors.push('A season cannot include more than 64 players.')
  } else if (rawMembers.length < 2 || rawMembers.length % 2 !== 0) {
    errors.push('A season must include an even number of teams between 2 and 64.')
  }

  const members: SeasonMemberSetup[] = []
  for (const rawMember of rawMembers) {
    if (!rawMember || typeof rawMember !== 'object' || Array.isArray(rawMember)) {
      errors.push('Every returning player must be configured correctly.')
      continue
    }

    const member = rawMember as Record<string, unknown>
    const sourceMemberId =
      typeof member.source_member_id === 'string'
        ? member.source_member_id.trim()
        : null
    const managerName = normalizeName(member.manager_name)
    const teamName = normalizeName(member.team_name)
    const division = normalizeName(member.division) || null

    if (sourceMemberId && !UUID_PATTERN.test(sourceMemberId)) {
      errors.push('Every returning player must have a valid source ID.')
    }
    if (!managerName || managerName.length > 80) {
      errors.push('Every player needs a manager name of 80 characters or fewer.')
    }
    if (!teamName || teamName.length > 80) {
      errors.push('Every returning player needs a team name of 80 characters or fewer.')
    }
    if (division && !divisions.includes(division)) {
      errors.push('Every player group must match a configured group.')
    }

    members.push({
      division,
      manager_name: managerName,
      source_member_id: sourceMemberId,
      team_name: teamName,
    })
  }

  const sourceMemberIds = members
    .map((member) => member.source_member_id)
    .filter((memberId): memberId is string => Boolean(memberId))
  if (new Set(sourceMemberIds).size !== sourceMemberIds.length) {
    errors.push('Each returning player can only be selected once.')
  }
  const newManagerNames = members
    .filter((member) => !member.source_member_id)
    .map((member) => member.manager_name.toLocaleLowerCase())
  if (new Set(newManagerNames).size !== newManagerNames.length) {
    errors.push('Each new manager can only be added once.')
  }
  if (body.confirmed !== true) {
    errors.push('Confirm that the new season should become active.')
  }

  if (errors.length > 0 || !rawConfiguration) {
    return { errors: [...new Set(errors)], is_valid: false }
  }

  return {
    is_valid: true,
    value: {
      configuration: {
        divisions,
        draft_food_cost: rawConfiguration.draft_food_cost as number,
        fee_amount: rawConfiguration.fee_amount as number,
        playoff_spots: playoffSpots as number,
        playoff_start_week: playoffStartWeek as number,
        prize_structure: Object.fromEntries(prizeEntries) as Record<string, number>,
        total_weeks: totalWeeks as number,
        weekly_prize_amount: rawConfiguration.weekly_prize_amount as number,
      },
      confirmed: true,
      members,
      source_season: sourceSeason,
      target_season: targetSeason,
    },
  }
}

export function createRolloverSeasonPayload(
  leagueId: string,
  targetSeason: string,
  configuration: SeasonSetupConfiguration,
) {
  return {
    divisions:
      configuration.divisions.length > 0
        ? { divisions: configuration.divisions }
        : null,
    draft_food_cost: configuration.draft_food_cost,
    fee_amount: configuration.fee_amount,
    final_winners: null,
    is_active: true,
    league_id: leagueId,
    playoff_spots: configuration.playoff_spots,
    playoff_start_week: configuration.playoff_start_week,
    prize_structure: configuration.prize_structure,
    season: targetSeason,
    total_weeks: configuration.total_weeks,
    weekly_prize_amount: configuration.weekly_prize_amount,
  }
}

export function createReturningMemberPayloads(
  leagueId: string,
  targetSeason: string,
  sourceMembers: ReturningMember[],
  configuredMembers: SeasonMemberSetup[],
) {
  const sourceById = new Map(sourceMembers.map((member) => [member.id, member]))

  return configuredMembers.map((configuredMember) => {
    const source = configuredMember.source_member_id
      ? sourceById.get(configuredMember.source_member_id)
      : null
    if (configuredMember.source_member_id && !source) {
      throw new Error('A returning player is not in the source season.')
    }

    return {
      division: configuredMember.division,
      is_active: true,
      league_id: leagueId,
      ...(source?.manager_id ? { manager_id: source.manager_id } : {}),
      manager_name: configuredMember.manager_name || source?.manager_name || '',
      payment_status: 'pending' as const,
      season: targetSeason,
      team_name: configuredMember.team_name,
    }
  })
}
