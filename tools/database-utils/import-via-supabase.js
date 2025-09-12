// Import historical season data via Supabase client
// Alternative to direct psql connection for Gridiron Gurus 2024

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oqsyxmomvcfwnhmjaysb.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Gridiron Gurus 2024 data
const gridironGurus2024 = {
  league_name: 'Gridiron Gurus',
  season: '2024',
  season_config: {
    fee_amount: 20.00,
    draft_food_cost: 0.00,
    weekly_prize_amount: 0.00,
    total_weeks: 17,
    playoff_spots: 6,
    playoff_start_week: 15,
    prize_structure: {
      first: 100.00,
      second: 60.00,
      third: 40.00,
      highest_points: 0.00
    }
  },
  teams: [
    {"manager_name": "Mihir Sriram Aranala", "team_name": "Aranala Boyz", "scores": [116.34, 141.84, 147.02, 126.8, 168.62, 122.96, 135.24, 145.84, 160.78, 152.08, 162.52, 168.56, 146.58, 168.02, 201.7, 190.46, 193.9]},
    {"manager_name": "Sai Kaliappan Namasivayam", "team_name": "Chennaiyin FC", "scores": [132.72, 151.08, 108.42, 141.28, 108.2, 152.84, 183.12, 174.66, 146.3, 90.44, 184.82, 154.82, 153.36, 149.68, 140.36, 243.56, 185.24]},
    {"manager_name": "Rithvik Chokkam", "team_name": "Take Mahomes Country Road", "scores": [125.46, 157.8, 187.3, 154.48, 148.84, 151.12, 134.82, 139.0, 114.56, 146.24, 176.38, 106.48, 141.18, 184.24, 140.36, 182.14, 168.42]},
    {"manager_name": "Vivek D C", "team_name": "Blue Devils", "scores": [128.06, 98.42, 156.16, 160.84, 145.96, 115.94, 122.5, 156.44, 143.84, 123.24, 105.12, 127.74, 127.02, 144.96, 140.36, 144.18, 133.62]},
    {"manager_name": "Rene M", "team_name": "Tuafinity and Beyond", "scores": [168.16, 143.5, 110.88, 153.74, 155.02, 152.66, 107.7, 167.22, 184.86, 111.34, 115.48, 172.58, 142.38, 119.62, 142.32, 140.08, 160.6]},
    {"manager_name": "Deebthik Ravi", "team_name": "Team Deebs", "scores": [129.94, 143.94, 103.36, 134.52, 155.02, 147.68, 93.96, 125.32, 166.1, 122.06, 148.78, 115.88, 102.06, 143.92, 93.36, 130.86, 80.76]},
    {"manager_name": "Anand James", "team_name": "CarryRunSometimesKickBall", "scores": [129.46, 105.8, 87.8, 114.72, 165.26, 103.42, 107.7, 153.38, 160.78, 135.52, 141.72, 127.74, 167.76, 126.8, 115.28, 123.82, 128.86]},
    {"manager_name": "Adam Levin", "team_name": "Levin's Warriors", "scores": [130.48, 151.56, 121.7, 120.48, 136.54, 151.12, 97.24, 121.24, 106.32, 121.28, 141.72, 133.08, 138.22, 115.16, 155.84, 162.72, 120.68]},
    {"manager_name": "Gopik Anand", "team_name": "Not Real ⚽ FC", "scores": [146.0, 139.26, 94.72, 118.76, 137.16, 149.96, 119.1, 167.22, 138.5, 172.06, 136.92, 89.2, 153.36, 172.6, 134.98, 108.52, 160.38]},
    {"manager_name": "Raahul vignesh Manikandan", "team_name": "Arvus Radiance", "scores": [93.92, 105.32, 114.9, 135.56, 122.64, 168.58, 116.36, 153.38, 157.22, 106.98, 115.48, 112.78, 139.98, 144.16, 143.76, 69.52, 95.72]}
  ],
  matchups: [
    {"week": 1, "team1": "Gopik Anand", "team2": "Raahul vignesh Manikandan"},
    {"week": 1, "team1": "Deebthik Ravi", "team2": "Vivek D C"},
    {"week": 1, "team1": "Mihir Sriram Aranala", "team2": "Rene M"},
    {"week": 1, "team1": "Sai Kaliappan Namasivayam", "team2": "Adam Levin"},
    {"week": 1, "team1": "Rithvik Chokkam", "team2": "Anand James"},
    {"week": 17, "team1": "Mihir Sriram Aranala", "team2": "Sai Kaliappan Namasivayam", "playoff_type": "championship"},
    {"week": 17, "team1": "Vivek D C", "team2": "Rithvik Chokkam", "playoff_type": "third_place"},
    {"week": 17, "team1": "Rene M", "team2": "Deebthik Ravi"},
    {"week": 17, "team1": "Adam Levin", "team2": "Anand James"},
    {"week": 17, "team1": "Raahul vignesh Manikandan", "team2": "Gopik Anand"}
  ]
};

