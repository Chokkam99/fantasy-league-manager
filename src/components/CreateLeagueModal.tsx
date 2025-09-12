'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface CreateLeagueModalProps {
  isOpen: boolean
  onClose: () => void
  onLeagueCreated: () => void
}

export default function CreateLeagueModal({ isOpen, onClose, onLeagueCreated }: CreateLeagueModalProps) {
  const [leagueName, setLeagueName] = useState('')
  const [season, setSeason] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { error: supabaseError } = await supabase
        .from('leagues')
        .insert([
          {
            name: leagueName,
            current_season: season || '2025',
            fee_amount: parseFloat(feeAmount)
          }
        ])
        .select()

      if (supabaseError) {
        throw supabaseError
      }

      setLeagueName('')
      setSeason('')
      setFeeAmount('')
      onLeagueCreated()
      onClose()
    } catch (err) {
      console.error('Error creating league:', err)
      setError('Failed to create league. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Create New League</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-2">
              League Name
            </label>
            <input
              type="text"
              id="leagueName"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter league name"
              required
            />
          </div>

          <div>
            <label htmlFor="season" className="block text-sm font-medium text-gray-700 mb-2">
              Season
            </label>
            <input
              type="text"
              id="season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., 2024"
              required
            />
          </div>

          <div>
            <label htmlFor="feeAmount" className="block text-sm font-medium text-gray-700 mb-2">
              League Fee ($)
            </label>
            <input
              type="number"
              id="feeAmount"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create League'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}