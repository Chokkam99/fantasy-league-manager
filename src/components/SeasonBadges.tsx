'use client'

import { useState, useEffect } from 'react'
import { getPlayerSeasonPerformance, SeasonPerformance } from '@/lib/seasonUtils'

interface SeasonBadgesProps {
  leagueId: string
  managerName: string
  seasons: string[]
  className?: string
}

export default function SeasonBadges({ leagueId, managerName, seasons, className = '' }: SeasonBadgesProps) {
  const [performances, setPerformances] = useState<SeasonPerformance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadPerformances() {
      if (seasons.length === 0) {
        setIsLoading(false)
        return
      }

      try {
        const playerPerformances = await getPlayerSeasonPerformance(leagueId, managerName, seasons)
        setPerformances(playerPerformances)
      } catch (error) {
        console.error('Error loading season performances:', error)
        // Fallback to basic badges
        const basicPerformances: SeasonPerformance[] = seasons.map(season => ({
          season,
          status: 'participated',
          badge: {
            className: 'px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs',
            symbol: '✓',
            title: `${season} Participant`
          }
        }))
        setPerformances(basicPerformances)
      } finally {
        setIsLoading(false)
      }
    }

    loadPerformances()
  }, [leagueId, managerName, seasons])

  if (isLoading) {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {seasons.map(season => (
          <div key={season} className="px-2 py-1 bg-gray-100 rounded-full text-xs animate-pulse">
            {season}
          </div>
        ))}
      </div>
    )
  }

  if (performances.length === 0) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        No season data
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {performances.map(performance => (
        <span
          key={performance.season}
          className={performance.badge.className}
          title={performance.badge.title}
        >
          {performance.badge.symbol}{performance.badge.symbol ? ' ' : ''}{performance.season}
        </span>
      ))}
    </div>
  )
}