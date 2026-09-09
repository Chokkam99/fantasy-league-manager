import type { SeasonImportMember } from '../../src/lib/espn/seasonSnapshot'
export const espnSeasonData = {
  id: 123456, seasonId: 2026, scoringPeriodId: 2,
  status: { currentScoringPeriod: 2, latestScoringPeriod: 17, finalScoringPeriod: 17, isActive: true },
  settings: { name: 'ESPN Friends', scheduleSettings: { matchupPeriodCount: 14, playoffTeamCount: 2, divisions: [], matchupPeriods: Object.fromEntries(Array.from({ length: 17 }, (_, index) => [String(index + 1), [index + 1]])) } },
  members: [{ id: 'owner-a', firstName: 'Alex', lastName: 'Smith' }, { id: 'owner-b', firstName: 'Blake', lastName: 'Jones' }],
  teams: [{ id: 1, name: 'Sunday Stars', primaryOwner: 'owner-a', owners: ['owner-a'] }, { id: 2, name: 'Desert Owls', primaryOwner: 'owner-b', owners: ['owner-b'] }],
  schedule: [{ matchupPeriodId: 1, home: { teamId: 1, totalPoints: 0 }, away: { teamId: 2, totalPoints: 101.25 } }],
}
export const espnHistory: SeasonImportMember[] = [
  { id: '123e4567-e89b-42d3-a456-426614174000', manager_id: '223e4567-e89b-42d3-a456-426614174000', manager_name: 'Alex Smith', team_name: 'Old Stars', season: '2025', is_active: true, division: null },
  { id: '123e4567-e89b-42d3-a456-426614174001', manager_id: '223e4567-e89b-42d3-a456-426614174001', manager_name: 'Blake Jones', team_name: 'Old Owls', season: '2025', is_active: true, division: null },
]
