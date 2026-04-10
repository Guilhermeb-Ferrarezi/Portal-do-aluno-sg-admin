import type { Request, Response } from "express";
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

const UUID_SEGMENT_PATTERN =
  /(?<=\/)[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi;
const HEX_SEGMENT_PATTERN = /(?<=\/)[0-9a-f]{16,}(?=\/|$)/gi;
const NUMERIC_SEGMENT_PATTERN = /(?<=\/)\d+(?=\/|$)/g;

export function createHttpMetrics(serviceName: string) {
  const registry = new Registry();
  collectDefaultMetrics({
    register: registry,
    prefix: "portal_do_aluno_api_",
  });

  const httpRequestsTotal = new Counter({
    name: "portal_do_aluno_api_http_requests_total",
    help: "Total de requisicoes HTTP processadas pela API",
    labelNames: ["service", "method", "route", "status_code", "status_class"] as const,
    registers: [registry],
  });

  const httpRequestErrorsTotal = new Counter({
    name: "portal_do_aluno_api_http_request_errors_total",
    help: "Total de respostas HTTP de erro da API",
    labelNames: ["service", "method", "route", "status_code", "status_class"] as const,
    registers: [registry],
  });

  const httpRequestDurationMs = new Histogram({
    name: "portal_do_aluno_api_http_request_duration_ms",
    help: "Duracao das requisicoes HTTP da API em milissegundos",
    labelNames: ["service", "method", "route", "status_code", "status_class"] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    registers: [registry],
  });

  function normalizePath(pathname: string) {
    const normalized = pathname
      .replace(UUID_SEGMENT_PATTERN, ":uuid")
      .replace(HEX_SEGMENT_PATTERN, ":id")
      .replace(NUMERIC_SEGMENT_PATTERN, ":id")
      .replace(/\/+/g, "/");

    return normalized || "/";
  }

  function resolveRouteLabel(req: Request) {
    const routePath =
      typeof req.route?.path === "string"
        ? req.route.path
        : Array.isArray(req.route?.path)
          ? req.route.path.join("|")
          : null;

    if (routePath) {
      return normalizePath(`${req.baseUrl || ""}${routePath}`);
    }

    const originalPath = req.originalUrl.split("?")[0] || req.path || "/";
    return normalizePath(originalPath);
  }

  function record(req: Request, res: Response, durationMs: number) {
    const statusCode = String(res.statusCode);
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    const route = resolveRouteLabel(req);
    const labels = {
      service: serviceName,
      method: req.method,
      route,
      status_code: statusCode,
      status_class: statusClass,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationMs.observe(labels, durationMs);

    if (res.statusCode >= 400) {
      httpRequestErrorsTotal.inc(labels);
    }
  }

  return {
    registry,
    record,
    resolveRouteLabel,
  };
}
