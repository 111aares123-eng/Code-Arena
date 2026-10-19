# Auth integration progress

## Done

- Merged the current `origin/main` database and API work into the auth branch; main's tables, role enum, and migration history are retained.
- Added nullable `users.password_hash` and a `sessions` table in generated migration `0003_loose_captain_cross.sql`; the migration has not been applied.
- Added a shared tRPC context with authenticated user role data.
- Added shared public, protected, and mentor procedures.
- Loaded the session user's role when validating a session.
- Wired the API root and problem, execution, test-case-admin, and auth routers to the shared tRPC instance.
- Passed the adapter-provided request and response headers into the API context.
- Registered the auth router at the API root.
- Enabled credentialed CORS while retaining the explicit origin allowlist.
- Set the session cookie's Secure attribute only in production.
- Public registration requires a username and always stores new accounts as `STUDENT`; invited mentor registration stores `INSTRUCTOR`.
- Usernames are trimmed, lowercased, and validated as 3-30 lowercase letters, digits, or underscores. Duplicate username/email conflicts are mapped from database unique-constraint errors.
- Added a mentor creation script configured only through `MENTOR_USERNAME`, `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD`.
- Registration, login, and mentor creation trim and lowercase email addresses before use.
- Auth user IDs use `crypto.randomUUID()` and sessions use 32 random bytes encoded as base64url.
- Removed the unused `nanoid` and `@types/bcryptjs` API dependencies and regenerated the lockfile.
- Added public `auth.registerMentor`, gated by `MENTOR_INVITE_CODE` with constant-time digest comparison.
- Login rejects null password hashes with the same generic invalid-credentials error as other login failures.
- Replaced test-case admin authorization with `mentorProcedure`, allowing `INSTRUCTOR` and `ADMIN`.
- Added focused tests for enabled/disabled invite codes, duplicate emails, learner-only registration, session cookies, and mentor profile lookup.

## Decided

- Anonymous and invalid sessions use `role: null`.
- Learners have role `STUDENT`; mentors have role `INSTRUCTOR`; `ADMIN` is also permitted for mentor-only procedures.
- Zod v4 object schemas strip unrecognized keys by default; a supplied registration `role` is ignored.
- Mentor account creation requires `MENTOR_USERNAME`, `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD` from the root environment file.
- Email normalization is consistently trim + lowercase in all account creation and login flows.
- Mentor signup checks the configured invite code before any database access; unset or short secrets disable the procedure. Both invite strings are SHA-256 hashed before constant-time comparison.

## Next

- Verify register, cookie issuance, and `auth.me` against a running API and database.

## Frontend auth

- Added learner login and registration pages plus a public mentor login page; mentor self-registration is not offered.
- Navbar shows registration/login links when signed out and account/dashboard/logout controls when signed in.
- Learner and mentor dashboards show the authenticated profile and empty "Coming soon" sections without sample metrics or submissions data.
- Both login pages check the logged-in account role, log out mismatches, and direct the user to the correct login page.
- Restyled learner and mentor auth pages and placeholder dashboards to match CodeArena's dark indigo/violet visual language, with responsive layouts, profile initials, and locked "Coming soon" tiles.

## Route protection

- Protected App Router pages validate the HttpOnly session by calling `auth.me` server-side and redirect based on the returned role. `STUDENT` users access `/dashboard`; `INSTRUCTOR` and `ADMIN` users access `/admin`. Login and registration pages use the same server check to redirect signed-in users.
- This uses Next.js server-rendered page checks rather than Proxy: the session cookie is opaque and contains no role to check optimistically, while the installed Next.js authentication guide recommends secure checks close to protected pages/data and avoiding database checks in Proxy.
- Navbar authentication state is rendered server-side from the same `auth.me` session lookup; signing out calls the API and refreshes navigation.
- Request-time auth lookups are isolated under Suspense boundaries, following the installed Next.js 16 Cache Components guidance so unrelated static content can prerender and protected routes stream safely.

## Deployment note

- In production, deploy the web app and API under the same parent domain so the API's HttpOnly `session` cookie is available to both browser requests and server-side session checks.
- Hardening backlog: login rate limiting, including the invite-code endpoint.
- Local DB-backed auth verification is pending. The generated migration must be applied only after the database owner resets their local database.
