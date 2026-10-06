// Production database operations for the linked Supabase project. The
// database password is read from macOS Keychain (service
// fantasy-league-manager, account SUPABASE_DB_PASSWORD) and the pooler
// connection string from the git-ignored supabase/.temp/pooler-url written by
// `supabase link`. Backups go under the git-ignored data/rollout-backups/.
//
//   backup | backup-with-podman <dir>  read-only pg_dump of the public schema and data
//   dry-run <dir>                      list unapplied migrations and save the plan
//   push                               apply unapplied migrations (asks to confirm)
//   verify                             read-only counts, cleanup and access checks
//   advisors | history                 Supabase security advisors, migration history
import { createHash } from 'node:crypto'
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const service = 'fantasy-league-manager'
const account = 'SUPABASE_DB_PASSWORD'
const allowedRoot = path.resolve('data/rollout-backups')

function fail(message) {
  console.error(message)
  process.exit(1)
}

function readPassword() {
  const result = spawnSync(
    'security',
    ['find-generic-password', '-w', '-s', service, '-a', account],
    { encoding: 'utf8' },
  )

  if (result.status !== 0) {
    fail('The Supabase database password could not be read from Keychain.')
  }

  const password = result.stdout.trim()
  if (!password) fail('The Keychain database password is empty.')
  return password
}

function validatedOutputDirectory(requested) {
  if (!requested) fail('An output directory is required.')
  const resolved = path.resolve(requested)
  const relative = path.relative(allowedRoot, resolved)
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    fail('The output must be a child of data/rollout-backups/.')
  }
  return resolved
}

function run(command, args, env, capture = false) {
  const result = spawnSync(command, args, {
    encoding: capture ? 'utf8' : undefined,
    env: { ...process.env, ...env },
    maxBuffer: 100 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    timeout: 180_000,
  })

  if (result.error) fail(`${command} failed: ${result.error.message}`)
  if (result.status !== 0) {
    if (capture && result.stderr) process.stderr.write(result.stderr)
    fail(`${command} failed with exit code ${result.status ?? 'unknown'}.`)
  }

  return result
}

