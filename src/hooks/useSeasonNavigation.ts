'use client'
import { useEffect, useState } from 'react'
import { loadLeagueView, LEAGUE_DATA_CHANGED } from '@/lib/leagueReadClient'
import type { SeasonNavigationSnapshot } from '@/lib/seasonNavigation'

export function useSeasonNavigation(leagueId: string, season: string, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<{ leagueId: string; value: SeasonNavigationSnapshot } | null>(null)
  useEffect(() => {
    if (!enabled || !leagueId || !season) return
    let active = true
    let version = 0
    const refresh = async (force = false) => {
      const request = ++version
      try {
        const next = await loadLeagueView<SeasonNavigationSnapshot>(leagueId, 'navigation', { season, force })
        if (active && version === request) setSnapshot({ leagueId, value: next })
      } catch {
        if (active && version === request) setSnapshot(null)
      }
    }
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ leagueId?: string; season?: string }>).detail
      if (detail?.leagueId && detail.leagueId !== leagueId) return
      if (detail?.season && detail.season !== season) return
      void refresh()
    }
    void refresh()
    window.addEventListener(LEAGUE_DATA_CHANGED, changed)
    const focused = () => { void refresh(true) }
    window.addEventListener('focus', focused)
    return () => { active = false; window.removeEventListener(LEAGUE_DATA_CHANGED, changed); window.removeEventListener('focus', focused) }
  }, [enabled, leagueId, season])
  return enabled && snapshot?.leagueId === leagueId && snapshot.value?.season === season ? snapshot.value : null
}
