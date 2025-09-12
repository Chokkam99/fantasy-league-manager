'use client'

import React from 'react'
import { LeagueMember } from '@/lib/supabase'
import { COLORS } from '@/lib/colors'

interface TeamStanding {
  member: LeagueMember
  totalPoints: number
  gamesPlayed: number
  averagePoints: number
  rank: number
  weeklyWins: number
  weeklyWinnings: number
  weeksWon: number[]
  seasonPrize: number
  highestPointsPrize: number
  totalWinnings: number
  wins: number
  losses: number
  division?: string
}

interface PlayoffSeed {
  teamId: string
  seed: number
  isDivisionWinner: boolean
  division?: string
}

interface DivisionStandingsProps {
  division: string
  standings: TeamStanding[]
  includePostseason: boolean
  playoffSeeds: PlayoffSeed[]
  manualWinners: {
    first: string | null
    second: string | null
    third: string | null
    highestPoints: string | null
  }
}

export default function DivisionStandings({ 
  division, 
  standings, 
  includePostseason,
  playoffSeeds,
  manualWinners
}: DivisionStandingsProps) {
  const divisionStandings = standings.filter(team => team.member.division === division)
  
  if (divisionStandings.length === 0) {
    return null
  }


  // Check if team is in playoffs
  const isInPlayoffs = (teamId: string) => {
    return playoffSeeds.some(seed => seed.teamId === teamId)
  }

  // Get playoff seed info
  const getPlayoffSeed = (teamId: string) => {
    return playoffSeeds.find(seed => seed.teamId === teamId)
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {division} Division
        </h3>
        <span className="text-sm text-gray-500">
          {divisionStandings.length} teams
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200">
            <tr className="text-left">
              <th className="px-4 pb-3 text-sm font-medium text-gray-500">Rank</th>
              <th className="px-4 pb-3 text-sm font-medium text-gray-500">Team</th>
              <th className="px-4 pb-3 text-sm font-medium text-gray-500 text-right">Wins</th>
              <th className="px-4 pb-3 text-sm font-medium text-gray-500 text-right">Losses</th>
              <th className={`px-4 pb-3 text-sm font-medium text-right ${
                includePostseason ? 'text-blue-600' : 'text-gray-500'
              }`}>
                Points For
              </th>
              <th className="px-4 pb-3 text-sm font-medium text-gray-500 text-right">Avg/Game</th>
              <th className="px-4 pb-3 text-sm font-medium text-gray-500 text-right">Weekly Wins</th>
              <th className="px-4 pb-3 text-sm font-medium text-gray-500 text-right">All Prizes Won</th>
              <th className="px-4 pb-3 text-sm font-medium text-gray-500 text-right">Total Winnings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
              {divisionStandings.map((team, index) => {
                const divisionRank = index + 1
                const inPlayoffs = isInPlayoffs(team.member.id)
                const playoffSeed = getPlayoffSeed(team.member.id)
                
                return (
                  <tr key={team.member.id} className={`hover:bg-gray-50 ${
                    inPlayoffs ? 'bg-slate-100' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {divisionRank}
                        </span>
                        {/* Playoff indicators */}
                        {inPlayoffs && playoffSeed && (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              #{playoffSeed.seed}
                            </span>
                            {playoffSeed.isDivisionWinner && (
                              <span className="text-xs text-green-600 font-medium">👑</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{team.member.team_name}</div>
                        <div className="text-sm text-gray-500">{team.member.manager_name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-green-700">{team.wins}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-red-600">{team.losses}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-gray-900">{team.totalPoints.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-600">{team.averagePoints.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-green-600">{team.weeklyWins}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-xs space-y-1">
                        {/* Weekly wins */}
                        {team.weeksWon.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1">
                            {team.weeksWon.map(week => (
                              <span key={week} className={`${COLORS.prizes.weekly.bg} ${COLORS.prizes.weekly.text} px-1.5 py-0.5 rounded text-xs font-medium`}>
                                W{week}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Season prizes - show labels even if prize amount is $0 */}
                        {(manualWinners.first === team.member.id || manualWinners.second === team.member.id || manualWinners.third === team.member.id) && (
                          <div className="flex justify-end">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              manualWinners.first === team.member.id ? `${COLORS.prizes.firstPlace.bg} ${COLORS.prizes.firstPlace.text}` :
                              manualWinners.second === team.member.id ? `${COLORS.prizes.secondPlace.bg} ${COLORS.prizes.secondPlace.text}` :
                              `${COLORS.prizes.thirdPlace.bg} ${COLORS.prizes.thirdPlace.text}`
                            }`}>
                              {manualWinners.first === team.member.id ? '1st Place' : 
                               manualWinners.second === team.member.id ? '2nd Place' : '3rd Place'}
                            </span>
                          </div>
                        )}
                        {/* Highest points prize - show label even if prize amount is $0 */}
                        {manualWinners.highestPoints === team.member.id && (
                          <div className="flex justify-end">
                            <span className={`${COLORS.prizes.highestPoints.bg} ${COLORS.prizes.highestPoints.text} px-2 py-0.5 rounded text-xs font-medium`}>
                              Highest PF
                            </span>
                          </div>
                        )}
                        {/* No prizes - only show if player has no weekly wins AND no season position */}
                        {team.weeksWon.length === 0 && 
                         manualWinners.first !== team.member.id && 
                         manualWinners.second !== team.member.id && 
                         manualWinners.third !== team.member.id && 
                         manualWinners.highestPoints !== team.member.id && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-green-700">${team.totalWinnings}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
    </div>
  )
}