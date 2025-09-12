'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase, LeagueMember } from '@/lib/supabase'
import { COLORS } from '@/lib/colors'
import { useSeasonConfig, useTeamRecords } from '@/hooks/useSeasonConfig'
import PostseasonToggle from '@/components/PostseasonToggle'

interface StandingsProps {
  leagueId: string
  members: LeagueMember[]
  season?: string
  includePostseason?: boolean
  onPostseasonToggle?: (include: boolean) => void
  showToggle?: boolean
  manualWinners?: {
    first: string | null
    second: string | null
    third: string | null
    highestPoints: string | null
  }
}

interface TeamStanding {
  member: LeagueMember
  totalPoints: number
  gamesPlayed: number
  averagePoints: number
  rank: number
  weeklyWins: number
  weeksWon: number[]
  wins: number
  losses: number
}

export default function Standings({ 
  leagueId, 
  members, 
  season, 
  includePostseason = false, 
  onPostseasonToggle,
  showToggle = false,
  manualWinners
}: StandingsProps) {
  const [standings, setStandings] = useState<TeamStanding[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSeasonComplete, setIsSeasonComplete] = useState(false)
  
  // Use provided manual winners or empty default
  const effectiveManualWinners = manualWinners || {
    first: null,
    second: null,
    third: null,
    highestPoints: null
  }
  
  // Get the season from members if not provided
  const currentSeason = season || (members.length > 0 ? members[0].season : '')
  
  // Use hooks for dynamic configuration
  const { seasonConfig } = useSeasonConfig(leagueId, currentSeason)
  
  
  // ALWAYS use regular season weeks for playoff determination (never changes with postseason toggle)
  const regularSeasonWeeks = React.useMemo(() => {
    return seasonConfig ? (seasonConfig.playoff_start_week - 1) : 14
  }, [seasonConfig])
  
  const { teamRecords, loading: recordsLoading } = useTeamRecords(leagueId, currentSeason, regularSeasonWeeks)

  const fetchStandings = useCallback(async () => {
    setIsLoading(true)
    try {
      // Get standings data directly from weekly_scores table with playoff filter
      // Use playoff_start_week from database (regular season ends the week before playoffs start)
      const regularSeasonWeeks = seasonConfig ? (seasonConfig.playoff_start_week - 1) : 14

      const { data: scoresData, error } = await supabase
        .from('weekly_scores')
        .select('member_id, points, week_number')
        .eq('league_id', leagueId)
        .eq('season', currentSeason)
        .lte('week_number', includePostseason ? (seasonConfig?.total_weeks || 17) : regularSeasonWeeks)

      if (error) {
        console.error('Error fetching weekly scores:', error)
        return
      }

      if (!scoresData || scoresData.length === 0) {
        setStandings([])
        return
      }

      // Calculate standings from weekly scores
      const memberStats: Record<string, { totalPoints: number; gamesPlayed: number; weeklyWins: number }> = {}
      
      scoresData.forEach(score => {
        if (!memberStats[score.member_id]) {
          memberStats[score.member_id] = { totalPoints: 0, gamesPlayed: 0, weeklyWins: 0 }
        }
        memberStats[score.member_id].totalPoints += Number(score.points)
        memberStats[score.member_id].gamesPlayed += 1
      })

      // Calculate weekly winners
      const weekNumbers = Array.from(new Set(scoresData.map(s => s.week_number)))
      weekNumbers.forEach(week => {
        const weekScores = scoresData.filter(s => s.week_number === week)
        if (weekScores.length > 0) {
          const highestScore = Math.max(...weekScores.map(s => Number(s.points)))
          const winners = weekScores.filter(s => Number(s.points) === highestScore)
          winners.forEach(winner => {
            if (memberStats[winner.member_id]) {
              memberStats[winner.member_id].weeklyWins += 1 / winners.length // Split ties
            }
          })
        }
      })

      // Convert to standings data format
      const standingsData = Object.entries(memberStats).map(([member_id, stats]) => ({
        member_id,
        points_for: stats.totalPoints,
        games_played: stats.gamesPlayed,
        avg_points: stats.gamesPlayed > 0 ? stats.totalPoints / stats.gamesPlayed : 0,
        weekly_wins: Math.floor(stats.weeklyWins),
        rank: 0 // Will be set below
      }))

      // Sort by wins first, then by total points for tiebreakers
      standingsData.sort((a, b) => {
        // First sort by wins (descending)
        const winsA = teamRecords[a.member_id]?.wins || 0
        const winsB = teamRecords[b.member_id]?.wins || 0
        if (winsB !== winsA) {
          return winsB - winsA
        }
        // If wins are tied, sort by total points (descending)
        return b.points_for - a.points_for
      })
      standingsData.forEach((data, index) => {
        data.rank = index + 1
      })

      // Calculate which weeks each team won (for tooltip) and check season completion
      const winners: Array<{week: number, member_id: string}> = []
      const allWeekNumbers = Array.from(new Set(scoresData.map(s => s.week_number)))
      setIsSeasonComplete(allWeekNumbers.length >= 17)
      
      allWeekNumbers.forEach(week => {
        const weekScores = scoresData.filter(s => s.week_number === week)
        if (weekScores.length > 0) {
          const highestScore = Math.max(...weekScores.map(s => Number(s.points)))
          const winner = weekScores.find(s => Number(s.points) === highestScore)
          if (winner) {
            winners.push({ week, member_id: winner.member_id })
          }
        }
      })
      
      // Interface for the standings data
      interface StandingData {
        member_id: string
        points_for: number
        games_played: number
        avg_points: number
        rank: number
        weekly_wins: number
      }
      
      const teamStandings: TeamStanding[] = standingsData.map((data: StandingData, index: number) => {
        const member = members.find(m => m.id === data.member_id)
        if (!member) return null

        const memberWins = winners.filter(w => w.member_id === member.id)
        const weeksWon = memberWins.map(w => w.week).sort((a, b) => a - b)

        // Get actual wins/losses from matchup data
        const matchupRecord = teamRecords[member.id] || { wins: 0, losses: 0, ties: 0 }

        return {
          member,
          totalPoints: Number(data.points_for),
          gamesPlayed: data.games_played,
          averagePoints: Number(data.avg_points),
          rank: index + 1,
          weeklyWins: data.weekly_wins,
          weeksWon,
          wins: matchupRecord.wins,
          losses: matchupRecord.losses
        }
      }).filter(Boolean) as TeamStanding[]

      // Apply custom sorting based on playoff toggle and manual winners
      let sortedStandings: TeamStanding[]
      
      if (includePostseason && (effectiveManualWinners.first || effectiveManualWinners.second || effectiveManualWinners.third)) {
        // When playoffs are included and we have manual winners, prioritize them at the top
        const first = teamStandings.find(t => t.member.id === effectiveManualWinners.first)
        const second = teamStandings.find(t => t.member.id === effectiveManualWinners.second)  
        const third = teamStandings.find(t => t.member.id === effectiveManualWinners.third)
        const others = teamStandings.filter(t => 
          t.member.id !== effectiveManualWinners.first && 
          t.member.id !== effectiveManualWinners.second && 
          t.member.id !== effectiveManualWinners.third
        )
        
        // Build sorted array with winners first, then others
        sortedStandings = [
          ...(first ? [first] : []),
          ...(second ? [second] : []),
          ...(third ? [third] : []),
          ...others
        ].map((team, index) => ({ ...team, rank: index + 1 }))
      } else {
        // Use default sorting (from database function)
        sortedStandings = teamStandings
      }

      setStandings(sortedStandings)
    } catch (err) {
      console.error('Error calculating standings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId, currentSeason, includePostseason, members, manualWinners, teamRecords, seasonConfig])

  useEffect(() => {
    if (!recordsLoading && seasonConfig) {
      fetchStandings()
    }
  }, [fetchStandings, recordsLoading, seasonConfig])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Standings</h2>
        <div className="text-center py-8 text-gray-500">Loading standings...</div>
      </div>
    )
  }

  if (standings.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Standings</h2>
        <div className="text-center py-8 text-gray-500">No scores entered yet</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">📊 Standings</h2>
          {showToggle && onPostseasonToggle && (
            <PostseasonToggle
              includePostseason={includePostseason}
              onToggle={onPostseasonToggle}
            />
          )}
        </div>
        <a 
          href={`/league/${leagueId}/standings`}
          className="text-claude-primary hover:text-claude-primary-dark text-sm font-medium"
        >
          View Details →
        </a>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200">
            <tr className="text-left">
              <th className="pb-3 text-sm font-medium text-gray-500">Rank</th>
              <th className="pb-3 text-sm font-medium text-gray-500">Team</th>
              <th className="pb-3 text-sm font-medium text-gray-500 text-right">Wins</th>
              <th className="pb-3 text-sm font-medium text-gray-500 text-right">Losses</th>
              <th className={`pb-3 text-sm font-medium text-right ${
                includePostseason ? 'text-blue-600' : 'text-gray-500'
              }`}>
                Points For
              </th>
              <th className="pb-3 text-sm font-medium text-gray-500 text-right">Avg/Game</th>
              <th className="pb-3 text-sm font-medium text-gray-500 text-right">Weekly Wins</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {standings.map((team) => (
              <React.Fragment key={team.member.id}>
                <tr className={`hover:bg-gray-50 ${team.rank > 6 ? 'opacity-75' : ''}`}>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        team.rank === 1 ? COLORS.ranks.first :
                        team.rank === 2 ? COLORS.ranks.second :
                        team.rank === 3 ? COLORS.ranks.third :
                        COLORS.ranks.other
                      }`}>
                        {team.rank}
                      </span>
                      {/* Show medals for playoff winners when season is complete */}
                      {isSeasonComplete && (
                        <>
                          {effectiveManualWinners.first === team.member.id && (
                            <span className="text-lg">🥇</span>
                          )}
                          {effectiveManualWinners.second === team.member.id && (
                            <span className="text-lg">🥈</span>
                          )}
                          {effectiveManualWinners.third === team.member.id && (
                            <span className="text-lg">🥉</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    <div>
                      <div className="font-medium text-gray-900">{team.member.team_name}</div>
                      <div className="text-sm text-gray-500">{team.member.manager_name}</div>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span className="font-semibold text-green-700">{team.wins}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="font-semibold text-red-600">{team.losses}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="font-semibold text-gray-900">{team.totalPoints.toFixed(2)}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-gray-600">{team.averagePoints.toFixed(2)}</span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end">
                      <span 
                        className="font-medium text-green-600 cursor-help" 
                        title={team.weeksWon.length > 0 ? `Won weeks: ${team.weeksWon.join(', ')}` : 'No weekly wins yet'}
                      >
                        {team.weeklyWins}
                      </span>
                      {team.weeklyWins > 0 && seasonConfig && (
                        <span className="ml-1 text-xs text-green-500">
                          (+${team.weeklyWins * seasonConfig.weekly_prize_amount})
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Playoff Line after configured position */}
                {seasonConfig && team.rank === seasonConfig.playoff_spots && standings.length > seasonConfig.playoff_spots && (
                  <tr>
                    <td colSpan={7} className="py-2">
                      <div className="border-t-2 border-dashed border-gray-300"></div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}