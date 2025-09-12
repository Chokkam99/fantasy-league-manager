'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PlatformFactory } from '@/lib/platform/factory'
import { PlatformType, PlatformConfig, WeekImportData } from '@/lib/platform/types'

interface PlatformImportProps {
  leagueId: string
  season: string
}

export default function PlatformImport({ leagueId, season }: PlatformImportProps) {
  const [platformConfig, setPlatformConfig] = useState<Partial<PlatformConfig>>({
    platform_type: 'manual',
    year: parseInt(season),
    private_league: false,
    credentials: {}
  })
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<WeekImportData | null>(null)
  const [currentWeek, setCurrentWeek] = useState<number>(1)
  const [importStatus, setImportStatus] = useState<string>('')
  const [showConfig, setShowConfig] = useState(false)
  const [supportedPlatforms] = useState(PlatformFactory.getSupportedPlatforms())

  // Initialize platform configuration from localStorage on component mount
  useEffect(() => {
    loadPlatformConfig()
  }, [leagueId])

  const loadPlatformConfig = async () => {
    try {
      const { data: league } = await supabase
        .from('leagues')
        .select('platform_config, platform_league_id, platform_type')
        .eq('id', leagueId)
        .single()

      if (league?.platform_type !== 'manual' && league?.platform_config) {
        const config = league.platform_config as PlatformConfig
        setPlatformConfig({
          ...config,
          league_id: league.platform_league_id,
          year: parseInt(season)
        })
        setIsConfigured(true)
        
        // Auto-detect current week from the configured platform
        if (config.league_id) {
          try {
            const importService = PlatformFactory.createImportService(leagueId, season, config as PlatformConfig)
            const week = await importService.getCurrentWeek()
            setCurrentWeek(week)
          } catch (error) {
            console.error('Failed to get current week:', error)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load platform config:', error)
    }
  }

  const savePlatformConfig = async () => {
    if (!platformConfig.league_id) {
      alert('Please enter League ID')
      return
    }

    if (platformConfig.platform_type === 'manual') {
      alert('Manual leagues do not support automatic import')
      return
    }

    setIsLoading(true)
    try {
      const config: PlatformConfig = {
        platform_type: platformConfig.platform_type!,
        league_id: platformConfig.league_id,
        year: parseInt(season),
        private_league: platformConfig.private_league || false,
        credentials: platformConfig.credentials || {}
      }

      // Test connection first
      const importService = PlatformFactory.createImportService(leagueId, season, config)
      const connectionTest = await importService.testConnection()
      
      if (!connectionTest) {
        alert(`Failed to connect to ${PlatformFactory.getPlatformName(config.platform_type)}. Please check your configuration.`)
        return
      }

      // Save configuration to database
      const { error } = await supabase
        .from('leagues')
        .update({
          platform_type: platformConfig.platform_type,
          platform_league_id: platformConfig.league_id,
          platform_config: config,
          sync_status: 'active'
        })
        .eq('id', leagueId)

      if (error) {
        throw error
      }

      // Get current week
      const week = await importService.getCurrentWeek()
      setCurrentWeek(week)
      setIsConfigured(true)
      setShowConfig(false)
      setImportStatus(`${PlatformFactory.getPlatformName(config.platform_type)} configuration saved successfully!`)
      
      setTimeout(() => setImportStatus(''), 3000)
    } catch (error) {
      console.error('Failed to save platform config:', error)
      alert(`Failed to save platform configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const previewWeek = async (week: number) => {
    if (!isConfigured || !platformConfig.league_id || platformConfig.platform_type === 'manual') return

    setIsLoading(true)
    try {
      const config = platformConfig as PlatformConfig
      const importService = PlatformFactory.createImportService(leagueId, season, config)
      const preview = await importService.previewWeek(week)
      setPreviewData(preview)
    } catch (error) {
      console.error('Failed to preview week:', error)
      alert('Failed to preview week data. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const importWeek = async (week: number) => {
    if (!isConfigured || !platformConfig.league_id || platformConfig.platform_type === 'manual') return

    setIsLoading(true)
    setImportStatus(`Importing week ${week}...`)
    
    try {
      const config = platformConfig as PlatformConfig
      const importService = PlatformFactory.createImportService(leagueId, season, config)
      const result = await importService.importWeek(week)
      
      setImportStatus(result.message)
      setPreviewData(null)
      
      // Clear status after 5 seconds
      setTimeout(() => setImportStatus(''), 5000)
    } catch (error) {
      console.error('Failed to import week:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setImportStatus(`Import failed: ${errorMessage}`)
      
      // Clear error status after 8 seconds
      setTimeout(() => setImportStatus(''), 8000)
    } finally {
      setIsLoading(false)
    }
  }

  const updateConfigField = (key: string, value: string | boolean) => {
    if (key === 'platform_type') {
      setPlatformConfig({
        platform_type: value as PlatformType,
        year: parseInt(season),
        credentials: {}
      })
    } else if (key === 'league_id' || key === 'private_league') {
      setPlatformConfig({...platformConfig, [key]: value})
    } else {
      // Credential field
      setPlatformConfig({
        ...platformConfig,
        credentials: {
          ...platformConfig.credentials,
          [key]: value as string
        }
      })
    }
  }

  const currentPlatformName = PlatformFactory.getPlatformName(platformConfig.platform_type || 'manual')
  const configFields = PlatformFactory.getRequiredFields(platformConfig.platform_type || 'manual')
  const canImport = isConfigured && platformConfig.platform_type !== 'manual'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          📊 Platform Integration
          {canImport && (
            <span className="ml-2 text-sm font-normal text-gray-600">
              ({currentPlatformName})
            </span>
          )}
        </h3>
        {!showConfig && (
          <button
            onClick={() => setShowConfig(true)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {isConfigured ? 'Update Configuration' : 'Setup Integration'}
          </button>
        )}
      </div>

      {/* Configuration Form */}
      {showConfig && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Platform Configuration</h4>
          
          {/* Platform Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fantasy Platform
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {supportedPlatforms.map((platform) => (
                <label key={platform.type} className={`
                  flex items-center p-3 border rounded-lg cursor-pointer
                  ${platform.available ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}
                  ${platformConfig.platform_type === platform.type ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                `}>
                  <input
                    type="radio"
                    name="platform"
                    value={platform.type}
                    checked={platformConfig.platform_type === platform.type}
                    onChange={(e) => updateConfigField('platform_type', e.target.value)}
                    disabled={!platform.available}
                    className="sr-only"
                  />
                  <div className="text-center w-full">
                    <div className="text-sm font-medium">{platform.name}</div>
                    {!platform.available && (
                      <div className="text-xs text-gray-500">Coming Soon</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Platform-specific Fields */}
          {configFields.length > 0 && (
            <div className="space-y-4">
              {configFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  {field.type === 'checkbox' ? (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={platformConfig[field.key as keyof PlatformConfig] as boolean || false}
                        onChange={(e) => updateConfigField(field.key, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{field.help}</span>
                    </label>
                  ) : (
                    <>
                      <input
                        type={field.type}
                        value={
                          field.key === 'league_id' 
                            ? platformConfig.league_id || ''
                            : (platformConfig.credentials?.[field.key] || '')
                        }
                        onChange={(e) => updateConfigField(field.key, e.target.value)}
                        placeholder={field.help}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {field.help && field.type !== 'password' && (
                        <p className="text-xs text-gray-500 mt-1">{field.help}</p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={savePlatformConfig}
              disabled={isLoading || !platformConfig.league_id || platformConfig.platform_type === 'manual'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Testing...' : 'Save & Test Connection'}
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Import Controls */}
      {canImport && !showConfig && (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Week Selection */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Week:</label>
                <select
                  value={currentWeek}
                  onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                >
                  {Array.from({ length: 17 }, (_, i) => i + 1).map(week => (
                    <option key={week} value={week}>Week {week}</option>
                  ))}
                </select>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 flex-1">
                <button
                  onClick={() => previewWeek(currentWeek)}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : 'Preview'}
                </button>
                
                <button
                  onClick={() => importWeek(currentWeek)}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
            
            {/* Help Text */}
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600 space-y-1">
              <div><strong>Preview:</strong> Review data before importing</div>
              <div><strong>Import:</strong> Add scores and matchup results to database</div>
            </div>
          </div>

          {/* Import Status */}
          {importStatus && (
            <div className={`p-4 rounded-lg border text-sm font-medium ${
              importStatus.includes('failed') || importStatus.includes('Failed') || importStatus.includes('error')
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${
                  importStatus.includes('failed') || importStatus.includes('Failed') || importStatus.includes('error')
                    ? 'bg-red-400'
                    : 'bg-green-400'
                }`}></span>
                <span>{importStatus}</span>
              </div>
            </div>
          )}

          {/* Preview Data */}
          {previewData && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">
                Week {previewData.week} Preview 
                {previewData.is_complete ? (
                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Complete</span>
                ) : (
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">In Progress</span>
                )}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Scores ({previewData.scores.length})</h5>
                  <div className="space-y-1 max-h-96 overflow-y-auto bg-white rounded-lg border border-gray-200 p-4">
                    {previewData.scores
                      .sort((a, b) => b.points - a.points) // Sort by points descending
                      .map((score, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm py-2 px-3 hover:bg-gray-50 rounded border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500 font-mono w-8 text-center">#{idx + 1}</span>
                          <span className="font-medium text-gray-700">{score.team_name}</span>
                        </div>
                        <span className="font-mono text-lg font-semibold text-blue-600">{score.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Matchups ({previewData.matchups.length})</h5>
                  <div className="space-y-2 max-h-96 overflow-y-auto bg-white rounded-lg border border-gray-200 p-4">
                    {previewData.matchups.map((matchup, idx) => {
                      const team1 = previewData.scores.find(s => s.member_id === matchup.team1_member_id);
                      const team2 = previewData.scores.find(s => s.member_id === matchup.team2_member_id);
                      
                      // Calculate scores and winner from the scores data
                      const team1Score = team1?.points || 0;
                      const team2Score = team2?.points || 0;
                      const isTie = team1Score === team2Score;
                      const winnerId = isTie ? null : (team1Score > team2Score ? matchup.team1_member_id : matchup.team2_member_id);
                      
                      const isTeam1Winner = winnerId === matchup.team1_member_id;
                      const isTeam2Winner = winnerId === matchup.team2_member_id;
                      
                      return (
                        <div key={idx} className="text-sm border-l-4 border-blue-200 pl-3 py-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-2">
                              <span className={`font-medium ${isTeam1Winner ? 'text-green-700' : 'text-gray-700'}`}>
                                {team1?.team_name || 'Unknown Team'}
                              </span>
                              <span className="text-gray-400">vs</span>
                              <span className={`font-medium ${isTeam2Winner ? 'text-green-700' : 'text-gray-700'}`}>
                                {team2?.team_name || 'Unknown Team'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <span className={`font-mono text-lg ${isTeam1Winner ? 'font-bold text-green-700' : 'text-gray-600'}`}>
                                {team1Score}
                              </span>
                              <span className="text-gray-400">-</span>
                              <span className={`font-mono text-lg ${isTeam2Winner ? 'font-bold text-green-700' : 'text-gray-600'}`}>
                                {team2Score}
                              </span>
                            </div>
                            <div className="text-xs">
                              {isTie ? (
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Tie</span>
                              ) : winnerId ? (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                  {isTeam1Winner ? team1?.team_name : team2?.team_name} wins
                                </span>
                              ) : (
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">In Progress</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {!previewData.is_complete && (
                <div className="mt-3 p-2 bg-yellow-100 text-yellow-700 text-xs rounded">
                  ⚠️ Week appears incomplete. Consider waiting until Tuesday or later to import final scores.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      {!canImport && !showConfig && (
        <div className="text-sm text-gray-600">
          <p>Import weekly scores and matchup results directly from fantasy platforms.</p>
          <p className="mt-1">Click &quot;Setup Integration&quot; to configure your platform connection.</p>
        </div>
      )}
    </div>
  )
}