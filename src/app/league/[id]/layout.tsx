'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface LeagueLayoutProps {
  children: ReactNode
  params: Promise<{
    id: string
  }>
}

export default function LeagueLayout({ children }: LeagueLayoutProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  useEffect(() => {
    // Check if we're in view-only mode (either /view path or ?readonly=true)
    const isViewOnlyPath = pathname.includes('/view')
    const isReadOnlyParam = searchParams.get('readonly') === 'true'
    const leagueId = pathname.split('/')[2]
    
    if (isReadOnlyParam || isViewOnlyPath) {
      // Set readonly mode in localStorage
      localStorage.setItem('fantasy-readonly-mode', 'true')
      localStorage.setItem('fantasy-readonly-league', leagueId)
    } else {
      // Clear readonly mode if not explicitly set and on the same league
      const storedLeagueId = localStorage.getItem('fantasy-readonly-league')
      if (storedLeagueId === leagueId) {
        localStorage.removeItem('fantasy-readonly-mode')
        localStorage.removeItem('fantasy-readonly-league')
      }
    }
  }, [pathname, searchParams, router])

  return <>{children}</>
}