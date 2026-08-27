'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'
import { authenticateAdmin, logoutAdmin } from '@/lib/adminAuth'

interface AdminLoginProps {
  display?: 'icon' | 'menu'
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
      setError('Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    logoutAdmin()
    onAuthChange(false)
  }

  if (isAdmin) {
    return (
      <div className={display === 'menu' ? 'w-full' : 'flex items-center'}>
        <button
          aria-label="Log out of commissioner mode"
          onClick={handleLogout}
          className={display === 'menu'
            ? 'flex min-h-11 w-full items-center gap-3 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold text-app-text hover:bg-app-surface-subtle'
            : 'min-h-11 rounded-[var(--app-radius-sm)] px-3 text-xs font-semibold text-app-text-muted hover:bg-app-surface-subtle hover:text-app-text'}
          title="Log out"
        >
          {display === 'menu' && (
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
            </svg>
          )}
          {display === 'menu' ? 'Log out of commissioner mode' : 'Log out'}
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        aria-label="Commissioner login"
        onClick={() => setShowLogin(true)}
        className={display === 'menu'
          ? 'flex min-h-11 w-full items-center gap-3 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold text-app-text hover:bg-app-surface-subtle'
          : 'flex h-11 w-11 items-center justify-center rounded-[var(--app-radius-sm)] text-app-text-muted transition-colors hover:bg-app-surface-subtle hover:text-app-text'}
        title="Commissioner login"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        {display === 'menu' && <span>Commissioner login</span>}
      </button>

      <Dialog
        busy={isLoading}
        closeLabel="Close commissioner login"
        description="Sign in to manage scores, players, dues, and league settings."
        initialFocusRef={passwordRef}
        onClose={closeLogin}
        open={showLogin}
        title="Commissioner login"
      >
            <form className="space-y-4" onSubmit={handleLogin}>
              <FormField htmlFor="commissioner-password" label="Password">
                <TextInput
                  id="commissioner-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter commissioner password"
                  ref={passwordRef}
                />
              </FormField>
              
              {error && <Notice tone="danger">{error}</Notice>}
              
              <div className="grid grid-cols-2 gap-3">
                <Button disabled={isLoading} onClick={closeLogin} variant="secondary">
                  Cancel
                </Button>
                <Button disabled={isLoading || !password.trim()} type="submit">
                  {isLoading ? 'Logging in...' : 'Login'}
                </Button>
              </div>
            </form>
      </Dialog>
    </>
  )
}
