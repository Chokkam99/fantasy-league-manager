import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  AdminSessionConfigurationError,
  createAdminPasswordHash,
  createAdminSession,
  isAdminSessionSecretConfigured,
  isValidAdminSession,
  legacyPasswordHash,
  verifyAdminPassword,
} from '@/lib/adminSession'

describe('admin session validation', () => {
  const secret = 'test-session-secret-with-at-least-32-characters'
  const now = new Date('2026-08-25T12:00:00.000Z')
  const nonce = 'fixed_test_nonce_123456'
  const fixedSalt = Buffer.from('0123456789abcdef')

  it('creates and verifies a versioned scrypt password hash', async () => {
    const hash = await createAdminPasswordHash(
      'commissioner-password',
      fixedSalt,
    )

    expect(hash).toMatch(/^scrypt\.v1\.32768\.8\.3\./)
    await expect(
      verifyAdminPassword('commissioner-password', hash),
    ).resolves.toBe('valid')
    await expect(verifyAdminPassword('wrong-password', hash)).resolves.toBe(
      'invalid',
    )
    await expect(verifyAdminPassword(undefined, hash)).resolves.toBe('invalid')
  })

  it('requires explicit opt-in for a legacy password hash', async () => {
    const hash = legacyPasswordHash('commissioner-password')

    await expect(
      verifyAdminPassword('commissioner-password', hash),
    ).resolves.toBe('misconfigured')
    await expect(
      verifyAdminPassword('commissioner-password', hash, true),
    ).resolves.toBe('legacy-valid')
    await expect(
      verifyAdminPassword('wrong-password', hash, true),
    ).resolves.toBe('invalid')
  })

  it.each([
    undefined,
    '',
    ' scrypt.v1.32768.8.3.invalid.invalid',
    'scrypt.v2.32768.8.3.invalid.invalid',
    'scrypt.v1.1.8.1.invalid.invalid',
  ])('fails closed for a malformed password verifier', async (hash) => {
    await expect(
      verifyAdminPassword('commissioner-password', hash),
    ).resolves.toBe('misconfigured')
  })

  it('rejects empty and oversized login attempts before deriving a key', async () => {
    const hash = await createAdminPasswordHash(
      'commissioner-password',
      fixedSalt,
    )

    await expect(verifyAdminPassword('', hash)).resolves.toBe('invalid')
    await expect(verifyAdminPassword('x'.repeat(257), hash)).resolves.toBe(
      'invalid',
    )
    await expect(createAdminPasswordHash('')).rejects.toThrow(
      'between 1 and 256 UTF-8 bytes',
    )
  })

  it('issues a signed session that does not contain password material', () => {
    const session = createAdminSession(secret, now, nonce)

    expect(session).toMatch(/^v1\.\d+\.\d+\./)
    expect(session).not.toContain('commissioner-password')
    expect(isValidAdminSession(session, secret, now)).toBe(true)
  })

  it('rejects tampered, incorrectly signed, and malformed sessions', () => {
    const session = createAdminSession(secret, now, nonce)
    const tampered = `${session.slice(0, -1)}${session.endsWith('a') ? 'b' : 'a'}`

    expect(isValidAdminSession(tampered, secret, now)).toBe(false)
    expect(
      isValidAdminSession(
        session,
        'different-secret-with-at-least-32-characters',
        now,
      ),
    ).toBe(false)
    expect(isValidAdminSession('configured-hash', secret, now)).toBe(false)
  })

  it('rejects expired sessions and sessions issued too far in the future', () => {
    const session = createAdminSession(secret, now, nonce)
    const expiredAt = new Date(
      now.getTime() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
    )
    const futureSession = createAdminSession(
      secret,
      new Date(now.getTime() + 61_000),
      nonce,
    )

    expect(isValidAdminSession(session, secret, expiredAt)).toBe(false)
    expect(isValidAdminSession(futureSession, secret, now)).toBe(false)
  })

  it.each([undefined, '', 'short-session-secret', ` ${secret}`])(
    'fails closed when the session secret is missing or too short',
    (invalidSecret) => {
      expect(isAdminSessionSecretConfigured(invalidSecret)).toBe(false)
      expect(isValidAdminSession('session', invalidSecret, now)).toBe(false)
      expect(() => createAdminSession(invalidSecret, now, nonce)).toThrow(
        AdminSessionConfigurationError,
      )
    },
  )

  it('recognizes a sufficiently long session secret', () => {
    expect(isAdminSessionSecretConfigured(secret)).toBe(true)
  })
})
