import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  )
  process.exit(1)
}

const resources = [
  'leagues',
  'league_seasons',
  'league_members',
  'weekly_scores',
  'matchups',
  'payments',
  'playoff_teams',
  'prize_rules',
  'prize_awards',
  'import_runs',
  'matchup_results_with_scores',
]

const headers = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
  Prefer: 'count=exact',
}

function valueType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

async function inspectResource(resource) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${resource}?select=*&limit=1`,
    { headers },
  )
  const body = await response.json()

  if (!response.ok) {
    return {
      resource,
      available: false,
      status: response.status,
      errorCode: body.code ?? 'unknown',
    }
  }

  const firstRow = Array.isArray(body) ? body[0] : undefined
  const count = response.headers.get('content-range')?.split('/')[1] ?? 'unknown'

  return {
    resource,
    available: true,
    count,
    columns: firstRow
      ? Object.fromEntries(
          Object.entries(firstRow)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([column, value]) => [column, valueType(value)]),
        )
      : {},
  }
}

try {
  const results = []

  // Keep requests sequential so the audit is gentle on a small production project.
  for (const resource of resources) {
    results.push(await inspectResource(resource))
  }

  console.log(JSON.stringify({ auditedAt: new Date().toISOString(), results }, null, 2))
} catch (error) {
  console.error(
    `Schema audit failed: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
}
