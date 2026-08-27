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

function databaseFixture() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'leagues') {
        return {
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
})
