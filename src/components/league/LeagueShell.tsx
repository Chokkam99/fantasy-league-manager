'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSeasonNavigation } from '@/hooks/useSeasonNavigation'
import { navigationOrder, mobileNavigation } from '@/lib/seasonNavigation'
import SeasonSelector from '@/components/SeasonSelector'
import ShareButton from '@/components/ShareButton'
import {
  hasConfiguredLeagueSeason,
  type League,
} from '@/lib/supabase'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { cn } from '@/lib/cn'
import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'
import { loadLeagueShellData } from '@/lib/leagueShellClient'
import { LeagueShellContext } from './LeagueShellContext'
import LeagueActionsMenu from './LeagueActionsMenu'
import { BrandMark } from '@/components/ui/BrandMark'

interface LeagueShellProps {
  children: ReactNode
  leagueId: string
}

type NavigationKey =
  | 'overview'
  | 'standings'
  | 'scores'
  | 'prizes'
  | 'players'
  | 'rules'

const navigation: Array<{
  key: NavigationKey
  label: string
  mobile: boolean
  segment?: string
}> = [
  { key: 'overview', label: 'Overview', mobile: true },
  { key: 'standings', label: 'Standings', mobile: true, segment: 'standings' },
  { key: 'scores', label: 'Scores', mobile: true, segment: 'scores' },
  { key: 'prizes', label: 'Prizes', mobile: true, segment: 'prizes' },
  { key: 'players', label: 'Players', mobile: false, segment: 'players' },
  { key: 'rules', label: 'Rules', mobile: false, segment: 'rules' },
]

type IconKey = NavigationKey | 'settings' | 'new-season' | 'back'

function NavigationIcon({ item }: { item: IconKey }) {
  const paths: Record<IconKey, ReactNode> = {
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
    'new-season': <path d="M12 3v18M3 12h18" />,
    back: <path d="m10 5-7 7 7 7M3 12h18" />,
    overview: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10.5V20h13v-9.5" />
      </>
    ),
    standings: (
      <>
        <path d="M5 20v-6h4v6" />
        <path d="M10 20V9h4v11" />
        <path d="M15 20V4h4v16" />
      </>
    ),
    scores: (
      <>
        <path d="M6 4h12v16H6z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    prizes: (
      <>
        <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4" />
        <path d="M12 13v4M8.5 20h7M10 17h4" />
      </>
    ),
    players: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.5a3 3 0 0 1 0 5.5M17 14a5 5 0 0 1 3.5 4.8" />
      </>
    ),
    rules: (
      <>
        <path d="M6 3h12v18H6z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[item]}
    </svg>
  )
}

