import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '..', '..', '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const LEAGUE_ID = '58da0594-9657-4e22-a593-52533bd13c7c'
const SEASON = '2024'

// League members data
const MEMBERS_DATA = [
  { manager_name: 'Sandeep Panasa', team_name: 'Team panasa' },
  { manager_name: 'Varun Gopidi', team_name: 'Team ARJUN REDDY' },
  { manager_name: 'Vivek Kesara', team_name: 'Team T-REX' },
  { manager_name: 'Shankar Pasala', team_name: 'GRIDIRON' },
  { manager_name: 'P Praveen Reddy', team_name: 'PKR' },
  { manager_name: 'Sreekar Javvadi', team_name: 'NE Kicks A$' },
  { manager_name: 'Sailendar Vantipalli', team_name: 'Team darkphoenix' },
  { manager_name: 'Rithvik Chokkam', team_name: 'Team Chokkam' },
  { manager_name: 'Raja Reddy', team_name: 'Wakanda Warriors' },
  { manager_name: 'Lalith Gande', team_name: 'Legends Gande' },
  { manager_name: 'Sri Nivas', team_name: 'Jai Balayya' },
  { manager_name: 'Prashant D', team_name: 'Prashant\'s Pointed Team' }
]

// Weekly scores data (17 weeks for each player)
const WEEKLY_SCORES = {
  'Sandeep Panasa': [141.28, 105.28, 129.62, 102.66, 119.4, 89.6, 146.8, 155.98, 126.42, 120.78, 155.82, 100.78, 125.16, 115.68, 129.62, 182.48, 153.4],
  'Varun Gopidi': [116.66, 117.32, 100.12, 137.14, 131, 124.7, 122.86, 143.64, 142.02, 105.54, 88.8, 128.06, 84.9, 115.9, 88.02, 80.66, 113.88],
  'Vivek Kesara': [100.94, 136.88, 114.94, 89.54, 154.08, 111.2, 96.18, 157.1, 142.8, 139.34, 138.98, 133.52, 127.58, 122.1, 152.6, 118.42, 140.28],
  'Shankar Pasala': [104.92, 124.5, 115.34, 114.24, 143.48, 86.4, 173.98, 120.34, 110.02, 91.5, 128.94, 94.68, 137.04, 110.88, 149.16, 175.9, 169.02],
  'P Praveen Reddy': [102.34, 133.54, 96.22, 116.66, 125.96, 90.64, 84.8, 154.06, 123.62, 86.52, 142.48, 134.62, 83.78, 71.2, 144.64, 116.18, 70.18],
  'Sreekar Javvadi': [119.92, 122.94, 110.28, 108.78, 138.4, 113.08, 116.76, 99.98, 116.28, 111.18, 147.44, 139.86, 158.96, 125.2, 116.68, 121.76, 89.16],
  'Sailendar Vantipalli': [110.12, 101.42, 98.74, 91.94, 100.56, 119.66, 109.46, 113.84, 94.74, 89.8, 132.28, 80.3, 119.02, 103.44, 110.86, 123.08, 137.92],
  'Rithvik Chokkam': [142.38, 143.2, 180.5, 121.52, 109.26, 126.42, 75.8, 137.16, 112.3, 110.36, 135.82, 143.12, 164.52, 157.26, 119.84, 104.78, 127.44],
  'Raja Reddy': [104.16, 116.74, 119.46, 120.68, 91.22, 97.4, 106.96, 109.18, 120.42, 106.5, 142.42, 120.26, 125.5, 99.86, 141.8, 112.2, 129.84],
  'Lalith Gande': [112.06, 137.64, 109.54, 141.26, 117.4, 129.08, 121.16, 159.84, 174.94, 154.6, 115.62, 117.06, 114.66, 147.78, 138.1, 112.36, 147.08],
  'Sri Nivas': [106.06, 118.72, 93.2, 107.44, 125.04, 175.72, 118.04, 119.94, 127.5, 107.84, 119.48, 116.12, 76.78, 134.22, 109.9, 119.98, 87.2],
  'Prashant D': [123.94, 112.76, 112.74, 137.1, 142.34, 104.3, 92.44, 117.6, 139.4, 74.78, 64.58, 90.18, 103.08, 140.52, 99.58, 165, 86.2]
}

async function insertMembers() {
  console.log('🔄 Checking existing league members...')
  
  // Check which members already exist
  const { data: existingMembers } = await supabase
    .from('league_members')
    .select('*')
    .eq('league_id', LEAGUE_ID)
  
  console.log('Existing members:', existingMembers?.map(m => ({ name: m.manager_name, season: m.season })))
  
  const existingNames = new Set(existingMembers?.map(m => m.manager_name) || [])
  
  // Filter out existing members (since constraint is league_id + manager_name)
  const membersToInsert = MEMBERS_DATA
    .filter(member => !existingNames.has(member.manager_name))
    .map(member => ({
      league_id: LEAGUE_ID,
      manager_name: member.manager_name,
      team_name: member.team_name,
      season: SEASON,
      is_active: true,
      payment_status: 'paid'
    }))

  if (membersToInsert.length > 0) {
    console.log(`🔄 Inserting ${membersToInsert.length} new league members...`)

    const { data, error } = await supabase
      .from('league_members')
      .insert(membersToInsert)
      .select()

    if (error) {
      throw new Error(`Failed to insert members: ${error.message}`)
    }

    console.log(`✅ Inserted ${data.length} new league members`)
  } else {
    console.log('✅ All managers already exist in the league')
  }

  // For existing members, we'll work with their existing records
  // The weekly scores will be inserted for 2024 season
  console.log('ℹ️  Note: Existing managers will have 2024 scores added to their records')
  
  return []
}

