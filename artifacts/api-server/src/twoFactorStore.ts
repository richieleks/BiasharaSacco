import type { Pool } from "pg";

/** A single statement serializes contenders on the primary key, across servers. */
export class PostgresTwoFactorStore {
  constructor(private readonly pool: Pick<Pool, "query">) {}

  async attempt(key: string, expiresAt: number, now: number, limit: number, valid: boolean, singleUse: boolean, initialCount = 0): Promise<number | undefined> {
    const result = await this.pool.query<{ attempts: number }>(`
      INSERT INTO two_factor_guards AS guard (key, attempts, expires_at, consumed)
      VALUES ($1, $7 + 1, $2, $5 AND $6)
      ON CONFLICT (key) DO UPDATE SET
        attempts = CASE WHEN NOT $6 AND guard.expires_at <= $3 THEN 1 ELSE guard.attempts + 1 END,
        expires_at = CASE WHEN NOT $6 AND guard.expires_at <= $3 THEN $2 ELSE guard.expires_at END,
        consumed = $5 AND $6
      WHERE (NOT $6 AND guard.expires_at <= $3)
         OR (NOT guard.consumed AND guard.attempts < $4 AND guard.expires_at > $3)
      RETURNING attempts
    `, [key, expiresAt, now, limit, valid, singleUse, initialCount]);
    return result.rows[0]?.attempts;
  }
}