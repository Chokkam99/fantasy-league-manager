import { seasonSetupPreview as preview } from '../../../test/fixtures/seasonSetup'
import { createSeasonSetupDraft, draftIssues, draftMembers, draftRequest, restoreSeasonSetupDraft, rosterIssue } from '../seasonSetupDraft'
import { mobileNavigation, navigationOrder, seasonPhase } from '../seasonNavigation'

it('uses completed game progress to change commissioner priorities and keeps public navigation stable', () => {
  expect([0, 1, 16, 17].map(week => seasonPhase(week, 17))).toEqual(['preseason', 'in-season', 'in-season', 'wrap-up'])
  expect(mobileNavigation(navigationOrder('preseason', true), true, 'preseason')).toEqual(['overview', 'players', 'standings', 'scores'])
  expect(navigationOrder('wrap-up', true)[1]).toBe('prizes')
  expect(navigationOrder('preseason', false)).toEqual(navigationOrder('in-season', false))
})
it('carries only selected identities, clears invalid divisions, and keeps original prize keys', () => {
  const draft = createSeasonSetupDraft(preview)
  draft.members[preview.members[0].id].managerName = 'Chris'
  draft.members[preview.members[0].id].division = 'Removed division'
  draft.prizes = [{ id: 'first', label: '1st place', amount: '10', originalKey: 'first' }]
  expect(draftMembers(preview, draft)).toHaveLength(2)
  expect(draftMembers(preview, draft)[0]).toMatchObject({ source_member_id: preview.members[0].id, manager_name: 'Chris', division: null })
  expect(draftRequest(preview, draft).configuration.prize_structure).toEqual({ first: 10 })
})
it('rejects duplicate normalized payouts before object conversion loses them', () => {
  const draft = createSeasonSetupDraft(preview)
  draft.prizes = [{ id: '1', label: 'Top Score', amount: '1' }, { id: '2', label: 'Top-score', amount: '2' }]
  expect(draftIssues(preview, draft)).toContain('Each payout needs a unique name.')
  draft.newMembers.push({ key: 'new', managerName: ' jordan   lee ', teamName: 'Duplicate', division: '' })
  draft.members[preview.members[2].id].selected = true
  expect(rosterIssue(preview, draft)).toMatch(/same manager name/)
})
it('restores only the correct season and valid draft shape, excluding unknown source IDs', () => {
  const draft = createSeasonSetupDraft(preview)
  draft.members['unknown'] = { managerName: 'Unknown', teamName: 'Fake', division: '', selected: true }
  const encode = (source = '2025') => JSON.stringify({ version: 1, source, target: '2026', draft })
  expect(restoreSeasonSetupDraft(encode(), preview)?.members.unknown).toBeUndefined()
  expect(restoreSeasonSetupDraft(encode('2024'), preview)).toBeNull()
  expect(restoreSeasonSetupDraft('{broken', preview)).toBeNull()
  draft.newMembers = [{ key: 'same', managerName: 'A', teamName: 'A', division: '' }, { key: 'same', managerName: 'B', teamName: 'B', division: '' }]
  expect(restoreSeasonSetupDraft(encode(), preview)).toBeNull()
})
