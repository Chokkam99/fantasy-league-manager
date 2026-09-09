import { getConfiguredDivisions } from './rules'
import { validateSeasonRolloverRequest, type SeasonMemberSetup } from './seasonRollover'

export interface RolloverMember {
  division?: string | null
  id: string
  last_season: string
  manager_id?: string | null
  manager_name: string
  selected_by_default: boolean
  team_name: string
}
export interface RolloverPreview {
  can_start: boolean
  espn_connection?: { auto_sync_enabled: boolean; is_configured: boolean; league_id: string }
  members: RolloverMember[]
  source_configuration: {
    divisions?: unknown; draft_food_cost?: number | null; fee_amount?: number | null
    playoff_spots?: number | null; playoff_start_week?: number | null
    prize_structure?: Record<string, unknown> | null; total_weeks?: number | null; weekly_prize_amount?: number | null
  }
  source_season: string
  target_exists: boolean
  target_season: string
}
export interface MemberDraft { division: string; managerName: string; selected: boolean; teamName: string }
export interface NewMemberDraft { division: string; key: string; managerName: string; teamName: string }
export interface PrizeDraft { amount: string; id: string; label: string; originalKey?: string }
export interface SettingsDraft { draftCost: string; entryFee: string; groups: string; playoffSpots: string; playoffStartWeek: string; totalWeeks: string; weeklyPrize: string }
export interface SeasonSetupDraft {
  members: Record<string, MemberDraft>
  newMembers: NewMemberDraft[]
  prizes: PrizeDraft[]
  settings: SettingsDraft
  step: number
}
const prizeLabels: Record<string, string> = { first: '1st place', second: '2nd place', third: '3rd place', fourth: '4th place', highest_points: 'Highest season points', highest_weekly: 'Highest weekly score', lowest_weekly: 'Lowest weekly score' }
export const prizeLabel = (key: string) => prizeLabels[key] || key.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
export const normalizedName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
export const numberValue = (value: string) => value.trim() ? Number(value) : Number.NaN
export function groupNames(draft: SeasonSetupDraft) { return draft.settings.groups.split(',').map(group => group.trim().replace(/\s+/g, ' ')).filter(Boolean) }

