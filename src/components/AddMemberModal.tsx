'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  leagueId: string
  onMemberAdded: () => void
}

export default function AddMemberModal({ isOpen, onClose, leagueId, onMemberAdded }: AddMemberModalProps) {
  const [managerName, setManagerName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      console.log('Adding member with data:', {
        league_id: leagueId,
        manager_name: managerName,
        team_name: teamName,
        payment_status: 'pending'
      })
      console.log('League ID type:', typeof leagueId, 'Value:', leagueId)

      // Try a simple test first - just select from league_members
      const testQuery = await supabase.from('league_members').select('*').limit(1)
      console.log('Test league_members query:', testQuery)

      // Try the actual insert
      const insertResult = await supabase
        .from('league_members')
        .insert([
          {
            league_id: leagueId,
            manager_name: managerName,
            team_name: teamName,
            payment_status: 'pending'
          }
        ])

      console.log('Insert result (without select):', insertResult)

      // Try to get the inserted data separately
      if (!insertResult.error) {
        const selectResult = await supabase
          .from('league_members')
          .select('*')
          .eq('league_id', leagueId)
          .eq('manager_name', managerName)

        console.log('Select after insert:', selectResult)
      }

      if (insertResult.error) {
        console.error('Insert error details:', {
          message: insertResult.error.message,
          details: insertResult.error.details,
          hint: insertResult.error.hint,
          code: insertResult.error.code,
          full: insertResult.error
        })
        throw new Error(insertResult.error.message || 'Database insert failed')
      }

      console.log('Member added successfully')
      setManagerName('')
      setTeamName('')
      onMemberAdded()
      onClose()
    } catch (err) {
      console.error('Error adding member:', err)
      setError(`Failed to add member: ${err instanceof Error ? err.message : JSON.stringify(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Add League Member</h2>
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
            <label htmlFor="managerName" className="block text-sm font-medium text-gray-700 mb-2">
              Manager Name
            </label>
            <input
              type="text"
              id="managerName"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter manager name"
              required
            />
          </div>

          <div>
            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-2">
              Team Name
            </label>
            <input
              type="text"
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter team name"
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
              {isLoading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}