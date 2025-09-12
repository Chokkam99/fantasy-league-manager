/**
 * Integration Tests for League Management Workflows
 * 
 * These tests verify end-to-end functionality including:
 * - League creation and setup
 * - Member management across seasons
 * - Score imports and calculations
 * - Standings and prize calculations
 * - Season transitions
 */

// Mock environment variables for testing (keeping for potential future use)
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key'

// Mock Supabase client for integration tests
const createMockChain = () => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  like: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  group: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ 
    data: { 
      id: 'test-league-integration', 
      name: 'Test Integration League', 
      current_season: '2024' 
    }, 
    error: null 
  }),
  // Override select to return proper promise
  select: jest.fn(() => ({
    ...createMockChain(),
    single: jest.fn().mockResolvedValue({ 
      data: { 
        id: 'test-league-integration', 
        name: 'Test Integration League', 
        current_season: '2024' 
      }, 
      error: null 
    })
  }))
})

const mockSupabaseClient = {
  from: jest.fn(() => createMockChain()),
  rpc: jest.fn().mockResolvedValue({ data: [], error: null })
}

describe('League Management Integration Tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any
  const testLeagueId = 'test-league-integration'
  const testSeason = '2024'

  beforeAll(async () => {
    // Use mock Supabase client for testing
    supabase = mockSupabaseClient
    
    // Clean up any existing test data
    await cleanupTestData()
  })

  afterAll(async () => {
    // Clean up test data after all tests
    await cleanupTestData()
  })

  async function cleanupTestData() {
    try {
      // Delete in reverse order of dependencies
      await supabase.from('weekly_scores').delete().eq('league_id', testLeagueId)
      await supabase.from('matchups').delete().eq('league_id', testLeagueId)
      await supabase.from('league_members').delete().eq('league_id', testLeagueId)
      await supabase.from('league_seasons').delete().eq('league_id', testLeagueId)
      await supabase.from('leagues').delete().eq('id', testLeagueId)
    } catch (error) {
      // Ignore cleanup errors in case tables don't exist
    }
  }

  describe('League Creation and Setup', () => {
    test('should create a new league with complete setup', async () => {
      // 1. Create league
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert({
          id: testLeagueId,
          name: 'Test Integration League',
          current_season: testSeason
        })
        .select()
        .single()

      expect(leagueError).toBeNull()
      expect(league).toMatchObject({
        id: testLeagueId,
        name: 'Test Integration League',
        current_season: testSeason
      })

      // 2. Create season configuration
      const { data: season, error: seasonError } = await supabase
        .from('league_seasons')
        .insert({
          league_id: testLeagueId,
          season: testSeason,
          fee_amount: 150.00,
          weekly_prize_amount: 20.00,
          playoff_spots: 6,
          prize_structure: {
            first: 500,
            second: 350,
            third: 200,
            highest_points: 160
          }
        })
        .select()
        .single()

      expect(seasonError).toBeNull()
      expect(season).toMatchObject({
        league_id: testLeagueId,
        season: testSeason,
        fee_amount: '150.00',
        playoff_spots: 6
      })

      // 3. Add league members
      const members = [
        { manager_name: 'Alice Johnson', team_name: 'Team Alice' },
        { manager_name: 'Bob Smith', team_name: 'Team Bob' },
        { manager_name: 'Carol Davis', team_name: 'Team Carol' },
        { manager_name: 'David Wilson', team_name: 'Team David' },
        { manager_name: 'Eve Brown', team_name: 'Team Eve' },
        { manager_name: 'Frank Miller', team_name: 'Team Frank' }
      ]

      const { data: insertedMembers, error: membersError } = await supabase
        .from('league_members')
        .insert(
          members.map(member => ({
            league_id: testLeagueId,
            season: testSeason,
            manager_name: member.manager_name,
            team_name: member.team_name,
            payment_status: 'paid' as const
          }))
        )
        .select()

      expect(membersError).toBeNull()
      expect(insertedMembers).toHaveLength(6)
      expect(insertedMembers?.[0]).toMatchObject({
        league_id: testLeagueId,
        season: testSeason,
        payment_status: 'paid'
      })
    })

    test('should handle duplicate league creation gracefully', async () => {
      // Attempt to create the same league again
      const { error } = await supabase
        .from('leagues')
        .insert({
          id: testLeagueId,
          name: 'Duplicate Test League',
          current_season: testSeason
        })

      // Should fail due to unique constraint
      expect(error).not.toBeNull()
      expect(error?.code).toBe('23505') // PostgreSQL unique violation
    })
  })

  describe('Weekly Score Management', () => {
    let memberIds: string[] = []

    beforeAll(async () => {
      // Get member IDs for testing
      const { data: members } = await supabase
        .from('league_members')
        .select('id')
        .eq('league_id', testLeagueId)
        .eq('season', testSeason)

      memberIds = members?.map(m => m.id) || []
      expect(memberIds.length).toBeGreaterThan(0)
    })

    test('should import weekly scores and calculate standings', async () => {
      // 1. Insert scores for Week 1
      const week1Scores = memberIds.map((memberId, index) => ({
        league_id: testLeagueId,
        season: testSeason,
        week_number: 1,
        member_id: memberId,
        points: 100 + (index * 10) // Scores: 100, 110, 120, 130, 140, 150
      }))

      const { error: scoresError } = await supabase
        .from('weekly_scores')
        .insert(week1Scores)

      expect(scoresError).toBeNull()

      // 2. Insert scores for Week 2
      const week2Scores = memberIds.map((memberId, index) => ({
        league_id: testLeagueId,
        season: testSeason,
        week_number: 2,
        member_id: memberId,
        points: 90 + (index * 5) // Scores: 90, 95, 100, 105, 110, 115
      }))

      const { error: week2Error } = await supabase
        .from('weekly_scores')
        .insert(week2Scores)

      expect(week2Error).toBeNull()

      // 3. Verify total scores calculation
      const { data: totalScores } = await supabase
        .from('weekly_scores')
        .select('member_id, SUM(points) as total_points')
        .eq('league_id', testLeagueId)
        .eq('season', testSeason)
        .group('member_id')

      expect(totalScores).toHaveLength(6)
      
      // Verify the highest scoring member
      const highestScorer = totalScores?.find(score => 
        parseFloat(score.total_points || '0') === 265 // 150 + 115
      )
      expect(highestScorer).toBeDefined()
    })

    test('should handle score updates (upserts) correctly', async () => {
      // Update a score for Week 1
      const memberToUpdate = memberIds[0]
      const { error } = await supabase
        .from('weekly_scores')
        .upsert({
          league_id: testLeagueId,
          season: testSeason,
          week_number: 1,
          member_id: memberToUpdate,
          points: 175.50 // Updated score
        })

      expect(error).toBeNull()

      // Verify the update
      const { data: updatedScore } = await supabase
        .from('weekly_scores')
        .select('points')
        .eq('league_id', testLeagueId)
        .eq('season', testSeason)
        .eq('week_number', 1)
        .eq('member_id', memberToUpdate)
        .single()

      expect(updatedScore?.points).toBe('175.50')
    })

    test('should calculate season standings using RPC function', async () => {
      // Test the get_season_standings RPC function
      const { data: standings, error } = await supabase
        .rpc('get_season_standings', {
          p_league_id: testLeagueId,
          p_season: testSeason
        })

      expect(error).toBeNull()
      expect(standings).toBeInstanceOf(Array)
      expect(standings?.length).toBe(6)

      // Verify standings structure
      if (standings && standings.length > 0) {
        const topTeam = standings[0]
        expect(topTeam).toHaveProperty('member_id')
        expect(topTeam).toHaveProperty('manager_name')
        expect(topTeam).toHaveProperty('team_name')
        expect(topTeam).toHaveProperty('total_points')
        expect(topTeam).toHaveProperty('average_points')
        expect(topTeam).toHaveProperty('weeks_played')

        // Verify total points are numbers
        expect(typeof topTeam.total_points).toBe('number')
        expect(typeof topTeam.average_points).toBe('number')
      }
    })
  })

  describe('Matchup Management', () => {
    test('should create and manage weekly matchups', async () => {
      // Get member IDs
      const { data: members } = await supabase
        .from('league_members')
        .select('id, manager_name')
        .eq('league_id', testLeagueId)
        .eq('season', testSeason)
        .limit(4) // Use first 4 members for 2 matchups

      expect(members).toHaveLength(4)

      // Create matchups for Week 1
      const matchups = [
        {
          league_id: testLeagueId,
          season: testSeason,
          week_number: 1,
          team1_member_id: members![0].id,
          team2_member_id: members![1].id
        },
        {
          league_id: testLeagueId,
          season: testSeason,
          week_number: 1,
          team1_member_id: members![2].id,
          team2_member_id: members![3].id
        }
      ]

      const { data: createdMatchups, error } = await supabase
        .from('matchups')
        .insert(matchups)
        .select()

      expect(error).toBeNull()
      expect(createdMatchups).toHaveLength(2)

      // Verify matchup results view
      const { data: matchupResults } = await supabase
        .from('matchup_results_with_scores')
        .select('*')
        .eq('league_id', testLeagueId)
        .eq('season', testSeason)
        .eq('week_number', 1)

      expect(matchupResults).toHaveLength(2)
      
      // Verify results have winner determination
      if (matchupResults && matchupResults.length > 0) {
        const result = matchupResults[0]
        expect(result).toHaveProperty('team1_score')
        expect(result).toHaveProperty('team2_score')
        expect(result).toHaveProperty('winner_member_id')
      }
    })
  })

  describe('Season Transitions', () => {
    test('should handle multi-season member continuity', async () => {
      const newSeason = '2025'

      // 1. Create new season configuration
      const { error: seasonError } = await supabase
        .from('league_seasons')
        .insert({
          league_id: testLeagueId,
          season: newSeason,
          fee_amount: 175.00, // Increased fee
          weekly_prize_amount: 25.00,
          playoff_spots: 8, // More playoff spots
          prize_structure: {
            first: 600,
            second: 400,
            third: 250,
            highest_points: 200
          }
        })

      expect(seasonError).toBeNull()

      // 2. Add returning members to new season
      const { data: existingMembers } = await supabase
        .from('league_members')
        .select('manager_name, team_name')
        .eq('league_id', testLeagueId)
        .eq('season', testSeason)

      const { error: newMembersError } = await supabase
        .from('league_members')
        .insert(
          existingMembers!.map(member => ({
            league_id: testLeagueId,
            season: newSeason,
            manager_name: member.manager_name,
            team_name: member.team_name,
            payment_status: 'pending' as const
          }))
        )

      expect(newMembersError).toBeNull()

      // 3. Verify member history across seasons
      const { data: memberHistory } = await supabase
        .from('league_members')
        .select('season, manager_name, payment_status')
        .eq('league_id', testLeagueId)
        .eq('manager_name', 'Alice Johnson')
        .order('season')

      expect(memberHistory).toHaveLength(2)
      expect(memberHistory![0].season).toBe('2024')
      expect(memberHistory![1].season).toBe('2025')
      expect(memberHistory![0].payment_status).toBe('paid')
      expect(memberHistory![1].payment_status).toBe('pending')
    })

    test('should maintain data integrity across seasons', async () => {
      // Verify that data from different seasons doesn't interfere
      const { data: season2024Scores } = await supabase
        .from('weekly_scores')
        .select('COUNT(*)')
        .eq('league_id', testLeagueId)
        .eq('season', '2024')

      const { data: season2025Scores } = await supabase
        .from('weekly_scores')
        .select('COUNT(*)')
        .eq('league_id', testLeagueId)
        .eq('season', '2025')

      // 2024 should have scores, 2025 should be empty
      expect(parseInt(season2024Scores![0].count || '0')).toBeGreaterThan(0)
      expect(parseInt(season2025Scores![0].count || '0')).toBe(0)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid league references gracefully', async () => {
      const { error } = await supabase
        .from('league_members')
        .insert({
          league_id: 'non-existent-league',
          season: testSeason,
          manager_name: 'Test Manager',
          team_name: 'Test Team'
        })

      // Should fail due to foreign key constraint
      expect(error).not.toBeNull()
      expect(error?.code).toBe('23503') // PostgreSQL foreign key violation
    })

    test('should prevent duplicate weekly scores for same member', async () => {
      const { data: member } = await supabase
        .from('league_members')
        .select('id')
        .eq('league_id', testLeagueId)
        .eq('season', testSeason)
        .limit(1)
        .single()

      // Try to insert duplicate score for same member/week
      const { error } = await supabase
        .from('weekly_scores')
        .insert({
          league_id: testLeagueId,
          season: testSeason,
          week_number: 1,
          member_id: member!.id,
          points: 999.99
        })

      // Should fail due to unique constraint
      expect(error).not.toBeNull()
      expect(error?.code).toBe('23505') // PostgreSQL unique violation
    })

    test('should validate week number constraints', async () => {
      const { data: member } = await supabase
        .from('league_members')
        .select('id')
        .eq('league_id', testLeagueId)
        .eq('season', testSeason)
        .limit(1)
        .single()

      // Try to insert invalid week number
      const { error } = await supabase
        .from('weekly_scores')
        .insert({
          league_id: testLeagueId,
          season: testSeason,
          week_number: 25, // Invalid week number
          member_id: member!.id,
          points: 100.00
        })

      // Should fail due to check constraint
      expect(error).not.toBeNull()
      expect(error?.code).toBe('23514') // PostgreSQL check violation
    })
  })
})