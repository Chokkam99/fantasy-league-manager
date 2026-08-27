import { Badge } from '@/components/ui/Badge'
import type { PlatformImportPreview as Preview } from '@/hooks/usePlatformImport'

export function PlatformImportPreview({ preview }: { preview: Preview }) {
  return (
    <div className="border-t border-app-border p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-app-text">Week {preview.data.week} preview</h3>
        <Badge variant={preview.validation.can_import ? 'success' : 'warning'}>
          {preview.validation.can_import ? 'Ready to import' : 'Review only'}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-app-text-muted">
        {preview.validation.summary.score_count} scores · {preview.validation.summary.matchup_count} matchups
      </p>

      {(preview.validation.errors.length > 0 || preview.validation.warnings.length > 0) && (
        <ul className="mt-3 space-y-1 text-sm text-app-warning">
          {[...preview.validation.errors, ...preview.validation.warnings].map(
            (message) => <li key={message}>• {message}</li>,
          )}
        </ul>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[...preview.data.scores]
          .sort((left, right) => right.points - left.points)
          .map((score, index) => (
            <div
              className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--app-radius-sm)] border border-app-border p-3"
              key={score.member_id}
            >
              <div className="min-w-0">
                <p className="text-xs text-app-text-muted">#{index + 1}</p>
                <p className="truncate text-sm font-semibold text-app-text">{score.team_name}</p>
              </div>
              <p className="shrink-0 font-mono text-lg font-semibold text-app-brand-strong">{score.points}</p>
            </div>
          ))}
      </div>
    </div>
  )
}
