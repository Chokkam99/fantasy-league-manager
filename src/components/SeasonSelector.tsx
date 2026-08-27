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
      <div className="relative shrink-0">
        <select
          id="league-season-selector"
          value={selectedSeason}
          onChange={(e) => onSeasonChange(e.target.value)}
          disabled={disabled}
          className="min-h-11 w-20 appearance-none rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-2 py-2 text-center text-sm font-semibold text-app-text shadow-sm outline-none transition focus:border-app-brand focus:ring-2 focus:ring-app-brand-soft disabled:cursor-not-allowed disabled:bg-app-surface-subtle"
        >
          {seasonsToShow.map(season => (
            <option
              className="text-center"
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
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-text-muted"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="m7 10 5 5 5-5" />
        </svg>
      </div>
    </div>
  )
}
