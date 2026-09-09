import { getConfiguredDivisions } from '@/lib/rules'
import { validateSeasonRolloverRequest } from '@/lib/seasonRollover'
import { normalizedManagerName } from '@/lib/managerIdentity'
import { record, type ESPNSeasonSnapshot, type SeasonImportMember, type SeasonImportTeam } from './seasonSnapshot'

export interface SeasonImportConfiguration {
  total_weeks: number; playoff_start_week: number; playoff_spots: number; divisions: string[]
  fee_amount: number; draft_food_cost: number; weekly_prize_amount: number; prize_structure: Record<string, number>
}
export interface SeasonImportPreview {
  revision: string; season: string; current_season: string; exists: boolean
  espn: ESPNSeasonSnapshot; history: SeasonImportMember[]; configuration: SeasonImportConfiguration
  missing_fields: string[]; local_only: SeasonImportMember[]; existing_weeks: number[]
}
export interface SeasonImportResolution {
  team_id: number; source_member_id: string | null; manager_name: string; team_name: string; confirmed: boolean
}

export function configurationForImport(snapshot: ESPNSeasonSnapshot, source: unknown): SeasonImportConfiguration {
  const prior = record(source)
  return {
    total_weeks: snapshot.format.total_weeks ?? Number(prior.total_weeks || 17),
    playoff_start_week: snapshot.format.playoff_start_week ?? Number(prior.playoff_start_week || 15),
    playoff_spots: snapshot.format.playoff_spots ?? Number(prior.playoff_spots || Math.min(6, snapshot.teams.length)),
    divisions: snapshot.format.divisions ?? getConfiguredDivisions(prior.divisions),
    fee_amount: Number(prior.fee_amount || 0), draft_food_cost: Number(prior.draft_food_cost || 0), weekly_prize_amount: Number(prior.weekly_prize_amount || 0), prize_structure: record(prior.prize_structure) as Record<string, number>,
  }
}

export function resolveSeasonImport(preview: SeasonImportPreview, input: unknown) {
  const body = record(input)
  const resolutions = Array.isArray(body.resolutions) ? body.resolutions.map(record) : []
  const errors: string[] = []
  const submitted = new Map(resolutions.map(value => [value.team_id, value]))
  if (resolutions.length !== submitted.size || resolutions.some(value => !preview.espn.teams.some(team => team.team_id === value.team_id))) errors.push('Team resolutions are duplicated or no longer match ESPN.')
  const teams: SeasonImportTeam[] = preview.espn.teams.map(team => {
    const resolution = submitted.get(team.team_id)
    if (team.status !== 'unconfirmed') return team // Confirmed ESPN fields are server-owned.
    if (!resolution || resolution.confirmed !== true || (resolution.source_member_id !== null && typeof resolution.source_member_id !== 'string')) { errors.push(`Confirm the player for ESPN team ${team.team_id}.`); return team }
    const source = preview.history.find(member => member.id === resolution.source_member_id)
    if (resolution.source_member_id && !source) errors.push('A selected player is outside this league history.')
    return { ...team, source_member_id: source?.id || null,
      manager_name: typeof resolution.manager_name === 'string' ? resolution.manager_name.trim() : team.manager_name,
      team_name: team.team_name || (typeof resolution.team_name === 'string' ? resolution.team_name.trim() : ''),
    }
  })
  if (teams.some(team => !team.source_member_id && preview.history.some(member => normalizedManagerName(member.manager_name) === normalizedManagerName(team.manager_name)))) errors.push('This manager name already exists in league history. Choose that player or clarify the new player’s name.')
  const identityKeys = teams.map(team => { const source = preview.history.find(member => member.id === team.source_member_id); return source?.manager_id || source?.id || `new:${normalizedManagerName(team.manager_name)}` })
  if (new Set(identityKeys).size !== teams.length) errors.push('Each ESPN team must have a different player identity.')
  const configuration = { ...preview.configuration }
  const missing = record(body.missing_values)
  for (const field of preview.missing_fields) {
    if (missing[field] === undefined) errors.push(`Confirm ${field.replaceAll('_', ' ')}; ESPN did not provide it.`)
    else if (field === 'divisions') configuration.divisions = Array.isArray(missing.divisions) ? missing.divisions as string[] : []
    else if (['total_weeks', 'playoff_start_week', 'playoff_spots'].includes(field)) configuration[field as 'total_weeks' | 'playoff_start_week' | 'playoff_spots'] = Number(missing[field])
  }
  // Reuse established numeric, names, roster, and payout validation without changing the selected season.
  const validation = validateSeasonRolloverRequest({ confirmed: true, source_season: '2025', target_season: '2026', configuration, members: teams.map(team => ({ source_member_id: team.source_member_id, manager_name: team.manager_name, team_name: team.team_name, division: configuration.divisions.includes(team.division || '') ? team.division : null })) }, '2025')
  if (!validation.is_valid) errors.push(...validation.errors)
  const represented = new Set(teams.map(team => { const source = preview.history.find(member => member.id === team.source_member_id); return source?.manager_id || source?.id }))
  const departing = preview.history.filter(member => member.season === preview.season && member.is_active !== false && !represented.has(member.manager_id || member.id))
  if (departing.length && body.confirm_departures !== true) errors.push('Confirm the players absent from ESPN before changing the roster.')
  if (preview.existing_weeks.some(week => week > configuration.total_weeks)) errors.push('The imported season length would exclude existing scores. Resolve the season format first.')
  return { configuration, teams, departing, errors: [...new Set(errors)] }
}
