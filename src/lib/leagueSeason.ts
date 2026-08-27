export function hasConfiguredLeagueSeason<
  T extends { current_season: string | null },
>(league: T): league is T & { current_season: string } {
  return Boolean(league.current_season && /^\d{4}$/.test(league.current_season))
}
