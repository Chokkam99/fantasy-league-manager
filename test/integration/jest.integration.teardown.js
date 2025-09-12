/**
 * Global teardown for integration tests
 * This file runs once after all integration tests complete
 */

const { createClient } = require('@supabase/supabase-js')

module.exports = async () => {
  console.log('🧹 Cleaning up after integration tests...')

  try {
    // Initialize Supabase client for cleanup
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Clean up test data created during integration tests
    const testLeagueIds = ['test-league-integration', 'test-api-league', 'test-ui-league']
    
    for (const leagueId of testLeagueIds) {
      try {
        // Delete in reverse order of dependencies
        await supabase.from('weekly_scores').delete().eq('league_id', leagueId)
        await supabase.from('matchups').delete().eq('league_id', leagueId)
        await supabase.from('league_members').delete().eq('league_id', leagueId)
        await supabase.from('league_seasons').delete().eq('league_id', leagueId)
        await supabase.from('leagues').delete().eq('id', leagueId)
        
        console.log(`✅ Cleaned up test league: ${leagueId}`)
      } catch (error) {
        console.log(`⚠️  Warning: Could not clean up ${leagueId}:`, error.message)
      }
    }

    console.log('✅ Integration test cleanup complete')

  } catch (error) {
    console.error('❌ Failed to clean up after integration tests:', error)
    // Don't fail if cleanup fails
  }
}