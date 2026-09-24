import { test } from "node:test";
import assert from "node:assert/strict";
import * as OTPAuth from "otpauth";
import { createChallenge, verifyChallenge, authorizeDisable, personalSettingsSchema, CHALLENGE_TTL, MAX_ATTEMPTS } from "./twoFactorSecurity";

const secret = new OTPAuth.Secret({ size: 20 }).base32;
const now = Date.now();
const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate({ timestamp: now });

test("login proof requires a password-created, user-bound, unexpired challenge", () => {
  assert.equal(verifyChallenge(undefined, "user", secret, code, now), false);
  const challenge = createChallenge("user", undefined, now);
  assert.equal(verifyChallenge(challenge, "other", secret, code, now), false);
  assert.equal(verifyChallenge(challenge, "user", secret, code, now + CHALLENGE_TTL), false);
  assert.equal(verifyChallenge(challenge, "user", secret, code, now), true);
  assert.equal(verifyChallenge({ ...challenge, attempts: 0 }, "user", secret, code, now), false);
});

test("challenge failures are bounded even with concurrently loaded session copies", () => {
  const challenge = createChallenge("user", undefined, now);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    assert.equal(verifyChallenge({ ...challenge }, "user", secret, "invalid", now), false);
  }
  assert.equal(verifyChallenge(challenge, "user", secret, code, now), false);
});

test("enrollment secret remains pending and requires proof before one-use completion", () => {
  const pending = createChallenge("enrolling", secret, now);
  assert.equal(pending.secret, secret);
  assert.equal(verifyChallenge(pending, "wrong-user", pending.secret!, code, now), false);
  assert.equal(verifyChallenge(pending, "enrolling", pending.secret!, 123456, now), false);
  assert.equal(verifyChallenge(pending, "enrolling", pending.secret!, code, now), true);
  assert.equal(verifyChallenge(pending, "enrolling", pending.secret!, code, now), false);
  const expired = createChallenge("enrolling", secret, now - CHALLENGE_TTL);
  assert.equal(verifyChallenge(expired, "enrolling", secret, code, now), false);
});

test("disable attempts are account-bound and expire", () => {
  for (let i = 0; i < MAX_ATTEMPTS; i++) assert.equal(authorizeDisable("limited", secret, null, now), false);
  assert.equal(authorizeDisable("limited", secret, code, now), false);
  assert.equal(authorizeDisable("other", secret, code, now), true);
  const later = now + CHALLENGE_TTL;
  const laterCode = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate({ timestamp: later });
  assert.equal(authorizeDisable("limited", secret, laterCode, later), true);
});

test("personal PATCH schema accepts only bounded typed settings", () => {
  for (const invalid of [{ autoLogout: 14 }, { autoLogout: 481 }, { autoLogout: 15.5 }, { autoLogout: "120" }, { emailNotifications: "false" }, { theme: "pink" }, { language: "xx" }, { twoFactorEnabled: false }]) {
    assert.equal(personalSettingsSchema.safeParse(invalid).success, false);
  }
  for (const valid of [{}, { autoLogout: 15 }, { autoLogout: 480 }, { theme: "dark", language: "sw", emailNotifications: false }]) {
    assert.equal(personalSettingsSchema.safeParse(valid).success, true);
  }
});