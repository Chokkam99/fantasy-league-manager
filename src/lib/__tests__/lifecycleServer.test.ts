import { getLifecycleWriteBlock } from '../lifecycleServer'
import type { AppSupabaseClient } from '../supabaseServer'

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    select: jest.fn(),
  }
  builder.eq.mockReturnValue(builder)
  builder.select.mockReturnValue(builder)
  return builder
}

describe('archived write guard', () => {
  it('blocks an archived league before checking its season', async () => {
    const leagueQuery = query({
      data: { archived_at: '2026-08-25T00:00:00.000Z' },
      error: null,
    })
    const database = { from: jest.fn().mockReturnValue(leagueQuery) }

    await expect(
      getLifecycleWriteBlock(
        database as unknown as AppSupabaseClient,
        'fixture-league',
        '2025',
      ),
    ).resolves.toContain('league is archived')
    expect(database.from).toHaveBeenCalledTimes(1)
  })

  it('blocks an archived season and allows active history', async () => {
    const leagueQuery = query({ data: { archived_at: null }, error: null })
    const seasonQuery = query({
      data: { archived_at: '2026-08-25T00:00:00.000Z' },
      error: null,
    })
    const database = {
      from: jest
        .fn()
        .mockReturnValueOnce(leagueQuery)
        .mockReturnValueOnce(seasonQuery),
    }

    await expect(
      getLifecycleWriteBlock(
        database as unknown as AppSupabaseClient,
        'fixture-league',
        '2025',
      ),
    ).resolves.toContain('2025 is archived')
  })

  it('allows writes before the lifecycle migration is active', async () => {
    const missingQuery = query({
      data: null,
      error: { code: '42703', message: 'archived_at does not exist' },
    })
    const database = { from: jest.fn().mockReturnValue(missingQuery) }

    await expect(
      getLifecycleWriteBlock(
        database as unknown as AppSupabaseClient,
        'fixture-league',
        '2025',
      ),
    ).resolves.toBeNull()
  })
})
