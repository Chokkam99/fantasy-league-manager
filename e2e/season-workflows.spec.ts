import { expect, test } from '@playwright/test'
import { installLeagueFixtures } from './fixtures'
import { seasonSetupPreview } from '../test/fixtures/seasonSetup'

const base = '/league/gridiron-gurus'
const preview = { ...seasonSetupPreview, source_season: '2026', target_season: '2027', members: seasonSetupPreview.members.map(member => ({ ...member, last_season: member.selected_by_default ? '2026' : '2024' })) }

test('commissioner navigation adapts to season progress and updates outstanding dues', async ({ page }) => {
  await installLeagueFixtures(page, { commissioner: true })
  let phase = 'preseason'
  let dues = 2
  await page.route('**/view?**', async route => {
    if (new URL(route.request().url()).searchParams.get('resource') !== 'navigation') return route.fallback()
    await route.fulfill({ json: { success: true, season: '2026', phase, duesRemaining: dues, playerCount: 4 } })
  })
  await page.goto(`${base}?season=2026`)
  const nav = page.locator('nav[aria-label="League"]:visible')
  await expect(nav.getByRole('link').nth(1)).toHaveAccessibleName('Players & dues')
  await expect(nav.getByRole('link', { name: 'Players & dues', exact: true })).toHaveAccessibleDescription('2 players have dues remaining.')
  phase = 'in-season'; dues = 1
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(nav.getByRole('link').nth(1)).toHaveText('Standings')
  if (page.viewportSize()!.width < 768) {
    await expect(page.getByRole('button', { name: 'Open league actions' })).toHaveAccessibleDescription('1 player has dues remaining.')
    await page.getByRole('button', { name: 'Open league actions' }).click()
    await expect(page.getByRole('link', { name: 'Players and dues', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
  }
  phase = 'wrap-up'; dues = 0
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(nav.getByRole('link').nth(1)).toHaveText('Prizes')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('new-season roster changes survive refresh, validate settings, and retry creation', async ({ page }) => {
  const fixture = await installLeagueFixtures(page, { commissioner: true })
  await page.route('**/view?**', async route => {
    if (new URL(route.request().url()).searchParams.get('resource') !== 'shell') return route.fallback()
    await route.fulfill({ json: { success: true, league: fixture.league, seasons: [{ season: '2026', archived_at: null }, { season: '2025', archived_at: '2026-01-01T00:00:00Z' }] } })
  })
  let fail = true
  let submitted: { members: Array<{ manager_name: string; source_member_id: string | null }> } | undefined
  await page.route('**/seasons/rollover', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { preview } })
    submitted = route.request().postDataJSON()
    await route.fulfill(fail ? { status: 503, json: { error: 'Fixture creation failed. Retry.' } } : { json: { success: true, target_season: '2027' } })
    fail = false
  })
  await page.goto(`${base}/season-setup?season=2025`)
  await page.getByText('ESPN unavailable or using a different platform?', { exact: true }).click()
  await page.getByRole('button', { name: 'Set up manually', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Set up 2027' })).toBeVisible()
  await expect(page.getByLabel('Season', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Archived 2025 season.', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Remove Jordan Lee from roster' }).click()
  await expect(page.getByRole('button', { name: 'Continue to format' })).toBeDisabled()
  await page.getByRole('button', { name: 'Add new player', exact: true }).click()
  await page.getByLabel('Manager name', { exact: true }).fill('Past Player')
  await expect(page.getByRole('button', { name: 'Add to roster' })).toBeDisabled()
  await page.getByRole('button', { name: 'Bring back Past Player' }).click()
  await page.getByRole('button', { name: 'Continue to format' }).click()
  await expect.poll(() => page.getByRole('navigation', { name: 'Season setup steps' }).evaluate(element => element.getBoundingClientRect().top - document.querySelector('header')!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(0)
  await page.reload()
  await page.getByText('ESPN unavailable or using a different platform?', { exact: true }).click()
  await page.getByRole('button', { name: 'Set up manually', exact: true }).click()
  await expect(page.getByText(/Draft restored/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Shape the season' })).toBeVisible()
  await page.getByLabel('Playoff teams', { exact: true }).fill('6')
  await expect(page.getByRole('button', { name: 'Continue to money' })).toBeDisabled()
  await page.getByLabel('Playoff teams', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Continue to money' }).click()
  await page.getByLabel('Entry fee per player ($)', { exact: true }).fill('50')
  await page.getByRole('button', { name: 'Add payout' }).click()
  await page.getByLabel('Payout 1', { exact: true }).fill('1st place')
  await page.getByLabel('Amount ($)', { exact: true }).fill('100')
  await expect(page.getByText('Every dollar is assigned.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Continue to review' }).click()
  await expect(page.getByText('1 returning · 1 coming back · 0 new')).toBeVisible()
  await expect(page.getByText(/Sitting out: Jordan Lee/)).toBeVisible()
  await page.getByRole('button', { name: 'Create 2027 season' }).click()
  await expect(page.getByText('Fixture creation failed. Retry.')).toBeVisible()
  await page.getByRole('button', { name: 'Create 2027 season' }).click()
  await expect(page).toHaveURL(/\/players\?season=2027$/)
  expect(submitted!.members.map(member => member.source_member_id)).toEqual([preview.members[0].id, preview.members[2].id])
  expect(await page.evaluate(() => sessionStorage.getItem('flm-season-draft:gridiron-gurus:2027'))).toBeNull()
})
