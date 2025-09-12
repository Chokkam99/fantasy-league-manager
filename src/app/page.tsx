'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CreateLeagueModal from '@/components/CreateLeagueModal'
import LeaguesList from '@/components/LeaguesList'

export default function Home() {
  const router = useRouter()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Check if user is in readonly mode and redirect them back
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isReadOnly = localStorage.getItem('fantasy-readonly-mode') === 'true'
      const readOnlyLeague = localStorage.getItem('fantasy-readonly-league')
      
      if (isReadOnly && readOnlyLeague) {
        // Redirect back to the readonly league
        router.replace(`/league/${readOnlyLeague}?readonly=true`)
        return
      }
    }
  }, [router])

  const handleLeagueCreated = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-claude-text">
            Fantasy League Manager
          </h1>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            Create League
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <LeaguesList refresh={refreshKey} />
      </main>

      <CreateLeagueModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onLeagueCreated={handleLeagueCreated}
      />

      <footer className="bg-claude-surface border-t border-claude-border px-6 py-8 mt-16">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-claude-text-light">
            Fantasy League Manager - Streamline your fantasy football league management
          </p>
        </div>
      </footer>
    </div>
  );
}
