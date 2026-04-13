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

const OBSERVABILITY_KEYS = new Set([
  "requestId",
  "route",
  "statusCode",
  "outcome",
  "errorType",
  "source",
  "contextArea",
]);

const SENSITIVE_METADATA_KEYS = [
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
  return SENSITIVE_METADATA_KEYS.some((candidate) =>
    normalized.includes(candidate.toLowerCase())
  );
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitizedEntries = Object.entries(value).flatMap(([key, itemValue]) => {
    if (isSensitiveKey(key)) {
      return [];
    }

    return [[key, sanitizeMetadataValue(itemValue)] as const];
  });

  return Object.fromEntries(sanitizedEntries);
}

function buildObservabilityFields(metadata: unknown) {
  if (!isRecord(metadata)) {
    return {
      observabilityFields: [] as string[],
      safeMetadata: metadata,
    };
  }

  const safeMetadata = sanitizeMetadataValue(metadata);
  const safeRecord = isRecord(safeMetadata) ? safeMetadata : {};
  const observabilityFields: string[] = [];

  for (const key of OBSERVABILITY_KEYS) {
    const rawValue = safeRecord[key];
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      continue;
    }

    observabilityFields.push(`${key}=${String(rawValue)}`);
    delete safeRecord[key];
  }

  return {
    observabilityFields,
    safeMetadata: Object.keys(safeRecord).length > 0 ? safeRecord : null,
  };
}

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
  const { observabilityFields, safeMetadata } = buildObservabilityFields(metadata);
  messageParts.push(...observabilityFields);
  if (safeMetadata) {
    try {
      messageParts.push(`metadata=${JSON.stringify(safeMetadata)}`);
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
    [actorId ? Number(actorId) : null, message, action, entityType]
  );
}
