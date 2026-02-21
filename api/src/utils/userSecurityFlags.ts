import { pool } from "../db";

let ensureTablePromise: Promise<void> | null = null;

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_security_flags (
      user_id INTEGER PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
}

export async function ensureUserSecurityFlagsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = ensureTable().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }
  await ensureTablePromise;
}

export async function setForcePasswordChange(userId: number, force: boolean) {
  await ensureUserSecurityFlagsTable();
  await pool.query(
    `
      INSERT INTO user_security_flags (user_id, force_password_change, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET force_password_change = EXCLUDED.force_password_change, updated_at = NOW()
    `,
    [userId, force]
  );
}

export async function getForcePasswordChange(userId: number) {
  await ensureUserSecurityFlagsTable();
  const result = await pool.query<{ force_password_change: boolean }>(
    `SELECT force_password_change FROM user_security_flags WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.force_password_change ?? false;
}

