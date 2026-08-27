export type ImportTriggerMode =
  | 'manual'
  | 'scheduled'
  | 'scheduled_correction'

export type AtomicImportResponse =
  | {
      code: 'IMPORTED'
      matchup_count: number
      run_id: string
      score_count: number
      success: true
    }
  | {
      code: string
      error: string
      run_id: string | null
      success: false
    }

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function parseAtomicImportResponse(value: unknown): AtomicImportResponse {
  const response = asRecord(value)

  if (response.success === true) {
    if (
      response.code !== 'IMPORTED' ||
      typeof response.run_id !== 'string' ||
      !response.run_id ||
      !Number.isInteger(response.score_count) ||
      Number(response.score_count) < 0 ||
      !Number.isInteger(response.matchup_count) ||
      Number(response.matchup_count) < 0
    ) {
      throw new Error('The database returned an invalid import result.')
    }

    return {
      code: 'IMPORTED',
      matchup_count: Number(response.matchup_count),
      run_id: response.run_id,
      score_count: Number(response.score_count),
      success: true,
    }
  }

  if (
    response.success !== false ||
    typeof response.code !== 'string' ||
    typeof response.error !== 'string' ||
    !response.error.trim()
  ) {
    throw new Error('The database returned an invalid import result.')
  }

  return {
    code: response.code,
    error: response.error.trim(),
    run_id: typeof response.run_id === 'string' ? response.run_id : null,
    success: false,
  }
}

export class ESPNImportPersistenceError extends Error {
  readonly code: string
  readonly runId: string | null

  constructor(result: Extract<AtomicImportResponse, { success: false }>) {
    super(result.error)
    this.name = 'ESPNImportPersistenceError'
    this.code = result.code
    this.runId = result.run_id
  }
}
