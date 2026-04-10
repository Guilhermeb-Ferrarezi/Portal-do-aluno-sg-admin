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
  Server,
  ShieldAlert,
  TimerReset,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { FadeInUp } from "../components/animate-ui/FadeInUp";
import { ScaleIn } from "../components/animate-ui/ScaleIn";
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

const REFRESH_INTERVAL_MS = 15000;
const HISTORY_LIMIT = 24;

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

function routeTone(item: MonitoringBreakdownItem) {
  if (item.errorRate >= 10) return "bg-rose-500/80";
  if (item.errorRate > 0) return "bg-amber-500/80";
  return "bg-emerald-500/80";
}

function MetricCard(props: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
            props.accentClass
          )}
        >
          {props.icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {props.title}
          </div>
          <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-foreground">
            {props.value}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{props.subtitle}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminObservabilityPage() {
  const [snapshot, setSnapshot] = React.useState<MonitoringSnapshot | null>(null);
  const [history, setHistory] = React.useState<MetricHistoryPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadSnapshot = React.useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const next = await fetchMonitoringSnapshot();
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
  const lastCaptureLabel = snapshot ? timeLabel(snapshot.capturedAt) : "--:--";

  if (loading) {
    return (
      <DashboardLayout
        title="Observabilidade"
        subtitle="Metricas operacionais da API em tempo real"
      >
        <div className="rounded-[28px] border border-border/70 bg-card/95 px-6 py-16 text-center shadow-sm">
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
          <Card className="overflow-hidden rounded-[32px] border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(225,29,72,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.9))] text-white shadow-[0_28px_90px_-42px_rgba(0,0,0,0.9)]">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/72">
                    <Radar size={14} />
                    API pulse
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
                    Visao operacional do admin portal
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                    A tela consolida os contadores atuais da API e estima a cadencia recente pela ultima janela observada no navegador.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-emerald-100">
                    <Server size={13} className="mr-1.5" />
                    API online
                  </Badge>
                  <Badge className="rounded-full border-white/10 bg-white/10 px-3 py-1.5 text-white/80">
                    ultima leitura {lastCaptureLabel}
                  </Badge>
                  <Button
                    type="button"
                    onClick={() => void loadSnapshot(true)}
                    className="h-10 rounded-xl bg-white text-slate-950 hover:bg-white/90"
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
            <Card className="rounded-[28px] border-rose-500/20 bg-rose-500/5 shadow-sm">
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

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="border-b border-border/70">
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

            <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="border-b border-border/70">
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
                    <div key={item.method} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
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

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="border-b border-border/70">
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
                    <div key={item.key} className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
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
                  );
                })}
              </CardContent>
            </Card>

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
                    <div className="text-right">
                      <Badge className={cn("rounded-full", statusBadgeClass(item.errorRate > 0 ? "5xx" : "2xx"))}>
                        {formatPercentage(item.errorRate)}
                      </Badge>
                      <div className="mt-1 text-xs text-muted-foreground">{formatLatency(item.avgLatencyMs)}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
