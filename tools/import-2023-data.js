import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const LEAGUE_ID = 'couchball-football'
const SEASON = '2023'

// League members data based on the division standings image
const MEMBERS_DATA = [
  // East Division
  { manager_name: 'Sri Nivas', team_name: 'Jai Balayya', division: 'East' },
  { manager_name: 'Sreekar Javvadi', team_name: 'NE Kicks A$$', division: 'East' },
  { manager_name: 'Go Steel', team_name: 'Go Steel', division: 'East' },
  { manager_name: 'Varun Gopidi', team_name: 'Team ARJUN REDDY', division: 'East' },
  { manager_name: 'Sandeep Panasa', team_name: 'Team panasa', division: 'East' },
  { manager_name: 'Abhinay Venuturumilli', team_name: 'Team Abhi', division: 'East' },
  { manager_name: 'Sailendar Vantipalli', team_name: 'Team darkphoenix', division: 'East' },
  
  // West Division
  { manager_name: 'Rithvik Chokkam', team_name: 'Team Chokkam', division: 'West' },
  { manager_name: 'Shankar Pasala', team_name: 'Team GRIDIRON', division: 'West' },
  { manager_name: 'Team Unpredictables', team_name: 'Team Unpredictables', division: 'West' },
  { manager_name: 'Vivek Kesara', team_name: 'Team T-REX', division: 'West' },
  { manager_name: 'Lalith Gande', team_name: 'Legends Gande', division: 'West' },
  { manager_name: 'P Praveen Reddy', team_name: 'PKR', division: 'West' },
  { manager_name: 'Raja Reddy', team_name: 'Wakanda Warriors(WaWa)', division: 'West' }
]

// Playoff teams based on final standings (top 6)
const PLAYOFF_TEAMS = [
  'Rithvik Chokkam',      // Team Chokkam (13-1) - West #1
  'Sri Nivas',            // Jai Balayya (11-3) - East #1
  'Shankar Pasala',       // Team GRIDIRON (10-4) - West #2
  'Team Unpredictables',  // Team Unpredictables (9-5) - West #3
  'Sreekar Javvadi',      // NE Kicks A$$ (9-5) - East #2
  'Vivek Kesara'          // Team T-REX (8-6) - West #4
]

// Division winners
const DIVISION_WINNERS = [
  'Rithvik Chokkam',  // West Division Winner
  'Sri Nivas'         // East Division Winner
]

async function insertSeasonConfig() {
  console.log('🔄 Inserting season configuration...')
  
  const { data, error } = await supabase
    .from('league_seasons')
    .upsert({
      league_id: LEAGUE_ID,
      season: SEASON,
      fee_amount: 150.00,
      total_weeks: 17,
      weekly_prize_amount: 25.00,
      draft_food_cost: 250.00,
      prize_structure: {
        first: 500,
        second: 350,
        third: 200,
        highest_points: 160
      },
      playoff_spots: 6,
      playoff_start_week: 15
    })
    .select()

  if (error) {
    throw new Error(`Failed to insert season config: ${error.message}`)
  }

  console.log('✅ Season configuration inserted successfully')
  return data
}

async function insertMembers() {
  console.log('🔄 Inserting league members...')
  
  const membersToInsert = MEMBERS_DATA.map(member => ({
    league_id: LEAGUE_ID,
    manager_name: member.manager_name,
    team_name: member.team_name,
    season: SEASON,
    is_active: true,
    payment_status: 'paid'
    // Note: division, is_playoff_team, is_division_winner columns don't exist in current schema
  }))

  const { data, error } = await supabase
    .from('league_members')
    .upsert(membersToInsert, { onConflict: 'league_id,manager_name,season' })
    .select()

  if (error) {
    throw new Error(`Failed to insert members: ${error.message}`)
  }

  console.log(`✅ Inserted ${data.length} league members`)
  return data
}

