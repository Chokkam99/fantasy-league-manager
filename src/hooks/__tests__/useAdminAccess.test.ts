import { act, renderHook, waitFor } from '@testing-library/react'
import { useAdminAccess } from '../useAdminAccess'
import { checkAdminAuth, AUTH_CHANGE_STORAGE_KEY } from '@/lib/adminAuth'
import { invalidateFinanceCache } from '@/lib/financeClient'

jest.mock('@/lib/adminAuth', () => ({ checkAdminAuth: jest.fn(), AUTH_CHANGE_STORAGE_KEY: 'auth-test' }))
jest.mock('@/lib/financeClient', () => ({ invalidateFinanceCache: jest.fn() }))
jest.mock('@/lib/leagueReadClient', () => ({ invalidateLeagueReadCache: jest.fn() }))
const check = checkAdminAuth as jest.Mock

beforeEach(() => { jest.clearAllMocks() })

it('does not let an older session check reverse a confirmed logout', async () => {
  let resolve!: (value: boolean) => void
  check.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const { result } = renderHook(useAdminAccess)
  act(() => { result.current.setAuthenticated(false) })
  await act(async () => { resolve(true) })
  expect(result.current.isAdmin).toBe(false)
  expect(result.current.authChecked).toBe(true)
})

it('clears private cached data when another tab logs out', async () => {
  check.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
  const { result } = renderHook(useAdminAccess)
  await waitFor(() => expect(result.current.isAdmin).toBe(true))
  jest.mocked(invalidateFinanceCache).mockClear()
  await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: AUTH_CHANGE_STORAGE_KEY })) })
  expect(result.current.isAdmin).toBe(false)
  expect(invalidateFinanceCache).toHaveBeenCalledTimes(1)
})
