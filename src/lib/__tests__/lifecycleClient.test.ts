import { performLifecycleAction } from '../lifecycleClient'
import { invalidateFinanceCache } from '../financeClient'
import { invalidateLeagueReadCache } from '../leagueReadClient'
jest.mock('../financeClient', () => ({ invalidateFinanceCache: jest.fn() }))
jest.mock('../leagueReadClient', () => ({ invalidateLeagueReadCache: jest.fn() }))

it('invalidates shell and finance data after confirmed archive changes', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
  await performLifecycleAction('league', { action: 'set_league_archive', archived: true })
  expect(invalidateLeagueReadCache).toHaveBeenCalledWith('league')
  expect(invalidateFinanceCache).toHaveBeenCalledWith('league')
})
