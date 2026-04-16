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

function hasMeaningfulPayload(value: unknown) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
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
  const sanitizedMetadata = metadata !== null ? sanitize(metadata) : null;
  const metadataRecord = isRecord(sanitizedMetadata) ? sanitizedMetadata : null;
  const requestId =
    (metadataRecord?.requestId != null ? String(metadataRecord.requestId) : null) ??
    (req?.res ? req.res.getHeader("x-request-id")?.toString() ?? null : null);
  const route =
    (metadataRecord?.route != null ? String(metadataRecord.route) : null) ??
    (req?.originalUrl ? req.originalUrl.split("?")[0] : null) ??
    resolvedEndpoint;
  const outcome = metadataRecord?.outcome != null ? String(metadataRecord.outcome) : null;
  const errorType = metadataRecord?.errorType != null ? String(metadataRecord.errorType) : null;
  const source = metadataRecord?.source != null ? String(metadataRecord.source) : null;
  const contextArea =
    metadataRecord?.contextArea != null ? String(metadataRecord.contextArea) : null;
  const fallbackRequestBody =
    requestBody !== undefined
      ? requestBody
      : resolvedMethod && resolvedMethod !== "GET" && hasMeaningfulPayload(req?.body)
        ? req?.body
        : undefined;

  const payload: Record<string, unknown> = { actor };
  if (normalizedEntityId) payload.entityId = normalizedEntityId;
  if (resolvedMethod) payload.method = resolvedMethod;
  if (resolvedEndpoint) payload.endpoint = resolvedEndpoint;
  if (route) payload.route = route;
  if (requestId) payload.requestId = requestId;
  if (outcome) payload.outcome = outcome;
  if (errorType) payload.errorType = errorType;
  if (source) payload.source = source;
  if (contextArea) payload.contextArea = contextArea;
  if (fallbackRequestBody !== undefined) payload.requestBody = sanitize(fallbackRequestBody);
  if (responseBody !== undefined) payload.responseBody = sanitize(responseBody);
  if (statusCode !== undefined) payload.statusCode = statusCode;
  if (responseTimeMs !== undefined) payload.responseTimeMs = responseTimeMs;
  if (ipAddress) payload.ipAddress = ipAddress;
  if (userAgent) payload.userAgent = userAgent;
  if (sanitizedMetadata !== null) payload.metadata = sanitizedMetadata;

  const message = JSON.stringify(payload).slice(0, 8000);

  await pool.query(
    `INSERT INTO logs (user_id, "Message", action, entity_name, "LogDate")
     VALUES ($1, $2, $3, $4, NOW())`,
    [actor.id ? Number(actor.id) : null, message, action, entityType]
  );
}
