import { expect, test } from '@playwright/test'
import { installLeagueFixtures } from './fixtures'

const leaguePath = '/league/gridiron-gurus'

async function openActions(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Open league actions' }).click()
  return page.locator('[aria-label="League actions"]')
}

test('menu labels, short viewport scrolling, and clipboard feedback stay usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 })
  await installLeagueFixtures(page, { commissioner: true })
  await page.goto(`${leaguePath}/players?season=2026`)
  await expect(page.getByRole('button', { name: 'Add player' })).toBeVisible()
  const menu = await openActions(page)
  const actions = menu.locator('a:visible, button:visible')
  for (const action of await actions.all()) {
    expect((await action.innerText()).trim()).not.toBe('')
    await expect(action.locator('svg')).toHaveCount(1)
  }
  const box = await menu.boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(480)
  await expect(menu.getByRole('button', { name: 'Share league' })).toHaveText('Share league')
  await menu.getByRole('button', { name: 'Share league' }).click()
  await expect(page.getByText('League link copied.')).toBeVisible()
  expect(await page.evaluate(() => (window as typeof window & { __copiedLeagueLink?: string }).__copiedLeagueLink))
    .toMatch(/\/league\/gridiron-gurus$/)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open league actions' })).toBeFocused()
})

test('sign-in dialog stays open when typing and restores focus on Escape', async ({ page }) => {
  await installLeagueFixtures(page, { commissioner: false })
  await page.goto(`${leaguePath}/players?season=2026`)
  await expect(page.getByRole('heading', { name: 'League roster' })).toBeVisible()
  const menu = await openActions(page)
  await menu.getByRole('button', { name: 'Commissioner login' }).click()
  const password = page.getByLabel('Commissioner password')
  await password.click()
  await password.fill('fixture-only-password')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(password).toHaveValue('fixture-only-password')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(menu.getByRole('button', { name: 'Commissioner login' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
})

test('failed logout preserves access; successful logout and login reload the roster', async ({ page }) => {
  const fixture = await installLeagueFixtures(page, { commissioner: true })
  let commissioner = true
  let failLogout = true
  await page.route('**/api/admin/auth**', async route => {
    const action = route.request().postDataJSON()?.action
    if (action === 'logout' && failLogout) {
      failLogout = false
      await route.fulfill({ status: 503, json: { success: false, error: 'Fixture logout unavailable. Try again.' } })
      return
    }
    if (action === 'logout') commissioner = false
    if (action === 'login') commissioner = true
    await route.fulfill({ json: { success: true, isAdmin: commissioner } })
  })
  await page.route('**/api/leagues/gridiron-gurus/finance**', async route => {
    await route.fulfill({ json: { ...fixture.finance, is_commissioner: commissioner,
      payments: commissioner ? fixture.finance.payments : undefined } })
  })
  await page.goto(`${leaguePath}/players?season=2026`)
  await expect(page.getByRole('button', { name: 'Payment details for Alex Smith' })).toBeVisible()
  let menu = await openActions(page)
  await menu.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByText('Fixture logout unavailable. Try again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Payment details for Alex Smith' })).toBeVisible()
  await menu.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'League roster' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Payment details for Alex Smith' })).toHaveCount(0)
  await expect(page.getByLabel('Dues for Taylor Reed: Unpaid')).toBeVisible()
  menu = await openActions(page)
  await menu.getByRole('button', { name: 'Commissioner login' }).click()
  await page.getByLabel('Commissioner password').fill('fixture-only-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Payment details for Alex Smith' })).toBeVisible()
})

