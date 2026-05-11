import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AuthRequest } from "../middlewares/auth";
import { serializeError } from "./logger";

type Logger = {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
};

type HttpMetrics = {
  record(req: Request, res: Response, durationMs: number): void;
  resolveRouteLabel(req: Request): string;
};

export type HttpRequestLogDocument = {
  type: "http_request";
  occurredAt: string;
  method: string;
  url: string;
  path: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ip: string | null;
  hostname: string | null;
  userAgent: string | null;
  requestId: string | null;
  outcome: string;
  user: {
    id: string | null;
    email: string | null;
    role: string | null;
  } | null;
  requestBody: unknown;
  responseBody: unknown;
  request: {
    params: unknown;
    query: unknown;
    body: unknown;
    headers: unknown;
  };
  response: {
    statusCode: number;
    body: unknown;
  };
  error?: {
    type?: string;
    message?: string;
    stack?: string;
    status?: number;
  };
};

type HttpLogSink = {
  persist(document: HttpRequestLogDocument): Promise<void>;
  shouldPersist(input: { method: string; path: string; statusCode: number }): boolean;
};

type RequestObservabilityOptions = {
  logger: Logger;
  metrics: HttpMetrics;
  logSink?: HttpLogSink;
};

type SerializedError = ReturnType<typeof serializeError>;

const REQUEST_ID_HEADER = "x-request-id";
const SKIPPED_PATHS = new Set([
  "/health",
  "/api/health",
  "/metrics",
  "/api/metrics",
]);
const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "cookie", "session", "key"];
const MAX_STRING_LENGTH = 16_384;

let resolveRouteLabelForErrors: ((req: Request) => string) | null = null;

declare module "express-serve-static-core" {
  interface ResponseLocals {
    requestId?: string;
    errorName?: string;
    requestError?: SerializedError;
    responseBody?: unknown;
  }
}

function shouldSkip(path: string) {
  return SKIPPED_PATHS.has(path);
}

function getIpAddress(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0]?.trim() || req.ip;
  }

  return req.ip;
}

function resolvePath(req: Request) {
  return req.originalUrl.split("?")[0] || req.path;
}

function resolveRoute(req: Request) {
  return resolveRouteLabelForErrors?.(req) ?? resolvePath(req);
}

function resolveStatusClass(statusCode: number | null | undefined) {
  if (typeof statusCode !== "number" || !Number.isFinite(statusCode) || statusCode <= 0) {
    return null;
  }

  return `${Math.floor(statusCode / 100)}xx`;
}

function resolveOutcome(statusCode: number | null | undefined) {
  if (typeof statusCode !== "number" || !Number.isFinite(statusCode) || statusCode <= 0) {
    return "unknown";
  }

  if (statusCode >= 500) return "server_error";
  if (statusCode >= 400) return "client_error";
  return "success";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isSensitiveKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return SENSITIVE_KEYS.some((candidate) => normalized.includes(candidate));
}

function truncateString(value: string) {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED ${value.length - MAX_STRING_LENGTH} chars]`;
}

function sanitizeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.byteLength} bytes]`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  const sanitizedEntries = Object.entries(value).map(([key, nestedValue]) => {
    if (isSensitiveKey(key)) {
      return [key, "[REDACTED]"];
    }

    return [key, sanitizeValue(nestedValue, seen)];
  });

  return Object.fromEntries(sanitizedEntries);
}

function sanitizeHeaders(headers: Request["headers"]) {
  const normalizedHeaders: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveKey(key)) {
      normalizedHeaders[key] = "[REDACTED]";
      continue;
    }

    if (Array.isArray(value)) {
      normalizedHeaders[key] = value.map((item) => truncateString(String(item)));
      continue;
    }

    normalizedHeaders[key] = value == null ? null : truncateString(String(value));
  }

  return normalizedHeaders;
}

function resolveHostname(req: Request) {
  const host = req.get("host");
  if (!host) {
    return req.hostname || null;
  }

  return host;
}

function resolveUrl(req: Request) {
  const host = req.get("host");
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0]?.trim() || req.protocol;

  if (!host) {
    return req.originalUrl;
  }

  return `${protocol}://${host}${req.originalUrl}`;
}

function buildRequestLogFields(
  req: Request,
  res: Response,
  extras: Record<string, unknown> = {}
) {
  const authRequest = req as AuthRequest;
  const statusCode =
    typeof extras.status_code === "number" ? extras.status_code : res.statusCode;
  const errorType =
    typeof extras.error_type === "string"
      ? extras.error_type
      : res.locals.errorName ?? null;

  return {
    request_id: getRequestId(req, res),
    method: req.method,
    path: resolvePath(req),
    route: resolveRoute(req),
    status_code: statusCode,
    status_class: resolveStatusClass(statusCode),
    outcome: resolveOutcome(statusCode),
    duration_ms:
      typeof extras.duration_ms === "number"
        ? Number(extras.duration_ms.toFixed(2))
        : null,
    actor_id: authRequest.user?.sub ?? null,
    actor_role: authRequest.user?.role ?? null,
    ip: getIpAddress(req),
    user_agent: req.get("user-agent") || null,
    error_type: errorType,
    ...extras,
  };
}

