import {
  type LeagueHistorySnapshot,
} from '@/lib/leagueHistory'
import { loadLeagueView } from '@/lib/leagueReadClient'

export function loadLeagueHistory(leagueId: string, season: string) {
  return loadLeagueView<LeagueHistorySnapshot>(leagueId, 'history', { season })
}
