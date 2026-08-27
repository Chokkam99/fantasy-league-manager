import {
  PUBLIC_LEAGUE_COLUMNS,
  PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE,
} from '@/lib/publicLeague'

describe('public league read contract', () => {
  it('includes the fields required by shared league views', () => {
    expect(PUBLIC_LEAGUE_COLUMNS).toContain('current_season')
    expect(PUBLIC_LEAGUE_COLUMNS).toContain('last_sync_at')
    expect(PUBLIC_LEAGUE_COLUMNS).toContain('sync_status')
  })

  it('adds only public archive state to the lifecycle-aware read', () => {
    expect(PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE).toContain('archived_at')
    expect(PUBLIC_LEAGUE_COLUMNS).not.toContain('archived_at')
  })

  it.each([
    'platform_config',
    'espn_s2',
    'espn_swid',
    'espn_league_id',
  ])('never selects the private %s column in browser queries', (column) => {
    expect(PUBLIC_LEAGUE_COLUMNS).not.toContain(column)
    expect(PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE).not.toContain(column)
  })
})
