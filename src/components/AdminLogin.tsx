'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'
import { Toast } from '@/components/ui/Toast'
import { authenticateAdmin, logoutAdmin } from '@/lib/adminAuth'

interface AdminLoginProps {
  display?: 'icon' | 'menu' | 'panel'
  isAdmin: boolean
  onAuthChange: (isAdmin: boolean) => void
}

export default function AdminLogin({
  display = 'icon',
  isAdmin,
  onAuthChange,
}: AdminLoginProps) {
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)

  const closeLogin = () => {
    setShowLogin(false)
    setPassword('')
    setError('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await authenticateAdmin(password)

      if (result.success) {
        onAuthChange(true)
        setShowLogin(false)
        setPassword('')
      } else {
        setError(result.error || 'Unable to sign in.')
      }
    } catch {
      setError('Sign-in failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoading(true)
    setError('')
    try {
      await logoutAdmin()
      onAuthChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not log out. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isAdmin) {
    const isMenu = display === 'menu'
    return (
      <div className={isMenu ? 'w-full' : 'flex items-center'}>
        <button
          aria-label={isLoading ? 'Logging out' : 'Log out'}
          disabled={isLoading}
          type="button"
          onClick={handleLogout}
          className={isMenu
            ? 'flex min-h-11 w-full items-center gap-3 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold text-app-text hover:bg-app-surface-subtle'
            : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--app-radius-sm)] text-app-text-muted hover:bg-app-surface-subtle hover:text-app-text'}
          title="Log out"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
          </svg>
          {isMenu && (isLoading ? 'Logging out…' : 'Log out')}
        </button>
        <Toast duration={0} message={error || null} onDismiss={() => setError('')} tone="danger" />
      </div>
    )
  }

  const loginForm = (inline: boolean) => (
    <form
      aria-busy={isLoading}
      className="space-y-4"
      onSubmit={handleLogin}
    >
      <div>
        <label
          className="sr-only"
          htmlFor={inline ? 'commissioner-password-panel' : 'commissioner-password'}
        >
          Commissioner password
        </label>
        <div className="relative">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12v10H6z" />
          </svg>
          <TextInput
            autoComplete="current-password"
            className="pl-10"
            id={inline ? 'commissioner-password-panel' : 'commissioner-password'}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            ref={passwordRef}
            type="password"
            value={password}
          />
        </div>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      {inline ? (
        <Button
          className="w-full"
          disabled={isLoading || !password.trim()}
          type="submit"
        >
          {isLoading ? 'Signing in…' : 'Continue'}
        </Button>
      ) : (
        <div>
          <Button className="w-full" disabled={isLoading || !password.trim()} type="submit">
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      )}
    </form>
  )

  if (display === 'panel') return loginForm(true)

  return (
    <>
      <button
        aria-label="Commissioner login"
        type="button"
        onClick={() => setShowLogin(true)}
        className={display === 'menu'
          ? 'flex min-h-11 w-full items-center gap-3 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold text-app-text hover:bg-app-surface-subtle'
          : 'flex h-11 w-11 items-center justify-center rounded-[var(--app-radius-sm)] text-app-text-muted transition-colors hover:bg-app-surface-subtle hover:text-app-text'}
        title="Commissioner login"
      >
        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        {display === 'menu' && <span>Commissioner login</span>}
      </button>

      <Dialog
        busy={isLoading}
        closeLabel="Close commissioner login"
        description="Enter the private league password to continue."
        initialFocusRef={passwordRef}
        onClose={closeLogin}
        open={showLogin}
        title="Commissioner sign in"
      >
        {loginForm(false)}
      </Dialog>
    </>
  )
}
