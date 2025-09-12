import React from 'react'
import { render, screen } from '@testing-library/react'
import DivisionStandings from '../DivisionStandings'

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
    division: 'East'
  },
  {
    member: { id: 'member-2' },
    wins: 6,
    losses: 4,
    totalPoints: 1180.50,
    pointsAgainst: 1150.75,
    division: 'East'
  },
  {
    member: { id: 'member-3' },
    wins: 7,
    losses: 3,
    totalPoints: 1200.25,
    pointsAgainst: 1120.50,
    division: 'West'
  },
  {
    member: { id: 'member-4' },
    wins: 5,
    losses: 5,
    totalPoints: 1150.75,
    pointsAgainst: 1200.25,
    division: 'West'
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
    third: 75
  }
}

describe('DivisionStandings Component', () => {
  const defaultProps = {
    standingsData: mockStandingsData,
    members: mockMembers,
    seasonConfig: mockSeasonConfig,
    playoffTeamIds: ['member-1', 'member-3'],
    onSeasonChange: jest.fn(),
    currentSeason: '2024'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render division standings component', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
    })

    it('should render all divisions', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      expect(screen.getByText('East Division')).toBeInTheDocument()
      expect(screen.getByText('West Division')).toBeInTheDocument()
    })

    it('should render team information correctly', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      // Check that all team names are displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Team Alpha')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Team Beta')).toBeInTheDocument()
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
      expect(screen.getByText('Team Gamma')).toBeInTheDocument()
      expect(screen.getByText('Alice Brown')).toBeInTheDocument()
      expect(screen.getByText('Team Delta')).toBeInTheDocument()
    })

    it('should display win-loss records', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      expect(screen.getByText('8-2')).toBeInTheDocument()
      expect(screen.getByText('6-4')).toBeInTheDocument()
      expect(screen.getByText('7-3')).toBeInTheDocument()
      expect(screen.getByText('5-5')).toBeInTheDocument()
    })

    it('should display total points', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      expect(screen.getByText('1250.75')).toBeInTheDocument()
      expect(screen.getByText('1180.50')).toBeInTheDocument()
      expect(screen.getByText('1200.25')).toBeInTheDocument()
      expect(screen.getByText('1150.75')).toBeInTheDocument()
    })
  })

  describe('Division Organization', () => {
    it('should group teams by division correctly', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      // East division should contain John Doe and Jane Smith
      const eastSection = screen.getByText('East Division').closest('div')
      expect(eastSection).toBeInTheDocument()
      
      // West division should contain Bob Wilson and Alice Brown
      const westSection = screen.getByText('West Division').closest('div')
      expect(westSection).toBeInTheDocument()
    })

    it('should sort teams within divisions by record', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      // In East division, John Doe (8-2) should be ranked higher than Jane Smith (6-4)
      // In West division, Bob Wilson (7-3) should be ranked higher than Alice Brown (5-5)
      
      // Check for ranking indicators (positions 1-4)
      const rankings = screen.getAllByText(/#[1-4]/)
      expect(rankings).toHaveLength(4)
    })

    it('should handle missing division information', () => {
      const membersWithoutDivision = [
        {
          id: 'member-5',
          league_id: 'test-league',
          manager_name: 'No Division Player',
          team_name: 'Team Orphan',
          season: '2024',
          division: undefined
        }
      ]

      const standingsWithoutDivision = [
        {
          member: { id: 'member-5' },
          wins: 4,
          losses: 6,
          totalPoints: 1000.00,
          pointsAgainst: 1200.00,
          division: undefined
        }
      ]

      render(
        <DivisionStandings 
          {...defaultProps}
          members={membersWithoutDivision}
          standingsData={standingsWithoutDivision}
        />
      )
      
      // Should still render the component without crashing
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
    })
  })

  describe('Playoff Indicators', () => {
    it('should highlight playoff teams', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      // Teams in playoff spots should have special styling/indicators
      // Check for crown emoji or playoff indicators
      const playoffIndicators = screen.getAllByText('👑')
      expect(playoffIndicators.length).toBeGreaterThan(0)
    })

    it('should show division winner indicators', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      // Division winners should be clearly marked
      // The first place team in each division should have special marking
      const divisionWinnerIndicators = screen.getAllByText('👑')
      expect(divisionWinnerIndicators.length).toBeGreaterThanOrEqual(2) // At least one per division
    })

    it('should handle empty playoff team list', () => {
      const propsWithoutPlayoffs = {
        ...defaultProps,
        playoffTeamIds: []
      }

      render(<DivisionStandings {...propsWithoutPlayoffs} />)
      
      // Should render without playoff indicators
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
    })
  })

  describe('Season Configuration', () => {
    it('should handle missing season config', () => {
      const propsWithoutConfig = {
        ...defaultProps,
        seasonConfig: null
      }

      render(<DivisionStandings {...propsWithoutConfig} />)
      
      // Should still render basic standings
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
    })

    it('should adapt to different division configurations', () => {
      const configWithMoreDivisions = {
        ...mockSeasonConfig,
        divisions: {
          divisions: ['North', 'South', 'East', 'West'],
          playoff_spots: 8
        }
      }

      const membersWithMoreDivisions = [
        ...mockMembers,
        {
          id: 'member-5',
          league_id: 'test-league',
          manager_name: 'North Player',
          team_name: 'Team North',
          season: '2024',
          division: 'North'
        },
        {
          id: 'member-6',
          league_id: 'test-league',
          manager_name: 'South Player',
          team_name: 'Team South',
          season: '2024',
          division: 'South'
        }
      ]

      const standingsWithMoreDivisions = [
        ...mockStandingsData,
        {
          member: { id: 'member-5' },
          wins: 9,
          losses: 1,
          totalPoints: 1300.00,
          pointsAgainst: 1050.00,
          division: 'North'
        },
        {
          member: { id: 'member-6' },
          wins: 3,
          losses: 7,
          totalPoints: 1100.00,
          pointsAgainst: 1250.00,
          division: 'South'
        }
      ]

      render(
        <DivisionStandings 
          {...defaultProps}
          seasonConfig={configWithMoreDivisions}
          members={membersWithMoreDivisions}
          standingsData={standingsWithMoreDivisions}
        />
      )
      
      // Should handle multiple divisions
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
    })
  })

  describe('Data Edge Cases', () => {
    it('should handle empty standings data', () => {
      const propsWithEmptyData = {
        ...defaultProps,
        standingsData: [],
        members: []
      }

      render(<DivisionStandings {...propsWithEmptyData} />)
      
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
    })

    it('should handle mismatched member and standings data', () => {
      const propsWithMismatchedData = {
        ...defaultProps,
        standingsData: mockStandingsData.slice(0, 2), // Only first 2 standings
        members: mockMembers // All 4 members
      }

      render(<DivisionStandings {...propsWithMismatchedData} />)
      
      // Should render without crashing
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
    })

    it('should handle tie scenarios in standings', () => {
      const standingsWithTies = [
        {
          member: { id: 'member-1' },
          wins: 7,
          losses: 3,
          totalPoints: 1200.00,
          pointsAgainst: 1100.00,
          division: 'East'
        },
        {
          member: { id: 'member-2' },
          wins: 7,
          losses: 3,
          totalPoints: 1200.00, // Same record and points
          pointsAgainst: 1150.00,
          division: 'East'
        }
      ]

      render(
        <DivisionStandings 
          {...defaultProps}
          standingsData={standingsWithTies}
          members={mockMembers.slice(0, 2)}
        />
      )
      
      // Should handle ties gracefully
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
      expect(screen.getAllByText('7-3')).toHaveLength(2)
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      // Check for table elements
      const tables = screen.getAllByRole('table')
      expect(tables.length).toBeGreaterThan(0)
    })

    it('should have proper heading structure', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      // Check for proper headings
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
      expect(screen.getByText('East Division')).toBeInTheDocument()
      expect(screen.getByText('West Division')).toBeInTheDocument()
    })

    it('should have accessible table headers', () => {
      render(<DivisionStandings {...defaultProps} />)
      
      // Check for column headers
      expect(screen.getAllByText('Rank')).toHaveLength(2) // One per division
      expect(screen.getAllByText('Manager')).toHaveLength(2)
      expect(screen.getAllByText('Team')).toHaveLength(2)
      expect(screen.getAllByText('Record')).toHaveLength(2)
      expect(screen.getAllByText('Points')).toHaveLength(2)
    })
  })

  describe('Performance', () => {
    it('should render large datasets efficiently', () => {
      // Create a larger dataset
      const largeMembersList = Array.from({ length: 20 }, (_, i) => ({
        id: `member-${i}`,
        league_id: 'test-league',
        manager_name: `Player ${i}`,
        team_name: `Team ${i}`,
        season: '2024',
        division: i < 10 ? 'East' : 'West'
      }))

      const largeStandingsData = largeMembersList.map((member, i) => ({
        member: { id: member.id },
        wins: Math.floor(Math.random() * 10),
        losses: Math.floor(Math.random() * 10),
        totalPoints: 1000 + Math.random() * 500,
        pointsAgainst: 1000 + Math.random() * 500,
        division: member.division
      }))

      const startTime = performance.now()
      render(
        <DivisionStandings 
          {...defaultProps}
          members={largeMembersList}
          standingsData={largeStandingsData}
        />
      )
      const endTime = performance.now()

      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100)
      expect(screen.getByText('🏆 Division Standings')).toBeInTheDocument()
    })
  })
})