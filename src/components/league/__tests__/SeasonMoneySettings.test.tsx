import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeasonMoneySettings } from '../SeasonMoneySettings'
const settings = { fee_amount: 50, draft_food_cost: 0, weekly_prize_amount: 0, prize_structure: { first: 200 } }
const snapshot = { settings, revision: 'fixture-revision', total_weeks: 17, player_count: 2, archived: false }
beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => snapshot }) })

it('lets the commissioner fix an over-budget plan, preserves edits on failure, and saves the selected season', async () => {
  const user = userEvent.setup()
  render(<SeasonMoneySettings leagueId="fixture" season="2026" />)
  const fee = await screen.findByLabelText('Entry fee per player')
  expect(screen.getByText(/over budget/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save money settings' })).toBeEnabled()
  await user.clear(fee); await user.type(fee, '100')
  expect(screen.getByText('The plan balances.')).toBeInTheDocument()
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Fixture retry needed' }) })
  await user.click(screen.getByRole('button', { name: 'Save money settings' }))
  expect(await screen.findByText('Fixture retry needed')).toBeInTheDocument()
  expect(fee).toHaveValue(100)
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
  await user.click(screen.getByRole('button', { name: 'Save money settings' }))
  await screen.findByText(/2026 money settings saved/)
  const request = (global.fetch as jest.Mock).mock.calls.find(([, options]) => options?.method === 'POST')
  expect(JSON.parse(request[1].body)).toEqual({ season: '2026', revision: 'fixture-revision', settings: { ...settings, fee_amount: 100 } })
})

it('blocks archived edits while keeping the settings readable', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ ...snapshot, archived: true }) })
  render(<SeasonMoneySettings leagueId="fixture" season="2025" />)
  await waitFor(() => expect(screen.getByLabelText('Entry fee per player')).toBeDisabled())
  expect(screen.getByRole('button', { name: 'Save money settings' })).toBeDisabled()
})
