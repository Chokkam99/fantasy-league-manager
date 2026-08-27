import { useState, useEffect, useCallback } from 'react'
import type { LeagueSeason } from '@/lib/supabase'
import {
  createUnsavedSeasonConfig,
  normalizeSeasonConfig,
} from '@/lib/seasonConfig'
import { loadSeasonConfigRecord } from '@/lib/seasonConfigClient'

interface UseSeasonConfigResult {
  seasonConfig: LeagueSeason | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useSeasonConfig(leagueId: string, season: string): UseSeasonConfigResult {
  const [seasonConfig, setSeasonConfig] = useState<LeagueSeason | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSeasonConfig = useCallback(async () => {
    if (!leagueId || !season) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await loadSeasonConfigRecord(
        leagueId,
        season,
      )

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setSeasonConfig(createUnsavedSeasonConfig(leagueId, season))
          setError(
            `No saved configuration exists for the ${season} season.`,
          )
        } else {
          throw fetchError
        }
      } else if (data) {
        setSeasonConfig(normalizeSeasonConfig(data))
      } else {
        setSeasonConfig(createUnsavedSeasonConfig(leagueId, season))
        setError(`No saved configuration exists for the ${season} season.`)
      }
    } catch (err) {
      console.error('Error fetching season config:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch season configuration')
      
      setSeasonConfig(createUnsavedSeasonConfig(leagueId, season))
    } finally {
      setLoading(false)
    }
  }, [leagueId, season])

  useEffect(() => {
    fetchSeasonConfig()
  }, [fetchSeasonConfig])

  return {
    seasonConfig,
    loading,
    error,
    refetch: fetchSeasonConfig
  }
}
