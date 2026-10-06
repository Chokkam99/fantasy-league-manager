/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/cron/import-weekly-scores/route'

const mockCreateServerSupabaseClient = jest.fn()
const mockGetLatestCompletedWeek = jest.fn()
const mockPreviewWeek = jest.fn()
const mockImportValidatedWeekData = jest.fn()

jest.mock('@/lib/supabaseServer', () => ({
  createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
  isServerSupabaseConfigurationError: () => false,
}))

jest.mock('@/lib/espn/import', () => ({
  ESPNImportService: jest.fn().mockImplementation(() => ({
    getLatestCompletedWeek: mockGetLatestCompletedWeek,
    importValidatedWeekData: mockImportValidatedWeekData,
    previewWeek: mockPreviewWeek,
  })),
}))

function completedWeek(week: number) {
  return {
    is_complete: true,
    matchups: [
      { team1_member_id: 'member-1', team2_member_id: 'member-2' },
    ],
    scores: [
      { member_id: 'member-1', points: 101, team_name: 'One' },
      { member_id: 'member-2', points: 99, team_name: 'Two' },
    ],
    week,
  }
}

function databaseFixture(
  importRuns: Array<{
    league_id: string
    season: string
    status: string
    trigger_mode?: string
    week_number: number
  }> = [],
  scoredWeeks: number[] = [1, 2, 3, 4, 5, 6, 7, 8],
) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'weekly_scores') {
        const rows = scoredWeeks.flatMap((week) => [
          { league_id: 'league-1', season: '2026', week_number: week },
          { league_id: 'league-1', season: '2026', week_number: week },
        ])
        const query: Record<string, unknown> = {
          range: jest.fn().mockResolvedValue({ count: rows.length, data: rows, error: null }),
        }
        for (const method of ['select', 'in', 'order']) query[method] = jest.fn().mockReturnValue(query)
        return query
      }

      if (table === 'leagues') {
        return {
          update: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ error: null }),
          })),
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  auto_sync_enabled: true,
                  current_season: '2026',
                  espn_league_id: '12345',
                  id: 'league-1',
                  name: 'Test League',
                },
              ],
              error: null,
            }),
          })),
        }
      }

      if (table === 'league_seasons') {
        return {
          select: jest.fn(() => ({
            in: jest.fn().mockResolvedValue({
              data: [
                { league_id: 'league-1', season: '2026', total_weeks: 17 },
              ],
              error: null,
            }),
          })),
        }
      }

      if (table === 'league_members') {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { id: 'member-1', league_id: 'league-1', season: '2026' },
                  { id: 'member-2', league_id: 'league-1', season: '2026' },
                ],
                error: null,
              }),
            })),
          })),
        }
      }

      if (table === 'import_runs') {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: importRuns,
                error: null,
              }),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('weekly score cron route', () => {
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
    mockCreateServerSupabaseClient.mockReturnValue(databaseFixture())
    mockGetLatestCompletedWeek.mockResolvedValue(8)
    mockPreviewWeek.mockImplementation(async (week: number) =>
      completedWeek(week),
    )
    mockImportValidatedWeekData.mockImplementation(
      async (weekData: ReturnType<typeof completedWeek>) => ({
        import_run_id: `run-${weekData.week}`,
        imported_matchups: 1,
        imported_scores: 2,
        message: `Imported week ${weekData.week}`,
        success: true,
      }),
    )
  })

  afterAll(() => {
    process.env.CRON_SECRET = originalCronSecret
  })

  it('rejects an unauthenticated request before opening the database', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/cron/import-weekly-scores'),
    )

    expect(response.status).toBe(401)
    expect(mockCreateServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('imports the correction week before the primary week', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/cron/import-weekly-scores', {
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(mockGetLatestCompletedWeek).toHaveBeenCalledWith(17)
    expect(payload.imported).toMatchObject([
      { purpose: 'correction', week: 7 },
      { purpose: 'primary', week: 8 },
    ])
    expect(mockPreviewWeek.mock.calls.map(([week]) => week)).toEqual([7, 8])
    expect(
      mockImportValidatedWeekData.mock.calls.map(([, triggerMode]) =>
        triggerMode,
      ),
    ).toEqual(['scheduled_correction', 'scheduled'])
  })

  it('stops scheduled ESPN checks after the final week is imported and rechecked', async () => {
    mockCreateServerSupabaseClient.mockReturnValue(
      databaseFixture([
        {
          league_id: 'league-1',
          season: '2026',
          status: 'succeeded',
          trigger_mode: 'scheduled',
          week_number: 17,
        },
        {
          league_id: 'league-1',
          season: '2026',
          status: 'succeeded',
          trigger_mode: 'scheduled_correction',
          week_number: 17,
        },
      ]),
    )

    const response = await GET(
      new NextRequest('http://localhost/api/cron/import-weekly-scores', {
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.skipped).toMatchObject([
      { reason: expect.stringContaining('configured week 17') },
    ])
    expect(mockGetLatestCompletedWeek).not.toHaveBeenCalled()
    expect(mockPreviewWeek).not.toHaveBeenCalled()
  })

  it('reports a correction failure as a warning and still imports the primary week', async () => {
    mockPreviewWeek.mockImplementation(async (week: number) => {
      if (week === 7) throw new Error('Prior ESPN week unavailable')
      return completedWeek(week)
    })

    const response = await GET(
      new NextRequest('http://localhost/api/cron/import-weekly-scores', {
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    )
    const payload = await response.json()

    expect(payload.success).toBe(true)
    expect(payload.warnings).toMatchObject([
      {
        error: 'Prior ESPN week unavailable',
        purpose: 'correction',
        week: 7,
      },
    ])
    expect(payload.imported).toMatchObject([{ purpose: 'primary', week: 8 }])
  })

  it('rechecks the final week once after the season ends', async () => {
    mockCreateServerSupabaseClient.mockReturnValue(
      databaseFixture([
        { league_id: 'league-1', season: '2026', status: 'succeeded', trigger_mode: 'scheduled', week_number: 17 },
      ]),
    )

    const response = await GET(
      new NextRequest('http://localhost/api/cron/import-weekly-scores', {
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockGetLatestCompletedWeek).not.toHaveBeenCalled()
    expect(payload.imported).toMatchObject([{ purpose: 'correction', week: 17 }])
    expect(mockImportValidatedWeekData.mock.calls.map(([, triggerMode]) => triggerMode)).toEqual(['scheduled_correction'])
  })

  it('backfills completed weeks that have no scores before the usual passes', async () => {
    mockCreateServerSupabaseClient.mockReturnValue(databaseFixture([], [1, 2, 5, 6, 7]))

    const response = await GET(
      new NextRequest('http://localhost/api/cron/import-weekly-scores', {
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.imported).toMatchObject([
      { purpose: 'backfill', week: 3 },
      { purpose: 'backfill', week: 4 },
      { purpose: 'correction', week: 7 },
      { purpose: 'primary', week: 8 },
    ])
    expect(mockImportValidatedWeekData.mock.calls.map(([, triggerMode]) => triggerMode)).toEqual([
      'scheduled', 'scheduled', 'scheduled_correction', 'scheduled',
    ])
  })

  describe('failure visibility', () => {
    const originalHeartbeat = process.env.CRON_HEARTBEAT_URL
    let fetchSpy: jest.SpyInstance

    beforeEach(() => {
      process.env.CRON_HEARTBEAT_URL = 'https://hc-ping.com/fixture-check'
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response)
      jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      jest.restoreAllMocks()
      if (originalHeartbeat === undefined) delete process.env.CRON_HEARTBEAT_URL
      else process.env.CRON_HEARTBEAT_URL = originalHeartbeat
    })

    it('pings the heartbeat monitor after a successful run', async () => {
      const response = await GET(
        new NextRequest('http://localhost/api/cron/import-weekly-scores', {
          headers: { authorization: 'Bearer test-cron-secret' },
        }),
      )

      expect(response.status).toBe(200)
      expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual(['https://hc-ping.com/fixture-check'])
    })

    it('fails the run and reports it when a league import fails', async () => {
      mockPreviewWeek.mockImplementation(async (week: number) => {
        if (week === 8) throw new Error('ESPN week unavailable')
        return completedWeek(week)
      })

      const response = await GET(
        new NextRequest('http://localhost/api/cron/import-weekly-scores', {
          headers: { authorization: 'Bearer test-cron-secret' },
        }),
      )
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload.success).toBe(false)
      expect(payload.errors).toMatchObject([{ error: 'ESPN week unavailable', purpose: 'primary', week: 8 }])
      expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual(['https://hc-ping.com/fixture-check/fail'])
    })

    it('sends no ping for an unauthenticated request so the monitor alerts on the silence', async () => {
      const response = await GET(new NextRequest('http://localhost/api/cron/import-weekly-scores'))

      expect(response.status).toBe(401)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
