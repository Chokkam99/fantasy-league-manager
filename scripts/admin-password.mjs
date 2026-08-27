import { execFile } from 'node:child_process'
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import process from 'node:process'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const keychainService = 'fantasy-league-manager'
const keychainAccount = 'ADMIN_PASSWORD_HASH'
const maxPasswordBytes = 256
const minimumPasswordCharacters = 12

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('A secure interactive terminal is required.')
  }

  return new Promise((resolve, reject) => {
    let value = ''

    const cleanup = () => {
      process.stdin.off('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup()
          process.stdout.write('\n')
          reject(new Error('Password setup cancelled.'))
          return
        }

        if (character === '\r' || character === '\n') {
          cleanup()
          process.stdout.write('\n')
          resolve(value)
          return
        }

        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
          continue
        }

        if (character >= ' ') value += character
      }
    }

    process.stdout.write(prompt)
    process.stdin.setEncoding('utf8')
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

async function createHash(password) {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, 32, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
    p: 3,
    r: 8,
  })

  return [
    'scrypt',
    'v1',
    '32768',
    '8',
    '3',
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('.')
}

async function storeInKeychain(hash) {
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
    hash,
  ])
}

async function main() {
  const password = await readHidden('New commissioner password: ')

  if (
    password.length < minimumPasswordCharacters ||
    Buffer.byteLength(password, 'utf8') > maxPasswordBytes
  ) {
    throw new Error(
      `Use at least ${minimumPasswordCharacters} characters and no more than ${maxPasswordBytes} UTF-8 bytes.`,
    )
  }

  const confirmation = await readHidden('Confirm commissioner password: ')
  if (password !== confirmation) {
    throw new Error('Passwords do not match.')
  }

  const hash = await createHash(password)

  if (process.argv.includes('--keychain')) {
    await storeInKeychain(hash)
    process.stdout.write(
      `Stored ${keychainAccount} in macOS Keychain for local development.\n`,
    )
    return
  }

  process.stdout.write('\nSet this server-only environment value:\n')
  process.stdout.write(`ADMIN_PASSWORD_HASH=${hash}\n`)
  process.stdout.write('The password itself was not stored or printed.\n')
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Password setup failed.'}\n`,
  )
  process.exitCode = 1
})
