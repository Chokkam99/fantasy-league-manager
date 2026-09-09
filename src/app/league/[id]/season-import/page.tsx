'use client'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ESPNSeasonImport } from '@/components/league/ESPNSeasonImport'
import { LeagueUnavailable } from '@/components/league/LeagueUnavailable'
import { useLeagueShell } from '@/components/league/LeagueShellContext'
import { Notice } from '@/components/ui/Notice'

export default function SeasonImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { league, isLeagueLoading, leagueLoadError, reloadLeague, isAdmin, selectedSeason } = useLeagueShell()
  if (isLeagueLoading) return <main className="p-6" role="status">Loading season import…</main>
  if (!league) return <LeagueUnavailable error={leagueLoadError} onRetry={reloadLeague} />
  if (!isAdmin || league.archived_at) return <main className="p-6"><Notice tone="info">Only the commissioner can import season data for an active league.</Notice></main>
  return <ESPNSeasonImport leagueId={id} requestedSeason={selectedSeason} onCancel={() => router.push(`/league/${id}/players?season=${selectedSeason}`)} onImported={async season => {
    await reloadLeague()
    router.replace(`/league/${id}/players?season=${season}`)
  }} />
}
