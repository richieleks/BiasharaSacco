# Shared two-factor guards

Before starting servers running this version, run:

```sh
pnpm --filter @workspace/api-server run migrate:two-factor
```

This additive, repeatable migration creates only the guard table and expiry index.
The table is also represented in the shared Drizzle schema for normal schema
management. All instances must use the same PostgreSQL database.
Database errors reject verification; there is no in-memory fallback.

For the first rollout from process-local guards, stop all old instances and wait
at least five minutes before starting the new version. This lets outstanding
challenges and disable-attempt windows expire: consumed challenges and attempts
held only in the old processes cannot be recovered from session storage. Do not
mix old and new versions during this transition.

Run `pnpm --filter @workspace/api-server run test:two-factor` with the development
database configured. Tests create unique schemas and independent connection
pools, and remove only their own fixtures. They do not edit users or policies.

Expired rows are not yet automatically deleted. They cannot authorize expired
challenges, and disable windows reset atomically on the next attempt. Any future
cleanup must retain challenge tombstones through expiry and account for in-flight
requests; deleting live rows reopens replay and attempt-limit bypasses.