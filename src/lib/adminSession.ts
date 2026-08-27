import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'

export const ADMIN_SESSION_COOKIE = 'admin_session'
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

const ADMIN_SESSION_VERSION = 'v1'
const ADMIN_SESSION_SECRET_MIN_LENGTH = 32
const CLOCK_SKEW_SECONDS = 60
const ADMIN_PASSWORD_VERSION = 'v1'
const ADMIN_PASSWORD_MAX_LENGTH = 256
const ADMIN_PASSWORD_KEY_LENGTH = 32
const ADMIN_PASSWORD_SALT_LENGTH = 16
const SCRYPT_COST = 32768
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 3
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024

export type AdminPasswordVerification =
  | 'invalid'
  | 'legacy-valid'
  | 'misconfigured'
  | 'valid'

export class AdminSessionConfigurationError extends Error {
  constructor() {
    super(
      `ADMIN_SESSION_SECRET must contain at least ${ADMIN_SESSION_SECRET_MIN_LENGTH} characters.`,
    )
    this.name = 'AdminSessionConfigurationError'
  }
}

// This weak format exists only to support an explicitly opted-in deployment
// transition. New configuration must use createAdminPasswordHash().
export function legacyPasswordHash(password: string): string {
  let hash = 0

  for (let index = 0; index < password.length; index += 1) {
    hash = (hash << 5) - hash + password.charCodeAt(index)
    hash &= hash
  }

  return hash.toString(36)
}

function deriveAdminPasswordKey(
  password: string,
  salt: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      ADMIN_PASSWORD_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        maxmem: SCRYPT_MAX_MEMORY,
        p: SCRYPT_PARALLELIZATION,
        r: SCRYPT_BLOCK_SIZE,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }

        resolve(derivedKey)
      },
    )
  })
}

function isValidPasswordInput(password: string | undefined): password is string {
  return Boolean(
    password &&
      Buffer.byteLength(password, 'utf8') <= ADMIN_PASSWORD_MAX_LENGTH,
  )
}

export async function createAdminPasswordHash(
  password: string,
  salt = randomBytes(ADMIN_PASSWORD_SALT_LENGTH),
): Promise<string> {
  if (!isValidPasswordInput(password)) {
    throw new Error(
      `Commissioner password must contain between 1 and ${ADMIN_PASSWORD_MAX_LENGTH} UTF-8 bytes.`,
    )
  }

  if (salt.length !== ADMIN_PASSWORD_SALT_LENGTH) {
    throw new Error(
      `Commissioner password salt must contain ${ADMIN_PASSWORD_SALT_LENGTH} bytes.`,
    )
  }

  const derivedKey = await deriveAdminPasswordKey(password, salt)

  return [
    'scrypt',
    ADMIN_PASSWORD_VERSION,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('.')
}

function parseAdminPasswordHash(value: string): {
  derivedKey: Buffer
  salt: Buffer
} | null {
  const parts = value.split('.')
  if (
    parts.length !== 7 ||
    parts[0] !== 'scrypt' ||
    parts[1] !== ADMIN_PASSWORD_VERSION ||
    parts[2] !== String(SCRYPT_COST) ||
    parts[3] !== String(SCRYPT_BLOCK_SIZE) ||
    parts[4] !== String(SCRYPT_PARALLELIZATION) ||
    !/^[A-Za-z0-9_-]{22}$/.test(parts[5]) ||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[6])
  ) {
    return null
  }

  const salt = Buffer.from(parts[5], 'base64url')
  const derivedKey = Buffer.from(parts[6], 'base64url')

  if (
    salt.length !== ADMIN_PASSWORD_SALT_LENGTH ||
    derivedKey.length !== ADMIN_PASSWORD_KEY_LENGTH
  ) {
    return null
  }

  return { derivedKey, salt }
}

function timingSafeStringEqual(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)

  return (
    valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer)
  )
}

export async function verifyAdminPassword(
  password: string | undefined,
  expectedHash: string | undefined,
  allowLegacy = false,
): Promise<AdminPasswordVerification> {
  if (!expectedHash || expectedHash.trim() !== expectedHash) {
    return 'misconfigured'
  }

  if (!isValidPasswordInput(password)) return 'invalid'

  if (!expectedHash.startsWith('scrypt.')) {
    if (!allowLegacy) return 'misconfigured'

    return timingSafeStringEqual(legacyPasswordHash(password), expectedHash)
      ? 'legacy-valid'
      : 'invalid'
  }

  const parsedHash = parseAdminPasswordHash(expectedHash)
  if (!parsedHash) return 'misconfigured'

  const derivedKey = await deriveAdminPasswordKey(password, parsedHash.salt)

  return timingSafeEqual(derivedKey, parsedHash.derivedKey) ? 'valid' : 'invalid'
}

export function isAdminSessionSecretConfigured(
  secret: string | undefined,
): secret is string {
  return Boolean(
    secret &&
      secret.length >= ADMIN_SESSION_SECRET_MIN_LENGTH &&
      secret.trim() === secret,
  )
}

function signSessionPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createAdminSession(
  secret: string | undefined,
  now = new Date(),
  nonce = randomBytes(18).toString('base64url'),
): string {
  if (!isAdminSessionSecretConfigured(secret)) {
    throw new AdminSessionConfigurationError()
  }

  const issuedAt = Math.floor(now.getTime() / 1000)
  const expiresAt = issuedAt + ADMIN_SESSION_MAX_AGE_SECONDS
  const payload = [
    ADMIN_SESSION_VERSION,
    issuedAt,
    expiresAt,
    nonce,
  ].join('.')

  return `${payload}.${signSessionPayload(payload, secret)}`
}

export function isValidAdminSession(
  sessionValue: string | undefined,
  secret: string | undefined,
  now = new Date(),
): boolean {
  if (!sessionValue || !isAdminSessionSecretConfigured(secret)) return false

  const parts = sessionValue.split('.')
  if (parts.length !== 5) return false

  const [version, issuedAtValue, expiresAtValue, nonce, signature] = parts
  if (
    version !== ADMIN_SESSION_VERSION ||
    !/^\d+$/.test(issuedAtValue) ||
    !/^\d+$/.test(expiresAtValue) ||
    !/^[A-Za-z0-9_-]{16,}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    return false
  }

  const issuedAt = Number(issuedAtValue)
  const expiresAt = Number(expiresAtValue)
  const currentTime = Math.floor(now.getTime() / 1000)
  const lifetime = expiresAt - issuedAt

  if (
    !Number.isSafeInteger(currentTime) ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    issuedAt > currentTime + CLOCK_SKEW_SECONDS ||
    expiresAt <= currentTime ||
    lifetime <= 0 ||
    lifetime > ADMIN_SESSION_MAX_AGE_SECONDS
  ) {
    return false
  }

  const payload = [version, issuedAtValue, expiresAtValue, nonce].join('.')
  const expectedSignature = signSessionPayload(payload, secret)

  return timingSafeStringEqual(signature, expectedSignature)
}