export default function LeagueShell({ children, leagueId }: LeagueShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [league, setLeague] = useState<League | null>(null)
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([])
  const [archivedSeasons, setArchivedSeasons] = useState<string[]>([])
  const { authChecked, isAdmin, setAuthenticated: setIsAdmin } = useAdminAccess()
  const requestVersion = useRef(0)
  const [isLeagueLoading, setIsLeagueLoading] = useState(true)
  const [leagueLoadError, setLeagueLoadError] = useState<string | null>(null)

  const isSeasonSetup = pathname.endsWith('/season-setup') || pathname.endsWith('/season-import')
  const requestedSeason = searchParams.get('season') || ''
  const shareToken = searchParams.get('share') || ''
  const selectedSeason = requestedSeason || league?.current_season || ''
  const isSelectedSeasonArchived = archivedSeasons.includes(selectedSeason)
  const isViewOnly =
    Boolean(shareToken) ||
    !isAdmin ||
    Boolean(league?.archived_at) ||
    isSelectedSeasonArchived

  const seasonNavigation = useSeasonNavigation(leagueId, selectedSeason, isAdmin && !isViewOnly)
  const orderedKeys = navigationOrder(seasonNavigation?.phase, isAdmin && !isViewOnly)
  const orderedNavigation = orderedKeys.map(key => navigation.find(item => item.key === key)!)
  const mobileKeys = mobileNavigation(orderedKeys, isAdmin && !isViewOnly, seasonNavigation?.phase)
  const duesRemaining = seasonNavigation?.duesRemaining || 0

  const loadLeagueContext = useCallback(async () => {
      const version = ++requestVersion.current
      setIsLeagueLoading(true)
      setLeagueLoadError(null)

      const { leagueResult, seasonsResult } = await loadLeagueShellData(
        leagueId,
        undefined,
        { season: requestedSeason || undefined, shareToken: shareToken || undefined },
      )
      if (version !== requestVersion.current) return
      const { data: leagueData, error: leagueError } = leagueResult
      const { data: seasonsData, error: seasonsError } = seasonsResult

      if (leagueError) {
        console.error('Failed to load league shell:', leagueError)
        setLeague(null)
        setAvailableSeasons([])
        setArchivedSeasons([])
        if (leagueError.code !== 'PGRST116') {
          setLeagueLoadError('The league service could not be reached.')
        }
        setIsLeagueLoading(false)
        return
      }

      if (!leagueData || !hasConfiguredLeagueSeason(leagueData)) {
        setLeague(null)
        setAvailableSeasons([])
        setArchivedSeasons([])
        setLeagueLoadError('This league does not have a valid active season.')
        setIsLeagueLoading(false)
        return
      }

      setLeague(leagueData)
      const seasonRecords = (seasonsData || []) as Array<{
        archived_at?: string | null
        season: string
      }>
      setAvailableSeasons([
        ...new Set(
          seasonRecords
            .map((seasonRecord) => seasonRecord.season)
            .filter(Boolean),
        ),
      ])
      setArchivedSeasons(
        seasonRecords
          .filter((seasonRecord) => seasonRecord.archived_at)
          .map((seasonRecord) => seasonRecord.season)
          .filter(Boolean),
      )
      if (seasonsError) {
        console.error('Failed to load league seasons:', seasonsError)
        setLeagueLoadError('The season list could not be loaded.')
      }
      setIsLeagueLoading(false)
  }, [leagueId, requestedSeason, shareToken])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadLeagueContext()
    }, 0)

    return () => { window.clearTimeout(loadTimer); requestVersion.current += 1 }
  }, [loadLeagueContext])

  useEffect(() => {
    if (!league || requestedSeason) return

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('season', league.current_season)
    router.replace(`${pathname}?${nextParams.toString()}`)
  }, [league, pathname, requestedSeason, router, searchParams])

  const activeItem = useMemo<NavigationKey | null>(() => {
    if (isSeasonSetup || pathname.endsWith('/settings')) return null
    if (pathname.endsWith('/standings')) return 'standings'
    if (pathname.endsWith('/scores')) return 'scores'
    if (pathname.endsWith('/prizes')) return 'prizes'
    if (pathname.endsWith('/players')) return 'players'
    if (pathname.endsWith('/rules')) return 'rules'
    return 'overview'
  }, [pathname, isSeasonSetup])

  const buildHref = (segment?: string, preserveShare = true) => {
    const params = new URLSearchParams()
    if (selectedSeason) params.set('season', selectedSeason)
    if (shareToken && preserveShare) params.set('share', shareToken)
    const path = `/league/${leagueId}${segment ? `/${segment}` : ''}`
    const query = params.toString()
    return query ? `${path}?${query}` : path
  }

  const handleSeasonChange = (season: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('season', season)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleAdminAuthChange = (authenticated: boolean) => {
    invalidateLeagueReadCache(leagueId)
    invalidateFinanceCache(leagueId)
    setIsAdmin(authenticated)

    if (authenticated) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('share')
      router.replace(`${pathname}?${params.toString()}`)
    }
  }

  const shellContext = useMemo(
    () => ({
      availableSeasons,
      isAdmin,
      isLeagueLoading: isLeagueLoading || !authChecked,
      isViewOnly,
      league,
      leagueLoadError,
      leagueId,
      reloadLeague: loadLeagueContext,
      selectedSeason,
      shareToken,
    }),
    [
      availableSeasons,
      authChecked,
      isAdmin,
      isLeagueLoading,
      isViewOnly,
      league,
      leagueLoadError,
      leagueId,
      loadLeagueContext,
      selectedSeason,
      shareToken,
    ],
  )

  return (
    <LeagueShellContext.Provider value={shellContext}>
      <div className="min-h-screen bg-app-canvas pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0 xl:pl-[236px]" data-league-shell>
      <span className="sr-only" id="season-dues-summary">{duesRemaining} {duesRemaining === 1 ? 'player has' : 'players have'} dues remaining.</span>
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-app-surface focus:p-4" href="#league-content">Skip to content</a>
      <aside className="league-rail fixed inset-y-0 left-0 z-50 hidden w-[236px] flex-col overflow-y-auto px-5 py-7 xl:flex" aria-label="League workspace">
        <Link href="/" className="flex items-center gap-3 px-1" aria-label="All leagues">
          <BrandMark light />
          <span className="text-sm font-bold leading-tight tracking-tight">LEAGUE<span className="block font-normal tracking-[0.22em] text-white/60">OFFICE</span></span>
        </Link>
        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Your season</p>
          <nav aria-label="League" className="mt-3 space-y-1">
            {orderedNavigation.map((item) => (
              <Link aria-current={item.key === activeItem ? 'page' : undefined} className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-white/10" aria-describedby={item.key === 'players' && duesRemaining > 0 ? 'season-dues-summary' : undefined}
                  href={buildHref(item.segment)} key={item.key}>
                <NavigationIcon item={item.key} />
                {item.key === 'players' && isAdmin ? 'Players & dues' : item.label}
                {item.key === 'players' && duesRemaining > 0 && <span className="rounded-full bg-app-warning-soft px-1.5 text-[10px] font-bold text-app-warning" aria-hidden="true" title={`${duesRemaining} ${duesRemaining === 1 ? 'player has' : 'players have'} dues remaining`}>{duesRemaining}</span>}
                {item.key === activeItem && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />}
              </Link>
            ))}
          </nav>
        </div>
        {isAdmin && (
          <div className="mt-7 border-t border-white/10 pt-5">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Commissioner</p>
            <Link aria-current={pathname.endsWith('/settings') ? 'page' : undefined} className="mt-3 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-white/10" href={buildHref('settings', false)}><NavigationIcon item="settings" /> Settings</Link>
            <Link aria-current={pathname.endsWith('/season-setup') ? 'page' : undefined} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-white/10" href={buildHref('season-setup', false)}><NavigationIcon item="new-season" /> New season</Link>
          </div>
        )}
        <div className="mt-auto pt-10">
          <div className="rounded-xl border border-white/10 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-lime">The long game</span>
            <p className="mt-2 text-sm leading-6 text-white/75">One league. Every season.<br />All the bragging rights.</p>
          </div>
          <Link href="/" className="mt-4 flex min-h-11 items-center gap-2 px-3 text-xs text-white/60 hover:text-white"><NavigationIcon item="back" /> Back to all leagues</Link>
        </div>
      </aside>
      <header className="sticky top-0 z-40 border-b border-app-border bg-app-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4.5rem] max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-6 xl:px-10">
          <Link
            aria-label="All leagues"
            className="hidden shrink-0 sm:flex xl:hidden"
            href="/"
          >
            <BrandMark />
          </Link>

          <div className="min-w-0 flex-1">
            <Link
              className="flex min-h-11 items-center truncate text-base font-bold text-app-text sm:block sm:min-h-0 sm:text-lg"
              href={buildHref()}
            >
              {league?.name || 'League office'}
            </Link>
            <p className="mt-0.5 hidden text-[11px] font-medium text-app-text-muted sm:block">
              {isSeasonSetup ? 'ESPN season import' : isViewOnly ? 'League clubhouse' : seasonNavigation?.phase === 'preseason' ? 'Preseason · Build your roster and collect dues' : seasonNavigation?.phase === 'wrap-up' ? 'Season wrap-up · Settle prizes' : 'Commissioner workspace'} <span aria-hidden="true" className="mx-1.5">/</span> {(isSeasonSetup ? league?.current_season : selectedSeason) || 'Season'}
            </p>
          </div>

          {!isSeasonSetup && <SeasonSelector
            availableSeasons={availableSeasons}
            className="shrink-0"
            currentSeason={selectedSeason}
            disabled={isLeagueLoading || !selectedSeason}
            onSeasonChange={handleSeasonChange}
            showLabel={false}
          />}
          {isSeasonSetup && <span className="shrink-0 rounded-full bg-app-brand-soft px-3 py-1.5 text-xs font-semibold text-app-brand">{pathname.endsWith('/season-import') ? 'Import season' : 'New season'}</span>}

          {isAdmin && selectedSeason && (
            <ShareButton
              className="hidden shrink-0 sm:flex"
              leagueId={leagueId}
            />
          )}
          <LeagueActionsMenu
            isAdmin={isAdmin}
            duesRemaining={duesRemaining}
            leagueId={leagueId}
            onAuthChange={handleAdminAuthChange}
            playersUrl={buildHref('players')}
            rulesUrl={buildHref('rules')}
            seasonImportUrl={buildHref('season-import', false)}
            seasonSetupUrl={buildHref('season-setup', false)}
            settingsUrl={buildHref('settings', false)}
          />
        </div>

        <nav aria-label="League" className="mx-auto hidden max-w-6xl px-6 md:block xl:hidden">
          <div className="flex gap-1">
            {orderedNavigation.map((item) => {
              const isActive = item.key === activeItem
              return (
                <Link
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors',
                    isActive
                      ? 'border-app-brand text-app-brand'
                      : 'border-transparent text-app-text-muted hover:border-app-border hover:text-app-text',
                  )}
                  aria-describedby={item.key === 'players' && duesRemaining > 0 ? 'season-dues-summary' : undefined}
                  href={buildHref(item.segment)}
                  key={item.key}
                >
                  <NavigationIcon item={item.key} />
                  {item.key === 'players' && isAdmin ? 'Players & dues' : item.label}
                {item.key === 'players' && duesRemaining > 0 && <span className="rounded-full bg-app-warning-soft px-1.5 text-[10px] font-bold text-app-warning" aria-hidden="true" title={`${duesRemaining} ${duesRemaining === 1 ? 'player has' : 'players have'} dues remaining`}>{duesRemaining}</span>}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      {league && leagueLoadError && (
        <div
          className="border-b border-app-warning/30 bg-app-warning-soft px-4 py-3 text-sm text-app-text"
          role="alert"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{leagueLoadError} The current season remains available.</p>
            <button
              className="min-h-10 shrink-0 self-start rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 font-semibold sm:self-auto"
              onClick={() => void loadLeagueContext()}
              type="button"
            >
              Retry season list
            </button>
          </div>
        </div>
      )}

      {league?.archived_at && (
        <div className="border-b border-app-border bg-app-surface-subtle px-4 py-3 text-sm text-app-text" role="status">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p><span className="font-bold">Archived league.</span> History remains readable, and automatic sync is off.</p>
            {isAdmin && (
              <Link className="font-semibold text-app-brand hover:underline" href={buildHref('settings', false)}>
                Open League Settings
              </Link>
            )}
          </div>
        </div>
      )}

      {!isSeasonSetup && !league?.archived_at && isSelectedSeasonArchived && (
        <div className="border-b border-app-border bg-app-surface-subtle px-4 py-3 text-sm text-app-text" role="status">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p><span className="font-bold">Archived {selectedSeason} season.</span> Its historical pages remain readable.</p>
            {isAdmin && (
              <Link className="font-semibold text-app-brand hover:underline" href={buildHref('settings', false)}>
                Restore in League Settings
              </Link>
            )}
          </div>
        </div>
      )}

      <div id="league-content" tabIndex={-1} className="outline-none" key={`${leagueId}:${selectedSeason}:${isAdmin}:${shareToken}`}>{children}</div>

      <nav
        aria-label="League"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-app-border bg-app-surface/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgb(24_33_29_/_0.04)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {orderedNavigation.filter((item) => mobileKeys.includes(item.key)).map((item) => {
            const isActive = item.key === activeItem
            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[0.6875rem] font-semibold transition-colors',
                  isActive
                    ? 'bg-app-brand-soft text-app-brand-strong'
                    : 'text-app-text-muted hover:bg-app-surface-subtle hover:text-app-text',
                )}
                aria-describedby={item.key === 'players' && duesRemaining > 0 ? 'season-dues-summary' : undefined}
                  href={buildHref(item.segment)}
                key={item.key}
              >
                <span className="relative"><NavigationIcon item={item.key} />
                  {item.key === 'players' && duesRemaining > 0 && <span className="absolute -right-4 -top-1 rounded-full bg-app-warning-soft px-1.5 text-[10px] font-bold text-app-warning" aria-hidden="true">{duesRemaining}</span>}
                </span>
                {item.key === 'players' && isAdmin ? 'Players & dues' : item.label}
              </Link>
            )
          })}
        </div>
      </nav>
      </div>
    </LeagueShellContext.Provider>
  )
}
