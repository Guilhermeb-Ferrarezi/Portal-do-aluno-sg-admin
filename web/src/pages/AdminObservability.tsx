import React from "react";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Copy,
  Gauge,
  Loader2,
  Radar,
  RefreshCcw,
  Route,
  Search,
  Server,
  ShieldAlert,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildActivityLogPayload } from "@/utils/activity-log-payload";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { FadeInUp } from "../components/animate-ui/FadeInUp";
import { ScaleIn } from "../components/animate-ui/ScaleIn";
import { listarActivityLogs, type ActivityLog } from "../services/api";
import {
  fetchMonitoringSnapshot,
  type MonitoringBreakdownItem,
  type MonitoringSnapshot,
} from "../services/api/monitoring";

type MetricHistoryPoint = {
  capturedAt: number;
  requestsPerMinute: number;
  errorsPerMinute: number;
};

type ErrorLine = {
  method: string;
  route: string;
  statusCode: string;
  statusClass: string;
  count: number;
};

type ErrorDialog = {
  open: boolean;
  title: string;
  lines: ErrorLine[];
};

type IncidentSummary = {
  key: string;
  route: string;
  source: string;
  errorType: string;
  outcome: string;
  count: number;
  lastAt: string;
  sampleLog: ActivityLog;
};

const REFRESH_INTERVAL_MS = 15000;
const HISTORY_LIMIT = 24;

function parseErrorLines(rawText: string, routeFilter?: string): ErrorLine[] {
  const results: ErrorLine[] = [];
  const labelPattern = /(\w+)="((?:\\.|[^"])*)"/g;

  for (const raw of rawText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!line.startsWith("portal_do_aluno_api_http_request_errors_total{")) continue;

    const braceEnd = line.indexOf("}");
    if (braceEnd === -1) continue;

    const labelText = line.slice(line.indexOf("{") + 1, braceEnd);
    const valueText = line.slice(braceEnd + 1).trim();
    const count = Number(valueText);
    if (!Number.isFinite(count) || count <= 0) continue;

    const labels: Record<string, string> = {};
    for (const match of labelText.matchAll(labelPattern)) {
      labels[match[1]] = match[2];
    }

    const route = labels.route ?? "";
    if (routeFilter && route !== routeFilter) continue;

    results.push({
      method: labels.method ?? "-",
      route,
      statusCode: labels.status_code ?? "-",
      statusClass: labels.status_class ?? "-",
      count,
    });
  }

  return results.sort((a, b) => b.count - a.count);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
    notation: value >= 1000 ? "compact" : "standard",
  }).format(value);
}

function formatLatency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 ms";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ms`;
}

