export interface WeekCompletion {
  is_complete: boolean
  week: number
}

export interface ScheduledImportTarget {
  purpose: 'backfill' | 'correction' | 'primary'
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

/** Missed weeks filled per run, oldest first, so one run stays well inside the function timeout. */
export const MAX_BACKFILL_WEEKS_PER_RUN = 3

/**
 * Fill completed weeks that have no scores (for example after a missed
 * Wednesday), recheck one older completed week for late ESPN stat corrections,
 * then import the primary completed week last so league-level sync health
 * reflects it.
 */
export function getScheduledImportTargets(
  latestCompletedWeek: number,
  weeksWithoutScores: number[] = [],
): ScheduledImportTarget[] {
  if (!Number.isInteger(latestCompletedWeek) || latestCompletedWeek < 1) {
    return []
  }

  const targets: ScheduledImportTarget[] = [...new Set(weeksWithoutScores)]
    .filter((week) => Number.isInteger(week) && week >= 1 && week < latestCompletedWeek - 1)
    .sort((left, right) => left - right)
    .slice(0, MAX_BACKFILL_WEEKS_PER_RUN)
    .map((week) => ({ purpose: 'backfill', trigger_mode: 'scheduled', week }))

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

/**
 * After the configured final week is imported, recheck it once on the next
 * scheduled run so late ESPN stat corrections still land.
 */
export function getFinalWeekCorrectionTargets(
  finalWeek: number,
): ScheduledImportTarget[] {
  if (!Number.isInteger(finalWeek) || finalWeek < 1) return []
  return [{ purpose: 'correction', trigger_mode: 'scheduled_correction', week: finalWeek }]
}
