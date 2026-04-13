import React from "react";
import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import DashboardLayout from "./DashboardLayout";
import { getName, getRole, hasRole } from "../../auth/auth";
import { FadeInUp } from "../animate-ui";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listarTurmas,
  obterTurmasResponsavel,
  obterTotalTurmas,
  obterContagemAlunosDashboard,
  listarExercicios,
  todasMinhasSubmissoes,
  type Exercicio,
  type Submissao,
} from "../../services/api";
import {
  Calendar,
  PenLine,
  School,
  Plus,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  Users,
  ClipboardList,
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

function RingProgress({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(value, 100));
  const style = {
    background: `conic-gradient(var(--primary) ${normalized}%, var(--ring-progress-track) 0)`,
  } as React.CSSProperties;

  return (
    <div
      className="grid size-20 place-items-center rounded-full p-1.5 shadow-sm"
      style={style}
      aria-label={`Progresso ${normalized}%`}
    >
      <div className="grid size-full place-items-center rounded-full bg-card shadow-sm">
        <span className="text-lg font-bold tracking-tight text-foreground">
          {normalized}%
        </span>
      </div>
    </div>
  );
}

type MetricRow = {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
};

const eyebrowClass =
  "text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground";
const surfaceClass =
  "overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow)]";

function SurfaceCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return <Card className={cn(surfaceClass, className)} {...props} />;
}

