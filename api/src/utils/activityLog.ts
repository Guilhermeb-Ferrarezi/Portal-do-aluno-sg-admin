import { pool } from "../db";
import type { AuthRequest } from "../middlewares/auth";

type ActivityLogParams = {
  actorId: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | string[] | null;
  metadata?: unknown;
  req?: AuthRequest;
};

export async function logActivity(params: ActivityLogParams) {
  const {
    actorId,
    actorRole = null,
    action,
    entityType,
    entityId = null,
    metadata = null,
    req,
  } = params;

  const normalizedEntityId = Array.isArray(entityId) ? entityId[0] : entityId;

  const forwarded = req?.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" && forwarded.split(",")[0]?.trim()) ||
    (req as any)?.ip ||
    (req as any)?.socket?.remoteAddress ||
    null;
  const userAgent = (req?.headers["user-agent"] as string | undefined) ?? null;

  await pool.query(
    `INSERT INTO activity_logs
      (actor_id, actor_role, action, entity_type, entity_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      actorId,
      actorRole,
      action,
      entityType,
      normalizedEntityId,
      metadata ? JSON.stringify(metadata) : null,
      ip,
      userAgent,
    ]
  );
}
