'use client'

import { useState, useEffect } from 'react'
import AdminLogin from '@/components/AdminLogin'
import CreateLeagueModal from '@/components/CreateLeagueModal'
import LeaguesList from '@/components/LeaguesList'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { checkAdminAuth } from '@/lib/adminAuth'

export default function Home() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true

    checkAdminAuth().then((authorized) => {
      if (!active) return
      setIsAdmin(authorized)
      setAuthChecked(true)
    })

    return () => {
      active = false
    }
  }, [])

  const handleLeagueCreated = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-app-canvas">
      <header className="sticky top-0 z-30 border-b border-app-border bg-app-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4.5rem] max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--app-radius-sm)] bg-app-brand text-sm font-black tracking-tight text-white">
            FL
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-app-text sm:text-lg">
              Fantasy League Manager
            </p>
            <p className="hidden text-xs font-medium text-app-text-muted sm:block">
              Leagues, scores, dues, and payouts
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <span aria-hidden="true" className="text-lg leading-none">+</span>
              <span className="hidden sm:inline">Create league</span>
              <span className="sm:hidden">League</span>
            </Button>
          )}
          {authChecked && (
            <AdminLogin
              isAdmin={isAdmin}
              onAuthChange={(authorized) => {
                setIsAdmin(authorized)
                if (!authorized) setIsCreateModalOpen(false)
              }}
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {!authChecked ? (
          <SkeletonGroup label="Checking commissioner access">
            <Skeleton className="h-52 bg-app-surface" />
          </SkeletonGroup>
        ) : isAdmin ? (
          <>
            <div className="mb-7 sm:mb-9">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-app-brand">
                Your leagues
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-app-text sm:text-4xl">
                League dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-muted sm:text-base">
                Track every league&apos;s season progress, score imports, dues, and anything that needs your attention.
              </p>
            </div>

            <LeaguesList
              onCreateLeague={() => setIsCreateModalOpen(true)}
              refresh={refreshKey}
            />
          </>
        ) : (
          <Card className="mx-auto max-w-lg p-6 text-center sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-app-brand-soft text-app-brand">
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12v10H6z" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-app-text">
              Commissioner access
            </h1>
            <p className="mt-2 text-sm leading-6 text-app-text-muted">
              Sign in to open the league portfolio or create a new league. Players can continue using their shared league link.
            </p>
            <div className="mx-auto mt-5 max-w-xs rounded-[var(--app-radius-sm)] border border-app-border p-1">
              <AdminLogin
                display="menu"
                isAdmin={false}
                onAuthChange={setIsAdmin}
              />
            </div>
          </Card>
        )}
      </main>

      <CreateLeagueModal
        isOpen={isAdmin && isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onLeagueCreated={handleLeagueCreated}
      />

    </div>
  )
}
