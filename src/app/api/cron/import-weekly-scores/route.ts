import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ESPNImportService } from '@/lib/espn/import';

/**
 * Automated Weekly Score Import Cron Job
 *
 * Runs every Tuesday at 3 AM Phoenix time (10 AM UTC)
 * Imports scores for all active leagues from ESPN
 */
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron or has the correct auth token
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('🕐 Starting weekly score import cron job...');

  try {
    // Get all active leagues that have ESPN integration
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select(`
        id,
        name,
        current_season,
        espn_league_id,
        espn_s2,
        espn_swid,
        sync_status
      `)
      .eq('sync_status', 'active')
      .not('espn_league_id', 'is', null);

    if (leaguesError) {
      console.error('Failed to fetch leagues:', leaguesError);
      throw leaguesError;
    }

    if (!leagues || leagues.length === 0) {
      console.log('No active leagues with ESPN integration found');
      return NextResponse.json({
        success: true,
        message: 'No leagues to sync',
        imported: []
      });
    }

    console.log(`📊 Found ${leagues.length} league(s) to sync`);

    const results = [];
    const errors = [];

    // Import scores for each league
    for (const league of leagues) {
      try {
        console.log(`\n🏈 Processing league: ${league.name} (${league.id})`);

        // Initialize ESPN import service
        const espnService = new ESPNImportService(
          league.id,
          league.current_season,
          {
            league_id: league.espn_league_id,
            year: parseInt(league.current_season),
            espn_s2: league.espn_s2,
            swid: league.espn_swid
          }
        );

        // Get current week from ESPN
        const currentWeek = await espnService.getCurrentWeek();
        console.log(`📅 Current week: ${currentWeek}`);

        // Import the current week's scores
        const result = await espnService.importWeek(currentWeek);

        results.push({
          league_id: league.id,
          league_name: league.name,
          week: currentWeek,
          ...result
        });

        console.log(`✅ Successfully imported week ${currentWeek} for ${league.name}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to import scores for league ${league.name}:`, errorMessage);

        errors.push({
          league_id: league.id,
          league_name: league.name,
          error: errorMessage
        });

        // Update league sync status to error
        await supabase
          .from('leagues')
          .update({
            sync_status: 'error',
            last_sync_error: errorMessage
          })
          .eq('id', league.id);
      }
    }

    // Log summary
    console.log('\n📈 Import Summary:');
    console.log(`  ✅ Successful: ${results.length}`);
    console.log(`  ❌ Failed: ${errors.length}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      imported: results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Cron job failed:', error);
    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Allow POST as well for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
