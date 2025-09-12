'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, League } from '@/lib/supabase'
import SeasonSelector from '@/components/SeasonSelector'
import ShareButton from '@/components/ShareButton'
import SeasonBadges from '@/components/SeasonBadges'

interface PlayerManagementProps {
  params: Promise<{
    id: string
  }>
}

interface Player {
  id: string
  manager_name: string
  team_names: string[] // Changed to array to handle multiple team names
  current_team_name?: string // Current season's team name
  seasons: string[]
  isParticipating: boolean
  payment_status?: 'pending' | 'paid'
}

export default function PlayerManagement({ params }: PlayerManagementProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = use(params)
  const [league, setLeague] = useState<League | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState<string>(searchParams.get('season') || '')
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([])
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false)
  const [newPlayer, setNewPlayer] = useState({ manager_name: '', team_name: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(true)
  const [isAvailableExpanded, setIsAvailableExpanded] = useState(false)

  // Check for read-only mode
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

  const fetchPlayersData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch league details
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (leagueError) throw leagueError
      setLeague(leagueData)

      // Set selected season to current season if not set
      const effectiveSeason = selectedSeason || leagueData.current_season
      if (!selectedSeason) {
        setSelectedSeason(effectiveSeason)
      }

      // Fetch all members across all seasons
      const { data: allMembers, error: membersError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', resolvedParams.id)

      if (membersError) throw membersError

      // Get unique seasons
      const seasons = [...new Set(allMembers?.map(m => m.season).filter(Boolean) || [])]
      setAvailableSeasons(seasons)

      // Group players by manager_name only (unique players)
      const playerMap = new Map<string, Player>()
      
      allMembers?.forEach(member => {
        const key = member.manager_name
        
        if (playerMap.has(key)) {
          const existing = playerMap.get(key)!
          
          // Only add season if not already present
          if (!existing.seasons.includes(member.season)) {
            existing.seasons.push(member.season)
          }
          
          // Add team name if not already present
          if (!existing.team_names.includes(member.team_name)) {
            existing.team_names.push(member.team_name)
          }
          
          // Update current season data only if this member is from the selected season
          if (member.season === effectiveSeason && member.is_active) {
            existing.isParticipating = true
            existing.payment_status = member.payment_status
            existing.current_team_name = member.team_name
            existing.id = member.id // Update to selected season's member ID
          }
        } else {
          playerMap.set(key, {
            id: member.id,
            manager_name: member.manager_name,
            team_names: [member.team_name],
            current_team_name: member.season === effectiveSeason && member.is_active ? member.team_name : undefined,
            seasons: [member.season],
            isParticipating: member.season === effectiveSeason && member.is_active,
            payment_status: member.season === effectiveSeason && member.is_active ? member.payment_status : undefined
          })
        }
      })

      // Reset participation status for players not in selected season
      playerMap.forEach((player) => {
        const isInSelectedSeason = allMembers?.some(m => 
          m.manager_name === player.manager_name && 
          m.season === effectiveSeason && 
          m.is_active
        )
        
        if (!isInSelectedSeason) {
          player.isParticipating = false
          player.payment_status = undefined
          player.current_team_name = undefined
        }
      })

      setPlayers(Array.from(playerMap.values()))
    } catch (err) {
      console.error('Error fetching players data:', err)
    } finally {
      setIsLoading(false)
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
    // fetchPlayersData() will be called automatically via useEffect when selectedSeason changes
  }

  const togglePlayerParticipation = async (player: Player) => {
    if (!selectedSeason) return
    
    setIsSaving(true)
    try {
      if (player.isParticipating) {
        // Remove from season
        await supabase
          .from('league_members')
          .delete()
          .eq('league_id', resolvedParams.id)
          .eq('season', selectedSeason)
          .eq('manager_name', player.manager_name)
          .eq('team_name', player.current_team_name)
      } else {
        // Add to season - use current team name or most recent team name
        const teamNameToUse = player.current_team_name || player.team_names[player.team_names.length - 1]
        await supabase
          .from('league_members')
          .insert({
            league_id: resolvedParams.id,
            manager_name: player.manager_name,
            team_name: teamNameToUse,
            season: selectedSeason,
            is_active: true,
            payment_status: 'pending'
          })
      }
      
      fetchPlayersData()
    } catch (err) {
      console.error('Error updating player participation:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const togglePaymentStatus = async (player: Player) => {
    if (!selectedSeason || !player.isParticipating || !player.current_team_name) return

    setIsSaving(true)
    try {
      const newStatus = player.payment_status === 'paid' ? 'pending' : 'paid'
      
      console.log('Updating payment status:', {
        player: player.manager_name,
        team: player.current_team_name,
        season: selectedSeason,
        newStatus,
        leagueId: resolvedParams.id
      })
      
      const { data, error } = await supabase
        .from('league_members')
        .update({ payment_status: newStatus })
        .eq('league_id', resolvedParams.id)
        .eq('season', selectedSeason)
        .eq('manager_name', player.manager_name)
        .eq('is_active', true)
        .select()

      if (error) {
        console.error('Supabase error updating payment status:', error)
        throw error
      }

      console.log('Payment status updated successfully:', data)
      
      // Refresh the data to show the change
      fetchPlayersData()
    } catch (err) {
      console.error('Error updating payment status:', err)
      alert('Failed to update payment status. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const addNewPlayer = async () => {
    if (!newPlayer.manager_name || !newPlayer.team_name || !selectedSeason) return

    setIsSaving(true)
    try {
      await supabase
        .from('league_members')
        .insert({
          league_id: resolvedParams.id,
          manager_name: newPlayer.manager_name,
          team_name: newPlayer.team_name,
          season: selectedSeason,
          is_active: true,
          payment_status: 'pending'
        })
      
      setNewPlayer({ manager_name: '', team_name: '' })
      setIsAddPlayerModalOpen(false)
      fetchPlayersData()
    } catch (err) {
      console.error('Error adding new player:', err)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    fetchPlayersData()
  }, [resolvedParams.id, selectedSeason])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-gray-600">Loading player management...</div>
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

  const participatingPlayers = players
    .filter(p => p.isParticipating)
    .sort((a, b) => {
      // First sort by payment status (unpaid first)
      if (a.payment_status !== b.payment_status) {
        if (a.payment_status === 'pending' && b.payment_status === 'paid') return -1
        if (a.payment_status === 'paid' && b.payment_status === 'pending') return 1
      }
      // Then sort alphabetically by manager name
      return a.manager_name.localeCompare(b.manager_name)
    })
  
  const nonParticipatingPlayers = players
    .filter(p => !p.isParticipating)
    .sort((a, b) => a.manager_name.localeCompare(b.manager_name))

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
              <div className="flex items-center gap-4 mt-2">
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
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white text-claude-text shadow-sm"
              >
                Players
              </button>
            </div>
            {!isViewOnly && (
              <button
                onClick={() => setIsAddPlayerModalOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                Add New Player
              </button>
            )}
            <ShareButton 
              shareUrl={`${window.location.origin}/league/${resolvedParams.id}/players?readonly=true&season=${selectedSeason}`}
              label="Share Players"
              className="text-sm"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Season Participants */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <button
              onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedSeason} Season Participants ({participatingPlayers.length})
              </h2>
              <svg
                className={`w-5 h-5 transition-transform ${isParticipantsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {isParticipantsExpanded && (
            <>
              {participatingPlayers.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500 mb-4">No players for {selectedSeason} season yet</p>
                  {!isViewOnly && (
                    <button
                      onClick={() => setIsAddPlayerModalOpen(true)}
                      className="text-blue-600 hover:underline"
                    >
                      Add your first player
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {participatingPlayers.map((player) => (
                    <div key={player.manager_name} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{player.manager_name}</h3>
                        <p className="text-gray-600">
                          {player.current_team_name && (
                            <span className="font-medium">{player.current_team_name}</span>
                          )}
                          {player.team_names.length > 1 && (
                            <span className="text-gray-500 text-xs ml-2">
                              (Also: {player.team_names.filter(name => name !== player.current_team_name).join(', ')})
                            </span>
                          )}
                        </p>
                        <SeasonBadges 
                          leagueId={resolvedParams.id}
                          managerName={player.manager_name}
                          seasons={player.seasons}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        {isViewOnly ? (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            player.payment_status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {player.payment_status === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        ) : (
                          <>
                            {isViewOnly ? (
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                player.payment_status === 'paid'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {player.payment_status === 'paid' ? 'Paid' : 'Pending'}
                              </span>
                            ) : (
                              <button
                                onClick={() => togglePaymentStatus(player)}
                                disabled={isSaving}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                  player.payment_status === 'paid'
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                } disabled:opacity-50`}
                              >
                                {player.payment_status === 'paid' ? 'Paid' : 'Pending'}
                              </button>
                            )}
                            {!isViewOnly && (
                              <button
                                onClick={() => togglePlayerParticipation(player)}
                                disabled={isSaving}
                                className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                Remove
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Available Players */}
        {(
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <button
                onClick={() => setIsAvailableExpanded(!isAvailableExpanded)}
                className="flex items-center justify-between w-full text-left"
              >
                <h2 className="text-xl font-semibold text-gray-900">
                  Available Players ({nonParticipatingPlayers.length})
                </h2>
                <svg
                  className={`w-5 h-5 transition-transform ${isAvailableExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            {isAvailableExpanded && (
              <>
                {nonParticipatingPlayers.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-gray-500">All players are currently participating in {selectedSeason}</p>
                    <p className="text-gray-400 text-sm mt-2">Players from previous seasons who are not in the current season will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {nonParticipatingPlayers.map((player) => (
                      <div key={player.manager_name} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{player.manager_name}</h3>
                          <p className="text-gray-600">
                            {player.team_names.join(', ')}
                          </p>
                          <div className="mt-1">
                            <p className="text-xs text-gray-500 mb-1">Previous seasons:</p>
                            <SeasonBadges 
                              leagueId={resolvedParams.id}
                              managerName={player.manager_name}
                              seasons={player.seasons}
                            />
                          </div>
                        </div>
                        {!isViewOnly && (
                          <button
                            onClick={() => togglePlayerParticipation(player)}
                            disabled={isSaving}
                            className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            Add to {selectedSeason}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Add Player Modal */}
      {isAddPlayerModalOpen && !isViewOnly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Add New Player</h2>
              <button
                onClick={() => setIsAddPlayerModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manager Name
                </label>
                <input
                  type="text"
                  value={newPlayer.manager_name}
                  onChange={(e) => setNewPlayer(prev => ({...prev, manager_name: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter manager name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Name
                </label>
                <input
                  type="text"
                  value={newPlayer.team_name}
                  onChange={(e) => setNewPlayer(prev => ({...prev, team_name: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter team name"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddPlayerModalOpen(false)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={addNewPlayer}
                  disabled={isSaving || !newPlayer.manager_name || !newPlayer.team_name}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {isSaving ? 'Adding...' : 'Add Player'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}