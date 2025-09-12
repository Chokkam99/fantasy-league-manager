import { useState, useEffect, useCallback } from 'react'
import { supabase, LeagueSeason } from '@/lib/supabase'

interface UseSeasonConfigResult {
  seasonConfig: LeagueSeason | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Default values matching the database defaults
const DEFAULT_SEASON_CONFIG: Omit<LeagueSeason, 'id' | 'league_id' | 'season' | 'created_at' | 'updated_at'> = {
  fee_amount: 150,
  draft_food_cost: 250,
  weekly_prize_amount: 0,
  total_weeks: 17,
  playoff_start_week: 15,
  playoff_spots: 6,
  prize_structure: {
    first: 500,
    second: 350,
    third: 200,
    highest_points: 160
  },
  is_active: true
}

export function useSeasonConfig(leagueId: string, season: string): UseSeasonConfigResult {
  const [seasonConfig, setSeasonConfig] = useState<LeagueSeason | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSeasonConfig = useCallback(async () => {
    if (!leagueId || !season) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log(`Fetching season config for league: ${leagueId}, season: ${season}`)
      
      const { data, error: fetchError } = await supabase
        .from('league_seasons')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season', season)
        .single()

      console.log('Season config fetch result:', { data, fetchError })

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No season config found, create one with defaults
          console.log(`No season config found for ${season}, creating with defaults`)
          
          const newConfig: Omit<LeagueSeason, 'id' | 'created_at' | 'updated_at'> = {
            league_id: leagueId,
            season,
            ...DEFAULT_SEASON_CONFIG
          }

          const { data: createdData, error: createError } = await supabase
            .from('league_seasons')
            .insert([newConfig])
            .select()
            .single()

          if (createError) {
            throw createError
          }

          setSeasonConfig(createdData)
        } else {
          throw fetchError
        }
      } else {
        console.log(`✅ Successfully loaded season config:`, data)
        setSeasonConfig(data)
      }
    } catch (err) {
      console.error('Error fetching season config:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch season configuration')
      
      // Create a temporary config with defaults for display purposes
      setSeasonConfig({
        id: 'temp',
        league_id: leagueId,
        season,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...DEFAULT_SEASON_CONFIG
      })
    } finally {
      setLoading(false)
    }
  }, [leagueId, season])

  useEffect(() => {
    fetchSeasonConfig()
  }, [fetchSeasonConfig])

  return {
    seasonConfig,
    loading,
    error,
    refetch: fetchSeasonConfig
  }
}

// Hook to get team records from matchups
export function useTeamRecords(leagueId: string, season: string, maxWeek?: number) {
  const [teamRecords, setTeamRecords] = useState<Record<string, { wins: number; losses: number; ties: number }>>({})
  const [loading, setLoading] = useState(true)

  const fetchTeamRecords = useCallback(async () => {
    if (!leagueId || !season) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Get all matchups for this league/season with results
      let query = supabase
        .from('matchup_results_with_scores')
        .select(`
          team1_member_id,
          team2_member_id,
          winner_member_id,
          is_tie,
          week_number,
          team1_score,
          team2_score
        `)
        .eq('league_id', leagueId)
        .eq('season', season)
        .not('team1_score', 'is', null)
        .not('team2_score', 'is', null)
        
      // Apply week filter if provided
      if (maxWeek) {
        query = query.lte('week_number', maxWeek)
      }
      
      const { data: matchups, error } = await query

      if (error) throw error

      // Calculate records for each team
      const records: Record<string, { wins: number; losses: number; ties: number }> = {}

      matchups?.forEach(matchup => {
        const { team1_member_id, team2_member_id, winner_member_id, is_tie } = matchup

        // Initialize records if not exists
        if (!records[team1_member_id]) {
          records[team1_member_id] = { wins: 0, losses: 0, ties: 0 }
        }
        if (!records[team2_member_id]) {
          records[team2_member_id] = { wins: 0, losses: 0, ties: 0 }
        }

        // Update records
        if (is_tie) {
          records[team1_member_id].ties++
          records[team2_member_id].ties++
        } else if (winner_member_id === team1_member_id) {
          records[team1_member_id].wins++
          records[team2_member_id].losses++
        } else if (winner_member_id === team2_member_id) {
          records[team2_member_id].wins++
          records[team1_member_id].losses++
        }
      })

      setTeamRecords(records)
    } catch (err) {
      console.error('Error fetching team records:', err)
      setTeamRecords({})
    } finally {
      setLoading(false)
    }
  }, [leagueId, season, maxWeek])

  useEffect(() => {
    fetchTeamRecords()
  }, [fetchTeamRecords])

  return { teamRecords, loading, refetch: fetchTeamRecords }
}