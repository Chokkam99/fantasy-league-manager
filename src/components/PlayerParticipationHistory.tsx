'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
// Removed import of getPlayerSeasonPerformance as it's too slow for bulk operations


interface PlayerParticipationHistoryProps {
  leagueId: string
}

interface PlayerSeasonData {
  season: string
  status: 'participated' | 'winner' | 'playoffs' | 'none'
  position?: number
  playoff_spots?: number
  wins?: number
  losses?: number
}

interface PlayerHistoryData {
  manager_name: string
  team_names: string[]
  seasons: PlayerSeasonData[]
}

interface RpcStandingData {
  member_id: string
  wins: number
  points_for: number
}

interface TeamStanding {
  member: { id: string }
  wins: number
  totalPoints: number
  division?: string
}

export default function PlayerParticipationHistory({ leagueId }: PlayerParticipationHistoryProps) {
  const [playerHistory, setPlayerHistory] = useState<PlayerHistoryData[]>([])
  const [allSeasons, setAllSeasons] = useState<string[]>([])
  const [completedSeasons, setCompletedSeasons] = useState<string[]>([])
  const [ongoingSeasons, setOngoingSeasons] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPlayerHistory = useCallback(async () => {
    try {
      console.log('🚀 Starting fetchPlayerHistory for league:', leagueId)
      setIsLoading(true)
      
      // Fetch all league members across all seasons
      const { data: allMembers, error: membersError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', leagueId)
        .eq('is_active', true)

      if (membersError) throw membersError

      // Get all unique seasons
      const seasons = [...new Set(allMembers?.map(m => m.season).filter(Boolean) || [])]
        .sort()
      setAllSeasons(seasons)
      console.log('📅 Found seasons:', seasons)
      console.log('👥 Total members found:', allMembers?.length)

      // Get season configurations and final winners
      const { data: seasonConfigs } = await supabase
        .from('league_seasons')
        .select('season, final_winners, playoff_spots, divisions')
        .eq('league_id', leagueId)
      
      const seasonConfigsMap = new Map(
        seasonConfigs?.map(config => [config.season, config]) || []
      )
      console.log('⚙️ Season configs:', seasonConfigs)

      // Get standings for all seasons and separate completed/ongoing
      const seasonStandingsMap = new Map()
      const completedSeasonsArray: string[] = []
      const ongoingSeasonsArray: string[] = []
      
      for (const season of seasons) {
        // Check if season is complete (has weekly scores)
        const { data: seasonScores } = await supabase
          .from('weekly_scores')
          .select('week_number')
          .eq('league_id', leagueId)
          .eq('season', season)
        
        const uniqueWeeks = new Set(seasonScores?.map(s => s.week_number) || [])
        const isSeasonComplete = uniqueWeeks.size >= 17
        
        console.log(`🔍 ${season} season check: ${uniqueWeeks.size} weeks, complete: ${isSeasonComplete}`)

        if (isSeasonComplete) {
          completedSeasonsArray.push(season)
          // Get regular season standings using the corrected RPC function
          console.log(`🔧 Calling RPC with params:`, { p_league_id: leagueId, p_season: season, p_include_playoffs: false })
          const { data: standings, error: standingsError } = await supabase.rpc('get_season_standings', {
            p_league_id: leagueId,
            p_season: season,
            p_include_playoffs: false
          })
          
          console.log(`📊 RPC result for ${season}:`, { standings: standings?.length, error: standingsError })
          if (standingsError) {
            console.error(`❌ RPC Error for ${season}:`, standingsError)
          }
          
          if (standings && standings.length > 0) {
            // Calculate playoff teams based on divisions or simple ranking
            const playoffSpots = seasonConfigsMap.get(season)?.playoff_spots || 6
            const seasonConfig = seasonConfigsMap.get(season)
            const divisions = seasonConfig?.divisions?.divisions

            console.log(`🏈 Processing ${season} season:`, {
              playoffSpots,
              divisions,
              standingsCount: standings.length
            })

            // Convert RPC data to standings page format for consistent playoff logic
            const teamStandings: TeamStanding[] = standings.map((s: RpcStandingData) => {
              const member = allMembers?.find(m => m.id === s.member_id && m.season === season)
              return {
                member: { id: s.member_id },
                wins: s.wins,
                totalPoints: s.points_for,
                division: member?.division
              }
            })

            // Use the exact same playoff logic as the standings page
            let playoffTeamIds: string[] = []

            if (divisions && divisions.length > 0) {
              // Division-based playoff calculation using standings page logic
              const divisionWinners: TeamStanding[] = []
              
              // Get division winners (top team from each division)
              divisions.forEach((division: string) => {
                const divisionTeams = teamStandings.filter((team: TeamStanding) => team.division === division)
                if (divisionTeams.length > 0) {
                  // Sort division teams by wins, then points for tiebreaker
                  divisionTeams.sort((a: TeamStanding, b: TeamStanding) => {
                    if (b.wins !== a.wins) return b.wins - a.wins
                    return b.totalPoints - a.totalPoints
                  })
                  divisionWinners.push(divisionTeams[0])
                  console.log(`📍 Division winner for ${division}:`, divisionTeams[0].member.id, `(${divisionTeams[0].wins}-${15-divisionTeams[0].wins})`)
                }
              })

              // Add division winners
              playoffTeamIds.push(...divisionWinners.map(w => w.member.id))
              console.log(`👑 Division winners:`, divisionWinners.map(w => w.member.id))
              
              // Add wild card teams
              const remainingSpots = playoffSpots - divisionWinners.length
              if (remainingSpots > 0) {
                const nonWinners = teamStandings.filter((team: TeamStanding) => 
                  !divisionWinners.some(winner => winner.member.id === team.member.id)
                )
                
                // Sort by record for wild card seeding
                nonWinners.sort((a: TeamStanding, b: TeamStanding) => {
                  if (b.wins !== a.wins) return b.wins - a.wins
                  return b.totalPoints - a.totalPoints
                })

                const wildCardTeams = nonWinners.slice(0, remainingSpots)
                playoffTeamIds.push(...wildCardTeams.map((t: TeamStanding) => t.member.id))
                console.log(`🎯 Wild card teams:`, wildCardTeams.map((t: TeamStanding) => t.member.id))
              }
            } else {
              // Simple top-N playoff teams
              playoffTeamIds = teamStandings.slice(0, playoffSpots).map((t: TeamStanding) => t.member.id)
            }

            console.log(`🏆 Final playoff teams for ${season}:`, playoffTeamIds)
            
            seasonStandingsMap.set(season, {
              standings,
              playoffTeamIds,
              playoffSpots
            })
          }
        } else {
          // Season is ongoing (incomplete)
          ongoingSeasonsArray.push(season)
          console.log(`⏳ ${season} is ongoing (${uniqueWeeks.size}/17 weeks)`)
        }
      }

      // Set the completed and ongoing seasons
      setCompletedSeasons(completedSeasonsArray)
      setOngoingSeasons(ongoingSeasonsArray)
      console.log(`✅ Completed seasons: ${completedSeasonsArray.length}`, completedSeasonsArray)
      console.log(`⏳ Ongoing seasons: ${ongoingSeasonsArray.length}`, ongoingSeasonsArray)

      // Group by player and determine their status for each season
      const playerMap = new Map<string, PlayerHistoryData>()

      allMembers?.forEach(member => {
        const key = member.manager_name
        const seasonConfig = seasonConfigsMap.get(member.season)
        const seasonData = seasonStandingsMap.get(member.season)
        
        let status: PlayerSeasonData['status'] = 'participated'
        let position: number | undefined

        // Check if season is complete
        if (seasonData) {
          const { standings, playoffTeamIds } = seasonData
          
          // First check if player is in saved final winners
          if (seasonConfig?.final_winners) {
            const finalWinners = seasonConfig.final_winners
            if (finalWinners.first === member.id) {
              status = 'winner'
              position = 1
            } else if (finalWinners.second === member.id) {
              status = 'winner'
              position = 2
            } else if (finalWinners.third === member.id) {
              status = 'winner'
              position = 3
            }
          }

          // If not a final winner, check playoff status
          if (status === 'participated') {
            const standingIndex = standings.findIndex((s: RpcStandingData) => s.member_id === member.id)
            if (standingIndex >= 0) {
              position = standingIndex + 1
              
              if (playoffTeamIds.includes(member.id)) {
                status = 'playoffs'
                console.log(`🎮 ${member.manager_name} made playoffs in ${member.season} (position ${position})`)
              }
            }
          }
        }

        const seasonInfo: PlayerSeasonData = {
          season: member.season,
          status,
          position,
          playoff_spots: seasonConfig?.playoff_spots || 6,
          wins: 0, // Not displayed
          losses: 0 // Not displayed
        }
        
        if (status !== 'participated') {
          console.log(`📊 ${member.manager_name} in ${member.season}: ${status} (position ${position})`)
        }
        
        if (playerMap.has(key)) {
          const existing = playerMap.get(key)!
          existing.seasons.push(seasonInfo)
          // Add team name if not already present
          if (!existing.team_names.includes(member.team_name)) {
            existing.team_names.push(member.team_name)
          }
        } else {
          playerMap.set(key, {
            manager_name: member.manager_name,
            team_names: [member.team_name],
            seasons: [seasonInfo]
          })
        }
      })

      // Sort seasons for each player and sort players by name
      const sortedPlayers = Array.from(playerMap.values())
        .map(player => ({
          ...player,
          seasons: player.seasons.sort((a, b) => a.season.localeCompare(b.season))
        }))
        .sort((a, b) => a.manager_name.localeCompare(b.manager_name))

      setPlayerHistory(sortedPlayers)
    } catch (err) {
      console.error('Error fetching player history:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  useEffect(() => {
    fetchPlayerHistory()
  }, [fetchPlayerHistory])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">👥 Player Participation History</h2>
        <div className="text-center py-4">
          <div className="text-gray-600">Loading participation history...</div>
        </div>
      </div>
    )
  }

  if (playerHistory.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">👥 Player Participation History</h2>
        <div className="text-center py-4">
          <div className="text-gray-500">No player data available</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">👥 Player Participation History</h2>
        <div className="text-sm text-gray-500">
          {playerHistory.length} players • {completedSeasons.length} completed seasons
        </div>
      </div>
      <p className="text-gray-600 text-sm mb-6">Historical performance and participation across all seasons</p>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200">
            <tr className="text-left">
              <th className="pb-3 text-sm font-medium text-gray-500 sticky left-0 bg-white border-r border-gray-100">
                <div>
                  <div className="font-semibold">Player</div>
                  <div className="text-xs text-gray-400 font-normal">Manager • Team</div>
                </div>
              </th>
              {allSeasons.map(season => {
                // Get playoff spots for this season from player data
                const seasonPlayers = playerHistory.find(p => p.seasons.some(s => s.season === season))
                const playoffSpots = seasonPlayers?.seasons.find(s => s.season === season)?.playoff_spots || 6
                const isOngoing = ongoingSeasons.includes(season)
                
                return (
                  <th key={season} className="pb-3 text-sm font-medium text-gray-500 text-center min-w-20">
                    <div className="font-semibold">
                      {season}{isOngoing && <sup>*</sup>}
                    </div>
                    <div className="text-xs text-gray-400 font-normal">
                      Top {playoffSpots} playoffs
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {playerHistory.map((player) => (
              <tr key={player.manager_name} className="hover:bg-gray-50">
                <td className="py-3 sticky left-0 bg-white border-r border-gray-100">
                  <div className="min-w-32">
                    <div className="font-semibold text-gray-900">{player.manager_name}</div>
                    <div className="text-sm text-gray-600">
                      {player.team_names.join(', ')}
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {player.seasons.filter(s => s.status === 'winner' && s.position === 1).length > 0 && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                          {player.seasons.filter(s => s.status === 'winner' && s.position === 1).length}× Champion
                        </span>
                      )}
                      {player.seasons.filter(s => s.status === 'winner' && s.position === 2).length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium">
                          {player.seasons.filter(s => s.status === 'winner' && s.position === 2).length}× 2nd Place
                        </span>
                      )}
                      {player.seasons.filter(s => s.status === 'winner' && s.position === 3).length > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                          {player.seasons.filter(s => s.status === 'winner' && s.position === 3).length}× 3rd Place
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {player.seasons.filter(s => (s.status === 'winner' && s.position && s.position <= (s.playoff_spots || 6)) || s.status === 'playoffs').length > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          {player.seasons.filter(s => (s.status === 'winner' && s.position && s.position <= (s.playoff_spots || 6)) || s.status === 'playoffs').length}× Playoffs
                        </span>
                      )}
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {player.seasons.filter(s => completedSeasons.includes(s.season)).length} Season{player.seasons.filter(s => completedSeasons.includes(s.season)).length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </td>
                {allSeasons.map(season => {
                  const seasonData = player.seasons.find(s => s.season === season)
                  if (!seasonData) {
                    return (
                      <td key={season} className="py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium bg-gray-100 text-gray-400">
                          —
                        </span>
                      </td>
                    )
                  }

                  let colorClass = ''
                  let symbol = ''
                  let title = ''

                  switch (seasonData.status) {
                    case 'winner':
                      if (seasonData.position === 1) {
                        colorClass = 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400'
                        symbol = '1'
                        title = `1st Place - ${season}`
                      } else if (seasonData.position === 2) {
                        colorClass = 'bg-gray-100 text-gray-700 border-2 border-gray-400'
                        symbol = '2'
                        title = `2nd Place - ${season}`
                      } else if (seasonData.position === 3) {
                        colorClass = 'bg-orange-100 text-orange-700 border-2 border-orange-400'
                        symbol = '3'
                        title = `3rd Place - ${season}`
                      } else {
                        colorClass = 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                        symbol = seasonData.position?.toString() || '?'
                        title = `${seasonData.position}th Place - ${season}`
                      }
                      break
                    case 'playoffs':
                      colorClass = 'bg-green-100 text-green-700'
                      symbol = '✓'
                      title = `Playoffs (${seasonData.position}th place) - ${season}`
                      break
                    case 'participated':
                      colorClass = 'bg-blue-100 text-blue-700'
                      symbol = season.slice(-2) // Show last 2 digits of year
                      title = `Participated - ${season}`
                      break
                    default:
                      colorClass = 'bg-gray-100 text-gray-400'
                      symbol = '—'
                      title = `Did not participate - ${season}`
                  }

                  return (
                    <td key={season} className="py-3 text-center">
                      <span 
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold cursor-help ${colorClass}`}
                        title={title}
                      >
                        {symbol}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 border-2 border-yellow-400 text-xs font-bold">1</span>
            <span className="font-medium">Champion (1st Place)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-700 border-2 border-gray-400 text-xs font-bold">2</span>
            <span>Runner-up (2nd Place)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 border-2 border-orange-400 text-xs font-bold">3</span>
            <span>3rd Place</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold">✓</span>
            <span>Made Playoffs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs">25</span>
            <span>Participated (shows year)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs">—</span>
            <span>Did not participate</span>
          </div>
        </div>
        {ongoingSeasons.length > 0 && (
          <div className="mt-3 text-xs text-gray-500">
            <span className="font-medium">*</span> Indicates ongoing season (less than 17 weeks completed). Only completed seasons are counted in totals.
          </div>
        )}
      </div>
    </div>
  )
}