async function getMemberIds() {
  console.log('🔄 Fetching member IDs...')
  
  const { data, error } = await supabase
    .from('league_members')
    .select('id, manager_name')
    .eq('league_id', LEAGUE_ID)

  if (error) {
    throw new Error(`Failed to fetch member IDs: ${error.message}`)
  }

  // Create a mapping of manager name to member ID
  const memberIdMap = {}
  data.forEach(member => {
    memberIdMap[member.manager_name] = member.id
  })

  console.log(`✅ Found ${data.length} member IDs in league`)
  console.log('Member ID mapping:', Object.keys(memberIdMap))
  return memberIdMap
}

async function insertWeeklyScores(memberIdMap) {
  console.log('🔄 Checking existing weekly scores...')
  
  // Check which scores already exist
  const { data: existingScores } = await supabase
    .from('weekly_scores')
    .select('member_id, week_number')
    .eq('league_id', LEAGUE_ID)
    .eq('season', SEASON)

  const existingScoreKeys = new Set(
    existingScores?.map(s => `${s.member_id}-${s.week_number}`) || []
  )
  
  const scoresToInsert = []
  
  // Build all weekly scores, filtering out existing ones
  for (const [managerName, weeklyScores] of Object.entries(WEEKLY_SCORES)) {
    const memberId = memberIdMap[managerName]
    if (!memberId) {
      throw new Error(`Member ID not found for ${managerName}`)
    }

    weeklyScores.forEach((points, index) => {
      const weekNumber = index + 1
      const scoreKey = `${memberId}-${weekNumber}`
      
      if (!existingScoreKeys.has(scoreKey)) {
        scoresToInsert.push({
          league_id: LEAGUE_ID,
          member_id: memberId,
          week_number: weekNumber,
          points: points,
          season: SEASON
        })
      }
    })
  }

  if (scoresToInsert.length === 0) {
    console.log('✅ All weekly scores already exist')
    return
  }

  console.log(`📊 Preparing to insert ${scoresToInsert.length} new weekly scores...`)
  
  // Insert in batches to avoid hitting size limits
  const BATCH_SIZE = 50
  let inserted = 0
  
  for (let i = 0; i < scoresToInsert.length; i += BATCH_SIZE) {
    const batch = scoresToInsert.slice(i, i + BATCH_SIZE)
    
    const { data, error } = await supabase
      .from('weekly_scores')
      .insert(batch)

    if (error) {
      throw new Error(`Failed to insert weekly scores batch ${i / BATCH_SIZE + 1}: ${error.message}`)
    }

    inserted += batch.length
    console.log(`⏳ Inserted ${inserted}/${scoresToInsert.length} weekly scores...`)
  }

  console.log(`✅ Successfully inserted ${inserted} new weekly scores`)
}

async function validateData(memberIdMap) {
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

  // Calculate some totals for verification
  const totalsByMember = {}
  scores.forEach(score => {
    const member = members.find(m => m.id === score.member_id)
    if (member) {
      totalsByMember[member.manager_name] = (totalsByMember[member.manager_name] || 0) + Number(score.points)
    }
  })

  console.log('\n📈 Final season totals:')
  const sortedTotals = Object.entries(totalsByMember)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
  
  sortedTotals.forEach(([name, total], index) => {
    console.log(`${index + 1}. ${name}: ${total.toFixed(2)} points`)
  })

  console.log(`\n✅ Validation complete:`)
  console.log(`   - Members: ${members.length}/12`)
  console.log(`   - Weekly scores: ${scores.length}/204`)
  console.log(`   - Expected champion: Sandeep Panasa`)
  console.log(`   - Actual leader: ${sortedTotals[0][0]}`)
}

async function main() {
  try {
    console.log('🚀 Starting 2024 season data insertion...')
    console.log(`   League ID: ${LEAGUE_ID}`)
    console.log(`   Season: ${SEASON}`)
    console.log('')

    // Step 1: Insert members
    await insertMembers()

    // Step 2: Get member IDs
    const memberIdMap = await getMemberIds()

    // Step 3: Insert weekly scores
    await insertWeeklyScores(memberIdMap)

    // Step 4: Validate data
    await validateData(memberIdMap)

    console.log('\n🎉 Successfully inserted all 2024 season data!')
    console.log('You can now view the historical data in your app.')

  } catch (error) {
    console.error('\n❌ Error inserting data:', error.message)
    console.error('Please check your Supabase connection and try again.')
    process.exit(1)
  }
}

// Run the script
main()