import {
  isMissingManagerIdentitySchema,
  managerIdentityKey,
  normalizedManagerName,
  sameManagerIdentity,
} from '../managerIdentity'

describe('stable manager identity', () => {
  it('prefers the stable ID over mutable manager names', () => {
    expect(
      sameManagerIdentity(
        { manager_id: 'manager-1', manager_name: 'Alex Smith' },
        { manager_id: 'manager-1', manager_name: 'A. Smith' },
      ),
    ).toBe(true)
    expect(
      managerIdentityKey({
        manager_id: 'manager-1',
        manager_name: 'Alex Smith',
      }),
    ).toBe('manager-1')
  })

  it('falls back to normalized names before the migration is active', () => {
    expect(normalizedManagerName('  Alex   SMITH ')).toBe('alex smith')
    expect(
      sameManagerIdentity(
        { manager_name: ' Alex  Smith ' },
        { manager_name: 'alex smith' },
      ),
    ).toBe(true)
    expect(managerIdentityKey({ manager_name: 'Alex Smith' })).toBe(
      'legacy:alex smith',
    )
  })

  it('recognizes only missing manager identity schema errors', () => {
    expect(isMissingManagerIdentitySchema({ code: '42703' })).toBe(true)
    expect(isMissingManagerIdentitySchema({ code: 'PGRST204' })).toBe(true)
    expect(isMissingManagerIdentitySchema({ code: '23505' })).toBe(false)
  })
})
