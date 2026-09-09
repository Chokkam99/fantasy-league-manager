'use client'

import { useRouter } from 'next/navigation'
import AdminLogin from '@/components/AdminLogin'
import LeaguesList from '@/components/LeaguesList'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { BrandMark, FieldArtwork } from '@/components/ui/BrandMark'
import { useAdminAccess } from '@/hooks/useAdminAccess'

export default function Home() {
  const router = useRouter()
  const { authChecked, isAdmin, setAuthenticated: setIsAdmin } = useAdminAccess()

  return (
    <div className="flex flex-1 flex-col bg-app-canvas">
      <header className="sticky top-0 z-30 border-b border-app-border bg-app-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4.5rem] max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <BrandMark />
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-base font-bold text-app-text sm:text-lg">
              Fantasy League Manager
            </p>
              <p className="text-xs font-medium text-app-text-muted">
              The home of your league
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => router.push('/league/new')}>
              <span aria-hidden="true" className="text-lg leading-none">+</span>
              <span>New league</span>
            </Button>
          )}
          {authChecked && isAdmin && (
            <AdminLogin
              isAdmin={isAdmin}
              onAuthChange={(authorized) => {
                setIsAdmin(authorized)
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
              <p className="section-kicker">Commissioner workspace</p>
              <h1 className="editorial-title mt-2 text-2xl text-app-text sm:text-4xl">
                League dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-muted sm:text-base">
                Track every league&apos;s season progress, score imports, dues, and anything that needs your attention.
              </p>
            </div>

            <LeaguesList
              onCreateLeague={() => router.push('/league/new')}
            />
          </div>
        ) : (
          <div className="w-full">
            <section className="grid items-center gap-8 py-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.8fr)] lg:gap-16 lg:py-8">
              <div className="min-w-0">
                <p className="section-kicker flex items-center gap-3"><span className="h-px w-8 bg-app-brand" aria-hidden="true" /> For the love of the league</p>
                <h1 className="editorial-title mt-5 max-w-xl text-[2rem] leading-[1.1] text-app-text sm:text-[3.5rem]">Keep every league in one place.</h1>
                <p className="mt-5 max-w-md text-sm leading-7 text-app-text-muted sm:text-base">Sunday rivalries. Season-long stories. A home for the scores, dues, and bragging rights that bring your league together.</p>
                <div className="season-banner relative mt-7 overflow-hidden rounded-2xl p-5 sm:p-7">
                  <FieldArtwork className="absolute -right-12 -top-14 h-64 w-96 rotate-[-20deg] text-app-lime/15" />
                  <p className="relative text-[10px] font-semibold uppercase tracking-[0.18em] text-app-lime">Built for the long game</p>
                  <p className="editorial-title relative mt-3 max-w-[14rem] text-2xl leading-tight text-white">Good leagues deserve<br />a great home.</p>
                  <p className="relative mt-5 text-xs text-white/60">Every player. Every payout. Every season.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-[var(--app-shadow-md)] sm:p-8">
                <div aria-hidden="true" className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-app-brand-soft text-lg text-app-brand">↗</div>
                <p className="section-kicker">Commissioner access</p>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-app-text">Welcome to the office.</h2>
                <p className="mt-2 text-sm leading-6 text-app-text-muted">Your leagues are ready when you are.</p>
                <div className="mt-6"><AdminLogin display="panel" isAdmin={false} onAuthChange={setIsAdmin} /></div>
                <div className="mt-6 border-t border-app-border pt-5">
                  <p className="text-xs font-semibold text-app-text">Here to follow your league?</p>
                  <p className="mt-1 text-xs leading-5 text-app-text-muted">Open the league link your commissioner shared. No sign-in needed.</p>
                </div>
              </div>
            </section>
            <div className="mt-8 grid gap-6 border-t border-app-border pt-6 sm:grid-cols-3">
              {[
                ['01', 'Follow the competition', 'Weekly results and the playoff picture, always in reach.'],
                ['02', 'Make the money clear', 'Entry fees, prize plans, and payouts in one place.'],
                ['03', 'Keep the history', 'The champions, the teams, and every season together.'],
              ].map(([number, title, detail]) => (
                <div className="flex items-start gap-4" key={number}>
                  <span className="pt-0.5 font-mono text-xs text-app-brand">{number}</span>
                  <div><h3 className="text-sm font-semibold text-app-text">{title}</h3><p className="mt-1 text-xs leading-5 text-app-text-muted">{detail}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

    </div>
  )
}
