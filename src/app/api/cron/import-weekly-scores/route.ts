import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { resolveESPNConfig } from '@/lib/espn/config'
import { ESPNImportService } from '@/lib/espn/import'
import { ESPNImportPersistenceError } from '@/lib/espn/persistence'
import { runScheduledImportTargets } from '@/lib/espn/scheduled-import'
import { validateWeekImport } from '@/lib/espn/validation'
import { validateActiveSeasonAccess } from '@/lib/seasonAccess'
import {
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

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
      return NextResponse.json({
        success: true,
        message: 'No ESPN leagues have automatic sync enabled.',
        imported: [],
      })
    }

    const leagueIds = configuredLeagues.map((league) => league.id)
    const [seasonsResult, membersResult] = await Promise.all([
      database
        .from('league_seasons')
        .select('league_id, season, total_weeks')
        .in('league_id', leagueIds),
      database
        .from('league_members')
        .select('id, league_id, season')
        .in('league_id', leagueIds)
        .eq('is_active', true),
    ])

    if (seasonsResult.error) throw seasonsResult.error
    if (membersResult.error) throw membersResult.error

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
        const espnService = new ESPNImportService(
          league.id,
          league.current_season,
          espnConfig,
          database,
        )
        const completedWeek = await espnService.getLatestCompletedWeek(
          maximumWeek,
        )

        if (!completedWeek) {
          skipped.push({
            league_id: league.id,
            league_name: league.name,
            reason: 'No completed week is ready to import.',
          })
          continue
        }

        const memberIds = (membersResult.data || [])
          .filter(
            (member) =>
              member.league_id === league.id &&
              member.season === league.current_season,
          )
          .map((member) => member.id)

        const outcomes = await runScheduledImportTargets(
          completedWeek,
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

    return NextResponse.json({
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      imported,
      skipped: skipped.length > 0 ? skipped : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
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
