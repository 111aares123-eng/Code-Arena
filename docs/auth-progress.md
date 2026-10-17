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

## Decided

- Anonymous and invalid sessions use `role: null`.
- Mentor procedures require an authenticated session and the `mentor` role.

## Next

- Verify register, cookie issuance, and `auth.me` against a running API and database.
- Run the API typecheck and test suite after each remaining task, then commit.
