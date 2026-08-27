import 'dotenv/config'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { analyzeCleanupCandidates } = require('./lib/legacy-cleanup-audit.cjs')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseReadKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  supabaseAnonKey

if (!supabaseUrl || !supabaseReadKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase read credential.')
  process.exit(1)
}

const pageSize = 500
const headers = {
  apikey: supabaseReadKey,
  Authorization: `Bearer ${supabaseReadKey}`,
}

async function readAll(resource, columns) {
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`/rest/v1/${resource}`, supabaseUrl)
    url.searchParams.set('select', columns)
    url.searchParams.set('limit', String(pageSize))
    url.searchParams.set('offset', String(offset))
    const response = await fetch(url, { headers, method: 'GET' })
    const body = await response.json().catch(() => null)
    if (!response.ok || !Array.isArray(body)) {
      const code = body && typeof body.code === 'string' ? ` (${body.code})` : ''
      throw new Error(`Read-only ${resource} audit failed with HTTP ${response.status}${code}.`)
    }
    rows.push(...body)
    if (body.length < pageSize) return rows
  }
}

try {
  const [leagues, seasons, members, scores] = await Promise.all([
    readAll('leagues', 'id,current_season'),
    readAll(
      'league_seasons',
      'league_id,season,is_active,fee_amount,draft_food_cost,weekly_prize_amount,total_weeks,prize_structure,final_winners',
    ),
    readAll('league_members', 'id,league_id,season,is_active'),
    readAll(
      'weekly_scores',
      'league_id,member_id,week_number,season,points,week_status,is_final_score',
    ),
  ])

  const analysis = analyzeCleanupCandidates({ leagues, members, scores, seasons })
  console.log(
    JSON.stringify(
      {
        audited_at: new Date().toISOString(),
        privacy:
          'Aggregate output only: league identifiers are hashed; names, raw IDs, point values, credentials, and row payloads are never printed.',
        read_credential:
          supabaseReadKey === supabaseAnonKey
            ? 'anonymous key'
            : 'server key (GET-only command)',
        read_only: true,
        ...analysis,
      },
      null,
      2,
    ),
  )
} catch (error) {
  console.error(
    `Cleanup candidate audit failed: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
}
