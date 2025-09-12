import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlayerParticipationHistory from '../PlayerParticipationHistory'

// Mock Supabase
const mockSupabaseResponse = { data: [], error: null }
const mockSupabase = {
  rpc: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve(mockSupabaseResponse))
    }))
  }))
}

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}))

// Mock data
const mockMembers = [
  {
    id: 'member-1',
    league_id: 'test-league',
    manager_name: 'John Doe',
    team_name: 'Team Alpha',
    season: '2024',
    division: 'East'
  },
  {
    id: 'member-2',
    league_id: 'test-league',
    manager_name: 'Jane Smith',
    team_name: 'Team Beta',
    season: '2024',
    division: 'East'
  },
  {
    id: 'member-3',
    league_id: 'test-league',
    manager_name: 'Bob Wilson',
    team_name: 'Team Gamma',
    season: '2024',
    division: 'West'
  }
]

const mockSeasons = ['2021', '2022', '2023', '2024']

const mockStandingsData = [
  {
    member_id: 'member-1',
    wins: 8,
    points_for: 1250.75,
    division: 'East'
  },
  {
    member_id: 'member-2',
    wins: 6,
    points_for: 1180.50,
    division: 'East'
  },
  {
    member_id: 'member-3',
    wins: 7,
    points_for: 1200.25,
    division: 'West'
  }
]

const mockPlayoffTeamIds = ['member-1', 'member-3']

