import { expect, test } from '@playwright/test'
import { installLeagueFixtures } from './fixtures'

test('money errors explain setup failures and uncertain saves without losing the edit', async ({ page }, testInfo) => {
  await installLeagueFixtures(page, { commissioner: true })
  const settings = { fee_amount: 25, draft_food_cost: 20, weekly_prize_amount: 5, prize_structure: { first: 60 } }
  let attempts = 0
  await page.route('**/seasons/money**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { success: true, settings, revision: 'fixture-money', total_weeks: 17, player_count: 4, archived: false } })
    attempts++
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'relation "league_seasons" does not exist' } })
    return route.abort('connectionreset')
  })
  await page.goto('/league/gridiron-gurus/settings?season=2026#season-money')
  const card = page.locator('#season-money')
  const fee = card.getByLabel('Entry fee per player')
  await fee.fill('50')
  await card.getByRole('button', { name: 'Save money settings' }).click()
  await expect(card.getByRole('alert')).toContainText('Contact the app maintainer to repair it')
  await expect(card.getByRole('alert')).not.toContainText('league_seasons')
  await expect(fee).toHaveValue('50')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await card.screenshot({ path: testInfo.outputPath('setup-error.png') })
  await card.getByRole('button', { name: 'Save money settings' }).click()
  await expect(card.getByRole('alert')).toContainText('check whether your change was saved before trying again')
  await expect(fee).toHaveValue('50')
  await expect(card.getByText(/money settings saved/)).toHaveCount(0)
  expect(attempts).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
