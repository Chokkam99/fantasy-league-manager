import { expect, test } from '@playwright/test'
import { installLeagueFixtures } from './fixtures'

test('money settings are discoverable and correct an inherited fee without losing a failed edit', async ({ page }) => {
  await installLeagueFixtures(page, { commissioner: true })
  let settings = { fee_amount: 25, draft_food_cost: 20, weekly_prize_amount: 5, prize_structure: { first: 60, second: 25, third: 10 } }
  let failSave = true
  let submitted: { season: string; revision: string; settings: typeof settings } | undefined
  await page.route('**/seasons/money**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { success: true, settings, revision: 'fixture-money', total_weeks: 17, player_count: 4, archived: false } })
    submitted = route.request().postDataJSON()
    if (failSave) { failSave = false; return route.fulfill({ status: 409, json: { error: 'Fixture season changed. Reload money settings and try again.' } }) }
    settings = submitted!.settings
    await route.fulfill({ json: { success: true } })
  })
  await page.goto('/league/gridiron-gurus/players?season=2026')
  await page.getByRole('button', { name: 'Edit entry fee & prizes' }).click()
  await expect(page).toHaveURL(/settings\?season=2026#season-money$/)
  const card = page.locator('#season-money')
  await expect(card.getByText(/over budget/)).toBeVisible()
  const fee = card.getByLabel('Entry fee per player')
  await fee.fill('50.001')
  await expect(card.getByRole('button', { name: 'Save money settings' })).toBeDisabled()
  await fee.fill('50')
  await expect(card.getByText('The plan balances.')).toBeVisible()
  await card.getByRole('button', { name: 'Save money settings' }).click()
  await expect(card.getByText(/Fixture season changed/)).toBeVisible()
  await expect(fee).toHaveValue('50')
  await card.getByRole('button', { name: 'Save money settings' }).click()
  await expect(card.getByText(/2026 money settings saved/)).toBeVisible()
  await expect(fee).toBeEnabled()
  expect(submitted).toMatchObject({ season: '2026', revision: 'fixture-money', settings: { fee_amount: 50 } })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await card.screenshot({ path: `temp/ui-redesign/money-settings-${page.viewportSize()!.width}.png` })
})