async function importHistoricalSeason() {
  try {
    console.log('=== STARTING GRIDIRON GURUS 2024 IMPORT ===');
    
    // Step 1: Get or create league
    let { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('name', gridironGurus2024.league_name)
      .single();
    
    if (leagueError && leagueError.code !== 'PGRST116') {
      throw leagueError;
    }
    
    if (!league) {
      const { data: newLeague, error: createError } = await supabase
        .from('leagues')
        .insert({
          name: gridironGurus2024.league_name,
          current_season: gridironGurus2024.season
        })
        .select('id')
        .single();
      
      if (createError) throw createError;
      league = newLeague;
      console.log(`✅ Created new league: ${gridironGurus2024.league_name}`);
    } else {
      console.log(`✅ Using existing league: ${gridironGurus2024.league_name}`);
    }
    
    const leagueId = league.id;
    
    // Step 2: Clear existing data for this season
    await supabase
      .from('weekly_scores')
      .delete()
      .eq('league_id', leagueId)
      .eq('season', gridironGurus2024.season);
    
    await supabase
      .from('matchups')
      .delete()
      .eq('league_id', leagueId)
      .eq('season', gridironGurus2024.season);
    
    await supabase
      .from('league_members')
      .delete()
      .eq('league_id', leagueId)
      .eq('season', gridironGurus2024.season);
    
    await supabase
      .from('league_seasons')
      .delete()
      .eq('league_id', leagueId)
      .eq('season', gridironGurus2024.season);
    
    console.log('✅ Cleared existing season data');
    
    // Step 3: Create season configuration
    const { error: seasonError } = await supabase
      .from('league_seasons')
      .insert({
        league_id: leagueId,
        season: gridironGurus2024.season,
        fee_amount: gridironGurus2024.season_config.fee_amount,
        draft_food_cost: gridironGurus2024.season_config.draft_food_cost,
        weekly_prize_amount: gridironGurus2024.season_config.weekly_prize_amount,
        total_weeks: gridironGurus2024.season_config.total_weeks,
        playoff_spots: gridironGurus2024.season_config.playoff_spots,
        playoff_start_week: gridironGurus2024.season_config.playoff_start_week,
        prize_structure: gridironGurus2024.season_config.prize_structure
      });
    
    if (seasonError) throw seasonError;
    console.log('✅ Created season configuration');
    
    // Step 4: Import teams and scores
    let importedTeams = 0;
    let importedScores = 0;
    const memberMap = new Map();
    
    for (const team of gridironGurus2024.teams) {
      // Create league member
      const { data: member, error: memberError } = await supabase
        .from('league_members')
        .insert({
          league_id: leagueId,
          manager_name: team.manager_name,
          team_name: team.team_name,
          season: gridironGurus2024.season,
          payment_status: 'completed',
          is_active: true
        })
        .select('id')
        .single();
      
      if (memberError) throw memberError;
      
      memberMap.set(team.manager_name, member.id);
      importedTeams++;
      
      // Import weekly scores
      const weeklyScores = team.scores.map((score, index) => ({
        league_id: leagueId,
        member_id: member.id,
        week_number: index + 1,
        points: score,
        season: gridironGurus2024.season,
        is_playoff_week: (index + 1) >= gridironGurus2024.season_config.playoff_start_week
      }));
      
      const { error: scoresError } = await supabase
        .from('weekly_scores')
        .insert(weeklyScores);
      
      if (scoresError) throw scoresError;
      
      importedScores += team.scores.length;
      console.log(`✅ Imported ${team.manager_name} (${team.team_name}) - ${team.scores.length} scores`);
    }
    
    // Step 5: Import matchups
    let importedMatchups = 0;
    
    for (const matchup of gridironGurus2024.matchups) {
      const team1Id = memberMap.get(matchup.team1);
      const team2Id = memberMap.get(matchup.team2);
      
      if (!team1Id || !team2Id) {
        console.warn(`⚠️ Skipping matchup - teams not found: ${matchup.team1} vs ${matchup.team2}`);
        continue;
      }
      
      const { error: matchupError } = await supabase
        .from('matchups')
        .insert({
          league_id: leagueId,
          season: gridironGurus2024.season,
          week_number: matchup.week,
          team1_member_id: team1Id,
          team2_member_id: team2Id,
          playoff_type: matchup.playoff_type || null
        });
      
      if (matchupError) throw matchupError;
      importedMatchups++;
    }
    
    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Teams imported: ${importedTeams}`);
    console.log(`Weekly scores imported: ${importedScores}`);
    console.log(`Matchups imported: ${importedMatchups}`);
    console.log(`League: ${gridironGurus2024.league_name}`);
    console.log(`Season: ${gridironGurus2024.season}`);
    console.log(`Entry Fee: $${gridironGurus2024.season_config.fee_amount}`);
    
    // Step 6: Verification
    const { data: teams, error: teamsError } = await supabase
      .from('league_members')
      .select('manager_name, team_name')
      .eq('league_id', leagueId)
      .eq('season', gridironGurus2024.season);
    
    if (teamsError) throw teamsError;
    
    const { data: scores, error: scoresError } = await supabase
      .from('weekly_scores')
      .select('points')
      .eq('league_id', leagueId)
      .eq('season', gridironGurus2024.season);
    
    if (scoresError) throw scoresError;
    
    const { data: matchups, error: matchupsError } = await supabase
      .from('matchups')
      .select('week_number, playoff_type')
      .eq('league_id', leagueId)
      .eq('season', gridironGurus2024.season);
    
    if (matchupsError) throw matchupsError;
    
    console.log('\n=== VERIFICATION ===');
    console.log(`Teams in database: ${teams.length}`);
    console.log(`Scores in database: ${scores.length}`);
    console.log(`Matchups in database: ${matchups.length}`);
    console.log(`Championship games: ${matchups.filter(m => m.playoff_type === 'championship').length}`);
    console.log(`3rd place games: ${matchups.filter(m => m.playoff_type === 'third_place').length}`);
    
    if (scores.length > 0) {
      const avgScore = scores.reduce((sum, s) => sum + s.points, 0) / scores.length;
      const minScore = Math.min(...scores.map(s => s.points));
      const maxScore = Math.max(...scores.map(s => s.points));
      console.log(`Score range: ${minScore.toFixed(2)} - ${maxScore.toFixed(2)} (avg: ${avgScore.toFixed(2)})`);
    }
    
    console.log('\n🎉 Import successful! Check the web interface to verify standings and results.');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  importHistoricalSeason();
}

module.exports = { importHistoricalSeason };