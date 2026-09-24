import type { RequestHandler } from "express";
import type { storage } from "./storage";

type PolicyStorage = Pick<typeof storage,
  "getUser" | "getMemberByUserId" | "getAllSystemSettings" | "getUserSettings">;

export function timeoutMinutes(value: unknown, fallback: number): number {
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= Number.MAX_SAFE_INTEGER / 60_000
    ? parsed : fallback;
}

export function effectiveTimeoutMs(admin: unknown, personal: unknown): number {
  return Math.min(timeoutMinutes(admin, 240), timeoutMinutes(personal, 120)) * 60_000;
}

export function enrollmentRouteAllowed(method: string, path: string, mustChangePassword: boolean): boolean {
  if (method === "GET" && ["/api/auth/user", "/api/auth/password-requirements", "/api/logout"].includes(path)) return true;
  if (method !== "POST") return false;
  return ["/api/auth/2fa/setup", "/api/auth/2fa/verify", "/api/auth/logout"].includes(path)
    || (mustChangePassword && path === "/api/auth/change-password");
}

// Only the activity-driven heartbeat renews idle time. GET polling, query
// refetches, and background mutations must not keep an unattended session alive.
export function isActivityHeartbeat(method: string, path: string): boolean {
  return method === "POST" && path === "/api/auth/heartbeat";
}

export function createLocalSessionGuard(policyStorage: PolicyStorage, clock = Date.now): RequestHandler {
  return async (req, res, next) => {
    const session = req.session as typeof req.session & {
      lastActivity?: number;
      twoFactorVerified?: boolean;
    };
    const rejectSession = (message: string, code: string) => {
      req.session.destroy((error) => {
        res.clearCookie("connect.sid");
        if (error) {
          res.status(503).json({ message: "Unable to invalidate session. Please try again.", code: "SESSION_STORE_UNAVAILABLE" });
          return;
        }
        res.status(401).json({ message, code });
      });
    };

    try {
      const userId = (req.user as { id?: string } | undefined)?.id;
      if (!userId) return rejectSession("Unauthorized", "UNAUTHORIZED");
      const currentUser = await policyStorage.getUser(userId);
      if (!currentUser || currentUser.authMethod !== "local") {
        return rejectSession("Account is no longer available. Please log in again.", "ACCOUNT_UNAVAILABLE");
      }
      // These optional flags also support account disabling if added to the user
      // model. The current schema represents member status on the member record.
      const account = currentUser as typeof currentUser & { enabled?: boolean; isActive?: boolean };
      if (account.enabled === false || account.isActive === false) {
        return rejectSession("Your account has been disabled.", "ACCOUNT_DISABLED");
      }
      if (!["admin", "manager", "committee", "treasurer"].includes(currentUser.role ?? "")
          && currentUser.userType !== "system") {
        const member = await policyStorage.getMemberByUserId(userId);
        if (member && ["inactive", "suspended", "rejected", "exited"].includes(member.status ?? "")) {
          return rejectSession("Your membership is not active. Please contact the administrator.", "ACCOUNT_DISABLED");
        }
      }

      const [settings, personalJson] = await Promise.all([
        policyStorage.getAllSystemSettings(),
        policyStorage.getUserSettings(userId),
      ]);
      const adminTimeout = settings.find(s => s.settingKey === "sessionTimeout")?.settingValue;
      const twoFactorRequired = settings.find(s => s.settingKey === "twoFactorRequired")?.settingValue === "true";
      let personalTimeout: unknown;
      if (personalJson !== null) {
        // Invalid JSON is a policy integrity error, not permission to continue.
        personalTimeout = JSON.parse(personalJson)?.autoLogout;
      }
      const now = clock();
      if (typeof session.lastActivity !== "number" || !Number.isFinite(session.lastActivity)
          || session.lastActivity > now || now - session.lastActivity >= effectiveTimeoutMs(adminTimeout, personalTimeout)) {
        return rejectSession("Session expired due to inactivity. Please log in again.", "SESSION_EXPIRED");
      }

      // Never trust a stale serialized user for permissions or security state.
      const { password: _password, twoFactorSecret: _secret, ...safeUser } = currentUser;
      req.user = safeUser;

      // A pre-existing password-only session cannot become a verified session
      // just because 2FA was enabled in another browser.
      if (currentUser.twoFactorEnabled && session.twoFactorVerified !== true) {
        return rejectSession("Please log in again and complete two-factor authentication.", "TWO_FACTOR_VERIFICATION_REQUIRED");
      }
      const path = req.originalUrl.split("?")[0].replace(/\/+$/, "");
      if (twoFactorRequired && !currentUser.twoFactorEnabled
          && !enrollmentRouteAllowed(req.method, path, currentUser.mustChangePassword === true)) {
        res.status(403).json({
          message: "Set up two-factor authentication to continue.",
          code: "TWO_FACTOR_SETUP_REQUIRED",
          mustSetup2FA: true,
        });
        return;
      }
      if (isActivityHeartbeat(req.method, path)) session.lastActivity = now;
      next();
    } catch (error) {
      console.error("Unable to enforce session security policy", error);
      res.status(503).json({
        message: "Security policy is temporarily unavailable. Please try again.",
        code: "SECURITY_POLICY_UNAVAILABLE",
      });
    }
  };
}