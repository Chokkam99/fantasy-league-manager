'use client'

import React, { useState, useEffect, use, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, League, LeagueMember } from '@/lib/supabase'
import ShareButton from '@/components/ShareButton'
import SeasonSelector from '@/components/SeasonSelector'
import PostseasonToggle from '@/components/PostseasonToggle'
import DivisionStandings from '@/components/DivisionStandings'
import { COLORS } from '@/lib/colors'
import { useSeasonConfig, useTeamRecords } from '@/hooks/useSeasonConfig'
import { calculateSpecialPrizes, SpecialPrizes } from '@/lib/prizeUtils'
import { checkAdminAuth } from '@/lib/adminAuth'

interface StandingsPageProps {
  params: Promise<{
    id: string
  }>
}

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

interface WeeklyWinner {
  week: number
  member: LeagueMember
  points: number
}

interface PlayoffSeed {
  teamId: string
  seed: number
  isDivisionWinner: boolean
  division?: string
}

// Calculate playoff seeding based on division standings
function calculatePlayoffSeeding(
  standings: TeamStanding[], 
  divisions: string[], 
  playoffSpots: number = 6
): PlayoffSeed[] {
  if (!divisions || divisions.length === 0) {
    // No divisions - just take top teams by record
    return standings
      .slice(0, playoffSpots)
      .map((team, index) => ({
        teamId: team.member.id,
        seed: index + 1,
        isDivisionWinner: false
      }))
  }

  const playoffTeams: PlayoffSeed[] = []
  const divisionWinners: TeamStanding[] = []
  
  // Get division winners (top team from each division)
  divisions.forEach(division => {
    const divisionTeams = standings.filter(team => team.division === division)
    if (divisionTeams.length > 0) {
      // Sort division teams by wins, then points for tiebreaker
      divisionTeams.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.totalPoints - a.totalPoints
      })
      divisionWinners.push(divisionTeams[0])
    }
  })

  // Sort division winners for seeding (by record)
  divisionWinners.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.totalPoints - a.totalPoints
  })

  // Add division winners as top seeds
  divisionWinners.forEach((winner, index) => {
    playoffTeams.push({
      teamId: winner.member.id,
      seed: index + 1,
      isDivisionWinner: true,
      division: winner.division
    })
  })

  // Get remaining playoff spots (wild cards)
  const remainingSpots = playoffSpots - divisionWinners.length
  if (remainingSpots > 0) {
    const nonWinners = standings.filter(team => 
      !divisionWinners.some(winner => winner.member.id === team.member.id)
    )
    
    // Sort by record for wild card seeding
    nonWinners.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.totalPoints - a.totalPoints
    })

    // Add wild card teams
    nonWinners.slice(0, remainingSpots).forEach((team, index) => {
      playoffTeams.push({
        teamId: team.member.id,
        seed: divisionWinners.length + index + 1,
        isDivisionWinner: false,
        division: team.division
      })
    })
  }

  return playoffTeams
}

