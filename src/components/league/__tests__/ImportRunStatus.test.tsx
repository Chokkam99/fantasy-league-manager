import { render, screen } from '@testing-library/react'
import {
  ImportRunStatus,
  type ImportRunSummary,
} from '@/components/league/ImportRunStatus'

const baseRun: ImportRunSummary = {
  completed_at: '2026-09-16T09:02:00.000Z',
  error_message: null,
  matchup_count: 5,
  score_count: 10,
  started_at: '2026-09-16T09:00:00.000Z',
  status: 'succeeded',
  trigger_mode: 'scheduled',
  week_number: 2,
}

describe('ImportRunStatus', () => {
  it('summarizes a completed automatic import', () => {
    render(<ImportRunStatus run={baseRun} />)

    expect(screen.getByText('Week 2 · Automatic')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText(/10 scores · 5 matchups/)).toBeInTheDocument()
  })

  it('shows a useful failure without repeating the league-level error', () => {
    const failedRun = {
      ...baseRun,
      error_message: 'TypeError: ESPN week 3 fetch failed',
      status: 'failed',
      trigger_mode: 'manual',
      week_number: 3,
    }

    const { rerender } = render(<ImportRunStatus run={failedRun} />)

    expect(screen.getByText('Week 3 · Manual')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(
      screen.getByText(
        'ESPN could not be reached for week 3. Retry when the connection is available.',
      ),
    ).toBeInTheDocument()

    rerender(
      <ImportRunStatus
        lastSyncError="TypeError: ESPN week 3 fetch failed"
        run={failedRun}
      />,
    )
    expect(
      screen.queryByText(
        'ESPN could not be reached for week 3. Retry when the connection is available.',
      ),
    ).not.toBeInTheDocument()
  })

  it('labels an unfinished run without claiming data was imported', () => {
    render(
      <ImportRunStatus
        run={{
          ...baseRun,
          completed_at: null,
          matchup_count: 0,
          score_count: 0,
          status: 'running',
        }}
      />,
    )

    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.queryByText(/scores/)).not.toBeInTheDocument()
  })

  it('distinguishes a bounded automatic correction pass', () => {
    render(
      <ImportRunStatus
        run={{ ...baseRun, trigger_mode: 'scheduled_correction', week_number: 4 }}
      />,
    )

    expect(screen.getByText('Week 4 · Automatic correction')).toBeInTheDocument()
  })
})
