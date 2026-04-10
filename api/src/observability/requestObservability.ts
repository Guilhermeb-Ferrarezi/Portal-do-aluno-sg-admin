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

export function getRequestId(req: Request, res: Response) {
  return res.locals.requestId ?? req.header(REQUEST_ID_HEADER) ?? null;
}

export function createRequestObservabilityMiddleware(
  options: RequestObservabilityOptions
) {
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

      const authRequest = req as AuthRequest;
      options.logger.info("http_request_completed", {
        request_id: requestId,
        method: req.method,
        path: req.originalUrl.split("?")[0] || req.path,
        route: options.metrics.resolveRouteLabel(req),
        status_code: res.statusCode,
        duration_ms: Number(durationMs.toFixed(2)),
        user_id: authRequest.user?.sub,
        role: authRequest.user?.role,
        ip: getIpAddress(req),
        user_agent: req.get("user-agent") || null,
        error_type: res.locals.errorName,
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
  const serialized = serializeError(error);
  const requestId = getRequestId(req, res);
  res.locals.errorName =
    typeof serialized.error_type === "string" ? serialized.error_type : "UnknownError";

  logger.error("http_request_failed", {
    request_id: requestId,
    method: req.method,
    path: req.originalUrl.split("?")[0] || req.path,
    route: req.originalUrl.split("?")[0] || req.path,
    status_code:
      typeof serialized.error_status === "number"
        ? serialized.error_status
        : res.statusCode >= 400
          ? res.statusCode
          : undefined,
    ...serialized,
  });
}
