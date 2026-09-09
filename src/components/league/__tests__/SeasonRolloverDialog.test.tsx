import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SeasonSetupForm from '../SeasonRolloverDialog'
import { seasonSetupPreview } from '../../../../test/fixtures/seasonSetup'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'
import { invalidateFinanceCache } from '@/lib/financeClient'

jest.mock('@/lib/leagueReadClient', () => ({ invalidateLeagueReadCache: jest.fn() }))
jest.mock('@/lib/financeClient', () => ({ invalidateFinanceCache: jest.fn() }))
const originalFetch = global.fetch
const response = (payload: unknown, ok = true) => ({ json: async () => payload, ok })
function setup(onStarted = jest.fn(), preview = seasonSetupPreview) {
  const fetchMock = jest.fn().mockResolvedValue(response({ preview }))
  global.fetch = fetchMock
  const view = render(<SeasonSetupForm leagueId="fixture-league" onCancel={jest.fn()} onStarted={onStarted} />)
  return { ...view, fetchMock, onStarted, user: userEvent.setup() }
}
async function review(user: ReturnType<typeof userEvent.setup>) {
  for (const step of ['format', 'money', 'review']) await user.click(screen.getByRole('button', { name: `Continue to ${step}` }))
}
afterEach(() => { global.fetch = originalFetch; sessionStorage.clear(); jest.clearAllMocks() })

it('keeps historical identity through renaming, departures, comebacks, and new players', async () => {
  const { user, fetchMock, onStarted } = setup()
  await user.click(await screen.findByRole('button', { name: 'Edit Christopher Jones' }))
  await user.clear(screen.getByLabelText('Manager name')); await user.type(screen.getByLabelText('Manager name'), 'Chris Jones')
  await user.clear(screen.getByLabelText('Team name')); await user.type(screen.getByLabelText('Team name'), 'New Team')
  await user.click(screen.getByRole('button', { name: 'Save player' }))
  await user.click(screen.getByRole('button', { name: 'Remove Jordan Lee from roster' }))
  expect(screen.getByRole('button', { name: 'Continue to format' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Add Jordan Lee to roster' }))
  await user.click(screen.getByRole('button', { name: 'Add Past Player to roster' }))
  expect(screen.getByRole('button', { name: 'Continue to format' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Add new player' }))
  await user.type(screen.getByLabelText('Manager name'), 'New Manager')
  await user.type(screen.getByLabelText('Team name'), 'Expansion Team')
  await user.click(screen.getByRole('button', { name: 'Add to roster' }))
  await review(user)
  expect(screen.getByText(/ESPN league 123456 and its securely stored connection carry forward/)).toBeInTheDocument()
  expect(screen.getByText(/Automatic weekly sync remains on/)).toBeInTheDocument()
  fetchMock.mockResolvedValueOnce(response({ target_season: '2026' }))
  await user.click(screen.getByRole('button', { name: 'Create 2026 season' }))
  await waitFor(() => expect(onStarted).toHaveBeenCalledWith('2026'))
  const body = JSON.parse(fetchMock.mock.calls.find(call => call[1]?.method === 'POST')![1].body)
  expect(body.members.map((member: { source_member_id: string | null }) => member.source_member_id)).toEqual([...seasonSetupPreview.members.map(member => member.id), null])
  expect(body.members[0]).toMatchObject({ manager_name: 'Chris Jones', team_name: 'New Team' })
  expect(invalidateLeagueReadCache).toHaveBeenCalledWith('fixture-league')
  expect(invalidateFinanceCache).toHaveBeenCalledWith('fixture-league')
  expect(sessionStorage.getItem('flm-season-draft:fixture-league:2026')).toBeNull()
})

it('finds historical players when adding a newcomer and restores a saved draft', async () => {
  const { user, unmount } = setup()
  await user.click(await screen.findByRole('button', { name: 'Add new player' }))
  await user.type(screen.getByLabelText('Manager name'), 'past player')
  expect(screen.getByRole('button', { name: 'Add to roster' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Bring back Past Player' }))
  await user.click(screen.getByRole('button', { name: 'Remove Jordan Lee from roster' }))
  await user.click(screen.getByRole('button', { name: 'Continue to format' }))
  unmount()
  setup()
  expect(await screen.findByText(/Draft restored/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Shape the season' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '1. Players' }))
  expect(screen.getByRole('button', { name: 'Remove Past Player from roster' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add Jordan Lee to roster' })).toBeInTheDocument()
})

it('preserves a failed creation for retry and never resubmits after a navigation failure', async () => {
  const onStarted = jest.fn().mockRejectedValueOnce(new Error('Navigation failed')).mockResolvedValue(undefined)
  const { user, fetchMock } = setup(onStarted)
  await screen.findByRole('heading', { name: /Who’s playing/ })
  await review(user)
  fetchMock.mockResolvedValueOnce(response({ error: 'Temporary failure' }, false)).mockResolvedValueOnce(response({ target_season: '2026' }))
  await user.click(screen.getByRole('button', { name: 'Create 2026 season' }))
  expect(await screen.findByText('Temporary failure')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Create 2026 season' }))
  expect(await screen.findByText(/The season was created, but could not be opened/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Open players & dues' }))
  expect(onStarted).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(2)
})

it('allows roster work before fixing copied playoff settings and exposes existing seasons safely', async () => {
  const { user, unmount } = setup(jest.fn(), { ...seasonSetupPreview, source_configuration: { ...seasonSetupPreview.source_configuration, playoff_spots: 6 } })
  await user.click(await screen.findByRole('button', { name: 'Continue to format' }))
  expect(screen.getByRole('button', { name: 'Continue to money' })).toBeDisabled()
  unmount()
  setup(jest.fn(), { ...seasonSetupPreview, can_start: false, target_exists: true })
  expect(await screen.findByRole('heading', { name: '2026 already exists' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create 2026 season' })).not.toBeInTheDocument()
})

it('keeps inactive last-season players in the correct directory group', async () => {
  const { user } = setup(jest.fn(), { ...seasonSetupPreview, members: seasonSetupPreview.members.map(member => ({ ...member, last_season: '2025' })) })
  await screen.findByRole('heading', { name: /Who’s playing/ })
  await user.selectOptions(screen.getByLabelText('Returning player group'), 'last')
  expect(screen.getByRole('button', { name: 'Add Past Player to roster' })).toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Returning player group'), 'earlier')
  expect(screen.queryByRole('button', { name: 'Add Past Player to roster' })).not.toBeInTheDocument()
})
