import { normalizedManagerName } from '@/lib/managerIdentity'

export interface SeasonImportMember {
  id: string; manager_id: string | null; manager_name: string; team_name: string
  season: string; is_active: boolean | null; division: string | null
}
export interface SeasonImportTeam {
  team_id: number; owner_id: string | null; manager_name: string; team_name: string
  division: string | null; source_member_id: string | null
  status: 'matched' | 'new' | 'unconfirmed'; reason: string | null
}
export interface SeasonImportWeek {
  week: number
  scores: Array<{ team_id: number; points: number }>
  matchups: Array<{ team1_id: number; team2_id: number }>
}
export interface ESPNSeasonSnapshot {
  league_name: string; season: string; teams: SeasonImportTeam[]
  format: { total_weeks: number | null; playoff_start_week: number | null; playoff_spots: number | null; divisions: string[] | null }
  weeks: SeasonImportWeek[]; warnings: string[]
}
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
const integer = (value: unknown, max = 25) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null

export function parseESPNSeasonSnapshot(data: unknown, season: string, history: SeasonImportMember[], platformConfig: unknown, leagueId: string): ESPNSeasonSnapshot {
  const raw = record(data)
  if (Number(raw.seasonId) !== Number(season)) throw new Error(`ESPN did not confirm the requested ${season} season. No data was imported.`)
  if (String(raw.id) !== leagueId) throw new Error('ESPN returned a different league. No data was imported.')
  const rawTeams = Array.isArray(raw.teams) ? raw.teams.map(record) : []
  if (rawTeams.length < 2 || rawTeams.length > 64 || rawTeams.length % 2 || rawTeams.some(team => !integer(team.id, 100000)) || new Set(rawTeams.map(team => team.id)).size !== rawTeams.length) throw new Error('ESPN did not return a complete, supported team roster for this season.')
  const settings = record(raw.settings)
  const scheduleSettings = record(settings.scheduleSettings)
  const status = record(raw.status)
  const periods = record(scheduleSettings.matchupPeriods)
  const periodEntries = Object.entries(periods).map(([period, weeks]) => ({ period: Number(period), weeks: Array.isArray(weeks) ? weeks.map(week => integer(week)).filter((week): week is number => week !== null) : [] }))
  const allWeeks = periodEntries.flatMap(period => period.weeks)
  const regularPeriods = integer(scheduleSettings.matchupPeriodCount)
  const playoffStart = regularPeriods ? periodEntries.find(period => period.period === regularPeriods + 1)?.weeks[0] || (periodEntries.length === 0 ? regularPeriods + 1 : null) : null
  const total = integer(status.finalScoringPeriod) || (allWeeks.length ? Math.max(...allWeeks) : null)
  const rawDivisions = Array.isArray(scheduleSettings.divisions) ? scheduleSettings.divisions.map(record) : null
  const validDivisions = rawDivisions && rawDivisions.every(division => clean(division.name)) ? rawDivisions : null
  const divisions = validDivisions ? validDivisions.map(division => clean(division.name)) : null
  const owners = new Map((Array.isArray(raw.members) ? raw.members : []).map(record).map(member => [member.id, clean(`${clean(member.firstName)} ${clean(member.lastName)}`)]))
  const config = record(platformConfig)
  const ownerMappings = record(record(config.espn_owner_mappings)[leagueId])
  const seasonMappings = record(record(config.team_mappings)[season])
  // Canonical identities can be found across all seasons. Prefer the target season's own membership.
  const canonical = new Map<string, SeasonImportMember>()
  for (const member of [...history].sort((a, b) => (a.season === season ? -1 : b.season === season ? 1 : b.season.localeCompare(a.season)))) {
    const key = member.manager_id || normalizedManagerName(member.manager_name)
    if (!canonical.has(key)) canonical.set(key, member)
  }
  const people = [...canonical.values()]
  const teams: SeasonImportTeam[] = rawTeams.map(team => {
    const teamOwners = Array.isArray(team.owners) ? team.owners.filter((owner): owner is string => typeof owner === 'string') : []
    const ownerId = clean(team.primaryOwner) || (teamOwners.length === 1 ? teamOwners[0] : null)
    const managerName = ownerId ? owners.get(ownerId) || '' : ''
    const teamName = clean(team.name) || clean(`${clean(team.location)} ${clean(team.nickname)}`)
    const savedManager = ownerId ? ownerMappings[ownerId] : undefined
    const ownerMatches = savedManager ? people.filter(member => member.manager_id === savedManager) : []
    const nameMatches = managerName ? people.filter(member => history.some(alias => (alias.manager_id ? alias.manager_id === member.manager_id : alias.id === member.id) && normalizedManagerName(alias.manager_name) === normalizedManagerName(managerName))) : []
    const candidates = ownerMatches.length ? ownerMatches : nameMatches
    const source = candidates.length === 1 ? candidates[0] : null
    const savedTeamMember = history.find(member => member.id === seasonMappings[String(team.id)])
    const ownershipConflict = savedTeamMember && (!source || (source.manager_id ? source.manager_id !== savedTeamMember.manager_id : source.id !== savedTeamMember.id))
    const reason = !ownerId ? 'ESPN has not confirmed a primary owner.' : !managerName ? 'ESPN did not provide the owner’s name.' : !teamName ? 'ESPN did not provide a team name.' : ownershipConflict ? 'This ESPN team was assigned to a different player. Confirm the identity before replacing results.' : candidates.length > 1 ? 'This owner matches more than one historical player.' : !source && history.length ? 'Confirm whether this is a new player or someone returning with a different name.' : null
    return { team_id: Number(team.id), owner_id: ownerId, manager_name: managerName, team_name: teamName, division: validDivisions ? clean(validDivisions.find(division => division.id === team.divisionId)?.name) || null : null, source_member_id: source?.id || null, status: reason ? 'unconfirmed' : source ? 'matched' : 'new', reason }
  })
  const assigned = teams.map(team => team.source_member_id).filter(Boolean)
  for (const team of teams) {
    if (team.source_member_id && assigned.filter(id => id === team.source_member_id).length > 1) { team.status = 'unconfirmed'; team.reason = 'More than one ESPN team matches this player. Assign each team to a distinct player.' }
  }
  for (const team of teams) {
    if (team.manager_name && teams.filter(value => normalizedManagerName(value.manager_name) === normalizedManagerName(team.manager_name)).length > 1) { team.status = 'unconfirmed'; team.reason = 'ESPN returned the same owner name for multiple teams. Confirm distinct player identities.' }
  }
  const warnings: string[] = []
  const weeks: SeasonImportWeek[] = []
  const schedule = Array.isArray(raw.schedule) ? raw.schedule.map(record) : []
  const current = Number(raw.scoringPeriodId || status.currentScoringPeriod)
  // Only ESPN-confirmed completed periods are eligible. Zero scores are legitimate.
  const completedThrough = status.isActive === false && total && current >= total ? total : Number.isInteger(current) && current >= 1 ? current - 1 : 0
  const teamIds = new Set(teams.map(team => team.team_id))
  for (let week = 1; week <= Math.min(total || 25, completedThrough); week++) {
    const period = periodEntries.find(period => period.weeks.includes(week))
    const matches = schedule.filter(matchup => Number(matchup.matchupPeriodId) === (period?.period || week))
    const scores = new Map<number, number>()
    const matchups: SeasonImportWeek['matchups'] = []
    let invalid = matches.length === 0
    for (const matchup of matches) {
      const sides = [record(matchup.home), record(matchup.away)]
      const ids: number[] = []
      for (const side of sides) {
        const id = Number(side.teamId)
        if (!teamIds.has(id)) continue // An absent away side represents a bye.
        const byWeek = record(side.pointsByScoringPeriod)
        const points = Object.prototype.hasOwnProperty.call(byWeek, String(week)) ? byWeek[String(week)] : !period || period.weeks.length === 1 ? side.totalPoints : undefined
        if (typeof points !== 'number' || !Number.isFinite(points) || points < -1000 || points > 1000 || scores.has(id)) { invalid = true; continue }
        scores.set(id, points); ids.push(id)
      }
      if (ids.length === 2) matchups.push({ team1_id: ids[0], team2_id: ids[1] })
    }
    if (invalid || scores.size !== teams.length) { warnings.push(`Week ${week} is incomplete or ambiguous in ESPN and will remain unchanged.`); continue }
    weeks.push({ week, scores: [...scores].map(([team_id, points]) => ({ team_id, points })), matchups })
  }
  if (!Array.isArray(raw.schedule)) warnings.push('ESPN did not confirm scores or matchups. Only the roster and confirmed settings are available.')
  return { league_name: clean(settings.name) || 'ESPN League', season, teams, format: { total_weeks: total, playoff_start_week: playoffStart, playoff_spots: integer(scheduleSettings.playoffTeamCount, 64), divisions }, weeks, warnings }
}
