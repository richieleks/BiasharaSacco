---
name: API TypeScript boundaries
description: Strict TypeScript rules for Express 5 route handlers and schema-derived database values.
---

Express 5 route and query values must be narrowed at the request boundary, and every response path in an async handler must terminate explicitly. Database filters and writes should use schema-derived literal unions rather than broad strings.

**Why:** Strict checking exposed that inferred `string | string[]` request values, nullable database columns, and mixed response fall-throughs can hide invalid lookups or double-send behavior.

**How to apply:** When adding API routes, validate scalar IDs before parsing or querying, handle nullable fields intentionally, and return after every response (including catch/error responses). Keep `noImplicitReturns` enabled.