# CodeArena enhanced project

This archive contains the full project, with enhancements to the practice game layer, `apps/web`, `apps/api`, and environment examples. Start with the steps below after extracting to a new folder.

## What changed

- Daily practice quest and 28-day activity calendar.
- Repeat sample passes maintain your streak without awarding duplicate XP.
- All three achievements unlock automatically; the seven-day achievement stays earned even after a streak ends.
- Dynamic next-achievement progress and next-unsolved warm-up from the bundled problem catalog.
- Existing browser progress is preserved under the same v1 storage key. Duplicate/invalid entries are sanitized; XP is recalculated at 25 per unique sample-passed problem.
- Offline problem-library pagination now respects page and limit.
- CORS now covers tRPC requests as well as the live event stream.
- Judge0 submission and polling share one timeout; unfinished jobs no longer return success.
- Event-stream queues are bounded, and subscriptions/timers are cleaned up on disconnect or write failure.
- Root backend environment loading and a separate browser environment example.

## Windows PowerShell setup

Use Node.js 24 or newer and pnpm. Run these commands from the extracted project root. If you already have configuration, merge the example settings rather than overwriting your .env files.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item packages/db/.env.example packages/db/.env
```

Update PostgreSQL credentials in both `.env` and `packages/db/.env`. Set `WEB_ORIGIN` to your web app origin and `NEXT_PUBLIC_API_URL` to the API URL your browser can reach. Public environment variables are embedded at web build time, so rebuild after deployment changes.

With PostgreSQL running and the `codearena` database created:

```powershell
pnpm db:migrate
pnpm db:seed
```

Configure a running Judge0 service using the root `.env`. The existing `docker/judge0` folder is retained; its deployment was not verified in this update. Code execution requires Judge0; the problem library can use its bundled fallback catalog without it.

Start separate PowerShell windows at the project root:

```powershell
pnpm dev:api
```

```powershell
pnpm dev:web
```

Open `http://localhost:3000/arena`.

## Verification

Completed in the supplied environment:

- Frozen-lockfile dependency installation.
- Web and API TypeScript checks.
- Web ESLint check.
- Web production build, including all 15 generated pages (using the fallback dataset).
- Four regression tests covering reward deduplication, repeat-day streaks, malformed legacy saves, permanent achievement unlocking, and cancellation of stalled Judge0 polling.

Run the checks yourself:

```powershell
pnpm test
pnpm --filter web exec tsc --noEmit
pnpm --filter api typecheck
pnpm --filter web lint
pnpm --filter web build
```

API development-server startup could not be smoke-tested here: the execution environment denied tsx's IPC socket (`EPERM`). PostgreSQL, live Judge0 execution, browser interactions, and live SSE/CORS were not integration-tested. Validate these with your local services.

## Current boundaries

Progress is browser-local, editable by the user, and is not a secure competitive score. Sample passes do not establish correctness against hidden tests. Campus standings remain clearly labeled demonstration data. No accounts, persistent multiplayer leaderboard, or rated duels were added. The warm-up recommendation uses the bundled catalog, not a server-wide personalized ranking.

The ZIP excludes installed dependencies, generated builds, and secret .env files. Existing source and lockfiles are included.