test('season navigation resets roster filters and restores the correct players', async ({ page }) => {
  await installLeagueFixtures(page, { commissioner: true })
  await page.goto(`${leaguePath}/players?season=2026`)
  const search = page.getByRole('searchbox', { name: 'Search players' })
  await expect(search).toBeVisible()
  await search.fill('Taylor')
  await page.getByLabel('Season', { exact: true }).selectOption('2025')
  await expect(search).toHaveValue('')
  await expect(page.getByRole('heading', { name: 'Old School', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Casey Patel from 2025' })).toBeVisible()
  await page.getByLabel('Season', { exact: true }).selectOption('2026')
  await expect(page.getByRole('button', { name: 'Remove Taylor Reed from 2026' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Casey Patel to 2026' })).toBeVisible()
})

test('a failed score write preserves the draft for retry', async ({ page }) => {
  await installLeagueFixtures(page, { commissioner: true })
  let fail = true
  let submitted: unknown
  await page.route('**/scores/manual', async route => {
    submitted = route.request().postDataJSON()
    await route.fulfill(fail
      ? { status: 503, json: { success: false, error: 'Fixture save failed. Retry.' } }
      : { json: { success: true, message: 'Fixture scores saved.' } })
    fail = false
  })
  await page.goto(`${leaguePath}/scores?season=2026`)
  await page.getByRole('button', { name: 'Edit scores', exact: true }).click()
  await page.getByLabel('Score for Alex Smith').fill('123.45')
  await expect(page.getByLabel('Week', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Save week 2' }).click()
  await expect(page.getByText('Fixture save failed. Retry.')).toBeVisible()
  await expect(page.getByLabel('Score for Alex Smith')).toHaveValue('123.45')
  await page.getByRole('button', { name: 'Save week 2' }).click()
  await expect(page.getByText('Fixture scores saved.')).toBeVisible()
  expect(submitted).toMatchObject({ action: 'save_week', season: '2026', week: 2,
    scores: expect.arrayContaining([{ member_id: 'member-1', points: 123.45 }]) })
})

test('clear-season success reloads the displayed week instead of cached scores', async ({ page }) => {
  await installLeagueFixtures(page, { commissioner: true })
  let cleared = false
  await page.route('**/scores/manual', async route => {
    expect(route.request().postDataJSON()).toMatchObject({ action: 'clear_season', season: '2026' })
    cleared = true
    await route.fulfill({ json: { success: true, message: 'Fixture season cleared.' } })
  })
  await page.route('**/api/leagues/gridiron-gurus/view**', async route => {
    if (cleared && new URL(route.request().url()).searchParams.get('resource') === 'week') {
      await route.fulfill({ json: { success: true, scores: [], matchups: [] } })
    } else await route.fallback()
  })
  await page.goto(`${leaguePath}/scores?season=2026`)
  await expect(page.getByText('4 of 4 scores recorded')).toBeVisible()
  await page.getByText('Advanced season tools', { exact: true }).click()
  await page.getByRole('button', { name: 'Clear season scores' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Clear 2026 scores' }).click()
  await expect(page.getByText('0 of 4 scores recorded')).toBeVisible()
  await expect(page.getByText('127.30', { exact: true })).toHaveCount(0)
})

test('archive success immediately refreshes the shell and read-only controls', async ({ page }) => {
  const fixture = await installLeagueFixtures(page, { commissioner: true })
  let archivedAt: string | null = null
  await page.route('**/api/leagues/gridiron-gurus/lifecycle**', async route => {
    if (route.request().method() === 'POST') archivedAt = '2026-09-08T12:00:00Z'
    await route.fulfill({ json: { success: true, schema_ready: true,
      league: { ...fixture.league, archived_at: archivedAt },
      seasons: [{ season: '2026', archived_at: null, is_active: true }] } })
  })
  await page.route('**/api/leagues/gridiron-gurus/view**', async route => {
    if (new URL(route.request().url()).searchParams.get('resource') === 'shell') {
      await route.fulfill({ json: { success: true, league: { ...fixture.league, archived_at: archivedAt },
        seasons: [{ season: '2026', archived_at: null }] } })
    } else await route.fallback()
  })
  await page.goto(`${leaguePath}/settings?season=2026`)
  await page.getByRole('button', { name: 'Archive league', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Archive league', exact: true }).click()
  await expect(page.getByText('Archived league.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore league', exact: true })).toBeVisible()
  // Use in-app navigation so the assertion exercises the existing shell cache.
  const nav = page.locator('nav[aria-label="League"]:visible')
  await nav.getByRole('link', { name: 'Scores', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Weekly scores', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit scores', exact: true })).toHaveCount(0)
})
