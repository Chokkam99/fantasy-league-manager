import { isAuthorizedCronRequest } from '@/lib/cronAuth'

describe('cron authentication', () => {
  it('fails closed when CRON_SECRET is missing', () => {
    expect(isAuthorizedCronRequest('Bearer anything', undefined)).toBe(false)
  })

  it('rejects a missing or incorrect bearer token', () => {
    expect(isAuthorizedCronRequest(null, 'secret')).toBe(false)
    expect(isAuthorizedCronRequest('Bearer wrong', 'secret')).toBe(false)
  })

  it('accepts only the configured bearer token', () => {
    expect(isAuthorizedCronRequest('Bearer secret', 'secret')).toBe(true)
  })
})
