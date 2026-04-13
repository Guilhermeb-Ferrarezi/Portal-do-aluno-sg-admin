import React from "react";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Gauge,
  Loader2,
  Radar,
  RefreshCcw,
  Route,
  Search,
  Server,
  ShieldAlert,
  TimerReset,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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

function buildBarStyle(value: number, max: number) {
  const ratio = max > 0 ? value / max : 0;
  return {
    height: `${Math.max(8, ratio * 100)}%`,
  };
}

function renderTrendBars(
  items: MetricHistoryPoint[],
  valueKey: "requestsPerMinute" | "errorsPerMinute",
  barClassName: string
) {
  const max = items.reduce((acc, item) => Math.max(acc, item[valueKey]), 0);

  return (
    <div className="flex h-32 items-end gap-1.5">
      {items.map((item) => (
        <div
          key={`${valueKey}-${item.capturedAt}`}
          className="group relative flex flex-1 flex-col justify-end"
          title={`${timeLabel(item.capturedAt)} - ${item[valueKey].toFixed(2)}/min`}
        >
          <div
            className={cn(
              "w-full rounded-t-xl transition-all duration-300 group-hover:opacity-100",
              barClassName
            )}
            style={buildBarStyle(item[valueKey], max)}
          />
        </div>
      ))}
    </div>
  );
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
  if (statusClass.startsWith("5")) return "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300";
  if (statusClass.startsWith("4")) return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300";
  return "border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:text-slate-300";
}

function routeTone(item: MonitoringBreakdownItem) {
  if (item.errorRate >= 10) return "bg-rose-500/80";
  if (item.errorRate > 0) return "bg-amber-500/80";
  return "bg-emerald-500/80";
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

function MetricCard(props: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accentClass: string;
  onAction?: { label: string; onClick: () => void };
}) {
  return (
    <Card className="flex h-full flex-col rounded-[28px] border-border bg-card shadow-sm">
      <CardContent className="flex flex-1 items-start gap-4 p-5">
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
            props.accentClass
          )}
        >
          {props.icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {props.title}
          </div>
          <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-foreground">
            {props.value}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{props.subtitle}</div>
        </div>
      </CardContent>
      {props.onAction && (
        <div className="mt-auto border-t border-border px-5 pb-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={props.onAction.onClick}
            className="h-8 rounded-xl px-2 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400"
          >
            <Search size={12} className="mr-1.5" />
            {props.onAction.label}
          </Button>
        </div>
      )}
    </Card>
  );
}

