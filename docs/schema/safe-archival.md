# Safe league and season archival

Migration `202608250004_safe_archival.sql` is prepared locally and intentionally **not applied** to the live Supabase project.

## Product contract

Archiving is a reversible visibility and write-safety state, not deletion.

- Players can continue to open archived leagues and seasons as history.
- Scores, matchups, members, manager identities, dues, prizes, payouts, settings, and ESPN mappings are preserved.
- The current season cannot be archived independently. Start or activate the next season first.
- Archiving a whole league turns automatic score sync off and marks sync disabled.
- Restoring a league does not automatically re-enable score sync. The commissioner must make that separate decision.
- Archived league or season pages hide commissioner editing controls, while League Settings remains available to the commissioner for restoration.
- Server mutation routes independently reject writes to an archived league or season; hiding controls is not the security boundary.

## Database contract

The migration adds nullable `archived_at` timestamps to `leagues` and `league_seasons`. A null value means active/available; a timestamp records when the item was archived.

Only the service role may execute `set_league_archive_status` and `set_season_archive_status`. The protected player-view route may return non-sensitive archive state after validating a season-scoped link. Neither function deletes or rewrites historical rows.

The league function updates archive state and disables automation in one transaction. The season function locks the parent league while checking `current_season`, preventing the active season from being archived through a race.

## Local verification

Run:

```sh
npm run schema:test:authorization
```

The disposable PostgreSQL 17 suite verifies archive and restore behavior, active-season rejection, automatic-sync shutdown, preservation of member/score history, pre-migration compatibility, post-migration direct-read denial, and shared-role RPC denial. It uses only synthetic fixtures and removes the container afterward.

Application tests cover signed-session route protection, exact action validation, missing-migration fallback, write guards, active-season UI protection, confirmation, and refresh after a historical archive.

## Activation and rollback

Apply migration `004` only after migrations `001`–`003`, then apply scoped-sharing migration `005`, following the main authorization rollout guide. After activation, verify server-authorized historical reads, player-link season isolation, commissioner archive/restore, active-season rejection, mutation blocking, and automatic-sync state before considering the rollout complete.

Database rollback should normally be unnecessary: restoring an item clears `archived_at`. Do not drop the columns or functions during an incident unless a reviewed follow-up migration is required. Prefer rolling the application back while retaining the additive schema.
