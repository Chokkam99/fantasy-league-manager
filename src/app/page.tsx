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
    <div className="flex flex-1 flex-col bg-app-canvas">
      <header className="sticky top-0 z-30 border-b border-app-border bg-app-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4.5rem] max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--app-radius-sm)] bg-app-brand text-sm font-black tracking-tight text-white">
            FL
          </div>
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-base font-bold text-app-text sm:text-lg">
              Fantasy League Manager
            </p>
              <p className="text-xs font-medium text-app-text-muted">
              Leagues, scores, dues, and payouts
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <span aria-hidden="true" className="text-lg leading-none">+</span>
              <span>New league</span>
            </Button>
          )}
          {authChecked && isAdmin && (
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

      <main className={`mx-auto flex w-full max-w-6xl flex-1 px-4 sm:px-6 ${
        isAdmin ? 'py-8 sm:py-12' : 'items-center py-8 sm:py-12'
      }`}>
        {!authChecked ? (
          <SkeletonGroup className="w-full" label="Checking commissioner access">
            <Skeleton className="mx-auto h-80 w-full max-w-4xl bg-app-surface" />
          </SkeletonGroup>
        ) : isAdmin ? (
          <div className="w-full">
            <div className="mb-7 sm:mb-9">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-app-brand">
                Your leagues
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-app-text sm:text-3xl">
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
          </div>
        ) : (
          <Card className="mx-auto w-full max-w-4xl overflow-hidden">
            <section className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <div className="p-5 sm:p-8 lg:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-brand">
                  Private league office
                </p>
                <h1 className="mt-3 max-w-xl text-2xl font-bold tracking-tight text-app-text sm:text-3xl lg:text-4xl">
                  Keep every league in one place.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-app-text-muted sm:text-base">
                  Scores, standings, dues, and prize money, organized for the commissioner and easy for players to follow.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-app-text">
                  {['Weekly results', 'Playoff picture', 'Money plan'].map((label) => (
                    <span className="inline-flex items-center gap-2" key={label}>
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-app-brand" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-app-border bg-app-surface-subtle/45 p-5 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
                  Commissioner access
                </p>
                <h2 className="mt-1 text-lg font-bold text-app-text">Sign in</h2>
                <div className="mt-4">
                  <AdminLogin
                    display="panel"
                    isAdmin={false}
                    onAuthChange={setIsAdmin}
                  />
                </div>
                <p className="mt-4 text-xs leading-5 text-app-text-muted">
                  Players open the private league link shared with them.
                </p>
              </div>
            </section>
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
