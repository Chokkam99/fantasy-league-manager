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
})
