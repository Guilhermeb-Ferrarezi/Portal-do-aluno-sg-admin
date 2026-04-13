import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AuthRequest } from "../middlewares/auth";
import { serializeError } from "./logger";

type Logger = {
  info(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
};

type HttpMetrics = {
  record(req: Request, res: Response, durationMs: number): void;
  resolveRouteLabel(req: Request): string;
};

type RequestObservabilityOptions = {
  logger: Logger;
  metrics: HttpMetrics;
};

const REQUEST_ID_HEADER = "x-request-id";
const SKIPPED_PATHS = new Set([
  "/health",
  "/api/health",
  "/metrics",
  "/api/metrics",
]);

let resolveRouteLabelForErrors: ((req: Request) => string) | null = null;

declare module "express-serve-static-core" {
  interface ResponseLocals {
    requestId?: string;
    errorName?: string;
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
    res.locals.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

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
