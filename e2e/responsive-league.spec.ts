import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { installLeagueFixtures } from './fixtures'

const leaguePath = '/league/gridiron-gurus'
const shareToken = 'a'.repeat(43)

async function expectNoDocumentOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        body: document.body.scrollWidth <= window.innerWidth,
        document:
          document.documentElement.scrollWidth <= window.innerWidth,
      })),
    )
    .toEqual({ body: true, document: true })
}

async function expectHeading(page: Page, name: string | RegExp) {
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expectNoDocumentOverflow(page)
}

function isMobile(testInfo: TestInfo) {
  return testInfo.project.name.startsWith('mobile-')
}

async function openPrimaryNav(page: Page, label: string) {
  await page
    .locator('nav[aria-label="League"]:visible')
    .getByRole('link', { name: label, exact: true })
    .click()
}

async function openLeagueAction(page: Page, label: string) {
  await page.getByRole('button', { name: 'Open league actions' }).click()
  await page
    .locator('[aria-label="League actions"]')
    .getByRole('link', { name: label, exact: true })
    .click()
}

test.describe('responsive league journeys', () => {
  test('commissioner can traverse every primary management view', async ({
    page,
  }, testInfo) => {
    await installLeagueFixtures(page, { commissioner: true })
    const mutationRequests: string[] = []
    page.on('request', (request) => {
      if (
        !['GET', 'OPTIONS'].includes(request.method()) &&
        request.url().includes('/api/leagues/')
      ) {
        mutationRequests.push(`${request.method()} ${request.url()}`)
      }
    })

    await page.goto('/')
    await expectHeading(page, 'League dashboard')
    await page.getByRole('link', { name: 'Open Gridiron Gurus' }).click()
    await expectHeading(page, 'Season overview')
    if (isMobile(testInfo)) {
      await page.getByRole('button', { name: 'Open league actions' }).click()
      await page
        .locator('[aria-label="League actions"]')
        .getByRole('button', { name: 'Player access' })
        .click()
    } else {
      await page.getByRole('button', { name: 'Player access' }).click()
    }
    await expect(page.getByRole('dialog', { name: 'Player access' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create & copy link' })).toBeVisible()
    await expectNoDocumentOverflow(page)
    await page.getByRole('button', { name: 'Close player access' }).click()

    await openPrimaryNav(page, 'Standings')
    await expectHeading(page, 'Playoff picture')

    await openPrimaryNav(page, 'Scores')
    await expectHeading(page, 'Weekly scores')
    await expect(page.getByRole('button', { name: 'Edit scores' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Sync completed week' }),
    ).toBeVisible()

    await openPrimaryNav(page, 'Prizes')
    await expectHeading(page, 'League money')
    await expect(page.getByLabel('Recipient').first()).toBeVisible()

    await openPrimaryNav(page, 'Overview')
    await expectHeading(page, 'Season overview')

    if (isMobile(testInfo)) {
      await openLeagueAction(page, 'Players and dues')
    } else {
      await openPrimaryNav(page, 'Players')
    }
    await expectHeading(page, 'Players & dues')
    await expect(page.getByRole('button', { name: 'Add player' })).toBeVisible()

    if (isMobile(testInfo)) {
      await openLeagueAction(page, 'League rules')
    } else {
      await openPrimaryNav(page, 'Rules')
    }
    await expectHeading(page, 'League rules')

    await openLeagueAction(page, 'League settings')
    await expectHeading(page, 'League settings')
    await expect(
      page.getByRole('button', { name: 'Archive league' }),
    ).toBeVisible()
    expect(mutationRequests).toEqual([])
  })

  test('shared player can follow league progress without management controls', async ({
    page,
  }, testInfo) => {
    await installLeagueFixtures(page, { commissioner: false })
    const mutationRequests: string[] = []
    page.on('request', (request) => {
      if (
        !['GET', 'OPTIONS'].includes(request.method()) &&
        request.url().includes('/api/leagues/')
      ) {
        mutationRequests.push(`${request.method()} ${request.url()}`)
      }
    })

    await page.goto(`${leaguePath}?season=2026&share=${shareToken}`)
    await expectHeading(page, 'Season overview')

    await openPrimaryNav(page, 'Standings')
    await expectHeading(page, 'Playoff picture')

    await openPrimaryNav(page, 'Scores')
    await expectHeading(page, 'Weekly scores')
    await expect(
      page.getByRole('button', { name: 'Edit scores' }),
    ).toHaveCount(0)
    await expect(page.getByText('Score imports')).toHaveCount(0)

    await openPrimaryNav(page, 'Prizes')
    await expectHeading(page, 'League money')
    await expect(page.getByLabel('Recipient')).toHaveCount(0)

    if (isMobile(testInfo)) {
      await openLeagueAction(page, 'Players and dues')
    } else {
      await openPrimaryNav(page, 'Players')
    }
    await expectHeading(page, 'League roster')
    await expect(page.getByRole('button', { name: 'Add player' })).toHaveCount(0)
    await expect(page.getByText('Mark paid')).toHaveCount(0)

    if (isMobile(testInfo)) {
      await openLeagueAction(page, 'League rules')
    } else {
      await openPrimaryNav(page, 'Rules')
    }
    await expectHeading(page, 'League rules')

    await page.goto(`${leaguePath}/settings?season=2026&share=${shareToken}`)
    await expectHeading(page, 'League settings are unavailable')
    await expect(page.getByText('Archive league')).toHaveCount(0)
    expect(mutationRequests).toEqual([])
  })
})
