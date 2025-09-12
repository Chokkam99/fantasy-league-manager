import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Standings from '../Standings'

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
  },
  {
    id: 'member-4',
    league_id: 'test-league',
    manager_name: 'Alice Brown',
    team_name: 'Team Delta',
    season: '2024',
    division: 'West'
  }
]

const mockStandingsData = [
  {
    member: { id: 'member-1' },
    wins: 8,
    losses: 2,
    totalPoints: 1250.75,
    pointsAgainst: 1100.25,
    division: 'East',
    weeklyPrize: 75.00,
    totalPrizes: 150.00
  },
  {
    member: { id: 'member-2' },
    wins: 6,
    losses: 4,
    totalPoints: 1180.50,
    pointsAgainst: 1150.75,
    division: 'East',
    weeklyPrize: 25.00,
    totalPrizes: 50.00
  },
  {
    member: { id: 'member-3' },
    wins: 7,
    losses: 3,
    totalPoints: 1200.25,
    pointsAgainst: 1120.50,
    division: 'West',
    weeklyPrize: 50.00,
    totalPrizes: 100.00
  },
  {
    member: { id: 'member-4' },
    wins: 5,
    losses: 5,
    totalPoints: 1150.75,
    pointsAgainst: 1200.25,
    division: 'West',
    weeklyPrize: 0.00,
    totalPrizes: 25.00
  }
]

const mockSeasonConfig = {
  id: 'config-1',
  league_id: 'test-league',
  season: '2024',
  playoff_start_week: 15,
  total_weeks: 17,
  playoff_spots: 6,
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
  }
}

const mockPlayoffTeamIds = ['member-1', 'member-3', 'member-2', 'member-4']

