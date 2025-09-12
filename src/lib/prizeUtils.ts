import { supabase, LeagueMember } from './supabase'

export interface SpecialPrizeWinner {
  member: LeagueMember
  value: number
  week?: number
}

export interface SpecialPrizes {
  fourthPlace?: SpecialPrizeWinner
  highestWeekly?: SpecialPrizeWinner
  lowestWeekly?: SpecialPrizeWinner
}

/**
 * Calculate special prize winners for a given league and season
 */
export async function calculateSpecialPrizes(
  leagueId: string, 
  season: string,
  members: LeagueMember[]
): Promise<SpecialPrizes> {
  try {
    const results: SpecialPrizes = {}

    // Get all weekly scores for the season
    const { data: weeklyScores, error: scoresError } = await supabase
      .from('weekly_scores')
      .select('member_id, points, week_number')
      .eq('league_id', leagueId)
      .eq('season', season)

    if (scoresError || !weeklyScores) {
      console.error('Error fetching weekly scores for special prizes:', scoresError)
      return results
    }

    // Calculate fourth place by total points
    const memberTotals = weeklyScores.reduce((acc, score) => {
      if (!acc[score.member_id]) {
        acc[score.member_id] = 0
      }
      acc[score.member_id] += Number(score.points)
      return acc
    }, {} as Record<string, number>)

    // Sort by total points descending and get 4th place
    const sortedTotals = Object.entries(memberTotals)
      .map(([memberId, total]) => ({ memberId, total }))
      .sort((a, b) => b.total - a.total)

    if (sortedTotals.length >= 4) {
      const fourthPlaceMemberId = sortedTotals[3].memberId
      const fourthPlaceMember = members.find(m => m.id === fourthPlaceMemberId)
      if (fourthPlaceMember) {
        results.fourthPlace = {
          member: fourthPlaceMember,
          value: sortedTotals[3].total
        }
      }
    }

    // Find highest single week score
    if (weeklyScores.length > 0) {
      const highestScore = weeklyScores.reduce((highest, current) => 
        Number(current.points) > Number(highest.points) ? current : highest
      )
      
      const highestMember = members.find(m => m.id === highestScore.member_id)
      if (highestMember) {
        results.highestWeekly = {
          member: highestMember,
          value: Number(highestScore.points),
          week: highestScore.week_number
        }
      }
    }

    // Find lowest single week score
    if (weeklyScores.length > 0) {
      const lowestScore = weeklyScores.reduce((lowest, current) => 
        Number(current.points) < Number(lowest.points) ? current : lowest
      )
      
      const lowestMember = members.find(m => m.id === lowestScore.member_id)
      if (lowestMember) {
        results.lowestWeekly = {
          member: lowestMember,
          value: Number(lowestScore.points),
          week: lowestScore.week_number
        }
      }
    }

    return results
  } catch (error) {
    console.error('Error calculating special prizes:', error)
    return {}
  }
}

/**
 * Get prize amount for a specific special prize type
 */
export function getSpecialPrizeAmount(
  prizeStructure: Record<string, unknown>,
  prizeType: 'fourth' | 'highest_weekly' | 'lowest_weekly'
): number {
  return Number(prizeStructure?.[prizeType] || 0)
}

/**
 * Check if a member won a specific special prize
 */
export function hasSpecialPrize(
  memberId: string,
  specialPrizes: SpecialPrizes,
  prizeType: 'fourthPlace' | 'highestWeekly' | 'lowestWeekly'
): boolean {
  return specialPrizes[prizeType]?.member.id === memberId
}

/**
 * Get display name for special prizes
 */
export function getSpecialPrizeDisplayName(prizeType: 'fourthPlace' | 'highestWeekly' | 'lowestWeekly'): string {
  switch (prizeType) {
    case 'fourthPlace':
      return '4th Place'
    case 'highestWeekly':
      return 'Highest Weekly'
    case 'lowestWeekly':
      return 'Lowest Weekly'
    default:
      return 'Special Prize'
  }
}