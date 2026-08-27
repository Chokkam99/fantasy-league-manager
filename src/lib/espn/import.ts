/**
 * ESPN Fantasy Football API Integration Service
 * 
 * Handles importing fantasy data from ESPN API and converting it to our database format.
 * Features robust team/member mapping and automatic matchup result calculation.
 */

import type { AppSupabaseClient } from '@/lib/supabaseServer';
import { ESPNClient } from './client';
import { WeekImportData, ESPNConfig, type ESPNTeamMappingSnapshot } from './types';
import { PlatformImportService, ImportResult } from '../platform/types';
import { ESPNNameMapper, ESPNTeamMappingError } from './name-mapper';
import {
  ESPNImportPersistenceError,
  type ImportTriggerMode,
  parseAtomicImportResponse,
} from './persistence';

export class ESPNImportService implements PlatformImportService {
  private espnClient: ESPNClient;
  private database: AppSupabaseClient;
  private leagueId: string;
  private season: string;
  private teamMappings: Record<string, string>;

  constructor(
    leagueId: string,
    season: string,
    espnConfig: ESPNConfig,
    database: AppSupabaseClient,
  ) {
    this.espnClient = new ESPNClient(espnConfig);
    this.database = database;
    this.leagueId = leagueId;
    this.season = season;
    this.teamMappings = espnConfig.team_mappings || {};
  }

  async getTeamMappingSnapshot(
    mappings: Record<string, string> = this.teamMappings,
  ): Promise<ESPNTeamMappingSnapshot> {
    const { data: members, error: membersError } = await this.database
      .from('league_members')
      .select('id, team_name, manager_name')
      .eq('league_id', this.leagueId)
      .eq('season', this.season)
      .eq('is_active', true);

    if (membersError) {
      throw new Error(`Failed to get league members: ${membersError.message}`);
    }
    if (!members || members.length === 0) {
      throw new Error('No active league players are available for ESPN mapping.');
    }

    const espnData = await this.espnClient.makeRequest('', { view: 'mTeam' });
    if (!espnData.teams || !espnData.members) {
      throw new Error('ESPN did not return the teams and owners needed for mapping.');
    }

    const espnMembers = espnData.members.map((member) => ({
      firstName: member.firstName,
      id: member.id,
      lastName: member.lastName,
    }));
    const espnTeams = espnData.teams.map((team) => ({
      id: team.id,
      name:
        team.name ||
        (team.location && team.nickname
          ? `${team.location} ${team.nickname}`
          : `Team ${team.id}`),
      owners: team.owners || [],
    }));
    const result = ESPNNameMapper.createTeamMapping(
      espnMembers,
      espnTeams,
      members,
      mappings,
    );

    return ESPNNameMapper.createSnapshot(
      result,
      espnMembers,
      espnTeams,
      members,
    );
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
   * @param week - Week number to import
   * @returns Promise with import results and summary
   */
  async importWeek(week: number): Promise<ImportResult> {
    try {
      // Fetch and transform ESPN data for the specified week
      const weekData = await this.previewWeek(week);

      return await this.importValidatedWeekData(weekData);
    } catch (error) {
      console.error('ESPN import failed:', error);

      // The atomic function records its own durable failure state. Failures that
      // happen before persistence still need the league-level health flag.
      if (!(error instanceof ESPNImportPersistenceError)) {
        await this.database
          .from('leagues')
          .update({
            sync_status: 'error',
            last_sync_error:
              error instanceof Error ? error.message : 'Unknown import error'
          })
          .eq('id', this.leagueId);
      }

      throw error;
    }
  }

  /**
   * Persist a payload that has already passed the server validation boundary.
   */
  async importValidatedWeekData(
    weekData: WeekImportData,
    triggerMode: ImportTriggerMode = 'manual',
  ): Promise<ImportResult> {
    const { data, error } = await this.database.rpc(
      'import_espn_week_atomically',
      {
        p_league_id: this.leagueId,
        p_matchups: weekData.matchups,
        p_scores: weekData.scores.map(({ member_id, points }) => ({
          member_id,
          points,
        })),
        p_season: this.season,
        p_trigger_mode: triggerMode,
        p_week: weekData.week,
      },
    );

    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        throw new Error(
          'Atomic ESPN imports are not active in the database. Apply the prepared import migration before enabling sync.',
        );
      }
      throw new Error(`Atomic ESPN import failed: ${error.message}`);
    }

    const result = parseAtomicImportResponse(data);
    if (!result.success) throw new ESPNImportPersistenceError(result);

    return {
      success: true,
      imported_scores: result.score_count,
      imported_matchups: result.matchup_count,
      import_run_id: result.run_id,
      message: `Successfully imported ${result.score_count} scores and ${result.matchup_count} matchups for week ${weekData.week}`,
    };
  }

  /**
   * Map ESPN data to our database format using robust name matching
   */
  private async mapESPNDataToOurFormat(espnWeekData: { week: number; matchups: Array<{ home_team: { team_name: string; team_id: string | number }; away_team: { team_name: string; team_id: string | number }; home_score: number; away_score: number }>; is_complete: boolean }): Promise<WeekImportData> {
    const mapping = await this.getTeamMappingSnapshot();
    if (!mapping.is_complete) throw new ESPNTeamMappingError(mapping);

    const memberMap = new Map(
      mapping.assignments.map((assignment) => [
        assignment.espn_team_id,
        assignment.member_id,
      ]),
    );
    const members = mapping.members.map((member) => ({
      id: member.member_id,
      manager_name: member.manager_name,
      team_name: member.team_name,
    }));

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

  async getLatestCompletedWeek(maximumWeek?: number): Promise<number | null> {
    return this.espnClient.getLatestCompletedWeek(maximumWeek);
  }
}
