import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { reportCronHeartbeat } from '@/lib/cronHeartbeat'
import { resolveESPNConfig } from '@/lib/espn/config'
import { ESPNImportService } from '@/lib/espn/import'
import { ESPNImportPersistenceError } from '@/lib/espn/persistence'
import { runScheduledImportTargets } from '@/lib/espn/scheduled-import'
import { validateWeekImport } from '@/lib/espn/validation'
import {
  getFinalWeekCorrectionTargets,
  getScheduledImportTargets,
  type ScheduledImportTarget,
} from '@/lib/espn/week-selection'
import { validateActiveSeasonAccess } from '@/lib/seasonAccess'
import {
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'
import { selectAllRows } from '@/lib/supabasePaging'

interface CronLeague {
  auto_sync_enabled: boolean
  current_season: string
  espn_league_id?: string | null
  espn_s2?: string | null
  espn_swid?: string | null
  id: string
  name: string
  platform_config?: unknown
  platform_league_id?: string | null
  platform_type?: string | null
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
    )
  ) {
    if (!process.env.CRON_SECRET) {
      console.error('Weekly score cron is disabled because CRON_SECRET is missing.')
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const database = createServerSupabaseClient()
    const { data: leagueData, error: leaguesError } = await database
      .from('leagues')
      .select(`
        id,
        name,
        current_season,
        platform_type,
        platform_league_id,
        platform_config,
        auto_sync_enabled,
        espn_league_id,
        espn_s2,
        espn_swid
      `)
      .eq('auto_sync_enabled', true)

    if (leaguesError) throw leaguesError

    const configuredLeagues = ((leagueData || []) as CronLeague[]).filter(
      (league) => resolveESPNConfig(league) !== null,
    )

    if (configuredLeagues.length === 0) {
      await reportCronHeartbeat(process.env.CRON_HEARTBEAT_URL, 'success')
      return NextResponse.json({
        success: true,
        message: 'No ESPN leagues have automatic sync enabled.',
        imported: [],
      })
    }

    const leagueIds = configuredLeagues.map((league) => league.id)
    const currentSeasons = [...new Set(configuredLeagues.map((league) => league.current_season))]
    const [seasonsResult, membersResult, importRunsResult, scoredWeeksResult] = await Promise.all([
      database
        .from('league_seasons')
        .select('league_id, season, total_weeks')
        .in('league_id', leagueIds),
      database
        .from('league_members')
        .select('id, league_id, season')
        .in('league_id', leagueIds)
        .eq('is_active', true),
      database
        .from('import_runs')
        .select('league_id, season, status, trigger_mode, week_number')
        .in('league_id', leagueIds)
        .eq('status', 'succeeded'),
      selectAllRows((from, to) =>
        database
          .from('weekly_scores')
          .select('league_id, season, week_number', { count: 'exact' })
          .in('league_id', leagueIds)
          .in('season', currentSeasons)
          .order('league_id')
          .order('season')
          .order('week_number')
          .order('member_id')
          .range(from, to),
      ),
    ])

    if (seasonsResult.error) throw seasonsResult.error
    if (membersResult.error) throw membersResult.error
    if (importRunsResult.error) throw importRunsResult.error
    if (scoredWeeksResult.error) throw scoredWeeksResult.error

    const imported = []
    const skipped = []
    const warnings = []
    const errors = []

    for (const league of configuredLeagues) {
      try {
        const espnConfig = resolveESPNConfig(league)
        if (!espnConfig) continue

        const seasonAccess = validateActiveSeasonAccess(
          String(espnConfig.year),
          league.current_season,
        )
        if (!seasonAccess.allowed) {
          throw new Error(seasonAccess.message)
        }

        const seasonConfig = (seasonsResult.data || []).find(
          (season) =>
            season.league_id === league.id &&
            season.season === league.current_season,
        )
        const maximumWeek = seasonConfig?.total_weeks || 17
        const finalWeekRuns = (importRunsResult.data || []).filter(
          (run) =>
            run.league_id === league.id &&
            run.season === league.current_season &&
            run.week_number === maximumWeek,
        )
        const finalWeekAlreadyImported = finalWeekRuns.length > 0
        const finalWeekRechecked = finalWeekRuns.some(
          (run) => run.trigger_mode === 'scheduled_correction',
        )

        if (finalWeekAlreadyImported && finalWeekRechecked) {
          skipped.push({
            league_id: league.id,
            league_name: league.name,
            reason: `Season is complete through configured week ${maximumWeek}. Use on-demand sync for any later correction.`,
          })
          continue
        }

        const espnService = new ESPNImportService(
          league.id,
          league.current_season,
          espnConfig,
          database,
        )
        let targets: ScheduledImportTarget[]

        if (finalWeekAlreadyImported) {
          targets = getFinalWeekCorrectionTargets(maximumWeek)
        } else {
          const latestCompletedWeek = await espnService.getLatestCompletedWeek(
            maximumWeek,
          )
          const completedWeek = latestCompletedWeek
            ? Math.min(latestCompletedWeek, maximumWeek)
            : null

          if (!completedWeek) {
            skipped.push({
              league_id: league.id,
              league_name: league.name,
              reason: 'No completed week is ready to import.',
            })
            continue
          }

          const scoredWeeks = new Set(
            scoredWeeksResult.data
              .filter(
                (score) =>
                  score.league_id === league.id &&
                  score.season === league.current_season,
              )
              .map((score) => score.week_number),
          )
          const weeksWithoutScores = Array.from(
            { length: completedWeek },
            (_, index) => index + 1,
          ).filter((week) => !scoredWeeks.has(week))
          targets = getScheduledImportTargets(completedWeek, weeksWithoutScores)
        }

        const memberIds = (membersResult.data || [])
          .filter(
            (member) =>
              member.league_id === league.id &&
              member.season === league.current_season,
          )
          .map((member) => member.id)

        const outcomes = await runScheduledImportTargets(
          targets,
          async (target) => {
            const preview = await espnService.previewWeek(target.week)
            const validation = validateWeekImport(
              preview,
              memberIds,
              target.week,
            )

            if (!validation.can_import) {
              throw new Error(
                validation.errors[0] ||
                  validation.warnings[0] ||
                  `ESPN week ${target.week} failed import validation.`,
              )
            }

            return espnService.importValidatedWeekData(
              preview,
              target.trigger_mode,
            )
          },
        )

        for (const outcome of outcomes) {
          const { target } = outcome

          if (outcome.success) {
            imported.push({
              league_id: league.id,
              league_name: league.name,
              purpose: target.purpose,
              week: target.week,
              ...outcome.result,
            })
            continue
          }

          const { error } = outcome
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown import error'
          const importRunId =
            error instanceof ESPNImportPersistenceError ? error.runId : null

          if (
            error instanceof ESPNImportPersistenceError &&
            error.code === 'IMPORT_LOCKED'
          ) {
            skipped.push({
              league_id: league.id,
              league_name: league.name,
              purpose: target.purpose,
              reason: errorMessage,
              week: target.week,
            })
            continue
          }

          if (target.purpose === 'correction') {
            console.warn(
              `Correction pass failed for ${league.name} week ${target.week}:`,
              errorMessage,
            )
            warnings.push({
              error: errorMessage,
              import_run_id: importRunId,
              league_id: league.id,
              league_name: league.name,
              purpose: target.purpose,
              week: target.week,
            })
            continue
          }

          console.error(`Failed to import ${league.name}:`, errorMessage)
          errors.push({
            error: errorMessage,
            import_run_id: importRunId,
            league_id: league.id,
            league_name: league.name,
            purpose: target.purpose,
            week: target.week,
          })

          if (!(error instanceof ESPNImportPersistenceError)) {
            await database
              .from('leagues')
              .update({
                sync_status: 'error',
                last_sync_error: errorMessage,
              })
              .eq('id', league.id)
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown import error'

        if (
          error instanceof ESPNImportPersistenceError &&
          error.code === 'IMPORT_LOCKED'
        ) {
          skipped.push({
            league_id: league.id,
            league_name: league.name,
            reason: errorMessage,
          })
          continue
        }

        console.error(`Failed to import ${league.name}:`, errorMessage)
        errors.push({
          league_id: league.id,
          league_name: league.name,
          error: errorMessage,
          import_run_id:
            error instanceof ESPNImportPersistenceError ? error.runId : null,
        })

        if (!(error instanceof ESPNImportPersistenceError)) {
          await database
            .from('leagues')
            .update({
              sync_status: 'error',
              last_sync_error: errorMessage,
            })
            .eq('id', league.id)
        }
      }
    }

    // A failed league must fail the run so Vercel's cron log and the heartbeat monitor both show it.
    await reportCronHeartbeat(
      process.env.CRON_HEARTBEAT_URL,
      errors.length === 0 ? 'success' : 'fail',
    )
    return NextResponse.json({
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      imported,
      skipped: skipped.length > 0 ? skipped : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: errors.length === 0 ? 200 : 500 })
  } catch (error) {
    await reportCronHeartbeat(process.env.CRON_HEARTBEAT_URL, 'fail')
    if (isServerSupabaseConfigurationError(error)) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }

    console.error('Weekly score cron failed:', error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
