import { pool } from "../db";

const HEARTBEAT_PERSIST_INTERVAL_MS = 25_000;

const lastPersistByUserId = new Map<string, number>();
const lastSeenAtByUserId = new Map<string, string>();

export async function persistUserLastSeen(userId: string, force = false) {
  const now = Date.now();
  const lastPersist = lastPersistByUserId.get(userId) ?? 0;
  if (!force && now - lastPersist < HEARTBEAT_PERSIST_INTERVAL_MS) {
    return null;
  }

  lastPersistByUserId.set(userId, now);

  const result = await pool.query<{ last_seen_at: string | null }>(
    `UPDATE "user"
     SET last_seen_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING last_seen_at`,
    [Number(userId)]
  );

  const lastSeenAt = result.rows[0]?.last_seen_at ?? new Date(now).toISOString();
  lastSeenAtByUserId.set(userId, lastSeenAt);
  return lastSeenAt;
}

export function getKnownLastSeenAt(userId: string) {
  return lastSeenAtByUserId.get(userId) ?? new Date().toISOString();
}