describe('PlayerParticipationHistory Component', () => {
  const defaultProps = {
    leagueId: 'test-league',
    members: mockMembers,
    seasons: mockSeasons,
    selectedSeason: '2024'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseResponse.data = []
    mockSupabaseResponse.error = null
    
    // Setup default mocks
    mockSupabase.rpc.mockResolvedValue({
      data: mockStandingsData,
      error: null
    })
    
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: mockMembers,
          error: null
        }))
      }))
    })
  })

  describe('Rendering', () => {
    it('should render player participation history component', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      expect(screen.getByText('👥 Player Participation History')).toBeInTheDocument()
    })

    it('should render season tabs', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('2021')).toBeInTheDocument()
        expect(screen.getByText('2022')).toBeInTheDocument()
        expect(screen.getByText('2023')).toBeInTheDocument()
        expect(screen.getByText('2024')).toBeInTheDocument()
      })
    })

    it('should highlight selected season', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        const selectedTab = screen.getByText('2024')
        expect(selectedTab.closest('button')).toHaveClass('bg-orange-100')
      })
    })

    it('should render table headers', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Manager')).toBeInTheDocument()
        expect(screen.getByText('Team')).toBeInTheDocument()
        expect(screen.getByText('Record')).toBeInTheDocument()
        expect(screen.getByText('Points')).toBeInTheDocument()
        expect(screen.getByText('Playoffs')).toBeInTheDocument()
      })
    })

    it('should display player data', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Team Alpha')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.getByText('Team Beta')).toBeInTheDocument()
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
        expect(screen.getByText('Team Gamma')).toBeInTheDocument()
      })
    })
  })

  describe('Season Navigation', () => {
    it('should switch seasons when tab is clicked', async () => {
      const user = userEvent.setup()
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('2023')).toBeInTheDocument()
      })
      
      const seasonTab = screen.getByText('2023')
      await user.click(seasonTab)
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_season_standings', {
        league_id_param: 'test-league',
        season_param: '2023',
        week_limit_param: null
      })
    })

    it('should load members for selected season', async () => {
      const user = userEvent.setup()
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('2022')).toBeInTheDocument()
      })
      
      const seasonTab = screen.getByText('2022')
      await user.click(seasonTab)
      
      expect(mockSupabase.from).toHaveBeenCalledWith('league_members')
    })

    it('should handle season with no data', async () => {
      const user = userEvent.setup()
      
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        }))
      })
      
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('2021')).toBeInTheDocument()
      })
      
      const seasonTab = screen.getByText('2021')
      await user.click(seasonTab)
      
      await waitFor(() => {
        expect(screen.getByText('No players found for this season')).toBeInTheDocument()
      })
    })

    it('should maintain loading state during season change', async () => {
      const user = userEvent.setup()
      
      // Mock delayed response
      mockSupabase.rpc.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: mockStandingsData, error: null }), 100))
      )
      
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('2023')).toBeInTheDocument()
      })
      
      const seasonTab = screen.getByText('2023')
      await user.click(seasonTab)
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('Playoff Indicators', () => {
    it('should display playoff crown for qualifying teams', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        const playoffCrowns = screen.getAllByText('👑')
        expect(playoffCrowns.length).toBeGreaterThan(0)
      })
    })

    it('should not display playoff crown for non-qualifying teams', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        const janeRow = rows.find(row => row.textContent?.includes('Jane Smith'))
        expect(janeRow).not.toHaveTextContent('👑')
      })
    })

    it('should handle seasons with no playoff data', async () => {
      const user = userEvent.setup()
      
      mockSupabase.rpc.mockResolvedValue({
        data: mockStandingsData.map(s => ({ ...s, playoffs: false })),
        error: null
      })
      
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('2022')).toBeInTheDocument()
      })
      
      const seasonTab = screen.getByText('2022')
      await user.click(seasonTab)
      
      await waitFor(() => {
        const playoffCrowns = screen.queryAllByText('👑')
        expect(playoffCrowns).toHaveLength(0)
      })
    })

    it('should calculate playoff spots correctly', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        // Should show exactly the number of playoff spots configured
        const playoffCrowns = screen.getAllByText('👑')
        expect(playoffCrowns).toHaveLength(mockPlayoffTeamIds.length)
      })
    })
  })

  describe('Data Display', () => {
    it('should display win records correctly', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('8')).toBeInTheDocument() // John's wins
        expect(screen.getByText('6')).toBeInTheDocument() // Jane's wins
        expect(screen.getByText('7')).toBeInTheDocument() // Bob's wins
      })
    })

    it('should display points with proper formatting', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('1250.75')).toBeInTheDocument()
        expect(screen.getByText('1180.50')).toBeInTheDocument()
        expect(screen.getByText('1200.25')).toBeInTheDocument()
      })
    })

    it('should handle missing data gracefully', async () => {
      const incompleteData = [
        {
          member_id: 'member-1',
          wins: 8,
          points_for: 1250.75,
          division: 'East'
        },
        {
          member_id: 'member-unknown',
          wins: 5,
          points_for: 1000.00,
          division: 'West'
        }
      ]
      
      mockSupabase.rpc.mockResolvedValue({
        data: incompleteData,
        error: null
      })
      
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        // Should handle unknown member gracefully
        expect(screen.getByText('Unknown Player')).toBeInTheDocument()
      })
    })

    it('should sort players by performance metrics', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        const dataRows = rows.slice(1) // Skip header
        
        // First row should be highest performer (John with 8 wins)
        expect(dataRows[0]).toHaveTextContent('John Doe')
        expect(dataRows[0]).toHaveTextContent('8')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle RPC errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed', code: 'TEST_ERROR' }
      })
      
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching standings:', expect.any(Object))
      })
      
      consoleSpy.mockRestore()
    })

    it('should handle member loading errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Members loading failed' }
          }))
        }))
      })
      
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching members:', expect.any(Object))
      })
      
      consoleSpy.mockRestore()
    })

    it('should display error state when data cannot be loaded', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Network error'))
      
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Error loading player data')).toBeInTheDocument()
      })
    })

    it('should recover from errors when changing seasons', async () => {
      const user = userEvent.setup()
      
      // First call fails
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Initial error' }
      })
      
      // Second call succeeds
      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockStandingsData,
        error: null
      })
      
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('2023')).toBeInTheDocument()
      })
      
      const seasonTab = screen.getByText('2023')
      await user.click(seasonTab)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })
  })

  describe('Performance', () => {
    it('should render efficiently with large datasets', async () => {
      const largeMembersList = Array.from({ length: 50 }, (_, i) => ({
        id: `member-${i}`,
        league_id: 'test-league',
        manager_name: `Player ${i}`,
        team_name: `Team ${i}`,
        season: '2024',
        division: i < 25 ? 'East' : 'West'
      }))
      
      const largeStandingsData = largeMembersList.map((member, i) => ({
        member_id: member.id,
        wins: Math.floor(Math.random() * 15),
        points_for: 1000 + Math.random() * 500,
        division: member.division
      }))
      
      mockSupabase.rpc.mockResolvedValue({
        data: largeStandingsData,
        error: null
      })
      
      const startTime = performance.now()
      render(<PlayerParticipationHistory {...defaultProps} members={largeMembersList} />)
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(200)
      
      await waitFor(() => {
        expect(screen.getByText('👥 Player Participation History')).toBeInTheDocument()
      })
    })

    it('should handle rapid season switching efficiently', async () => {
      const user = userEvent.setup()
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      const startTime = performance.now()
      
      // Rapid season switching
      for (let i = 0; i < 5; i++) {
        const seasonTab = screen.getByText('2023')
        await user.click(seasonTab)
        
        const season2024Tab = screen.getByText('2024')
        await user.click(season2024Tab)
      }
      
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('should memoize expensive calculations', async () => {
      const { rerender } = render(<PlayerParticipationHistory {...defaultProps} />)
      
      const initialCallCount = mockSupabase.rpc.mock.calls.length
      
      // Re-render with same props
      rerender(<PlayerParticipationHistory {...defaultProps} />)
      
      // Should not make additional calls for same season
      expect(mockSupabase.rpc.mock.calls.length).toBe(initialCallCount)
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
        expect(screen.getAllByRole('columnheader')).toHaveLength(5) // Manager, Team, Record, Points, Playoffs
      })
    })

    it('should have accessible season navigation', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        const seasonButtons = screen.getAllByRole('button')
        seasonButtons.forEach(button => {
          expect(button).toHaveAttribute('aria-label')
        })
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('2021')).toBeInTheDocument()
      })
      
      await user.tab()
      expect(screen.getByText('2021')).toHaveFocus()
    })

    it('should have proper ARIA labels for interactive elements', async () => {
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      await waitFor(() => {
        const seasonTab = screen.getByText('2024')
        expect(seasonTab.closest('button')).toHaveAttribute('aria-selected', 'true')
      })
    })

    it('should announce loading states to screen readers', async () => {
      mockSupabase.rpc.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: mockStandingsData, error: null }), 100))
      )
      
      render(<PlayerParticipationHistory {...defaultProps} />)
      
      const loadingText = screen.getByText('Loading...')
      expect(loadingText).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Integration', () => {
    it('should work correctly with different league configurations', async () => {
      const customProps = {
        ...defaultProps,
        leagueId: 'custom-league'
      }
      
      render(<PlayerParticipationHistory {...customProps} />)
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_season_standings', {
        league_id_param: 'custom-league',
        season_param: '2024',
        week_limit_param: null
      })
    })

    it('should handle empty seasons list', async () => {
      render(<PlayerParticipationHistory {...defaultProps} seasons={[]} />)
      
      expect(screen.getByText('👥 Player Participation History')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should sync with external season selection', async () => {
      const { rerender } = render(<PlayerParticipationHistory {...defaultProps} />)
      
      rerender(<PlayerParticipationHistory {...defaultProps} selectedSeason="2023" />)
      
      await waitFor(() => {
        const selectedTab = screen.getByText('2023')
        expect(selectedTab.closest('button')).toHaveClass('bg-orange-100')
      })
    })

    it('should handle missing members gracefully', async () => {
      render(<PlayerParticipationHistory {...defaultProps} members={[]} />)
      
      await waitFor(() => {
        expect(screen.getByText('No players found for this season')).toBeInTheDocument()
      })
    })
  })
})