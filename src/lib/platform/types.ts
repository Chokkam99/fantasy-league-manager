// Generic platform integration types
// Supports ESPN, Yahoo, Sleeper, and other fantasy platforms

export type PlatformType = 'manual' | 'espn' | 'yahoo' | 'sleeper'

export interface PlatformConfig {
  platform_type: PlatformType
  league_id: string
  year: number
  private_league?: boolean
  credentials?: Record<string, string> // For API keys, cookies, tokens, etc.
}

export interface PlatformTeam {
  team_id: string | number
  team_name: string
  manager_name?: string
}

export interface PlatformMatchup {
  home_team: PlatformTeam
  away_team: PlatformTeam
  home_score: number
  away_score: number
}

export interface PlatformWeekData {
  week: number
  matchups: PlatformMatchup[]
  is_complete: boolean
}

export interface WeekImportData {
  week: number
  scores: Array<{
    member_id: string
    points: number
    team_name: string
  }>
  matchups: Array<{
    team1_member_id: string
    team2_member_id: string
    // Note: scores, winner, and tie status are derived from weekly_scores
    // by the matchup_results_with_scores view, not stored in matchups table
  }>
  is_complete: boolean
}

export interface ImportResult {
  success: boolean
  imported_scores: number
  imported_matchups: number
  message: string
}

// Abstract interface that all platform clients must implement
export interface PlatformClient {
  testConnection(): Promise<boolean>
  getCurrentWeek(): Promise<number>
  getWeekData(week: number): Promise<PlatformWeekData>
}

// Abstract interface that all platform import services must implement
export interface PlatformImportService {
  previewWeek(week: number): Promise<WeekImportData>
  importWeek(week: number): Promise<ImportResult>
  testConnection(): Promise<boolean>
  getCurrentWeek(): Promise<number>
}