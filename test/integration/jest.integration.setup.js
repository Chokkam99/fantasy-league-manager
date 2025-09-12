/**
 * Global setup for integration tests
 * This file runs once before all integration tests
 */

const { createClient } = require('@supabase/supabase-js')

module.exports = async () => {
  console.log('🔧 Setting up integration test environment...')

  // Set up test environment variables
  process.env.NODE_ENV = 'test'
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'

  try {
    // Initialize Supabase client for setup
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Clean up any existing test data
    console.log('🧹 Cleaning up test data...')
    
    // Delete test leagues and related data
    const testLeagueIds = ['test-league-integration', 'test-api-league', 'test-ui-league']
    
    for (const leagueId of testLeagueIds) {
      try {
        // Delete in reverse order of dependencies
        await supabase.from('weekly_scores').delete().eq('league_id', leagueId)
        await supabase.from('matchups').delete().eq('league_id', leagueId)
        await supabase.from('league_members').delete().eq('league_id', leagueId)
        await supabase.from('league_seasons').delete().eq('league_id', leagueId)
        await supabase.from('leagues').delete().eq('id', leagueId)
      } catch (error) {
        // Ignore cleanup errors - tables might not exist or data might not be present
        console.log(`⚠️  Warning: Could not clean up ${leagueId}:`, error.message)
      }
    }

    console.log('✅ Integration test environment setup complete')

  } catch (error) {
    console.error('❌ Failed to set up integration test environment:', error)
    // Don't fail the tests if setup fails - some tests might still be runnable
  }
}