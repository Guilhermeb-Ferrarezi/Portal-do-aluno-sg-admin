import { API_BASE_URL } from "./core";

type Labels = Record<string, string>;

type PromSeries = {
  labels: Labels;
  value: number;
};

export type MonitoringTotals = {
  requests: number;
  errors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
};

export type MonitoringBreakdownItem = {
  key: string;
  label: string;
  requests: number;
  errors: number;
  avgLatencyMs: number;
  errorRate: number;
};

export type MonitoringMethodItem = {
  method: string;
  requests: number;
  errors: number;
  errorRate: number;
};

export type MonitoringStatusItem = {
  statusClass: string;
  requests: number;
  errors: number;
};

export type MonitoringSnapshot = {
  capturedAt: number;
  totals: MonitoringTotals;
  methods: MonitoringMethodItem[];
  statuses: MonitoringStatusItem[];
  routes: MonitoringBreakdownItem[];
  criticalRoutes: MonitoringBreakdownItem[];
  rawText: string;
};

const CRITICAL_ROUTE_PATTERNS = [
  "/auth",
  "/presence/socket-ticket",
  "/presence/heartbeat",
  "/activity-logs",
  "/metrics",
];

function isCriticalRoute(route: string) {
  return CRITICAL_ROUTE_PATTERNS.some((pattern) => route.includes(pattern));
}

function parseLabels(input: string | undefined) {
  const labels: Labels = {};
  if (!input) return labels;

  const labelPattern = /(\w+)="((?:\\.|[^"])*)"/g;
  for (const match of input.matchAll(labelPattern)) {
    labels[match[1]] = match[2]
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n");
  }

  return labels;
}

function parsePrometheusText(text: string) {
  const metrics = new Map<string, PromSeries[]>();
  const linePattern =
    /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)$/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(linePattern);
    if (!match) continue;

    const [, metricName, labelText, valueText] = match;
    const value = Number(valueText);
    if (!Number.isFinite(value)) continue;

    const list = metrics.get(metricName) ?? [];
    list.push({
      labels: parseLabels(labelText),
      value,
    });
    metrics.set(metricName, list);
  }

  return metrics;
}

function sumSeries(
  series: PromSeries[] | undefined,
  predicate?: (item: PromSeries) => boolean
) {
  if (!series) return 0;
  return series.reduce((total, item) => {
    if (predicate && !predicate(item)) return total;
    return total + item.value;
  }, 0);
}

function percentileFromBuckets(
  buckets: PromSeries[] | undefined,
  quantile: number
) {
  if (!buckets || buckets.length === 0) return 0;

  const sorted = [...buckets]
    .filter((item) => item.labels.le !== undefined)
    .sort((a, b) => {
      const left =
        a.labels.le === "+Inf" ? Number.POSITIVE_INFINITY : Number(a.labels.le);
      const right =
        b.labels.le === "+Inf" ? Number.POSITIVE_INFINITY : Number(b.labels.le);
      return left - right;
    });

  const total = sorted.at(-1)?.value ?? 0;
  if (total <= 0) return 0;

  const target = total * quantile;
  let previousCount = 0;
  let previousBound = 0;

  for (const bucket of sorted) {
    const upperBound =
      bucket.labels.le === "+Inf" ? previousBound : Number(bucket.labels.le);
    const bucketCount = bucket.value;

    if (bucketCount >= target) {
      const countInBucket = bucketCount - previousCount;
      if (countInBucket <= 0) return upperBound;
      const position = (target - previousCount) / countInBucket;
      return previousBound + (upperBound - previousBound) * position;
    }

    previousCount = bucketCount;
    previousBound = upperBound;
  }

  return previousBound;
}

