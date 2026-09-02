# Fantasy League Manager

A mobile-first league office for private fantasy football leagues among friends. Commissioners can track seasons, dues, prize allocation, standings, weekly scores, and ESPN imports; players can use the same league pages to understand results, playoff position, rules, and payouts.

ESPN remains the source of truth for rosters, lineups, waivers, trades, and live scoring. This app focuses on league-specific money, rules, history, and weekly outcomes.

## Current capabilities

- Multi-league and multi-season dashboards.
- Season-specific players, team names, groups/divisions, schedules, playoff settings, fees, draft costs, and prize rules.
- New-season setup with last season selected by default, earlier league players available to return, editable team names, new-player entry, and even-team validation.
- Mobile standings with division-aware seeding, published tiebreakers, and a playoff cut line.
- Weekly score rankings, matchup cards, manual correction, and current-season ESPN preview/import.
- Dues collection and a reconciled money-in/money-out prize plan.
- Weekly and final award history.
- One predictable league-wide share URL for public-safe standings, scores, rules, prize context, and history across seasons.
- Commissioner-only mutations behind signed, expiring server sessions.
- Optional ESPN automation every Wednesday at 2:00 AM Phoenix time, with on-demand preview and sync retained.

## Prerequisites

- Node.js 20 or newer.
- npm 10 or newer.
- A Supabase project matching the documented deployed-`v0` contract.
- macOS Keychain for the recommended local commissioner-secret workflow.
- Podman only when running the disposable PostgreSQL authorization test.

## Local development

Install dependencies and copy the environment template:

```sh
npm install
cp .env.example .env
```

The repository-local `.npmrc` pins installs to `https://registry.npmjs.org/` so local and Vercel builds never depend on a corporate registry or VPN. Keep package fetches on the public npm registry and do not commit corporate registry URLs to package manifests or lockfiles.

At minimum, configure the public Supabase URL and anonymous key in `.env`. Protected league reads and server mutations also require a Supabase secret key. Never prefix server credentials with `NEXT_PUBLIC_`.

Generate local commissioner configuration through hidden prompts:

```sh
npm run admin:password:keychain
npm run admin:session:keychain
```

Both commands store their generated values under service `fantasy-league-manager`; the accounts are `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET`. See [commissioner authentication](docs/security/commissioner-authentication.md) for deployment guidance.

Start the app with Keychain-backed authentication:

```sh
npm run dev:keychain
```

