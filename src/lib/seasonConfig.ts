import type { Json } from '@/lib/database.types'
import type { LeagueSeason, LeagueSeasonRow } from '@/lib/supabase'

export type SeasonConfigValues = Omit<
  LeagueSeason,
  'id' | 'league_id' | 'season' | 'created_at' | 'updated_at'
>

export const DEFAULT_SEASON_CONFIG: SeasonConfigValues = {
  fee_amount: 0,
  draft_food_cost: 0,
  weekly_prize_amount: 0,
  total_weeks: 17,
  playoff_start_week: 15,
  playoff_spots: 6,
  prize_structure: {
    first: 0,
    second: 0,
    third: 0,
  },
  is_active: true,
}

function isJsonRecord(value: Json): value is { [key: string]: Json | undefined } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizePrizeStructure(value: Json): LeagueSeason['prize_structure'] {
  if (!isJsonRecord(value)) return { first: 0, second: 0, third: 0 }

  const normalized = Object.fromEntries(
    Object.entries(value).flatMap(([key, amount]) => {
      const parsed = Number(amount)
      return Number.isFinite(parsed) ? [[key, parsed]] : []
    }),
  )

  return {
    first: normalized.first || 0,
    second: normalized.second || 0,
    third: normalized.third || 0,
    ...normalized,
  }
}

function normalizeFinalWinners(
  value: Json,
): LeagueSeason['final_winners'] {
  if (!isJsonRecord(value)) return null

  return Object.fromEntries(
    Object.entries(value).map(([key, memberId]) => [
      key,
      typeof memberId === 'string' ? memberId : null,
    ]),
  )
}

function normalizeDivisions(value: Json): LeagueSeason['divisions'] {
  if (Array.isArray(value)) {
    return value.filter((division): division is string => typeof division === 'string')
  }

  if (isJsonRecord(value) && Array.isArray(value.divisions)) {
    return {
      divisions: value.divisions.filter(
        (division): division is string => typeof division === 'string',
      ),
    }
  }

  return null
}

export function normalizeSeasonConfig(
  row: Omit<LeagueSeasonRow, 'archived_at'>,
): LeagueSeason {
  return {
    created_at: row.created_at || '',
    divisions: normalizeDivisions(row.divisions),
    draft_food_cost: row.draft_food_cost ?? 0,
    fee_amount: row.fee_amount,
    final_winners: normalizeFinalWinners(row.final_winners),
    id: row.id,
    is_active: row.is_active ?? false,
    league_id: row.league_id,
    playoff_spots: row.playoff_spots ?? 0,
    playoff_start_week: row.playoff_start_week ?? 0,
    prize_structure: normalizePrizeStructure(row.prize_structure),
    season: row.season,
    total_weeks: row.total_weeks ?? 0,
    updated_at: row.updated_at || '',
    weekly_prize_amount: row.weekly_prize_amount ?? 0,
  }
}

export function createSeasonConfigPayload(
  leagueId: string,
  season: string,
  feeAmount: number,
): Omit<LeagueSeason, 'id' | 'created_at' | 'updated_at'> {
  return {
    league_id: leagueId,
    season,
    ...DEFAULT_SEASON_CONFIG,
    fee_amount: feeAmount,
  }
}

export function createUnsavedSeasonConfig(
  leagueId: string,
  season: string,
): LeagueSeason {
  const now = new Date().toISOString()

  return {
    id: 'unsaved',
    league_id: leagueId,
    season,
    created_at: now,
    updated_at: now,
    ...DEFAULT_SEASON_CONFIG,
  }
}
