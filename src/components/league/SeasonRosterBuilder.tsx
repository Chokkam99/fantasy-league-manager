'use client'
import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, Select, TextInput } from '@/components/ui/FormField'
import { Notice } from '@/components/ui/Notice'
import { groupNames, normalizedName, type RolloverPreview, type SeasonSetupDraft } from '@/lib/seasonSetupDraft'

type Editor = { key: string; kind: 'existing' | 'new'; managerName: string; teamName: string; division: string }
export function SeasonRosterBuilder({ preview, draft, onChange }: {
  preview: RolloverPreview; draft: SeasonSetupDraft; onChange: (draft: SeasonSetupDraft) => void
}) {
  const [search, setSearch] = useState('')
  const [cohort, setCohort] = useState('all')
  const [editor, setEditor] = useState<Editor | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const sequence = useRef(0)
  const groups = groupNames(draft)
  const selected = preview.members.filter(member => draft.members[member.id]?.selected)
  const available = preview.members.filter(member => !draft.members[member.id]?.selected)
  const filtered = available.filter(member =>
    (cohort === 'all' || (cohort === 'last') === (member.last_season === preview.source_season)) &&
    `${member.manager_name} ${member.team_name} ${member.last_season}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )
  const returning = selected.filter(member => member.selected_by_default).length
  const comeback = selected.length - returning
  const sittingOut = preview.members.filter(member => member.selected_by_default && !draft.members[member.id]?.selected)
  const duplicate = editor?.kind === 'new'
    ? preview.members.find(member => normalizedName(member.manager_name) === normalizedName(editor.managerName) || normalizedName(draft.members[member.id]?.managerName || '') === normalizedName(editor.managerName))
    : undefined
  const nameTaken = editor && [...selected.map(member => ({ key: member.id, name: draft.members[member.id].managerName })), ...draft.newMembers.map(member => ({ key: member.key, name: member.managerName }))]
    .some(member => member.key !== editor.key && normalizedName(member.name) === normalizedName(editor.managerName))
  const addReturning = (id: string) => onChange({ ...draft, members: { ...draft.members, [id]: { ...draft.members[id], selected: true } } })
  const editReturning = (id: string) => setEditor({ ...draft.members[id], key: id, kind: 'existing' })
  const saveEditor = () => {
    if (!editor || !editor.managerName.trim() || !editor.teamName.trim() || nameTaken || duplicate) return
    const values = { managerName: editor.managerName.trim(), teamName: editor.teamName.trim(), division: editor.division }
    if (editor.kind === 'existing') onChange({ ...draft, members: { ...draft.members, [editor.key]: { ...draft.members[editor.key], ...values } } })
    else {
      const exists = draft.newMembers.some(member => member.key === editor.key)
      onChange({ ...draft, newMembers: exists ? draft.newMembers.map(member => member.key === editor.key ? { ...member, ...values } : member) : [...draft.newMembers, { ...values, key: editor.key }] })
    }
    setEditor(null)
  }
  const rows = [
    ...selected.map(member => ({ key: member.id, ...draft.members[member.id], kind: 'existing' as const, label: member.selected_by_default ? 'Returning' : `Back from ${member.last_season}` })),
    ...draft.newMembers.map(member => ({ ...member, kind: 'new' as const, label: 'New player' })),
  ]

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-app-text">Who’s playing in {preview.target_season}?</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-app-text-muted">We kept last season’s roster to get you started. Remove anyone sitting out, bring back a familiar face, or add someone new.</p>
      </div>
      <Button onClick={() => setEditor({ key: `new-${Date.now()}-${++sequence.current}`, kind: 'new', managerName: '', teamName: '', division: '' })}><span aria-hidden="true">+</span> Add new player</Button>
    </div>
    <div className="grid grid-cols-3 gap-2 rounded-xl bg-app-surface-subtle p-3 text-sm">
      {[['Returning', returning], ['Coming back', comeback], ['New players', draft.newMembers.length]].map(([label, count]) => <div key={label} className="text-center"><p className="text-xl font-bold text-app-text">{count}</p><p className="mt-1 text-xs text-app-text-muted">{label}</p></div>)}
    </div>
    <section aria-label={`${preview.target_season} roster`}>
      <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-app-text">Your roster</h3><Badge variant="info">{rows.length} players</Badge></div>
      <div className="overflow-hidden rounded-xl border border-app-border">
        {rows.length === 0 && <p className="p-6 text-sm text-app-text-muted">Your roster is empty. Choose a returning player below or add a new player.</p>}
        {rows.map(player => <article key={player.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-app-border p-3 last:border-b-0 sm:p-4">
          <div className="min-w-0 flex-1 basis-40"><p className="break-words font-semibold text-app-text">{player.managerName}</p><p className="mt-0.5 break-words text-sm text-app-text-muted">{player.teamName}{player.division && groups.includes(player.division) ? ` · ${player.division}` : ''}</p><p className="mt-1 text-xs font-medium text-app-brand">{player.label}</p></div>
          <div className="flex shrink-0 gap-1">
            <Button aria-label={`Edit ${player.managerName}`} onClick={() => setEditor({ ...player })} size="sm" variant="ghost">Edit</Button>
            <Button aria-label={`Remove ${player.managerName} from roster`} onClick={() => player.kind === 'existing'
              ? onChange({ ...draft, members: { ...draft.members, [player.key]: { ...draft.members[player.key], selected: false } } })
              : onChange({ ...draft, newMembers: draft.newMembers.filter(member => member.key !== player.key) })} size="sm" variant="dangerGhost">Remove</Button>
          </div>
        </article>)}
      </div>
    </section>
    <section aria-label="Returning player directory" className="rounded-xl border border-app-border bg-app-surface-subtle/60 p-4 sm:p-5">
      <h3 className="font-semibold text-app-text">Bring someone back</h3>
      <p className="mt-1 text-sm leading-6 text-app-text-muted">Choose from league history to keep their seasons and results together.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <TextInput aria-label="Search returning players" className="min-w-0 flex-1" onChange={event => setSearch(event.target.value)} placeholder="Search name, team, or year" type="search" value={search} />
        <Select aria-label="Returning player group" className="sm:w-48" onChange={event => setCohort(event.target.value)} value={cohort}><option value="all">All available players</option><option value="last">From last season</option><option value="earlier">From earlier seasons</option></Select>
      </div>
      <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-app-border bg-app-surface">
        {filtered.length === 0 ? <p className="p-4 text-sm text-app-text-muted">{available.length ? 'No players match this search.' : 'Everyone from league history is already on your roster.'}</p> : filtered.map(member => <div className="flex items-center justify-between gap-3 border-b border-app-border p-3 last:border-b-0" key={member.id}>
          <div className="min-w-0"><p className="break-words text-sm font-semibold text-app-text">{member.manager_name}</p><p className="mt-0.5 break-words text-xs text-app-text-muted">{member.team_name} · Last played {member.last_season}</p></div>
          <Button aria-label={`Add ${member.manager_name} to roster`} onClick={() => addReturning(member.id)} size="sm" variant="secondary">Add</Button>
        </div>)}
      </div>
      {sittingOut.length > 0 && <p className="mt-3 text-xs leading-5 text-app-text-muted">Sitting out from last season: {sittingOut.map(member => member.manager_name).join(', ')}. Their history is kept.</p>}
    </section>
    <Dialog open={Boolean(editor)} onClose={() => setEditor(null)} initialFocusRef={nameRef} title={editor?.kind === 'existing' || draft.newMembers.some(member => member.key === editor?.key) ? 'Edit player' : 'Add a new player'} description={`Names and teams here apply to ${preview.target_season}. Earlier seasons stay unchanged.`}>
      {editor && <form className="space-y-4" onSubmit={event => { event.preventDefault(); saveEditor() }}>
        <FormField htmlFor="roster-manager" label="Manager name"><TextInput autoComplete="name" id="roster-manager" maxLength={80} ref={nameRef} required onChange={event => setEditor({ ...editor, managerName: event.target.value })} value={editor.managerName} /></FormField>
        <FormField htmlFor="roster-team" label="Team name"><TextInput id="roster-team" maxLength={80} required onChange={event => setEditor({ ...editor, teamName: event.target.value })} value={editor.teamName} /></FormField>
        {groups.length > 0 && <FormField htmlFor="roster-group" label="Division" optional><Select id="roster-group" onChange={event => setEditor({ ...editor, division: event.target.value })} value={groups.includes(editor.division) ? editor.division : ''}><option value="">No division</option>{groups.map(group => <option key={group}>{group}</option>)}</Select></FormField>}
        {duplicate ? <Notice tone="info"><p>{duplicate.manager_name} is already in league history ({duplicate.last_season}).</p><Button className="mt-2" onClick={() => { if (draft.members[duplicate.id].selected) editReturning(duplicate.id); else { addReturning(duplicate.id); setEditor(null) } }} size="sm" variant="secondary">{draft.members[duplicate.id].selected ? 'Edit existing player' : `Bring back ${duplicate.manager_name}`}</Button></Notice> : nameTaken && <Notice tone="warning">This manager name is already on the roster. Use a name that distinguishes this player.</Notice>}
        <div className="flex justify-end gap-2"><Button onClick={() => setEditor(null)} variant="secondary">Cancel</Button><Button disabled={!editor.managerName.trim() || !editor.teamName.trim() || Boolean(nameTaken) || Boolean(duplicate)} type="submit">{editor.kind === 'existing' || draft.newMembers.some(member => member.key === editor.key) ? 'Save player' : 'Add to roster'}</Button></div>
      </form>}
    </Dialog>
  </div>
}