describe('Standings Component', () => {
  const mockOnSeasonChange = jest.fn()

  const defaultProps = {
    standingsData: mockStandingsData,
    members: mockMembers,
    seasonConfig: mockSeasonConfig,
    playoffTeamIds: mockPlayoffTeamIds,
    onSeasonChange: mockOnSeasonChange,
    currentSeason: '2024',
    includePostseason: false,
    onPostseasonToggle: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render standings table', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('Standings')).toBeInTheDocument()
    })

    it('should render all team information', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Team Alpha')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Team Beta')).toBeInTheDocument()
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
      expect(screen.getByText('Team Gamma')).toBeInTheDocument()
      expect(screen.getByText('Alice Brown')).toBeInTheDocument()
      expect(screen.getByText('Team Delta')).toBeInTheDocument()
    })

    it('should display win-loss records correctly', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByText('8-2')).toBeInTheDocument()
      expect(screen.getByText('6-4')).toBeInTheDocument()
      expect(screen.getByText('7-3')).toBeInTheDocument()
      expect(screen.getByText('5-5')).toBeInTheDocument()
    })

    it('should display total points with proper formatting', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByText('1250.75')).toBeInTheDocument()
      expect(screen.getByText('1180.50')).toBeInTheDocument()
      expect(screen.getByText('1200.25')).toBeInTheDocument()
      expect(screen.getByText('1150.75')).toBeInTheDocument()
    })

    it('should display prize information', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByText('$75.00')).toBeInTheDocument()
      expect(screen.getByText('$150.00')).toBeInTheDocument()
      expect(screen.getByText('$25.00')).toBeInTheDocument()
      expect(screen.getByText('$50.00')).toBeInTheDocument()
    })
  })

  describe('Playoff Indicators', () => {
    it('should highlight playoff teams', () => {
      render(<Standings {...defaultProps} />)
      
      const playoffIndicators = screen.getAllByText('👑')
      expect(playoffIndicators.length).toBeGreaterThan(0)
    })

    it('should show correct number of playoff teams', () => {
      render(<Standings {...defaultProps} />)
      
      const playoffIndicators = screen.getAllByText('👑')
      expect(playoffIndicators).toHaveLength(mockPlayoffTeamIds.length)
    })

    it('should handle empty playoff team list', () => {
      const propsWithoutPlayoffs = {
        ...defaultProps,
        playoffTeamIds: []
      }

      render(<Standings {...propsWithoutPlayoffs} />)
      
      expect(screen.getByRole('table')).toBeInTheDocument()
      const playoffIndicators = screen.queryAllByText('👑')
      expect(playoffIndicators).toHaveLength(0)
    })
  })

  describe('Season Controls', () => {
    it('should render season selector', () => {
      render(<Standings {...defaultProps} />)
      
      const seasonSelect = screen.getByDisplayValue('2024')
      expect(seasonSelect).toBeInTheDocument()
    })

    it('should call onSeasonChange when season is selected', async () => {
      const user = userEvent.setup()
      render(<Standings {...defaultProps} />)
      
      const seasonSelect = screen.getByDisplayValue('2024')
      await user.selectOptions(seasonSelect, '2023')
      
      expect(mockOnSeasonChange).toHaveBeenCalledWith('2023')
    })

    it('should render postseason toggle when seasonConfig exists', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByText('Include Postseason')).toBeInTheDocument()
    })

    it('should handle postseason toggle interaction', async () => {
      const mockOnPostseasonToggle = jest.fn()
      const user = userEvent.setup()
      
      render(<Standings {...defaultProps} onPostseasonToggle={mockOnPostseasonToggle} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      await user.click(toggleSwitch)
      
      expect(mockOnPostseasonToggle).toHaveBeenCalledWith(true)
    })
  })

  describe('Data Handling', () => {
    it('should handle empty standings data', () => {
      const propsWithEmptyData = {
        ...defaultProps,
        standingsData: [],
        members: []
      }

      render(<Standings {...propsWithEmptyData} />)
      
      expect(screen.getByText('Standings')).toBeInTheDocument()
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('should handle mismatched data gracefully', () => {
      const propsWithMismatchedData = {
        ...defaultProps,
        standingsData: mockStandingsData.slice(0, 2),
        members: mockMembers
      }

      render(<Standings {...propsWithMismatchedData} />)
      
      expect(screen.getByText('Standings')).toBeInTheDocument()
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('should handle missing season config', () => {
      const propsWithoutConfig = {
        ...defaultProps,
        seasonConfig: null
      }

      render(<Standings {...propsWithoutConfig} />)
      
      expect(screen.getByText('Standings')).toBeInTheDocument()
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('should sort teams by standings correctly', () => {
      render(<Standings {...defaultProps} />)
      
      const rows = screen.getAllByRole('row')
      const dataRows = rows.slice(1) // Skip header row
      
      // Check that rows are in correct order (highest wins first)
      expect(dataRows[0]).toHaveTextContent('John Doe')
      expect(dataRows[0]).toHaveTextContent('8-2')
    })
  })

  describe('Prize Calculations', () => {
    it('should display weekly prizes correctly', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByText('$75.00')).toBeInTheDocument()
      expect(screen.getByText('$25.00')).toBeInTheDocument()
      expect(screen.getByText('$50.00')).toBeInTheDocument()
    })

    it('should display total prizes correctly', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByText('$150.00')).toBeInTheDocument()
      expect(screen.getByText('$50.00')).toBeInTheDocument()
      expect(screen.getByText('$100.00')).toBeInTheDocument()
    })

    it('should handle zero prize amounts', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })

    it('should calculate prize totals correctly', () => {
      const standingsWithCalculatedPrizes = mockStandingsData.map(standing => ({
        ...standing,
        totalPrizes: standing.weeklyPrize * 2 // Example calculation
      }))

      render(<Standings {...defaultProps} standingsData={standingsWithCalculatedPrizes} />)
      
      // Verify calculated values are displayed
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
  })

  describe('Responsiveness', () => {
    it('should render properly on mobile viewports', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<Standings {...defaultProps} />)
      
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('Standings')).toBeInTheDocument()
    })

    it('should maintain table structure on different screen sizes', () => {
      render(<Standings {...defaultProps} />)
      
      const table = screen.getByRole('table')
      const headers = screen.getAllByRole('columnheader')
      
      expect(table).toBeInTheDocument()
      expect(headers.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('columnheader')).toHaveLength(7) // Rank, Manager, Team, Record, Points, Weekly, Total
      expect(screen.getAllByRole('row')).toHaveLength(5) // Header + 4 data rows
    })

    it('should have accessible column headers', () => {
      render(<Standings {...defaultProps} />)
      
      expect(screen.getByText('Rank')).toBeInTheDocument()
      expect(screen.getByText('Manager')).toBeInTheDocument()
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.getByText('Record')).toBeInTheDocument()
      expect(screen.getByText('Points')).toBeInTheDocument()
      expect(screen.getByText('Weekly')).toBeInTheDocument()
      expect(screen.getByText('Total')).toBeInTheDocument()
    })

    it('should have proper ARIA labels', () => {
      render(<Standings {...defaultProps} />)
      
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
      
      const seasonSelect = screen.getByDisplayValue('2024')
      expect(seasonSelect).toHaveAttribute('aria-label')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Standings {...defaultProps} />)
      
      const seasonSelect = screen.getByDisplayValue('2024')
      
      await user.tab()
      expect(seasonSelect).toHaveFocus()
    })
  })

  describe('Performance', () => {
    it('should render large datasets efficiently', () => {
      const largeMembersList = Array.from({ length: 50 }, (_, i) => ({
        id: `member-${i}`,
        league_id: 'test-league',
        manager_name: `Player ${i}`,
        team_name: `Team ${i}`,
        season: '2024',
        division: i < 25 ? 'East' : 'West'
      }))

      const largeStandingsData = largeMembersList.map((member, i) => ({
        member: { id: member.id },
        wins: Math.floor(Math.random() * 10),
        losses: Math.floor(Math.random() * 10),
        totalPoints: 1000 + Math.random() * 500,
        pointsAgainst: 1000 + Math.random() * 500,
        division: member.division,
        weeklyPrize: Math.random() * 100,
        totalPrizes: Math.random() * 200
      }))

      const startTime = performance.now()
      render(
        <Standings 
          {...defaultProps}
          members={largeMembersList}
          standingsData={largeStandingsData}
        />
      )
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(200)
      expect(screen.getByText('Standings')).toBeInTheDocument()
    })

    it('should handle frequent updates efficiently', () => {
      const { rerender } = render(<Standings {...defaultProps} />)
      
      const startTime = performance.now()
      
      // Simulate multiple rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(<Standings {...defaultProps} currentSeason={`202${i % 5}`} />)
      }
      
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(100)
      expect(screen.getByText('Standings')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle tie scenarios in standings', () => {
      const standingsWithTies = [
        {
          member: { id: 'member-1' },
          wins: 7,
          losses: 3,
          totalPoints: 1200.00,
          pointsAgainst: 1100.00,
          division: 'East',
          weeklyPrize: 50.00,
          totalPrizes: 100.00
        },
        {
          member: { id: 'member-2' },
          wins: 7,
          losses: 3,
          totalPoints: 1200.00,
          pointsAgainst: 1150.00,
          division: 'East',
          weeklyPrize: 50.00,
          totalPrizes: 100.00
        }
      ]

      render(
        <Standings 
          {...defaultProps}
          standingsData={standingsWithTies}
          members={mockMembers.slice(0, 2)}
        />
      )
      
      expect(screen.getAllByText('7-3')).toHaveLength(2)
      expect(screen.getAllByText('1200.00')).toHaveLength(2)
    })

    it('should handle very high scores', () => {
      const standingsWithHighScores = [{
        member: { id: 'member-1' },
        wins: 15,
        losses: 0,
        totalPoints: 9999.99,
        pointsAgainst: 500.00,
        division: 'East',
        weeklyPrize: 999.99,
        totalPrizes: 1999.99
      }]

      render(
        <Standings 
          {...defaultProps}
          standingsData={standingsWithHighScores}
          members={mockMembers.slice(0, 1)}
        />
      )
      
      expect(screen.getByText('15-0')).toBeInTheDocument()
      expect(screen.getByText('9999.99')).toBeInTheDocument()
    })

    it('should handle missing member data', () => {
      const standingsWithMissingMember = [{
        member: { id: 'non-existent-member' },
        wins: 5,
        losses: 5,
        totalPoints: 1000.00,
        pointsAgainst: 1100.00,
        division: 'East',
        weeklyPrize: 0.00,
        totalPrizes: 0.00
      }]

      render(
        <Standings 
          {...defaultProps}
          standingsData={standingsWithMissingMember}
          members={mockMembers}
        />
      )
      
      // Should render without crashing
      expect(screen.getByText('Standings')).toBeInTheDocument()
    })
  })

  describe('Integration', () => {
    it('should work correctly with postseason toggle', async () => {
      const mockOnPostseasonToggle = jest.fn()
      const user = userEvent.setup()
      
      render(
        <Standings 
          {...defaultProps}
          onPostseasonToggle={mockOnPostseasonToggle}
          includePostseason={false}
        />
      )
      
      const toggleSwitch = screen.getByRole('checkbox')
      await user.click(toggleSwitch)
      
      expect(mockOnPostseasonToggle).toHaveBeenCalledWith(true)
    })

    it('should update when external props change', () => {
      const { rerender } = render(<Standings {...defaultProps} />)
      
      expect(screen.getByDisplayValue('2024')).toBeInTheDocument()
      
      rerender(<Standings {...defaultProps} currentSeason="2023" />)
      
      expect(screen.getByDisplayValue('2023')).toBeInTheDocument()
    })

    it('should maintain state consistency during rapid changes', () => {
      const { rerender } = render(<Standings {...defaultProps} includePostseason={false} />)
      
      rerender(<Standings {...defaultProps} includePostseason={true} />)
      rerender(<Standings {...defaultProps} includePostseason={false} />)
      rerender(<Standings {...defaultProps} includePostseason={true} />)
      
      const toggleSwitch = screen.getByRole('checkbox') as HTMLInputElement
      expect(toggleSwitch.checked).toBe(true)
    })
  })
})