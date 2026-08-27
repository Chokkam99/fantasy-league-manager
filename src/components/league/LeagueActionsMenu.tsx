'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import AdminLogin from '@/components/AdminLogin'
import ShareButton from '@/components/ShareButton'
import { Button } from '@/components/ui/Button'

interface LeagueActionsMenuProps {
  isAdmin: boolean
  onAuthChange: (isAdmin: boolean) => void
  playersUrl: string
  rulesUrl: string
  seasonSetupUrl: string
  settingsUrl: string
  leagueId: string
  season: string
}

export default function LeagueActionsMenu({
  isAdmin,
  onAuthChange,
  playersUrl,
  rulesUrl,
  seasonSetupUrl,
  settingsUrl,
  leagueId,
  season,
}: LeagueActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPlayerAccessOpen, setIsPlayerAccessOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (isPlayerAccessOpen) return
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (isPlayerAccessOpen) return
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen, isPlayerAccessOpen])

  return (
    <div className="relative" ref={menuRef}>
      <Button
        aria-controls="mobile-league-actions"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Open league actions"
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        size="icon"
        variant="ghost"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </Button>

      {isOpen && (
        <div
          aria-label="League actions"
          className={`absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 rounded-[var(--app-radius-md)] border border-app-border bg-app-surface p-2 shadow-[var(--app-shadow-md)] ${isPlayerAccessOpen ? 'invisible pointer-events-none' : ''}`}
          id="mobile-league-actions"
        >
          <Link
            className="flex min-h-11 items-center gap-3 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold text-app-text hover:bg-app-surface-subtle sm:hidden"
            href="/"
            onClick={() => setIsOpen(false)}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 5h16v14H4zM8 9h8M8 13h5" />
            </svg>
            All leagues
          </Link>
          <Link
            className="flex min-h-11 items-center gap-3 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold text-app-text hover:bg-app-surface-subtle sm:hidden"
            href={playersUrl}
            onClick={() => setIsOpen(false)}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="9" cy="8" r="3" />
              <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.5M17 14a5 5 0 0 1 3.5 4.8" />
            </svg>
            {isAdmin ? 'Players and dues' : 'League roster'}
          </Link>
          <Link
            className="flex min-h-11 items-center gap-3 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold text-app-text hover:bg-app-surface-subtle sm:hidden"
            href={rulesUrl}
            onClick={() => setIsOpen(false)}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" />
            </svg>
            League rules
          </Link>
          {isAdmin && (
            <div className="mt-1 border-t border-app-border pt-1">
              <Link
                className="flex min-h-11 w-full items-center gap-3 rounded-[var(--app-radius-sm)] px-3 text-left text-sm font-semibold text-app-text hover:bg-app-surface-subtle"
                href={seasonSetupUrl}
                onClick={() => setIsOpen(false)}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 3v18M3 12h18" />
                </svg>
                Start next season
              </Link>
              <Link
                className="flex min-h-11 w-full items-center gap-3 rounded-[var(--app-radius-sm)] px-3 text-left text-sm font-semibold text-app-text hover:bg-app-surface-subtle"
                href={settingsUrl}
                onClick={() => setIsOpen(false)}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
                </svg>
                League settings
              </Link>
            </div>
          )}
          {isAdmin && (
            <ShareButton
              className="w-full justify-start border-0 px-3 shadow-none sm:hidden"
              label="Player access"
              leagueId={leagueId}
              onClose={() => {
                setIsPlayerAccessOpen(false)
                setIsOpen(false)
              }}
              onOpen={() => setIsPlayerAccessOpen(true)}
              season={season}
            />
          )}
          <div className="mt-1 border-t border-app-border pt-1">
            <AdminLogin
              display="menu"
              isAdmin={isAdmin}
              onAuthChange={(authenticated) => {
                setIsOpen(false)
                onAuthChange(authenticated)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
