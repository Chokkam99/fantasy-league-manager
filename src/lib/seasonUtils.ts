import { supabase } from './supabase'

interface PlayoffSeed {
  teamId: string
  seed: number
  isDivisionWinner: boolean
  division?: string
}

interface StandingData {
  member_id: string
  wins: number
  points_for: number
  division?: string
}

// Calculate playoff seeding based on division standings
function calculateDivisionPlayoffSeeding(
  standings: StandingData[], 
  divisions: string[], 
  playoffSpots: number = 6
): PlayoffSeed[] {
  if (!divisions || divisions.length === 0) {
    // No divisions - just take top teams by record
    return standings
      .slice(0, playoffSpots)
      .map((team, index) => ({
        teamId: team.member_id,
        seed: index + 1,
        isDivisionWinner: false
      }))
  }

  const playoffTeams: PlayoffSeed[] = []
  const divisionWinners: StandingData[] = []
  
  // Get division winners (top team from each division)
  divisions.forEach(division => {
    const divisionTeams = standings.filter(team => team.division === division)
    if (divisionTeams.length > 0) {
      // Sort division teams by wins, then points for tiebreaker
      divisionTeams.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.points_for - a.points_for
      })
      divisionWinners.push(divisionTeams[0])
    }
  })

  // Sort division winners for seeding (by record)
  divisionWinners.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.points_for - a.points_for
  })

  // Add division winners as top seeds
  divisionWinners.forEach((winner, index) => {
    playoffTeams.push({
      teamId: winner.member_id,
      seed: index + 1,
      isDivisionWinner: true,
      division: winner.division
    })
  })

  // Get remaining playoff spots (wild cards)
  const remainingSpots = playoffSpots - divisionWinners.length
  if (remainingSpots > 0) {
    const nonWinners = standings.filter(team => 
      !divisionWinners.some(winner => winner.member_id === team.member_id)
    )
    
    // Sort by record for wild card seeding
    nonWinners.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.points_for - a.points_for
    })

    // Add wild card teams
    nonWinners.slice(0, remainingSpots).forEach((team, index) => {
      playoffTeams.push({
        teamId: team.member_id,
        seed: divisionWinners.length + index + 1,
        isDivisionWinner: false,
        division: team.division
      })
    })
  }

  return playoffTeams
}

export interface SeasonPerformance {
  season: string
  status: 'champion' | 'second' | 'third' | 'playoffs' | 'participated'
  position?: number
  totalPoints?: number
  badge: {
    className: string
    symbol: string
    title: string
  }
}

