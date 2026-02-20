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
  if (!actorId) return;

  const forwarded = req?.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" && forwarded.split(",")[0]?.trim()) ||
    (req as any)?.ip ||
    (req as any)?.socket?.remoteAddress ||
    null;
  const userAgent = (req?.headers["user-agent"] as string | undefined) ?? null;

  const messageParts: string[] = [];
  if (normalizedEntityId) {
    messageParts.push(`entityId=${normalizedEntityId}`);
  }
  if (actorRole) {
    messageParts.push(`actorRole=${actorRole}`);
  }
  if (ip) {
    messageParts.push(`ip=${ip}`);
  }
  if (metadata) {
    try {
      messageParts.push(`metadata=${JSON.stringify(metadata)}`);
    } catch {
      messageParts.push("metadata=[unserializable]");
    }
  }
  if (userAgent) {
    messageParts.push(`ua=${userAgent}`);
  }

  const message =
    messageParts.length > 0
      ? messageParts.join(" | ").slice(0, 4000)
      : `${action} em ${entityType}`;

  await pool.query(
    `INSERT INTO logs
      (user_id, "Message", action, entity_name, "LogDate")
     VALUES ($1, $2, $3, $4, NOW())`,
    [Number(actorId), message, action, entityType]
  );
}
