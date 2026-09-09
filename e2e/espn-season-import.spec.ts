import { expect, test } from '@playwright/test'
import { installLeagueFixtures } from './fixtures'
import { espnHistory, espnSeasonData } from '../test/fixtures/espnSeason'
import { parseESPNSeasonSnapshot } from '../src/lib/espn/seasonSnapshot'
import { configurationForImport, type SeasonImportPreview } from '../src/lib/espn/seasonImport'

function preview(season: string, exists: boolean): SeasonImportPreview {
  const data = { ...espnSeasonData, seasonId: Number(season) }
  const espn = parseESPNSeasonSnapshot(data,season,espnHistory,{},'123456')
  return { revision:'browser-fixture',season,current_season:'2026',exists,espn,history:espnHistory,configuration:configurationForImport(espn,{fee_amount:100}),missing_fields:[],local_only:[],existing_weeks:[] }
}

test('existing-season ESPN import is the primary roster action and needs no input for confirmed data', async ({ page }) => {
  await installLeagueFixtures(page,{commissioner:true})
  const next = preview('2026',true)
  let body: Record<string,unknown> | undefined
  await page.route('**/seasons/espn**', async route => {
    if(route.request().method()==='GET') return route.fulfill({json:{success:true,season:'2026',current_season:'2026',exists:true,connection:{is_configured:true,league_id:'123456',private_league:false,has_credentials:false}}})
    const request = route.request().postDataJSON()
    if(request.action==='preview') return route.fulfill({json:{success:true,preview:next}})
    body=request
    await route.fulfill({json:{success:true,season:'2026',imported_weeks:1,players:2}})
  })
  await page.goto('/league/gridiron-gurus/players?season=2026')
  await page.getByRole('button',{name:'Import from ESPN',exact:true}).click()
  await expect(page.getByRole('button',{name:'Update 2026 from ESPN'})).toBeEnabled()
  await expect(page.getByLabel('Manager name',{exact:true})).toHaveCount(0)
  await expect(page.getByLabel('Total weeks',{exact:true})).toHaveCount(0)
  await page.getByText('Confirmed data from ESPN',{exact:true}).click()
  await expect(page.getByText('Alex Smith',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByRole('button',{name:'Update 2026 from ESPN'}).click()
  await expect(page).toHaveURL(/\/players\?season=2026$/)
  expect(body).toMatchObject({action:'apply',revision:'browser-fixture',confirmed:true,resolutions:[],missing_values:{}})
})

test('next-season import asks only about conflicts and preserves answers when applying fails', async ({ page }) => {
  await installLeagueFixtures(page,{commissioner:true})
  const next = preview('2027',false)
  next.espn.teams[0] = {...next.espn.teams[0],status:'unconfirmed',source_member_id:null,manager_name:'Alexander Smith',reason:'Confirm whether this owner is returning.'}
  next.espn.format.playoff_spots=null; next.missing_fields=['playoff_spots']
  let writes=0
  await page.route('**/seasons/espn**', async route => {
    if(route.request().method()==='GET') return route.fulfill({json:{success:true,season:'2027',current_season:'2026',exists:false,connection:{is_configured:true,league_id:'123456',private_league:false,has_credentials:false}}})
    if(route.request().postDataJSON().action==='preview') return route.fulfill({json:{success:true,preview:next}})
    writes++
    await route.fulfill(writes===1 ? {status:503,json:{success:false,error:'Fixture import unavailable. Retry.'}} : {json:{success:true,season:'2027'}})
  })
  await page.goto('/league/gridiron-gurus/season-setup?season=2026')
  const apply=page.getByRole('button',{name:'Create 2027 from ESPN'})
  await expect(apply).toBeDisabled()
  await expect(page.getByLabel('Who is this player?')).toHaveCount(1)
  await page.getByLabel('Who is this player?').selectOption(espnHistory[0].id)
  await page.getByLabel('These missing settings are correct').check()
  await expect(apply).toBeEnabled()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await apply.click()
  await expect(page.getByText('Fixture import unavailable. Retry.')).toBeVisible()
  await expect(page.getByLabel('Who is this player?')).toHaveValue(espnHistory[0].id)
  await apply.click()
  await expect(page).toHaveURL(/\/players\?season=2027$/)
  expect(writes).toBe(2)
})
