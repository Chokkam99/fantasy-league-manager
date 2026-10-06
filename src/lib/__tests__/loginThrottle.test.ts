/** @jest-environment node */
import { createLoginThrottle, loginClientKey } from '../loginThrottle'

const secret = 'fixture-session-secret-with-at-least-32-characters'
const headers = (values: Record<string, string>) => new Headers(values)

it('hashes the Vercel client address instead of storing it', () => {
  const key = loginClientKey(headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }), secret)
  expect(key).toMatch(/^[0-9a-f]{64}$/)
  expect(key).toBe(loginClientKey(headers({ 'x-real-ip': '203.0.113.7' }), secret))
  expect(key).not.toBe(loginClientKey(headers({ 'x-real-ip': '203.0.113.8' }), secret))
  expect(loginClientKey(headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }), secret))
    .toBe(loginClientKey(headers({ 'x-real-ip': '198.51.100.1' }), secret))
  expect(key).not.toBe(loginClientKey(headers({ 'x-real-ip': '203.0.113.7' }), `${secret}-rotated`))
})

it('reports a lockout with its remaining time', async () => {
  const rpc = jest.fn().mockResolvedValue({ data: { allowed: false, retry_after_seconds: 61.2 }, error: null })
  const throttle = createLoginThrottle(headers({ 'x-real-ip': '203.0.113.7' }), secret, () => ({ rpc }) as never)
  await expect(throttle.check()).resolves.toEqual({ allowed: false, retryAfterSeconds: 62 })
})

it('fails open without a server database connection', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const throttle = createLoginThrottle(headers({}), secret, () => { throw new Error('missing key') })
  await expect(throttle.check()).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 })
  await expect(throttle.recordFailure()).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalledTimes(1)
  warn.mockRestore()
})

it('fails open when the database call throws', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const rpc = jest.fn().mockRejectedValue(new Error('network down'))
  const throttle = createLoginThrottle(headers({}), secret, () => ({ rpc }) as never)
  await expect(throttle.check()).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 })
  await expect(throttle.clear()).resolves.toBeUndefined()
  warn.mockRestore()
})
