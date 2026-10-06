# October 5 money-correctness release

Migrations 021–023 stop routine writes from erasing settled money records. They were applied to Production on October 5, 2026, after a fresh backup, two restored-backup rehearsals and a dry run. The members-route change shipped in commit `4608bc2`.

| Finding | Problem | Fix |
| --- | --- | --- |
| N01 | Every weekly ESPN import deleted and re-inserted the week's scores, even when nothing changed. The `reset_player_payout_statuses_for_score` trigger (migration 015) then reopened every paid player payout in the season. The Wednesday correction pass re-imports the previous week, so this fired weekly. | Migration 021 skips a weekly import whose scores and matchups are unchanged, matching the season import's EI-16 rule. A genuine ESPN correction still replaces the week and reopens payouts. |
| N01 | The score editor's Save button stays enabled without edits, and the manual save also deleted and re-inserted the week. | Migration 023 applies the same unchanged-week rule to `mutate_manual_week_atomically`. |
| N02 | Re-adding a removed player wrote `payment_status = 'pending'`, which fired `sync_member_payment_summary` (migration 003) and reset their dues receipt to $0. | Migration 022 adds `reactivate_league_member_atomically`. It keeps the receipt, refreshes expected dues to the current fee, and recomputes Paid/Partial/Unpaid. The members route uses it for both re-add paths and falls back to an update that never writes `payment_status`. |

## Validation

- New SQL assertions: an unchanged re-import or manual save keeps a Paid payout and the existing score rows, and a changed score still reopens it. Reactivation keeps a $100 receipt, turns it Partial after a fee rise to $150, and rejects an already active player. Each assertion failed without its migration and passed with it.
- `schema:test:fresh` passes on the bootstrap plus migrations 001–023. All 512 unit, component and API tests passed, including 5 new members-route tests, along with the synthetic integration suite.
- Rehearsed on restored Production backups from September 16 and October 5 (the pre-021 backup below). Before the replacements, Production's `import_espn_week_atomically` and `mutate_manual_week_atomically` bodies matched the repository's migration 002 and 013 definitions exactly, so 021 and 023 overwrote no production-only change.

## Production execution

- Backup: `data/rollout-backups/2026-10-05-pre-021/`. Schema SHA-256: `7daab696dfdfd42da44d00ee0fdf874bde63bb9c88778496cae174a3869193d0`; data SHA-256: `5a66a13f65a9af2cf04aa78b59eee12881ec3288774b1f14bec11cc9bbc2d75f`.
- Dry run listed exactly 021, 022 and 023. The push applied all three.
- Migration SHA-256:
  - 021: `f8f54074e1da61c6b53c9c99e5a457d1c0c184dfce2b9e607816af279ed61e49`
  - 022: `e0097761e96124156462a18f69d677c769efb6ca5bf73eee3779c26f269ee9ea`
  - 023: `5a6207a7ea9ec7c70ecaf7672769580549b559f0dd61481d3bb4c36e7a246926`
- Post-push verification matched the pre-push backup row for row: 3 leagues, 12 seasons, 140 memberships and season payments, 47 managers, 1,654 scores, 821 matchups, 19 import runs, 158 prize awards, 28 prize payouts, 9 player payout statuses, 3 share links. All fantasy tables keep RLS, with no shared-role table privileges. Automatic sync is enabled for all 3 leagues.

## Production state observed

- Scheduled imports on September 23 and 30 succeeded for all three leagues, including the one-week-back correction pass. 2026 weeks 1–3 are imported and no league reports a sync error.
- No 2026 player payouts were marked Paid before the release (the 9 Paid records are from 2025), so N01 had not reopened any settled payout.
- The largest league held 1,054 score rows. The history view's unpaginated read could exceed Supabase's default 1,000-row response cap; it is addressed separately (N03).

## Rollback

- 021: re-run the `import_espn_week_atomically` create-or-replace block and grants from `202608250002_atomic_espn_imports.sql`.
- 022: `drop function public.reactivate_league_member_atomically(text, text, uuid, text);` the route falls back automatically.
- 023: re-run the `mutate_manual_week_atomically` block and grants from `202608260013_atomic_manual_week_scores.sql`.

Restoring 021 or 023 reintroduces the payout reset, so prefer a reviewed forward migration.
