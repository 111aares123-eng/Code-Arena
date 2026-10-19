# Auth and main integration

Status: integration completed on `tnivedha-257-auth-main-integration`. The branch started from `auth-and-dashboards` at `dee5723fb4ab3e1c6dffccfd21d70e4d42d6d7b3` and merged `origin/main` at `c3ffba79b03d1bc86c811760e17827dec293e983`.

## Agreed decisions

- Keep main's `users` table and `user_role` enum. Learners use `STUDENT`; mentors use `INSTRUCTOR`; `ADMIN` is also authorized for mentor-only procedures.
- Add nullable `password_hash`; account creation always writes a bcrypt hash at cost 12. Login rejects accounts without a hash using the same generic invalid-credentials response.
- Keep required, unique `username`. Signup normalizes by trimming and lowercasing, then validates 3-30 characters from `a-z`, `0-9`, and underscore. Duplicate usernames are reported from the database unique-constraint violation, without an existence check.
- Store the optional display name in `display_name`. Auth profiles expose `id`, `username`, `displayName`, `email`, `role`, `avatarUrl`, and `createdAt`.
- Preserve main's migrations through `0002_futuristic_ironclad`; remove the old auth-branch `0001_damp_madame_hydra` migration. New migration `0003_loose_captain_cross.sql` adds only `sessions` and nullable `users.password_hash`.
- Use one shared `apps/api/src/trpc.ts` and one `ApiContext`. All context properties remain optional for existing router callers; it retains `authorization` and `testCaseStore` while adding the session identity and response headers.
- Test-case administration is protected by `mentorProcedure`; it permits `INSTRUCTOR` and `ADMIN`. No token-based fallback remains.
- Keep invite-code checks before database access, constant-time SHA-256 digest comparison, generic login failures, and the existing HttpOnly/SameSite/Path cookie settings (Secure only in production).

## Completed

- Merged the latest `origin/main`, retaining its database tables, evaluation/harness implementation, test-case admin router, and migration history.
- Ported login, learner registration, invite-gated mentor registration, logout, session validation, and `auth.me` to main's schema and role values.
- Added `MENTOR_USERNAME` to the mentor creation script configuration.
- Updated registration UI with a username field and dashboards with `@username`; role checks recognize `STUDENT`, `INSTRUCTOR`, and `ADMIN`.
- Replaced test-case admin authorization tests with injected mentor/learner contexts. Evaluation, harness, and secure-evaluation test files from main remain unchanged.
- Updated the root `.env.example` with mentor username and invite-code settings.

## Remaining / not performed

- The generated migration has not been applied. Do not apply it until the local database has been backed up/reset by its owner.
- Real database-backed registration, login, cookies, and `auth.me` have not been manually tested.
- Out of scope: submission persistence, contest ownership, mentor/learner linking, real dashboard data, and `/admin/register`.

## Local database test steps

After backing up any wanted local data, the repository owner can reset the local database using their chosen local Postgres reset method, then run `pnpm.cmd db:migrate`. Set `MENTOR_USERNAME`, `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD` in the root `.env` before `pnpm.cmd create-mentor`; set `MENTOR_INVITE_CODE` to a private value at least 16 characters long to enable invited mentor registration. Then start the API and web app and test learner registration, mentor login, the session cookie, and `auth.me`. No reset or migration command was run during this integration.