export async function getPlayerSeasonPerformance(
  leagueId: string, 
  managerName: string, 
  seasons: string[]
): Promise<SeasonPerformance[]> {
  const performances: SeasonPerformance[] = []

  for (const season of seasons) {
    try {
      // Get all members for this season
      const { data: seasonMembers } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season', season)
        .eq('is_active', true)

      // Get all weekly scores for this season
      const { data: seasonScores } = await supabase
        .from('weekly_scores')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season', season)

      if (!seasonMembers || !seasonScores) {
        performances.push({
          season,
          status: 'participated',
          badge: getBadgeStyle('participated', season)
        })
        continue
      }

      // Check if season is complete (17+ games/weeks)
      const uniqueWeeks = new Set(seasonScores.map(s => s.week_number))
      const isSeasonComplete = uniqueWeeks.size >= 17

      // If season is not complete, mark all as participants only
      if (!isSeasonComplete) {
        performances.push({
          season,
          status: 'participated',
          badge: getBadgeStyle('participated', season)
        })
        continue
      }

      // Get saved final winners from league_seasons table
      const { data: seasonConfig } = await supabase
        .from('league_seasons')
        .select('final_winners, playoff_spots')
        .eq('league_id', leagueId)
        .eq('season', season)
        .single()

      // Find this player's member record
      const playerMember = seasonMembers.find(m => m.manager_name === managerName)
      if (!playerMember) {
        performances.push({
          season,
          status: 'participated',
          badge: getBadgeStyle('participated', season)
        })
        continue
      }

      let status: SeasonPerformance['status'] = 'participated'
      let position: number = 0

      // Check if player is in saved final winners
      if (seasonConfig?.final_winners) {
        const finalWinners = seasonConfig.final_winners
        if (finalWinners.first === playerMember.id) {
          status = 'champion'
          position = 1
        } else if (finalWinners.second === playerMember.id) {
          status = 'second'
          position = 2
        } else if (finalWinners.third === playerMember.id) {
          status = 'third'
          position = 3
        }
      }

      // If not a final winner, check if made playoffs based on regular season standings
      if (status === 'participated') {
        // Get regular season standings using our stored procedure (without playoffs)
        const { data: standings } = await supabase.rpc('get_season_standings', {
          p_league_id: leagueId,
          p_season: season,
          p_include_playoffs: false
        })

        // Check for divisions
        const { data: seasonConfigData } = await supabase
          .from('league_seasons')
          .select('divisions')
          .eq('league_id', leagueId)
          .eq('season', season)
          .single()

        // Get member division info
        const memberWithDivision = seasonMembers.find(m => m.id === playerMember.id)
        
        if (standings) {
          const playerStanding = standings.find((s: { member_id: string }) => s.member_id === playerMember.id)
          if (playerStanding) {
            const standingIndex = standings.indexOf(playerStanding)
            position = standingIndex + 1
            
            // Check playoff status with division-aware logic
            const playoffSpots = seasonConfig?.playoff_spots || 6
            
            if (seasonConfigData?.divisions?.divisions && memberWithDivision?.division) {
              // Division-based playoff logic
              const divisions = seasonConfigData.divisions.divisions
              const standingsWithDivisions = standings.map((s: StandingData) => {
                const member = seasonMembers.find(m => m.id === s.member_id)
                return { ...s, division: member?.division }
              })
              
              // Calculate division-based playoff seeding
              const playoffTeams = calculateDivisionPlayoffSeeding(
                standingsWithDivisions, 
                divisions, 
                playoffSpots
              )
              
              if (playoffTeams.some(team => team.teamId === playerMember.id)) {
                status = 'playoffs'
              }
            } else {
              // Simple position-based logic (no divisions)
              if (position <= playoffSpots) {
                status = 'playoffs'
              }
            }
          }
        }
      }

      performances.push({
        season,
        status,
        position,
        badge: getBadgeStyle(status, season, position)
      })

    } catch (error) {
      console.error(`Error getting performance for ${season}:`, error)
      performances.push({
        season,
        status: 'participated',
        badge: getBadgeStyle('participated', season)
      })
    }
  }

  return performances.sort((a, b) => a.season.localeCompare(b.season))
}

function getBadgeStyle(
  status: SeasonPerformance['status'], 
  season: string, 
  position?: number
): SeasonPerformance['badge'] {
  switch (status) {
    case 'champion':
      return {
        className: 'px-2 py-1 bg-yellow-100 text-yellow-700 border-2 border-yellow-400 rounded-full text-xs font-bold',
        symbol: '👑',
        title: `${season} Champion (1st Place)`
      }
    case 'second':
      return {
        className: 'px-2 py-1 bg-gray-100 text-gray-700 border-2 border-gray-400 rounded-full text-xs font-bold',
        symbol: '🥈',
        title: `${season} Runner-up (2nd Place)`
      }
    case 'third':
      return {
        className: 'px-2 py-1 bg-orange-100 text-orange-700 border-2 border-orange-400 rounded-full text-xs font-bold',
        symbol: '🥉',
        title: `${season} 3rd Place`
      }
    case 'playoffs':
      return {
        className: 'px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium',
        symbol: '✓',
        title: `${season} Playoffs (${position}th place)`
      }
    case 'participated':
    default:
      return {
        className: 'px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs',
        symbol: '',
        title: `${season} Participant`
      }
  }
}