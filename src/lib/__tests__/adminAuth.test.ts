import { authenticateAdmin, logoutAdmin } from '@/lib/adminAuth'

describe('admin authentication client', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('reports a successful commissioner login', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, isAdmin: true }),
    }) as jest.MockedFunction<typeof fetch>

    await expect(authenticateAdmin('password')).resolves.toEqual({
      success: true,
    })
  })

  it('preserves an actionable server authentication error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: false,
        error: 'Commissioner authentication is not configured.',
      }),
    }) as jest.MockedFunction<typeof fetch>

    await expect(authenticateAdmin('password')).resolves.toEqual({
      error: 'Commissioner authentication is not configured.',
      success: false,
    })
  })

  it('returns a useful message when the request fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'))

    await expect(authenticateAdmin('password')).resolves.toEqual({
      error: 'Authentication failed. Check your connection and try again.',
      success: false,
    })
  })
})


describe('logout confirmation', () => {
  it('rejects failed server responses instead of claiming success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Try again later' }) })
    await expect(logoutAdmin()).rejects.toThrow('Try again later')
  })
  it('rejects connection failures', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'))
    await expect(logoutAdmin()).rejects.toThrow('offline')
  })
})
