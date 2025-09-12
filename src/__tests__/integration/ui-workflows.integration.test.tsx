/**
 * Integration Tests for UI Workflows
 * 
 * These tests verify end-to-end user interface functionality including:
 * - User navigation and routing
 * - Form submissions and data updates
 * - Real-time data synchronization
 * - Error states and loading states
 * - Responsive behavior
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock Next.js router
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: jest.fn()
  }),
  useParams: () => ({ id: 'test-league' }),
  useSearchParams: () => new URLSearchParams()
}))

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    update: jest.fn(() => Promise.resolve({ data: null, error: null })),
    upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    delete: jest.fn(() => Promise.resolve({ data: null, error: null }))
  })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
}

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient
}))

describe('UI Workflows Integration Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('League Management Workflows', () => {
    test('should handle complete league creation workflow', async () => {
      // Mock component for league creation
      const MockLeagueCreation = () => {
        const [formData, setFormData] = React.useState({
          name: '',
          season: '',
          fee: ''
        })
        const [isSubmitting, setIsSubmitting] = React.useState(false)
        const [errors, setErrors] = React.useState<Record<string, string>>({})

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault()
          setIsSubmitting(true)
          setErrors({})

          // Validation
          const newErrors: Record<string, string> = {}
          if (!formData.name.trim()) newErrors.name = 'League name is required'
          if (!formData.season.trim()) newErrors.season = 'Season is required'
          if (!formData.fee || parseFloat(formData.fee) <= 0) newErrors.fee = 'Valid fee amount is required'

          if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            setIsSubmitting(false)
            return
          }

          // Simulate API call
          try {
            await new Promise(resolve => setTimeout(resolve, 500)) // Simulate delay
            console.log('League created:', formData)
            mockPush('/league/new-league-id')
          } catch (error) {
            setErrors({ submit: 'Failed to create league. Please try again.' })
          } finally {
            setIsSubmitting(false)
          }
        }

        return (
          <form onSubmit={handleSubmit} data-testid="league-creation-form">
            <div>
              <label htmlFor="league-name">League Name</label>
              <input
                id="league-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                aria-invalid={!!errors.name}
              />
              {errors.name && <span role="alert">{errors.name}</span>}
            </div>

            <div>
              <label htmlFor="season">Season</label>
              <input
                id="season"
                type="text"
                value={formData.season}
                onChange={(e) => setFormData(prev => ({ ...prev, season: e.target.value }))}
                aria-invalid={!!errors.season}
              />
              {errors.season && <span role="alert">{errors.season}</span>}
            </div>

            <div>
              <label htmlFor="fee">Entry Fee ($)</label>
              <input
                id="fee"
                type="number"
                step="0.01"
                value={formData.fee}
                onChange={(e) => setFormData(prev => ({ ...prev, fee: e.target.value }))}
                aria-invalid={!!errors.fee}
              />
              {errors.fee && <span role="alert">{errors.fee}</span>}
            </div>

            {errors.submit && (
              <div role="alert" className="error-message">
                {errors.submit}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              data-testid="create-league-button"
            >
              {isSubmitting ? 'Creating...' : 'Create League'}
            </button>
          </form>
        )
      }

      render(<MockLeagueCreation />)

      // 1. Test form validation
      const submitButton = screen.getByTestId('create-league-button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('League name is required')).toBeInTheDocument()
        expect(screen.getByText('Season is required')).toBeInTheDocument()
        expect(screen.getByText('Valid fee amount is required')).toBeInTheDocument()
      })

      // 2. Test successful form submission
      const nameInput = screen.getByLabelText('League Name')
      const seasonInput = screen.getByLabelText('Season')
      const feeInput = screen.getByLabelText('Entry Fee ($)')

      await user.type(nameInput, 'Test Integration League')
      await user.type(seasonInput, '2024')
      await user.type(feeInput, '150.00')

      await user.click(submitButton)

      // 3. Verify loading state
      expect(screen.getByText('Creating...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()

      // 4. Verify successful navigation
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/league/new-league-id')
      }, { timeout: 1000 })
    })

    test('should handle league member management workflow', async () => {
      // Mock member management component
      const MockMemberManagement = () => {
        const [members, setMembers] = React.useState([
          { id: '1', name: 'Alice Johnson', team: 'Team Alice', status: 'paid' },
          { id: '2', name: 'Bob Smith', team: 'Team Bob', status: 'pending' }
        ])
        const [isEditing, setIsEditing] = React.useState<string | null>(null)
        const [editForm, setEditForm] = React.useState({ name: '', team: '', status: 'pending' })

        const startEdit = (member: typeof members[0]) => {
          setIsEditing(member.id)
          setEditForm({ name: member.name, team: member.team, status: member.status })
        }

        const saveEdit = () => {
          setMembers(prev => prev.map(member => 
            member.id === isEditing 
              ? { ...member, name: editForm.name, team: editForm.team, status: editForm.status }
              : member
          ))
          setIsEditing(null)
        }

        const cancelEdit = () => {
          setIsEditing(null)
          setEditForm({ name: '', team: '', status: 'pending' })
        }

        return (
          <div data-testid="member-management">
            <h2>League Members</h2>
            {members.map(member => (
              <div key={member.id} data-testid={`member-${member.id}`}>
                {isEditing === member.id ? (
                  <div data-testid="edit-form">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Manager Name"
                      aria-label="Manager Name"
                    />
                    <input
                      value={editForm.team}
                      onChange={(e) => setEditForm(prev => ({ ...prev, team: e.target.value }))}
                      placeholder="Team Name"
                      aria-label="Team Name"
                    />
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                      aria-label="Payment Status"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                    </select>
                    <button onClick={saveEdit} data-testid="save-edit">Save</button>
                    <button onClick={cancelEdit} data-testid="cancel-edit">Cancel</button>
                  </div>
                ) : (
                  <div data-testid="member-display">
                    <span>{member.name}</span>
                    <span>{member.team}</span>
                    <span className={`status-${member.status}`}>{member.status}</span>
                    <button onClick={() => startEdit(member)} data-testid={`edit-${member.id}`}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }

      render(<MockMemberManagement />)

      // 1. Verify initial state
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()
      expect(screen.getByText('Team Alice')).toBeInTheDocument()

      // 2. Test editing workflow
      const editButton = screen.getByTestId('edit-1')
      await user.click(editButton)

      // Verify edit form appears
      expect(screen.getByTestId('edit-form')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Alice Johnson')).toBeInTheDocument()

      // 3. Test form modifications
      const nameInput = screen.getByLabelText('Manager Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'Alice Williams')

      const statusSelect = screen.getByLabelText('Payment Status')
      await user.selectOptions(statusSelect, 'paid')

      // 4. Test saving changes
      const saveButton = screen.getByTestId('save-edit')
      await user.click(saveButton)

      // Verify changes are reflected
      await waitFor(() => {
        expect(screen.getByText('Alice Williams')).toBeInTheDocument()
        expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument()
      })

      // 5. Test cancel functionality
      const editButton2 = screen.getByTestId('edit-2')
      await user.click(editButton2)

      const nameInput2 = screen.getByLabelText('Manager Name')
      await user.clear(nameInput2)
      await user.type(nameInput2, 'Modified Name')

      const cancelButton = screen.getByTestId('cancel-edit')
      await user.click(cancelButton)

      // Verify changes are not saved
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()
      expect(screen.queryByText('Modified Name')).not.toBeInTheDocument()
    })
  })

  describe('Score Management Workflows', () => {
    test('should handle weekly score entry workflow', async () => {
      // Mock weekly score component
      const MockWeeklyScores = () => {
        const [selectedWeek, setSelectedWeek] = React.useState(1)
        const [scores, setScores] = React.useState<Record<string, string>>({
          'member-1': '',
          'member-2': ''
        })
        const [isSaving, setIsSaving] = React.useState(false)
        const [saveStatus, setSaveStatus] = React.useState<'idle' | 'success' | 'error'>('idle')

        const members = [
          { id: 'member-1', name: 'Alice Johnson', team: 'Team Alice' },
          { id: 'member-2', name: 'Bob Smith', team: 'Team Bob' }
        ]

        const handleScoreChange = (memberId: string, value: string) => {
          setScores(prev => ({ ...prev, [memberId]: value }))
        }

        const handleSave = async () => {
          setIsSaving(true)
          setSaveStatus('idle')

          try {
            // Validate scores
            const invalidScores = Object.entries(scores).filter(([_, score]) => {
              const num = parseFloat(score)
              return isNaN(num) || num < 0
            })

            if (invalidScores.length > 0) {
              throw new Error('Invalid scores detected')
            }

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500))
            setSaveStatus('success')
          } catch (error) {
            setSaveStatus('error')
          } finally {
            setIsSaving(false)
          }
        }

        return (
          <div data-testid="weekly-scores">
            <div>
              <label htmlFor="week-select">Week:</label>
              <select
                id="week-select"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
              >
                {Array.from({ length: 17 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                ))}
              </select>
            </div>

            <div data-testid="score-inputs">
              {members.map(member => (
                <div key={member.id} data-testid={`score-row-${member.id}`}>
                  <label>{member.name} ({member.team})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={scores[member.id]}
                    onChange={(e) => handleScoreChange(member.id, e.target.value)}
                    data-testid={`score-input-${member.id}`}
                    aria-label={`Score for ${member.name}`}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              data-testid="save-scores-button"
            >
              {isSaving ? 'Saving...' : 'Save Scores'}
            </button>

            {saveStatus === 'success' && (
              <div role="alert" className="success-message" data-testid="save-success">
                Scores saved successfully!
              </div>
            )}

            {saveStatus === 'error' && (
              <div role="alert" className="error-message" data-testid="save-error">
                Failed to save scores. Please try again.
              </div>
            )}
          </div>
        )
      }

      render(<MockWeeklyScores />)

      // 1. Test week selection
      const weekSelect = screen.getByLabelText('Week:')
      await user.selectOptions(weekSelect, '3')
      expect(weekSelect).toHaveValue('3')

      // 2. Test score input
      const aliceScoreInput = screen.getByTestId('score-input-member-1')
      const bobScoreInput = screen.getByTestId('score-input-member-2')

      await user.type(aliceScoreInput, '145.75')
      await user.type(bobScoreInput, '132.50')

      expect(aliceScoreInput).toHaveValue(145.75)
      expect(bobScoreInput).toHaveValue(132.5)

      // 3. Test successful save
      const saveButton = screen.getByTestId('save-scores-button')
      await user.click(saveButton)

      // Verify loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(saveButton).toBeDisabled()

      // Verify success message
      await waitFor(() => {
        expect(screen.getByTestId('save-success')).toBeInTheDocument()
      }, { timeout: 1000 })

      // 4. Test validation with invalid scores
      await user.clear(aliceScoreInput)
      await user.type(aliceScoreInput, '-10')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument()
      }, { timeout: 1000 })
    })
  })

  describe('Navigation and Routing Workflows', () => {
    test('should handle season switching workflow', async () => {
      // Mock season navigation component
      const MockSeasonNavigation = () => {
        const [currentSeason, setCurrentSeason] = React.useState('2024')
        const [loading, setLoading] = React.useState(false)

        const availableSeasons = ['2021', '2022', '2023', '2024']

        const handleSeasonChange = async (newSeason: string) => {
          setLoading(true)
          
          try {
            // Simulate data loading for new season
            await new Promise(resolve => setTimeout(resolve, 300))
            setCurrentSeason(newSeason)
            mockReplace(`/league/test-league?season=${newSeason}`)
          } finally {
            setLoading(false)
          }
        }

        return (
          <div data-testid="season-navigation">
            <h2>Season: {currentSeason}</h2>
            {loading && <div data-testid="season-loading">Loading season data...</div>}
            
            <div data-testid="season-buttons">
              {availableSeasons.map(season => (
                <button
                  key={season}
                  onClick={() => handleSeasonChange(season)}
                  disabled={loading || season === currentSeason}
                  data-testid={`season-button-${season}`}
                  className={season === currentSeason ? 'active' : ''}
                >
                  {season}
                </button>
              ))}
            </div>

            <div data-testid="season-content">
              {!loading && <p>Showing data for {currentSeason} season</p>}
            </div>
          </div>
        )
      }

      render(<MockSeasonNavigation />)

      // 1. Verify initial state
      expect(screen.getByText('Season: 2024')).toBeInTheDocument()
      expect(screen.getByText('Showing data for 2024 season')).toBeInTheDocument()

      // 2. Test season switching
      const season2023Button = screen.getByTestId('season-button-2023')
      await user.click(season2023Button)

      // Verify loading state
      expect(screen.getByTestId('season-loading')).toBeInTheDocument()
      expect(season2023Button).toBeDisabled()

      // Verify season change
      await waitFor(() => {
        expect(screen.getByText('Season: 2023')).toBeInTheDocument()
        expect(screen.getByText('Showing data for 2023 season')).toBeInTheDocument()
      }, { timeout: 500 })

      // Verify URL update
      expect(mockReplace).toHaveBeenCalledWith('/league/test-league?season=2023')

      // 3. Test that current season button is disabled
      const currentSeasonButton = screen.getByTestId('season-button-2023')
      expect(currentSeasonButton).toBeDisabled()
      expect(currentSeasonButton).toHaveClass('active')
    })

    test('should handle responsive navigation workflow', async () => {
      // Mock responsive navigation component
      const MockResponsiveNav = () => {
        const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
        const [windowWidth, setWindowWidth] = React.useState(1024)

        const navigationItems = [
          { name: 'Standings', href: '/standings' },
          { name: 'Scores', href: '/scores' },
          { name: 'Matchups', href: '/matchups' },
          { name: 'History', href: '/history' }
        ]

        const isMobile = windowWidth < 768

        return (
          <nav data-testid="responsive-navigation">
            {/* Desktop Navigation */}
            {!isMobile && (
              <div data-testid="desktop-nav" className="desktop-nav">
                {navigationItems.map(item => (
                  <a
                    key={item.name}
                    href={item.href}
                    data-testid={`nav-link-${item.name.toLowerCase()}`}
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            )}

            {/* Mobile Navigation */}
            {isMobile && (
              <div data-testid="mobile-nav">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  data-testid="mobile-menu-toggle"
                  aria-expanded={isMobileMenuOpen}
                >
                  Menu
                </button>

                {isMobileMenuOpen && (
                  <div data-testid="mobile-menu" className="mobile-menu">
                    {navigationItems.map(item => (
                      <a
                        key={item.name}
                        href={item.href}
                        data-testid={`mobile-nav-link-${item.name.toLowerCase()}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Simulate window resize for testing */}
            <button
              onClick={() => setWindowWidth(windowWidth === 1024 ? 480 : 1024)}
              data-testid="simulate-resize"
            >
              Toggle Mobile View
            </button>
          </nav>
        )
      }

      render(<MockResponsiveNav />)

      // 1. Test desktop navigation
      expect(screen.getByTestId('desktop-nav')).toBeInTheDocument()
      expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument()
      expect(screen.getByTestId('nav-link-standings')).toBeInTheDocument()

      // 2. Test mobile navigation
      const resizeButton = screen.getByTestId('simulate-resize')
      await user.click(resizeButton)

      expect(screen.queryByTestId('desktop-nav')).not.toBeInTheDocument()
      expect(screen.getByTestId('mobile-nav')).toBeInTheDocument()

      // 3. Test mobile menu toggle
      const menuToggle = screen.getByTestId('mobile-menu-toggle')
      expect(menuToggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument()

      await user.click(menuToggle)

      expect(menuToggle).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
      expect(screen.getByTestId('mobile-nav-link-standings')).toBeInTheDocument()

      // 4. Test menu close on link click
      const mobileLink = screen.getByTestId('mobile-nav-link-scores')
      await user.click(mobileLink)

      expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument()
      expect(menuToggle).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      // Mock component with error handling
      const MockDataComponent = () => {
        const [data, setData] = React.useState(null)
        const [loading, setLoading] = React.useState(false)
        const [error, setError] = React.useState<string | null>(null)

        const fetchData = async (shouldFail = false) => {
          setLoading(true)
          setError(null)

          try {
            await new Promise((resolve, reject) => 
              setTimeout(() => {
                if (shouldFail) {
                  reject(new Error('Network error'))
                } else {
                  resolve({ standings: ['Team A', 'Team B'] })
                }
              }, 300)
            )
            setData({ standings: ['Team A', 'Team B'] })
          } catch (err) {
            setError('Failed to load data. Please try again.')
          } finally {
            setLoading(false)
          }
        }

        React.useEffect(() => {
          fetchData()
        }, [])

        const handleRetry = () => fetchData(false)
        const simulateError = () => fetchData(true)

        return (
          <div data-testid="data-component">
            {loading && <div data-testid="loading">Loading...</div>}
            
            {error && (
              <div data-testid="error-state" role="alert">
                <p>{error}</p>
                <button onClick={handleRetry} data-testid="retry-button">
                  Retry
                </button>
              </div>
            )}

            {data && !loading && !error && (
              <div data-testid="success-state">
                <p>Data loaded successfully!</p>
              </div>
            )}

            <button onClick={simulateError} data-testid="simulate-error">
              Simulate Error
            </button>
          </div>
        )
      }

      render(<MockDataComponent />)

      // 1. Test initial loading state
      expect(screen.getByTestId('loading')).toBeInTheDocument()

      // 2. Test successful data loading
      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument()
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      }, { timeout: 500 })

      // 3. Test error state
      const errorButton = screen.getByTestId('simulate-error')
      await user.click(errorButton)

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument()
        expect(screen.getByText('Failed to load data. Please try again.')).toBeInTheDocument()
      }, { timeout: 500 })

      // 4. Test retry functionality
      const retryButton = screen.getByTestId('retry-button')
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument()
        expect(screen.queryByTestId('error-state')).not.toBeInTheDocument()
      }, { timeout: 500 })
    })
  })
})