function checksum(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

async function backup(outputDirectory, password) {
  process.umask(0o077)
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 })
  await chmod(outputDirectory, 0o700)
  if ((await readdir(outputDirectory)).length > 0) {
    fail('The full-dump output directory must be empty.')
  }

  const files = {
    schema: path.join(outputDirectory, 'schema.sql'),
    data: path.join(outputDirectory, 'data.sql'),
  }
  const poolerUrl = new URL(
    (await readFile('supabase/.temp/pooler-url', 'utf8')).trim(),
  )
  const databaseEnv = {
    PGCONNECT_TIMEOUT: '10',
    PGDATABASE: poolerUrl.pathname.replace(/^\//, ''),
    PGHOST: poolerUrl.hostname,
    PGPASSWORD: password,
    PGPORT: poolerUrl.port,
    PGSSLMODE: 'require',
    PGUSER: decodeURIComponent(poolerUrl.username),
  }
  const image = 'public.ecr.aws/supabase/postgres:17.4.1.075'
  const containerPrefix = [
    'run',
    '--rm',
    '--network',
    'host',
    '-e',
    'PGCONNECT_TIMEOUT',
    '-e',
    'PGDATABASE',
    '-e',
    'PGHOST',
    '-e',
    'PGPASSWORD',
    '-e',
    'PGPORT',
    '-e',
    'PGSSLMODE',
    '-e',
    'PGUSER',
    image,
  ]
  const commonDumpArgs = [
    '--schema=public',
    '--no-owner',
    '--no-tablespaces',
    '--no-publications',
    '--no-subscriptions',
    '--lock-wait-timeout=5s',
    '--quote-all-identifiers',
  ]
  const schemaDump = run(
    'podman',
    [...containerPrefix, 'pg_dump', '--schema-only', ...commonDumpArgs],
    databaseEnv,
    true,
  )
  const dataDump = run(
    'podman',
    [...containerPrefix, 'pg_dump', '--data-only', ...commonDumpArgs],
    databaseEnv,
    true,
  )
  await writeFile(files.schema, schemaDump.stdout, { mode: 0o600 })
  await writeFile(files.data, dataDump.stdout, { mode: 0o600 })

  const manifest = {
    created_at: new Date().toISOString(),
    files: {},
    scope:
      'Supabase CLI public application schema and data; provider-managed schemas and cluster roles are excluded.',
  }
  for (const [kind, file] of Object.entries(files)) {
    await chmod(file, 0o600)
    const info = await stat(file)
    if (info.size === 0) fail(`${path.basename(file)} is empty.`)
    const contents = await readFile(file)
    manifest.files[kind] = {
      bytes: info.size,
      file: path.basename(file),
      sha256: checksum(contents),
    }
  }

  const manifestPath = path.join(outputDirectory, 'manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  })
  await chmod(manifestPath, 0o600)
  console.log(JSON.stringify({ output_directory: outputDirectory, ...manifest }, null, 2))
}

async function history(password) {
  const poolerUrl = (await readFile('supabase/.temp/pooler-url', 'utf8')).trim()
  const tableResult = run(
    'psql',
    [
      poolerUrl,
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-Atc',
      "select coalesce(to_regclass('supabase_migrations.schema_migrations')::text, 'absent');",
    ],
    { PGCONNECT_TIMEOUT: '10', PGPASSWORD: password },
    true,
  )
  const table = tableResult.stdout.trim()
  let rows = null

  if (table !== 'absent') {
    const countResult = run(
      'psql',
      [
        poolerUrl,
        '-X',
        '-v',
        'ON_ERROR_STOP=1',
        '-Atc',
        'select count(*) from supabase_migrations.schema_migrations;',
      ],
      { PGCONNECT_TIMEOUT: '10', PGPASSWORD: password },
      true,
    )
    rows = Number.parseInt(countResult.stdout.trim(), 10)
  }

  console.log(JSON.stringify({ history_table: table, history_rows: rows }, null, 2))
}

async function dryRun(outputDirectory, password) {
  const result = run(
    'supabase',
    ['db', 'push', '--linked', '--include-all', '--skip-vault', '--dry-run'],
    { SUPABASE_DB_PASSWORD: password },
    true,
  )
  const output = `${result.stdout}${result.stderr}`
  const planPath = path.join(outputDirectory, 'migration-dry-run.txt')
  await writeFile(planPath, output, { mode: 0o600 })
  await chmod(planPath, 0o600)
  process.stdout.write(output)
  console.log(`Saved dry-run output to ${planPath}.`)
}

function pushMigrations(password) {
  run(
    'supabase',
    ['db', 'push', '--linked', '--include-all', '--skip-vault'],
    { SUPABASE_DB_PASSWORD: password },
  )
}

async function verifyMigration(password) {
  const poolerUrl = (await readFile('supabase/.temp/pooler-url', 'utf8')).trim()
  run(
    'psql',
    [
      poolerUrl,
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      'scripts/sql/post-migration-verify.sql',
    ],
    { PGCONNECT_TIMEOUT: '10', PGPASSWORD: password },
  )
}

function securityAdvisors(password) {
  run(
    'supabase',
    [
      'db',
      'advisors',
      '--linked',
      '--type',
      'security',
      '--level',
      'info',
      '--fail-on',
      'none',
      '--output-format',
      'json',
    ],
    { SUPABASE_DB_PASSWORD: password },
  )
}

async function backupWithPodman(outputDirectory, password) {
  // Starting an already running machine exits non-zero; only a failed dump matters.
  spawnSync('podman', ['machine', 'start', 'podman-machine-default'], { stdio: 'ignore' })
  await backup(outputDirectory, password)
}

const [action, requestedOutput] = process.argv.slice(2)
const password = readPassword()

if (action === 'backup') {
  await backup(validatedOutputDirectory(requestedOutput), password)
} else if (action === 'backup-with-podman') {
  await backupWithPodman(validatedOutputDirectory(requestedOutput), password)
} else if (action === 'history') {
  await history(password)
} else if (action === 'dry-run') {
  await dryRun(validatedOutputDirectory(requestedOutput), password)
} else if (action === 'push') {
  pushMigrations(password)
} else if (action === 'verify') {
  await verifyMigration(password)
} else if (action === 'advisors') {
  securityAdvisors(password)
} else {
  fail('Usage: production-db-keychain.mjs <advisors|backup|backup-with-podman|history|dry-run|push|verify> [output-directory]')
}
