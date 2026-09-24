import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { z } from "zod";
import { pool } from "@workspace/db";
import { PostgresTwoFactorStore } from "./twoFactorStore";

export const CHALLENGE_TTL = 5 * 60_000;
export const MAX_ATTEMPTS = 5;
export interface TwoFactorChallenge {
  id: string;
  userId: string;
  expiresAt: number;
  attempts: number;
  secret?: string;
}

const sharedStore = new PostgresTwoFactorStore(pool);
export function createChallenge(userId: string, secret?: string, now = Date.now()): TwoFactorChallenge {
  return { id: randomUUID(), userId, expiresAt: now + CHALLENGE_TTL, attempts: 0, ...(secret ? { secret } : {}) };
}

export async function verifyChallenge(challenge: TwoFactorChallenge | undefined, userId: string, secret: string, code: unknown, now = Date.now(), store = sharedStore): Promise<boolean> {
  if (!challenge || challenge.userId !== userId || challenge.expiresAt <= now || challenge.attempts >= MAX_ATTEMPTS) return false;
  const valid = validateTotp(secret, code, now);
  const count = await store.attempt(`challenge:${challenge.id}`, challenge.expiresAt, now, MAX_ATTEMPTS, valid, true, challenge.attempts);
  if (count === undefined) return false;
  challenge.attempts = count;
  return valid;
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
export async function authorizeDisable(userId: string, secret: string, code: unknown, now = Date.now(), store = sharedStore): Promise<boolean> {
  const valid = validateTotp(secret, code, now);
  const count = await store.attempt(`disable:${userId}`, now + CHALLENGE_TTL, now, MAX_ATTEMPTS, valid, false);
  return count !== undefined && valid;
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