---
name: Security policy enforcement
description: Rationale for idle activity and safe security-policy verification
---
Count explicit user-activity heartbeats, not background data requests, as session activity. Apply the stricter personal or administrator idle limit.

**Why:** The dashboard polls continuously; refreshing activity on every authenticated request would prevent idle sessions from expiring even when the user has left.

**How to apply:** Preserve this distinction when adding polling or realtime features. Test security policies with isolated accounts and mocked policy providers instead of changing shared SACCO-wide settings or existing users.

Supplemental two-factor replay and disable-attempt guards currently have a single-process assumption.

**Why:** Session persistence alone does not make simultaneous challenge consumption atomic across application instances.

**How to apply:** Before multi-instance scaling, move challenge consumption and attempt limits to shared atomic storage and verify concurrent requests across instances.