function buildHttpLogDocument(
  req: Request,
  res: Response,
  durationMs: number
): HttpRequestLogDocument {
  const authRequest = req as AuthRequest;
  const serializedError = res.locals.requestError;
  const statusCode = res.statusCode;

  return {
    type: "http_request",
    occurredAt: new Date().toISOString(),
    method: req.method,
    url: resolveUrl(req),
    path: resolvePath(req),
    route: resolveRoute(req),
    statusCode,
    durationMs: Number(durationMs.toFixed(2)),
    ip: getIpAddress(req) || null,
    hostname: resolveHostname(req),
    userAgent: req.get("user-agent") || null,
    requestId: getRequestId(req, res),
    outcome: resolveOutcome(statusCode),
    user: authRequest.user
      ? {
          id: authRequest.user.sub,
          email: authRequest.user.usuario,
          role: authRequest.user.role,
        }
      : null,
    requestBody: sanitizeValue(req.body ?? null),
    responseBody: sanitizeValue(res.locals.responseBody ?? null),
    request: {
      params: sanitizeValue(req.params ?? {}),
      query: sanitizeValue(req.query ?? {}),
      body: sanitizeValue(req.body ?? null),
      headers: sanitizeHeaders(req.headers),
    },
    response: {
      statusCode,
      body: sanitizeValue(res.locals.responseBody ?? null),
    },
    ...(serializedError
      ? {
          error: {
            type:
              typeof serializedError.error_type === "string"
                ? serializedError.error_type
                : undefined,
            message:
              typeof serializedError.error_message === "string"
                ? serializedError.error_message
                : undefined,
            stack:
              typeof serializedError.error_stack === "string"
                ? serializedError.error_stack
                : undefined,
            status:
              typeof serializedError.error_status === "number"
                ? serializedError.error_status
                : undefined,
          },
        }
      : {}),
  };
}

function captureResponsePayload(payload: unknown) {
  if (payload === undefined) {
    return null;
  }

  if (Buffer.isBuffer(payload)) {
    return `[Buffer ${payload.byteLength} bytes]`;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return "";
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return truncateString(payload);
    }
  }

  return payload;
}

export function getRequestId(req: Request, res: Response) {
  return res.locals.requestId ?? req.header(REQUEST_ID_HEADER) ?? null;
}

export function createRequestObservabilityMiddleware(
  options: RequestObservabilityOptions
) {
  resolveRouteLabelForErrors = options.metrics.resolveRouteLabel;

  return function requestObservability(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const requestId = req.header(REQUEST_ID_HEADER)?.trim() || randomUUID();
    const startedAt = process.hrtime.bigint();
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.locals.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    res.json = ((body: unknown) => {
      res.locals.responseBody = captureResponsePayload(body);
      return originalJson(body);
    }) as Response["json"];

    res.send = ((body?: unknown) => {
      if (res.locals.responseBody === undefined) {
        res.locals.responseBody = captureResponsePayload(body);
      }
      return originalSend(body);
    }) as Response["send"];

    res.once("finish", () => {
      if (shouldSkip(req.path)) {
        return;
      }

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      options.metrics.record(req, res, durationMs);

      options.logger.info(
        "http_request_completed",
        buildRequestLogFields(req, res, {
          request_id: requestId,
          route: options.metrics.resolveRouteLabel(req),
          duration_ms: durationMs,
        })
      );

      if (!options.logSink?.shouldPersist({
        method: req.method,
        path: resolvePath(req),
        statusCode: res.statusCode,
      })) {
        return;
      }

      void options.logSink.persist(buildHttpLogDocument(req, res, durationMs)).catch((error) => {
        options.logger.warn("http_request_persist_failed", {
          request_id: requestId,
          path: resolvePath(req),
          error: serializeError(error),
        });
      });
    });

    next();
  };
}

export function logRequestError(
  logger: Logger,
  req: Request,
  res: Response,
  error: unknown
) {
  if (shouldSkip(req.path)) {
    return;
  }

  const serialized = serializeError(error);
  res.locals.errorName =
    typeof serialized.error_type === "string" ? serialized.error_type : "UnknownError";
  res.locals.requestError = serialized;

  const statusCode =
    typeof serialized.error_status === "number"
      ? serialized.error_status
      : res.statusCode >= 400
        ? res.statusCode
        : 500;

  logger.error(
    "http_request_failed",
    buildRequestLogFields(req, res, {
      status_code: statusCode,
      error_type: serialized.error_type,
      error_message: serialized.error_message,
      error_stack: serialized.error_stack,
      error_status: serialized.error_status,
    })
  );
}
