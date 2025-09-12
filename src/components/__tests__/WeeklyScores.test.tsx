/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeeklyScores from '../WeeklyScores'
import { supabase } from '@/lib/supabase'

// Mock Supabase
jest.mock('@/lib/supabase')
const mockSupabase = supabase as jest.Mocked<typeof supabase>

// Mock useSeasonConfig hook
jest.mock('@/hooks/useSeasonConfig', () => ({
  useSeasonConfig: jest.fn(() => ({
    seasonConfig: {
      playoff_start_week: 15,
      total_weeks: 17,
      weekly_prize_amount: 25,
      prize_structure: {
        first: 300,
        second: 200,
        third: 100
      }
    }
  }))
}))

const mockMembers = [
  {
    id: 'member1',
    manager_name: 'John Doe',
    team_name: 'Team Alpha',
    league_id: 'test-league',
    season: '2022',
    division: 'East'
  },
  {
    id: 'member2', 
    manager_name: 'Jane Smith',
    team_name: 'Team Beta',
    league_id: 'test-league',
    season: '2022',
    division: 'West'
  }
]

const mockWeeklyScores = [
  {
    id: 'score1',
    member_id: 'member1',
    points: 125.50,
    week_number: 1,
    season: '2022',
    league_id: 'test-league'
  },
  {
    id: 'score2',
    member_id: 'member2',
    points: 130.25,
    week_number: 1,
    season: '2022',
    league_id: 'test-league'
  }
]

const mockMatchups = [
  {
    id: 'matchup1',
    league_id: 'test-league',
    season: '2022',
    week_number: 1,
    team1_member_id: 'member1',
    team2_member_id: 'member2',
    team1_score: 125.50,
    team2_score: 130.25,
    winner_member_id: 'member2',
    is_tie: false,
    created_at: '2022-01-01T00:00:00Z',
    updated_at: '2022-01-01T00:00:00Z'
  }
]

