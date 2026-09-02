# Preview rollout

Status: **historical planning record from 2026-08-25**. The application and migrations described here were subsequently released to Production. Do not use the branch names, migration state, or deployment inventory below as current state; retain this document only for its free-tier preview safety boundaries.

This runbook prepares an isolated preview of the authentication, protected-read, server-mutation, and authorization migration work. It must not use the linked live Supabase database as a writable preview target.

## Current local readiness

As of 2026-08-25:

- The repository remote is GitHub and the working branch is `codex/authorization-preview`.
- The workspace has a large uncommitted implementation set and is 109 status entries ahead of the checked-in baseline. Do not deploy `main` or merge directly while packaging the preview.
- Vercel CLI 59.5.0 is installed under the user account, available on the normal PATH, authenticated as `chokkam99`, and linked to `rithvik-chokkams-projects/fantasy-league-manager` through `.vercel/repo.json`.
- GitHub CLI is installed, but its saved `Chokkam99` token is invalid.
- Supabase CLI is installed and linked only to the live `fantasy-league-manager` project.
- Supabase branching was attempted without data on a Micro instance, but the API returned `402 entitlement_required` because the organization is not on Pro. Supabase registered the existing production project as the default `main` branch in branch-management metadata, but created no preview branch or additional compute.
- A deployment-protected Vercel Preview Deployment is Ready. It currently has only the public Supabase URL/key and cron secret; no commissioner auth or privileged Supabase key is configured.
- Local commissioner password and session values are available through Keychain. They must not be reused for preview or production.
- Local `.env` has public Supabase values and `CRON_SECRET`, but no privileged Supabase server key or file-based session secret.

## Recommended topology

With the current Supabase plan, use the non-`main` Git branch and deployment-protected Vercel Preview only for build and commissioner-authentication smoke testing. Keep protected league reads, player-link behavior, database migrations, and privileged writes in the disposable local Supabase PostgreSQL 17 container. The new application routes need a privileged server key and migration `005`, so a Preview pointed at the unmigrated live project cannot safely validate league journeys. Do not configure `SUPABASE_SECRET_KEY` in Vercel Preview while it points at the live Supabase URL.

If the organization later upgrades to Pro, an ephemeral data-less Supabase Preview Branch is the preferred remote write-test target. Do not create a separate staging project unless that product decision changes. Do not use a local Supabase container as an internet-accessible Vercel backend.

Supabase branching consumes billable compute. Confirm the account and cost choice before creating a branch.

## Required preview values

Create new preview-only auth values; do not copy local or production commissioner secrets.

- `NEXT_PUBLIC_SUPABASE_URL`: existing live project URL for configuration/build compatibility only.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: existing public key.
- `ADMIN_PASSWORD_HASH`: generate through `npm run admin:hash-password`.
- `ADMIN_SESSION_SECRET`: generate independently with `npm run admin:session-secret`.
- `CRON_SECRET`: generate independently with `openssl rand -base64 32`.

Do not configure `ALLOW_LEGACY_ADMIN_PASSWORD_HASH`, `SUPABASE_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` for the current preview. Commissioner login can be verified, but every database mutation must fail closed until an isolated Supabase branch is available.

## Packaging and deployment order

1. Review and package the complete diff on `codex/authorization-preview` before any Git push or merge.
2. Configure branch-specific Vercel Preview values for `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET`. Keep the existing public Supabase values and omit every privileged database key.
3. Create a Vercel Preview Deployment from `codex/authorization-preview`. Do not deploy with `--prod`.
4. Verify commissioner login and fail-closed league loading. Confirm every protected league read and commissioner database mutation returns the privileged-server configuration error rather than falling back to the public key.
5. Keep migrations `202608250001` through `202608260014` unapplied remotely. Continue validating the existing-production path with `npm run schema:test:authorization` and the new-empty-database path with `npm run schema:test:fresh`.
6. Disable or avoid invoking automatic import. The cron route must still reject requests without the correct bearer secret.

## Preview verification

- Signed-out direct league URLs fail closed without a valid season-scoped player token.
- Player-link journeys are verified locally with synthetic fixtures and disposable PostgreSQL, not against the unmigrated live target.
- Wrong password returns `401`; malformed verifier configuration returns `503`.
- Correct password issues an HTTP-only, secure, same-site session cookie.
- Tampered, expired, and legacy cookies are rejected.
- Browser league queries go only through protected server routes and never fall back to direct Supabase table reads.
- Commissioner mutation routes fail closed because Vercel Preview has no privileged Supabase key.
- Cron rejects missing/incorrect bearer tokens and is not invoked with the correct secret against the live Supabase target.
- The disposable PostgreSQL 17 suites continue to verify the fresh fantasy-only bootstrap, direct shared-role denial, share-link lifecycle, privileged writes, constraints, atomic workflows, legacy RPC retirement, and all fourteen prepared migrations.
- `collections` and `items` remain unchanged and explicitly out of scope.
- Mobile routes have no page-level horizontal overflow at 320, 390, 768, and 1280 pixels.

## Rollback and cleanup

- Roll back the Vercel preview deployment or delete it; never promote it to production during testing.
- No Supabase preview-branch cleanup is currently required because branch creation failed before additional compute was provisioned. Do not delete the default `main` branch record.
- Revoke/delete preview-only auth, cron, and database secrets after teardown.
- Do not merge the database migration or apply it to production until preview results are documented and the commissioner explicitly approves production rollout.