function formatPercentage(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function timeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function timeAgoFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h`;
  return formatDateTime(value);
}

function buildBarStyle(value: number, max: number) {
  const ratio = max > 0 ? value / max : 0;
  return {
    height: `${Math.max(10, ratio * 100)}%`,
  };
}

function routeTone(item: MonitoringBreakdownItem) {
  if (item.errorRate >= 10) return "bg-rose-500";
  if (item.errorRate > 0) return "bg-amber-500";
  return "bg-emerald-500";
}

function riskTone(item: MonitoringBreakdownItem) {
  if (item.errorRate >= 10) {
    return {
      chip: "border-rose-500/30 bg-rose-500/12 text-rose-200",
    };
  }
  if (item.errorRate > 0 || item.avgLatencyMs > 500) {
    return {
      chip: "border-amber-500/30 bg-amber-500/12 text-amber-100",
    };
  }
  return {
    chip: "border-emerald-500/30 bg-emerald-500/12 text-emerald-100",
  };
}

function statusBadgeClass(statusClass: string) {
  if (statusClass.startsWith("2")) {
    return "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300";
  }
  if (statusClass.startsWith("4")) {
    return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300";
  }
  if (statusClass.startsWith("5")) {
    return "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300";
  }
  return "border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:text-slate-300";
}

function statusLineBadge(statusClass: string) {
  if (statusClass.startsWith("5")) {
    return "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300";
  }
  if (statusClass.startsWith("4")) {
    return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300";
  }
  return "border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:text-slate-300";
}

function outcomeBadgeClass(outcome: string | null | undefined) {
  if (outcome === "success") {
    return "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300";
  }
  if (outcome === "denied") {
    return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300";
  }
  if (outcome === "error") {
    return "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300";
  }
  return "border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:text-slate-300";
}

function copyPayload(payloadLog: ActivityLog | null) {
  if (!payloadLog) return;
  void navigator.clipboard.writeText(
    JSON.stringify(buildActivityLogPayload(payloadLog), null, 2)
  );
}

function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border/70 bg-background/40 px-5 py-7 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-muted-foreground">
        {icon}
      </div>
      <div className="mt-3 text-sm font-semibold text-foreground">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function UtilityChip({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur",
        className
      )}
    >
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function CommandMetric({
  title,
  value,
  subtitle,
  icon,
  accentClass,
  onAction,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accentClass: string;
  onAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-full min-h-[196px] flex-col rounded-[26px] border border-border/70 bg-card p-5 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.14)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {title}
          </div>
          <div className="mt-3 text-3xl font-black tracking-[-0.06em] text-foreground">{value}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
            accentClass
          )}
        >
          {icon}
        </div>
      </div>
      <div className="mt-auto flex h-10 items-end">
        {onAction ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onAction.onClick}
            className="h-8 rounded-xl px-0 text-xs text-rose-600 hover:bg-transparent hover:text-rose-500"
          >
            <Search size={12} className="mr-1.5" />
            {onAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function renderTrendBars(
  items: MetricHistoryPoint[],
  valueKey: "requestsPerMinute" | "errorsPerMinute",
  barClassName: string
) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Ainda nao ha historico suficiente nesta sessao."
        description="A coleta local precisa de mais de uma leitura para desenhar o ritmo."
        icon={<Waves size={16} />}
      />
    );
  }

  const max = items.reduce((acc, item) => Math.max(acc, item[valueKey]), 0);
  const labelStep = Math.max(1, Math.ceil(items.length / 6));

  return (
    <div className="flex h-40 items-end gap-2">
      {items.map((item, index) => (
        <div
          key={`${valueKey}-${item.capturedAt}`}
          className="group relative flex flex-1 flex-col justify-end"
          title={`${timeLabel(item.capturedAt)} - ${item[valueKey].toFixed(2)}/min`}
        >
          <div
            className={cn(
              "w-full rounded-t-[14px] opacity-85 transition-all duration-300 group-hover:opacity-100",
              barClassName
            )}
            style={buildBarStyle(item[valueKey], max)}
          />
          <span className="mt-2 text-center text-[10px] text-slate-500">
            {index % labelStep === 0 || index === items.length - 1 ? timeLabel(item.capturedAt) : " "}
          </span>
        </div>
      ))}
    </div>
  );
}

function ErrorLinesDialog({
  dialog,
  onClose,
}: {
  dialog: ErrorDialog;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={dialog.open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden border-border/70 bg-card text-foreground">
        <DialogHeader className="border-b border-border/70 pb-4">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle size={16} className="text-rose-400" />
            {dialog.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Contadores acumulados de erros HTTP desde o ultimo boot da API, com leitura direta do
            texto Prometheus.
          </DialogDescription>
        </DialogHeader>

        {dialog.lines.length === 0 ? (
          <div className="px-1 pb-1">
            <EmptyState
              title="Nenhum erro registrado para esta rota."
              description="Sem linhas acumuladas no contador de falhas para o filtro escolhido."
              icon={<ShieldAlert size={16} />}
            />
          </div>
        ) : (
          <div className="overflow-y-auto pr-1">
            <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/60">
              <div className="hidden grid-cols-[80px_1fr_90px_80px_60px] gap-3 border-b border-border/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:grid">
                <span>Metodo</span>
                <span>Rota</span>
                <span>Status</span>
                <span>Classe</span>
                <span className="text-right">Total</span>
              </div>
              {dialog.lines.map((line, index) => (
                <div
                  key={`${line.route}-${line.statusCode}-${index}`}
                  className="grid gap-2 border-b border-white/10 px-4 py-3 last:border-b-0 sm:grid-cols-[80px_1fr_90px_80px_60px] sm:items-center sm:gap-3"
                >
                  <Badge variant="outline" className="w-fit rounded-full px-2.5 text-[11px] font-semibold">
                    {line.method}
                  </Badge>
                  <span className="truncate font-mono text-xs text-foreground" title={line.route}>
                    {line.route || "-"}
                  </span>
                  <Badge
                    className={cn(
                      "w-fit rounded-full px-2.5 text-[11px] font-semibold",
                      statusLineBadge(line.statusClass)
                    )}
                  >
                    {line.statusCode}
                  </Badge>
                  <Badge
                    className={cn(
                      "w-fit rounded-full px-2.5 text-[11px] font-semibold",
                      statusLineBadge(line.statusClass)
                    )}
                  >
                    {line.statusClass}
                  </Badge>
                  <span className="text-right text-sm font-black text-foreground">{line.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminObservabilityPage() {
  const [snapshot, setSnapshot] = React.useState<MonitoringSnapshot | null>(null);
  const [recentOps, setRecentOps] = React.useState<ActivityLog[]>([]);
  const [history, setHistory] = React.useState<MetricHistoryPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorDialog, setErrorDialog] = React.useState<ErrorDialog>({
    open: false,
    title: "",
    lines: [],
  });
  const [payloadLog, setPayloadLog] = React.useState<ActivityLog | null>(null);

  const openErrorDialog = React.useCallback(
    (title: string, routeFilter?: string) => {
      const lines = parseErrorLines(snapshot?.rawText ?? "", routeFilter);
      setErrorDialog({ open: true, title, lines });
    },
    [snapshot]
  );

  const closeErrorDialog = React.useCallback(() => {
    setErrorDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const loadSnapshot = React.useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [next, recentLogsResponse] = await Promise.all([
        fetchMonitoringSnapshot(),
        listarActivityLogs({
          limit: 20,
          offset: 0,
          actorGroup: "staff",
        }),
      ]);

      const recentStructuredLogs = recentLogsResponse.items.filter((item) => {
        if (item.method || item.endpoint || item.statusCode) {
          return true;
        }
        return (
          item.entityType === "auth" ||
          item.entityType === "presence" ||
          item.entityType === "security"
        );
      });
      setRecentOps(recentStructuredLogs.slice(0, 10));

      setSnapshot((previous) => {
        if (previous) {
          const elapsedMinutes = (next.capturedAt - previous.capturedAt) / 60000;
          if (elapsedMinutes > 0) {
            const requestsPerMinute =
              (next.totals.requests - previous.totals.requests) / elapsedMinutes;
            const errorsPerMinute =
              (next.totals.errors - previous.totals.errors) / elapsedMinutes;

            setHistory((current) =>
              [
                ...current,
                {
                  capturedAt: next.capturedAt,
                  requestsPerMinute: Math.max(0, requestsPerMinute),
                  errorsPerMinute: Math.max(0, errorsPerMinute),
                },
              ].slice(-HISTORY_LIMIT)
            );
          }
        }

        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar observabilidade");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSnapshot();

    const intervalId = window.setInterval(() => {
      void loadSnapshot(true);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadSnapshot]);

  const totals = snapshot?.totals;
  const errorRate = totals && totals.requests > 0 ? (totals.errors / totals.requests) * 100 : 0;
  const topRoutes = React.useMemo(() => (snapshot?.routes ?? []).slice(0, 6), [snapshot]);
  const criticalRoutes = React.useMemo(
    () => (snapshot?.criticalRoutes ?? []).slice(0, 5),
    [snapshot]
  );
  const riskRoutes = React.useMemo(
    () =>
      [...(snapshot?.routes ?? [])]
        .sort(
          (a, b) => b.errorRate * 2 + b.avgLatencyMs / 1000 - (a.errorRate * 2 + a.avgLatencyMs / 1000)
        )
        .slice(0, 6),
    [snapshot]
  );
  const incidentSummaries = React.useMemo<IncidentSummary[]>(() => {
    const grouped = new Map<string, IncidentSummary>();

    for (const item of recentOps) {
      if (!item.statusCode || (item.statusCode >= 200 && item.statusCode < 400)) continue;

      const route = item.endpoint ?? "-";
      const source = item.action;
      const errorType = item.statusCode >= 500 ? "Server Error" : "Client Error";
      const outcome = item.statusCode >= 500 ? "error" : "denied";
      const key = `${route}|${source}|${errorType}|${outcome}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.count += 1;
        if (new Date(item.createdAt).getTime() > new Date(existing.lastAt).getTime()) {
          existing.lastAt = item.createdAt;
        }
        continue;
      }

      grouped.set(key, {
        key,
        route,
        source,
        errorType,
        outcome,
        count: 1,
        lastAt: item.createdAt,
        sampleLog: item,
      });
    }

    return [...grouped.values()]
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
      })
      .slice(0, 8);
  }, [recentOps]);
  const lastCaptureLabel = snapshot ? timeLabel(snapshot.capturedAt) : "--:--";
  const latestRequestRate = history.at(-1)?.requestsPerMinute ?? 0;
  const latestErrorRatePerMinute = history.at(-1)?.errorsPerMinute ?? 0;

  if (loading) {
    return (
      <DashboardLayout title="Observabilidade" subtitle="Metricas operacionais da API em tempo real">
        <div className="rounded-[32px] border border-border/70 bg-card px-6 py-16 text-center shadow-[0_30px_90px_-50px_rgba(15,23,42,0.18)]">
          <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-primary">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-semibold">Montando o war room operacional...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Observabilidade"
      subtitle="Pulso operacional da API, risco por rota e eventos estruturados."
    >
      <FadeInUp duration={0.28}>
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-[34px] border border-border/70 bg-card text-foreground shadow-[0_40px_120px_-50px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(24,33,51,0.98),rgba(15,21,35,1))] dark:text-slate-100 dark:shadow-[0_40px_120px_-50px_rgba(0,0,0,0.7)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(148,163,184,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,250,252,0.94))] dark:bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.08),transparent_32%),radial-gradient(circle_at_top_right,rgba(148,163,184,0.05),transparent_24%),linear-gradient(180deg,rgba(36,45,61,0.72),rgba(15,21,35,0.1))]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[1.25fr_0.75fr] lg:px-8 lg:py-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  <Radar size={14} />
                  API war room
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-[-0.07em] text-foreground dark:text-slate-50 sm:text-[3rem]">
                  Centro de comando da API
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground dark:text-slate-400">
                  Leitura operacional direta para saber o que esta degradando agora, quais rotas
                  acumulam risco e quais eventos recentes merecem investigacao imediata.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <UtilityChip label="Ultima leitura" value={lastCaptureLabel} />
                  <UtilityChip label="Taxa de erro" value={formatPercentage(errorRate)} />
                  <UtilityChip label="P95" value={formatLatency(totals?.p95LatencyMs ?? 0)} />
                  <UtilityChip
                    label="Ritmo atual"
                    value={`${latestRequestRate.toFixed(1)} req/min`}
                    className="border-sky-400/20 bg-sky-500/10"
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[28px] border border-border/70 bg-background/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground dark:text-slate-400">
                        Estado da API
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-300">
                          <Server size={13} className="mr-1.5" />
                          API online
                        </Badge>
                        <Badge className="rounded-full border-border/70 bg-card px-3 py-1.5 text-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                          <ShieldAlert size={13} className="mr-1.5" />
                          {formatCompactNumber(totals?.errors ?? 0)} erros acumulados
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void loadSnapshot(true)}
                      className="h-10 rounded-full"
                    >
                      {refreshing ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <RefreshCcw size={15} />
                      )}
                      Atualizar
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 dark:border-white/10 dark:bg-slate-900/40">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground dark:text-slate-500">
                        Req/min
                      </div>
                      <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-foreground dark:text-slate-50">
                        {latestRequestRate.toFixed(1)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 dark:border-white/10 dark:bg-slate-900/40">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground dark:text-slate-500">
                        Erros/min
                      </div>
                      <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-rose-300">
                        {latestErrorRatePerMinute.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 dark:border-white/10 dark:bg-slate-900/40">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground dark:text-slate-500">
                        Incidentes
                      </div>
                      <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-foreground dark:text-slate-50">
                        {incidentSummaries.length}
                      </div>
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/8 p-5 text-rose-100">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300">
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Falha ao atualizar a observabilidade</div>
                        <p className="mt-1 text-sm leading-6 text-rose-100/80">{error}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-4">
            <ScaleIn delay={0}>
              <CommandMetric
                title="Requisicoes"
                value={formatCompactNumber(totals?.requests ?? 0)}
                subtitle="contador acumulado desde o boot da API"
                icon={<Activity size={20} />}
                accentClass="border-sky-500/20 bg-sky-500/10 text-sky-300"
              />
            </ScaleIn>
            <ScaleIn delay={0.04}>
              <CommandMetric
                title="Erros"
                value={formatCompactNumber(totals?.errors ?? 0)}
                subtitle={`${formatPercentage(errorRate)} de taxa de erro total`}
                icon={<ShieldAlert size={20} />}
                accentClass="border-rose-500/20 bg-rose-500/10 text-rose-300"
                onAction={{
                  label: "Abrir detalhes dos erros",
                  onClick: () => openErrorDialog("Todos os erros HTTP"),
                }}
              />
            </ScaleIn>
            <ScaleIn delay={0.08}>
              <CommandMetric
                title="Latencia media"
                value={formatLatency(totals?.avgLatencyMs ?? 0)}
                subtitle="media acumulada das requisicoes da API"
                icon={<Clock3 size={20} />}
                accentClass="border-amber-500/20 bg-amber-500/10 text-amber-300"
              />
            </ScaleIn>
            <ScaleIn delay={0.12}>
              <CommandMetric
                title="P95"
                value={formatLatency(totals?.p95LatencyMs ?? 0)}
                subtitle="estimativa do histograma de duracao"
                icon={<Gauge size={20} />}
                accentClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              />
            </ScaleIn>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="overflow-hidden rounded-[30px] border border-border/70 bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)]">
              <div className="border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-primary" />
                  <h3 className="text-lg font-black tracking-[-0.03em] text-foreground">Mapa de risco imediato</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rotas priorizadas por taxa de erro e latencia media, com recorte operacional primeiro.
                </p>
              </div>
              <div className="max-h-[20rem] space-y-3 overflow-y-auto p-5 sm:p-6">
                {riskRoutes.length === 0 ? (
                  <EmptyState
                    title="Nenhuma rota entrou no mapa de risco nesta leitura."
                    description="Sem erro relativo ou latencia anormal capturados no snapshot atual."
                    icon={<Radar size={16} />}
                  />
                ) : (
                  riskRoutes.map((item, index) => {
                    const tone = riskTone(item);
                    return (
                      <div
                        key={`risk-${item.key}`}
                        className="relative overflow-hidden rounded-[24px] border border-border/70 bg-background/70 p-4"
                      >
                        <div className="relative flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex size-7 items-center justify-center rounded-full border border-border/70 bg-card text-xs font-bold text-foreground">
                                {index + 1}
                              </span>
                              <span className="truncate font-mono text-sm text-foreground">{item.label}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge className={cn("rounded-full", tone.chip)}>
                                taxa {formatPercentage(item.errorRate)}
                              </Badge>
                              <Badge className="rounded-full border-border/70 bg-card text-foreground">
                                media {formatLatency(item.avgLatencyMs)}
                              </Badge>
                              <Badge className="rounded-full border-border/70 bg-card text-foreground">
                                {formatCompactNumber(item.requests)} req
                              </Badge>
                            </div>
                          </div>
                          {item.errors > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openErrorDialog(`Erros - ${item.label}`, item.key)}
                              className="relative h-8 rounded-xl border border-rose-400/15 bg-rose-500/8 px-3 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/12 hover:text-rose-200"
                            >
                              <Search size={11} className="mr-1" />
                              Ver erros
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-[30px] border border-border/70 bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.4)]">
              <div className="border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-primary" />
                  <h3 className="text-lg font-black tracking-[-0.03em] text-foreground">
                    Rotas criticas
                  </h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Auth, presence, activity logs e metrics com leitura condensada para triagem.
                </p>
              </div>
              <div className="max-h-[20rem] space-y-3 overflow-y-auto p-5 sm:p-6">
                {criticalRoutes.length === 0 ? (
                  <EmptyState
                    title="Nenhuma rota critica foi capturada nas metricas atuais."
                    description="A leitura atual nao trouxe chamadas para os caminhos sensiveis monitorados."
                    icon={<ShieldAlert size={16} />}
                  />
                ) : (
                  criticalRoutes.map((item) => (
                    <div
                      key={`critical-${item.key}`}
                      className="rounded-[22px] border border-border/70 bg-background/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm text-foreground">{item.label}</div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{formatCompactNumber(item.requests)} req</span>
                            <span>{formatCompactNumber(item.errors)} erros</span>
                            <span>media {formatLatency(item.avgLatencyMs)}</span>
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "rounded-full",
                            statusBadgeClass(item.errorRate > 0 ? "5xx" : "2xx")
                          )}
                        >
                          {formatPercentage(item.errorRate)}
                        </Badge>
                      </div>
                      {item.errors > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openErrorDialog(`Erros - ${item.label}`, item.key)}
                          className="mt-3 h-8 rounded-xl border border-rose-300/40 bg-rose-500/8 px-3 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/15 dark:border-rose-500/25 dark:text-rose-300"
                        >
                          <Search size={11} className="mr-1" />
                          Ver erros
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-[30px] border border-border/70 bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)]">
              <div className="border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-primary" />
                  <h3 className="text-lg font-black tracking-[-0.03em] text-foreground">Assinaturas de falha</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Agrupamento local para destacar repeticao, origem e ultimo disparo.
                </p>
              </div>
              <div className="max-h-[20rem] space-y-3 overflow-y-auto p-5 sm:p-6">
                {incidentSummaries.length === 0 ? (
                  <EmptyState
                    title="Nenhuma assinatura de falha apareceu nos eventos recentes."
                    description="Sem agrupamentos de erro ou negacao nos activity logs carregados."
                    icon={<ShieldAlert size={16} />}
                  />
                ) : (
                  incidentSummaries.map((item) => (
                    <div
                      key={`incident-${item.key}`}
                      className="rounded-[24px] border border-border/70 bg-background/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">{item.errorType}</div>
                          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.route}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black tracking-[-0.05em] text-foreground">
                            {item.count}
                          </div>
                          <div className="text-[11px] text-muted-foreground">ocorrencias</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className={cn("rounded-full", outcomeBadgeClass(item.outcome))}>
                          {item.outcome}
                        </Badge>
                        <Badge className="rounded-full border-border/70 bg-card text-foreground">
                          {item.source}
                        </Badge>
                        <Badge className="rounded-full border-border/70 bg-card text-foreground">
                          ultimo {timeAgoFromIso(item.lastAt)}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl border-border/70 bg-background/80 px-3 text-[11px]"
                          onClick={() => setPayloadLog(item.sampleLog)}
                        >
                          Ver request/response
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="overflow-hidden rounded-[30px] border border-border/70 bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.4)]">
              <div className="border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <Waves size={16} className="text-primary" />
                  <h3 className="text-lg font-black tracking-[-0.03em] text-foreground">
                    Ritmo da sessao
                  </h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Janela local para acompanhar o pulso de entrada e a aceleracao de falhas.
                </p>
              </div>
              <div className="grid gap-5 p-5 lg:grid-cols-2 lg:p-6">
                <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">Requisicoes por minuto</div>
                      <div className="text-xs text-muted-foreground">baseado nas ultimas {history.length} amostras</div>
                    </div>
                    <Badge className="rounded-full border-sky-400/20 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      {latestRequestRate.toFixed(1)}/min
                    </Badge>
                  </div>
                  <div className="mt-4">{renderTrendBars(history, "requestsPerMinute", "bg-sky-500")}</div>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">Erros por minuto</div>
                      <div className="text-xs text-muted-foreground">acompanha picos recentes de degrado</div>
                    </div>
                    <Badge className="rounded-full border-rose-400/20 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                      {latestErrorRatePerMinute.toFixed(2)}/min
                    </Badge>
                  </div>
                  <div className="mt-4">{renderTrendBars(history, "errorsPerMinute", "bg-rose-500")}</div>
                </div>
              </div>
            </section>
            <section className="overflow-hidden rounded-[30px] border border-border/70 bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.4)]">
              <div className="border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <Route size={16} className="text-primary" />
                  <h3 className="text-lg font-black tracking-[-0.03em] text-foreground">
                    Rotas mais acionadas
                  </h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Volume acumulado por rota normalizada para separar carga de risco.
                </p>
              </div>
              <div className="space-y-3 p-5 sm:p-6">
                {topRoutes.length === 0 ? (
                  <EmptyState
                    title="Nenhuma rota apareceu nas metricas atuais."
                    description="Sem contadores acumulados de requisicao na leitura recebida."
                    icon={<Route size={16} />}
                  />
                ) : (
                  topRoutes.map((item, index) => {
                    const maxRequests = topRoutes[0]?.requests ?? 0;
                    return (
                      <div key={item.key} className="rounded-[22px] border border-border/70 bg-background/70 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {index + 1}
                              </span>
                              <span className="truncate font-mono text-sm text-foreground">{item.label}</span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full", routeTone(item))}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    maxRequests > 0 ? (item.requests / maxRequests) * 100 : 0
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge variant="outline" className="rounded-full">
                                erros {formatCompactNumber(item.errors)}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                taxa {formatPercentage(item.errorRate)}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                media {formatLatency(item.avgLatencyMs)}
                              </Badge>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-2xl font-black tracking-[-0.04em] text-foreground">
                              {formatCompactNumber(item.requests)}
                            </div>
                            <div className="text-xs text-muted-foreground">req</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-4">
            <section className="overflow-hidden rounded-[30px] border border-border/70 bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.4)]">
              <div className="border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-primary" />
                  <h3 className="text-lg font-black tracking-[-0.03em] text-foreground">
                    Feed de eventos recentes
                  </h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sequencia de eventos estruturados para auth, presence e falhas operacionais.
                </p>
              </div>
              <div className="max-h-[36rem] space-y-3 overflow-y-auto p-5 sm:p-6">
                {recentOps.length === 0 ? (
                  <EmptyState
                    title="Nenhum evento estruturado recente foi encontrado."
                    description="A API nao devolveu logs recentes com contexto operacional utilizavel."
                    icon={<Activity size={16} />}
                  />
                ) : (
                  recentOps.map((item) => (
                    <div
                      key={`recent-op-${item.id}`}
                      className="rounded-[24px] border border-border/70 bg-background/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{item.action}</span>
                            {item.statusCode ? (
                              <Badge
                                className={cn(
                                  "rounded-full",
                                  item.statusCode >= 200 && item.statusCode < 300
                                    ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300"
                                    : item.statusCode >= 400 && item.statusCode < 500
                                      ? "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300"
                                      : "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300"
                                )}
                              >
                                {item.statusCode}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {item.endpoint ?? item.entityType ?? "operacao"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-foreground">
                            {timeAgoFromIso(item.createdAt)}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {formatDateTime(item.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.method ? (
                          <Badge variant="outline" className="rounded-full">
                            {item.method}
                          </Badge>
                        ) : null}
                        {item.entityId ? (
                          <Badge variant="outline" className="rounded-full" title={item.entityId}>
                            ID {item.entityId.slice(0, 12)}
                          </Badge>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl border-border/70 bg-background/80 px-3 text-[11px]"
                          onClick={() => setPayloadLog(item)}
                        >
                          Ver payload
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl border-border/70 bg-background/80 px-3 text-[11px]"
                          onClick={() => copyPayload(item)}
                        >
                          <Copy size={11} className="mr-1" />
                          Copiar payload
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </FadeInUp>

      <Dialog
        open={payloadLog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPayloadLog(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden border-border/70 bg-card p-0 text-foreground">
          <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-5">
            <DialogTitle className="text-foreground">Payload do log</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {payloadLog ? (
                <>
                  Log <strong>#{payloadLog.id}</strong> em{" "}
                  <strong>{payloadLog.endpoint ?? payloadLog.entityType}</strong>.
                </>
              ) : (
                "Inspecione o payload estruturado do log."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto p-6">
            <pre className="overflow-x-auto rounded-[24px] border border-border/70 bg-background/90 p-4 text-xs leading-6 text-foreground">
              <code>
                {payloadLog ? JSON.stringify(buildActivityLogPayload(payloadLog), null, 2) : ""}
              </code>
            </pre>
          </div>

          <DialogFooter className="border-t border-border/70 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
              onClick={() => copyPayload(payloadLog)}
            >
              <Copy size={16} />
              Copiar payload
            </Button>
            <Button type="button" className="h-11 rounded-xl px-4" onClick={() => setPayloadLog(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ErrorLinesDialog dialog={errorDialog} onClose={closeErrorDialog} />
    </DashboardLayout>
  );
}
