# Auth integration progress

## Done

- Added a shared tRPC context with authenticated user role data.
- Added shared public, protected, and mentor procedures.
- Loaded the session user's role when validating a session.
- Wired the API root and problem, execution, and auth routers to the shared tRPC instance.

## Decided

- Anonymous and invalid sessions use `role: null`.
- Mentor procedures require an authenticated session and the `mentor` role.

## Next

- Connect Hono's request context and response headers to auth procedures.
- Enable credentialed CORS and production-only secure session cookies.
- Run the API typecheck and test suite after each remaining task, then commit.
