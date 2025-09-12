'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, LeagueMember, WeeklyScore } from '@/lib/supabase'
import { useSeasonConfig } from '@/hooks/useSeasonConfig'

interface Matchup {
  id: string
  league_id: string
  season: string
  week_number: number
  team1_member_id: string
  team2_member_id: string
  team1_score: number | null  // These come from the view now
  team2_score: number | null  // These come from the view now
  winner_member_id: string | null  // Calculated by the view
  is_tie: boolean  // Calculated by the view
}

interface WeeklyScoresProps {
  leagueId: string
  members: LeagueMember[]
  season?: string
  readOnly?: boolean
}

export default function WeeklyScores({ leagueId, members, season, readOnly = false }: WeeklyScoresProps) {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [weeklyScores, setWeeklyScores] = useState<WeeklyScore[]>([])
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [showClearWeekConfirm, setShowClearWeekConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  
  // Determine current season from props or fallback to member data
  const currentSeason = season || (members.length > 0 ? members[0].season : '')
  const { seasonConfig } = useSeasonConfig(leagueId, currentSeason)

  const loadWeeklyScores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_scores')
        .select('*')
        .eq('league_id', leagueId)
        .eq('week_number', selectedWeek)
        .eq('season', currentSeason)

      if (error) throw error

      setWeeklyScores(data || [])
      
      // Transform database scores into form state object
      const scoresObj: Record<string, number> = {}
      data?.forEach(score => {
        scoresObj[score.member_id] = Number(score.points)
      })
      setScores(scoresObj)

    } catch (error) {
      console.error('Error loading weekly scores:', error)
    }
  }, [leagueId, selectedWeek, currentSeason])

  const loadMatchups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('matchup_results_with_scores')
        .select('*')
        .eq('league_id', leagueId)
        .eq('week_number', selectedWeek)
        .eq('season', currentSeason)

      if (error) throw error
      setMatchups(data || [])
    } catch (error) {
      console.error('Error loading matchups:', error)
    }
  }, [leagueId, selectedWeek, currentSeason])

  // Load weekly scores and matchups whenever week or season changes
  useEffect(() => {
    loadWeeklyScores()
    loadMatchups()
  }, [loadWeeklyScores, loadMatchups])


  const handleScoreChange = (memberId: string, points: string) => {
    const numPoints = parseFloat(points) || 0
    setScores(prev => ({
      ...prev,
      [memberId]: numPoints
    }))
  }

  const updateMatchupResults = async () => {
    try {
      // Get all matchups for this week
      const { data: matchups, error: matchupsError } = await supabase
        .from('matchups')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season', currentSeason)
        .eq('week_number', selectedWeek)

      if (matchupsError) {
        console.error('Error fetching matchups:', matchupsError)
        return
      }

      if (!matchups || matchups.length === 0) {
        console.log('No matchups found for this week')
        return
      }

      // NOTE: No need to update matchup results anymore!
      // The matchup_results_with_scores view automatically calculates winners from weekly_scores

      console.log(`Updated ${matchups.length} matchups for week ${selectedWeek}`)
    } catch (error) {
      console.error('Error updating matchup results:', error)
    }
  }

  const saveWeeklyScores = async () => {
    setIsLoading(true)
    try {
      // Use upsert to safely update scores without losing data
      const scoresToUpsert = Object.entries(scores).map(([memberId, points]) => ({
        league_id: leagueId,
        member_id: memberId,
        week_number: selectedWeek,
        season: currentSeason,
        points: points
      }))

      const { error } = await supabase
        .from('weekly_scores')
        .upsert(scoresToUpsert, {
          onConflict: 'league_id,season,week_number,member_id'
        })

      if (error) throw error

      // Update matchup results automatically
      await updateMatchupResults()

      alert(`Week ${selectedWeek} scores and matchup results saved successfully!`)
      loadWeeklyScores()

    } catch (error) {
      console.error('Error saving scores:', error)
      alert('Error saving scores. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const clearWeekScores = async () => {
    setIsClearing(true)
    try {
      // First clear the weekly scores
      const { error: scoresError } = await supabase
        .from('weekly_scores')
        .delete()
        .eq('league_id', leagueId)
        .eq('week_number', selectedWeek)
        .eq('season', currentSeason)

      if (scoresError) {
        console.error('Error clearing week scores:', scoresError)
        alert('Error clearing week scores. Please try again.')
        return
      }

      // NOTE: No need to clear matchup results anymore!  
      // Matchup results are calculated automatically from weekly_scores

      alert(`Week ${selectedWeek} scores and matchup results cleared successfully!`)
      setScores({})
      loadWeeklyScores()
    } catch (err) {
      console.error('Error clearing week data:', err)
      alert('Error clearing week data. Please try again.')
    } finally {
      setIsClearing(false)
      setShowClearWeekConfirm(false)
    }
  }

  // Find weekly winner
  const weeklyWinner = weeklyScores.length > 0 
    ? weeklyScores.reduce((max, score) => score.points > max.points ? score : max)
    : null

  const winnerMember = weeklyWinner 
    ? members.find(m => m.id === weeklyWinner.member_id)
    : null

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">📊 Weekly Scores</h2>
        
        {/* Week Selection Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Week:</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            {Array.from({ length: 17 }, (_, i) => i + 1).map(week => (
              <option key={week} value={week}>Week {week}</option>
            ))}
          </select>
          {!readOnly && (
            <button
              onClick={() => setShowClearWeekConfirm(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors border-0"
              disabled={weeklyScores.length === 0}
            >
              Clear Week
            </button>
          )}
        </div>
      </div>

      {/* Weekly Winner Display - only show if weekly prizes are configured */}
      {weeklyWinner && winnerMember && (seasonConfig?.weekly_prize_amount || 0) > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-green-800">🏆 Week {selectedWeek} Winner</h3>
              <p className="text-green-700">{winnerMember.manager_name} ({winnerMember.team_name})</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-800">{weeklyWinner.points}</div>
              <div className="text-sm text-green-600">Wins ${seasonConfig?.weekly_prize_amount || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Scores Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 mb-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manager
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team Name
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members
                .map((member) => ({
                  ...member,
                  currentScore: Number(scores[member.id]) || 0
                }))
                .sort((a, b) => b.currentScore - a.currentScore)
                .map((member, index) => (
                  <tr key={member.id} className={index < 3 ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {index === 0 && member.currentScore > 0 && (
                          <span className="text-yellow-500 text-lg mr-2">🏆</span>
                        )}
                        {index === 1 && member.currentScore > 0 && (
                          <span className="text-gray-400 text-lg mr-2">🥈</span>
                        )}
                        {index === 2 && member.currentScore > 0 && (
                          <span className="text-yellow-600 text-lg mr-2">🥉</span>
                        )}
                        <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{member.manager_name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{member.team_name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {readOnly ? (
                        <div className="text-base font-medium text-gray-900">
                          {member.currentScore > 0 ? member.currentScore.toFixed(2) : '—'}
                        </div>
                      ) : (
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={scores[member.id] || ''}
                          onChange={(e) => handleScoreChange(member.id, e.target.value)}
                          className="w-24 px-2 py-1 text-right text-base font-medium border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button - only show in edit mode */}
      {!readOnly && (
        <div className="flex justify-end">
          <button
            onClick={saveWeeklyScores}
            disabled={isLoading || members.length === 0}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : `Save Week ${selectedWeek} Scores`}
          </button>
        </div>
      )}

      {/* Matchups Section */}
      {matchups.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🏈 Week {selectedWeek} Matchups</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {matchups.map((matchup, index) => {
              const team1Member = members.find(m => m.id === matchup.team1_member_id)
              const team2Member = members.find(m => m.id === matchup.team2_member_id)
              const team1Score = matchup.team1_score ?? 0
              const team2Score = matchup.team2_score ?? 0
              
              // Determine styling based on winner
              const team1IsWinner = matchup.winner_member_id === matchup.team1_member_id
              const team2IsWinner = matchup.winner_member_id === matchup.team2_member_id
              const isTie = matchup.is_tie
              
              return (
                <div key={matchup.id} className={`flex items-center justify-between py-3 px-4 ${
                  index < matchups.length - 1 ? 'border-b border-gray-100' : ''
                } hover:bg-gray-50`}>
                  {/* Team 1 */}
                  <div className="flex items-center flex-1">
                    <div className="text-right flex-1 mr-3">
                      <div className={`font-medium ${
                        team1IsWinner ? 'text-green-700' : 'text-gray-900'
                      }`}>
                        {team1Member?.manager_name || 'Unknown Team'}
                        {team1IsWinner && <span className="ml-1 text-green-600">🏆</span>}
                        {isTie && team1Score > 0 && <span className="ml-1 text-yellow-600">🤝</span>}
                      </div>
                      <div className="text-sm text-gray-600 text-right">
                        {team1Member?.team_name || 'Unknown Team'}
                      </div>
                    </div>
                    <div className={`text-lg font-bold w-16 text-right ${
                      team1IsWinner ? 'text-green-700' : 
                      isTie && team1Score > 0 ? 'text-yellow-700' : 
                      'text-gray-900'
                    }`}>
                      {team1Score > 0 ? team1Score.toFixed(2) : '—'}
                    </div>
                  </div>

                  {/* Score separator */}
                  <div className="mx-4 flex items-center">
                    <div className="text-gray-400 font-medium">—</div>
                  </div>

                  {/* Team 2 */}
                  <div className="flex items-center flex-1">
                    <div className={`text-lg font-bold w-16 text-left ${
                      team2IsWinner ? 'text-green-700' : 
                      isTie && team2Score > 0 ? 'text-yellow-700' : 
                      'text-gray-900'
                    }`}>
                      {team2Score > 0 ? team2Score.toFixed(2) : '—'}
                    </div>
                    <div className="flex-1 ml-3">
                      <div className={`font-medium ${
                        team2IsWinner ? 'text-green-700' : 'text-gray-900'
                      }`}>
                        {team2IsWinner && <span className="mr-1 text-green-600">🏆</span>}
                        {isTie && team2Score > 0 && <span className="mr-1 text-yellow-600">🤝</span>}
                        {team2Member?.manager_name || 'Unknown Team'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {team2Member?.team_name || 'Unknown Team'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Clear Week Confirmation Modal */}
      {showClearWeekConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-orange-600 mb-4">⚠️ Clear Week {selectedWeek} Scores</h3>
            <p className="text-gray-700 mb-4">
              This will permanently delete all scores for <strong>Week {selectedWeek}</strong> from the database.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              This action cannot be undone. Are you sure you want to continue?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearWeekConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                onClick={clearWeekScores}
                disabled={isClearing}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0"
              >
                {isClearing ? 'Clearing...' : 'Yes, Clear Week'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}