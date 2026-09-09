'use client'

import { usePathname } from 'next/navigation'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const pathname = usePathname()
  const hasMobileLeagueNavigation = pathname.startsWith('/league/')
  
  return (
    <footer className="mt-auto border-t border-app-border bg-app-canvas">
      <div className={`mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-app-text-muted sm:px-6 md:flex-row md:items-center md:justify-between ${
        hasMobileLeagueNavigation
          ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-4'
          : ''
      }`}>
        <p className="font-semibold text-app-text">Fantasy League Manager</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Made for the long game</span>
          <span aria-hidden="true">·</span>
          <span>© {currentYear}</span>
        </div>
      </div>
    </footer>
  )
}
