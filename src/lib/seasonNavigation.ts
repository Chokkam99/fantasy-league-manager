export type SeasonPhase = 'preseason' | 'in-season' | 'wrap-up'
export interface SeasonNavigationSnapshot {
  phase: SeasonPhase
  season: string
  duesRemaining: number
  playerCount: number
}
export type LeagueNavigationKey = 'overview' | 'standings' | 'scores' | 'prizes' | 'players' | 'rules'

export function seasonPhase(latestCompletedWeek: number, totalWeeks: number): SeasonPhase {
  if (latestCompletedWeek === 0) return 'preseason'
  return totalWeeks > 0 && latestCompletedWeek >= totalWeeks ? 'wrap-up' : 'in-season'
}

export function navigationOrder(phase: SeasonPhase | undefined, commissioner: boolean): LeagueNavigationKey[] {
  if (commissioner && phase === 'preseason') return ['overview', 'players', 'standings', 'scores', 'prizes', 'rules']
  if (commissioner && phase === 'wrap-up') return ['overview', 'prizes', 'standings', 'scores', 'players', 'rules']
  return ['overview', 'standings', 'scores', 'prizes', 'players', 'rules']
}

export function mobileNavigation(order: LeagueNavigationKey[], commissioner: boolean, phase?: SeasonPhase) {
  return commissioner && phase === 'preseason'
    ? order.filter(key => ['overview', 'players', 'standings', 'scores'].includes(key))
    : order.filter(key => ['overview', 'standings', 'scores', 'prizes'].includes(key))
}
