'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, League, LeagueMember } from '@/lib/supabase'
import WeeklyScores from '@/components/WeeklyScores'
import ShareButton from '@/components/ShareButton'
import SeasonSelector from '@/components/SeasonSelector'
import PlatformImport from '@/components/PlatformImport'

interface WeeklyScoresPageProps {
  params: Promise<{
    id: string
  }>
}

export default function WeeklyScoresPage({ params }: WeeklyScoresPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = use(params)
  const [selectedSeason, setSelectedSeason] = useState<string>(searchParams.get('season') || '')
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([])
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  // Check for read-only mode on component mount  
  const [isViewOnly, setIsViewOnly] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isReadOnly = localStorage.getItem('fantasy-readonly-mode') === 'true'
      const readOnlyLeague = localStorage.getItem('fantasy-readonly-league')
      const urlReadOnly = searchParams.get('readonly') === 'true'
      
      if ((isReadOnly && readOnlyLeague === resolvedParams.id) || urlReadOnly) {
        setIsViewOnly(true)
        // Set localStorage if coming from URL parameter
        if (urlReadOnly) {
          localStorage.setItem('fantasy-readonly-mode', 'true')
          localStorage.setItem('fantasy-readonly-league', resolvedParams.id)
        }
      }
    }
  }, [resolvedParams.id, searchParams])

  const fetchLeagueData = async () => {
    try {
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (leagueError) {
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

      const { data: primaryMembersData, error: primaryMembersError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', resolvedParams.id)
        .eq('season', currentSeason)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      let membersData = primaryMembersData
      
      if (primaryMembersError) {
        const { data: altMembersData, error: altMembersError } = await supabase
          .from('members')
          .select('*')
          .eq('league_id', resolvedParams.id)
          .order('updated_at', { ascending: false })
        
        if (!altMembersError) {
          membersData = altMembersData
        }
      }

      setMembers(membersData || [])
    } catch (err) {
      console.error('Error fetching league data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const clearAllScores = async () => {
    setIsClearing(true)
    try {
      // First clear all weekly scores
      const { error: scoresError } = await supabase
        .from('weekly_scores')
        .delete()
        .eq('league_id', resolvedParams.id)
        .eq('season', selectedSeason)

      if (scoresError) {
        console.error('Error clearing scores:', scoresError)
        alert('Error clearing scores. Please try again.')
        return
      }

      // Then clear all matchup results for this season
      const { error: matchupError } = await supabase
        .from('matchups')
        .update({
          team1_score: null,
          team2_score: null,
          winner_member_id: null,
          is_tie: false,
          updated_at: new Date().toISOString()
        })
        .eq('league_id', resolvedParams.id)
        .eq('season', selectedSeason)

      if (matchupError) {
        console.error('Error clearing matchup results:', matchupError)
        alert('Error clearing matchup results. Please try again.')
        return
      }

      alert(`All weekly scores and matchup results for ${selectedSeason} season have been cleared successfully!`)
      // The WeeklyScores component will refresh automatically
    } catch (err) {
      console.error('Error clearing season data:', err)
      alert('Error clearing season data. Please try again.')
    } finally {
      setIsClearing(false)
      setShowClearConfirm(false)
    }
  }

  const handleSeasonChange = (season: string) => {
    setSelectedSeason(season)
    // Update URL to reflect season change, preserving readonly parameter if present
    const currentPath = window.location.pathname
    const urlParams = new URLSearchParams()
    urlParams.set('season', season)
    if (isViewOnly) {
      urlParams.set('readonly', 'true')
    }
    router.replace(`${currentPath}?${urlParams.toString()}`)
    // Refetch data when season changes
    fetchLeagueData()
  }

  useEffect(() => {
    fetchLeagueData()
  }, [resolvedParams.id, selectedSeason])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
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

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const urlParams = new URLSearchParams()
                urlParams.set('season', selectedSeason)
                if (isViewOnly) {
                  urlParams.set('readonly', 'true')
                }
                router.push(`/league/${resolvedParams.id}?${urlParams.toString()}`)
              }}
              className="text-claude-text-secondary hover:text-claude-text"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
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
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => {
                  const urlParams = new URLSearchParams()
                  urlParams.set('season', selectedSeason)
                  if (isViewOnly) {
                    urlParams.set('readonly', 'true')
                  }
                  router.push(`/league/${resolvedParams.id}?${urlParams.toString()}`)
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-claude-text-secondary hover:text-claude-text hover:bg-white"
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
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white text-claude-text shadow-sm"
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
            {!isViewOnly && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors border-0"
              >
                Clear All Scores
              </button>
            )}
            <ShareButton 
              shareUrl={`${window.location.origin}/league/${resolvedParams.id}/scores?readonly=true&season=${selectedSeason}`}
              label="Share Scores"
              className="text-sm"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!isViewOnly && (
          <PlatformImport leagueId={resolvedParams.id} season={selectedSeason} />
        )}
        <WeeklyScores leagueId={resolvedParams.id} members={members} season={selectedSeason} readOnly={isViewOnly} />
      </main>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-red-600 mb-4">⚠️ Clear All Weekly Scores</h3>
            <p className="text-gray-700 mb-6">
              This will permanently delete <strong>ALL</strong> weekly scores for the <strong>{selectedSeason}</strong> season from the database. 
              This action cannot be undone.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to continue?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                onClick={clearAllScores}
                disabled={isClearing}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0"
              >
                {isClearing ? 'Clearing...' : 'Yes, Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}