Open [http://localhost:3000](http://localhost:3000).

## Database safety

`database-setup.sql` is a retired legacy reference, deliberately fails if executed, and does **not** reproduce the deployed schema. Do not use it for any installation.

The deployed baseline, known drift, data-health audit, and forward migration decision are recorded in [the deployed schema reference](docs/schema/deployed-schema-2026-08-24.md). Production migrations `001`–`015` were applied and verified on 2026-08-27, and migration `016` was applied and verified on 2026-09-02. The chain covers authorization, atomic ESPN imports, finance and stable identity, reversible archival, scoped legacy links, exact cleanup, core constraints, atomic rollover and manual scores, legacy schedule-RPC retirement, per-player payout completion, historical returning players, and even-roster validation.

Validate it locally with synthetic data:

```sh
npm run schema:test:authorization
```

This starts a disposable Supabase PostgreSQL 17 container without publishing a host port, applies the synthetic deployed-`v0` fixture and all forward migrations, verifies access, imports, stable identities, finance, payout completion, and archival behavior, and removes the container. It does not connect to Production.

Follow [the rollout guide](docs/schema/authorization-foundation-rollout.md), [finance/identity design](docs/schema/finance-identity-foundation.md), and [safe archival design](docs/schema/safe-archival.md) before applying any future remote migration.

For a brand-new empty database targeting the current workspace, use the guarded fantasy-only baseline in `supabase/bootstrap/deployed-v0.sql`, followed immediately by migrations `001`–`016`. Existing Production is current through migration `016`. The two paths, remaining product decisions, and reusable approval gates are documented in [fresh schema reconciliation](docs/schema/fresh-schema-reconciliation.md).

## Player access

Commissioners use the compact share action to copy the normal `/league/<league-slug>` URL. Anyone with it can view the league's public-safe pages and switch among saved seasons, but cannot open Settings, see individual dues/payment details, or submit commissioner changes.

Previously issued `/s/...` links remain supported for compatibility. Those links store only a SHA-256 digest, establish a protected browser access cookie, and redirect to the normal league URL. The current share action does not create or rotate a database record, and the old cosmetic `readonly=true` convention is not an access mechanism.

## ESPN score imports

Commissioners configure and test ESPN access from the Scores page. Stored private-league cookies are write-only and used only on the server.

- Automatic import is opt-in.
- The scheduled route runs Wednesday at 2:00 AM Phoenix (`0 9 * * 3`).
- Each scheduled run imports the latest completed week and rechecks exactly one prior week for late ESPN corrections, oldest first.
- Imports are restricted to the league's configured active season.
- Each import replaces one exact league/season/week atomically, so corrections are idempotent and a failed import cannot leave partial scores or matchups.
- A per-league/season/week lock prevents manual and scheduled imports from racing; commissioners can see the latest completed or failed import attempt.
- Preview, completed-week sync, retry, selected-week sync, and manual scores remain available.
- ESPN is authoritative for automated weeks, so the bounded correction pass can replace a manual score edit in either checked week.
- Historical seasons are read from stored data and are never re-imported from ESPN.
- An unset or incorrect `CRON_SECRET` fails closed.

## Environment variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Public Data API key. |
| `SUPABASE_SECRET_KEY` | Server only | Preferred privileged key for authorized mutations and cron. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Temporary compatibility alternative to the modern secret key. |
| `ADMIN_PASSWORD_HASH` | Server only | Versioned scrypt commissioner verifier. |
| `ADMIN_SESSION_SECRET` | Server only | Signs expiring commissioner sessions; at least 32 characters. |
| `ALLOW_LEGACY_ADMIN_PASSWORD_HASH` | Server only | Temporary migration flag only; omit in target deployments. |
| `CRON_SECRET` | Server only | Bearer secret for the scheduled import route. |

## Scripts

```sh
npm run dev                         # Local Next.js development server
npm run dev:keychain                # Development with Keychain auth values
npm run admin:hash-password         # Print a verifier from a hidden prompt
npm run admin:password:keychain     # Store a verifier directly in Keychain
npm run admin:session-secret        # Print a new session-secret assignment
npm run admin:session:keychain      # Store a new session secret in Keychain
npm run build                       # Production build
npm run lint                        # ESLint
npm run typecheck                   # Application TypeScript check
npm run test                        # Jest tests
npm run test:integration            # Synthetic UI workflows; no remote services
npm run test:e2e                    # Responsive fixture-only browser journeys
npm run test:e2e:headed             # Same browser journeys with Chrome visible
npm run schema:types                # Regenerate linked Supabase types
npm run schema:audit                # Read-only linked schema/data-health audit
npm run schema:audit:cleanup        # Aggregate-only legacy cleanup candidate report
npm run schema:audit:constraints    # Aggregate-only core constraint compatibility report
npm run schema:export:rollback -- --output data/rollout-backups/<name> --confirm-read-only-production-export
npm run schema:test:authorization   # Disposable PostgreSQL 17 migration/import test
npm run schema:test:cleanup         # Disposable exact cleanup/constraint test
npm run schema:test:fresh           # Disposable empty-database bootstrap test
```

## Project structure

```text
src/app/                 Next.js routes and server endpoints
src/components/          League screens and reusable UI
src/lib/                 Domain logic, auth, Supabase, and ESPN adapters
e2e/                     Responsive commissioner/player browser fixtures and journeys
supabase/migrations/     Forward-only database migrations
supabase/bootstrap/      New-empty-database fantasy-only deployed-v0 baseline
test/fixtures/           Synthetic deployed-v0 database fixture
test/integration/        Synthetic test setup and SQL authorization assertions
docs/schema/             Schema audit and migration rollout references
docs/security/           Authentication guidance
scripts/                 Local audit, generation, Keychain, and test tools
vercel.json              Wednesday cron schedule
```

## Quality gate

The Playwright suite covers commissioner and shared-player journeys at 320px, 390px, and desktop widths. It intercepts its league, finance, authentication, automation, and lifecycle requests with synthetic fixtures, asserts that no mutation is submitted, and never connects to Supabase or ESPN. Local runs use an installed Google Chrome; CI installs its own Chromium.

The GitHub Actions workflow in `.github/workflows/quality.yml` runs the frozen dependency install, lint, application typecheck, unit/component tests, synthetic integration tests, production build, and responsive E2E suite. It uses one standard runner, read-only repository permissions, concurrency cancellation, no production secrets, no live services, and no retained artifacts. The repository is public, so standard GitHub-hosted runners are currently covered by GitHub's public-repository allowance; do not change it to a larger runner or add a paid service without a separate cost review.

## Deployment state

Production has all 16 forward migrations applied. The accompanying application release adds historical returning-player selection, editable new-season names, even-team enforcement, and compact expandable playoff history to the existing signed-session, public-sharing, score, standings, finance, payout, and archival workflows. The final linked dry run is up to date, and automatic ESPN sync remains intentionally disabled pending a deliberate on-demand validation.

Supabase preview branching is unavailable on the current free plan, so future schema and write behavior should continue to be verified in disposable local PostgreSQL without creating paid resources or pointing a writable preview deployment at Production. See the [completed Production migration checkpoint](docs/deployment/production-migration-2026-08-27.md). The [preview rollout](docs/deployment/preview-rollout.md) and [pre-execution Production rollout](docs/deployment/production-rollout-2026-08-26.md) are retained as historical planning evidence.
