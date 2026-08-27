import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import process from 'node:process'
import { promisify } from 'node:util'

const keychainService = 'fantasy-league-manager'
const keychainAccount = 'ADMIN_SESSION_SECRET'

async function storeInKeychain(secret) {
  if (process.platform !== 'darwin') {
    throw new Error('macOS Keychain storage is available only on macOS.')
  }

  await promisify(execFile)('security', [
    'add-generic-password',
    '-U',
    '-s',
    keychainService,
    '-a',
    keychainAccount,
    '-w',
    secret,
  ])
}

async function main() {
  const secret = randomBytes(32).toString('base64')

  if (process.argv.includes('--keychain')) {
    await storeInKeychain(secret)
    process.stdout.write(
      `Stored ${keychainAccount} in macOS Keychain for local development.\n`,
    )
    return
  }

  process.stdout.write('Set this server-only environment value:\n')
  process.stdout.write(`ADMIN_SESSION_SECRET=${secret}\n`)
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Session-secret setup failed.'}\n`,
  )
  process.exitCode = 1
})
