// ESPN Fantasy API client wrapper
// Uses direct HTTP requests to ESPN's Fantasy API endpoints

import { ESPNLeague, ESPNWeekData, ESPNConfig } from './types';

interface ESPNTeamData {
  id: number;
  location?: string;
  nickname?: string;
  name?: string;
  owners?: string[];
  [key: string]: unknown;
}

interface ESPNMatchupData {
  matchupPeriodId: number;
  home?: {
    teamId: number;
    totalPoints?: number;
  };
  away?: {
    teamId: number;
    totalPoints?: number;
  };
  [key: string]: unknown;
}

interface ESPNSettingsData {
  name?: string;
  scheduleSettings?: {
    matchupPeriodCount?: number;
  };
  [key: string]: unknown;
}

interface ESPNAPIResponse {
  teams?: ESPNTeamData[];
  schedule?: ESPNMatchupData[];
  settings?: ESPNSettingsData;
  scoringPeriodId?: number;
  status?: Record<string, unknown>;
  members?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    [key: string]: unknown;
  }>;
}

export class ESPNClient {
  private leagueId: string;
  private year: number;
  private espnS2?: string;
  private swid?: string;

  constructor(config: ESPNConfig) {
    this.leagueId = config.league_id;
    this.year = config.year;
    this.espnS2 = config.espn_s2;
    this.swid = config.swid;
  }

  async makeRequest(endpoint: string, params: Record<string, string> = {}): Promise<ESPNAPIResponse> {
    try {
      // Use Next.js API route to bypass CORS
      const response = await fetch('/api/espn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leagueId: this.leagueId,
          year: this.year,
          espnS2: this.espnS2,
          swid: this.swid,
          endpoint,
          params
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `ESPN API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get league information
   */
  async getLeague(): Promise<ESPNLeague> {
    try {
      const data = await this.makeRequest('', {
        view: 'mSettings,mTeam'
      });

      if (!data.settings || !data.teams) {
        throw new Error('Invalid league data received from ESPN');
      }

      return {
        id: parseInt(this.leagueId),
        settings: {
          name: data.settings.name || 'ESPN League',
          size: data.teams.length,
          reg_season_count: data.settings.scheduleSettings?.matchupPeriodCount || 17,
        },
        current_week: data.scoringPeriodId || 1,
      };
    } catch (error) {
      console.error('ESPN API Error - getLeague:', error);
      throw new Error(`Failed to fetch ESPN league data: ${error}`);
    }
  }

  /**
   * Get week data including matchups and scores
   */
  async getWeekData(week: number): Promise<ESPNWeekData> {
    try {
      // Get schedule data (matchups) and team data separately since combining views doesn't work reliably
      const [scheduleData, teamData] = await Promise.all([
        this.makeRequest('', {
          view: 'mMatchup',
          scoringPeriodId: week.toString()
        }),
        this.makeRequest('', {
          view: 'mTeam'
        })
      ]);

      if (!scheduleData.schedule) {
        throw new Error('No schedule data received from ESPN');
      }

      if (!teamData.teams) {
        throw new Error('No team data received from ESPN');
      }

      // Create team lookup map
      const teamMap = new Map();
      teamData.teams.forEach((team: ESPNTeamData) => {
        teamMap.set(team.id, {
          team_name: team.location && team.nickname ? `${team.location} ${team.nickname}` : `Team ${team.id}`,
          team_id: team.id
        });
      });

      // Filter matchups for the specific week
      const weekMatchups = scheduleData.schedule.filter((matchup: ESPNMatchupData) => 
        matchup.matchupPeriodId === week
      );

      if (weekMatchups.length === 0) {
        throw new Error(`No matchups found for week ${week}`);
      }

      const matchups = weekMatchups.map((matchup: ESPNMatchupData) => {
        const homeTeam = teamMap.get(matchup.home?.teamId);
        const awayTeam = teamMap.get(matchup.away?.teamId);

        return {
          home_team: homeTeam || { team_name: `Team ${matchup.home?.teamId}`, team_id: matchup.home?.teamId },
          away_team: awayTeam || { team_name: `Team ${matchup.away?.teamId}`, team_id: matchup.away?.teamId },
          home_score: matchup.home?.totalPoints || 0,
          away_score: matchup.away?.totalPoints || 0,
        };
      });

      // Detect if week is complete
      const isComplete = this.isWeekComplete(week, matchups);

      return {
        week,
        matchups,
        is_complete: isComplete,
      };
    } catch (error) {
      console.error('ESPN API Error - getWeekData:', error);
      throw new Error(`Failed to fetch ESPN week ${week} data: ${error}`);
    }
  }

  /**
   * Check if a week is complete based on various criteria
   */
  private isWeekComplete(week: number, matchups: Array<{ home_score: number; away_score: number }>): boolean {
    const now = new Date();
    
    // Rule 1: Tuesday or later (NFL games end Monday night)
    const isTuesdayOrLater = now.getDay() >= 2;
    
    // Rule 2: All matchups have non-zero scores
    const allMatchupsHaveScores = matchups.every(
      matchup => matchup.home_score > 0 && matchup.away_score > 0
    );
    
    // Rule 3: No obviously incomplete scores (like exactly 0.00)
    const noZeroScores = matchups.every(
      matchup => matchup.home_score !== 0 || matchup.away_score !== 0
    );

    // Week is considered complete if it's Tuesday+ AND all games have scores
    return isTuesdayOrLater && allMatchupsHaveScores && noZeroScores;
  }

  /**
   * Test connection to ESPN API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getLeague();
      return true;
    } catch (error) {
      console.error('ESPN connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current week from ESPN
   */
  async getCurrentWeek(): Promise<number> {
    try {
      const league = await this.getLeague();
      return league.current_week;
    } catch (error) {
      console.error('Failed to get current week from ESPN:', error);
      // Fallback to date-based calculation
      return this.calculateCurrentWeek();
    }
  }

  /**
   * Fallback method to calculate current NFL week based on date
   */
  private calculateCurrentWeek(): number {
    const now = new Date();
    const seasonStart = new Date(this.year, 8, 1); // September 1st
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(weeksSinceStart + 1, 18)); // Weeks 1-18
  }
}