function MetricRows({ rows }: { rows: MetricRow[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((row, index) => (
        <React.Fragment key={row.label}>
          <div className="flex items-center justify-between gap-3 py-3 text-sm text-muted-foreground">
            <span>{row.label}</span>
            <strong className={cn("text-sm font-semibold text-foreground", row.valueClassName)}>
              {row.value}
            </strong>
          </div>
          {index < rows.length - 1 ? <Separator className="bg-border/60" /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function MetricCard({
  kicker,
  value,
  rows,
  description,
  delay,
}: {
  kicker: string;
  value: React.ReactNode;
  rows: MetricRow[];
  description?: React.ReactNode;
  delay: number;
}) {
  return (
    <m.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <SurfaceCard className="h-full">
        <CardHeader className="gap-2">
          <div className={eyebrowClass}>{kicker}</div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
            {value}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          <MetricRows rows={rows} />
          {description ? (
            <p className="pt-4 text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </CardContent>
      </SurfaceCard>
    </m.div>
  );
}

function LoadingMetricCard() {
  return (
    <SurfaceCard className="h-full">
      <CardHeader className="gap-3">
        <Skeleton className="h-3 w-24 rounded-full bg-muted/70" />
        <Skeleton className="h-10 w-20 rounded-xl bg-muted/70" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-11 rounded-2xl bg-muted/60" />
        <Skeleton className="h-11 rounded-2xl bg-muted/60" />
      </CardContent>
    </SurfaceCard>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const name = getName() ?? "Aluno";
  const role = getRole();
  const isAdmin = role === "admin";
  const isManagementView = role === "admin" || role === "professor";
  const canCreateUser = hasRole(["admin"]);

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
          ] = await Promise.all([
            obterTurmasResponsavel().catch(() => ({ total: 0 })),
            obterTotalTurmas().catch(() => ({ total: 0 })),
            obterContagemAlunosDashboard().catch(() => ({ total: 0, totalSistema: 0 })),
            listarExercicios({ page: 1, limit: 6, status: "todos" }),
            listarExercicios({ page: 1, limit: 1, status: "programado" }),
            listarExercicios({ page: 1, limit: 1, status: "publicado" }),
            listarExercicios({ page: 1, limit: 1, status: "rascunho" }),
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
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [isManagementView]);

  const exerciciosConcluidos = React.useMemo(
    () => new Set(submissoes.map((item) => item.exercicioId)).size,
    [submissoes]
  );
  const exerciciosAtivos = Math.max(totalExerciciosPublicados - exerciciosProgramados, 0);

  const progressoOverall = isManagementView
    ? totalExerciciosPublicados > 0
      ? Math.round((exerciciosAtivos / totalExerciciosPublicados) * 100)
      : 0
    : totalExercicios > 0
      ? Math.round((exerciciosConcluidos / totalExercicios) * 100)
      : 0;

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

  const statsGridClass = cn(
    "grid gap-5 xl:gap-6",
    isManagementView ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"
  );

  if (loading) {
    return (
      <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
        <div className="flex flex-col gap-6">
          <SurfaceCard>
            <CardHeader className="gap-3">
              <Skeleton className="h-3 w-28 rounded-full bg-muted/70" />
              <Skeleton className="h-10 w-56 rounded-xl bg-muted/70" />
              <Skeleton className="h-4 w-full max-w-xl rounded-full bg-muted/60" />
            </CardHeader>
          </SurfaceCard>

          <section className={statsGridClass}>
            {Array.from({ length: isManagementView ? 4 : 3 }).map((_, idx) => (
              <LoadingMetricCard key={idx} />
            ))}
          </section>
        </div>
      </DashboardLayout>
    );
  }

  if (erro) {
    return (
      <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
        <SurfaceCard className="max-w-2xl">
          <CardHeader className="gap-2">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Falha ao carregar dashboard
            </CardTitle>
            <CardDescription>{erro}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-fit rounded-2xl px-4"
              onClick={() => window.location.reload()}
            >
              <RefreshCcw data-icon="inline-start" />
              Tentar novamente
            </Button>
          </CardContent>
        </SurfaceCard>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
      <FadeInUp>
        <div className={cn("flex flex-col gap-6", isManagementView && "gap-5")}>
          {isManagementView ? (
            <SurfaceCard className="border-border bg-[var(--hero-surface)]">
              <CardContent className="grid gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex flex-col gap-3">
                  <div className="inline-flex w-fit items-center rounded-full border border-border/80 bg-card px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground shadow-sm">
                    Visão administrativa
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                    Operação com leitura imediata
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Turmas, exercícios e cobertura de alunos reunidos em uma superfície mais clara, comercial e pronta para decisão.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 lg:justify-end">
                  <Badge
                    variant="secondary"
                    className="h-9 gap-2 rounded-full px-4 text-[0.68rem] font-semibold uppercase tracking-[0.2em]"
                  >
                    <Users /> {totalAlunos} alunos vinculados
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="h-9 gap-2 rounded-full px-4 text-[0.68rem] font-semibold uppercase tracking-[0.2em]"
                  >
                    <ClipboardList /> {exerciciosAtivos} exercicios ativos
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="h-9 gap-2 rounded-full px-4 text-[0.68rem] font-semibold uppercase tracking-[0.2em]"
                  >
                    <ShieldCheck /> {taxaAgendamento}% em agendamento
                  </Badge>
                </div>
              </CardContent>
            </SurfaceCard>
          ) : null}

          <section className={statsGridClass}>
            {(isManagementView || hasTurmas) ? (
              <MetricCard
                kicker={isManagementView ? "Turmas geridas" : "Turmas"}
                value={isManagementView ? turmasResponsavel : totalTurmasAluno}
                rows={[
                  {
                    label: isManagementView ? "Sob responsabilidade" : "Turmas registradas",
                    value: isManagementView ? turmasResponsavel : totalTurmasAluno,
                  },
                  ...(isAdmin
                    ? [
                        {
                          label: "Total no sistema",
                          value: totalTurmasDoSistema,
                          valueClassName: "text-muted-foreground",
                        },
                      ]
                    : []),
                ]}
                delay={0}
              />
            ) : null}

            {(isManagementView || hasTurmas) ? (
              <MetricCard
                kicker={isManagementView ? "Cobertura de alunos" : "Alunos"}
                value={totalAlunos}
                rows={[
                  {
                    label: isManagementView ? "Alunos vinculados" : "Alunos nas turmas",
                    value: totalAlunos,
                  },
                  ...(isAdmin
                    ? [
                        {
                          label: "Total no sistema",
                          value: totalAlunosDoSistema,
                          valueClassName: "text-muted-foreground",
                        },
                      ]
                    : []),
                ]}
                delay={0.1}
              />
            ) : null}

            <MetricCard
              kicker={isManagementView ? "Operacao de exercicios" : "Exercicios"}
              value={isManagementView ? exerciciosAtivos : totalExercicios}
              rows={
                isManagementView
                  ? [
                      { label: "Publicados", value: totalExerciciosPublicados },
                      { label: "Programados", value: exerciciosProgramados },
                    ]
                  : [
                      {
                        label: "Pendentes",
                        value: exerciciosPendentes,
                        valueClassName: "text-primary",
                      },
                    ]
              }
              delay={0.2}
            />

            {isManagementView ? (
              <MetricCard
                kicker="Backlog editorial"
                value={exerciciosRascunho}
                rows={[
                  { label: "Rascunhos", value: exerciciosRascunho },
                  { label: "Prontos para revisao", value: exerciciosRascunho },
                ]}
                description="Exercicios em rascunho aguardando revisao ou publicacao."
                delay={0.3}
              />
            ) : null}
          </section>

          <section className="grid gap-5 xl:gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.95fr)]">
            <m.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.3 }}>
              <SurfaceCard className="h-full">
                <CardHeader className="gap-2">
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                    Exercicios recentes
                  </CardTitle>
                  <CardDescription>
                    Ultimas publicacoes e prazos relevantes para acompanhar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {exerciciosRecentes.length === 0 ? (
                    <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhum exercicio disponivel
                    </div>
                  ) : (
                    exerciciosRecentes.map((ex) => {
                      const isPassed = !!ex.prazo && new Date(ex.prazo) < new Date();
                      const isProgrammed = !!ex.publishedAt && new Date(ex.publishedAt) > new Date();

                      return (
                        <button
                          key={ex.id}
                          className="flex items-start gap-4 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-4 text-left transition hover:border-primary/30 hover:bg-muted/35"
                          onClick={() => navigate(`/dashboard/exercicios/${ex.id}`)}
                          type="button"
                        >
                          <span
                            className={cn(
                              "mt-1 size-2.5 shrink-0 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.04)]",
                              isProgrammed
                                ? "bg-sky-500"
                                : isPassed
                                  ? "bg-primary"
                                  : "bg-muted-foreground/70"
                            )}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">
                                {ex.titulo}
                              </span>
                              {isProgrammed ? (
                                <Badge
                                  variant="secondary"
                                  className="h-6 gap-1 rounded-full px-2.5 text-[0.64rem] font-semibold uppercase tracking-[0.18em]"
                                >
                                  <Calendar /> Programado
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {isProgrammed && ex.publishedAt
                                ? `Publicacao: ${new Date(ex.publishedAt).toLocaleDateString("pt-BR")}`
                                : ex.prazo
                                  ? `Prazo: ${new Date(ex.prazo).toLocaleDateString("pt-BR")}`
                                  : "Sem prazo"}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </SurfaceCard>
            </m.div>

            <m.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.3 }}>
              <SurfaceCard className="h-full">
                <CardHeader className="gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div>
                    <div className={eyebrowClass}>
                      {isManagementView ? "Saude operacional" : "Progresso"}
                    </div>
                    <CardTitle className="mt-3 text-[2.2rem] leading-tight font-bold tracking-tight text-foreground">
                      {progressoOverall}%
                    </CardTitle>
                  </div>
                  <CardAction className="col-auto row-auto justify-self-start sm:justify-self-end">
                    <RingProgress value={progressoOverall} />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <MetricRows
                    rows={[
                      { label: progressoLabelA, value: progressoValueA },
                      { label: progressoLabelB, value: progressoValueB },
                    ]}
                  />
                </CardContent>
              </SurfaceCard>
            </m.div>
          </section>

          <section>
            <m.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.3 }}>
              <SurfaceCard className="relative overflow-hidden">
                <CardHeader className="relative gap-2">
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                    Acoes rapidas
                  </CardTitle>
                  <CardDescription>
                    Atalhos diretos para as areas operacionais mais usadas do portal.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Button
                    variant="default"
                    size="lg"
                    className="h-14 justify-start rounded-2xl px-4 text-sm font-semibold"
                    onClick={() => navigate("/dashboard/exercicios")}
                  >
                    <PenLine data-icon="inline-start" />
                    Exercicios
                  </Button>

                  {role === "admin" || role === "professor" || hasTurmas ? (
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-14 justify-start rounded-2xl px-4 text-sm font-semibold"
                      onClick={() => navigate("/dashboard/turmas")}
                    >
                      <School data-icon="inline-start" />
                      Turmas
                    </Button>
                  ) : null}

                  {canCreateUser ? (
                    <>
                      <Button
                        variant="default"
                        size="lg"
                        className="h-14 justify-start rounded-2xl px-4 text-sm font-semibold"
                        onClick={() => navigate("/dashboard/criar-usuario")}
                      >
                        <Plus data-icon="inline-start" />
                        Criar usuario
                      </Button>

                      <Button
                        variant="outline"
                        size="lg"
                        className="h-14 justify-start rounded-2xl px-4 text-sm font-semibold"
                        onClick={() => navigate("/dashboard/usuarios")}
                      >
                        <KeyRound data-icon="inline-start" />
                        Gerenciar usuarios
                      </Button>
                    </>
                  ) : null}
                </CardContent>
              </SurfaceCard>
            </m.div>
          </section>
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
