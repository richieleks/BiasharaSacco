---
name: Security policy enforcement
description: Rationale for idle activity and safe security-policy verification
---
Count explicit user-activity heartbeats, not background data requests, as session activity. Apply the stricter personal or administrator idle limit.

**Why:** The dashboard polls continuously; refreshing activity on every authenticated request would prevent idle sessions from expiring even when the user has left.

**How to apply:** Preserve this distinction when adding polling or realtime features. Test security policies with isolated accounts and mocked policy providers instead of changing shared SACCO-wide settings or existing users.

Do not use rolling overlap when first migrating process-local two-factor guards to shared storage. Drain the old fleet and allow its five-minute challenge/attempt windows to expire.

**Why:** Session persistence alone does not record atomic consumption, and old process-local consumed challenges and attempt counts cannot be reconstructed after restart.

**How to apply:** Follow the two-factor storage rollout instructions for the first shared-storage deployment; verify concurrency with isolated database fixtures, never real accounts.