import { calculateSpecialPrizes, getSpecialPrizeAmount, hasSpecialPrize, getSpecialPrizeDisplayName } from '../prizeUtils'

// Mock Supabase
const mockSupabaseResponse = { data: [], error: null }

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve(mockSupabaseResponse))
        }))
      }))
    }))
  }
}))

describe('prizeUtils', () => {
  const mockMembers = [
    { id: 'member1', manager_name: 'Player 1', team_name: 'Team 1', league_id: 'test', season: '2022' },
    { id: 'member2', manager_name: 'Player 2', team_name: 'Team 2', league_id: 'test', season: '2022' },
    { id: 'member3', manager_name: 'Player 3', team_name: 'Team 3', league_id: 'test', season: '2022' },
    { id: 'member4', manager_name: 'Player 4', team_name: 'Team 4', league_id: 'test', season: '2022' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateSpecialPrizes', () => {
    it('should calculate fourth place correctly', async () => {
      const mockWeeklyScores = [
        { member_id: 'member1', points: 150, week_number: 1 },
        { member_id: 'member2', points: 140, week_number: 1 },
        { member_id: 'member3', points: 130, week_number: 1 },
        { member_id: 'member4', points: 120, week_number: 1 },
        { member_id: 'member1', points: 160, week_number: 2 },
        { member_id: 'member2', points: 150, week_number: 2 },
        { member_id: 'member3', points: 140, week_number: 2 },
        { member_id: 'member4', points: 130, week_number: 2 },
      ]

      mockSupabaseResponse.data = mockWeeklyScores
      mockSupabaseResponse.error = null

      const result = await calculateSpecialPrizes('test-league', '2022', mockMembers)

      expect(result.fourthPlace).toBeDefined()
      expect(result.fourthPlace?.member.id).toBe('member4')
      expect(result.fourthPlace?.value).toBe(250) // 120 + 130
    })

    it('should find highest weekly score correctly', async () => {
      const mockWeeklyScores = [
        { member_id: 'member1', points: 150, week_number: 1 },
        { member_id: 'member2', points: 180, week_number: 1 }, // Highest
        { member_id: 'member3', points: 130, week_number: 1 },
        { member_id: 'member4', points: 120, week_number: 1 },
      ]

      mockSupabaseResponse.data = mockWeeklyScores
      mockSupabaseResponse.error = null

      const result = await calculateSpecialPrizes('test-league', '2022', mockMembers)

      expect(result.highestWeekly).toBeDefined()
      expect(result.highestWeekly?.member.id).toBe('member2')
      expect(result.highestWeekly?.value).toBe(180)
      expect(result.highestWeekly?.week).toBe(1)
    })

    it('should find lowest weekly score correctly', async () => {
      const mockWeeklyScores = [
        { member_id: 'member1', points: 150, week_number: 1 },
        { member_id: 'member2', points: 140, week_number: 1 },
        { member_id: 'member3', points: 130, week_number: 1 },
        { member_id: 'member4', points: 80, week_number: 1 }, // Lowest
      ]

      mockSupabaseResponse.data = mockWeeklyScores
      mockSupabaseResponse.error = null

      const result = await calculateSpecialPrizes('test-league', '2022', mockMembers)

      expect(result.lowestWeekly).toBeDefined()
      expect(result.lowestWeekly?.member.id).toBe('member4')
      expect(result.lowestWeekly?.value).toBe(80)
      expect(result.lowestWeekly?.week).toBe(1)
    })

    it('should handle empty data gracefully', async () => {
      mockSupabaseResponse.data = []
      mockSupabaseResponse.error = null

      const result = await calculateSpecialPrizes('test-league', '2022', mockMembers)

      expect(result.fourthPlace).toBeUndefined()
      expect(result.highestWeekly).toBeUndefined()
      expect(result.lowestWeekly).toBeUndefined()
    })

    it('should handle database errors gracefully', async () => {
      mockSupabaseResponse.data = null
      mockSupabaseResponse.error = { message: 'Database error', code: 'TEST_ERROR' }

      const result = await calculateSpecialPrizes('test-league', '2022', mockMembers)

      expect(result).toEqual({})
    })

    it('should handle insufficient teams for fourth place', async () => {
      const mockWeeklyScores = [
        { member_id: 'member1', points: 150, week_number: 1 },
        { member_id: 'member2', points: 140, week_number: 1 },
        { member_id: 'member3', points: 130, week_number: 1 },
        // Only 3 members - no fourth place
      ]

      mockSupabaseResponse.data = mockWeeklyScores
      mockSupabaseResponse.error = null

      const result = await calculateSpecialPrizes('test-league', '2022', mockMembers.slice(0, 3))

      expect(result.fourthPlace).toBeUndefined()
      expect(result.highestWeekly).toBeDefined() // Should still work
      expect(result.lowestWeekly).toBeDefined() // Should still work
    })
  })

  describe('getSpecialPrizeAmount', () => {
    it('should return correct prize amount for existing prize', () => {
      const prizeStructure = {
        fourth: 50,
        highest_weekly: 25,
        lowest_weekly: 10
      }

      expect(getSpecialPrizeAmount(prizeStructure, 'fourth')).toBe(50)
      expect(getSpecialPrizeAmount(prizeStructure, 'highest_weekly')).toBe(25)
      expect(getSpecialPrizeAmount(prizeStructure, 'lowest_weekly')).toBe(10)
    })

    it('should return 0 for non-existent prize', () => {
      const prizeStructure = {
        first: 100,
        second: 75
      }

      expect(getSpecialPrizeAmount(prizeStructure, 'fourth')).toBe(0)
      expect(getSpecialPrizeAmount(prizeStructure, 'highest_weekly')).toBe(0)
      expect(getSpecialPrizeAmount(prizeStructure, 'lowest_weekly')).toBe(0)
    })

    it('should handle empty prize structure', () => {
      expect(getSpecialPrizeAmount({}, 'fourth')).toBe(0)
      expect(getSpecialPrizeAmount(null as never, 'fourth')).toBe(0)
      expect(getSpecialPrizeAmount(undefined as never, 'fourth')).toBe(0)
    })
  })

  describe('hasSpecialPrize', () => {
    const mockSpecialPrizes = {
      fourthPlace: { member: { id: 'member4' }, value: 1200 },
      highestWeekly: { member: { id: 'member2' }, value: 180, week: 1 },
      lowestWeekly: { member: { id: 'member1' }, value: 80, week: 3 }
    }

    it('should return true when member has the prize', () => {
      expect(hasSpecialPrize('member4', mockSpecialPrizes, 'fourthPlace')).toBe(true)
      expect(hasSpecialPrize('member2', mockSpecialPrizes, 'highestWeekly')).toBe(true)
      expect(hasSpecialPrize('member1', mockSpecialPrizes, 'lowestWeekly')).toBe(true)
    })

    it('should return false when member does not have the prize', () => {
      expect(hasSpecialPrize('member3', mockSpecialPrizes, 'fourthPlace')).toBe(false)
      expect(hasSpecialPrize('member1', mockSpecialPrizes, 'highestWeekly')).toBe(false)
      expect(hasSpecialPrize('member2', mockSpecialPrizes, 'lowestWeekly')).toBe(false)
    })

    it('should return false for missing prizes', () => {
      const emptyPrizes = {}
      expect(hasSpecialPrize('member1', emptyPrizes, 'fourthPlace')).toBe(false)
    })
  })

  describe('getSpecialPrizeDisplayName', () => {
    it('should return correct display names', () => {
      expect(getSpecialPrizeDisplayName('fourthPlace')).toBe('4th Place')
      expect(getSpecialPrizeDisplayName('highestWeekly')).toBe('Highest Weekly')
      expect(getSpecialPrizeDisplayName('lowestWeekly')).toBe('Lowest Weekly')
    })

    it('should return default for unknown prize type', () => {
      expect(getSpecialPrizeDisplayName('unknown' as never)).toBe('Special Prize')
    })
  })
})