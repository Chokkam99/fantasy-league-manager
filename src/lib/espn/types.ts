// ESPN API type definitions

export interface ESPNLeague {
  id: number;
  settings: {
    name: string;
    size: number;
    reg_season_count: number;
  };
  current_week: number;
}

export interface ESPNTeam {
  team_id: number;
  team_name: string;
  wins: number;
  losses: number;
}

export interface ESPNMatchup {
  home_team: {
    team_name: string;
    team_id: number;
  };
  away_team: {
    team_name: string;
    team_id: number;
  };
  home_score: number;
  away_score: number;
}

export interface ESPNWeekData {
  week: number;
  matchups: ESPNMatchup[];
  is_complete: boolean;
}

// Our internal types for data mapping
export interface WeekImportData {
  week: number;
  scores: Array<{
    member_id: string;
    points: number;
    team_name: string;
  }>;
  matchups: Array<{
    team1_member_id: string;
    team2_member_id: string;
    // Note: scores, winner, and tie status are derived from weekly_scores
    // by the matchup_results_with_scores view, not stored in matchups table
  }>;
  is_complete: boolean;
}

export interface ESPNConfig {
  league_id: string;
  year: number;
  private_league?: boolean;
  espn_s2?: string; // For private leagues
  swid?: string; // For private leagues
}