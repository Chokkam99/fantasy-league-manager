import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminLogin from '../AdminLogin'

// Mock Next.js router
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace
  })
}))

// Mock Supabase
const mockSupabaseAuth = {
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn()
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockSupabaseAuth
  }
}))

describe('AdminLogin Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'admin@test.com' }, session: {} },
      error: null
    })
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })
  })

  describe('Rendering', () => {
    it('should render login form', () => {
      render(<AdminLogin />)
      
      expect(screen.getByText('Admin Login')).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('should render email input field', () => {
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toBeInTheDocument()
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
    })

    it('should render password input field', () => {
      render(<AdminLogin />)
      
      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toBeInTheDocument()
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
    })

    it('should render sign in button', () => {
      render(<AdminLogin />)
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      expect(signInButton).toBeInTheDocument()
      expect(signInButton).toHaveAttribute('type', 'submit')
    })
  })

  describe('Form Validation', () => {
    it('should require email field', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toBeInvalid()
    })

    it('should require password field', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'admin@test.com')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toBeInvalid()
    })

    it('should validate email format', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'invalid-email')
      
      expect(emailInput).toBeInvalid()
    })

    it('should accept valid email format', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'admin@test.com')
      
      expect(emailInput).toBeValid()
    })
  })

  describe('Form Interaction', () => {
    it('should update email input value', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      await user.type(emailInput, 'admin@test.com')
      
      expect(emailInput.value).toBe('admin@test.com')
    })

    it('should update password input value', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
      await user.type(passwordInput, 'password123')
      
      expect(passwordInput.value).toBe('password123')
    })

    it('should clear form after successful submission', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'password123')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      await waitFor(() => {
        expect(emailInput.value).toBe('')
        expect(passwordInput.value).toBe('')
      })
    })
  })

  describe('Authentication Flow', () => {
    it('should call Supabase signInWithPassword on form submission', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'password123')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'password123'
      })
    })

    it('should redirect to admin dashboard on successful login', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'password123')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
      })
    })

    it('should display error message on failed login', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      })
      
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'wrong@test.com')
      await user.type(passwordInput, 'wrongpassword')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      await waitFor(() => {
        expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      mockSupabaseAuth.signInWithPassword.mockRejectedValue(new Error('Network error'))
      
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'password123')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      await waitFor(() => {
        expect(screen.getByText(/error occurred/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading States', () => {
    it('should show loading state during authentication', async () => {
      mockSupabaseAuth.signInWithPassword.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )
      
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'password123')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      expect(screen.getByText(/signing in/i)).toBeInTheDocument()
      expect(signInButton).toBeDisabled()
    })

    it('should disable form inputs during authentication', async () => {
      mockSupabaseAuth.signInWithPassword.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )
      
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'password123')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      expect(emailInput).toBeDisabled()
      expect(passwordInput).toBeDisabled()
      expect(signInButton).toBeDisabled()
    })

    it('should re-enable form after authentication completes', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'password123')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      await waitFor(() => {
        expect(emailInput).not.toBeDisabled()
        expect(passwordInput).not.toBeDisabled()
        expect(signInButton).not.toBeDisabled()
      })
    })
  })

  describe('Session Management', () => {
    it('should check for existing session on mount', async () => {
      render(<AdminLogin />)
      
      await waitFor(() => {
        expect(mockSupabaseAuth.getSession).toHaveBeenCalled()
      })
    })

    it('should redirect if already authenticated', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      })
      
      render(<AdminLogin />)
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/admin/dashboard')
      })
    })

    it('should handle session check errors', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session check failed' }
      })
      
      render(<AdminLogin />)
      
      // Should still render login form
      expect(screen.getByText('Admin Login')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support tab navigation', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      // Tab through form elements
      await user.tab()
      expect(screen.getByLabelText(/email/i)).toHaveFocus()
      
      await user.tab()
      expect(screen.getByLabelText(/password/i)).toHaveFocus()
      
      await user.tab()
      expect(screen.getByRole('button', { name: /sign in/i })).toHaveFocus()
    })

    it('should submit form on Enter key', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'password123')
      
      await user.keyboard('{Enter}')
      
      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<AdminLogin />)
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })

    it('should have proper ARIA attributes', () => {
      render(<AdminLogin />)
      
      const form = screen.getByRole('form')
      expect(form).toBeInTheDocument()
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveAttribute('aria-required', 'true')
      
      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toHaveAttribute('aria-required', 'true')
    })

    it('should announce errors to screen readers', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' }
      })
      
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'wrong@test.com')
      await user.type(passwordInput, 'wrongpassword')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      await waitFor(() => {
        const errorMessage = screen.getByText('Invalid credentials')
        expect(errorMessage).toHaveAttribute('role', 'alert')
      })
    })

    it('should have sufficient color contrast', () => {
      render(<AdminLogin />)
      
      // Basic color contrast would be tested in e2e tests
      // Here we just ensure elements are properly structured
      expect(screen.getByText('Admin Login')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })
  })

  describe('Security', () => {
    it('should not log password in console', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'secretpassword')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      // Check that password is not logged
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('secretpassword')
      )
      
      consoleSpy.mockRestore()
    })

    it('should clear password field on error', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' }
      })
      
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'wrongpassword')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      await waitFor(() => {
        expect(passwordInput.value).toBe('')
        expect(emailInput.value).toBe('admin@test.com') // Email should remain
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty form submission', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      // Form validation should prevent submission
      expect(mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled()
    })

    it('should handle extremely long input values', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const longEmail = 'a'.repeat(1000) + '@test.com'
      const longPassword = 'p'.repeat(1000)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, longEmail)
      await user.type(passwordInput, longPassword)
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: longEmail,
        password: longPassword
      })
    })

    it('should handle special characters in input', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const specialEmail = 'admin+test@example.com'
      const specialPassword = 'P@ssw0rd!#$'
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, specialEmail)
      await user.type(passwordInput, specialPassword)
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(signInButton)
      
      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: specialEmail,
        password: specialPassword
      })
    })
  })

  describe('Performance', () => {
    it('should render quickly', () => {
      const startTime = performance.now()
      render(<AdminLogin />)
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(50)
      expect(screen.getByText('Admin Login')).toBeInTheDocument()
    })

    it('should handle rapid form submissions', async () => {
      const user = userEvent.setup()
      render(<AdminLogin />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'admin@test.com')
      await user.type(passwordInput, 'password123')
      
      const signInButton = screen.getByRole('button', { name: /sign in/i })
      
      // Rapid clicks should not cause multiple submissions
      await user.click(signInButton)
      await user.click(signInButton)
      await user.click(signInButton)
      
      // Should only be called once due to loading state
      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledTimes(1)
    })
  })
})