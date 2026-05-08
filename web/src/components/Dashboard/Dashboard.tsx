import React from "react";
import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import DashboardLayout from "./DashboardLayout";
import { getName, getRole } from "../../auth/auth";
import { FadeInUp } from "../animate-ui";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { appRoutes } from "@/router/routes";
import {
  listarTurmas,
  obterTurmasResponsavel,
  obterTotalTurmas,
  obterContagemAlunosDashboard,
  listarExercicios,
  todasMinhasSubmissoes,
  fetchMonitoringSnapshot,
  listarActivityLogs,
  listarDisparosNotificacao,
  type ActivityLog,
  type Exercicio,
  type MonitoringSnapshot,
  type NotificationDispatch,
  type Submissao,
} from "../../services/api";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  PenLine,
  Radar,
  RefreshCcw,
  School,
  Users,
  UserPlus,
  Copy,
  CheckCheck,
} from "lucide-react";

function ordenarExerciciosRecentes(items: Exercicio[]) {
  return [...items]
    .sort((a, b) => {
      const da = new Date(a.publishedAt ?? a.prazo ?? a.createdAt ?? 0).getTime();
      const db = new Date(b.publishedAt ?? b.prazo ?? b.createdAt ?? 0).getTime();
      return db - da;
    })
    .slice(0, 6);
}

function isSameDay(dateA: string | null | undefined, reference: Date) {
  if (!dateA) return false;
  const value = new Date(dateA);
  return (
    value.getFullYear() === reference.getFullYear() &&
    value.getMonth() === reference.getMonth() &&
    value.getDate() === reference.getDate()
  );
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `ha ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `ha ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `ha ${diffDays}d`;
}

function humanizeToken(value: string | null | undefined) {
  if (!value) return "atividade";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function getInitials(name: string | null | undefined) {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "N") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "A");
}

function buildActivityLabel(item: ActivityLog) {
  const actorName = item.actor?.name?.trim() || "Aluno";
  if (item.entityType === "submission" || item.action.includes("submiss")) {
    return `${actorName} enviou uma submissao`;
  }
  if (item.action.includes("exercise") || item.entityType === "exercise") {
    return `${actorName} interagiu com exercicios`;
  }
  if (item.action.includes("goal") || item.entityType === "goal_student") {
    return `${actorName} atualizou uma meta`;
  }
  return `${actorName} - ${humanizeToken(item.action)}`;
}

const mainCardClass =
  "rounded-[22px] border border-border/90 bg-card shadow-[0_16px_42px_rgba(15,23,42,0.08)]";
const secondaryCardClass =
  "rounded-[18px] border border-border/90 bg-card shadow-[0_10px_24px_rgba(15,23,42,0.06)]";
const sectionCardClass = cn(mainCardClass, "p-5 sm:p-6");
const eyebrowClass =
  "text-[0.68rem] font-black uppercase tracking-[0.24em] text-muted-foreground/80";

function LoadingDashboardCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? `${secondaryCardClass} p-4` : `${mainCardClass} p-5`}>
      <Skeleton className="h-3 w-24 rounded bg-muted/60" />
      <Skeleton className="mt-4 h-10 w-20 rounded bg-muted/70" />
      <Skeleton className="mt-3 h-3 w-36 rounded bg-muted/60" />
      <Skeleton className="mt-2 h-3 w-28 rounded bg-muted/50" />
    </div>
  );
}

function MainKpiCard({
  label,
  value,
  subtext,
  icon,
  delay,
}: {
  label: string;
  value: React.ReactNode;
  subtext: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <m.div
      className={`${mainCardClass} p-5`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.18 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={eyebrowClass}>{label}</div>
        <div className="text-foreground/45">{icon}</div>
      </div>
      <div className="mt-4 text-5xl font-black tracking-[-0.07em] text-foreground tabular-nums">
        {value}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{subtext}</p>
    </m.div>
  );
}

function SecondaryStatCard({
  label,
  value,
  subtext,
  icon,
  tone = "neutral",
  delay,
}: {
  label: string;
  value: React.ReactNode;
  subtext: string;
  icon: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "info" | "danger";
  delay: number;
}) {
  const toneClass = {
    neutral: "bg-muted/35 text-muted-foreground",
    success: "bg-emerald-500/12 text-emerald-600",
    warning: "bg-amber-500/12 text-amber-600",
    info: "bg-sky-500/12 text-sky-600",
    danger: "bg-rose-500/12 text-rose-600",
  }[tone];

  return (
    <m.div
      className={`${secondaryCardClass} flex items-start gap-4 p-4`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.18 }}
    >
      <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl", toneClass)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">{label}</div>
          </div>
          <div className="shrink-0 text-2xl font-black tracking-[-0.05em] text-foreground tabular-nums">
            {value}
          </div>
        </div>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{subtext}</p>
      </div>
    </m.div>
  );
}

function HealthBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground tabular-nums">
          {value}/{Math.max(total, 1)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
        <div className={cn("h-full rounded-full", colorClass)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function UtilityChip({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-full border border-border/80 bg-background/75 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
      <span>{label}: </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const name = getName() ?? "Aluno";
  const role = getRole();
  const isAdmin = role === "admin";
  const isManagementView = role === "admin" || role === "professor";

  const [totalTurmasAluno, setTotalTurmasAluno] = React.useState(0);
  const [hasTurmas, setHasTurmas] = React.useState(false);
  const [turmasResponsavel, setTurmasResponsavel] = React.useState(0);
  const [totalTurmasDoSistema, setTotalTurmasDoSistema] = React.useState(0);
  const [totalAlunos, setTotalAlunos] = React.useState(0);
  const [totalAlunosDoSistema, setTotalAlunosDoSistema] = React.useState(0);
  const [totalExercicios, setTotalExercicios] = React.useState(0);
  const [totalExerciciosPublicados, setTotalExerciciosPublicados] = React.useState(0);
  const [exerciciosProgramados, setExerciciosProgramados] = React.useState(0);
  const [exerciciosRascunho, setExerciciosRascunho] = React.useState(0);
  const [exerciciosPendentes, setExerciciosPendentes] = React.useState(0);
  const [exerciciosRecentes, setExerciciosRecentes] = React.useState<Exercicio[]>([]);
  const [submissoes, setSubmissoes] = React.useState<Submissao[]>([]);
  const [monitoring, setMonitoring] = React.useState<MonitoringSnapshot | null>(null);
  const [activityFeed, setActivityFeed] = React.useState<ActivityLog[]>([]);
  const [dispatches, setDispatches] = React.useState<NotificationDispatch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setErro(null);

        if (isManagementView) {
          const [
            turmasResponsavelResult,
            totalTurmasResult,
            contagemAlunos,
            paginaExercicios,
            programadosResult,
            publicadosResult,
            rascunhosResult,
            monitoringResult,
            activityLogsResult,
            notificationDispatchesResult,
          ] = await Promise.all([
            obterTurmasResponsavel().catch(() => ({ total: 0 })),
            obterTotalTurmas().catch(() => ({ total: 0 })),
            obterContagemAlunosDashboard().catch(() => ({ total: 0, totalSistema: 0 })),
            listarExercicios({ page: 1, limit: 6, status: "todos" }),
            listarExercicios({ page: 1, limit: 1, status: "programado" }),
            listarExercicios({ page: 1, limit: 1, status: "publicado" }),
            listarExercicios({ page: 1, limit: 1, status: "rascunho" }),
            isAdmin ? fetchMonitoringSnapshot().catch(() => null) : Promise.resolve(null),
            isAdmin
              ? listarActivityLogs({ limit: 5, offset: 0, actorGroup: "user" }).catch(() => ({ items: [], total: 0 }))
              : Promise.resolve({ items: [], total: 0 }),
            isAdmin
              ? listarDisparosNotificacao({ limit: 5, offset: 0 }).catch(() => ({ items: [], total: 0 }))
              : Promise.resolve({ items: [], total: 0 }),
          ]);

          if (!active) return;

          setTurmasResponsavel(turmasResponsavelResult.total);
          setTotalTurmasDoSistema(totalTurmasResult.total);
          setHasTurmas(turmasResponsavelResult.total > 0);
          setTotalAlunos(contagemAlunos.total);
          setTotalAlunosDoSistema(contagemAlunos.totalSistema ?? 0);
          setTotalExercicios(paginaExercicios.total);
          setTotalExerciciosPublicados(publicadosResult.total);
          setExerciciosProgramados(programadosResult.total);
          setExerciciosRascunho(rascunhosResult.total);
          setExerciciosPendentes(0);
          setExerciciosRecentes(ordenarExerciciosRecentes(paginaExercicios.items));
          setMonitoring(monitoringResult);
          setActivityFeed(activityLogsResult.items);
          setDispatches(notificationDispatchesResult.items);
        } else {
          const [turmasPage, exerciciosData, contagemAlunos] = await Promise.all([
            listarTurmas({ page: 1, limit: 1 }).catch(() => ({
              items: [],
              total: 0,
              pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
            })),
            listarExercicios(),
            obterContagemAlunosDashboard().catch(() => ({ total: 0, totalSistema: 0 })),
          ]);

          if (!active) return;

          const now = new Date();
          const programados = exerciciosData.filter(
            (e) => !!e.publishedAt && new Date(e.publishedAt) > now
          ).length;
          const pendentes = exerciciosData.filter(
            (e) => !!e.prazo && new Date(e.prazo) > now
          ).length;

          setTotalTurmasAluno(turmasPage.total);
          setHasTurmas(turmasPage.total > 0);
          setTotalAlunos(contagemAlunos.total);
          setTotalAlunosDoSistema(contagemAlunos.totalSistema ?? 0);
          setTotalExercicios(exerciciosData.length);
          setTotalExerciciosPublicados(exerciciosData.length);
          setExerciciosProgramados(programados);
          setExerciciosRascunho(0);
          setExerciciosPendentes(pendentes);
          setExerciciosRecentes(ordenarExerciciosRecentes(exerciciosData));
          setMonitoring(null);
          setActivityFeed([]);
          setDispatches([]);
        }

        void todasMinhasSubmissoes()
          .then((submissoesData) => {
            if (!active) return;
            setSubmissoes(submissoesData);
          })
          .catch(() => {
            if (!active) return;
            setSubmissoes([]);
          });
      } catch (e) {
        if (!active) return;
        setErro(e instanceof Error ? e.message : "Erro ao carregar dados do dashboard");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isAdmin, isManagementView]);

  const now = React.useMemo(() => new Date(), []);
  const yesterday = React.useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }, []);

  const exerciciosConcluidos = React.useMemo(
    () => new Set(submissoes.map((item) => item.exercicioId)).size,
    [submissoes]
  );
  const exerciciosAtivos = Math.max(totalExerciciosPublicados - exerciciosProgramados, 0);
  const submissoesHoje = React.useMemo(
    () => submissoes.filter((item) => isSameDay(item.createdAt, now)).length,
    [now, submissoes]
  );
  const submissoesOntem = React.useMemo(
    () => submissoes.filter((item) => isSameDay(item.createdAt, yesterday)).length,
    [submissoes, yesterday]
  );
  const pendenciasCorrecao = React.useMemo(
    () => submissoes.filter((item) => !item.corrigida).length,
    [submissoes]
  );
  const deltaSubmissoes = submissoesHoje - submissoesOntem;
  const errorRatePercent = monitoring?.totals.requests
    ? Math.round(((monitoring.totals.requests - monitoring.totals.errors) / monitoring.totals.requests) * 100)
    : 100;
  const activeAlerts = monitoring
    ? monitoring.criticalRoutes.filter((item) => item.errorRate >= 2 || item.avgLatencyMs >= 1200).length
    : 0;
  const criticalRoutesHealthy = monitoring
    ? monitoring.criticalRoutes.filter((item) => item.errorRate < 2 && item.avgLatencyMs < 1200).length
    : 0;
  const saudePercent = isAdmin && monitoring ? errorRatePercent : (
    totalExerciciosPublicados > 0
      ? Math.round((exerciciosAtivos / totalExerciciosPublicados) * 100)
      : 0
  );
  const engajamentoMedio = totalExercicios > 0
    ? Math.round((exerciciosConcluidos / totalExercicios) * 100)
    : 0;
  const disparosHoje = dispatches.filter((item) => isSameDay(item.createdAt, now)).length;
  const mediaAlunosPorTurma = turmasResponsavel > 0 ? Math.round(totalAlunos / turmasResponsavel) : 0;
  const progressoLabelA = "Turmas";
  const progressoValueA = isManagementView
    ? isAdmin && totalTurmasDoSistema > 0
      ? `${turmasResponsavel}/${totalTurmasDoSistema}`
      : `${turmasResponsavel}`
    : `${totalTurmasAluno}`;
  const progressoLabelB = isManagementView ? "Exercicios ativos" : "Exercicios resolvidos";
  const progressoValueB = isManagementView
    ? `${exerciciosAtivos}/${Math.max(totalExerciciosPublicados, 1)}`
    : `${exerciciosConcluidos}/${Math.max(totalExercicios, 1)}`;
  const taxaAgendamento = totalExerciciosPublicados > 0
    ? Math.round((exerciciosProgramados / totalExerciciosPublicados) * 100)
    : 0;
  const dashboardQuickActions = React.useMemo(() => {
    if (role === "admin") {
      return [
        { label: "Criar usuario", icon: UserPlus, to: appRoutes.criarUsuario },
        {
          label: totalTurmasDoSistema === 0 ? "Criar primeira turma" : "Gerenciar turmas",
          icon: School,
          to: appRoutes.turmas,
        },
        { label: "Criar exercicio", icon: PenLine, to: appRoutes.estruturaCurso.tab("exercicios") },
        {
          label: "Ver observabilidade",
          icon: Radar,
          to: appRoutes.observabilidade,
          visible: activeAlerts > 0,
        },
      ];
    }

    if (role === "professor") {
      return [
        {
          label: pendenciasCorrecao > 0 ? "Revisar pendencias" : "Ver exercicios",
          icon: pendenciasCorrecao > 0 ? CheckCheck : Copy,
          to: appRoutes.exercicios,
        },
        {
          label: turmasResponsavel === 0 ? "Criar primeira turma" : "Ver minhas turmas",
          icon: School,
          to: appRoutes.turmas,
        },
        { label: "Adicionar aluno", icon: UserPlus, to: appRoutes.turmas, visible: turmasResponsavel > 0 },
      ];
    }

    return [
      { label: "Ultimo exercicio", icon: BookOpen, to: appRoutes.exercicios, visible: totalExercicios > 0 },
      { label: "Ver pendentes", icon: CheckCheck, to: appRoutes.exercicios },
    ];
  }, [activeAlerts, pendenciasCorrecao, role, totalExercicios, totalTurmasDoSistema, turmasResponsavel]);

  if (loading) {
    return (
      <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
            {Array.from({ length: isManagementView ? 4 : 3 }).map((_, index) => (
              <LoadingDashboardCard key={index} />
            ))}
          </div>
          {isManagementView ? (
            <div className="grid gap-4 xl:grid-cols-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <LoadingDashboardCard key={`secondary-${index}`} compact />
              ))}
            </div>
          ) : null}
        </div>
      </DashboardLayout>
    );
  }

  if (erro) {
    return (
      <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Falha ao carregar dashboard
          </h2>
          <p className="text-sm text-muted-foreground">{erro}</p>
          <Button
            variant="outline"
            className="w-fit rounded-md px-4"
            onClick={() => window.location.reload()}
          >
            <RefreshCcw data-icon="inline-start" />
            Tentar novamente
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle={isManagementView ? "Painel operacional das turmas e entregas." : "Resumo rapido da sua rotina de estudos."}
      quickActions={dashboardQuickActions}
    >
      <FadeInUp>
        <div className="flex flex-col gap-5">
          <section className={cn(sectionCardClass, "overflow-hidden p-5 sm:p-6")}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className={eyebrowClass}>Resumo operacional</div>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-foreground sm:text-[2.65rem]">
                  Bem-vindo de volta, {name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {isManagementView
                    ? "Visao consolidada de turmas, exercicios, correcao e saude do fluxo nas ultimas horas."
                    : "Veja seu ritmo recente, exercicios ativos e atalhos para continuar sem sair da tela inicial."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <UtilityChip label="Atualizacao" value="Hoje" />
                <UtilityChip label={progressoLabelA} value={progressoValueA} />
                <UtilityChip label={progressoLabelB} value={progressoValueB} />
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)]">
            <div className="grid gap-4">
              <div
                className={cn(
                  "grid gap-4",
                  isManagementView
                    ? "md:grid-cols-2 2xl:grid-cols-4"
                    : "md:grid-cols-2 xl:grid-cols-3"
                )}
              >
                {(isManagementView || hasTurmas) ? (
                  <MainKpiCard
                    label={isManagementView ? "Turmas geridas" : "Turmas"}
                    value={isManagementView ? String(turmasResponsavel).padStart(2, "0") : String(totalTurmasAluno).padStart(2, "0")}
                    subtext={
                      isAdmin
                        ? `${Math.max(totalTurmasDoSistema - turmasResponsavel, 0)} fora da sua carteira e ${turmasResponsavel} sob leitura direta`
                        : isManagementView
                          ? `${turmasResponsavel} ativas nesta semana`
                          : `${totalTurmasAluno} registradas para voce`
                    }
                    icon={<School size={18} />}
                    delay={0}
                  />
                ) : null}

                {(isManagementView || hasTurmas) ? (
                  <MainKpiCard
                    label="Total alunos"
                    value={totalAlunos}
                    subtext={
                      isAdmin
                        ? `${totalAlunos} sob responsabilidade e ${totalAlunosDoSistema} no sistema`
                        : isManagementView
                          ? `${totalAlunos} vinculados as suas turmas`
                          : `${totalAlunos} colegas no seu ambiente`
                    }
                    icon={<Users size={18} />}
                    delay={0.05}
                  />
                ) : null}

                <MainKpiCard
                  label="Exercicios"
                  value={isManagementView ? totalExerciciosPublicados : totalExercicios}
                  subtext={
                    isManagementView
                      ? `${totalExerciciosPublicados} publicados, ${exerciciosProgramados} agendados e ${exerciciosRascunho} em rascunho`
                      : `${exerciciosPendentes} pendentes para voce`
                  }
                  icon={<BookOpen size={18} />}
                  delay={0.1}
                />

                <MainKpiCard
                  label={isManagementView ? "Saude operacional" : "Progresso"}
                  value={`${saudePercent}%`}
                  subtext={
                    isAdmin && monitoring
                      ? `${criticalRoutesHealthy}/${Math.max(monitoring.criticalRoutes.length, 1)} rotas criticas estaveis`
                      : isManagementView
                        ? `${exerciciosAtivos} exercicios ativos agora`
                        : `${progressoValueB} resolvidos`
                  }
                  icon={<Radar size={18} />}
                  delay={0.15}
                />
              </div>

              <m.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.18 }}
                className={cn(sectionCardClass, "p-0")}
              >
                <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="text-lg font-black tracking-[-0.03em] text-foreground">
                      Exercicios recentes
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Atualizados nas ultimas 48h
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(appRoutes.exercicios)}
                  >
                    Ver todos
                    <ChevronRight size={14} />
                  </Button>
                </div>

                {exerciciosRecentes.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum exercicio disponivel.
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-border/60">
                    {exerciciosRecentes.map((ex) => {
                      const isPassed = !!ex.prazo && new Date(ex.prazo) < new Date();
                      const isProgrammed = !!ex.publishedAt && new Date(ex.publishedAt) > new Date();
                      const statusLabel = isProgrammed ? "Agendado" : isPassed ? "Publicado" : "Rascunho";
                      const statusTone = isProgrammed ? "bg-sky-500" : isPassed ? "bg-emerald-500" : "bg-slate-400";

                      return (
                        <button
                          key={ex.id}
                          type="button"
                          className="flex items-center gap-4 px-5 py-4 text-left transition hover:bg-muted/20 sm:px-6"
                          onClick={() => navigate(appRoutes.exercicioDetalhe(ex.id))}
                        >
                          <span className={cn("size-2 shrink-0 rounded-full", statusTone)} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-base font-bold text-foreground">
                              {ex.titulo}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {isProgrammed
                                ? `Agendado: ${formatShortDate(ex.publishedAt)}`
                                : ex.prazo
                                  ? `Entrega: ${formatShortDate(ex.prazo)}`
                                  : "Sem prazo definido"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                              {statusLabel}
                            </span>
                            <ChevronRight size={14} className="text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </m.div>
            </div>

            <div className="grid gap-4">
              <m.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.18 }}
                className={sectionCardClass}
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black tracking-[-0.03em] text-foreground">
                      {isManagementView ? "Saude operacional" : "Progresso"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {isAdmin
                        ? "Visao geral do sistema"
                        : isManagementView
                          ? "Leitura editorial e operacional"
                          : "Resumo do seu desempenho"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {isAdmin ? "Sistema" : "Hoje"}
                  </Badge>
                </div>

                <div className="mb-6 rounded-2xl border border-border/80 bg-muted/20 p-4">
                  <div className={eyebrowClass}>Performance</div>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div className="text-5xl font-black tracking-[-0.06em] text-foreground tabular-nums">
                      {saudePercent}%
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>
                        {progressoLabelA}: <span className="font-semibold text-foreground">{progressoValueA}</span>
                      </div>
                      <div>
                        {progressoLabelB}: <span className="font-semibold text-foreground">{progressoValueB}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {isAdmin ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Turmas no sistema</div>
                        <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-foreground tabular-nums">{totalTurmasDoSistema}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{turmasResponsavel} sob leitura direta agora</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Alunos no sistema</div>
                        <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-foreground tabular-nums">{totalAlunosDoSistema || totalAlunos}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{totalAlunos} vinculados ao seu recorte atual</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Atividade recente</div>
                        <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-foreground tabular-nums">{activityFeed.length}</div>
                        <div className="mt-1 text-sm text-muted-foreground">eventos recentes no feed operacional</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Latencia media</div>
                        <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-foreground tabular-nums">
                          {monitoring ? `${Math.round(monitoring.totals.avgLatencyMs)}ms` : "N/A"}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {disparosHoje} disparo{disparosHoje === 1 ? "" : "s"} hoje e {activeAlerts} alerta{activeAlerts === 1 ? "" : "s"} ativo{activeAlerts === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  ) : isManagementView ? (
                    <>
                      <HealthBar
                        label="Alunos por turma"
                        value={mediaAlunosPorTurma}
                        total={Math.max(totalAlunos, 1)}
                        colorClass="bg-sky-500"
                      />
                      <HealthBar
                        label="Correcoes pendentes"
                        value={pendenciasCorrecao}
                        total={Math.max(submissoes.length, 1)}
                        colorClass="bg-amber-500"
                      />
                      <HealthBar
                        label="Submissoes hoje"
                        value={submissoesHoje}
                        total={Math.max(submissoes.length, 1)}
                        colorClass="bg-emerald-500"
                      />
                    </>
                  ) : (
                    <>
                      <HealthBar
                        label="Exercicios ativos"
                        value={exerciciosAtivos}
                        total={Math.max(totalExerciciosPublicados, 1)}
                        colorClass="bg-emerald-500"
                      />
                      <HealthBar
                        label="Pendentes"
                        value={exerciciosPendentes}
                        total={Math.max(totalExerciciosPublicados, 1)}
                        colorClass="bg-sky-500"
                      />
                      <HealthBar
                        label="Concluidos"
                        value={exerciciosConcluidos}
                        total={Math.max(totalExercicios, 1)}
                        colorClass="bg-amber-500"
                      />
                    </>
                  )}
                </div>

                <div
                  className={cn(
                    "mt-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold",
                    (isAdmin ? activeAlerts === 0 : isManagementView ? pendenciasCorrecao === 0 : exerciciosPendentes === 0)
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600"
                  )}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {isAdmin
                      ? activeAlerts === 0
                        ? "Todos os servicos operacionais"
                        : `${activeAlerts} alertas requerem atencao`
                      : isManagementView
                        ? pendenciasCorrecao === 0
                          ? "Fila de correcoes controlada"
                          : `${pendenciasCorrecao} submissoes aguardando revisao`
                        : exerciciosPendentes === 0
                          ? "Rotina em dia"
                          : `${exerciciosPendentes} atividades abertas para concluir`}
                  </span>
                </div>
              </m.div>

            </div>
          </section>

          {isManagementView ? (
            <section className={cn("grid gap-4", "md:grid-cols-2 xl:grid-cols-3")}>
              <SecondaryStatCard
                label="Taxa de agendamento"
                value={`${taxaAgendamento}%`}
                subtext={
                  taxaAgendamento >= 70
                    ? "Acima da meta semanal de 70%"
                    : "Abaixo da meta semanal de 70%"
                }
                icon={<Calendar size={18} />}
                tone="info"
                delay={0.22}
              />
              <SecondaryStatCard
                label="Submissoes hoje"
                value={submissoesHoje}
                subtext={
                  deltaSubmissoes === 0
                    ? "Mesmo volume comparado a ontem"
                    : `${deltaSubmissoes > 0 ? "+" : ""}${deltaSubmissoes} comparado a ontem`
                }
                icon={<Activity size={18} />}
                tone="success"
                delay={0.26}
              />
              <SecondaryStatCard
                label="Pendencias de correcao"
                value={pendenciasCorrecao}
                subtext={
                  pendenciasCorrecao > 0
                    ? "Prioridade media - revise hoje"
                    : "Fila de correcao sob controle"
                }
                icon={<Clock3 size={18} />}
                tone="warning"
                delay={0.3}
              />
              <SecondaryStatCard
                label={isAdmin ? "Alertas ativos" : "Backlog editorial"}
                value={isAdmin ? String(activeAlerts).padStart(2, "0") : String(exerciciosRascunho).padStart(2, "0")}
                subtext={
                  isAdmin
                    ? activeAlerts > 0
                      ? "Rotas criticas exigem atencao"
                      : "Nenhum alerta critico no momento"
                    : exerciciosRascunho > 0
                      ? `${exerciciosRascunho} exercicios aguardando revisao`
                      : "Sem rascunhos pendentes"
                }
                icon={<AlertTriangle size={18} />}
                tone={isAdmin && activeAlerts > 0 ? "danger" : "neutral"}
                delay={0.34}
              />
              <SecondaryStatCard
                label={isAdmin ? "Latencia p95" : "Engajamento medio"}
                value={isAdmin && monitoring ? `${Math.round(monitoring.totals.p95LatencyMs)}ms` : `${engajamentoMedio}%`}
                subtext={
                  isAdmin
                    ? monitoring
                      ? `${Math.round(monitoring.totals.avgLatencyMs)}ms de media por requisicao`
                      : "Metricas indisponiveis"
                    : `${mediaAlunosPorTurma} alunos por turma em media`
                }
                icon={<Activity size={18} />}
                tone="neutral"
                delay={0.38}
              />
              {isAdmin ? (
                <SecondaryStatCard
                  label="Notificacoes"
                  value={String(disparosHoje).padStart(2, "0")}
                  subtext={
                    dispatches.length
                      ? `${dispatches.length} disparos recentes no painel`
                      : "Sem disparos recentes"
                  }
                  icon={<Bell size={18} />}
                  tone="info"
                  delay={0.42}
                />
              ) : null}
            </section>
          ) : null}

          {isAdmin && activityFeed.length > 0 ? (
            <section>
              <m.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, duration: 0.18 }}
                className={sectionCardClass}
              >
                <div className="mb-4 flex items-start justify-between gap-4 border-b border-border/50 pb-4">
                  <div>
                    <h2 className="text-xl font-black tracking-[-0.03em] text-foreground">
                      Atividade de alunos
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Eventos recentes capturados via activity logs
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    Ao vivo
                  </Badge>
                </div>

                <div className="flex flex-col divide-y divide-border/50">
                  {activityFeed.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 py-4">
                      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-foreground">
                        {getInitials(item.actor?.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {buildActivityLabel(item)}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {humanizeToken(item.entityType)}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm text-muted-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </m.div>
            </section>
          ) : null}
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
