/**
 * ESPN Fantasy Football API Integration Service
 * 
 * Handles importing fantasy data from ESPN API and converting it to our database format.
 * Features robust team/member mapping and automatic matchup result calculation.
 */

import { supabase } from '@/lib/supabase';
import { ESPNClient } from './client';
import { WeekImportData, ESPNConfig } from './types';
import { PlatformImportService, ImportResult } from '../platform/types';
import { ESPNNameMapper } from './name-mapper';

export class ESPNImportService implements PlatformImportService {
  private espnClient: ESPNClient;
  private leagueId: string;
  private season: string;

  constructor(leagueId: string, season: string, espnConfig: ESPNConfig) {
    this.espnClient = new ESPNClient(espnConfig);
    this.leagueId = leagueId;
    this.season = season;
  }

  /**
   * Preview ESPN data for a week without importing
   */
  async previewWeek(week: number): Promise<WeekImportData> {
    try {
      const espnWeekData = await this.espnClient.getWeekData(week);
      return await this.mapESPNDataToOurFormat(espnWeekData);
    } catch (error) {
      console.error('Failed to preview ESPN week data:', error);
      throw error;
    }
  }

  /**
   * Import ESPN data for a specific week into the database
   * 
   * @param week - Week number to import (1-17)
   * @returns Promise with import results and summary
   */
  async importWeek(week: number): Promise<ImportResult> {
    try {
      // Fetch and transform ESPN data for the specified week
      const weekData = await this.previewWeek(week);

      // Save individual player scores to weekly_scores table
      const importedScores = await this.importWeeklyScores(weekData);

      // Save matchup results with calculated winners to matchups table
      const importedMatchups = await this.importMatchups(weekData);

      // Mark league as successfully synced
      await supabase
        .from('leagues')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_status: 'active'
        })
        .eq('id', this.leagueId);

