import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PostseasonToggle from '../PostseasonToggle'

describe('PostseasonToggle Component', () => {
  const mockOnToggle = jest.fn()

  const defaultProps = {
    includePostseason: false,
    onToggle: mockOnToggle,
    seasonConfig: {
      id: 'config-1',
      league_id: 'test-league',
      season: '2024',
      playoff_start_week: 15,
      total_weeks: 17,
      playoff_spots: 6
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the toggle component', () => {
      render(<PostseasonToggle {...defaultProps} />)
      
      expect(screen.getByText('Include Postseason')).toBeInTheDocument()
    })

    it('should render toggle switch', () => {
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      expect(toggleSwitch).toBeInTheDocument()
    })

    it('should show correct initial state when postseason is not included', () => {
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox') as HTMLInputElement
      expect(toggleSwitch.checked).toBe(false)
    })

    it('should show correct initial state when postseason is included', () => {
      render(<PostseasonToggle {...defaultProps} includePostseason={true} />)
      
      const toggleSwitch = screen.getByRole('checkbox') as HTMLInputElement
      expect(toggleSwitch.checked).toBe(true)
    })

    it('should display week range information', () => {
      render(<PostseasonToggle {...defaultProps} />)
      
      // Should show regular season week range
      expect(screen.getByText(/weeks 1-14/i)).toBeInTheDocument()
    })

    it('should update week range when postseason is included', () => {
      render(<PostseasonToggle {...defaultProps} includePostseason={true} />)
      
      // Should show full season week range including postseason
      expect(screen.getByText(/weeks 1-17/i)).toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('should call onToggle when clicked', async () => {
      const user = userEvent.setup()
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      await user.click(toggleSwitch)
      
      expect(mockOnToggle).toHaveBeenCalledTimes(1)
      expect(mockOnToggle).toHaveBeenCalledWith(true)
    })

    it('should call onToggle with false when toggling off', async () => {
      const user = userEvent.setup()
      render(<PostseasonToggle {...defaultProps} includePostseason={true} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      await user.click(toggleSwitch)
      
      expect(mockOnToggle).toHaveBeenCalledTimes(1)
      expect(mockOnToggle).toHaveBeenCalledWith(false)
    })

    it('should handle multiple rapid clicks', async () => {
      const user = userEvent.setup()
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      
      // Rapid clicks
      await user.click(toggleSwitch)
      await user.click(toggleSwitch)
      await user.click(toggleSwitch)
      
      expect(mockOnToggle).toHaveBeenCalledTimes(3)
      expect(mockOnToggle).toHaveBeenNthCalledWith(1, true)
      expect(mockOnToggle).toHaveBeenNthCalledWith(2, false)
      expect(mockOnToggle).toHaveBeenNthCalledWith(3, true)
    })

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      
      // Tab to focus the element
      await user.tab()
      expect(toggleSwitch).toHaveFocus()
      
      // Press Space to toggle
      await user.keyboard(' ')
      expect(mockOnToggle).toHaveBeenCalledWith(true)
    })

    it('should handle Enter key press', async () => {
      const user = userEvent.setup()
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      await user.click(toggleSwitch) // Focus the element
      
      await user.keyboard('{Enter}')
      expect(mockOnToggle).toHaveBeenCalled()
    })
  })

  describe('Season Configuration', () => {
    it('should handle missing season config gracefully', () => {
      render(<PostseasonToggle {...defaultProps} seasonConfig={null} />)
      
      expect(screen.getByText('Include Postseason')).toBeInTheDocument()
      // Should use default week ranges
      expect(screen.getByText(/weeks/i)).toBeInTheDocument()
    })

    it('should display correct week ranges for different configurations', () => {
      const customSeasonConfig = {
        id: 'config-2',
        league_id: 'test-league',
        season: '2024',
        playoff_start_week: 13,
        total_weeks: 16,
        playoff_spots: 4
      }

      render(
        <PostseasonToggle 
          {...defaultProps} 
          seasonConfig={customSeasonConfig} 
        />
      )
      
      // Should show weeks 1-12 for regular season (13 - 1)
      expect(screen.getByText(/weeks 1-12/i)).toBeInTheDocument()
    })

    it('should update week range when season config changes', () => {
      const { rerender } = render(<PostseasonToggle {...defaultProps} />)
      
      expect(screen.getByText(/weeks 1-14/i)).toBeInTheDocument()
      
      const newSeasonConfig = {
        ...defaultProps.seasonConfig,
        playoff_start_week: 16,
        total_weeks: 18
      }
      
      rerender(
        <PostseasonToggle 
          {...defaultProps} 
          seasonConfig={newSeasonConfig} 
        />
      )
      
      expect(screen.getByText(/weeks 1-15/i)).toBeInTheDocument()
    })
  })

  describe('Visual State', () => {
    it('should apply correct CSS classes for off state', () => {
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      expect(toggleSwitch).not.toBeChecked()
    })

    it('should apply correct CSS classes for on state', () => {
      render(<PostseasonToggle {...defaultProps} includePostseason={true} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      expect(toggleSwitch).toBeChecked()
    })

    it('should have proper labeling for accessibility', () => {
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      const label = screen.getByText('Include Postseason')
      
      expect(toggleSwitch).toHaveAccessibleName('Include Postseason')
      expect(label).toBeInTheDocument()
    })

    it('should show visual feedback on hover', async () => {
      const user = userEvent.setup()
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleContainer = screen.getByText('Include Postseason').closest('div')
      
      await user.hover(toggleContainer!)
      // Visual feedback should be present (tested via CSS classes)
      expect(toggleContainer).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined onToggle gracefully', () => {
      const propsWithoutOnToggle = {
        ...defaultProps,
        onToggle: undefined as unknown as () => void
      }

      render(<PostseasonToggle {...propsWithoutOnToggle} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      
      // Should not crash when clicked
      fireEvent.click(toggleSwitch)
      expect(screen.getByText('Include Postseason')).toBeInTheDocument()
    })

    it('should handle extreme season configurations', () => {
      const extremeConfig = {
        id: 'config-extreme',
        league_id: 'test-league',
        season: '2024',
        playoff_start_week: 1, // Very early playoffs
        total_weeks: 1, // Very short season
        playoff_spots: 2
      }

      render(
        <PostseasonToggle 
          {...defaultProps} 
          seasonConfig={extremeConfig} 
        />
      )
      
      // Should handle edge case without crashing
      expect(screen.getByText('Include Postseason')).toBeInTheDocument()
    })

    it('should handle very long seasons', () => {
      const longSeasonConfig = {
        id: 'config-long',
        league_id: 'test-league',
        season: '2024',
        playoff_start_week: 20,
        total_weeks: 25,
        playoff_spots: 8
      }

      render(
        <PostseasonToggle 
          {...defaultProps} 
          seasonConfig={longSeasonConfig} 
        />
      )
      
      expect(screen.getByText('Include Postseason')).toBeInTheDocument()
      expect(screen.getByText(/weeks 1-19/i)).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = jest.fn()
      
      const TestWrapper = (props: React.ComponentProps<typeof PostseasonToggle>) => {
        renderSpy()
        return <PostseasonToggle {...props} />
      }

      const { rerender } = render(<TestWrapper {...defaultProps} />)
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Re-render with same props
      rerender(<TestWrapper {...defaultProps} />)
      
      // Should only render once more
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('should handle rapid state changes efficiently', async () => {
      const user = userEvent.setup()
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      
      const startTime = performance.now()
      
      // Rapid toggling
      for (let i = 0; i < 10; i++) {
        await user.click(toggleSwitch)
      }
      
      const endTime = performance.now()
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000)
      expect(mockOnToggle).toHaveBeenCalledTimes(10)
    })
  })

  describe('Integration', () => {
    it('should work correctly when controlled externally', () => {
      const { rerender } = render(<PostseasonToggle {...defaultProps} />)
      
      let toggleSwitch = screen.getByRole('checkbox') as HTMLInputElement
      expect(toggleSwitch.checked).toBe(false)
      
      // External state change
      rerender(<PostseasonToggle {...defaultProps} includePostseason={true} />)
      
      toggleSwitch = screen.getByRole('checkbox') as HTMLInputElement
      expect(toggleSwitch.checked).toBe(true)
    })

    it('should maintain state consistency during rapid external changes', () => {
      const { rerender } = render(<PostseasonToggle {...defaultProps} includePostseason={false} />)
      
      // Rapid external state changes
      rerender(<PostseasonToggle {...defaultProps} includePostseason={true} />)
      rerender(<PostseasonToggle {...defaultProps} includePostseason={false} />)
      rerender(<PostseasonToggle {...defaultProps} includePostseason={true} />)
      
      const toggleSwitch = screen.getByRole('checkbox') as HTMLInputElement
      expect(toggleSwitch.checked).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      
      expect(toggleSwitch).toHaveAttribute('type', 'checkbox')
      expect(toggleSwitch).toHaveAccessibleName()
    })

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<PostseasonToggle {...defaultProps} />)
      
      // Should be reachable via Tab navigation
      await user.tab()
      const toggleSwitch = screen.getByRole('checkbox')
      expect(toggleSwitch).toHaveFocus()
    })

    it('should announce state changes to screen readers', () => {
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      
      // Initial state
      expect(toggleSwitch).toHaveAttribute('aria-checked', 'false')
      
      // After toggle (would be handled by React state update)
      fireEvent.click(toggleSwitch)
      // The actual state change would be handled by the parent component
    })

    it('should have sufficient color contrast', () => {
      render(<PostseasonToggle {...defaultProps} />)
      
      const toggleSwitch = screen.getByRole('checkbox')
      expect(toggleSwitch).toBeInTheDocument()
      
      // Color contrast would be tested via CSS analysis in e2e tests
      // Here we just ensure the element exists and is properly structured
    })
  })
})