function buildRouteBreakdown(
  requestsSeries: PromSeries[] | undefined,
  errorsSeries: PromSeries[] | undefined,
  durationSumSeries: PromSeries[] | undefined,
  durationCountSeries: PromSeries[] | undefined
) {
  const routeMap = new Map<string, MonitoringBreakdownItem>();

  const ensureRoute = (labels: Labels) => {
    const route = labels.route || "desconhecida";
    const current =
      routeMap.get(route) ??
      {
        key: route,
        label: route,
        requests: 0,
        errors: 0,
        avgLatencyMs: 0,
        errorRate: 0,
      };
    routeMap.set(route, current);
    return current;
  };

  for (const item of requestsSeries ?? []) {
    ensureRoute(item.labels).requests += item.value;
  }

  for (const item of errorsSeries ?? []) {
    ensureRoute(item.labels).errors += item.value;
  }

  const durationSumByRoute = new Map<string, number>();
  for (const item of durationSumSeries ?? []) {
    const route = item.labels.route || "desconhecida";
    durationSumByRoute.set(route, (durationSumByRoute.get(route) ?? 0) + item.value);
  }

  const durationCountByRoute = new Map<string, number>();
  for (const item of durationCountSeries ?? []) {
    const route = item.labels.route || "desconhecida";
    durationCountByRoute.set(route, (durationCountByRoute.get(route) ?? 0) + item.value);
  }

  const routes = [...routeMap.values()].map((item) => {
    const count = durationCountByRoute.get(item.key) ?? 0;
    const sum = durationSumByRoute.get(item.key) ?? 0;
    return {
      ...item,
      avgLatencyMs: count > 0 ? sum / count : 0,
      errorRate: item.requests > 0 ? (item.errors / item.requests) * 100 : 0,
    };
  });

  return routes.sort((a, b) => b.requests - a.requests);
}

function buildMethodBreakdown(
  requestsSeries: PromSeries[] | undefined,
  errorsSeries: PromSeries[] | undefined
) {
  const methodMap = new Map<string, MonitoringMethodItem>();

  const ensureMethod = (method: string) => {
    const current =
      methodMap.get(method) ??
      {
        method,
        requests: 0,
        errors: 0,
        errorRate: 0,
      };
    methodMap.set(method, current);
    return current;
  };

  for (const item of requestsSeries ?? []) {
    ensureMethod(item.labels.method || "N/A").requests += item.value;
  }

  for (const item of errorsSeries ?? []) {
    ensureMethod(item.labels.method || "N/A").errors += item.value;
  }

  return [...methodMap.values()]
    .map((item) => ({
      ...item,
      errorRate: item.requests > 0 ? (item.errors / item.requests) * 100 : 0,
    }))
    .sort((a, b) => b.requests - a.requests);
}

function buildStatusBreakdown(
  requestsSeries: PromSeries[] | undefined,
  errorsSeries: PromSeries[] | undefined
) {
  const statusMap = new Map<string, MonitoringStatusItem>();

  const ensureStatus = (statusClass: string) => {
    const current =
      statusMap.get(statusClass) ??
      {
        statusClass,
        requests: 0,
        errors: 0,
      };
    statusMap.set(statusClass, current);
    return current;
  };

  for (const item of requestsSeries ?? []) {
    ensureStatus(item.labels.status_class || "N/A").requests += item.value;
  }

  for (const item of errorsSeries ?? []) {
    ensureStatus(item.labels.status_class || "N/A").errors += item.value;
  }

  return [...statusMap.values()].sort((a, b) => b.requests - a.requests);
}

export async function fetchMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  const response = await fetch(`${API_BASE_URL}/metrics`, {
    method: "GET",
    headers: {
      Accept: "text/plain",
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ${response.status} ao carregar metricas`);
  }

  const rawText = await response.text();
  const parsed = parsePrometheusText(rawText);

  const requestsSeries = parsed.get("portal_do_aluno_api_http_requests_total");
  const errorsSeries = parsed.get("portal_do_aluno_api_http_request_errors_total");
  const durationBucketSeries = parsed.get(
    "portal_do_aluno_api_http_request_duration_ms_bucket"
  );
  const durationSumSeries = parsed.get(
    "portal_do_aluno_api_http_request_duration_ms_sum"
  );
  const durationCountSeries = parsed.get(
    "portal_do_aluno_api_http_request_duration_ms_count"
  );

  const totalRequests = sumSeries(requestsSeries);
  const totalErrors = sumSeries(errorsSeries);
  const totalDurationMs = sumSeries(durationSumSeries);
  const totalDurationCount = sumSeries(durationCountSeries);

  return {
    capturedAt: Date.now(),
    totals: {
      requests: totalRequests,
      errors: totalErrors,
      avgLatencyMs: totalDurationCount > 0 ? totalDurationMs / totalDurationCount : 0,
      p95LatencyMs: percentileFromBuckets(durationBucketSeries, 0.95),
    },
    methods: buildMethodBreakdown(requestsSeries, errorsSeries),
    statuses: buildStatusBreakdown(requestsSeries, errorsSeries),
    routes: buildRouteBreakdown(
      requestsSeries,
      errorsSeries,
      durationSumSeries,
      durationCountSeries
    ),
    criticalRoutes: buildRouteBreakdown(
      requestsSeries,
      errorsSeries,
      durationSumSeries,
      durationCountSeries
    ).filter((item) => isCriticalRoute(item.key)),
    rawText,
  };
}
