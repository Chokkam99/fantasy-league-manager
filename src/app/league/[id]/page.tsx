'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, League, LeagueMember } from '@/lib/supabase'
import ShareButton from '@/components/ShareButton'
import SeasonSelector from '@/components/SeasonSelector'
import PlayerParticipationHistory from '@/components/PlayerParticipationHistory'
import AdminLogin from '@/components/AdminLogin'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'
import { checkAdminAuth } from '@/lib/adminAuth'

interface LeagueDetailsProps {
  params: Promise<{
    id: string
  }>
}

export default function LeagueDetails({ params }: LeagueDetailsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = use(params)
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedSeason, setSelectedSeason] = useState<string>(searchParams.get('season') || '')
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([])
  const [isViewOnly, setIsViewOnly] = useState(true) // Default to view-only
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Use season config hook for dynamic values
  const { seasonConfig } = useSeasonConfig(resolvedParams.id, selectedSeason)

  // Check for admin authentication and view-only mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // First check for explicit readonly mode
      const isReadOnly = localStorage.getItem('fantasy-readonly-mode') === 'true'
      const readOnlyLeague = localStorage.getItem('fantasy-readonly-league')
      const urlReadOnly = searchParams.get('readonly') === 'true'
      
      // Set readonly mode if URL parameter is present
      if (urlReadOnly) {
        localStorage.setItem('fantasy-readonly-mode', 'true')
        localStorage.setItem('fantasy-readonly-league', resolvedParams.id)
        setIsViewOnly(true)
        setIsAdmin(false) // Force non-admin in view-only mode
      } else if (isReadOnly && readOnlyLeague === resolvedParams.id) {
        setIsViewOnly(true)
        setIsAdmin(false) // Force non-admin in view-only mode
      } else {
        // Only check admin auth if not in view-only mode
        const adminAuthenticated = checkAdminAuth()
        setIsAdmin(adminAuthenticated)
        setIsViewOnly(!adminAuthenticated)
      }
    }
  }, [resolvedParams.id, searchParams])

  const fetchLeagueData = useCallback(async () => {
    try {
      // Fetch league details
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (leagueError) {
        console.error('Failed to fetch league:', leagueError.message)
        throw new Error(`Failed to fetch league: ${leagueError.message || 'Unknown error'}`)
      }

      setLeague(leagueData)

      // Set selected season to current season if not set
      const currentSeason = selectedSeason || leagueData.current_season
      if (!selectedSeason) {
        setSelectedSeason(currentSeason)
      }

      // Fetch available seasons
      const { data: seasonsData } = await supabase
        .from('league_members')
        .select('season')
        .eq('league_id', resolvedParams.id)
      
      const seasons = [...new Set(seasonsData?.map(s => s.season).filter(Boolean) || [])]
      setAvailableSeasons(seasons)


      // Fetch league members for selected season
      let { data: membersData, error: membersError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', resolvedParams.id)
        .eq('season', currentSeason)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      // If league_members fails, try members table as fallback
      if (membersError) {
        const { data: altMembersData, error: altMembersError } = await supabase
          .from('members')
          .select('*')
          .eq('league_id', resolvedParams.id)
          .order('updated_at', { ascending: false })
        
        if (!altMembersError) {
          membersData = altMembersData
          membersError = altMembersError
        }
      }

      if (membersError) {
        console.error('Could not fetch members:', membersError.message)
      }

      setMembers(membersData || [])
    } catch (err) {
      console.error('Error fetching league data:', err)
      // Don't redirect immediately, let user see the error
      // router.push('/')
    } finally {
      setIsLoading(false)
    }
  }, [resolvedParams.id, selectedSeason])


  const handleSeasonChange = (season: string) => {
    setSelectedSeason(season)
    setRefreshKey(prev => prev + 1)
    // Update URL to reflect season change
    const currentPath = window.location.pathname
    const urlParams = new URLSearchParams()
    urlParams.set('season', season)
    router.replace(`${currentPath}?${urlParams.toString()}`)
  }


  const handleAdminAuthChange = (authenticated: boolean) => {
    setIsAdmin(authenticated)
    
    if (authenticated) {
      // When logging in as admin, clear readonly mode and switch to edit mode
      localStorage.removeItem('fantasy-readonly-mode')
      localStorage.removeItem('fantasy-readonly-league')
      setIsViewOnly(false)
    } else {
      // When logging out, switch back to view-only mode
      setIsViewOnly(true)
    }
  }

  useEffect(() => {
    fetchLeagueData()
  }, [fetchLeagueData, refreshKey])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-gray-600">Loading league details...</div>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-red-600">League not found</div>
      </div>
    )
  }

  const totalMembers = members.length
  const paidMembers = members.filter(m => m.payment_status === 'paid').length
  const feeAmount = seasonConfig?.fee_amount ?? 0
  const totalCollected = paidMembers * feeAmount
  const totalPossible = totalMembers * feeAmount

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isViewOnly && (
              <button
                onClick={() => router.push('/')}
                className="text-claude-text-secondary hover:text-claude-text"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-claude-text cursor-pointer hover:text-claude-text-secondary transition-colors" onClick={() => {
                  const urlParams = new URLSearchParams()
                  urlParams.set('season', selectedSeason)
                  if (isViewOnly) {
                    urlParams.set('readonly', 'true')
                  }
                  router.push(`/league/${resolvedParams.id}?${urlParams.toString()}`)
                }}>
                  {league.name}
                </h1>
                {isViewOnly && (
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                    🔍 View Only
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <SeasonSelector
                  currentSeason={selectedSeason}
                  onSeasonChange={handleSeasonChange}
                  availableSeasons={availableSeasons}
                  disabled={false}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AdminLogin 
              isAdmin={isAdmin} 
              onAuthChange={handleAdminAuthChange} 
            />
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white text-claude-text shadow-sm"
              >
                Home
              </button>
              <button
                onClick={() => {
                  const urlParams = new URLSearchParams()
                  urlParams.set('season', selectedSeason)
                  if (isViewOnly) {
                    urlParams.set('readonly', 'true')
                  }
                  router.push(`/league/${resolvedParams.id}/standings?${urlParams.toString()}`)
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-claude-text-secondary hover:text-claude-text hover:bg-white"
              >
                Standings
              </button>
              <button
                onClick={() => {
                  const urlParams = new URLSearchParams()
                  urlParams.set('season', selectedSeason)
                  if (isViewOnly) {
                    urlParams.set('readonly', 'true')
                  }
                  router.push(`/league/${resolvedParams.id}/scores?${urlParams.toString()}`)
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-claude-text-secondary hover:text-claude-text hover:bg-white"
              >
                Weekly Scores
              </button>
              <button
                onClick={() => {
                  const urlParams = new URLSearchParams()
                  urlParams.set('season', selectedSeason)
                  if (isViewOnly) {
                    urlParams.set('readonly', 'true')
                  }
                  router.push(`/league/${resolvedParams.id}/players?${urlParams.toString()}`)
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-claude-text-secondary hover:text-claude-text hover:bg-white"
              >
                Players
              </button>
            </div>
            <ShareButton 
              shareUrl={`${window.location.origin}/league/${resolvedParams.id}?readonly=true&season=${selectedSeason}`}
              label="Share League"
              className="text-sm"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-claude-surface p-4 rounded-lg border border-claude-border">
            <h3 className="text-xs font-medium text-claude-text-secondary mb-1">Total Members</h3>
            <p className="text-2xl font-bold text-claude-text">{totalMembers}</p>
          </div>
          <div className="bg-claude-surface p-4 rounded-lg border border-claude-border">
            <h3 className="text-xs font-medium text-claude-text-secondary mb-1">Paid Members</h3>
            <p className="text-2xl font-bold text-claude-success">{paidMembers}</p>
          </div>
          <div className="bg-claude-surface p-4 rounded-lg border border-claude-border">
            <h3 className="text-xs font-medium text-claude-text-secondary mb-1">League Fee</h3>
            <p className="text-2xl font-bold text-claude-text">${feeAmount}</p>
          </div>
          <div className="bg-claude-surface p-4 rounded-lg border border-claude-border">
            <h3 className="text-xs font-medium text-claude-text-secondary mb-1">Prize Pool</h3>
            <p className="text-2xl font-bold text-claude-primary">${totalCollected}</p>
            <p className="text-xs text-claude-text-light">of ${totalPossible}</p>
          </div>
        </div>

        {/* Payout Structure */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">💰 Payout Structure</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Total Pot */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-800">Total Collection</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Entry Fees ({totalMembers} × ${feeAmount})</span>
                  <span className="font-medium">${totalPossible}</span>
                </div>
                {(seasonConfig?.draft_food_cost || 0) > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Draft Food (already spent)</span>
                    <span>-${seasonConfig?.draft_food_cost}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Available Prize Pool</span>
                  <span className="text-green-600">${totalPossible - (seasonConfig?.draft_food_cost || 0)}</span>
                </div>
              </div>
            </div>

            {/* Prize Breakdown */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-800">Prize Distribution</h3>
              <div className="space-y-2 text-sm">
                {seasonConfig && (
                  <>
                    {seasonConfig.weekly_prize_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Weekly Top Scorer ({seasonConfig.total_weeks} weeks × ${seasonConfig.weekly_prize_amount})</span>
                        <span>${seasonConfig.total_weeks * seasonConfig.weekly_prize_amount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>1st Place</span>
                      <span>${seasonConfig.prize_structure.first}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>2nd Place</span>
                      <span>${seasonConfig.prize_structure.second}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>3rd Place</span>
                      <span>${seasonConfig.prize_structure.third}</span>
                    </div>
                    {(seasonConfig.prize_structure.fourth || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>4th Place</span>
                        <span>${seasonConfig.prize_structure.fourth}</span>
                      </div>
                    )}
                    {(seasonConfig.prize_structure.highest_points || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Highest Points For</span>
                        <span>${seasonConfig.prize_structure.highest_points}</span>
                      </div>
                    )}
                    {(seasonConfig.prize_structure.highest_weekly || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Highest Weekly Score</span>
                        <span>${seasonConfig.prize_structure.highest_weekly}</span>
                      </div>
                    )}
                    {(seasonConfig.prize_structure.lowest_weekly || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Lowest Weekly Score</span>
                        <span>${seasonConfig.prize_structure.lowest_weekly}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Total Prizes</span>
                      <span>${
                        (seasonConfig.weekly_prize_amount > 0 ? seasonConfig.total_weeks * seasonConfig.weekly_prize_amount : 0) +
                        seasonConfig.prize_structure.first +
                        seasonConfig.prize_structure.second +
                        seasonConfig.prize_structure.third +
                        (seasonConfig.prize_structure.fourth || 0) +
                        (seasonConfig.prize_structure.highest_points || 0) +
                        (seasonConfig.prize_structure.highest_weekly || 0) +
                        (seasonConfig.prize_structure.lowest_weekly || 0)
                      }</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Player Participation History */}
        <PlayerParticipationHistory leagueId={resolvedParams.id} />

        {/* Member management moved to dedicated page */}
      </main>

    </div>
  )
}