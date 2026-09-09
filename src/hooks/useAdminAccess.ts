'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AUTH_CHANGE_STORAGE_KEY, checkAdminAuth } from '@/lib/adminAuth'
import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'

/** Recheck cookie-backed access when returning to the app or changing it in another tab. */
export function useAdminAccess() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const currentAccess = useRef(false)
  const requestVersion = useRef(0)

  const applyAccess = useCallback((authenticated: boolean) => {
    if (currentAccess.current !== authenticated) {
      invalidateLeagueReadCache()
      invalidateFinanceCache()
    }
    currentAccess.current = authenticated
    setIsAdmin(authenticated)
    setAuthChecked(true)
  }, [])

  const setAuthenticated = useCallback((authenticated: boolean) => {
    requestVersion.current += 1
    applyAccess(authenticated)
  }, [applyAccess])

  useEffect(() => {
    const check = async () => {
      const version = ++requestVersion.current
      const authenticated = await checkAdminAuth()
      if (version === requestVersion.current) applyAccess(authenticated)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_CHANGE_STORAGE_KEY) void check()
    }
    void check()
    window.addEventListener('focus', check)
    window.addEventListener('storage', onStorage)
    return () => {
      requestVersion.current += 1
      window.removeEventListener('focus', check)
      window.removeEventListener('storage', onStorage)
    }
  }, [applyAccess])

  return { authChecked, isAdmin, setAuthenticated }
}
