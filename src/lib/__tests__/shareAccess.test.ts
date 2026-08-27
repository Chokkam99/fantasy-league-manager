/** @jest-environment node */

import {
  buildSharePath,
  isValidShareSeason,
  isValidShareToken,
} from '@/lib/shareAccess'
import { createShareToken, digestShareToken } from '@/lib/shareAccessServer'

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

  it('builds a season-scoped encoded player URL', () => {
    const token = 'a'.repeat(43)
    expect(buildSharePath('friends/league', '2026', token)).toBe(
      `/league/friends%2Fleague?season=2026&share=${token}`,
    )
  })
})