export default function StandingsPage({ params }: StandingsPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = use(params)
  const [league, setLeague] = useState<League | null>(null)
  const [baseStandings, setBaseStandings] = useState<TeamStanding[]>([])
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([])
  const [weekNumbers, setWeekNumbers] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState<string>(searchParams.get('season') || '')
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [includePostseason, setIncludePostseason] = useState(false)
  const [divisions, setDivisions] = useState<string[]>([])
  const [hasDivisions, setHasDivisions] = useState(false)
  const [playoffSeeds, setPlayoffSeeds] = useState<PlayoffSeed[]>([])
  const [membersData, setMembersData] = useState<LeagueMember[] | null>(null)
  const [specialPrizes, setSpecialPrizes] = useState<SpecialPrizes>({})
  const [manualWinners, setManualWinners] = useState<{
    first: string | null
    second: string | null
    third: string | null
    fourth: string | null
    highestPoints: string | null
    highestWeekly: string | null
    lowestWeekly: string | null
  }>({
    first: null,
    second: null,
    third: null,
    fourth: null,
    highestPoints: null,
    highestWeekly: null,
    lowestWeekly: null
  })
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [savedWinners, setSavedWinners] = useState<{
    first: string | null
    second: string | null
    third: string | null
    fourth: string | null
    highestPoints: string | null
    highestWeekly: string | null
    lowestWeekly: string | null
  }>({
    first: null,
    second: null,
    third: null,
    fourth: null,
    highestPoints: null,
    highestWeekly: null,
    lowestWeekly: null
  })
  
  // Use season config for dynamic values
  const { seasonConfig, loading: seasonConfigLoading } = useSeasonConfig(resolvedParams.id, selectedSeason)

  // Helper function to check if a prize existed for this season
  // Only show admin options for prizes that were actually configured for this season
  const prizeExistedInSeason = (prizeType: 'fourth' | 'highest_points' | 'highest_weekly' | 'lowest_weekly') => {
    if (!seasonConfig) return false
    
    // Check if the prize was explicitly configured (not just using defaults)
    const prizeValue = seasonConfig.prize_structure[prizeType]
    
    // For these special prizes, they should only show if they were explicitly set to a value
    // This prevents default values from showing options for seasons that didn't have these prizes
    if (prizeType === 'fourth' || prizeType === 'highest_weekly' || prizeType === 'lowest_weekly') {
      return (prizeValue || 0) > 0
    }
    
    // For highest_points, we need to be more careful since it's in the default config
    // We should check if this season was explicitly configured vs using defaults
    if (prizeType === 'highest_points') {
      // If the season config was created from defaults and this prize wasn't explicitly set, don't show it
      // This is a bit tricky to detect, but we can use the season year as a heuristic
      const seasonYear = parseInt(selectedSeason || '2024')
      if (seasonYear >= 2024) {
        // For 2024 and later, highest_points should be explicit
        return (prizeValue || 0) > 0
      } else {
        // For older seasons, assume it existed if there's a value
        return (prizeValue || 0) > 0
      }
    }
    
    return false
  }
  
  // Calculate max week for team records filtering
  const maxWeek = React.useMemo(() => {
    if (includePostseason) {
      return seasonConfig?.total_weeks || 17
    } else {
      return seasonConfig ? (seasonConfig.playoff_start_week - 1) : 14
    }
  }, [includePostseason, seasonConfig])
  
  const { teamRecords, loading: recordsLoading } = useTeamRecords(resolvedParams.id, selectedSeason, maxWeek)
  

  // Check for read-only mode and admin auth on component mount
  const [isViewOnly, setIsViewOnly] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isReadOnly = localStorage.getItem('fantasy-readonly-mode') === 'true'
      const readOnlyLeague = localStorage.getItem('fantasy-readonly-league')
      const urlReadOnly = searchParams.get('readonly') === 'true'
      
      if ((isReadOnly && readOnlyLeague === resolvedParams.id) || urlReadOnly) {
        setIsViewOnly(true)
        setIsAdmin(false)
        // Set localStorage if coming from URL parameter
        if (urlReadOnly) {
          localStorage.setItem('fantasy-readonly-mode', 'true')
          localStorage.setItem('fantasy-readonly-league', resolvedParams.id)
        }
      } else {
        // Check admin auth if not in view-only mode
        const adminAuthenticated = checkAdminAuth()
        setIsAdmin(adminAuthenticated)
        setIsViewOnly(!adminAuthenticated)
      }
    }
  }, [resolvedParams.id, searchParams])

  const fetchInitialData = useCallback(async () => {
    try {
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (leagueError) {
        throw new Error(`Failed to fetch league: ${leagueError.message}`)
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

      // Check for divisions in the current season
      const { data: seasonConfigData } = await supabase
        .from('league_seasons')
        .select('divisions')
        .eq('league_id', resolvedParams.id)
        .eq('season', currentSeason)
        .single()

      // Set division state
      if (seasonConfigData?.divisions?.divisions) {
        setDivisions(seasonConfigData.divisions.divisions)
        setHasDivisions(true)
      } else {
        // Check if any members have divisions assigned
        const { data: divisionCheck } = await supabase
          .from('league_members')
          .select('division')
          .eq('league_id', resolvedParams.id)
          .eq('season', currentSeason)
          .not('division', 'is', null)
          .limit(1)
        
        if (divisionCheck && divisionCheck.length > 0) {
          // Get all unique divisions
          const { data: uniqueDivisions } = await supabase
            .from('league_members')
            .select('division')
            .eq('league_id', resolvedParams.id)
            .eq('season', currentSeason)
            .not('division', 'is', null)
          
          const divisionNames = [...new Set(uniqueDivisions?.map(d => d.division).filter(Boolean) || [])]
          setDivisions(divisionNames)
          setHasDivisions(divisionNames.length > 1)
        } else {
          setDivisions([])
          setHasDivisions(false)
        }
      }

      // Fetch league members for selected season
      const { data: primaryMembersData, error: membersError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', resolvedParams.id)
        .eq('season', currentSeason)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      let fetchedMembersData: LeagueMember[] | null = primaryMembersData

      if (membersError) {
        const { data: altMembersData, error: altMembersError } = await supabase
          .from('members')
          .select('*')
          .eq('league_id', resolvedParams.id)
          .order('updated_at', { ascending: false })
        
        if (!altMembersError) {
          fetchedMembersData = altMembersData
        } else {
          fetchedMembersData = null
        }
      }

      // Store members data in state
      setMembersData(fetchedMembersData)

      const { data: scores, error: scoresError } = await supabase
        .from('weekly_scores')
        .select('*')
        .eq('league_id', resolvedParams.id)
        .eq('season', currentSeason)

      if (scoresError) {
        console.error('Error fetching scores:', scoresError)
        return
      }

      // Calculate weekly winners
      const winners: WeeklyWinner[] = []
      const currentWeekNumbers = Array.from(new Set(scores?.map(s => s.week_number) || []))
      setWeekNumbers(currentWeekNumbers)
      
      currentWeekNumbers.forEach(week => {
        const weekScores = scores?.filter(s => s.week_number === week) || []
        if (weekScores.length > 0) {
          const highestScore = Math.max(...weekScores.map(s => Number(s.points)))
          const winner = weekScores.find(s => Number(s.points) === highestScore)
          if (winner) {
            const member = fetchedMembersData?.find(m => m.id === winner.member_id)
            if (member) {
              winners.push({
                week,
                member,
                points: highestScore
              })
            }
          }
        }
      })
      setWeeklyWinners(winners.sort((a, b) => a.week - b.week))

      // Calculate special prizes
      if (fetchedMembersData) {
        const prizes = await calculateSpecialPrizes(resolvedParams.id, currentSeason, fetchedMembersData)
        setSpecialPrizes(prizes)
      }

      // Initial standings calculation will happen in separate function
      await calculateStandingsData(currentSeason, fetchedMembersData, winners)
    } catch (err) {
      console.error('Error fetching initial data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [resolvedParams.id, selectedSeason])

  const calculateStandingsData = useCallback(async (currentSeason: string, membersData: LeagueMember[] | null, winners: WeeklyWinner[]) => {
    if (!membersData || !seasonConfig) return
    
    console.log('🔄 Calculating standings for season:', currentSeason)

    // Calculate regular season weeks based on playoff settings and includePlayoffs toggle
    const regularSeasonWeeks = seasonConfig ? (seasonConfig.playoff_start_week - 1) : 14
    const maxWeek = includePostseason ? (seasonConfig?.total_weeks || 17) : regularSeasonWeeks

    const { data: scoresData, error: weeklyScoresError } = await supabase
      .from('weekly_scores')
      .select('member_id, points, week_number')
      .eq('league_id', resolvedParams.id)
      .eq('season', currentSeason)
      .lte('week_number', maxWeek)

    if (weeklyScoresError) {
      console.error('Error fetching weekly scores:', weeklyScoresError)
      return
    }

    if (!scoresData || scoresData.length === 0) {
      setBaseStandings([])
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
    const scoreWeekNumbers = Array.from(new Set(scoresData.map(s => s.week_number)))
    scoreWeekNumbers.forEach(week => {
      const weekScores = scoresData.filter(s => s.week_number === week)
      if (weekScores.length > 0) {
        const highestScore = Math.max(...weekScores.map(s => Number(s.points)))
        const weekWinners = weekScores.filter(s => Number(s.points) === highestScore)
        weekWinners.forEach(winner => {
          if (memberStats[winner.member_id]) {
            memberStats[winner.member_id].weeklyWins += 1 / weekWinners.length // Split ties
          }
        })
      }
    })

    // Get win/loss data from RPC
    const { data: standingsData, error: standingsError } = await supabase.rpc('get_season_standings', {
      p_league_id: resolvedParams.id,
      p_season: currentSeason,
      p_include_playoffs: includePostseason
    })

    if (standingsError) {
      console.error('Error fetching standings data:', standingsError)
      return
    }

    if (!standingsData || standingsData.length === 0) {
      setBaseStandings([])
      return
    }

    // Sort by wins first, then by total points for tiebreakers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    standingsData.sort((a: any, b: any) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins
      }
      return b.points_for - a.points_for
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamStandings = standingsData.map((data: any, index: number) => {
      const member = membersData?.find(m => m.id === data.member_id)
      if (!member) return null
      
      const memberWins = winners.filter(w => w.member.id === member.id)
      const weeksWon = memberWins.map(w => w.week).sort((a, b) => a - b)

      // Get actual wins/losses from matchup data or RPC data as fallback
      const matchupRecord = teamRecords[member.id] || { wins: data.wins || 0, losses: data.losses || 0, ties: data.ties || 0 }

      return {
        member,
        totalPoints: Number(data.points_for),
        gamesPlayed: data.games_played,
        averagePoints: Number(data.avg_points),
        rank: index + 1,
        weeklyWins: data.weekly_wins,
        weeklyWinnings: 0, // Will be calculated later
        weeksWon,
        seasonPrize: 0, // Will be calculated later
        highestPointsPrize: 0, // Will be calculated later
        division: member.division, // Add division from member data
        totalWinnings: 0, // Will be calculated later
        wins: matchupRecord.wins,
        losses: matchupRecord.losses
      }
    }).filter(Boolean) as TeamStanding[]

    // Store raw standings data from database
    setBaseStandings(teamStandings)

    // Recalculate special prizes whenever standings data changes
    if (membersData) {
      calculateSpecialPrizes(resolvedParams.id, currentSeason, membersData).then(prizes => {
        setSpecialPrizes(prizes)
      })
    }
  }, [resolvedParams.id, selectedSeason, includePostseason, teamRecords, seasonConfig])

  const handleSeasonChange = (season: string) => {
    setSelectedSeason(season)
    setRefreshKey(prev => prev + 1)
    // Update URL to reflect season change, preserving readonly parameter if present
    const currentPath = window.location.pathname
    const urlParams = new URLSearchParams()
    urlParams.set('season', season)
    if (isViewOnly) {
      urlParams.set('readonly', 'true')
    }
    router.replace(`${currentPath}?${urlParams.toString()}`)
  }

  const handlePostseasonToggle = (include: boolean) => {
    setIncludePostseason(include)
  }

  const handleWinnerChange = (position: 'first' | 'second' | 'third' | 'fourth' | 'highestPoints' | 'highestWeekly' | 'lowestWeekly', value: string | null) => {
    setManualWinners(prev => ({...prev, [position]: value}))
    setHasUnsavedChanges(true)
  }

  const loadSavedWinners = useCallback(async () => {
    try {
      const { data: seasonData, error } = await supabase
        .from('league_seasons')
        .select('final_winners')
        .eq('league_id', resolvedParams.id)
        .eq('season', selectedSeason)
        .single()

      if (error) {
        // If no season config exists yet, that's okay - just use defaults
        if (error.code === 'PGRST116') {
          console.log(`No season config found for ${selectedSeason} - using default winners`)
          setManualWinners({
            first: null,
            second: null,
            third: null,
            fourth: null,
            highestPoints: null,
            highestWeekly: null,
            lowestWeekly: null
          })
        } else {
          console.error('Error loading saved winners:', error)
        }
        return
      }

      const finalWinners = seasonData?.final_winners || {}
      const winners = {
        first: finalWinners.first || null,
        second: finalWinners.second || null,
        third: finalWinners.third || null,
        fourth: finalWinners.fourth || null,
        highestPoints: finalWinners.highest_points || null,
        highestWeekly: finalWinners.highest_weekly || null,
        lowestWeekly: finalWinners.lowest_weekly || null
      }

      setManualWinners(winners)
      setSavedWinners(winners)
      setHasUnsavedChanges(false)
    } catch (err) {
      console.error('Error loading saved winners:', err)
    }
  }, [resolvedParams.id, selectedSeason])

  const saveFinalWinners = async () => {
    setIsSaving(true)
    try {
      const finalWinners = {
        first: manualWinners.first,
        second: manualWinners.second,
        third: manualWinners.third,
        fourth: manualWinners.fourth,
        highest_points: manualWinners.highestPoints,
        highest_weekly: manualWinners.highestWeekly,
        lowest_weekly: manualWinners.lowestWeekly
      }

      const { error } = await supabase
        .from('league_seasons')
        .update({ final_winners: finalWinners })
        .eq('league_id', resolvedParams.id)
        .eq('season', selectedSeason)

      if (error) {
        console.error('Error saving final winners:', error)
        alert('Error saving final winners. Please try again.')
        return
      }

      setSavedWinners(manualWinners)
      setHasUnsavedChanges(false)
      alert('Final season winners saved successfully!')
    } catch (err) {
      console.error('Error saving final winners:', err)
      alert('Error saving final winners. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    // Initial data load on mount or season change
    if (seasonConfigLoading || recordsLoading) return
    fetchInitialData()
  }, [fetchInitialData, refreshKey, seasonConfigLoading, recordsLoading])

  useEffect(() => {
    // Only recalculate standings when data is ready
    if (seasonConfigLoading || !league || !membersData) return
    const currentSeason = selectedSeason || league.current_season
    calculateStandingsData(currentSeason, membersData, weeklyWinners)
  }, [includePostseason, seasonConfig, membersData, league, selectedSeason, calculateStandingsData])

  // Apply sorting and calculate prize amounts when both standings and seasonConfig are available
  const standings = useMemo(() => {
    if (!baseStandings.length || !seasonConfig || seasonConfigLoading) {
      return baseStandings
    }

    // First, apply custom sorting based on playoff toggle and manual winners
    let sortedStandings: TeamStanding[]
    
    if (includePostseason && (manualWinners.first || manualWinners.second || manualWinners.third || manualWinners.fourth)) {
      // When playoffs are included and we have manual winners, prioritize them at the top
      const first = baseStandings.find(t => t.member.id === manualWinners.first)
      const second = baseStandings.find(t => t.member.id === manualWinners.second)  
      const third = baseStandings.find(t => t.member.id === manualWinners.third)
      const fourth = baseStandings.find(t => t.member.id === manualWinners.fourth)
      const others = baseStandings.filter(t => 
        t.member.id !== manualWinners.first && 
        t.member.id !== manualWinners.second && 
        t.member.id !== manualWinners.third &&
        t.member.id !== manualWinners.fourth
      )
      
      // Build sorted array with winners first, then others
      sortedStandings = [
        ...(first ? [first] : []),
        ...(second ? [second] : []),
        ...(third ? [third] : []),
        ...(fourth ? [fourth] : []),
        ...others
      ].map((team, index) => ({ ...team, rank: index + 1 }))
    } else {
      // Use default sorting (from database function)
      sortedStandings = baseStandings
    }
    
    // Then, calculate prize amounts
    return sortedStandings.map(standing => {
      const weeklyPrizeAmount = seasonConfig.weekly_prize_amount || 0
      const weeklyWinnings = standing.weeklyWins * weeklyPrizeAmount
      
      // Calculate season prizes (only if manually selected)
      let seasonPrize = 0
      if (manualWinners.first === standing.member.id) seasonPrize = seasonConfig.prize_structure.first || 0
      else if (manualWinners.second === standing.member.id) seasonPrize = seasonConfig.prize_structure.second || 0
      else if (manualWinners.third === standing.member.id) seasonPrize = seasonConfig.prize_structure.third || 0
      else if (manualWinners.fourth === standing.member.id) seasonPrize = seasonConfig.prize_structure.fourth || 0
      
      // Calculate special prizes
      const highestPointsPrize = manualWinners.highestPoints === standing.member.id ? (seasonConfig.prize_structure.highest_points || 0) : 0
      const highestWeeklyPrize = manualWinners.highestWeekly === standing.member.id ? (seasonConfig.prize_structure.highest_weekly || 0) : 0
      const lowestWeeklyPrize = manualWinners.lowestWeekly === standing.member.id ? (seasonConfig.prize_structure.lowest_weekly || 0) : 0
      
      const totalWinnings = weeklyWinnings + seasonPrize + highestPointsPrize + highestWeeklyPrize + lowestWeeklyPrize
      
      return {
        ...standing,
        weeklyWinnings,
        seasonPrize,
        highestPointsPrize,
        totalWinnings
      }
    })
  }, [baseStandings, seasonConfig, seasonConfigLoading, manualWinners, includePostseason])

  // Calculate playoff seeding for both division and unified tables
  useEffect(() => {
    if (baseStandings.length > 0 && seasonConfig) {
      const playoffSpots = seasonConfig?.playoff_spots || 6
      const seeds = calculatePlayoffSeeding(baseStandings, divisions, playoffSpots)
      setPlayoffSeeds(seeds)
    } else {
      setPlayoffSeeds([])
    }
  }, [hasDivisions, includePostseason, baseStandings, seasonConfig, divisions])

  useEffect(() => {
    if (selectedSeason && weekNumbers.length >= 17) {
      loadSavedWinners()
    }
  }, [selectedSeason, weekNumbers.length, resolvedParams.id, loadSavedWinners])

  if (isLoading || seasonConfigLoading || recordsLoading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-gray-600">Loading standings...</div>
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
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white text-claude-text shadow-sm"
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
              shareUrl={`${window.location.origin}/league/${resolvedParams.id}/standings?readonly=true&season=${selectedSeason}`}
              label="Share Standings"
              className="text-sm"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Season Winners Selection - Only show after 17 weeks completed and not in read-only mode */}
        {weekNumbers.length >= 17 && !isViewOnly && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">🏆 Final Season Winners</h2>
            
            {/* First Row - Placement Winners (1st, 2nd, 3rd, 4th) */}
            <div className={`grid gap-4 mb-6 ${prizeExistedInSeason('fourth') ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {/* 1st Place */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">1st Place (${seasonConfig?.prize_structure.first || 0})</label>
                <select 
                  value={manualWinners.first || ''} 
                  onChange={(e) => handleWinnerChange('first', e.target.value || null)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select Winner</option>
                  {standings.map(team => (
                    <option key={team.member.id} value={team.member.id}>
                      {team.member.team_name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 2nd Place */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">2nd Place (${seasonConfig?.prize_structure.second || 0})</label>
                <select 
                  value={manualWinners.second || ''} 
                  onChange={(e) => handleWinnerChange('second', e.target.value || null)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select Winner</option>
                  {standings.map(team => (
                    <option key={team.member.id} value={team.member.id}>
                      {team.member.team_name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 3rd Place */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">3rd Place (${seasonConfig?.prize_structure.third || 0})</label>
                <select 
                  value={manualWinners.third || ''} 
                  onChange={(e) => handleWinnerChange('third', e.target.value || null)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select Winner</option>
                  {standings.map(team => (
                    <option key={team.member.id} value={team.member.id}>
                      {team.member.team_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4th Place - show if prize existed in this season */}
              {prizeExistedInSeason('fourth') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    4th Place (${seasonConfig?.prize_structure.fourth || 0})
                    {isAdmin && (seasonConfig?.prize_structure.fourth || 0) === 0 && (
                      <span className="ml-1 text-xs text-blue-600 font-normal">[Admin]</span>
                    )}
                  </label>
                  <select 
                    value={manualWinners.fourth || ''} 
                    onChange={(e) => handleWinnerChange('fourth', e.target.value || null)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select Winner</option>
                    {standings.map(team => (
                      <option key={team.member.id} value={team.member.id}>
                        {team.member.team_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Second Row - Special Prizes */}
            {(prizeExistedInSeason('highest_points') || prizeExistedInSeason('highest_weekly') || prizeExistedInSeason('lowest_weekly')) && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Highest Points For - show if prize existed in this season */}
                {prizeExistedInSeason('highest_points') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Highest Points For (${seasonConfig?.prize_structure.highest_points || 0})
                      {isAdmin && (seasonConfig?.prize_structure.highest_points || 0) === 0 && (
                        <span className="ml-1 text-xs text-blue-600 font-normal">[Admin]</span>
                      )}
                    </label>
                    <select 
                      value={manualWinners.highestPoints || ''} 
                      onChange={(e) => handleWinnerChange('highestPoints', e.target.value || null)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select Winner</option>
                      {standings.map(team => (
                        <option key={team.member.id} value={team.member.id}>
                          {team.member.team_name} ({team.totalPoints.toFixed(2)} pts)
                        </option>
                      ))}
                    </select>
                    {/* Suggestion for Highest Points */}
                    {standings.length > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        Suggested: {(() => {
                          const highestPointsTeam = [...standings].sort((a, b) => b.totalPoints - a.totalPoints)[0];
                          return `${highestPointsTeam.member.team_name} - ${highestPointsTeam.totalPoints.toFixed(2)} pts (highest total)`;
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Highest Weekly Score - show if prize existed in this season */}
                {prizeExistedInSeason('highest_weekly') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Highest Weekly Score (${seasonConfig?.prize_structure.highest_weekly || 0})
                      {isAdmin && (seasonConfig?.prize_structure.highest_weekly || 0) === 0 && (
                        <span className="ml-1 text-xs text-blue-600 font-normal">[Admin]</span>
                      )}
                    </label>
                    <select 
                      value={manualWinners.highestWeekly || ''} 
                      onChange={(e) => handleWinnerChange('highestWeekly', e.target.value || null)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select Winner</option>
                      {standings.map(team => (
                        <option key={team.member.id} value={team.member.id}>
                          {team.member.team_name}
                        </option>
                      ))}
                    </select>
                    {/* Suggestion for Highest Weekly */}
                    {specialPrizes.highestWeekly && (
                      <div className="text-xs text-green-600 mt-1">
                        Suggested: {specialPrizes.highestWeekly.member.team_name} - {specialPrizes.highestWeekly.value.toFixed(2)} pts (Week {specialPrizes.highestWeekly.week})
                      </div>
                    )}
                  </div>
                )}

                {/* Lowest Weekly Score - show if prize existed in this season */}
                {prizeExistedInSeason('lowest_weekly') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lowest Weekly Score (${seasonConfig?.prize_structure.lowest_weekly || 0})
                      {isAdmin && (seasonConfig?.prize_structure.lowest_weekly || 0) === 0 && (
                        <span className="ml-1 text-xs text-blue-600 font-normal">[Admin]</span>
                      )}
                    </label>
                    <select 
                      value={manualWinners.lowestWeekly || ''} 
                      onChange={(e) => handleWinnerChange('lowestWeekly', e.target.value || null)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select Winner</option>
                      {standings.map(team => (
                        <option key={team.member.id} value={team.member.id}>
                          {team.member.team_name}
                        </option>
                      ))}
                    </select>
                    {/* Suggestion for Lowest Weekly */}
                    {specialPrizes.lowestWeekly && (
                      <div className="text-xs text-red-600 mt-1">
                        Suggested: {specialPrizes.lowestWeekly.member.team_name} - {specialPrizes.lowestWeekly.value.toFixed(2)} pts (Week {specialPrizes.lowestWeekly.week})
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Save Button and Status */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">Unsaved changes</span>
                  </div>
                )}
                {!hasUnsavedChanges && (savedWinners.first || savedWinners.second || savedWinners.third || savedWinners.fourth || savedWinners.highestPoints || savedWinners.highestWeekly || savedWinners.lowestWeekly) && (
                  <div className="flex items-center gap-2 text-green-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">Winners saved</span>
                  </div>
                )}
              </div>
              <button
                onClick={saveFinalWinners}
                disabled={!hasUnsavedChanges || isSaving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSaving ? 'Saving...' : 'Save Winners'}
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                ✓ All 17 weeks completed! You can now select the final season winners above. 
                The standings table will update to show all prizes won and total winnings.
                <strong> Remember to save your selections!</strong>
              </p>
            </div>
          </div>
        )}
        
        {weekNumbers.length < 17 && !isViewOnly && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🏆 Final Season Winners</h2>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-gray-600">
                Complete all 17 weeks ({weekNumbers.length}/17 weeks done) to select final season winners
              </p>
            </div>
          </div>
        )}

        {/* Weekly Prize Info - Subtle reminder */}
        {(seasonConfig?.weekly_prize_amount || 0) > 0 && (
          <div className="bg-gray-50 rounded-md p-3 mb-6">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Weekly Prize: ${seasonConfig?.weekly_prize_amount}</span>
              <span>{weeklyWinners.length} of {seasonConfig?.total_weeks || 17} weeks completed</span>
            </div>
          </div>
        )}
        
        {/* Season Standings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">🏆 Season Standings</h2>
            <div className="flex items-center gap-3">
              <PostseasonToggle
                includePostseason={includePostseason}
                onToggle={handlePostseasonToggle}
              />
            </div>
          </div>
          
          {/* Conditional rendering: Division tables for regular season, unified for postseason */}
          {hasDivisions && !includePostseason ? (
            // Show division tables in regular season
            <div className="space-y-6">
              {divisions.map(division => (
                <DivisionStandings
                  key={division}
                  division={division}
                  standings={standings}
                  includePostseason={includePostseason}
                  playoffSeeds={playoffSeeds}
                  manualWinners={manualWinners}
                />
              ))}
            </div>
          ) : (
            // Show unified table in postseason or when no divisions
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
                {standings.map((team) => {
                  // Check if team is in playoffs
                  const isInPlayoffs = playoffSeeds.some(seed => seed.teamId === team.member.id)
                  const playoffSeed = playoffSeeds.find(seed => seed.teamId === team.member.id)
                  
                  return (
                  <tr key={team.member.id} className={`hover:bg-gray-50 ${isInPlayoffs ? 'bg-slate-100' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          team.rank === 1 ? COLORS.ranks.first :
                          team.rank === 2 ? COLORS.ranks.second :
                          team.rank === 3 ? COLORS.ranks.third :
                          COLORS.ranks.other
                        }`}>
                          {team.rank}
                        </span>
                        {/* Show playoff seed indicators in regular season */}
                        {!includePostseason && isInPlayoffs && playoffSeed && (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              #{playoffSeed.seed}
                            </span>
                            {playoffSeed.isDivisionWinner && (
                              <span className="text-xs text-green-600 font-medium">👑</span>
                            )}
                          </div>
                        )}
                        {/* Show medals for playoff winners when season is complete */}
                        {weekNumbers.length >= 17 && (
                          <>
                            {manualWinners.first === team.member.id && (
                              <span className="text-lg">🥇</span>
                            )}
                            {manualWinners.second === team.member.id && (
                              <span className="text-lg">🥈</span>
                            )}
                            {manualWinners.third === team.member.id && (
                              <span className="text-lg">🥉</span>
                            )}
                          </>
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
                        {(manualWinners.first === team.member.id || manualWinners.second === team.member.id || manualWinners.third === team.member.id || 
                          (manualWinners.fourth === team.member.id && (seasonConfig?.prize_structure.fourth || 0) > 0)) && (
                          <div className="flex justify-end">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              manualWinners.first === team.member.id ? `${COLORS.prizes.firstPlace.bg} ${COLORS.prizes.firstPlace.text}` :
                              manualWinners.second === team.member.id ? `${COLORS.prizes.secondPlace.bg} ${COLORS.prizes.secondPlace.text}` :
                              manualWinners.third === team.member.id ? `${COLORS.prizes.thirdPlace.bg} ${COLORS.prizes.thirdPlace.text}` :
                              `bg-orange-100 text-orange-800`
                            }`}>
                              {manualWinners.first === team.member.id ? '1st Place' : 
                               manualWinners.second === team.member.id ? '2nd Place' : 
                               manualWinners.third === team.member.id ? '3rd Place' : '4th Place'}
                            </span>
                          </div>
                        )}
                        {/* Highest points prize - only show if this prize existed in this season */}
                        {manualWinners.highestPoints === team.member.id && prizeExistedInSeason('highest_points') && (
                          <div className="flex justify-end">
                            <span className={`${COLORS.prizes.highestPoints.bg} ${COLORS.prizes.highestPoints.text} px-2 py-0.5 rounded text-xs font-medium`}>
                              Highest PF
                            </span>
                          </div>
                        )}
                        {/* Highest weekly score prize - only show if this prize existed in this season */}
                        {manualWinners.highestWeekly === team.member.id && prizeExistedInSeason('highest_weekly') && (
                          <div className="flex justify-end">
                            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium">
                              Highest Weekly
                            </span>
                          </div>
                        )}
                        {/* Lowest weekly score prize - only show if this prize existed in this season */}
                        {manualWinners.lowestWeekly === team.member.id && prizeExistedInSeason('lowest_weekly') && (
                          <div className="flex justify-end">
                            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-medium">
                              Lowest Weekly
                            </span>
                          </div>
                        )}
                        {/* No prizes - only show if player has no weekly wins AND no season position */}
                        {team.weeksWon.length === 0 && 
                         manualWinners.first !== team.member.id && 
                         manualWinners.second !== team.member.id && 
                         manualWinners.third !== team.member.id && 
                         manualWinners.fourth !== team.member.id && 
                         manualWinners.highestPoints !== team.member.id && 
                         manualWinners.highestWeekly !== team.member.id && 
                         manualWinners.lowestWeekly !== team.member.id && (
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
          )}

        </div>

        {/* Weekly Winners Timeline - displays for all seasons with score data */}
        {weeklyWinners.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">🏅 Weekly Winners Timeline</h2>
            
            {/* Timeline Container */}
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute top-6 left-0 w-full h-0.5 bg-gray-200"></div>
              
              {/* Weekly Winners */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {weeklyWinners.map((winner) => (
                  <div key={winner.week} className="relative">
                    {/* Timeline Dot */}
                    <div className="absolute top-5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-md z-10"></div>
                    
                    {/* Winner Card */}
                    <div className="mt-12 bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-center">
                        {/* Week Number */}
                        <div className="inline-flex items-center justify-center w-8 h-8 bg-green-100 text-green-800 rounded-full text-sm font-bold mb-2">
                          {winner.week}
                        </div>
                        
                        {/* Team Name */}
                        <div className="font-medium text-gray-900 text-sm mb-1 truncate" title={winner.member.team_name}>
                          {winner.member.team_name}
                        </div>
                        
                        {/* Manager Name */}
                        <div className="text-xs text-gray-500 mb-2 truncate" title={winner.member.manager_name}>
                          {winner.member.manager_name}
                        </div>
                        
                        {/* Points and Prize */}
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-green-700">
                            {winner.points.toFixed(2)} pts
                          </div>
                          {(seasonConfig?.weekly_prize_amount || 0) > 0 && (
                            <div className="text-xs text-green-600 font-medium">
                              +${seasonConfig?.weekly_prize_amount || 0}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Future Weeks (if not all 17 weeks completed) */}
                {Array.from({ length: 17 - weeklyWinners.length }, (_, i) => {
                  const weekNum = weeklyWinners.length + i + 1;
                  return (
                    <div key={`future-${weekNum}`} className="relative opacity-40">
                      {/* Timeline Dot */}
                      <div className="absolute top-5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-300 rounded-full border-2 border-white z-10"></div>
                      
                      {/* Future Week Card */}
                      <div className="mt-12 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-8 h-8 bg-gray-200 text-gray-500 rounded-full text-sm font-bold mb-2">
                            {weekNum}
                          </div>
                          <div className="text-xs text-gray-400 mb-2">
                            Week {weekNum}
                          </div>
                          {(seasonConfig?.weekly_prize_amount || 0) > 0 && (
                            <div className="text-xs text-gray-400">
                              ${seasonConfig?.weekly_prize_amount || 0}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Summary */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between text-sm">
              <div className="text-gray-600">
                <span className="font-medium">{weeklyWinners.length}</span> of <span className="font-medium">17</span> weeks completed
              </div>
              {(seasonConfig?.weekly_prize_amount || 0) > 0 && (
                <div className="text-green-700 font-medium">
                  Total Weekly Prizes: ${weeklyWinners.length * (seasonConfig?.weekly_prize_amount || 0)}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}