function ErrorLinesDialog(props: {
  dialog: ErrorDialog;
  onClose: () => void;
}) {
  const { dialog, onClose } = props;
  return (
    <Dialog open={dialog.open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-500" />
            {dialog.title}
          </DialogTitle>
          <DialogDescription>
            Contadores acumulados de erros HTTP desde o ultimo boot da API (fonte: Prometheus).
          </DialogDescription>
        </DialogHeader>

        {dialog.lines.length === 0 ? (
          <div className="px-6 pb-6 text-center text-sm text-muted-foreground">
            Nenhum erro registrado para esta rota.
          </div>
        ) : (
          <div className="overflow-y-auto px-6 pb-6">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="hidden grid-cols-[80px_1fr_90px_80px_60px] gap-3 border-b border-border bg-muted px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:grid">
                <span>Metodo</span>
                <span>Rota</span>
                <span>Status</span>
                <span>Classe</span>
                <span className="text-right">Total</span>
              </div>
              {dialog.lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[80px_1fr_90px_80px_60px] sm:items-center sm:gap-3"
                >
                  <Badge variant="outline" className="w-fit rounded-full px-2.5 text-[11px] font-semibold">
                    {line.method}
                  </Badge>
                  <span className="truncate font-mono text-xs text-foreground" title={line.route}>
                    {line.route || "-"}
                  </span>
                  <Badge className={cn("w-fit rounded-full px-2.5 text-[11px] font-semibold", statusLineBadge(line.statusClass))}>
                    {line.statusCode}
                  </Badge>
                  <Badge className={cn("w-fit rounded-full px-2.5 text-[11px] font-semibold", statusLineBadge(line.statusClass))}>
                    {line.statusClass}
                  </Badge>
                  <span className="text-right text-sm font-black text-foreground sm:block">
                    {line.count}
                  </span>
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
        if (item.route || item.source || item.statusCode || item.outcome || item.errorType) {
          return true;
        }
        return item.entityType === "auth" || item.entityType === "presence" || item.entityType === "security";
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
  const errorRate =
    totals && totals.requests > 0 ? (totals.errors / totals.requests) * 100 : 0;
  const topRoutes = React.useMemo(() => (snapshot?.routes ?? []).slice(0, 6), [snapshot]);
  const criticalRoutes = React.useMemo(
    () => (snapshot?.criticalRoutes ?? []).slice(0, 6),
    [snapshot]
  );
  const methods = snapshot?.methods ?? [];
  const statuses = snapshot?.statuses ?? [];
  const riskRoutes = React.useMemo(
    () =>
      [...(snapshot?.routes ?? [])]
        .sort(
          (a, b) =>
            b.errorRate * 2 +
            b.avgLatencyMs / 1000 -
            (a.errorRate * 2 + a.avgLatencyMs / 1000)
        )
        .slice(0, 6),
    [snapshot]
  );
  const incidentSummaries = React.useMemo<IncidentSummary[]>(() => {
    const grouped = new Map<string, IncidentSummary>();

    for (const item of recentOps) {
      if (!item.errorType && item.outcome !== "error" && item.outcome !== "denied") continue;

      const route = item.route ?? "-";
      const source = item.source ?? item.action;
      const errorType = item.errorType ?? "Sem classificacao";
      const outcome = item.outcome ?? "unknown";
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

  if (loading) {
    return (
      <DashboardLayout
        title="Observabilidade"
        subtitle="Metricas operacionais da API em tempo real"
      >
        <div className="rounded-[28px] border border-border bg-card px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-primary">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-semibold">Carregando metricas...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Observabilidade"
      subtitle="Leitura visual das metricas expostas pela API do portal"
    >
      <FadeInUp duration={0.28}>
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-[32px] border-transparent bg-[var(--hero-glow),var(--hero-surface)] text-foreground shadow-[0_28px_90px_-42px_rgba(20,32,19,0.22)]">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/72">
                    <Radar size={14} />
                    API pulse
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
                    Observabilidade com hierarquia de produto
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Acompanhe saude da API, hotspots de risco e incidentes recentes com uma leitura mais clara e acionavel.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-300">
                    <Server size={13} className="mr-1.5" />
                    API online
                  </Badge>
                  <Badge className="rounded-full border-black/8 bg-white/55 px-3 py-1.5 text-foreground/80">
                    ultima leitura {lastCaptureLabel}
                  </Badge>
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
              </div>
            </CardContent>
          </Card>

          {error ? (
            <Card className="rounded-[28px] border-rose-500/20 bg-rose-500/5 shadow-[0_20px_50px_-36px_rgba(239,68,68,0.4)]">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
                  <AlertTriangle size={20} />
                </div>
                <div className="text-base font-semibold text-foreground">Falha ao carregar metricas</div>
                <div className="max-w-xl text-sm text-muted-foreground">{error}</div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ScaleIn delay={0}>
              <MetricCard
                title="Requisicoes"
                value={formatCompactNumber(totals?.requests ?? 0)}
                subtitle="contador acumulado desde o boot"
                icon={<Activity size={20} />}
                accentClass="border-sky-500/20 bg-sky-500/10 text-sky-500"
              />
            </ScaleIn>
            <ScaleIn delay={0.05}>
              <MetricCard
                title="Erros"
                value={formatCompactNumber(totals?.errors ?? 0)}
                subtitle={`${formatPercentage(errorRate)} de taxa de erro total`}
                icon={<ShieldAlert size={20} />}
                accentClass="border-rose-500/20 bg-rose-500/10 text-rose-500"
                onAction={{
                  label: "Ver detalhes dos erros",
                  onClick: () => openErrorDialog("Todos os erros HTTP"),
                }}
              />
            </ScaleIn>
            <ScaleIn delay={0.1}>
              <MetricCard
                title="Latencia media"
                value={formatLatency(totals?.avgLatencyMs ?? 0)}
                subtitle="media acumulada das requisicoes"
                icon={<Clock3 size={20} />}
                accentClass="border-amber-500/20 bg-amber-500/10 text-amber-500"
              />
            </ScaleIn>
            <ScaleIn delay={0.15}>
              <MetricCard
                title="P95"
                value={formatLatency(totals?.p95LatencyMs ?? 0)}
                subtitle="estimado a partir do histograma da API"
                icon={<Gauge size={20} />}
                accentClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
              />
            </ScaleIn>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="rounded-[30px] border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <Waves size={16} className="text-primary" />
                  Ritmo recente
                </CardTitle>
                <CardDescription>
                  Estimativa por minuto baseada nas ultimas leituras desta sessao.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 p-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Requisicoes/min</div>
                      <div className="text-xs text-muted-foreground">janela local de {history.length} amostras</div>
                    </div>
                    <Badge className="rounded-full border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:text-sky-300">
                      {history.at(-1)?.requestsPerMinute?.toFixed(1) ?? "0.0"}/min
                    </Badge>
                  </div>
                  {renderTrendBars(history, "requestsPerMinute", "bg-sky-500/80")}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Erros/min</div>
                      <div className="text-xs text-muted-foreground">acompanha saltos recentes de falha</div>
                    </div>
                    <Badge className="rounded-full border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300">
                      {history.at(-1)?.errorsPerMinute?.toFixed(2) ?? "0.00"}/min
                    </Badge>
                  </div>
                  {renderTrendBars(history, "errorsPerMinute", "bg-rose-500/80")}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[30px] border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <TimerReset size={16} className="text-primary" />
                  Metodos e classes de status
                </CardTitle>
                <CardDescription>
                  Quebra atual das chamadas da API pela exposicao de metricas.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 p-5">
                <div className="space-y-3">
                  {methods.map((item) => (
                    <div key={item.method} className="rounded-2xl border border-border bg-muted/40 p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-foreground">{item.method}</div>
                        <div className="text-xs text-muted-foreground">{formatCompactNumber(item.requests)} req</div>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.min(100, methods[0]?.requests ? (item.requests / methods[0].requests) * 100 : 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {statuses.map((item) => (
                    <Badge
                      key={item.statusClass}
                      className={cn("rounded-full px-3 py-1.5", statusBadgeClass(item.statusClass))}
                    >
                      {item.statusClass}: {formatCompactNumber(item.requests)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[30px] border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <Route size={16} className="text-primary" />
                  Rotas mais acionadas
                </CardTitle>
                <CardDescription>
                  Contagem acumulada por rota normalizada da API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {topRoutes.map((item, index) => {
                  const maxRequests = topRoutes[0]?.requests ?? 0;
                  return (
                    <div key={item.key} className="rounded-[22px] border border-border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
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
                                width: `${Math.min(100, maxRequests > 0 ? (item.requests / maxRequests) * 100 : 0)}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-black tracking-[-0.03em] text-foreground">
                            {formatCompactNumber(item.requests)}
                          </div>
                          <div className="text-xs text-muted-foreground">req</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">
                          erros {formatCompactNumber(item.errors)}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          taxa {formatPercentage(item.errorRate)}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          media {formatLatency(item.avgLatencyMs)}
                        </Badge>
                        {item.errors > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openErrorDialog(`Erros — ${item.label}`, item.key)}
                            className="h-7 rounded-xl border border-rose-300/40 bg-rose-500/8 px-3 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/15 dark:border-rose-500/25 dark:text-rose-300"
                          >
                            <Search size={11} className="mr-1" />
                            Ver erros
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-primary" />
                  Rotas criticas
                </CardTitle>
                <CardDescription>
                  Recorte operacional para auth, presence, activity logs e metrics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {criticalRoutes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 p-4 text-sm text-muted-foreground">
                    Nenhuma rota critica foi capturada nas metricas atuais.
                  </div>
                ) : (
                  criticalRoutes.map((item) => (
                    <div
                      key={`critical-${item.key}`}
                      className="rounded-2xl border/primary var(--surface-2) p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm text-foreground">
                            {item.label}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatCompactNumber(item.requests)} req · {formatCompactNumber(item.errors)} erros
                          </div>
                        </div>
                        <Badge className={cn("rounded-full", statusBadgeClass(item.errorRate > 0 ? "5xx" : "2xx"))}>
                          {formatPercentage(item.errorRate)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="rounded-full">
                          media {formatLatency(item.avgLatencyMs)}
                        </Badge>
                        {item.errors > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openErrorDialog(`Erros - ${item.label}`, item.key)}
                            className="h-7 rounded-xl border border-rose-300/40 bg-rose-500/8 px-3 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/15 dark:border-rose-500/25 dark:text-rose-300"
                          >
                            <Search size={11} className="mr-1" />
                            Ver erros
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-primary" />
                  Mapa rapido de risco
                </CardTitle>
                <CardDescription>
                  Prioriza rotas com mais erro relativo ou latencia media mais alta.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {riskRoutes.map((item) => (
                  <div
                    key={`risk-${item.key}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/20 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm text-foreground">{item.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatCompactNumber(item.requests)} req · {formatCompactNumber(item.errors)} erros
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={cn("rounded-full", statusBadgeClass(item.errorRate > 0 ? "5xx" : "2xx"))}>
                        {formatPercentage(item.errorRate)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">{formatLatency(item.avgLatencyMs)}</div>
                      {item.errors > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openErrorDialog(`Erros — ${item.label}`, item.key)}
                          className="mt-0.5 h-6 rounded-xl border border-rose-300/40 bg-rose-500/8 px-2.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/15 dark:border-rose-500/25 dark:text-rose-300"
                        >
                          <Search size={10} className="mr-1" />
                          Ver erros
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="flex items-center gap-2">
                  <Activity size={16} className="text-primary" />
                  Eventos operacionais recentes
                </CardTitle>
                <CardDescription>
                  Ultimos eventos estruturados de auth, presence e falhas operacionais.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[34rem] space-y-3 overflow-y-auto p-5">
                {recentOps.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 p-4 text-sm text-muted-foreground">
                    Nenhum evento estruturado recente foi encontrado.
                  </div>
                ) : (
                  recentOps.map((item) => (
                    <div
                      key={`recent-op-${item.id}`}
                      className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {item.source ?? item.action}
                            </span>
                            {item.outcome && (
                              <Badge className={cn("rounded-full", outcomeBadgeClass(item.outcome))}>
                                {item.outcome}
                              </Badge>
                            )}
                            {item.statusCode && (
                              <Badge variant="outline" className="rounded-full">
                                {item.statusCode}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {item.route ?? "rota nao informada"}
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
                        {item.errorType && (
                          <Badge variant="outline" className="rounded-full">
                            erro {item.errorType}
                          </Badge>
                        )}
                        {item.contextArea && (
                          <Badge variant="outline" className="rounded-full">
                            area {item.contextArea}
                          </Badge>
                        )}
                        {item.requestId && (
                          <Badge variant="outline" className="rounded-full" title={item.requestId}>
                            req {item.requestId.slice(0, 12)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-primary" />
                  Assinaturas de falha recentes
                </CardTitle>
                <CardDescription>
                  Agrupamento local por rota, source, error type e outcome.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {incidentSummaries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 p-4 text-sm text-muted-foreground">
                    Nenhuma assinatura de falha apareceu nos eventos recentes.
                  </div>
                ) : (
                  incidentSummaries.map((item) => (
                    <div
                      key={`incident-${item.key}`}
                      className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {item.errorType}
                          </div>
                          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                            {item.route}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black tracking-[-0.03em] text-foreground">
                            {item.count}
                          </div>
                          <div className="text-[11px] text-muted-foreground">ocorrencias</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className={cn("rounded-full", outcomeBadgeClass(item.outcome))}>
                          {item.outcome}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {item.source}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          ultimo {timeAgoFromIso(item.lastAt)}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </FadeInUp>

      <ErrorLinesDialog dialog={errorDialog} onClose={closeErrorDialog} />
    </DashboardLayout>
  );
}
