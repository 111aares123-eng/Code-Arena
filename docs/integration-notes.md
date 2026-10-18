# Auth & Dashboards: integration notes

Status as of 2026-10-18. Branch: `auth-and-dashboards` (work in progress, **not ready to merge**).
Compared against GitHub `main` at `c3ffba7` (Merge PR #3, `chore/remove-duplicate-migration`).

This branch was built before `main` gained a database layer and a test-case admin API. The two designs overlap in several places. This note lists what the branch adds, where it conflicts with `main`, and how I plan to fix it. I will make the corrections on my side, in a separate integration branch, after agreeing the points under "Questions for the team".

## 1. What this branch adds

Backend (apps/api, packages/db):
- Email and password accounts. `auth.register` (learners only), `auth.login`, `auth.logout`, `auth.me`.
- Sessions: random `ses_` IDs stored in a `sessions` table, sent as an HttpOnly `session` cookie (SameSite=Lax, 7 days, `Secure` in production). bcryptjs, cost 12.
- Role-aware tRPC procedures: `protectedProcedure`, `mentorProcedure`, in a shared `apps/api/src/trpc.ts`.
- Mentor accounts: created by `pnpm create-mentor` (env `MENTOR_NAME`, `MENTOR_EMAIL`, `MENTOR_PASSWORD`) or by `auth.registerMentor`, which requires the secret `MENTOR_INVITE_CODE` (min 16 chars, constant-time compare, checked before any DB access).
- Credentialed CORS (`credentials: true`, explicit origins).

Frontend (apps/web):
- Pages `/login`, `/register` (learners), `/admin/login` (mentors).
- Server-side route protection by calling `auth.me` with the incoming `session` cookie: `/dashboard` is learner-only, `/admin` is mentor-only.
- Navbar login state (logged out: Log in / Sign up; logged in: name, dashboard link, Log out).
- Placeholder dashboards with "Coming soon" sections and no fake data.

## 2. Other branches on GitHub

| Branch | Author | State |
|---|---|---|
| `main` (`c3ffba7`) | team | Includes everything below that is marked merged. |
| `feature/live-game-layer` | Captvarun | Merged (PR #1). No overlap with auth. |
| `sync/code-arena-enhanced` | Captvarun | Already contained in `main`. |
| `feature/data-contests` | Karthika | Merged (PR #2). Adds users, submissions, contests, progress, achievements tables. **Main source of conflicts.** |
| `chore/remove-duplicate-migration` | Karthika | Merged (PR #3). Cleanup of migrations. |
| Aares's commits on `main` | Aares | Hidden-test evaluation, test-case admin router, `ADMIN_API_TOKEN`. **Second source of conflicts.** |

## 3. Conflicts with `main`

| Area | `main` | This branch | Planned resolution |
|---|---|---|---|
| `users` table | `username` (required, unique), `display_name`, `xp`, `rating`, no password | `name`, `password_hash`, no username, no xp/rating | Use `main`'s table as the base. Add `password_hash` to it. |
| `user_role` enum | `STUDENT`, `ADMIN`, `INSTRUCTOR` | `learner`, `mentor` | Keep `main`'s enum. Map learner = `STUDENT`, mentor = `INSTRUCTOR`. `ADMIN` stays free for a future superadmin. |
| `sessions` table | none | `sessions` (id, user_id, expires_at) | Keep it. Add it in a new migration on top of `main`'s. |
| Migrations | `0001_smart_zombie`, `0002_futuristic_ironclad` in the journal | my own `0001_damp_madame_hydra` | Delete my 0001. Generate a new migration after 0002. |
| `apps/api/src/context.ts` | `createApiContext(req)` returns `{ authorization, testCaseStore? }` (all fields optional, tests use `createCaller({})`) | context loads the session user and writes cookies through the adapter's `resHeaders` | Merge into one `ApiContext` that keeps `authorization` and `testCaseStore` and adds the session user. Fields stay optional so existing tests still compile. |
| tRPC instance | Each router file calls `initTRPC.context<ApiContext>().create()` | One shared `apps/api/src/trpc.ts` | Use the shared instance everywhere, including Aares's `execution.ts` and `test-case-admin.ts`. |
| `apps/api/src/index.ts` | `createContext: (_opts, c) => createApiContext(c.req.raw)`, adds `testCaseAdmin` router | my own `createContext`, `authRouter`, credentialed CORS | Merge by hand: keep `testCaseAdmin`, keep `auth`, keep credentialed CORS. |
| Admin authorization | `ADMIN_API_TOKEN` shared secret as a Bearer token (code comment says to replace it once real auth exists) | `mentorProcedure` (session cookie, role check) | Switch test-case admin to `mentorProcedure`. Keep the token as an optional fallback only if Aares wants it. |
| `drizzle.config.ts` | loads `../../.env` | not changed | Take `main`'s version. |
| Local DB | migrations 0000 to 0002 | my local DB has my 0001 applied | Local dev DB must be reset (drop the volume or database). It only holds test accounts. |

Things that do not conflict: the web app (no changes on `main` touch navbar, layout or the new pages), `packages/shared`, and the test-case panel UI.

## 4. What `main` already gives the dashboards

- `submissions` (user, problem, language, verdict, passed/total cases), owned by Karthika.
- `student_problem_progress`, `student_stats`, `achievements`, `user_achievements`.
- `contests`, `contest_problems` (with points), `contest_participants` (score, penalty, problems solved), `contest_submissions`, `contest_solves`.
- Queries: `getContestLeaderboard`, `recordContestSubmission`, a leaderboard query ranking by `xp` then `rating`.

Gaps for the mentor features:
- `contests` has **no owner**. Contests need a `created_by` (mentor user id) so a mentor can list their own contests.
- No link between a learner and a mentor.
- `execution.submit` does not store a submission or know who the user is yet.

## 5. Plan

1. **Backup.** Push this branch as is, so the work is on GitHub. It will not be merged.
2. **Agree the points below** with Karthika (database) and Aares (API).
3. **Integration branch** (new branch from latest `main`, never edit `main` directly):
   - Add `password_hash` and `sessions` to `main`'s `users` schema, new migration after 0002.
   - Port the auth router, `create-mentor` script and invite-code signup to the new columns and roles. Registration must produce a `username` (see Questions).
   - Merge the two contexts and move all routers to the shared tRPC instance. Make sure the existing tests (`pnpm test`) still pass.
   - Replace `ADMIN_API_TOKEN` checks with `mentorProcedure`.
   - Reset the local DB and rerun the manual login checks.
4. **Direct mentor links.** Add `mentor_id` (nullable) on learner rows and a join code per mentor. Learner enters the code to link.
5. **Contest ownership.** Add `created_by` to `contests` (Karthika's table, so agree with her first).
6. **Real dashboard data.** Learner: solved count, joined contests, mentor. Mentor: my students, my contests. Read from the existing tables.
7. **Record submissions with the logged-in user.** Small change in `execution.submit` (Aares's code): write a `submissions` row with the session user's id.
8. **Mentor signup page** `/admin/register` using the invite code.
9. **Hardening backlog:** login and invite-code rate limiting, expired-session cleanup, `NODE_ENV=production` (hides error stack traces), a committed docker-compose for Postgres.

## 6. Questions for the team

For Karthika:
- Can `password_hash` be added to `users` (nullable at first, or required)?
- Learner and mentor roles are `STUDENT` and `INSTRUCTOR`. Okay?
- `username` is required and unique. Should signup ask for it, or derive it from the email (with a numeric suffix on clashes)?
- Can `contests` get a `created_by` column pointing to the mentor?

For Aares:
- OK to replace the `ADMIN_API_TOKEN` check with a mentor session check? Keep the token as a fallback?
- OK to add a `submissions` insert (with the session user's id) to `execution.submit`?
- Any objection to all routers using one shared tRPC instance in `trpc.ts`?

For everyone:
- Which route do mentor-posted contests use: Karthika's `contests` table directly, with the mentor as owner?

## 7. Not yet verified

- A real merge of `main` into this branch has not been attempted. The conflict list comes from reading the diff between `55850d4` and `c3ffba7`, so one or two more small conflicts may appear.
- Everything in section 1 has been tested locally against a Postgres 18 container, but not yet against `main`'s schema.
