import { ESPNImportService } from '@/lib/espn/import'
import {
  ESPNImportPersistenceError,
  parseAtomicImportResponse,
} from '@/lib/espn/persistence'
import type { WeekImportData } from '@/lib/espn/types'
import type { AppSupabaseClient } from '@/lib/supabaseServer'

const week: WeekImportData = {
  is_complete: true,
  matchups: [
    { team1_member_id: 'member-1', team2_member_id: 'member-2' },
  ],
  scores: [
    { member_id: 'member-1', points: 101.25, team_name: 'Team One' },
    { member_id: 'member-2', points: 99.5, team_name: 'Team Two' },
  ],
  week: 4,
}

function serviceWithRpc(rpc: jest.Mock) {
  return new ESPNImportService(
    'league-1',
    '2026',
    { league_id: '12345', year: 2026 },
    { rpc } as unknown as AppSupabaseClient,
  )
}

describe('atomic ESPN import persistence', () => {
  it('parses a successful database result', () => {
    expect(
      parseAtomicImportResponse({
        code: 'IMPORTED',
        matchup_count: 1,
        run_id: 'run-1',
        score_count: 2,
        success: true,
      }),
    ).toEqual({
      code: 'IMPORTED',
      matchup_count: 1,
      run_id: 'run-1',
      score_count: 2,
      success: true,
    })
  })

  it('rejects malformed database results', () => {
    expect(() => parseAtomicImportResponse(null)).toThrow(
      'invalid import result',
    )
    expect(() =>
      parseAtomicImportResponse({
        code: 'IMPORTED',
        matchup_count: -1,
        run_id: 'run-1',
        score_count: 2,
        success: true,
      }),
    ).toThrow('invalid import result')
  })

  it('sends one scheduled RPC with only persistence fields', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        code: 'IMPORTED',
        matchup_count: 1,
        run_id: 'run-1',
        score_count: 2,
        success: true,
      },
      error: null,
    })

    await expect(
      serviceWithRpc(rpc).importValidatedWeekData(week, 'scheduled'),
    ).resolves.toEqual({
      import_run_id: 'run-1',
      imported_matchups: 1,
      imported_scores: 2,
      message: 'Successfully imported 2 scores and 1 matchups for week 4',
      success: true,
    })

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('import_espn_week_atomically', {
      p_league_id: 'league-1',
      p_matchups: week.matchups,
      p_scores: [
        { member_id: 'member-1', points: 101.25 },
        { member_id: 'member-2', points: 99.5 },
      ],
      p_season: '2026',
      p_trigger_mode: 'scheduled',
      p_week: 4,
    })
  })

  it('surfaces recorded database failures with their run ID', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        code: 'IMPORT_FAILED',
        error: 'Every active player must appear exactly once in scores.',
        run_id: 'run-failed',
        success: false,
      },
      error: null,
    })

    try {
      await serviceWithRpc(rpc).importValidatedWeekData(week)
      throw new Error('Expected persistence to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ESPNImportPersistenceError)
      expect(error).toMatchObject({
        code: 'IMPORT_FAILED',
        message: 'Every active player must appear exactly once in scores.',
        runId: 'run-failed',
      })
    }
  })

  it('surfaces a concurrent import lock without inventing a run ID', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        code: 'IMPORT_LOCKED',
        error: 'This league week is already being imported.',
        success: false,
      },
      error: null,
    })

    await expect(
      serviceWithRpc(rpc).importValidatedWeekData(week),
    ).rejects.toMatchObject({
      code: 'IMPORT_LOCKED',
      runId: null,
    })
  })

  it('explains when the prepared migration is not active', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Function not found' },
    })

    await expect(
      serviceWithRpc(rpc).importValidatedWeekData(week),
    ).rejects.toThrow('Atomic ESPN imports are not active in the database')
  })
})