describe('WeeklyScores Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default Supabase mocks
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    } as any)
  })

  describe('Rendering', () => {
    it('should render weekly scores component', () => {
      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
        />
      )

      expect(screen.getByText('📊 Weekly Scores')).toBeInTheDocument()
    })

    it('should render member names and team names', async () => {
      mockSupabase.from().select().mockResolvedValue({
        data: mockWeeklyScores,
        error: null
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Team Alpha')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.getByText('Team Beta')).toBeInTheDocument()
      })
    })

    it('should render loading state', () => {
      mockSupabase.from().select().mockReturnValue({
        ...mockSupabase.from().select(),
        // Simulate pending promise
        then: jest.fn()
      } as any)

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
        />
      )

      expect(screen.getByText('Loading week scores...')).toBeInTheDocument()
    })
  })

  describe('Score Input', () => {
    it('should allow score input when not read-only', async () => {
      mockSupabase.from().select().mockResolvedValue({
        data: [],
        error: null
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={false}
        />
      )

      await waitFor(() => {
        const scoreInput = screen.getAllByRole('textbox')[0]
        expect(scoreInput).not.toHaveAttribute('readonly')
      })
    })

    it('should prevent score input when read-only', async () => {
      mockSupabase.from().select().mockResolvedValue({
        data: mockWeeklyScores,
        error: null
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={true}
        />
      )

      await waitFor(() => {
        const scoreInputs = screen.getAllByDisplayValue(/\d+/)
        scoreInputs.forEach(input => {
          expect(input).toHaveAttribute('readonly')
        })
      })
    })

    it('should update score state on input change', async () => {
      const user = userEvent.setup()
      
      mockSupabase.from().select().mockResolvedValue({
        data: [],
        error: null
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={false}
        />
      )

      await waitFor(() => {
        const scoreInput = screen.getAllByRole('textbox')[0]
        expect(scoreInput).toBeInTheDocument()
      })

      const scoreInput = screen.getAllByRole('textbox')[0]
      await user.clear(scoreInput)
      await user.type(scoreInput, '125.50')

      expect(scoreInput).toHaveValue('125.50')
    })

    it('should validate numeric input only', async () => {
      const user = userEvent.setup()
      
      mockSupabase.from().select().mockResolvedValue({
        data: [],
        error: null
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={false}
        />
      )

      await waitFor(() => {
        const scoreInput = screen.getAllByRole('textbox')[0]
        expect(scoreInput).toBeInTheDocument()
      })

      const scoreInput = screen.getAllByRole('textbox')[0]
      await user.clear(scoreInput)
      await user.type(scoreInput, 'abc123')

      // Should only contain the numeric part
      expect(scoreInput).toHaveValue('123')
    })
  })

  describe('Save Functionality', () => {
    it('should save scores successfully', async () => {
      const user = userEvent.setup()
      
      mockSupabase.from().select().mockResolvedValue({
        data: [],
        error: null
      })

      // Mock successful delete and insert
      mockSupabase.from().delete().mockResolvedValue({
        data: null,
        error: null
      })
      
      mockSupabase.from().insert().mockResolvedValue({
        data: mockWeeklyScores,
        error: null
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={false}
        />
      )

      await waitFor(() => {
        const scoreInput = screen.getAllByRole('textbox')[0]
        expect(scoreInput).toBeInTheDocument()
      })

      // Input a score
      const scoreInput = screen.getAllByRole('textbox')[0]
      await user.clear(scoreInput)
      await user.type(scoreInput, '125.50')

      // Click save button
      const saveButton = screen.getByText('💾 Save Week 1')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('weekly_scores')
      })
    })

    it('should handle save errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockSupabase.from().select().mockResolvedValue({
        data: [],
        error: null
      })

      // Mock save error
      mockSupabase.from().insert().mockResolvedValue({
        data: null,
        error: { message: 'Save failed', code: 'TEST_ERROR' }
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={false}
        />
      )

      await waitFor(() => {
        const scoreInput = screen.getAllByRole('textbox')[0]
        expect(scoreInput).toBeInTheDocument()
      })

      // Input a score
      const scoreInput = screen.getAllByRole('textbox')[0]
      await user.clear(scoreInput)
      await user.type(scoreInput, '125.50')

      // Click save button
      const saveButton = screen.getByText('💾 Save Week 1')
      await user.click(saveButton)

      // Should show error message
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Error saving scores. Please try again.')
      })
    })
  })

  describe('Matchups Display', () => {
    it('should render matchups when available', async () => {
      // Mock weekly scores
      mockSupabase.from().select().mockImplementation((table) => {
        const chainable = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
        }

        // Return different data based on which table is being queried
        if (table === 'weekly_scores') {
          chainable.mockResolvedValue = jest.fn().mockResolvedValue({
            data: mockWeeklyScores,
            error: null
          })
        } else if (table === 'matchup_results_with_scores') {
          chainable.mockResolvedValue = jest.fn().mockResolvedValue({
            data: mockMatchups,
            error: null
          })
        }

        return chainable as any
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('🥊 Week 1 Matchups')).toBeInTheDocument()
      })
    })

    it('should display matchup scores correctly', async () => {
      mockSupabase.from.mockImplementation((table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        mockResolvedValue: table === 'matchup_results_with_scores' 
          ? { data: mockMatchups, error: null }
          : { data: mockWeeklyScores, error: null }
      } as any))

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('125.50')).toBeInTheDocument()
        expect(screen.getByText('130.25')).toBeInTheDocument()
      })
    })

    it('should show swap button for admin users when not read-only', async () => {
      mockSupabase.from.mockImplementation((table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        mockResolvedValue: table === 'matchup_results_with_scores' 
          ? { data: mockMatchups, error: null }
          : { data: mockWeeklyScores, error: null }
      } as any))

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={false}
        />
      )

      await waitFor(() => {
        expect(screen.getByTitle('Swap scores between teams')).toBeInTheDocument()
      })
    })

    it('should not show swap button in read-only mode', async () => {
      mockSupabase.from.mockImplementation((table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        mockResolvedValue: table === 'matchup_results_with_scores' 
          ? { data: mockMatchups, error: null }
          : { data: mockWeeklyScores, error: null }
      } as any))

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={true}
        />
      )

      await waitFor(() => {
        expect(screen.queryByTitle('Swap scores between teams')).not.toBeInTheDocument()
      })
    })
  })

  describe('Week Navigation', () => {
    it('should call onWeekChange when week is changed', () => {
      const mockOnWeekChange = jest.fn()

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={mockOnWeekChange}
          season="2022"
        />
      )

      // Find and interact with week selector
      const weekSelector = screen.getByDisplayValue('1')
      fireEvent.change(weekSelector, { target: { value: '2' } })

      expect(mockOnWeekChange).toHaveBeenCalledWith(2)
    })

    it('should handle week validation', () => {
      const mockOnWeekChange = jest.fn()

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={mockOnWeekChange}
          season="2022"
        />
      )

      // Try to set invalid week
      const weekSelector = screen.getByDisplayValue('1')
      fireEvent.change(weekSelector, { target: { value: '25' } })

      // Should not call onWeekChange with invalid week
      expect(mockOnWeekChange).not.toHaveBeenCalledWith(25)
    })
  })

  describe('Clear Week Functionality', () => {
    it('should show clear confirmation dialog', async () => {
      const user = userEvent.setup()

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={false}
        />
      )

      const clearButton = screen.getByText('🗑️ Clear Week')
      await user.click(clearButton)

      expect(screen.getByText('Are you sure you want to clear all scores for Week 1?')).toBeInTheDocument()
    })

    it('should clear week when confirmed', async () => {
      const user = userEvent.setup()

      mockSupabase.from().delete().mockResolvedValue({
        data: null,
        error: null
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={false}
        />
      )

      const clearButton = screen.getByText('🗑️ Clear Week')
      await user.click(clearButton)

      const confirmButton = screen.getByText('Yes, Clear Week')
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('weekly_scores')
      })
    })

    it('should not clear week when cancelled', async () => {
      const user = userEvent.setup()

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
          readOnly={false}
        />
      )

      const clearButton = screen.getByText('🗑️ Clear Week')
      await user.click(clearButton)

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      expect(screen.queryByText('Are you sure you want to clear all scores for Week 1?')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle weekly scores loading errors', async () => {
      mockSupabase.from().select().mockResolvedValue({
        data: null,
        error: { message: 'Loading error', code: 'TEST_ERROR' }
      })

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
        />
      )

      // Should not crash and should show some fallback content
      expect(screen.getByText('📊 Weekly Scores')).toBeInTheDocument()
    })

    it('should handle matchups loading errors', async () => {
      // Mock weekly scores success but matchups failure
      mockSupabase.from.mockImplementation((table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        mockResolvedValue: table === 'matchup_results_with_scores' 
          ? { data: null, error: { message: 'Matchups error' } }
          : { data: mockWeeklyScores, error: null }
      } as any))

      render(
        <WeeklyScores 
          leagueId="test-league"
          members={mockMembers}
          selectedWeek={1}
          onWeekChange={jest.fn()}
          season="2022"
        />
      )

      // Should still render weekly scores section
      await waitFor(() => {
        expect(screen.getByText('📊 Weekly Scores')).toBeInTheDocument()
      })
    })
  })
})