async function createWeeklyScoresStructure() {
  console.log('🔄 Creating weekly scores structure (placeholder)...')
  
  // Get member IDs
  const { data: members, error: membersError } = await supabase
    .from('league_members')
    .select('id, manager_name')
    .eq('league_id', LEAGUE_ID)
    .eq('season', SEASON)

  if (membersError) {
    throw new Error(`Failed to fetch members: ${membersError.message}`)
  }

  const scoresToInsert = []
  
  // Create placeholder scores for all 17 weeks
  for (const member of members) {
    for (let week = 1; week <= 17; week++) {
      scoresToInsert.push({
        league_id: LEAGUE_ID,
        member_id: member.id,
        week_number: week,
        points: 0.00, // Placeholder - to be updated with actual scores
        season: SEASON,
        is_playoff_week: week >= 15,
        week_status: 'completed'
      })
    }
  }

  // Insert in batches
  const BATCH_SIZE = 50
  let inserted = 0
  
  for (let i = 0; i < scoresToInsert.length; i += BATCH_SIZE) {
    const batch = scoresToInsert.slice(i, i + BATCH_SIZE)
    
    const { error } = await supabase
      .from('weekly_scores')
      .upsert(batch, { onConflict: 'league_id,member_id,week_number,season', ignoreDuplicates: true })

    if (error) {
      throw new Error(`Failed to insert weekly scores batch: ${error.message}`)
    }

    inserted += batch.length
    console.log(`⏳ Inserted ${inserted}/${scoresToInsert.length} weekly score placeholders...`)
  }

  console.log(`✅ Successfully created ${inserted} weekly score placeholders`)
}

async function validateData() {
  console.log('🔄 Validating inserted data...')
  
  // Check total members
  const { data: members, error: membersError } = await supabase
    .from('league_members')
    .select('*')
    .eq('league_id', LEAGUE_ID)
    .eq('season', SEASON)

  if (membersError) {
    throw new Error(`Validation failed - members: ${membersError.message}`)
  }

  // Check total scores
  const { data: scores, error: scoresError } = await supabase
    .from('weekly_scores')
    .select('*')
    .eq('league_id', LEAGUE_ID)
    .eq('season', SEASON)

  if (scoresError) {
    throw new Error(`Validation failed - scores: ${scoresError.message}`)
  }

  console.log('\n📊 Final validation results:')
  console.log(`   - Total members: ${members.length}/14`)
  console.log(`   - Weekly score placeholders: ${scores.length}/${14 * 17}`)

  console.log('\n👥 League members:')
  members.forEach((member, idx) => {
    console.log(`   ${idx + 1}. ${member.team_name} (${member.manager_name})`)
  })
  
  console.log('\n📋 Division structure (from import data):')
  MEMBERS_DATA.forEach(member => {
    const division = member.division
    const emoji = division === 'East' ? '🔷' : '🔶'
    console.log(`   ${emoji} ${member.team_name} (${member.manager_name}) - ${division}`)
  })
}

async function main() {
  try {
    console.log('🚀 Starting 2023 season data import...')
    console.log(`   League ID: ${LEAGUE_ID}`)
    console.log(`   Season: ${SEASON}`)
    console.log('')

    // Step 1: Insert season configuration
    await insertSeasonConfig()

    // Step 2: Insert members with divisions and playoff status
    await insertMembers()

    // Step 3: Create weekly scores structure (placeholders)
    await createWeeklyScoresStructure()

    // Step 4: Validate data
    await validateData()

    console.log('\n🎉 Successfully imported 2023 season structure!')
    console.log('\n⚠️  NEXT STEPS:')
    console.log('   1. Obtain the 2023 ESPN Fantasy Football PDF with all weekly scores')
    console.log('   2. Update weekly_scores table with actual point values (currently all 0.00)')
    console.log('   3. Add actual playoff matchup data')
    console.log('   4. Set final season winners')
    console.log('   5. Test in the web application')

  } catch (error) {
    console.error('\n❌ Error importing data:', error.message)
    console.error('Please check your Supabase connection and try again.')
    process.exit(1)
  }
}

// Run the script
main()