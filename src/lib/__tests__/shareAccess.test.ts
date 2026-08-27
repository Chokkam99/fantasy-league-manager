/** @jest-environment node */

import {
  buildSharePath,
  isValidShareSeason,
  isValidShareToken,
} from '@/lib/shareAccess'
import {
  createShareToken,
  createStableShareSlug,
  digestShareToken,
} from '@/lib/shareAccessServer'

describe('scoped player share tokens', () => {
  it('creates opaque fixed-length tokens and stores deterministic digests', () => {
    const tokens = Array.from({ length: 20 }, () => createShareToken())

    expect(new Set(tokens).size).toBe(20)
    for (const token of tokens) {
      expect(isValidShareToken(token)).toBe(true)
      expect(digestShareToken(token)).toMatch(/^[0-9a-f]{64}$/)
      expect(digestShareToken(token)).not.toContain(token)
    }
    expect(digestShareToken(tokens[0])).toBe(digestShareToken(tokens[0]))
  })

  it('rejects malformed tokens and non-NFL season identifiers', () => {
    expect(isValidShareToken('short')).toBe(false)
    expect(isValidShareToken('!'.repeat(43))).toBe(false)
    expect(isValidShareSeason('2026')).toBe(true)
    expect(isValidShareSeason('26')).toBe(false)
    expect(isValidShareSeason(2026)).toBe(false)
  })

  it('creates a stable short slug for one league season', () => {
    const secret = 'stable-share-test-secret'
    const slug = createStableShareSlug('friends', '2026', secret)

    expect(slug).toMatch(/^[A-Za-z0-9_-]{12}$/)
    expect(createStableShareSlug('friends', '2026', secret)).toBe(slug)
    expect(createStableShareSlug('friends', '2027', secret)).not.toBe(slug)
    expect(isValidShareToken(slug)).toBe(true)
  })

  it('builds a compact encoded league URL', () => {
    const token = 'a'.repeat(12)
    expect(buildSharePath('friends/league', '2026', token)).toBe(
      `/s/${token}`,
    )
  })
})
