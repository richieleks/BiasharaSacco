import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { z } from "zod";

export const CHALLENGE_TTL = 5 * 60_000;
export const MAX_ATTEMPTS = 5;
export interface TwoFactorChallenge {
  id: string;
  userId: string;
  expiresAt: number;
  attempts: number;
  secret?: string;
}

// Also guard against concurrently loaded copies of the same session.
const attempts = new Map<string, { count: number; expiresAt: number; consumed: boolean }>();
export function createChallenge(userId: string, secret?: string, now = Date.now()): TwoFactorChallenge {
  return { id: randomUUID(), userId, expiresAt: now + CHALLENGE_TTL, attempts: 0, ...(secret ? { secret } : {}) };
}

export function verifyChallenge(challenge: TwoFactorChallenge | undefined, userId: string, secret: string, code: unknown, now = Date.now()): boolean {
  if (!challenge || challenge.userId !== userId || challenge.expiresAt <= now || challenge.attempts >= MAX_ATTEMPTS) return false;
  for (const [key, value] of attempts) if (value.expiresAt <= now) attempts.delete(key);
  const state = attempts.get(challenge.id) ?? { count: challenge.attempts, expiresAt: challenge.expiresAt, consumed: false };
  if (state.consumed || state.count >= MAX_ATTEMPTS) return false;
  state.count++;
  challenge.attempts = state.count;
  attempts.set(challenge.id, state);
  if (!validateTotp(secret, code, now)) return false;
  state.consumed = true;
  return true;
}

export function validateTotp(secret: string, code: unknown, now = Date.now()): boolean {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  try {
    const totp = new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
    return totp.validate({ token: code, window: 1, timestamp: now }) !== null;
  } catch {
    return false;
  }
}

// Account-bound limit cannot be reset by obtaining another session.
const disableAttempts = new Map<string, { count: number; expiresAt: number }>();
export function authorizeDisable(userId: string, secret: string, code: unknown, now = Date.now()): boolean {
  for (const [key, value] of disableAttempts) if (value.expiresAt <= now) disableAttempts.delete(key);
  const state = disableAttempts.get(userId) ?? { count: 0, expiresAt: now + CHALLENGE_TTL };
  if (state.count >= MAX_ATTEMPTS) return false;
  state.count++;
  disableAttempts.set(userId, state);
  return validateTotp(secret, code, now);
}

export const personalSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  browserNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  loanUpdates: z.boolean().optional(),
  paymentReminders: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
  language: z.enum(["en", "sw"]).optional(),
  soundEnabled: z.boolean().optional(),
  autoLogout: z.number().int().min(15).max(480).optional(),
}).strict();