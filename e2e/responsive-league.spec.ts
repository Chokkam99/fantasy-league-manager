import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { installLeagueFixtures } from './fixtures'

const leaguePath = '/league/gridiron-gurus'

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
          BUTTON: 17,
          INPUT: 17,
          SELECT: 17,
          TEXTAREA: 17,
        }

        return [...document.querySelectorAll('h1, h2, h3, button, input, select, textarea')]
          .filter((element) => {
            const box = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return box.width > 0 && box.height > 0 && style.visibility !== 'hidden'
          })
          .flatMap((element) => {
            const limit = element.tagName === 'H1' && element.classList.contains('editorial-title')
              ? mobile ? 32 : 56
              : limits[element.tagName]
            const size = Number.parseFloat(window.getComputedStyle(element).fontSize)
            return limit && size > limit
              ? [`${element.tagName.toLowerCase()} ${size}px > ${limit}px: ${element.textContent?.trim().slice(0, 40) || element.getAttribute('aria-label') || ''}`]
              : []
          })
      }),
    )
    .toEqual([])
}

async function expectTableAlignment(table: Locator) {
  const audit = await table.evaluate((element) => {
    const visible = (cell: Element) => {
      const box = cell.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    }
    const headers = [...element.querySelectorAll('thead th')].filter(visible)
    const firstRow = element.querySelector('tbody tr:not(.border-y)')
    const cells = firstRow
      ? [...firstRow.querySelectorAll(':scope > th, :scope > td')].filter(visible)
      : []
    const alignments = headers.map((header, index) => ({
      body: cells[index] ? getComputedStyle(cells[index]).textAlign : null,
      header: getComputedStyle(header).textAlign,
    }))

    return {
      alignments,
      bodyLeftPadding: cells[0]
        ? Number.parseFloat(getComputedStyle(cells[0]).paddingLeft)
        : 0,
      bodyRightPadding: cells.at(-1)
        ? Number.parseFloat(getComputedStyle(cells.at(-1)!).paddingRight)
        : 0,
      headerLeftPadding: headers[0]
        ? Number.parseFloat(getComputedStyle(headers[0]).paddingLeft)
        : 0,
      headerRightPadding: headers.at(-1)
        ? Number.parseFloat(getComputedStyle(headers.at(-1)!).paddingRight)
        : 0,
    }
  })

  expect(audit.alignments.every(({ body, header }) => body === header)).toBe(true)
  expect(audit.headerLeftPadding).toBeGreaterThanOrEqual(16)
  expect(audit.headerRightPadding).toBeGreaterThanOrEqual(16)
  expect(audit.bodyLeftPadding).toBeGreaterThanOrEqual(16)
  expect(audit.bodyRightPadding).toBeGreaterThanOrEqual(16)
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
    .getByRole('link', { name: label === 'Players' ? /^Players(?: & dues)?$/ : label, exact: true })
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
    const attention = page.getByRole('region', { name: 'Commissioner attention' })
    await expect(attention).toBeVisible()
    const attentionBox = await attention.boundingBox()
    const summaryBox = await page.getByRole('region', { name: 'League summary' }).boundingBox()
    expect(attentionBox!.y).toBeLessThan(summaryBox!.y)
    await expect(page.getByRole('heading', { name: 'Season results' })).toBeVisible()
    await expect(page.getByRole('rowheader', { name: '2025 Final' })).toBeVisible()
    const completedSeasonPlayoffs = page
      .locator('details')
      .filter({ hasText: 'Playoff teams' })
      .last()
    await expect(completedSeasonPlayoffs).not.toHaveAttribute('open', '')
    await completedSeasonPlayoffs.locator('summary').click()
    await expect(
      page.getByRole('list', { name: '2025 playoff teams' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Player history' })).toBeVisible()
    await expectTableAlignment(page.getByRole('table', { name: 'Season results' }))
    const playerHistory = page.getByRole('region', {
      name: 'Player results by season',
    })
    await expect(playerHistory).toBeVisible()
    await expectTableAlignment(
      playerHistory.getByRole('table', { name: 'Player results by season' }),
    )
    await expect(
      playerHistory.getByLabel(/Alex Smith, 2026: Champion as Sunday Scaries/),
    ).toBeVisible()
    await expect(
      playerHistory.getByLabel(/Alex Smith, 2025: .* as Old Sunday Scaries/),
    ).toBeVisible()
    if (isMobile(testInfo)) {
      await page.getByRole('button', { name: 'Open league actions' }).click()
      await page
        .locator('[aria-label="League actions"]')
        .getByRole('button', { name: 'Share league' })
        .click()
    } else {
      await page.getByRole('button', { name: 'Share league' }).click()
    }
    await expect(page.getByText('League link copied.')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __copiedLeagueLink?: string })
              .__copiedLeagueLink,
        ),
      )
      .toBe('http://127.0.0.1:3217/league/gridiron-gurus')
    const dismissToast = page.getByRole('button', { name: 'Dismiss notification' })
    const dismissToastBox = await dismissToast.boundingBox()
    expect(dismissToastBox).not.toBeNull()
    expect(dismissToastBox!.width).toBeLessThanOrEqual(32)
    expect(dismissToastBox!.height).toBeLessThanOrEqual(32)
    expect(dismissToastBox!.y).toBeLessThanOrEqual(48)
    await dismissToast.click()
    if (isMobile(testInfo)) {
      await page.keyboard.press('Escape')
    }
    await expectNoDocumentOverflow(page)

    await openPrimaryNav(page, 'Standings')
    await expectHeading(page, 'Standings')
    await expect(page.getByText('2/14', { exact: true })).toBeVisible()
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
    const fullSeasonStandings = page.getByRole('table', {
      name: 'Full season standings',
    })
    await expectTableAlignment(fullSeasonStandings)
    await expect(
      page.getByRole('region', { name: 'Standings by division' }),
    ).toHaveCount(0)
    await expectNoDocumentOverflow(page)
    const orderingDetails = page
      .locator('details')
      .filter({ hasText: 'How these standings are ordered' })
    const orderingSummary = orderingDetails.locator('summary')
    await orderingSummary.click()
    const orderingItems = orderingDetails.locator('ol > li')
    await expect(orderingItems).toHaveCount(3)
    const itemTopPositions = await orderingItems.evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().top)),
    )
    expect(itemTopPositions[1]).toBeGreaterThan(itemTopPositions[0])
    expect(itemTopPositions[2]).toBeGreaterThan(itemTopPositions[1])
    if (!isMobile(testInfo)) {
      await expect(orderingSummary).toHaveCSS('font-size', '17px')
      await expect(orderingItems.first()).toHaveCSS('font-size', '15px')
    }
    if (isMobile(testInfo)) {
      const visibleStandingsHeaders = fullSeasonStandings.locator(
        'thead th:visible',
      )
      const finalHeaderBox = await visibleStandingsHeaders.last().boundingBox()
      const standingsTableBox = await fullSeasonStandings.boundingBox()
      expect(finalHeaderBox).not.toBeNull()
      expect(standingsTableBox).not.toBeNull()
      expect(Math.abs(finalHeaderBox!.x + finalHeaderBox!.width - (standingsTableBox!.x + standingsTableBox!.width))).toBeLessThanOrEqual(1)
    }

    await openPrimaryNav(page, 'Scores')
    await expectHeading(page, 'Weekly scores')
    await expect(page.getByRole('button', { name: 'Edit scores' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Sync completed week' }),
    ).toBeVisible()
    const syncButton = page.getByRole('button', { name: 'Sync completed week' })
    const syncButtonBox = await syncButton.boundingBox()
    expect(syncButtonBox).not.toBeNull()
    expect(syncButtonBox!.height).toBeLessThanOrEqual(42)
    if (!isMobile(testInfo)) {
      expect(syncButtonBox!.width).toBeLessThanOrEqual(260)
    }
    await page.getByRole('button', { name: 'Need a different week?' }).click()
    const selectedWeek = page.getByLabel('Selected week')
    const selectedWeekBox = await selectedWeek.boundingBox()
    expect(selectedWeekBox).not.toBeNull()
    expect(selectedWeekBox!.width).toBeLessThanOrEqual(128)

    await openPrimaryNav(page, 'Prizes')
    await expectHeading(page, 'League money')
    await expect(page.getByRole('heading', { name: 'Final & bonus prizes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Payout tally' })).toBeVisible()
    await expectTableAlignment(page.getByRole('table', { name: 'Payout tally' }))
    await expect(page.getByLabel(/^Recipient for /).first()).toBeVisible()
    await expect(
      page.getByRole('checkbox', {
        name: 'Paid: Sunday Scaries total payout',
      }),
    ).toBeVisible()
    if (isMobile(testInfo)) {
      const payoutTable = page.getByRole('table', { name: 'Payout tally' })
      const payoutBox = await payoutTable.boundingBox()
      const paidHeaderBox = await payoutTable.getByRole('columnheader', { name: 'Paid' }).boundingBox()
      expect(payoutBox).not.toBeNull()
      expect(paidHeaderBox).not.toBeNull()
      expect(paidHeaderBox!.x + paidHeaderBox!.width).toBeLessThanOrEqual(
        payoutBox!.x + payoutBox!.width + 1,
      )
    }

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
    await expect(duesFilter.getByRole('button')).toHaveCount(3)
    // Browser layout can report a fraction of a pixel above the 48px control height.
    expect((await duesFilter.boundingBox())!.height).toBeLessThanOrEqual(48.1)
    await expect(page.getByText('Manage player')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mark Alex Smith unpaid' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark Taylor Reed paid' })).toHaveText('Unpaid')
    await expect(page.getByRole('button', { name: 'Payment details for Alex Smith' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Alex Smith from 2026' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Casey Patel to 2026' })).toBeVisible()
    if (!isMobile(testInfo)) {
      const seasonColumns = await page
        .locator('section[aria-labelledby="current-roster-heading"]')
        .getByLabel('Seasons played')
        .evaluateAll((elements) =>
          elements.map((element) => Math.round(element.getBoundingClientRect().x)),
        )
      expect(new Set(seasonColumns).size).toBe(1)
    }

    if (isMobile(testInfo)) {
      await openLeagueAction(page, 'League rules')
    } else {
      await openPrimaryNav(page, 'Rules')
    }
    await expectHeading(page, 'League rules')
    await expect(page.getByRole('link', { name: 'View prize details' })).toHaveCSS(
      'color',
      'rgb(255, 255, 255)',
    )

    await openLeagueAction(page, 'League settings')
    await expectHeading(page, 'League settings')
    await expect(
      page.getByRole('button', { name: 'Archive league' }),
    ).toBeVisible()
    expect(mutationRequests).toHaveLength(0)
  })

  test('player can follow the public league path without management controls', async ({
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

    await page.goto(`${leaguePath}?season=2026`)
    await expectHeading(page, 'Season overview')
    await expect(page.getByRole('region', { name: 'Commissioner attention' })).toHaveCount(0)
    await expect(page.getByText('Season entry pool', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Still to collect', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Season results' })).toBeVisible()
    await expect(page.getByRole('rowheader', { name: '2025 Final' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Player history' })).toBeVisible()

    await openPrimaryNav(page, 'Standings')
    await expectHeading(page, 'Standings')
    await expect(page.getByText('2/14', { exact: true })).toBeVisible()
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
    await expect(page.getByRole('heading', { name: 'Payout tally' })).toBeVisible()
    await expect(page.getByLabel(/^Recipient for /)).toHaveCount(0)
    if (isMobile(testInfo)) {
      const payoutTable = page.getByRole('table', { name: 'Payout tally' })
      const pendingBadge = payoutTable.getByText('Pending').first()
      const payoutBox = await payoutTable.boundingBox()
      const pendingBox = await pendingBadge.boundingBox()
      expect(payoutBox).not.toBeNull()
      expect(pendingBox).not.toBeNull()
      expect(pendingBox!.x + pendingBox!.width).toBeLessThanOrEqual(
        payoutBox!.x + payoutBox!.width + 1,
      )
    }

    if (isMobile(testInfo)) {
      await openLeagueAction(page, 'League roster')
    } else {
      await openPrimaryNav(page, 'Players')
    }
    await expectHeading(page, 'League roster')
    await expect(page.getByRole('button', { name: 'Add player' })).toHaveCount(0)
    await expect(page.getByText('Mark paid')).toHaveCount(0)
    await expect(page.getByLabel('Dues for Taylor Reed: Unpaid')).toBeVisible()
    await expect(page.getByLabel('Dues for Alex Smith: Paid')).toBeVisible()

    if (isMobile(testInfo)) {
      await openLeagueAction(page, 'League rules')
    } else {
      await openPrimaryNav(page, 'Rules')
    }
    await expectHeading(page, 'League rules')

    await page.goto(`${leaguePath}/settings?season=2026`)
    await expectHeading(page, 'League settings are unavailable')
    await expect(page.getByText('Archive league')).toHaveCount(0)
    expect(mutationRequests).toEqual([])
  })
})

test('compact tablet navigation keeps roster and rules reachable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'One explicit breakpoint regression check')
  await page.setViewportSize({ width: 680, height: 900 })
  await installLeagueFixtures(page, { commissioner: false })
  await page.goto(`${leaguePath}?season=2026`)
  await expectHeading(page, 'Season overview')
  await openLeagueAction(page, 'League roster')
  await expectHeading(page, 'League roster')
  await openLeagueAction(page, 'League rules')
  await expectHeading(page, 'League rules')
  await expect(page.getByLabel('Season', { exact: true })).toHaveValue('2026')
})


test('shared roster refreshes player names and dues without reloading', async ({ page }) => {
  const fixture = await installLeagueFixtures(page, { commissioner: false })
  await page.clock.install()
  await page.goto(`${leaguePath}/players?season=2026`)
  await expectHeading(page, 'League roster')
  await expect(page.getByLabel('Dues for Taylor Reed: Unpaid')).toBeVisible()

  fixture.finance.dues[3].status = 'paid'
  fixture.finance.dues[3].paid_amount_cents = 5000
  fixture.roster[3].team_name = 'Updated team name'
  await page.clock.runFor(30_000)
  await expect(page.getByLabel('Dues for Taylor Reed: Paid')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Updated team name' })).toBeVisible()
  await expectNoDocumentOverflow(page)

  fixture.finance.dues[3].status = 'pending'
  fixture.finance.dues[3].paid_amount_cents = 0
  await page.clock.runFor(6_000)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByLabel('Dues for Taylor Reed: Unpaid')).toBeVisible()
  await expect(page.getByRole('button', { name: /Mark Taylor Reed/ })).toHaveCount(0)
})
