import 'dotenv/config'

import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const confirmationFlag = '--confirm-read-only-production-export'
const outputFlagIndex = process.argv.indexOf('--output')
const requestedOutput =
  outputFlagIndex >= 0 ? process.argv[outputFlagIndex + 1] : undefined

if (!process.argv.includes(confirmationFlag) || !requestedOutput) {
  console.error(
    `Usage: node scripts/export-production-rollback.mjs --output data/rollout-backups/<name> ${confirmationFlag}`,
  )
  process.exit(1)
}

const allowedRoot = path.resolve('data/rollout-backups')
const outputDirectory = path.resolve(requestedOutput)
const relativeOutput = path.relative(allowedRoot, outputDirectory)

if (
  relativeOutput.length === 0 ||
  relativeOutput.startsWith(`..${path.sep}`) ||
  relativeOutput === '..' ||
  path.isAbsolute(relativeOutput)
) {
  console.error('The export directory must be a child of data/rollout-backups/.')
  process.exit(1)
}

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

const resources = [
  'leagues',
  'league_seasons',
  'league_members',
  'weekly_scores',
  'matchups',
  'payments',
]
const pageSize = 500
const headers = {
  apikey: supabaseReadKey,
  Authorization: `Bearer ${supabaseReadKey}`,
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function digest(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

async function readAll(resource) {
  const rows = []

  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`/rest/v1/${resource}`, supabaseUrl)
    url.searchParams.set('select', '*')
    url.searchParams.set('order', 'id.asc')
    url.searchParams.set('limit', String(pageSize))
    url.searchParams.set('offset', String(offset))

    const response = await fetch(url, { headers, method: 'GET' })
    const body = await response.json().catch(() => null)

    if (!response.ok || !Array.isArray(body)) {
      const code = body && typeof body.code === 'string' ? ` (${body.code})` : ''
      throw new Error(
        `Read-only ${resource} export failed with HTTP ${response.status}${code}.`,
      )
    }

    rows.push(...body)
    if (body.length < pageSize) return rows
  }
}

function findRollbackCandidates(data) {
  const memberById = new Map(
    data.league_members.map((member) => [member.id, member]),
  )
  const nullSeasonScores = data.weekly_scores.filter((score) => {
    if (score.season !== null) return false

    const member = memberById.get(score.member_id)
    if (
      !member ||
      member.league_id !== score.league_id ||
      typeof member.season !== 'string' ||
      !/^\d{4}$/.test(member.season)
    ) {
      return false
    }

    const canonicalMatches = data.weekly_scores.filter(
      (candidate) =>
        candidate.league_id === score.league_id &&
        candidate.member_id === score.member_id &&
        candidate.week_number === score.week_number &&
        candidate.season === member.season &&
        candidate.points === score.points,
    )

    return canonicalMatches.length === 1
  })
  const scoreLifecycle = data.weekly_scores.filter(
    (score) =>
      score.week_status === 'completed' && score.is_final_score !== true,
  )
  const currentSeasonByLeague = new Map(
    data.leagues.map((league) => [league.id, league.current_season]),
  )
  const historicalActiveSeasons = data.league_seasons.filter(
    (season) =>
      season.is_active === true &&
      season.season !== currentSeasonByLeague.get(season.league_id),
  )

  if (
    nullSeasonScores.length !== 10 ||
    scoreLifecycle.length !== 24 ||
    historicalActiveSeasons.length !== 6
  ) {
    throw new Error(
      `Rollback candidate count drifted: expected 10/24/6, received ${nullSeasonScores.length}/${scoreLifecycle.length}/${historicalActiveSeasons.length}.`,
    )
  }

  return {
    historical_active_seasons: historicalActiveSeasons,
    null_season_scores: nullSeasonScores,
    score_lifecycle: scoreLifecycle,
  }
}

async function writeProtectedJson(fileName, value) {
  const contents = serialize(value)
  const filePath = path.join(outputDirectory, fileName)
  await writeFile(filePath, contents, { encoding: 'utf8', mode: 0o600 })
  await chmod(filePath, 0o600)
  return { file: fileName, sha256: digest(contents) }
}

try {
  process.umask(0o077)
  await mkdir(outputDirectory, { mode: 0o700, recursive: true })
  await chmod(outputDirectory, 0o700)

  const existingFiles = await readdir(outputDirectory)
  if (existingFiles.length > 0) {
    throw new Error('The export directory must be empty to prevent overwrites.')
  }

  const exportedAt = new Date().toISOString()
  const data = {}

  // Keep production reads sequential and use GET only.
  for (const resource of resources) {
    data[resource] = await readAll(resource)
  }

  const rollbackCandidates = findRollbackCandidates(data)
  const files = []

  for (const resource of resources) {
    files.push(
      await writeProtectedJson(`${resource}.json`, {
        exported_at: exportedAt,
        resource,
        rows: data[resource],
      }),
    )
  }

  files.push(
    await writeProtectedJson('rollback-candidates.json', {
      exported_at: exportedAt,
      ...rollbackCandidates,
    }),
  )

  const manifest = {
    exported_at: exportedAt,
    export_kind: 'GET-only public application-schema logical export',
    limitations:
      'Application tables only; not a transaction snapshot, managed-schema backup, role dump, or provider restore point.',
    read_credential:
      supabaseReadKey === supabaseAnonKey
        ? 'anonymous key'
        : 'server key (GET-only command)',
    counts: Object.fromEntries(
      resources.map((resource) => [resource, data[resource].length]),
    ),
    rollback_candidate_counts: {
      historical_active_seasons:
        rollbackCandidates.historical_active_seasons.length,
      null_season_scores: rollbackCandidates.null_season_scores.length,
      score_lifecycle: rollbackCandidates.score_lifecycle.length,
    },
    files,
  }
  const manifestFile = await writeProtectedJson('manifest.json', manifest)

  for (const { file } of [...files, manifestFile]) {
    JSON.parse(await readFile(path.join(outputDirectory, file), 'utf8'))
  }

  console.log(
    JSON.stringify(
      {
        exported_at: exportedAt,
        output_directory: outputDirectory,
        read_only: true,
        verified_readable_files: files.length + 1,
        counts: manifest.counts,
        rollback_candidate_counts: manifest.rollback_candidate_counts,
      },
      null,
      2,
    ),
  )
} catch (error) {
  console.error(
    `Production rollback export failed: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
}
