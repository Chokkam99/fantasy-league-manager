import { espnHistory, espnSeasonData } from '../../../../test/fixtures/espnSeason'
import { parseESPNSeasonSnapshot } from '../seasonSnapshot'
import { configurationForImport, resolveSeasonImport, type SeasonImportPreview } from '../seasonImport'
const snapshot = () => parseESPNSeasonSnapshot(espnSeasonData, '2026', espnHistory, {}, '123456')
const preview = (): SeasonImportPreview => ({ revision: 'fixture', season: '2026', current_season: '2025', exists: false, espn: snapshot(), history: espnHistory, configuration: configurationForImport(snapshot(), { fee_amount: 100, prize_structure: { first: 200 } }), missing_fields: [], local_only: [], existing_weeks: [] })
it('imports confirmed format, historical identities, zero scores, and only completed weeks', () => {
  const parsed = snapshot()
  expect(parsed.format).toEqual({ total_weeks: 17, playoff_start_week: 15, playoff_spots: 2, divisions: [] })
  expect(parsed.teams.map(team => team.source_member_id)).toEqual(espnHistory.map(member => member.id))
  expect(parsed.teams.every(team => team.status === 'matched')).toBe(true)
  expect(parsed.weeks).toEqual([{ week: 1, scores: [{ team_id: 1, points: 0 }, { team_id: 2, points: 101.25 }], matchups: [{ team1_id: 1, team2_id: 2 }] }])
})
it('rejects a different season or league rather than substituting current data', () => {
  expect(() => parseESPNSeasonSnapshot(espnSeasonData, '2025', [], {}, '123456')).toThrow(/requested 2025/)
  expect(() => parseESPNSeasonSnapshot(espnSeasonData, '2026', [], {}, '777')).toThrow(/different league/)
})
it('uses stable ESPN owner identity after a rename but flags reused team IDs with different owners', () => {
  const data = JSON.parse(JSON.stringify(espnSeasonData)); data.members[0].firstName = 'Alexander'
  expect(parseESPNSeasonSnapshot(data, '2026', espnHistory, { espn_owner_mappings: { '123456': { 'owner-a': espnHistory[0].manager_id } } }, '123456').teams[0]).toMatchObject({ status: 'matched', source_member_id: espnHistory[0].id })
  expect(parseESPNSeasonSnapshot(data, '2026', espnHistory, { team_mappings: { '2026': { '1': espnHistory[0].id } } }, '123456').teams[0].reason).toMatch(/different player/)
})
it('does not invent missing scores or silently select a co-owner', () => {
  const data = JSON.parse(JSON.stringify(espnSeasonData))
  delete data.schedule[0].home.totalPoints
  delete data.teams[0].primaryOwner
  data.teams[0].owners = ['owner-a','owner-b']
  const parsed = parseESPNSeasonSnapshot(data, '2026', espnHistory, {}, '123456')
  expect(parsed.weeks).toEqual([])
  expect(parsed.warnings[0]).toMatch(/Week 1/)
  expect(parsed.teams[0].status).toBe('unconfirmed')
})
it('requires per-week points for multiweek matchup periods', () => {
  const data = JSON.parse(JSON.stringify(espnSeasonData)); data.scoringPeriodId = 3
  data.settings.scheduleSettings.matchupPeriods = { '1': [1,2], '2':[3] }
  expect(parseESPNSeasonSnapshot(data,'2026',espnHistory,{},'123456').weeks).toEqual([])
  data.schedule[0].home.pointsByScoringPeriod = { '1':0,'2':10 }
  data.schedule[0].away.pointsByScoringPeriod = { '1':20,'2':30 }
  expect(parseESPNSeasonSnapshot(data,'2026',espnHistory,{},'123456').weeks.map(week => week.scores[0].points)).toEqual([0,10])
})
it('preserves local finance and ignores attempts to override confirmed ESPN fields', () => {
  const next = preview()
  const resolved = resolveSeasonImport(next, { resolutions: [{ team_id: 1, source_member_id: null, manager_name: 'Tampered' }], missing_values: { fee_amount: 0, total_weeks: 3 } })
  expect(resolved.errors).toEqual([])
  expect(resolved.configuration.fee_amount).toBe(100)
  expect(resolved.configuration.total_weeks).toBe(17)
  expect(resolved.teams[0].manager_name).toBe('Alex Smith')
})
it('requires confirmation of unknown identities and missing settings', () => {
  const next = preview(); next.espn.teams[0] = { ...next.espn.teams[0], status: 'unconfirmed', source_member_id: null, manager_name: '' }
  next.missing_fields = ['playoff_spots']
  expect(resolveSeasonImport(next, {}).errors.join(' ')).toMatch(/Confirm the player/)
  const resolved = resolveSeasonImport(next, { resolutions: [{ team_id: 1, source_member_id: espnHistory[0].id, manager_name: 'Alex Smith', confirmed: true }], missing_values: { playoff_spots: 2 } })
  expect(resolved.errors).toEqual([])
})
it('requires explicit review of app-only players and prevents truncating existing scored weeks', () => {
  const next = preview(); next.history = [...espnHistory, { ...espnHistory[0], id: '123e4567-e89b-42d3-a456-426614174003', manager_id: '223e4567-e89b-42d3-a456-426614174003', manager_name: 'Departed', season: '2026' }]
  next.existing_weeks = [18]
  expect(resolveSeasonImport(next, {}).errors.join(' ')).toMatch(/absent from ESPN/)
  expect(resolveSeasonImport(next, { confirm_departures: true }).errors.join(' ')).toMatch(/exclude existing scores/)
})