export function createSeasonSetupDraft(preview: RolloverPreview): SeasonSetupDraft {
  const config = preview.source_configuration
  return {
    members: Object.fromEntries(preview.members.map(member => [member.id, { division: member.division || '', managerName: member.manager_name, teamName: member.team_name, selected: member.selected_by_default }])),
    newMembers: [],
    prizes: Object.entries(config.prize_structure || {}).map(([key, amount]) => ({ id: `saved-${key}`, originalKey: key, label: prizeLabel(key), amount: String(amount) })),
    settings: { draftCost: String(config.draft_food_cost ?? 0), entryFee: String(config.fee_amount ?? 0), groups: getConfiguredDivisions(config.divisions).join(', '), playoffSpots: String(config.playoff_spots ?? 6), playoffStartWeek: String(config.playoff_start_week ?? 15), totalWeeks: String(config.total_weeks ?? 17), weeklyPrize: String(config.weekly_prize_amount ?? 0) },
    step: 0,
  }
}
export function draftMembers(preview: RolloverPreview, draft: SeasonSetupDraft): SeasonMemberSetup[] {
  const groups = groupNames(draft)
  return [
    ...preview.members.filter(member => draft.members[member.id]?.selected).map(member => ({ ...draft.members[member.id], source_member_id: member.id })),
    ...draft.newMembers.map(member => ({ ...member, source_member_id: null })),
  ].map(member => ({ source_member_id: member.source_member_id, manager_name: member.managerName.trim(), team_name: member.teamName.trim(), division: groups.includes(member.division) ? member.division : null }))
}
export function draftRequest(preview: RolloverPreview, draft: SeasonSetupDraft) {
  const settings = draft.settings
  const prizeEntries = draft.prizes.map(prize => [prize.originalKey && prize.label.trim() === prizeLabel(prize.originalKey) ? prize.originalKey : normalizedName(prize.label).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64), numberValue(prize.amount)] as const)
  return {
    confirmed: true as const, source_season: preview.source_season, target_season: preview.target_season,
    members: draftMembers(preview, draft),
    configuration: { divisions: groupNames(draft), draft_food_cost: numberValue(settings.draftCost), fee_amount: numberValue(settings.entryFee), playoff_spots: numberValue(settings.playoffSpots), playoff_start_week: numberValue(settings.playoffStartWeek), prize_structure: Object.fromEntries(prizeEntries), total_weeks: numberValue(settings.totalWeeks), weekly_prize_amount: numberValue(settings.weeklyPrize) },
  }
}
export function rosterIssue(preview: RolloverPreview, draft: SeasonSetupDraft) {
  const members = draftMembers(preview, draft)
  if (members.length < 2 || members.length > 64) return 'Choose between 2 and 64 players.'
  if (members.length % 2) return 'Add or remove one player. Head-to-head seasons require an even number of teams.'
  if (members.some(member => !member.manager_name || !member.team_name)) return 'Every player needs a manager name and team name.'
  const names = members.map(member => normalizedName(member.manager_name))
  if (new Set(names).size !== names.length) return 'Two players have the same manager name. Edit their names so you can tell them apart.'
  return ''
}
export function draftIssues(preview: RolloverPreview, draft: SeasonSetupDraft) {
  const result = validateSeasonRolloverRequest(draftRequest(preview, draft), preview.source_season)
  const errors = result.is_valid ? [] : result.errors
  const keys = draft.prizes.map(prize => prize.originalKey && prize.label.trim() === prizeLabel(prize.originalKey) ? prize.originalKey : normalizedName(prize.label).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64))
  if (new Set(keys).size !== keys.length) errors.push('Each payout needs a unique name.')
  const rosterError = rosterIssue(preview, draft)
  return [...new Set([...errors, ...(rosterError ? [rosterError] : [])])]
}

/** Restore only well-shaped drafts and merge known historical identities from the current preview. */
export function restoreSeasonSetupDraft(raw: string | null, preview: RolloverPreview): SeasonSetupDraft | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (value.version !== 1 || value.source !== preview.source_season || value.target !== preview.target_season) return null
    const draft = value.draft as SeasonSetupDraft
    const defaults = createSeasonSetupDraft(preview)
    if (!draft || !draft.members || !draft.settings || !Array.isArray(draft.newMembers) || !Array.isArray(draft.prizes) || !Number.isInteger(draft.step) || draft.step < 0 || draft.step > 3) return null
    if (Object.keys(defaults.settings).some(key => typeof draft.settings[key as keyof SettingsDraft] !== 'string')) return null
    const validMember = (member: MemberDraft | NewMemberDraft) => member && ['managerName', 'teamName', 'division'].every(key => typeof member[key as keyof typeof member] === 'string')
    if (draft.newMembers.length > 64 || draft.newMembers.some(member => !validMember(member) || typeof member.key !== 'string')) return null
    if (draft.prizes.length > 32 || draft.prizes.some(prize => !prize || typeof prize.id !== 'string' || typeof prize.label !== 'string' || typeof prize.amount !== 'string' || (prize.originalKey !== undefined && typeof prize.originalKey !== 'string'))) return null
    if (new Set(draft.newMembers.map(member => member.key)).size !== draft.newMembers.length || new Set(draft.prizes.map(prize => prize.id)).size !== draft.prizes.length) return null
    for (const member of preview.members) {
      const saved = draft.members[member.id]
      if (saved && validMember(saved) && typeof saved.selected === 'boolean') defaults.members[member.id] = saved
    }
    return { ...draft, members: defaults.members }
  } catch { return null }
}
