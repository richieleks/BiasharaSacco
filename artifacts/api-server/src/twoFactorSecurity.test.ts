import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import * as OTPAuth from "otpauth";
import { createChallenge, verifyChallenge, authorizeDisable, personalSettingsSchema, CHALLENGE_TTL, MAX_ATTEMPTS } from "./twoFactorSecurity";
import { PostgresTwoFactorStore } from "./twoFactorStore";

const secret = new OTPAuth.Secret({ size: 20 }).base32;
const now = Date.now();
const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
const codeAt = (timestamp: number) => totp.generate({ timestamp });

// No fixture touches application users or public tables. Each connection is confined
// to a fresh schema, and distinct pools simulate separate processes.
async function withIsolatedGuards(run: (stores: PostgresTwoFactorStore[], pools: Pool[], schema: string) => Promise<void>) {
  const schema = `two_factor_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  const pools: Pool[] = [];
  let created = false;
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    // Match lib/db/src/schema/two-factor-guards.ts, including its expiry index.
    await admin.query(`CREATE TABLE "${schema}".two_factor_guards (
      key text PRIMARY KEY,
      attempts integer NOT NULL,
      expires_at bigint NOT NULL,
      consumed boolean NOT NULL
    )`);
    await admin.query(`CREATE INDEX two_factor_guards_expiry_idx ON "${schema}".two_factor_guards (expires_at)`);
    for (let i = 0; i < 3; i++) {
      pools.push(new Pool({
        connectionString: process.env.DATABASE_URL,
        options: `-c search_path=${schema}`,
        max: 12,
      }));
    }
    const stores = pools.map((pool) => new PostgresTwoFactorStore(pool));
    await run(stores, pools, schema);
  } finally {
    await Promise.all(pools.map((pool) => pool.end()));
    try {
      if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  }
}

test("login and enrollment challenges admit exactly one concurrent proof across servers", { skip: !process.env.DATABASE_URL }, async () => {
  await withIsolatedGuards(async (stores, pools, schema) => {
    for (const enrollment of [false, true]) {
      const user = `synthetic-${randomUUID()}`;
      const challenge = createChallenge(user, enrollment ? secret : undefined, now);
      if (enrollment) assert.equal(challenge.secret, secret);
      assert.equal(await verifyChallenge(undefined, user, secret, codeAt(now), now, stores[0]), false);
      assert.equal(await verifyChallenge({ ...challenge }, "wrong-user", secret, codeAt(now), now, stores[0]), false);
      assert.equal(await verifyChallenge({ ...challenge }, user, secret, codeAt(now), challenge.expiresAt, stores[0]), false);
      const results = await Promise.all(Array.from({ length: 24 }, (_, i) =>
        verifyChallenge({ ...challenge }, user, secret, codeAt(now), now, stores[i % stores.length])));
      assert.equal(results.filter(Boolean).length, 1, `${enrollment ? "enrollment" : "login"} must only succeed once`);
      const row = await pools[0].query<{ attempts: number; consumed: boolean }>(
        "SELECT attempts, consumed FROM two_factor_guards WHERE key = $1", [`challenge:${challenge.id}`]);
      assert.deepEqual(row.rows, [{ attempts: 1, consumed: true }]);
      // A new pool/store is a restart, not a way to reuse a consumed session copy.
      const restarted = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
      try {
        assert.equal(await verifyChallenge({ ...challenge }, user, secret, codeAt(now), now, new PostgresTwoFactorStore(restarted)), false);
      } finally {
        await restarted.end();
      }
    }
  });
});

test("mixed invalid and valid concurrent challenge attempts cannot exceed the cap", { skip: !process.env.DATABASE_URL }, async () => {
  await withIsolatedGuards(async (stores, pools, schema) => {
    const user = `synthetic-${randomUUID()}`;
    const challenge = createChallenge(user, undefined, now);
    assert.deepEqual(await Promise.all(Array.from({ length: MAX_ATTEMPTS - 1 }, (_, i) =>
      verifyChallenge({ ...challenge }, user, secret, "invalid", now, stores[i % stores.length]))), Array(MAX_ATTEMPTS - 1).fill(false));
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      verifyChallenge({ ...challenge }, user, secret, i % 3 === 0 ? "invalid" : codeAt(now), now, stores[i % stores.length])));
    assert.ok(results.filter(Boolean).length <= 1);
    const row = await pools[0].query<{ attempts: number; consumed: boolean }>(
      "SELECT attempts, consumed FROM two_factor_guards WHERE key = $1", [`challenge:${challenge.id}`]);
    assert.equal(row.rows[0].attempts, MAX_ATTEMPTS);
    assert.equal(row.rows[0].consumed, results.includes(true));
    const restarted = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
    try {
      assert.equal(await verifyChallenge({ ...challenge }, user, secret, codeAt(now), now, new PostgresTwoFactorStore(restarted)), false);
      // An exhausted challenge must stay exhausted even when no caller has an updated session copy.
      const exhausted = createChallenge(user, undefined, now);
      await Promise.all(Array.from({ length: MAX_ATTEMPTS }, (_, i) =>
        verifyChallenge({ ...exhausted }, user, secret, "invalid", now, stores[i % stores.length])));
      assert.equal(await verifyChallenge({ ...exhausted }, user, secret, codeAt(now), now, new PostgresTwoFactorStore(restarted)), false);
    } finally {
      await restarted.end();
    }
  });
});

test("disable cap is account-bound across instances and resets at the expiry boundary", { skip: !process.env.DATABASE_URL }, async () => {
  await withIsolatedGuards(async (stores, pools, schema) => {
    const user = `synthetic-${randomUUID()}`;
    const invalid = await Promise.all(Array.from({ length: MAX_ATTEMPTS - 1 }, (_, i) =>
      authorizeDisable(user, secret, null, now, stores[i % stores.length])));
    assert.deepEqual(invalid, Array(MAX_ATTEMPTS - 1).fill(false));
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      authorizeDisable(user, secret, i % 4 === 0 ? "invalid" : codeAt(now), now, stores[i % stores.length])));
    assert.ok(results.filter(Boolean).length <= 1);
    const row = await pools[0].query<{ attempts: number; expires_at: string }>(
      "SELECT attempts, expires_at FROM two_factor_guards WHERE key = $1", [`disable:${user}`]);
    assert.equal(row.rows[0].attempts, MAX_ATTEMPTS);
    assert.equal(Number(row.rows[0].expires_at), now + CHALLENGE_TTL);
    assert.equal(await authorizeDisable(user, secret, codeAt(now + CHALLENGE_TTL - 1), now + CHALLENGE_TTL - 1, stores[1]), false);
    assert.equal(await authorizeDisable(`other-${user}`, secret, codeAt(now), now, stores[2]), true);
    const restarted = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
    try {
      const newStore = new PostgresTwoFactorStore(restarted);
      assert.equal(await authorizeDisable(user, secret, codeAt(now + CHALLENGE_TTL - 1), now + CHALLENGE_TTL - 1, newStore), false);
      assert.equal(await authorizeDisable(user, secret, codeAt(now + CHALLENGE_TTL), now + CHALLENGE_TTL, newStore), true);
      const renewed = await restarted.query<{ attempts: number; expires_at: string }>(
        "SELECT attempts, expires_at FROM two_factor_guards WHERE key = $1", [`disable:${user}`]);
      assert.equal(renewed.rows[0].attempts, 1);
      assert.equal(Number(renewed.rows[0].expires_at), now + 2 * CHALLENGE_TTL);
    } finally {
      await restarted.end();
    }
  });
});

test("guard database errors never authorize a valid proof", { skip: !process.env.DATABASE_URL }, async () => {
  await withIsolatedGuards(async (stores, pools, schema) => {
    await pools[0].query(`DROP TABLE "${schema}".two_factor_guards`);
    const challenge = createChallenge(`synthetic-${randomUUID()}`, undefined, now);
    await assert.rejects(verifyChallenge(challenge, challenge.userId, secret, codeAt(now), now, stores[1]), /two_factor_guards/);
    await assert.rejects(authorizeDisable(challenge.userId, secret, codeAt(now), now, stores[2]), /two_factor_guards/);
  });
});

test("personal PATCH schema accepts only bounded typed settings", () => {
  for (const invalid of [{ autoLogout: 14 }, { autoLogout: 481 }, { autoLogout: 15.5 }, { autoLogout: "120" }, { emailNotifications: "false" }, { theme: "pink" }, { language: "xx" }, { twoFactorEnabled: false }]) {
    assert.equal(personalSettingsSchema.safeParse(invalid).success, false);
  }
  for (const valid of [{}, { autoLogout: 15 }, { autoLogout: 480 }, { theme: "dark", language: "sw", emailNotifications: false }]) {
    assert.equal(personalSettingsSchema.safeParse(valid).success, true);
  }
});