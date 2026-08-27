export interface CreateLeagueInput {
  fee_amount: number
  name: string
  season: string
}

export interface CreateLeagueValidation {
  errors: string[]
  is_valid: boolean
  value: CreateLeagueInput | null
}

export function validateCreateLeagueRequest(
  input: unknown,
): CreateLeagueValidation {
  const errors: string[] = []
  const record =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : {}
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const season =
    typeof record.season === 'string' ? record.season.trim() : ''
  const feeAmount = Number(record.fee_amount)

  if (!name) errors.push('Enter a league name.')
  else if (name.length > 100) {
    errors.push('League name must be 100 characters or fewer.')
  }

  if (!/^\d{4}$/.test(season)) {
    errors.push('Enter a four-digit season start year.')
  }

  if (
    record.fee_amount === '' ||
    record.fee_amount === null ||
    record.fee_amount === undefined ||
    !Number.isFinite(feeAmount) ||
    feeAmount < 0 ||
    feeAmount > 1_000_000
  ) {
    errors.push('Entry fee must be between $0 and $1,000,000.')
  }

  return {
    errors,
    is_valid: errors.length === 0,
    value:
      errors.length === 0
        ? { fee_amount: feeAmount, name, season }
        : null,
  }
}
