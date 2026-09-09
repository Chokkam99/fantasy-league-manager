import { expect, test } from '@playwright/test'
import { installLeagueFixtures } from './fixtures'

test('preseason dues expand on demand without crowding the dashboard', async ({ page }, testInfo) => {
  const fixture = await installLeagueFixtures(page, { commissioner: true })
  await page.route('**/api/leagues', route => route.fulfill({ json: { success: true, leagues: [{
    ...fixture.league,
    attentionReasons: ['2 players have dues pending'],
    collectedAmount: 74.75, expectedAmount: 200, feeAmount: 100,
    latestWeek: 0, paidMembers: 0, pendingMembers: 2, totalMembers: 2, totalWeeks: 17,
    outstandingDues: [
      { memberId: 'alex', managerName: 'Alex Smith', remainingCents: 10000, isPartial: false },
      { memberId: 'zoe', managerName: 'Zoe Alexandra Jones-Chen', remainingCents: 2525, isPartial: true },
    ],
  }] } }))
  await page.goto('/')
  const summary = page.locator('summary').filter({ hasText: '2 players · $125.25 remaining' })
  await expect(summary).toBeVisible()
  await expect(page.getByText('Alex Smith', { exact: true })).not.toBeVisible()
  await expect(page.getByText('2 players have dues pending', { exact: true })).toHaveCount(0)
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Alex Smith', { exact: true })).toBeVisible()
  await expect(page.getByText('Unpaid', { exact: true })).toHaveCount(2)
  await expect(page.getByText('$25.25', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('details').filter({ has: summary }).screenshot({ path: testInfo.outputPath('preseason-dues.png') })
  await page.keyboard.press('Enter')
  await expect(page.getByText('Alex Smith', { exact: true })).not.toBeVisible()
  await summary.click()
  await page.getByRole('link', { name: 'Manage dues' }).click()
  await expect(page).toHaveURL(/\/league\/gridiron-gurus\/players\?season=2026$/)
})
