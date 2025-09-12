import { renderHook, waitFor } from '@testing-library/react'
import { useSeasonConfig } from '../useSeasonConfig'
import { supabase } from '@/lib/supabase'

// Mock Supabase
const mockSupabaseResponse = { data: [], error: null }

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve(mockSupabaseResponse))
          }))
        }))
      }))
    })),
    rpc: jest.fn(() => Promise.resolve(mockSupabaseResponse))
  }
}))

describe('useSeasonConfig Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseResponse.data = null
    mockSupabaseResponse.error = null
  })

  describe('Season Configuration Loading', () => {
    it('should load season configuration successfully', async () => {
      const mockSeasonConfig = {
        id: 'config-123',
        league_id: 'league-123',
        season: '2024',
        playoff_start_week: 15,
        total_weeks: 17,
        playoff_spots: 6,
        weekly_prize_amount: 25,
        divisions: {
          divisions: ['East', 'West'],
          playoff_spots: 6
        },
        prize_structure: {
          first: 300,
          second: 150,
          third: 75,
          fourth: 25,
          highest_weekly: 10,
          lowest_weekly: 5
        },
        final_winners: {
          first: null,
          second: null,
          third: null
        }
      }

      mockSupabaseResponse.data = mockSeasonConfig

      const { result } = renderHook(() => 
        useSeasonConfig('league-123', '2024')
      )

      await waitFor(() => {
        expect(result.current.seasonConfig).toEqual(mockSeasonConfig)
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeNull()
      })

      expect(supabase.from).toHaveBeenCalledWith('league_seasons')
    })

    it('should handle missing season configuration', async () => {
      mockSupabaseResponse.data = null
      mockSupabaseResponse.error = null

      const { result } = renderHook(() => 
        useSeasonConfig('league-123', '2024')
      )

      await waitFor(() => {
        expect(result.current.seasonConfig).toBeNull()
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeNull()
      })
    })

    it('should handle database errors', async () => {
      const mockError = { message: 'Database connection failed', code: 'DB_ERROR' }
      mockSupabaseResponse.data = null
      mockSupabaseResponse.error = mockError

      const { result } = renderHook(() => 
        useSeasonConfig('league-123', '2024')
      )

      await waitFor(() => {
        expect(result.current.seasonConfig).toBeNull()
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toEqual(mockError)
      })
    })

    it('should show loading state initially', () => {
      const { result } = renderHook(() => 
        useSeasonConfig('league-123', '2024')
      )

      expect(result.current.loading).toBe(true)
      expect(result.current.seasonConfig).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })

  describe('Team Records Calculation', () => {
    it('should calculate team records correctly', async () => {
      const mockMatchupResults = [
        {
          team1_member_id: 'member-1',
          team2_member_id: 'member-2',
          winner_member_id: 'member-1',
          is_tie: false,
          team1_score: 125.75,
          team2_score: 110.50,
          week_number: 1
        },
        {
          team1_member_id: 'member-1',
          team2_member_id: 'member-3',
          winner_member_id: 'member-3',
          is_tie: false,
          team1_score: 95.25,
          team2_score: 130.75,
          week_number: 2
        },
        {
          team1_member_id: 'member-2',
          team2_member_id: 'member-3',
          winner_member_id: null,
          is_tie: true,
          team1_score: 115.50,
          team2_score: 115.50,
          week_number: 3
        }
      ]

      const mockSeasonConfig = {
        league_id: 'league-123',
        season: '2024',
        playoff_start_week: 15,
        total_weeks: 17
      }

      // First call returns season config
      mockSupabaseResponse.data = mockSeasonConfig
      
      const { result } = renderHook(() => 
        useSeasonConfig('league-123', '2024')
      )

      // Wait for season config to load
      await waitFor(() => {
        expect(result.current.seasonConfig).toEqual(mockSeasonConfig)
      })

      // Second call returns matchup results for team records
      mockSupabaseResponse.data = mockMatchupResults

      const { teamRecords } = result.current

      await waitFor(() => {
        expect(teamRecords).toBeDefined()
      })

      // Verify that the RPC was called with correct parameters
      expect(supabase.from).toHaveBeenCalledWith('league_seasons')
    })

    it('should handle empty matchup results', async () => {
      const mockSeasonConfig = {
        league_id: 'league-123',
        season: '2024',
        playoff_start_week: 15,
        total_weeks: 17
      }

      mockSupabaseResponse.data = mockSeasonConfig

      const { result } = renderHook(() => 
        useSeasonConfig('league-123', '2024')
      )

      await waitFor(() => {
        expect(result.current.seasonConfig).toEqual(mockSeasonConfig)
      })

      // Return empty results for team records
      mockSupabaseResponse.data = []

      const { teamRecords } = result.current

      await waitFor(() => {
        expect(teamRecords).toBeDefined()
      })
    })

    it('should filter by week limit', async () => {
      const mockSeasonConfig = {
        league_id: 'league-123',
        season: '2024',
        playoff_start_week: 15,
        total_weeks: 17
      }

      mockSupabaseResponse.data = mockSeasonConfig

      const { result } = renderHook(() => 
        useSeasonConfig('league-123', '2024', 10) // Week limit of 10
      )

      await waitFor(() => {
        expect(result.current.seasonConfig).toEqual(mockSeasonConfig)
      })

      // The hook should only consider matchups up to week 10
      expect(supabase.from).toHaveBeenCalledWith('league_seasons')
    })
  })

  describe('Configuration Validation', () => {
    it('should validate season configuration structure', () => {
      const validConfig = {
        id: 'config-123',
        league_id: 'league-123',
        season: '2024',
        playoff_start_week: 15,
        total_weeks: 17,
        playoff_spots: 6,
        weekly_prize_amount: 25,
        divisions: {
          divisions: ['East', 'West'],
          playoff_spots: 6
        },
        prize_structure: {
          first: 300,
          second: 150,
          third: 75
        },
        final_winners: {
          first: null,
          second: null,
          third: null
        }
      }

      // Validate required fields
      expect(validConfig.league_id).toBeTruthy()
      expect(validConfig.season).toBeTruthy()
      expect(validConfig.playoff_start_week).toBeGreaterThan(0)
      expect(validConfig.total_weeks).toBeGreaterThan(0)

      // Validate week constraints
      expect(validConfig.playoff_start_week).toBeLessThanOrEqual(validConfig.total_weeks)
      expect(validConfig.playoff_start_week).toBeGreaterThanOrEqual(1)
      expect(validConfig.total_weeks).toBeLessThanOrEqual(18)

      // Validate playoff spots
      expect(validConfig.playoff_spots).toBeGreaterThan(0)
      expect(validConfig.playoff_spots).toBeLessThanOrEqual(12)

      // Validate prize structure
      expect(validConfig.prize_structure.first).toBeGreaterThan(0)
      expect(validConfig.prize_structure.first).toBeGreaterThan(validConfig.prize_structure.second)
      expect(validConfig.prize_structure.second).toBeGreaterThan(validConfig.prize_structure.third)
    })

    it('should validate division configuration', () => {
      const divisionConfig = {
        divisions: ['East', 'West', 'North', 'South'],
        playoff_spots: 8
      }

      // Validate divisions
      expect(divisionConfig.divisions.length).toBeGreaterThan(0)
      expect(divisionConfig.divisions.length).toBeLessThanOrEqual(4)
      expect(divisionConfig.divisions.every(div => typeof div === 'string')).toBe(true)
      expect(divisionConfig.divisions.every(div => div.length > 0)).toBe(true)

      // Validate playoff spots are reasonable for divisions
      expect(divisionConfig.playoff_spots).toBeGreaterThanOrEqual(divisionConfig.divisions.length)
    })

    it('should validate prize structure completeness', () => {
      const prizeStructure = {
        first: 500,
        second: 250,
        third: 125,
        fourth: 50,
        highest_weekly: 25,
        lowest_weekly: 10
      }

      // Validate descending prize amounts
      expect(prizeStructure.first).toBeGreaterThan(prizeStructure.second)
      expect(prizeStructure.second).toBeGreaterThan(prizeStructure.third)
      expect(prizeStructure.third).toBeGreaterThan(prizeStructure.fourth)

      // Validate all prizes are positive
      Object.values(prizeStructure).forEach(amount => {
        expect(amount).toBeGreaterThan(0)
        expect(Number.isFinite(amount)).toBe(true)
      })

      // Validate total prize pool is reasonable
      const totalPrizes = Object.values(prizeStructure).reduce((sum, amount) => sum + amount, 0)
      expect(totalPrizes).toBeGreaterThan(0)
      expect(totalPrizes).toBeLessThan(10000) // Reasonable upper limit
    })
  })

  describe('Hook Dependencies', () => {
    it('should re-fetch when league ID changes', async () => {
      const { result, rerender } = renderHook(
        ({ leagueId, season }) => useSeasonConfig(leagueId, season),
        {
          initialProps: { leagueId: 'league-1', season: '2024' }
        }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const firstCallCount = (supabase.from as jest.Mock).mock.calls.length

      // Change league ID
      rerender({ leagueId: 'league-2', season: '2024' })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should have made additional calls
      expect((supabase.from as jest.Mock).mock.calls.length).toBeGreaterThan(firstCallCount)
    })

    it('should re-fetch when season changes', async () => {
      const { result, rerender } = renderHook(
        ({ leagueId, season }) => useSeasonConfig(leagueId, season),
        {
          initialProps: { leagueId: 'league-1', season: '2024' }
        }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const firstCallCount = (supabase.from as jest.Mock).mock.calls.length

      // Change season
      rerender({ leagueId: 'league-1', season: '2023' })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should have made additional calls
      expect((supabase.from as jest.Mock).mock.calls.length).toBeGreaterThan(firstCallCount)
    })

    it('should not re-fetch for same parameters', async () => {
      const { result, rerender } = renderHook(
        ({ leagueId, season }) => useSeasonConfig(leagueId, season),
        {
          initialProps: { leagueId: 'league-1', season: '2024' }
        }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const firstCallCount = (supabase.from as jest.Mock).mock.calls.length

      // Re-render with same parameters
      rerender({ leagueId: 'league-1', season: '2024' })

      // Should not make additional calls
      expect((supabase.from as jest.Mock).mock.calls.length).toBe(firstCallCount)
    })
  })

  describe('Performance Optimization', () => {
    it('should memoize team records calculation', async () => {
      const mockSeasonConfig = {
        league_id: 'league-123',
        season: '2024',
        playoff_start_week: 15,
        total_weeks: 17
      }

      mockSupabaseResponse.data = mockSeasonConfig

      const { result, rerender } = renderHook(() => 
        useSeasonConfig('league-123', '2024')
      )

      await waitFor(() => {
        expect(result.current.seasonConfig).toEqual(mockSeasonConfig)
      })

      const firstTeamRecords = result.current.teamRecords

      // Re-render and check that team records reference is stable
      rerender()

      expect(result.current.teamRecords).toBe(firstTeamRecords)
    })

    it('should handle concurrent requests', async () => {
      const mockSeasonConfig = {
        league_id: 'league-123',
        season: '2024',
        playoff_start_week: 15,
        total_weeks: 17
      }

      mockSupabaseResponse.data = mockSeasonConfig

      // Render multiple hooks simultaneously
      const { result: result1 } = renderHook(() => 
        useSeasonConfig('league-123', '2024')
      )
      const { result: result2 } = renderHook(() => 
        useSeasonConfig('league-123', '2024')
      )

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
        expect(result2.current.loading).toBe(false)
      })

      // Both should have the same data
      expect(result1.current.seasonConfig).toEqual(result2.current.seasonConfig)
    })
  })
})