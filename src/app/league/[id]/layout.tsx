'use client'

import { use, type ReactNode } from 'react'
import LeagueShell from '@/components/league/LeagueShell'

interface LeagueLayoutProps {
  children: ReactNode
  params: Promise<{
    id: string
  }>
}

export default function LeagueLayout({ children, params }: LeagueLayoutProps) {
  const { id } = use(params)

  return <LeagueShell leagueId={id}>{children}</LeagueShell>
}
