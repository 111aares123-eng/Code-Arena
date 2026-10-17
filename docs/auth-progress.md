# Auth integration progress

## Done

- Added a shared tRPC context with authenticated user role data.
- Added shared public, protected, and mentor procedures.
- Loaded the session user's role when validating a session.
- Wired the API root and problem, execution, and auth routers to the shared tRPC instance.
- Passed the adapter-provided request and response headers into the API context.
- Registered the auth router at the API root.
- Enabled credentialed CORS while retaining the explicit origin allowlist.
- Set the session cookie's Secure attribute only in production.
- Public registration accepts no role field and always stores new accounts as learners.
- Added a mentor creation script configured only through environment variables; existing accounts are never overwritten.
- Registration, login, and mentor creation trim and lowercase email addresses before use.
- Auth user IDs use `crypto.randomUUID()` and sessions use 32 random bytes encoded as base64url.
- Removed the unused `nanoid` and `@types/bcryptjs` API dependencies and regenerated the lockfile.
- Added public `auth.registerMentor`, gated by `MENTOR_INVITE_CODE` with constant-time digest comparison.
- Documented the invite-code environment variable in `apps/api/.env.example`.
- Added focused tests for enabled/disabled invite codes, duplicate emails, learner-only registration, session cookies, and mentor profile lookup.

## Decided

- Anonymous and invalid sessions use `role: null`.
- Mentor procedures require an authenticated session and the `mentor` role.
- Zod v4 object schemas strip unrecognized keys by default; a supplied registration `role` is ignored.
- Mentor account creation requires `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD` from the root environment file.
- Email normalization is consistently trim + lowercase in all account creation and login flows.
- Mentor signup checks the configured invite code before any database access; unset or short secrets disable the procedure. Both invite strings are SHA-256 hashed before constant-time comparison.

## Next

- Verify register, cookie issuance, and `auth.me` against a running API and database.
- Hardening backlog: login rate limiting, including the invite-code endpoint.
