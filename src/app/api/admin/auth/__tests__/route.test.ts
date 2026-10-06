/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/auth/route'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminPasswordHash,
  createAdminSession,
  isValidAdminSession,
  legacyPasswordHash,
} from '@/lib/adminSession'

const mockRpc = jest.fn()

jest.mock('@/lib/supabaseServer', () => ({
  createServerSupabaseClient: () => ({ rpc: mockRpc }),
}))

const mockCookieGet = jest.fn()
const mockCookieSet = jest.fn()
const mockCookieDelete = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    delete: mockCookieDelete,
    get: mockCookieGet,
    set: mockCookieSet,
  })),
}))

const password = 'commissioner-password'
const sessionSecret = 'test-session-secret-with-at-least-32-characters'
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH
const originalSessionSecret = process.env.ADMIN_SESSION_SECRET
const originalLegacyOptIn = process.env.ALLOW_LEGACY_ADMIN_PASSWORD_HASH
let passwordHash: string

function request(body: string) {
  return new NextRequest('http://localhost/api/admin/auth', {
    body,
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
}

describe('admin authentication route', () => {
  beforeAll(async () => {
    passwordHash = await createAdminPasswordHash(
      password,
      Buffer.from('0123456789abcdef'),
    )
  })

  beforeEach(() => {
    process.env.ADMIN_PASSWORD_HASH = passwordHash
    process.env.ADMIN_SESSION_SECRET = sessionSecret
    delete process.env.ALLOW_LEGACY_ADMIN_PASSWORD_HASH
    mockCookieGet.mockReset()
    mockCookieSet.mockReset()
    mockCookieDelete.mockReset()
    mockRpc.mockReset()
    mockRpc.mockImplementation(async (name: string) => ({
      data: name === 'check_admin_login_throttle' ? { allowed: true, retry_after_seconds: 0 } : null,
      error: null,
    }))
  })

  afterAll(() => {
    if (originalPasswordHash === undefined) {
      delete process.env.ADMIN_PASSWORD_HASH
    } else {
      process.env.ADMIN_PASSWORD_HASH = originalPasswordHash
    }

    if (originalSessionSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSessionSecret
    }

    if (originalLegacyOptIn === undefined) {
      delete process.env.ALLOW_LEGACY_ADMIN_PASSWORD_HASH
    } else {
      process.env.ALLOW_LEGACY_ADMIN_PASSWORD_HASH = originalLegacyOptIn
    }
  })

  it('issues an HTTP-only signed session after a valid login', async () => {
    const response = await POST(
      request(JSON.stringify({ action: 'login', password })),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockCookieSet).toHaveBeenCalledTimes(1)

    const [cookieName, session, options] = mockCookieSet.mock.calls[0]
    expect(cookieName).toBe(ADMIN_SESSION_COOKIE)
    expect(session).not.toBe(process.env.ADMIN_PASSWORD_HASH)
    expect(isValidAdminSession(session, sessionSecret)).toBe(true)
    expect(options).toMatchObject({
      httpOnly: true,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'strict',
    })
  })

  it('rejects an invalid password without issuing a session', async () => {
    const response = await POST(
      request(JSON.stringify({ action: 'login', password: 'wrong' })),
    )

    expect(response.status).toBe(401)
    expect(mockCookieSet).not.toHaveBeenCalled()
  })

  it('fails closed when the session-signing secret is missing', async () => {
    delete process.env.ADMIN_SESSION_SECRET

    const response = await POST(
      request(JSON.stringify({ action: 'login', password })),
    )

    expect(response.status).toBe(503)
    expect(mockCookieSet).not.toHaveBeenCalled()
  })

  it('rejects a legacy hash unless compatibility is explicitly enabled', async () => {
    process.env.ADMIN_PASSWORD_HASH = legacyPasswordHash(password)

    const rejected = await POST(
      request(JSON.stringify({ action: 'login', password })),
    )
    expect(rejected.status).toBe(503)
    expect(mockCookieSet).not.toHaveBeenCalled()

    process.env.ALLOW_LEGACY_ADMIN_PASSWORD_HASH = 'true'
    const accepted = await POST(
      request(JSON.stringify({ action: 'login', password })),
    )
    expect(accepted.status).toBe(200)
    expect(mockCookieSet).toHaveBeenCalledTimes(1)
  })

  it('fails closed for a malformed modern password hash', async () => {
    process.env.ADMIN_PASSWORD_HASH = 'scrypt.v1.invalid'

    const response = await POST(
      request(JSON.stringify({ action: 'login', password })),
    )

    expect(response.status).toBe(503)
    expect(mockCookieSet).not.toHaveBeenCalled()
  })

  it('checks valid and tampered session cookies', async () => {
    const session = createAdminSession(sessionSecret)
    mockCookieGet.mockReturnValue({ value: session })

    const validResponse = await POST(
      request(JSON.stringify({ action: 'check' })),
    )
    await expect(validResponse.json()).resolves.toMatchObject({
      success: true,
      isAdmin: true,
    })

    mockCookieGet.mockReturnValue({ value: `${session}tampered` })
    const invalidResponse = await POST(
      request(JSON.stringify({ action: 'check' })),
    )
    await expect(invalidResponse.json()).resolves.toMatchObject({
      success: true,
      isAdmin: false,
    })
  })

  it('clears the commissioner cookie on logout', async () => {
    const response = await POST(request(JSON.stringify({ action: 'logout' })))

    expect(response.status).toBe(200)
    expect(mockCookieDelete).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE)
    expect(mockCookieSet).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      '',
      expect.objectContaining({ httpOnly: true, maxAge: 0, path: '/' }),
    )
  })

  it('rejects malformed JSON and unknown actions', async () => {
    const malformed = await POST(request('{'))
    const nullBody = await POST(request('null'))
    const unknown = await POST(request(JSON.stringify({ action: 'unknown' })))

    expect(malformed.status).toBe(400)
    expect(nullBody.status).toBe(400)
    expect(unknown.status).toBe(400)
  })

  describe('sign-in throttling', () => {
    function loginFrom(address: string, attempt = password) {
      return new NextRequest('http://localhost/api/admin/auth', {
        body: JSON.stringify({ action: 'login', password: attempt }),
        headers: { 'Content-Type': 'application/json', 'x-real-ip': address },
        method: 'POST',
      })
    }
    const calls = () => mockRpc.mock.calls.map(([name]) => name)

    it('blocks a locked-out client before checking the password', async () => {
      mockRpc.mockImplementation(async () => ({ data: { allowed: false, retry_after_seconds: 540 }, error: null }))

      const result = await POST(loginFrom('203.0.113.7'))
      const body = await result.json()

      expect(result.status).toBe(429)
      expect(result.headers.get('Retry-After')).toBe('540')
      expect(body.error).toBe('Too many sign-in attempts. Try again in 9 minutes.')
      expect(calls()).toEqual(['check_admin_login_throttle'])
      expect(mockCookieSet).not.toHaveBeenCalled()
    })

    it('records a wrong password and clears the record after a correct one', async () => {
      expect((await POST(loginFrom('203.0.113.7', 'wrong-password'))).status).toBe(401)
      expect((await POST(loginFrom('203.0.113.7'))).status).toBe(200)

      expect(calls()).toEqual([
        'check_admin_login_throttle', 'record_admin_login_failure',
        'check_admin_login_throttle', 'clear_admin_login_failures',
      ])
      const keys = mockRpc.mock.calls.map(([, args]) => args.p_client_key)
      expect(new Set(keys).size).toBe(1)
      expect(keys[0]).toMatch(/^[0-9a-f]{64}$/)
      expect(keys[0]).not.toContain('203.0.113.7')
    })

    it('still signs in when throttling is unavailable', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } })

      const result = await POST(loginFrom('203.0.113.7'))

      expect(result.status).toBe(200)
      expect(mockCookieSet).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('throttling is unavailable (PGRST202)'))
      warn.mockRestore()
    })
  })
})

