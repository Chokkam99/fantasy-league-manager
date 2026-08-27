export type PaymentStatus = 'paid' | 'pending'

export type ValidMemberAction =
  | {
      action: 'add'
      manager_name: string
      season: string
      team_name: string
    }
  | {
      action: 'activate'
      member_id: string
      season: string
    }
  | {
      action: 'deactivate'
      member_id: string
      season: string
    }
  | {
      action: 'set_payment'
      member_id: string
      payment_status: PaymentStatus
      season: string
    }

export type MemberActionValidation =
  | { is_valid: true; value: ValidMemberAction }
  | { errors: string[]; is_valid: false }

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

export function validateMemberAction(input: unknown): MemberActionValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['The member request must be an object.'], is_valid: false }
  }

  const body = input as Record<string, unknown>
  const action = body.action
  const season = typeof body.season === 'string' ? body.season : ''
  const errors: string[] = []

  if (!['add', 'activate', 'deactivate', 'set_payment'].includes(String(action))) {
    errors.push('Choose a supported member action.')
  }
  if (!/^\d{4}$/.test(season)) {
    errors.push('A valid season is required.')
  }

  if (action === 'add') {
    const managerName = normalizeName(body.manager_name)
    const teamName = normalizeName(body.team_name)

    if (!managerName) errors.push('Manager name is required.')
    if (!teamName) errors.push('Team name is required.')
    if (managerName.length > 80) {
      errors.push('Manager name must be 80 characters or fewer.')
    }
    if (teamName.length > 80) {
      errors.push('Team name must be 80 characters or fewer.')
    }

    if (errors.length > 0) return { errors, is_valid: false }
    return {
      is_valid: true,
      value: {
        action: 'add',
        manager_name: managerName,
        season,
        team_name: teamName,
      },
    }
  }

  const memberId =
    typeof body.member_id === 'string' ? body.member_id.trim() : ''
  if (!UUID_PATTERN.test(memberId)) {
    errors.push('A valid member is required.')
  }

  if (action === 'set_payment') {
    if (!['paid', 'pending'].includes(String(body.payment_status))) {
      errors.push('Payment status must be paid or pending.')
    }

    if (errors.length > 0) return { errors, is_valid: false }
    return {
      is_valid: true,
      value: {
        action: 'set_payment',
        member_id: memberId,
        payment_status: body.payment_status as PaymentStatus,
        season,
      },
    }
  }

  if (errors.length > 0) return { errors, is_valid: false }
  return {
    is_valid: true,
    value: {
      action: action as 'activate' | 'deactivate',
      member_id: memberId,
      season,
    },
  }
}
