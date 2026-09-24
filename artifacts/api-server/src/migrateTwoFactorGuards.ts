import { pool } from "@workspace/db";

// Additive migration only; do not push unrelated schema changes or touch users.
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS two_factor_guards (
      key text PRIMARY KEY,
      attempts integer NOT NULL,
      expires_at bigint NOT NULL,
      consumed boolean NOT NULL
    );
    CREATE INDEX IF NOT EXISTS two_factor_guards_expiry_idx
      ON two_factor_guards (expires_at);
  `);
} finally {
  await pool.end();
}