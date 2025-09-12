'use client'

import React from 'react'

interface SeasonSelectorProps {
  currentSeason: string
  onSeasonChange: (season: string) => void
  availableSeasons?: string[]
  className?: string
  disabled?: boolean
}

export default function SeasonSelector({ 
  currentSeason, 
  onSeasonChange, 
  availableSeasons = [],
  className = '',
  disabled = false
}: SeasonSelectorProps) {
  // Only show seasons that have data, or fall back to current year if none available
  const currentYear = new Date().getFullYear().toString()
  const seasonsToShow = availableSeasons.length > 0 
    ? availableSeasons.sort((a, b) => parseInt(b) - parseInt(a)) // Sort descending (newest first)
    : [currentYear] // Fallback to current year if no data

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-sm font-medium text-gray-700">Season:</label>
      <select
        value={currentSeason}
        onChange={(e) => onSeasonChange(e.target.value)}
        disabled={disabled}
        className="border border-gray-300 rounded px-3 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {seasonsToShow.map(season => (
          <option 
            key={season} 
            value={season}
          >
            {season}
          </option>
        ))}
      </select>
    </div>
  )
}