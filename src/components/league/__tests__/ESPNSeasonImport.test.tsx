import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ESPNSeasonImport } from '../ESPNSeasonImport'
import { espnHistory, espnSeasonData } from '../../../../test/fixtures/espnSeason'
import { parseESPNSeasonSnapshot } from '@/lib/espn/seasonSnapshot'
import { configurationForImport, type SeasonImportPreview } from '@/lib/espn/seasonImport'
const originalFetch = global.fetch
const response = (value: unknown, ok = true) => ({ ok, json: async () => value })
const metadata = { season: '2026', current_season: '2025', exists: false, connection: { is_configured: true, league_id: '123456', private_league: false, has_credentials: false } }
function preview(): SeasonImportPreview {
  const espn = parseESPNSeasonSnapshot(espnSeasonData,'2026',espnHistory,{},'123456')
  return { revision: 'fixture-revision', season: '2026', current_season: '2025', exists: false, espn, history: espnHistory, configuration: configurationForImport(espn,{ fee_amount:100 }), missing_fields: [], local_only: [], existing_weeks: [] }
}
function setup(next = preview()) {
  const fetchMock = jest.fn().mockResolvedValueOnce(response(metadata)).mockResolvedValueOnce(response({ success: true, preview: next }))
  global.fetch = fetchMock
  const onImported = jest.fn()
  render(<ESPNSeasonImport leagueId="fixture" onImported={onImported} onCancel={jest.fn()} />)
  return { fetchMock, onImported, user: userEvent.setup() }
}
afterEach(() => { global.fetch = originalFetch })
it('automatically reads saved ESPN connection and imports confirmed data without form entry', async () => {
  const { fetchMock, onImported, user } = setup()
  const apply = await screen.findByRole('button', { name: 'Create 2026 from ESPN' })
  expect(apply).toBeEnabled()
  expect(screen.queryByLabelText('Manager name')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Total weeks')).not.toBeInTheDocument()
  fetchMock.mockResolvedValueOnce(response({ success: true, season: '2026' }))
  await user.click(apply)
  await waitFor(() => expect(onImported).toHaveBeenCalledWith('2026'))
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ action:'apply',revision:'fixture-revision',confirmed:true,resolutions:[] })
})
it('shows only unresolved identity and missing format, preserving choices after a failed write', async () => {
  const next = preview()
  next.espn.teams[0] = { ...next.espn.teams[0], status:'unconfirmed', source_member_id:null, manager_name:'Alexander Smith',reason:'Confirm this returning player.' }
  next.missing_fields = ['playoff_spots']; next.espn.format.playoff_spots = null
  const { fetchMock, user } = setup(next)
  const apply = await screen.findByRole('button', { name:'Create 2026 from ESPN' })
  expect(apply).toBeDisabled()
  await user.selectOptions(screen.getByLabelText('Who is this player?'),espnHistory[0].id)
  await user.click(screen.getByLabelText('These missing settings are correct'))
  expect(apply).toBeEnabled()
  fetchMock.mockResolvedValueOnce(response({ error:'Fixture import failed.' },false))
  await user.click(apply)
  expect(await screen.findByText('Fixture import failed.')).toBeInTheDocument()
  expect(screen.getByLabelText('Who is this player?')).toHaveValue(espnHistory[0].id)
  expect(screen.getByLabelText('Manager name')).toHaveValue('Alexander Smith')
})
it('replaces a stale preview and requires fresh conflict resolution before another apply', async () => {
  const next = preview(); const { fetchMock, user } = setup(next)
  const apply = await screen.findByRole('button', { name:'Create 2026 from ESPN' })
  const changed = preview(); changed.revision='changed'; changed.espn.teams[0].status='unconfirmed'; changed.espn.teams[0].reason='Owner changed.'
  fetchMock.mockResolvedValueOnce(response({ error:'ESPN changed. Review again.',preview:changed },false))
  await user.click(apply)
  expect(await screen.findByText('Owner changed.')).toBeInTheDocument()
  expect(apply).toBeDisabled()
})
it('does not post a second import when navigation fails after success', async () => {
  const { fetchMock, onImported, user } = setup()
  onImported.mockRejectedValueOnce(new Error('Navigation'))
  const apply = await screen.findByRole('button',{name:'Create 2026 from ESPN'})
  fetchMock.mockResolvedValueOnce(response({success:true,season:'2026'}))
  await user.click(apply)
  expect(await screen.findByText(/The import completed, but the season could not be opened/)).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Open season'}))
  expect(fetchMock).toHaveBeenCalledTimes(3)
})
