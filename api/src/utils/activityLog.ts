import { pool } from "../db";
import type { AuthRequest } from "../middlewares/auth";

export type ActivityLogActor = {
  id: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | number | null;
};

type ActivityLogParams = {
  actor: ActivityLogActor;
  action: string;
  entityType: string;
  entityId?: string | string[] | null;
  // HTTP request/response data — each route provides its own
  method?: string;
  endpoint?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  statusCode?: number;
  responseTimeMs?: number;
  metadata?: unknown;
  req?: AuthRequest;
};

const SENSITIVE_KEYS = [
  "password",
  "senha",
  "token",
  "refreshToken",
  "refresh_token",
  "sharedSecret",
  "shared_secret",
  "authorization",
  "cookie",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return SENSITIVE_KEYS.some((k) => normalized.includes(k));
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSensitiveKey(key))
      .map(([key, val]) => [key, sanitize(val)])
  );
}

export async function logActivity(params: ActivityLogParams) {
  const {
    actor,
    action,
    entityType,
    entityId = null,
    method,
    endpoint,
    requestBody,
    responseBody,
    statusCode,
    responseTimeMs,
    metadata = null,
    req,
  } = params;

  const normalizedEntityId = Array.isArray(entityId) ? entityId[0] : entityId;

  const forwarded = req?.headers["x-forwarded-for"];
  const ipAddress =
    (typeof forwarded === "string" && forwarded.split(",")[0]?.trim()) ||
    (req as any)?.ip ||
    (req as any)?.socket?.remoteAddress ||
    null;
  const userAgent = (req?.headers["user-agent"] as string | undefined) ?? null;

  const resolvedMethod = method ?? req?.method ?? null;
  const resolvedEndpoint = endpoint ?? req?.path ?? null;

  const payload: Record<string, unknown> = { actor };
  if (normalizedEntityId) payload.entityId = normalizedEntityId;
  if (resolvedMethod) payload.method = resolvedMethod;
  if (resolvedEndpoint) payload.endpoint = resolvedEndpoint;
  if (requestBody !== undefined) payload.requestBody = sanitize(requestBody);
  if (responseBody !== undefined) payload.responseBody = sanitize(responseBody);
  if (statusCode !== undefined) payload.statusCode = statusCode;
  if (responseTimeMs !== undefined) payload.responseTimeMs = responseTimeMs;
  if (ipAddress) payload.ipAddress = ipAddress;
  if (userAgent) payload.userAgent = userAgent;
  if (metadata !== null) payload.metadata = sanitize(metadata);

  const message = JSON.stringify(payload).slice(0, 8000);

  await pool.query(
    `INSERT INTO logs (user_id, "Message", action, entity_name, "LogDate")
     VALUES ($1, $2, $3, $4, NOW())`,
    [actor.id ? Number(actor.id) : null, message, action, entityType]
  );
}
