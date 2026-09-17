import { appFetch, DEFAULT_ERROR_MESSAGE, formatAppError } from '@/lib/appErrors'

const repair = 'This feature is unavailable because the app’s database or server setup needs attention. Contact the app maintainer to repair it, then try again.'

describe('user-facing error messages', () => {
  it.each([
    'relation "league_seasons" does not exist',
    new Error('Atomic ESPN import failed: relation "league_seasons" does not exist'),
    { code: 'PGRST202', message: 'Missing RPC' },
    { code: '42703', message: 'Missing column' },
    new Error('Server database access is not configured.'),
  ])('explains setup failures without suggesting an ESPN credential change: %p', error => {
    expect(formatAppError(error)).toBe(repair)
  })

  it.each([
    'Enter a valid amount with no more than two decimal places.',
    'Week must be between 1 and 17.',
    'Review the ESPN team assignments before syncing.',
    'Money settings changed. Reload them before saving.',
    'Prize payouts exceed the available pool by $400.',
  ])('preserves useful validation and conflict details: %s', message => {
    expect(formatAppError(message)).toBe(message)
  })

  it.each([
    'Cannot read properties of null (reading settings)',
    '<html>Internal server error</html>',
    'https://database.example/rest/v1/private_table?apikey=secret',
    '[object Object]',
    '',
    null,
  ])('uses a safe recovery message for technical output: %p', error => {
    expect(formatAppError(error)).toBe(DEFAULT_ERROR_MESSAGE)
  })

  it('does not treat an unreadable save acknowledgement as proof that nothing changed', () => {
    expect(formatAppError(new SyntaxError('Unexpected token < in JSON'))).toContain('check whether it was saved before trying again')
  })

  it('distinguishes duplicates, concurrent updates, and expired sessions', () => {
    expect(formatAppError({ code: '23505', message: 'duplicate key value' })).toMatch(/check for a duplicate/)
    expect(formatAppError({ code: '40001' })).toMatch(/Another update happened/)
    expect(formatAppError('Commissioner sign-in is required.')).toMatch(/Open the league menu, sign in/)
  })

  it('keeps ESPN recovery specific and repeat formatting stable', () => {
    expect(formatAppError('ESPN request failed with status 429.')).toMatch(/Wait a few minutes/)
    expect(formatAppError('ESPN request failed with status 404.')).toMatch(/league ID and selected season/)
    const credentials = formatAppError('ESPN rejected the saved private-league credentials.')
    expect(credentials).toMatch(/enter current private-league credentials/)
    expect(formatAppError(credentials)).toBe(credentials)
    expect(formatAppError(repair)).toBe(repair)
    expect(formatAppError('TypeError: fetch failed for ESPN week 8')).toMatch(/ESPN could not be reached for week 8/)
  })
})

describe('connection failures', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  it('does not claim an interrupted write failed or automatically repeat it', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(appFetch('/api/dues', { method: 'POST' })).rejects.toThrow('check whether your change was saved before trying again')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('gives a direct retry for interrupted reads', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(appFetch('/api/league')).rejects.toThrow('try loading the page again')
  })
})
