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

## Services, Dependencies & Port Map

| Service | Port | Environment Variable | Role |
| :--- | :--- | :--- | :--- |
| **CodeArena Frontend** | `3000` | `WEB_ORIGIN=http://localhost:3000` | Next.js 16.4.3 App Router web application |
| **CodeArena API** | `3001` | `PORT=3001`, `NEXT_PUBLIC_API_URL=http://localhost:3001` | Hono/tRPC backend providing problems, submission history, test cases, and auth |
| **PostgreSQL Database** | `5432` | `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/codearena` | Relational store for problems, test cases, student progress, and submission records |
| **Judge0 CE Engine** | `2358` | `JUDGE0_BASE_URL=http://localhost:2358` (bound to `127.0.0.1:2358`) | Sandboxed code compiler and test runner for Python and C++ |
| **Judge0 Internal Redis** | `6379` | Internal Docker container network (`redis:7.2.4`) | Job queue broker for Judge0 worker nodes |

## Workspace Workflow & Scripts

The root workspace is managed via `pnpm` (`packageManager: pnpm@12.11.2`).

### Development
Start frontend and API services together in parallel:
```powershell
pnpm dev
```
Or run individual services independently:
```powershell
pnpm dev:web  # Starts Next.js frontend on http://localhost:3000
pnpm dev:api  # Starts Hono/tRPC backend on http://localhost:3001
```

### Hermetic Test Suites
The root test command runs all hermetic test suites across both the root regression suite and API routers:
```powershell
pnpm test
```
Individual test suites remain accessible:
```powershell
pnpm test:root  # Executes node --test tests/*.test.mjs (12 tests)
pnpm test:api   # Executes tsx --test apps/api/test/*.test.ts (104 tests)
```

### Typechecks & Linting
```powershell
pnpm typecheck  # Typechecks @code-arena/db, apps/api, and apps/web
pnpm lint       # Lints apps/web using ESLint 9
pnpm build      # Builds Next.js production bundle with Turbopack
```

## Monaco Editor Architecture & Reliability

- **Loading Mechanism**: `@monaco-editor/react` uses `@monaco-editor/loader` to load AMD scripts and web workers dynamically from jsDelivr at runtime.
- **Version Pinning**: Monaco assets are pinned to version `0.55.1` (`https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs`).
- **Configurable CDN / Mirror**: Organizations or intranet environments can override the asset host via `NEXT_PUBLIC_MONACO_CDN_URL`.
- **Offline / Disconnect Fallback**: Because CodeArena's code evaluation, submission records, and catalog data depend on backend services (Judge0 and PostgreSQL), full offline execution is not architecturally justified. However, to guarantee editor reliability during CDN network latency or firewall blocks, `MonacoCodeEditor` automatically catches CDN load failures and renders a styled, responsive `<textarea>` fallback editor. Users can write code, retain edits, and submit without the UI hanging.
- **Maintainability**: No raw, unversioned 30MB+ Monaco bundles are checked into `apps/web/public/`, avoiding git bloat and worker MIME type issues.

## Module Configuration

All packages across the workspace (`apps/web`, `apps/api`, `packages/db`, `packages/shared`) explicitly declare `"type": "module"`. This resolves the Node.js v22+ `MODULE_TYPELESS_PACKAGE_JSON` experimental warning when importing TypeScript source modules directly (e.g., `tests/game-rules.test.mjs` importing `apps/web/src/lib/game-rules.ts`).

## Verification Summary

- **Tests**: 116 tests executed across root and API (108 passed, 8 skipped for live-daemon integration, 0 failed).
- **TypeScript**: `pnpm typecheck` passed with 0 errors across `@code-arena/db`, `api`, and `web`.
- **Lint**: `pnpm lint` passed with 0 errors and 0 warnings.
- **Production Build**: `pnpm build` passed with 0 errors, prerendering all 15 routes cleanly.

