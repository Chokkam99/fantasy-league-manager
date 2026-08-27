import {
  getScheduledImportTargets,
  type ScheduledImportTarget,
} from '@/lib/espn/week-selection'

export type ScheduledImportOutcome<T> =
  | { result: T; success: true; target: ScheduledImportTarget }
  | { error: unknown; success: false; target: ScheduledImportTarget }

/**
 * Runs targets sequentially. The correction pass must finish first so the
 * primary import is the final writer of visible league sync health.
 */
export async function runScheduledImportTargets<T>(
  latestCompletedWeek: number,
  importTarget: (target: ScheduledImportTarget) => Promise<T>,
): Promise<ScheduledImportOutcome<T>[]> {
  const outcomes: ScheduledImportOutcome<T>[] = []

  for (const target of getScheduledImportTargets(latestCompletedWeek)) {
    try {
      outcomes.push({
        result: await importTarget(target),
        success: true,
        target,
      })
    } catch (error) {
      outcomes.push({ error, success: false, target })
    }
  }

  return outcomes
}
