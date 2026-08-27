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

async function expectTypographyScale(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const mobile = window.innerWidth < 640
        const limits: Record<string, number> = {
          H1: mobile ? 24 : 36,
          H2: mobile ? 20 : 24,
          H3: mobile ? 18 : 20,
          BUTTON: 16,
          INPUT: 16,
          SELECT: 16,
          TEXTAREA: 16,
        }

        return [...document.querySelectorAll('h1, h2, h3, button, input, select, textarea')]
          .filter((element) => {
            const box = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return box.width > 0 && box.height > 0 && style.visibility !== 'hidden'
          })
          .flatMap((element) => {
            const limit = limits[element.tagName]
            const size = Number.parseFloat(window.getComputedStyle(element).fontSize)
            return limit && size > limit
              ? [`${element.tagName.toLowerCase()} ${size}px > ${limit}px: ${element.textContent?.trim().slice(0, 40) || element.getAttribute('aria-label') || ''}`]
              : []
          })
      }),
    )
    .toEqual([])
}

async function expectHeading(page: Page, name: string | RegExp) {
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expectNoDocumentOverflow(page)
  await expectTypographyScale(page)
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
  test('signed-out home keeps context before a compact sign-in', async ({
    page,
  }) => {
    await installLeagueFixtures(page, { commissioner: false })
    await page.goto('/')
    await expectHeading(page, 'Keep every league in one place.')

    const headingBox = await page
      .getByRole('heading', { level: 1, name: 'Keep every league in one place.' })
      .boundingBox()
    const password = page.getByLabel('Commissioner password')
    const passwordBox = await password.boundingBox()

    expect(headingBox).not.toBeNull()
    expect(passwordBox).not.toBeNull()
    expect(headingBox!.y).toBeLessThan(passwordBox!.y)
    await expect(password).toHaveAttribute('placeholder', 'Password')
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await expect(page.getByText('Use the private password for this league office.')).toHaveCount(0)
  })

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
    if (isMobile(testInfo)) {
      await expect(page.locator('[aria-label="League actions"]')).toBeHidden()
    }
    await expect(page.getByRole('button', { name: 'Create & copy link' })).toBeVisible()
    await expectNoDocumentOverflow(page)
    await page.getByRole('button', { name: 'Close player access' }).click()

    await openPrimaryNav(page, 'Standings')
    await expectHeading(page, 'Standings')
    await expect(
      page.getByRole('region', { name: 'Standings by division' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'East' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'West' })).toBeVisible()
    await page.getByRole('button', { name: 'Full season' }).click()
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Standings through the playoffs',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Standings by division' }),
    ).toHaveCount(0)
    await expectNoDocumentOverflow(page)

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
    const duesFilter = page.getByRole('group', { name: 'Filter roster by dues status' })
    await expect(duesFilter.getByRole('button')).toHaveCount(4)
    expect((await duesFilter.boundingBox())!.height).toBeLessThanOrEqual(48)
    await expect(page.getByText('Manage player')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mark Alex Smith unpaid' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark Taylor Reed paid' })).toHaveText('Partial')
    await expect(page.getByRole('button', { name: 'Payment details for Alex Smith' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Alex Smith from 2026' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Casey Patel to 2026' })).toBeVisible()

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
    await expectHeading(page, 'Standings')
    await expect(
      page.getByRole('region', { name: 'Standings by division' }),
    ).toBeVisible()

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
      await openLeagueAction(page, 'League roster')
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
