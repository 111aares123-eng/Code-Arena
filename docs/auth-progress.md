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

## Decided

- Anonymous and invalid sessions use `role: null`.
- Mentor procedures require an authenticated session and the `mentor` role.
- Zod v4 object schemas strip unrecognized keys by default; a supplied registration `role` is ignored.
- Mentor account creation requires `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD` from the root environment file.
- Email normalization is consistently trim + lowercase in all account creation and login flows.

## Next

- Replace nanoid with Node's crypto APIs for account and session identifiers and remove obsolete dependency entries.
- Verify register, cookie issuance, and `auth.me` against a running API and database.