      return {
        success: true,
        imported_scores: importedScores,
        imported_matchups: importedMatchups,
        message: `Successfully imported ${importedScores} scores and ${importedMatchups} matchups for week ${week}`
      };
    } catch (error) {
      console.error('ESPN import failed:', error);
      
      // Update league sync status to error
      await supabase
        .from('leagues')
        .update({
          sync_status: 'error'
        })
        .eq('id', this.leagueId);

      throw error;
    }
  }

  /**
   * Map ESPN data to our database format using robust name matching
   */
  private async mapESPNDataToOurFormat(espnWeekData: { week: number; matchups: Array<{ home_team: { team_name: string; team_id: string | number }; away_team: { team_name: string; team_id: string | number }; home_score: number; away_score: number }>; is_complete: boolean }): Promise<WeekImportData> {
    // Get our league members to map ESPN teams
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select('id, team_name, manager_name')
      .eq('league_id', this.leagueId)
      .eq('season', this.season)
      .eq('is_active', true);

    if (membersError) {
      throw new Error(`Failed to get league members: ${membersError.message}`);
    }

    if (!members || members.length === 0) {
      throw new Error('No league members found for mapping');
    }

    // Get ESPN league data to access members and teams  
    const espnData = await this.espnClient.makeRequest('', { view: 'mTeam' });
    
    if (!espnData.teams || !espnData.members) {
      throw new Error('Failed to get ESPN team and member data for mapping');
    }

    // Transform ESPN data to match name mapper interface
    const espnMembers = espnData.members?.map(member => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName
    })) || [];

    const espnTeams = espnData.teams?.map(team => ({
      id: team.id,
      name: team.name || (team.location && team.nickname ? `${team.location} ${team.nickname}` : `Team ${team.id}`),
      owners: team.owners || []
    })) || [];

    // Create robust team mapping using name matching
    const mappingResult = ESPNNameMapper.createTeamMapping(
      espnMembers,
      espnTeams,
      members
    );

    // Validate mapping results
    const validation = ESPNNameMapper.validateMapping(mappingResult);
    
    if (!validation.isValid) {
      console.error('ESPN team mapping failed:', validation.errors.join(', '));
      throw new Error(`Team mapping failed: ${validation.errors.join('; ')}`);
    }

    // Create lookup map for quick access
    const memberMap = ESPNNameMapper.createLookupMap(mappingResult.mappings);

    console.log(`✅ Successfully mapped ${mappingResult.mappings.length} ESPN teams to database members`);
    
    if (validation.warnings.length > 0) {
      console.warn('Mapping warnings:', validation.warnings.join('; '));
    }

    // Map scores and matchups
    const scores: WeekImportData['scores'] = [];
    const matchups: WeekImportData['matchups'] = [];

    espnWeekData.matchups.forEach((espnMatchup) => {
      const homeTeamId = parseInt(String(espnMatchup.home_team.team_id));
      const awayTeamId = parseInt(String(espnMatchup.away_team.team_id));
      
      const homeMemberId = memberMap.get(homeTeamId);
      const awayMemberId = memberMap.get(awayTeamId);

      if (!homeMemberId || !awayMemberId) {
        console.warn(`Could not map ESPN team IDs: ${homeTeamId} vs ${awayTeamId}`);
        console.warn('Available mappings:', Array.from(memberMap.entries()));
        return;
      }

      // Find the actual member objects for team names
      const homeMember = members.find(m => m.id === homeMemberId);
      const awayMember = members.find(m => m.id === awayMemberId);

      if (!homeMember || !awayMember) {
        console.warn(`Could not find member objects for IDs: ${homeMemberId}, ${awayMemberId}`);
        return;
      }

      // Add scores
      scores.push({
        member_id: homeMember.id,
        points: espnMatchup.home_score,
        team_name: homeMember.team_name
      });

      scores.push({
        member_id: awayMember.id,
        points: espnMatchup.away_score,
        team_name: awayMember.team_name
      });

      // Add matchup (only basic matchup info - winner and tie status are calculated by the view)
      matchups.push({
        team1_member_id: homeMember.id,
        team2_member_id: awayMember.id
        // Note: team1_score, team2_score, winner_member_id, and is_tie are calculated 
        // by the matchup_results_with_scores view based on weekly_scores data
      });
    });

    return {
      week: espnWeekData.week,
      scores,
      matchups,
      is_complete: espnWeekData.is_complete
    };
  }

  /**
   * Import weekly scores to database
   */
  private async importWeeklyScores(weekData: WeekImportData): Promise<number> {
    let importedCount = 0;

    for (const score of weekData.scores) {
      const { error } = await supabase
        .from('weekly_scores')
        .upsert({
          league_id: this.leagueId,
          season: this.season,
          week_number: weekData.week,
          member_id: score.member_id,
          points: score.points
        }, {
          onConflict: 'league_id,member_id,week_number,season'
        });

      if (error) {
        console.error('Failed to import score:', error);
        throw new Error(`Failed to import score for ${score.team_name}: ${error.message}`);
      }

      importedCount++;
    }

    return importedCount;
  }

  /**
   * Import matchups to database
   */
  private async importMatchups(weekData: WeekImportData): Promise<number> {
    let importedCount = 0;

    for (const matchup of weekData.matchups) {
      // Check if matchup already exists (check both directions separately)
      const { data: existingMatchups } = await supabase
        .from('matchups')
        .select('id')
        .eq('league_id', this.leagueId)
        .eq('season', this.season)
        .eq('week_number', weekData.week)
        .or(`and(team1_member_id.eq."${matchup.team1_member_id}",team2_member_id.eq."${matchup.team2_member_id}"),and(team1_member_id.eq."${matchup.team2_member_id}",team2_member_id.eq."${matchup.team1_member_id}")`);

      if (existingMatchups && existingMatchups.length > 0) {
        // Matchup already exists in either direction, skip
        console.log(`Matchup already exists for week ${weekData.week}: ${matchup.team1_member_id} vs ${matchup.team2_member_id}`);
        continue;
      }

      const { error } = await supabase
        .from('matchups')
        .insert({
          league_id: this.leagueId,
          season: this.season,
          week_number: weekData.week,
          team1_member_id: matchup.team1_member_id,
          team2_member_id: matchup.team2_member_id
          // Note: winner_member_id and is_tie are calculated by the matchup_results_with_scores view
          // based on the weekly_scores table data, so we don't insert them here
        });

      if (error) {
        console.error('Failed to import matchup:', error);
        throw new Error(`Failed to import matchup: ${error.message}`);
      }

      importedCount++;
    }
    return importedCount;
  }


  /**
   * Test ESPN connection
   */
  async testConnection(): Promise<boolean> {
    return await this.espnClient.testConnection();
  }

  /**
   * Get current week from ESPN
   */
  async getCurrentWeek(): Promise<number> {
    return await this.espnClient.getCurrentWeek();
  }
}