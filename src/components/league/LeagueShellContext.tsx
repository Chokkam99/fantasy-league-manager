'use client'

import { createContext, useContext } from 'react'
import type { League } from '@/lib/supabase'

export interface LeagueShellContextValue {
  availableSeasons: string[]
  isAdmin: boolean
  isLeagueLoading: boolean
  isViewOnly: boolean
  league: League | null
  leagueLoadError: string | null
  leagueId: string
  reloadLeague: () => Promise<void>
  selectedSeason: string
  shareToken: string
}

export const LeagueShellContext = createContext<LeagueShellContextValue | null>(null)

export function useLeagueShell() {
  const context = useContext(LeagueShellContext)

  if (!context) {
    throw new Error('useLeagueShell must be used inside LeagueShell')
  }

  return context
}
