import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface League {
  id: string
  name: string
  current_season: string
  fee_amount: number
  created_at: string
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

export interface LeagueMember {
  id: string
  league_id: string
  manager_name: string
  team_name: string
  payment_status: 'pending' | 'paid'
  season: string
  is_active: boolean
  created_at: string
  division?: string
}

export interface Payment {
  id: string
  league_id: string
  member_id: string
  amount: number
  type: 'buy_in' | 'payout'
  status: 'pending' | 'completed'
  created_at: string
}

export interface WeeklyScore {
  id: string
  league_id: string
  member_id: string
  week_number: number
  points: number
  season: string
  created_at: string
}

export interface Matchup {
  id: string
  league_id: string
  season: string
  week_number: number
  team1_member_id: string
  team2_member_id: string
  team1_score?: number
  team2_score?: number
  winner_member_id?: string
  is_tie: boolean
  created_at: string
  updated_at: string
}

export interface MatchupResult {
  id: string
  league_id: string
  season: string
  week_number: number
  team1_member_id: string
  team1_manager: string
  team1_name: string
  team1_score?: number
  team2_member_id: string
  team2_manager: string
  team2_name: string
  team2_score?: number
  winner_member_id?: string
  result: 'team1' | 'team2' | 'tie' | 'pending'
  is_tie: boolean
  created_at: string
  updated_at: string
}

export interface TeamRecord {
  wins: number
  losses: number
  ties: number
}