export interface WeekCompletion {
  is_complete: boolean
  week: number
}

export interface ScheduledImportTarget {
  purpose: 'correction' | 'primary'
  trigger_mode: 'scheduled' | 'scheduled_correction'
  week: number
}

export function getCompletedWeekCandidates(
  currentWeek: number,
  maximumWeek = currentWeek,
) {
  const newestPossibleWeek = Math.max(
    1,
    Math.min(Math.floor(currentWeek), Math.floor(maximumWeek)),
  )

  return [newestPossibleWeek, newestPossibleWeek - 1].filter(
    (week, index, candidates) =>
      week >= 1 && candidates.indexOf(week) === index,
  )
}

export async function findLatestCompletedWeek(
  currentWeek: number,
  loadWeek: (week: number) => Promise<WeekCompletion>,
  maximumWeek = currentWeek,
) {
  const candidates = getCompletedWeekCandidates(currentWeek, maximumWeek)
  let successfulChecks = 0
  let lastError: unknown

  for (const week of candidates) {
    try {
      const weekData = await loadWeek(week)
      successfulChecks += 1

      if (weekData.is_complete) return week
    } catch (error) {
      lastError = error
    }
  }

  if (successfulChecks === 0 && lastError) throw lastError

  return null
}

/**
 * Recheck one older completed week for late ESPN stat corrections, then import
 * the primary completed week last so league-level sync health reflects it.
 */
export function getScheduledImportTargets(
  latestCompletedWeek: number,
): ScheduledImportTarget[] {
  if (!Number.isInteger(latestCompletedWeek) || latestCompletedWeek < 1) {
    return []
  }

  const targets: ScheduledImportTarget[] = []

  if (latestCompletedWeek > 1) {
    targets.push({
      purpose: 'correction',
      trigger_mode: 'scheduled_correction',
      week: latestCompletedWeek - 1,
    })
  }

  targets.push({
    purpose: 'primary',
    trigger_mode: 'scheduled',
    week: latestCompletedWeek,
  })

  return targets
}
