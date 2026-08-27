import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeeklyScores from '@/components/WeeklyScores'
import type { LeagueMember, WeeklyScore } from '@/lib/supabase'

let mockScoresResult: { data: WeeklyScore[] | null; error: unknown }
let mockMatchupsResult: { data: unknown[] | null; error: unknown }
const mockLoadWeeklyScoresData = jest.fn()

const mockRefetchSeasonConfig = jest.fn()
jest.mock('@/lib/weeklyScoresClient', () => ({
  loadWeeklyScoresData: (...args: unknown[]) =>
    mockLoadWeeklyScoresData(...args),
}))
jest.mock('@/hooks/useSeasonConfig', () => ({
  useSeasonConfig: () => ({
    error: null,
    loading: false,
    refetch: mockRefetchSeasonConfig,
    seasonConfig: {
      total_weeks: 17,
      weekly_prize_amount: 10,
    },
  }),
}))

const members: LeagueMember[] = [
  {
    division: 'East',
    id: 'member-1',
    is_active: true,
    joined_at: null,
    league_id: 'league-1',
    manager_name: 'Alex Smith',
    payment_status: 'paid',
    season: '2026',
    team_name: 'Sunday Scaries',
    updated_at: null,
  },
  {
    division: 'West',
    id: 'member-2',
    is_active: true,
    joined_at: null,
    league_id: 'league-1',
    manager_name: 'Jordan Lee',
    payment_status: 'pending',
    season: '2026',
    team_name: 'Waiver Warriors',
    updated_at: null,
  },
]

const scores: WeeklyScore[] = [
  {
    created_at: null,
    id: 'score-1',
    is_final_score: true,
    is_playoff_week: false,
    league_id: 'league-1',
    member_id: 'member-1',
    points: 121.5,
    season: '2026',
    week_number: 1,
    week_status: 'completed',
  },
  {
    created_at: null,
    id: 'score-2',
    is_final_score: true,
    is_playoff_week: false,
    league_id: 'league-1',
    member_id: 'member-2',
    points: 130.25,
    season: '2026',
    week_number: 1,
    week_status: 'completed',
  },
]

const matchups = [
  {
    id: 'matchup-1',
    is_tie: false,
    team1_member_id: 'member-1',
    team1_score: 121.5,
    team2_member_id: 'member-2',
    team2_score: 130.25,
    winner_member_id: 'member-2',
  },
]

function renderScores(props: Partial<React.ComponentProps<typeof WeeklyScores>> = {}) {
  return render(
    <WeeklyScores
      initialWeek={1}
      leagueId="league-1"
      members={members}
      season="2026"
      {...props}
    />,
  )
}

describe('WeeklyScores', () => {
  const originalFetch = global.fetch
  const mockFetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockScoresResult = { data: scores, error: null }
    mockMatchupsResult = { data: matchups, error: null }
    mockLoadWeeklyScoresData.mockImplementation(async () => {
      if (mockScoresResult.error) throw mockScoresResult.error
      if (mockMatchupsResult.error) throw mockMatchupsResult.error
      return {
        matchups: mockMatchupsResult.data || [],
        scores: mockScoresResult.data || [],
      }
    })
    global.fetch = mockFetch
    mockFetch.mockResolvedValue({
      json: async () => ({ message: 'Week updated.', success: true }),
      ok: true,
    })
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('renders a ranked weekly result and final head-to-head matchup', async () => {
    renderScores()

    expect(
      await screen.findByRole('heading', { name: 'Week 1 ranking' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Weekly leader')).toBeInTheDocument()
    expect(screen.getAllByText('Jordan Lee').length).toBeGreaterThan(0)
    expect(screen.getAllByText('130.25').length).toBeGreaterThan(0)
    expect(screen.getByText('$10 weekly prize')).toBeInTheDocument()
    expect(screen.getByText('Final')).toBeInTheDocument()
    expect(screen.getByText('Winner')).toBeInTheDocument()
  })

  it('shows the published empty state without edit controls in read-only mode', async () => {
    mockScoresResult = { data: [], error: null }
    mockMatchupsResult = { data: [], error: null }
    renderScores({ readOnly: true })

    expect(
      await screen.findByText('No scores recorded for week 1'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The commissioner has not published this week yet.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit scores' })).not.toBeInTheDocument()
  })

  it('requires a valid score for every active player before saving', async () => {
    const user = userEvent.setup()
    mockScoresResult = { data: [], error: null }
    mockMatchupsResult = { data: [], error: null }
    renderScores()

    await user.click(await screen.findByRole('button', { name: 'Edit scores' }))
    await user.type(screen.getByLabelText('Score for Alex Smith'), '101.25')
    await user.click(screen.getByRole('button', { name: 'Save week 1' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid score for every active player before saving.',
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends manual scores through the protected server route', async () => {
    const user = userEvent.setup()
    mockScoresResult = { data: [], error: null }
    mockMatchupsResult = { data: [], error: null }
    renderScores()

    await user.click(await screen.findByRole('button', { name: 'Edit scores' }))
    await user.type(screen.getByLabelText('Score for Alex Smith'), '101.25')
    await user.type(screen.getByLabelText('Score for Jordan Lee'), '99.5')
    await user.click(screen.getByRole('button', { name: 'Save week 1' }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/leagues/league-1/scores/manual',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      action: 'save_week',
      scores: [
        { member_id: 'member-1', points: 101.25 },
        { member_id: 'member-2', points: 99.5 },
      ],
      season: '2026',
      week: 1,
    })
    expect(await screen.findByText('Week updated.')).toBeInTheDocument()
  })

  it('requires confirmation before clearing a populated week', async () => {
    const user = userEvent.setup()
    renderScores()

    await user.click(await screen.findByRole('button', { name: 'Edit scores' }))
    await user.click(screen.getByRole('button', { name: 'Clear this week' }))

    expect(
      screen.getByRole('dialog', { name: 'Clear week 1 scores?' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear week 1' }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      action: 'clear_week',
      season: '2026',
      week: 1,
    })
  })

  it('reloads when the commissioner selects another week', async () => {
    const user = userEvent.setup()
    renderScores()

    await screen.findByRole('heading', { name: 'Week 1 ranking' })
    expect(mockLoadWeeklyScoresData).toHaveBeenCalledTimes(1)
    await user.selectOptions(screen.getByLabelText('Week'), '2')

    expect(
      await screen.findByRole('heading', { name: 'Week 2 ranking' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(mockLoadWeeklyScoresData).toHaveBeenCalledTimes(2))
  })

  it('shows a retryable error when either weekly query fails', async () => {
    const user = userEvent.setup()
    mockScoresResult = { data: null, error: new Error('offline') }
    renderScores()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This week could not be loaded.',
    )

    mockScoresResult = { data: [], error: null }
    mockMatchupsResult = { data: [], error: null }
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByText('No scores recorded for week 1'),
    ).toBeInTheDocument()
  })
})
