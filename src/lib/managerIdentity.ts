export interface ManagerIdentityRecord {
  manager_id?: string | null
  manager_name: string
}

export function normalizedManagerName(managerName: string) {
  return managerName.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function managerIdentityKey(record: ManagerIdentityRecord) {
  return record.manager_id || `legacy:${normalizedManagerName(record.manager_name)}`
}

export function sameManagerIdentity(
  left: ManagerIdentityRecord,
  right: ManagerIdentityRecord,
) {
  if (left.manager_id && right.manager_id) {
    return left.manager_id === right.manager_id
  }
  return normalizedManagerName(left.manager_name) === normalizedManagerName(right.manager_name)
}

export function isMissingManagerIdentitySchema(
  error: { code?: string; message?: string } | null | undefined,
) {
  if (!error) return false
  if (['42703', 'PGRST204'].includes(error.code || '')) return true
  return /manager_id/i.test(error.message || '') && /column|schema cache/i.test(
    error.message || '',
  )
}
