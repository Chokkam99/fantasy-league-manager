'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, League } from '@/lib/supabase'

interface LeaguesListProps {
  refresh: number
}

interface LeagueWithFee extends Omit<League, 'fee_amount'> {
  fee_amount?: number
}

export default function LeaguesList({ refresh }: LeaguesListProps) {
  const router = useRouter()
  const [leagues, setLeagues] = useState<LeagueWithFee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLeagues = async () => {
    try {
      // First fetch leagues
      const { data: leaguesData, error: leaguesError } = await supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false })

      if (leaguesError) {
        throw leaguesError
      }

      // Then fetch season configs for each league
      const leaguesWithFee: LeagueWithFee[] = []
      
      for (const league of leaguesData || []) {
        const { data: seasonData } = await supabase
          .from('league_seasons')
          .select('fee_amount')
          .eq('league_id', league.id)
          .eq('season', league.current_season)
          .single()

        leaguesWithFee.push({
          ...league,
          fee_amount: seasonData?.fee_amount || 150
        })
      }

      setLeagues(leaguesWithFee)
    } catch (err) {
      console.error('Error fetching leagues:', err)
      setError('Failed to load leagues. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLeagues()
  }, [refresh])

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-claude-text-secondary">Loading leagues...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-claude-error">{error}</div>
        <button
          onClick={fetchLeagues}
          className="mt-2 text-claude-primary hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (leagues.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-claude-text-secondary mb-4">No leagues created yet</div>
        <p className="text-claude-text-light">Create your first league to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-claude-text mb-6">Your Leagues</h2>
      <div className="grid gap-4">
        {leagues.map((league) => (
          <div
            key={league.id}
            className="bg-claude-surface border border-claude-border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-claude-text mb-1">
                  {league.name}
                </h3>
                <div className="flex items-center gap-2 text-sm text-claude-text-secondary">
                  <span>{league.current_season}</span>
                  <span>•</span>
                  <span>Fee: ${league.fee_amount || 150}</span>
                  <span>•</span>
                  <span>{new Date(league.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  console.log('Navigating to league:', league.id)
                  router.push(`/league/${league.id}`)
                }}
                className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors font-medium"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}