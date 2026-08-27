'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import type { ESPNTeamMappingSnapshot } from '@/lib/espn/types'

interface ESPNTeamMappingPanelProps {
  isSaving: boolean
  onCancel: () => void
  onSave: (mappings: Record<string, string>) => Promise<void>
  season: string
  snapshot: ESPNTeamMappingSnapshot
}

export function ESPNTeamMappingPanel({
  isSaving,
  onCancel,
  onSave,
  season,
  snapshot,
}: ESPNTeamMappingPanelProps) {
  const [selections, setSelections] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        snapshot.assignments.map((assignment) => [
          String(assignment.espn_team_id),
          assignment.member_id,
        ]),
      ),
  )

  const selectedMemberIds = useMemo(
    () => new Set(Object.values(selections).filter(Boolean)),
    [selections],
  )
  const assignedCount = snapshot.teams.filter(
    (team) => selections[String(team.espn_team_id)],
  ).length
  const hasDuplicates =
    selectedMemberIds.size !== Object.values(selections).filter(Boolean).length
  const canSave =
    assignedCount === snapshot.teams.length &&
    snapshot.teams.length > 0 &&
    !hasDuplicates

  return (
    <div className="border-t border-app-border bg-app-surface-subtle p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-app-text">Match ESPN teams</h3>
            <Badge variant={canSave ? 'success' : 'warning'}>
              {assignedCount} of {snapshot.teams.length} assigned
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-app-text-muted">
            Pair each ESPN team with the person playing in this league season.
            These assignments apply only to {season}, so team names and players can
            change next year.
          </p>
        </div>
      </div>

      {snapshot.duplicate_matches.length > 0 && (
        <Notice className="mt-4 text-app-warning" role="alert" tone="warning">
          <p className="font-semibold">Some assignments need attention</p>
          <ul className="mt-1 space-y-1">
            {snapshot.duplicate_matches.map((message) => (
              <li key={message}>• {message}</li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="mt-4 grid gap-3">
        {snapshot.teams.map((team) => {
          const teamId = String(team.espn_team_id)
          const currentSelection = selections[teamId] || ''

          return (
            <div
              className="grid gap-3 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,1fr)] sm:items-center sm:p-4"
              key={team.espn_team_id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-app-text">
                  {team.espn_team_name}
                </p>
                <p className="mt-1 truncate text-xs text-app-text-muted">
                  ESPN owner: {team.espn_owner_name}
                </p>
              </div>

              <label className="block text-xs font-semibold uppercase tracking-wide text-app-text-muted">
                League player
                <select
                  aria-label={`League player for ${team.espn_team_name}`}
                  className="mt-1 min-h-11 w-full rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-base font-normal normal-case tracking-normal text-app-text outline-none focus:border-app-brand focus:ring-2 focus:ring-app-brand/20 sm:text-sm"
                  disabled={isSaving}
                  onChange={(event) =>
                    setSelections((current) => ({
                      ...current,
                      [teamId]: event.target.value,
                    }))
                  }
                  value={currentSelection}
                >
                  <option value="">Choose a player…</option>
                  {snapshot.members.map((member) => (
                    <option
                      disabled={
                        member.member_id !== currentSelection &&
                        selectedMemberIds.has(member.member_id)
                      }
                      key={member.member_id}
                      value={member.member_id}
                    >
                      {member.manager_name} · {member.team_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button disabled={isSaving} onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={!canSave || isSaving}
          onClick={() => onSave(selections)}
        >
          {isSaving ? 'Saving assignments…' : `Save ${season} assignments`}
        </Button>
      </div>
    </div>
  )
}
