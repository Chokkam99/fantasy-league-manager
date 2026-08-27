import { createClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/database.types'
export { hasConfiguredLeagueSeason } from '@/lib/leagueSeason'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Exact generated row contracts. Existing UI-facing interfaces below are
// retained temporarily as normalized view models while consumers migrate.
export type LeagueRow = Tables<'leagues'>
export type LeagueSeasonRow = Tables<'league_seasons'>
export type LeagueMemberRow = Tables<'league_members'>
export type PaymentRow = Tables<'payments'>
export type WeeklyScoreRow = Tables<'weekly_scores'>
export type MatchupRow = Tables<'matchups'>
export type MatchupResultRow = Tables<'matchup_results_with_scores'>

type PublicLeagueKey =
  | 'auto_sync_enabled'
  | 'created_at'
  | 'current_season'
  | 'id'
  | 'last_sync_at'
  | 'last_sync_error'
  | 'name'
  | 'platform_league_id'
  | 'platform_type'
  | 'sync_status'
  | 'updated_at'

export type League = Omit<Pick<LeagueRow, PublicLeagueKey>, 'current_season'> & {
  archived_at?: string | null
  current_season: string
}

export interface LeagueSeason {
  id: string
  league_id: string
  season: string
  fee_amount: number
  draft_food_cost: number
  weekly_prize_amount: number
  total_weeks: number
  playoff_start_week: number
  playoff_spots: number
  divisions?: { divisions?: string[] } | string[] | null
  final_winners?: Record<string, string | null> | null
  prize_structure: {
    first: number
    second: number
    third: number
    fourth?: number
    highest_points?: number
    highest_weekly?: number
    lowest_weekly?: number
  }
  is_active: boolean
  created_at: string
  updated_at: string
}

export type LeagueMember = LeagueMemberRow
export type Payment = PaymentRow
export type WeeklyScore = WeeklyScoreRow
export type Matchup = MatchupRow
export type MatchupResult = MatchupResultRow

export interface TeamRecord {
  wins: number
  losses: number
  ties: number
}
