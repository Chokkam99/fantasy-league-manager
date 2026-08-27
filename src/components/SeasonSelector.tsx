'use client'

import React from 'react'

interface SeasonSelectorProps {
  currentSeason: string
  onSeasonChange: (season: string) => void
  availableSeasons?: string[]
  className?: string
  disabled?: boolean
  showLabel?: boolean
}

export default function SeasonSelector({ 
  currentSeason, 
  onSeasonChange, 
  availableSeasons = [],
  className = '',
  disabled = false,
  showLabel = true,
}: SeasonSelectorProps) {
  const currentYear = new Date().getFullYear().toString()
  const selectedSeason = currentSeason || currentYear
  const seasonsToShow = [...new Set([...availableSeasons, selectedSeason])]
    .filter(Boolean)
    .sort((a, b) => parseInt(b) - parseInt(a))
  const selectedSeasonIsSaved = availableSeasons.includes(selectedSeason)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        className={showLabel ? 'text-sm font-medium text-app-text-muted' : 'sr-only'}
        htmlFor="league-season-selector"
      >
        Season
      </label>
      <select
        id="league-season-selector"
        value={selectedSeason}
        onChange={(e) => onSeasonChange(e.target.value)}
        disabled={disabled}
        className="min-h-10 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-sm font-semibold text-app-text shadow-sm disabled:cursor-not-allowed disabled:bg-app-surface-subtle"
      >
        {seasonsToShow.map(season => (
          <option 
            key={season} 
            value={season}
          >
            {season}
            {season === selectedSeason && !selectedSeasonIsSaved
              ? ' (not configured)'
              : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
