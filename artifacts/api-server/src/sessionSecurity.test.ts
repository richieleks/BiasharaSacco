import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { createLocalSessionGuard, effectiveTimeoutMs, enrollmentRouteAllowed } from "./sessionSecurity";

const NOW = 10_000_000;

async function request(options: {
  admin?: string; personal?: string | null; required?: boolean; enrolled?: boolean;
  verified?: boolean; lastActivity?: number | null; method?: string; path?: string;
  storageFails?: boolean; missingUser?: boolean; memberStatus?: string; mustChangePassword?: boolean;
} = {}) {
  let destroyed = false;
  let continued = false;
  let status = 200;
  let body: any;
  const freshUser = {
    id: "test-user", authMethod: "local", role: "member", userType: "member",
    twoFactorEnabled: options.enrolled ?? false, password: "not-returned", twoFactorSecret: "not-returned",
    mustChangePassword: options.mustChangePassword ?? false,
  };
  const policyStorage = {
    getUser: async () => options.missingUser ? undefined : freshUser,
    getMemberByUserId: async () => ({ status: options.memberStatus ?? "active" }),
    getAllSystemSettings: async () => {
      if (options.storageFails) throw new Error("Test policy store unavailable");
      return [
        { settingKey: "sessionTimeout", settingValue: options.admin ?? "240" },
        { settingKey: "twoFactorRequired", settingValue: String(options.required ?? false) },
      ];
    },
    getUserSettings: async () => options.personal === undefined ? '{"autoLogout":120}' : options.personal,
  };
  const req = {
    user: { id: "test-user", role: "admin", twoFactorEnabled: false },
    method: options.method ?? "GET",
    originalUrl: options.path ?? "/api/loans",
    session: {
      lastActivity: options.lastActivity === null ? undefined : options.lastActivity ?? NOW - 100,
      twoFactorVerified: options.verified,
      pendingTwoFactor: { userId: "test-user" },
      destroy: (callback: (error?: Error) => void) => { destroyed = true; callback(); },
    },
  };
  const res = {
    status: (value: number) => { status = value; return res; },
    json: (value: unknown) => { body = value; return res; },
    clearCookie: () => res,
  };
  const guard = createLocalSessionGuard(policyStorage as unknown as Parameters<typeof createLocalSessionGuard>[0], () => NOW);
  await guard(req as unknown as Request, res as unknown as Response, () => { continued = true; });
  return { status, body, continued, destroyed, req };
}

test("effective timeout is the stricter valid policy with robust defaults", () => {
  assert.equal(effectiveTimeoutMs("240", 30), 30 * 60_000);
  assert.equal(effectiveTimeoutMs("15", 120), 15 * 60_000);
  for (const invalid of [undefined, null, 0, -1, Infinity, NaN, "", "12junk", true, "1e999"]) {
    assert.equal(effectiveTimeoutMs(invalid, invalid), 120 * 60_000);
    assert.equal(effectiveTimeoutMs(invalid, 300), 240 * 60_000);
  }
});

test("personal and administrator timeouts each expire idle sessions", async () => {
  for (const options of [{ admin: "1" }, { personal: '{"autoLogout":1}' }]) {
    const result = await request({ ...options, lastActivity: NOW - 60_000 });
    assert.equal(result.status, 401);
    assert.equal(result.body.code, "SESSION_EXPIRED");
    assert.equal(result.destroyed, true);
  }
});

test("missing, nonfinite, and future activity timestamps cannot bypass expiry", async () => {
  for (const lastActivity of [null, NaN, Infinity, NOW + 1]) {
    assert.equal((await request({ lastActivity })).body.code, "SESSION_EXPIRED");
  }
});

test("background requests never renew idle time; activity heartbeat does", async () => {
  for (const options of [{}, { path: "/api/auth/user" }, { method: "POST", path: "/api/background" }]) {
    const result = await request(options);
    assert.equal(result.continued, true);
    assert.equal(result.req.session.lastActivity, NOW - 100);
  }
  const heartbeat = await request({ method: "POST", path: "/api/auth/heartbeat" });
  assert.equal(heartbeat.req.session.lastActivity, NOW);
});

test("required enrollment blocks protected APIs but allows only the enrollment contract", async () => {
  for (const path of ["/api/loans", "/api/auth/settings", "/api/auth/2fa/disable", "/api/auth/users"]) {
    const result = await request({ required: true, path });
    assert.equal(result.status, 403);
    assert.equal(result.body.code, "TWO_FACTOR_SETUP_REQUIRED");
    assert.equal(result.continued, false);
  }
  for (const [method, path] of [
    ["GET", "/api/auth/user"], ["GET", "/api/auth/password-requirements"],
    ["POST", "/api/auth/2fa/setup"], ["POST", "/api/auth/2fa/verify"], ["POST", "/api/auth/logout"],
  ]) {
    assert.equal((await request({ required: true, method, path })).continued, true);
  }
  assert.equal(enrollmentRouteAllowed("POST", "/api/auth/change-password", false), false);
  assert.equal(enrollmentRouteAllowed("POST", "/api/auth/change-password", true), true);
  assert.equal(enrollmentRouteAllowed("PATCH", "/api/auth/user", true), false);
  assert.equal(enrollmentRouteAllowed("POST", "/api/auth/2fa/setup/anything", true), false);
});

test("enrolled users require a verified session even if global 2FA is optional", async () => {
  const denied = await request({ enrolled: true });
  assert.equal(denied.body.code, "TWO_FACTOR_VERIFICATION_REQUIRED");
  assert.equal(denied.destroyed, true);
  assert.equal((await request({ enrolled: true, verified: true })).continued, true);
});

test("fresh user permissions replace stale session permissions without secrets", async () => {
  const result = await request();
  assert.equal(result.req.user.role, "member");
  assert.equal("password" in result.req.user, false);
  assert.equal("twoFactorSecret" in result.req.user, false);
});

test("deleted users and disabled memberships invalidate sessions", async () => {
  assert.equal((await request({ missingUser: true })).destroyed, true);
  for (const memberStatus of ["inactive", "suspended", "rejected", "exited"]) {
    const result = await request({ memberStatus });
    assert.equal(result.body.code, "ACCOUNT_DISABLED");
    assert.equal(result.continued, false);
  }
});

test("policy storage failure and malformed stored JSON fail closed", async () => {
  for (const options of [{ storageFails: true }, { personal: "not-json" }]) {
    const result = await request(options);
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "SECURITY_POLICY_UNAVAILABLE");
    assert.equal(result.continued, false);
  }
});