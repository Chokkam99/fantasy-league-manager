'use client'

import { useEffect, useRef } from 'react'
import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'

export const READ_ONLY_REFRESH_MS = 30_000

/** Refresh shared roster/money views without interrupting commissioner edits. */
export function useReadOnlyRefresh({ enabled, leagueId, season, onRefresh }: {
  enabled: boolean
  leagueId: string
  season: string
  onRefresh: () => Promise<unknown>
}) {
  const refreshRef = useRef(onRefresh)
  useEffect(() => { refreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!enabled || !leagueId || !season) return

    const invalidate = () => {
      invalidateLeagueReadCache(leagueId, season)
      invalidateFinanceCache(leagueId, season)
    }
    // The page's initial load follows this effect; do not reuse a prior visit.
    invalidate()
    let active = true
    let pending = false
    let lastRefresh = Date.now()
    const refresh = async () => {
      if (!active || pending || document.visibilityState === 'hidden' || Date.now() - lastRefresh < 5_000) return
      pending = true
      lastRefresh = Date.now()
      invalidate()
      try {
        await refreshRef.current()
      } catch {
        // Page loaders own error presentation. A later refresh can retry.
      } finally {
        pending = false
      }
    }
    const timer = window.setInterval(() => { void refresh() }, READ_ONLY_REFRESH_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled, leagueId, season])
}
