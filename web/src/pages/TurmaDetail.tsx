import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  GitBranch,
  Info,
  Laptop,
  Layers3,
  Loader2,
  Lock,
  Monitor,
  Play,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appRoutes } from "@/router/routes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import TurmaClassroomsPanel from "@/components/turmas/TurmaClassroomsPanel";
import { FadeInUp, AnimatedToast } from "../components/animate-ui";
import ConfirmModal from "../components/ConfirmModal";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import {
  adicionarAlunosNaTurma,
  getRole,
  iniciarFasesNaTurma,
  listarAlunos,
  listarCursos,
  listarFasesDoModulo,
  listarModulosPorCurso,
  obterTurma,
  type Curso,
  type Fase,
  type Modulo,
  removerAlunoDaTurma,
  type Turma,
  type TurmaAluno,
  type User,
} from "../services/api";

type TurmaComAlunos = Turma & {
  faseInicial?: { id: string; nome: string } | null;
  alunos: TurmaAluno[];
  exercicios: Array<{ id: string; titulo: string; modulo: string }>;
};

type TurmaDetailTab = "info" | "alunos" | "sala-de-aula";

function isTurmaDetailTab(value: string | null): value is TurmaDetailTab {
  return value === "info" || value === "alunos" || value === "sala-de-aula";
}

function isAlunoStartable(aluno: TurmaAluno) {
  return (
    aluno.role === "aluno" &&
    (aluno.faseInicialStatus === "nao_iniciado" ||
      aluno.faseInicialStatus === "desconhecido" ||
      !aluno.faseInicialStatus)
  );
}

function getStatusBadgeClass(status: string | null | undefined) {
  switch (status) {
    case "iniciado":
      return "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300";
    case "nao_iniciado":
      return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300";
    default:
      return "border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:text-slate-300";
  }
}

function getCategoriaBadge(categoria: TurmaComAlunos["categoria"]) {
  if (categoria === "programacao") {
    return {
      icon: <Laptop size={14} />,
      label: "Programacao",
      className:
        "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:text-sky-300",
    };
  }

  return {
    icon: <Monitor size={14} />,
    label: "Informatica",
    className:
      "border-violet-300/60 bg-violet-500/10 text-violet-700 dark:border-violet-500/30 dark:text-violet-300",
  };
}

type FaseApiShape = Fase & {
  module_id?: string | number | null;
  week_number?: number | string | null;
  index_order?: number | string | null;
  admin_authorize?: boolean | null;
};

function toSafeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFasePayload(fase: FaseApiShape): Fase {
  return {
    id: String(fase.id),
    moduleId: String(fase.moduleId ?? fase.module_id ?? ""),
    nome: fase.nome,
    weekNumber: toSafeNumber(fase.weekNumber ?? fase.week_number),
    indexOrder: toSafeNumber(fase.indexOrder ?? fase.index_order),
    adminAuthorize: Boolean(fase.adminAuthorize ?? fase.admin_authorize),
    createdAt: fase.createdAt,
    updatedAt: fase.updatedAt,
  };
}

function sortFases(fases: Fase[]) {
  return [...fases].sort((a, b) => a.weekNumber - b.weekNumber || a.indexOrder - b.indexOrder);
}

function formatWeekRange(fases: Fase[]) {
  const semanas = fases.map((fase) => fase.weekNumber).filter((weekNumber) => weekNumber > 0);

  if (semanas.length === 0) {
    return "Semanas nao definidas";
  }

  const semanaInicial = Math.min(...semanas);
  const semanaFinal = Math.max(...semanas);

  return semanaInicial === semanaFinal
    ? `Semana ${semanaInicial}`
    : `Semanas ${semanaInicial}-${semanaFinal}`;
}

function extractNamedWeekRange(moduleName: string | null | undefined) {
  if (!moduleName) return null;

  const match = moduleName.match(/semanas?\s*(\d+)\s*[-–—]\s*(\d+)/i);
  if (match) {
    const start = toSafeNumber(match[1]);
    const end = toSafeNumber(match[2]);
    if (start > 0 && end >= start) {
      return { start, end };
    }
  }

  const singleMatch = moduleName.match(/semana\s*(\d+)/i);
  if (singleMatch) {
    const value = toSafeNumber(singleMatch[1]);
    if (value > 0) {
      return { start: value, end: value };
    }
  }

  return null;
}

function getModuleWeekLabel(modulo: Modulo, fases: Fase[]) {
  const explicitRange = extractNamedWeekRange(modulo.nome);
  if (explicitRange) {
    return explicitRange.start === explicitRange.end
      ? `Semana ${explicitRange.start}`
      : `Semanas ${explicitRange.start}-${explicitRange.end}`;
  }

  return formatWeekRange(fases);
}

export default function TurmaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = getRole();
  const canManageTurmas = role === "admin" || role === "professor";
  const canManageClassrooms = role === "admin";
  const backPath = canManageTurmas ? appRoutes.turmas : appRoutes.dashboard;

  const [turma, setTurma] = React.useState<TurmaComAlunos | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [cursoAtual, setCursoAtual] = React.useState<Curso | null>(null);
  const [modulosDaTurma, setModulosDaTurma] = React.useState<Modulo[]>([]);
  const [fasesPorModulo, setFasesPorModulo] = React.useState<Record<string, Fase[]>>({});
  const [carregandoTrilha, setCarregandoTrilha] = React.useState(false);
  const [modalAdicionarAberto, setModalAdicionarAberto] = React.useState(false);
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [adicionando, setAdicionando] = React.useState(false);
  const [iniciandoLote, setIniciandoLote] = React.useState(false);
  const [iniciandoAlunoId, setIniciandoAlunoId] = React.useState<string | null>(null);
  const [alunoParaRemover, setAlunoParaRemover] = React.useState<TurmaAluno | null>(null);
  const [removendoAlunoId, setRemovendoAlunoId] = React.useState<string | null>(null);
  const [alunosParaIniciar, setAlunosParaIniciar] = React.useState<string[]>([]);

  const panelClass = "rounded-[28px] border border-border/70 bg-card/95 shadow-sm";
  const requestedTab = searchParams.get("tab");
  const abaSelecionada: TurmaDetailTab = isTurmaDetailTab(requestedTab) ? requestedTab : "info";

  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span>{label}</span>
    </span>
  );

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErro(null);
      const data = await obterTurma(id);
      setTurma(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar turma");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (!id) {
      navigate(backPath);
      return;
    }
    void load();
  }, [backPath, id, load, navigate]);

  React.useEffect(() => {
    if (!turma) {
      setAlunosParaIniciar([]);
      return;
    }

    const idsValidos = new Set(
      turma.alunos.filter((aluno) => isAlunoStartable(aluno)).map((aluno) => aluno.id)
    );

    setAlunosParaIniciar((prev) => prev.filter((alunoId) => idsValidos.has(alunoId)));
  }, [turma]);

  const alunosIniciaveis = React.useMemo(
    () => turma?.alunos.filter((aluno) => isAlunoStartable(aluno)) ?? [],
    [turma]
  );

  const moduloAtual = React.useMemo(
    () => modulosDaTurma.find((modulo) => modulo.id === turma?.currentModuleId) ?? null,
    [modulosDaTurma, turma?.currentModuleId]
  );

  const todosIniciaveisSelecionados =
    alunosIniciaveis.length > 0 && alunosParaIniciar.length === alunosIniciaveis.length;

  React.useEffect(() => {
    if (!turma?.courseId) {
      setCursoAtual(null);
      setModulosDaTurma([]);
      setFasesPorModulo({});
      return;
    }

    const courseId = turma.courseId;
    let ativo = true;
    const carregarTrilha = async () => {
      setCarregandoTrilha(true);

      try {
        const [cursosResult, modulosResult] = await Promise.allSettled([
          listarCursos(),
          listarModulosPorCurso(courseId),
        ]);

        if (!ativo) return;

        if (cursosResult.status === "fulfilled") {
          setCursoAtual(cursosResult.value.find((curso) => curso.id === courseId) ?? null);
        } else {
          setCursoAtual(null);
        }

        let modulosOrdenados: Modulo[] = [];
        if (modulosResult.status === "fulfilled") {
          modulosOrdenados = [...(modulosResult.value as Modulo[])].sort(
            (a, b) => a.indexOrder - b.indexOrder || a.nome.localeCompare(b.nome, "pt-BR")
          );
          setModulosDaTurma(modulosOrdenados);
        } else {
          setModulosDaTurma([]);
        }

        if (modulosOrdenados.length === 0) {
          setFasesPorModulo({});
          return;
        }

        const fasesResults = await Promise.allSettled(
          modulosOrdenados.map((modulo) => listarFasesDoModulo(modulo.id))
        );

        if (!ativo) return;

        const proximasFasesPorModulo = modulosOrdenados.reduce<Record<string, Fase[]>>((acc, modulo, index) => {
          const fasesResult = fasesResults[index];
          acc[modulo.id] =
            fasesResult?.status === "fulfilled"
              ? sortFases((fasesResult.value as Fase[]).map((fase) => normalizeFasePayload(fase as FaseApiShape)))
              : [];
          return acc;
        }, {});

        setFasesPorModulo(proximasFasesPorModulo);
      } finally {
        if (ativo) setCarregandoTrilha(false);
      }
    };

    void carregarTrilha();

    return () => {
      ativo = false;
    };
  }, [turma?.courseId]);

  async function confirmarRemoverAluno() {
    if (!id || !alunoParaRemover) return;

    try {
      setRemovendoAlunoId(alunoParaRemover.id);
      setErro(null);
      setOkMsg(null);
      await removerAlunoDaTurma(id, alunoParaRemover.id);
      setOkMsg("Aluno removido com sucesso!");
      setAlunoParaRemover(null);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover aluno");
    } finally {
      setRemovendoAlunoId(null);
    }
  }

  async function abrirModalAdicionar() {
    try {
      const alunos = await listarAlunos();
      const alunosNaTurma = turma?.alunos.map((aluno) => aluno.id) ?? [];
      const disponiveis = alunos.filter((aluno) => !alunosNaTurma.includes(aluno.id));
      setAlunosSelecionados([]);
      setAlunosDisponiveis(disponiveis);
      setModalAdicionarAberto(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar alunos");
    }
  }

  function fecharModalAdicionar(force = false) {
    if (adicionando && !force) return;
    setModalAdicionarAberto(false);
    setAlunosSelecionados([]);
  }

  async function handleAdicionarAlunos() {
    if (!id || alunosSelecionados.length === 0) return;

    try {
      setAdicionando(true);
      setErro(null);
      await adicionarAlunosNaTurma(id, alunosSelecionados);
      setOkMsg("Alunos adicionados com sucesso!");
      fecharModalAdicionar(true);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao adicionar alunos");
    } finally {
      setAdicionando(false);
    }
  }

  async function handleIniciarFasesSelecionadas() {
    if (!id || alunosParaIniciar.length === 0) return;

    try {
      setIniciandoLote(true);
      setErro(null);
      setOkMsg(null);

      const result = await iniciarFasesNaTurma(id, alunosParaIniciar);
      const faseNome = result.fase?.nome ? ` (${result.fase.nome})` : "";
      setOkMsg(`${result.totalAlunos} aluno(s) iniciados${faseNome}.`);
      setAlunosParaIniciar([]);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao iniciar fases");
    } finally {
      setIniciandoLote(false);
    }
  }

  async function handleIniciarFaseAluno(alunoId: string) {
    if (!id) return;

    try {
      setIniciandoAlunoId(alunoId);
      setErro(null);
      setOkMsg(null);

      const result = await iniciarFasesNaTurma(id, [alunoId]);
      const faseNome = result.fase?.nome ? ` (${result.fase.nome})` : "";
      setOkMsg(`Fase inicial iniciada para ${result.totalAlunos} aluno(s)${faseNome}.`);
      setAlunosParaIniciar((prev) => prev.filter((selectedId) => selectedId !== alunoId));
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao iniciar fase do aluno");
    } finally {
      setIniciandoAlunoId(null);
    }
  }

  function handleToggleAlunoParaIniciar(alunoId: string) {
    setAlunosParaIniciar((prev) =>
      prev.includes(alunoId)
        ? prev.filter((selectedId) => selectedId !== alunoId)
        : [...prev, alunoId]
    );
  }

  function handleToggleSelecionarTodos() {
    if (todosIniciaveisSelecionados) {
      setAlunosParaIniciar([]);
      return;
    }

    setAlunosParaIniciar(alunosIniciaveis.map((aluno) => aluno.id));
  }

  function handleAbaSelecionadaChange(value: string) {
    if (!isTurmaDetailTab(value)) return;

    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        if (value === "info") {
          nextParams.delete("tab");
        } else {
          nextParams.set("tab", value);
        }
        return nextParams;
      },
      { replace: true }
    );
  }

  if (loading && !turma) {
    return (
      <DashboardLayout title="Carregando..." subtitle="">
        <div className={`${panelClass} flex flex-col items-center gap-4 px-6 py-14 text-sm text-muted-foreground`}>
          <Loader2 size={28} className="animate-spin text-primary" />
          <span>Carregando turma...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!turma) {
    return (
      <DashboardLayout title="Turma nao encontrada" subtitle="">
        <div className={`${panelClass} px-6 py-14 text-center text-sm text-muted-foreground`}>
          A turma solicitada nao foi encontrada.
        </div>
      </DashboardLayout>
    );
  }

  const categoriaBadge = turma.categoria ? getCategoriaBadge(turma.categoria) : null;
  const detailTabs: Array<{ key: TurmaDetailTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: "info", label: "Informacoes", icon: Info },
    { key: "alunos", label: "Alunos", icon: Users },
    { key: "sala-de-aula", label: "Sala de aula", icon: BookOpen },
  ];
  const detailTabsClass =
    "flex max-w-full flex-wrap items-center gap-2 rounded-[20px] border border-border/60 bg-muted/30 p-1.5 max-md:flex-col max-md:items-stretch max-md:rounded-2xl max-md:p-2.5";
  const detailTabsLabelClass = "px-2 text-[11px] font-extrabold tracking-[0.18em] text-muted-foreground";
  const detailTabButtonClass = (active: boolean) =>
    cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold text-foreground transition hover:-translate-y-0.5 max-md:w-full max-md:rounded-xl",
      active
        ? "border-primary/50 bg-primary/15 shadow-sm"
        : "border-transparent bg-background/60 hover:border-primary/30 hover:bg-muted"
    );

  return (
    <DashboardLayout
      title={turma.nome}
      subtitle={`${turma.tipo === "turma" ? "Turma" : "Turma Particular"} - ${turma.alunos.length} ${turma.alunos.length === 1 ? "aluno" : "alunos"}`}
    >
      <FadeInUp duration={0.28}>
        <div className="space-y-6">
          <AnimatedToast message={erro} type="error" onClose={() => setErro(null)} />
          <AnimatedToast message={okMsg} type="success" onClose={() => setOkMsg(null)} />

          <Tabs value={abaSelecionada} onValueChange={handleAbaSelecionadaChange} className="gap-6">
            <div className={detailTabsClass} role="tablist" aria-label="Visualizacao da turma">
              <span className={detailTabsLabelClass}>EXIBIR:</span>
              {detailTabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={detailTabButtonClass(abaSelecionada === key)}
                  onClick={() => handleAbaSelecionadaChange(key)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            <TabsContent value="info">
            <section className={`${panelClass} p-6 sm:p-7`}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight text-foreground">{turma.nome}</h3>
                      {turma.descricao ? (
                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{turma.descricao}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className="rounded-full border-primary/25 bg-primary/10 px-3 py-1 text-primary">
                        {turma.tipo === "turma" ? (
                          iconLabel(<Users size={14} />, "Turma (Grupo)")
                        ) : (
                          iconLabel(<Lock size={14} />, "Turma Particular")
                        )}
                      </Badge>
                      {categoriaBadge ? (
                        <Badge className={cn("rounded-full px-3 py-1", categoriaBadge.className)}>
                          {iconLabel(categoriaBadge.icon, categoriaBadge.label)}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {turma.alunos.length} aluno(s)
                      </Badge>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                    onClick={() => navigate(backPath)}
                  >
                    <ArrowLeft size={16} />
                    Voltar
                  </Button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <BookOpen size={14} />
                          Curso vinculado
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {cursoAtual?.nome ?? (turma.courseId ? `Curso #${turma.courseId}` : "Nao definido")}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <Layers3 size={14} />
                          Modulo atual
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {moduloAtual ? `${moduloAtual.indexOrder}. ${moduloAtual.nome}` : "Nao definido"}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <GitBranch size={14} />
                          Fase inicial
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {turma.faseInicial?.nome ?? "Nao configurada"}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <Calendar size={14} />
                          Cronograma
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {turma.cronogramaAtivo ? "Ativo" : "Inativo"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-border/70 bg-background/75 p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-semibold text-foreground">Trilha da turma</h4>
                          <p className="text-sm text-muted-foreground">
                            Módulos do curso associado e o ponto atual de partida da turma.
                          </p>
                        </div>
                        {carregandoTrilha ? (
                          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 size={15} className="animate-spin" />
                            Carregando...
                          </span>
                        ) : null}
                      </div>

                      {!turma.courseId ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                          Esta turma ainda nao possui curso vinculado.
                        </div>
                      ) : modulosDaTurma.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                          Nenhum modulo encontrado para o curso desta turma.
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {modulosDaTurma.map((modulo) => {
                            const isAtual = modulo.id === turma.currentModuleId;
                            const fasesDoModulo = fasesPorModulo[modulo.id] ?? [];
                            const resumoSemanas = getModuleWeekLabel(modulo, fasesDoModulo);
                            const resumoFaseInicial = isAtual
                              ? turma.faseInicial?.nome ?? "Nao configurada"
                              : "Nao configurada";
                            return (
                              <article
                                key={modulo.id}
                                className={cn(
                                  "rounded-2xl border px-4 py-4 transition",
                                  isAtual
                                    ? "border-primary/35 bg-primary/6 shadow-sm"
                                    : "border-border/70 bg-card/70"
                                )}
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant={isAtual ? "default" : "outline"} className="rounded-full px-2.5 py-0.5">
                                        Módulo {modulo.indexOrder}
                                      </Badge>
                                      {isAtual ? (
                                        <Badge className="rounded-full border-primary/25 bg-primary/10 px-2.5 py-0.5 text-primary">
                                          Atual
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <h5 className="text-sm font-semibold text-foreground">{modulo.nome}</h5>
                                    {modulo.descricao ? (
                                      <p className="text-sm leading-6 text-muted-foreground">{modulo.descricao}</p>
                                    ) : null}
                                  </div>

                                  <div className="grid w-full gap-3 lg:ml-auto lg:max-w-[340px]">
                                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        Semanas
                                      </div>
                                      <div className="text-right font-semibold text-foreground">{resumoSemanas}</div>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        Fases
                                      </div>
                                      <div className="text-right font-semibold text-foreground">
                                        {fasesDoModulo.length || 0}
                                      </div>
                                    </div>

                                    {isAtual ? (
                                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                          Fase inicial
                                        </div>
                                        <div className="max-w-[180px] text-right font-semibold text-foreground">{resumoFaseInicial}</div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[26px] border border-border/70 bg-background/75 p-5">
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold text-foreground">Fases do modulo atual</h4>
                        <p className="text-sm text-muted-foreground">
                          Sequencia das fases do modulo configurado para iniciar a turma.
                        </p>
                      </div>

                      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
                        <div className="space-y-2">
                          <div className="text-lg font-semibold text-foreground">Em produção</div>
                          <p className="text-sm text-muted-foreground">
                            Esse painel ainda está sendo finalizado.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-border/70 bg-background/75 p-5">
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold text-foreground">Exercicios vinculados</h4>
                        <p className="text-sm text-muted-foreground">
                          Exercicios retornados para esta turma no detalhe atual.
                        </p>
                      </div>

                      <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
                        <div className="space-y-2">
                          <div className="text-lg font-semibold text-foreground">Em produção</div>
                          <p className="text-sm text-muted-foreground">
                            Esse painel ainda está sendo finalizado.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            </TabsContent>

            <TabsContent value="alunos">
            <section className={`${panelClass} p-6 sm:p-7`}>
              <div className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {iconLabel(<Users size={18} />, `Alunos (${turma.alunos.length})`)}
                  </h2>
                  {turma.faseInicial ? (
                    <p className="text-sm text-muted-foreground">
                      Fase inicial do modulo atual:{" "}
                      <span className="font-semibold text-foreground">{turma.faseInicial.nome}</span>
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      O modulo atual da turma ainda nao possui fases para iniciar.
                    </p>
                  )}
                </div>

                {canManageTurmas && (
                  <div className="flex flex-wrap items-center gap-3">
                    {turma.faseInicial && alunosIniciaveis.length > 0 ? (
                      <>
                        {alunosIniciaveis.length > 1 ? (
                          <label className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/25"
                              checked={todosIniciaveisSelecionados}
                              onChange={handleToggleSelecionarTodos}
                            />
                            <span>Selecionar todos</span>
                          </label>
                        ) : null}
                        <Button
                          type="button"
                          className="h-11 rounded-xl px-4"
                          onClick={handleIniciarFasesSelecionadas}
                          disabled={iniciandoLote || alunosParaIniciar.length === 0}
                        >
                          {iniciandoLote ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Iniciando...
                            </>
                          ) : (
                            <>
                              <Play size={16} />
                              {`Iniciar fases${alunosParaIniciar.length > 0 ? ` (${alunosParaIniciar.length})` : ""}`}
                            </>
                          )}
                        </Button>
                      </>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                      onClick={abrirModalAdicionar}
                    >
                      <Plus size={16} />
                      Adicionar aluno
                    </Button>
                  </div>
                )}
              </div>

              {turma.alunos.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                  <span className="inline-flex rounded-full bg-muted p-4 text-muted-foreground">
                    <Users size={20} />
                  </span>
                  <p className="text-sm text-muted-foreground">Nenhum aluno cadastrado nesta turma ainda.</p>
                </div>
              ) : (
                <div className="mt-6 grid gap-4">
                  {turma.alunos.map((aluno) => {
                    const podeIniciar =
                      canManageTurmas && Boolean(turma.faseInicial) && isAlunoStartable(aluno);
                    const selecionado = alunosParaIniciar.includes(aluno.id);
                    const iniciandoEsteAluno = iniciandoAlunoId === aluno.id;

                    return (
                      <article
                        key={aluno.id}
                        className={cn(
                          "rounded-[24px] border border-border/70 bg-background/80 p-4 transition",
                          selecionado && "border-primary/30 bg-primary/5 shadow-sm"
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex min-w-0 items-center gap-4">
                            {canManageTurmas && turma.faseInicial && aluno.role === "aluno" ? (
                              <label className="inline-flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/25"
                                  checked={selecionado}
                                  disabled={!podeIniciar}
                                  onChange={() => handleToggleAlunoParaIniciar(aluno.id)}
                                />
                              </label>
                            ) : null}

                            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                              {aluno.nome.slice(0, 1).toUpperCase()}
                            </div>

                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-base font-semibold text-foreground">
                                  {aluno.nome}
                                </span>
                                <Badge
                                  className={cn(
                                    "rounded-full px-2.5 text-[11px] font-semibold",
                                    getStatusBadgeClass(aluno.faseInicialStatus)
                                  )}
                                >
                                  {aluno.faseInicialStatusLabel ?? "Desconhecido"}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span>@{aluno.usuario}</span>
                                <Badge variant="outline" className="rounded-full px-2.5 text-[11px]">
                                  {aluno.role}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {canManageTurmas ? (
                            <div className="flex flex-wrap gap-2">
                              {turma.faseInicial && aluno.role === "aluno" ? (
                                <Button
                                  type="button"
                                  variant={podeIniciar ? "default" : "outline"}
                                  className="h-10 rounded-xl px-4"
                                  disabled={!podeIniciar || iniciandoLote || iniciandoEsteAluno}
                                  onClick={() => handleIniciarFaseAluno(aluno.id)}
                                >
                                  {iniciandoEsteAluno ? (
                                    <>
                                      <Loader2 size={14} className="animate-spin" />
                                      Iniciando...
                                    </>
                                  ) : podeIniciar ? (
                                    <>
                                      <Play size={14} />
                                      Iniciar fase
                                    </>
                                  ) : (
                                    "Ja iniciada"
                                  )}
                                </Button>
                              ) : null}

                              <Button
                                type="button"
                                variant="destructive"
                                className="h-10 rounded-xl px-4"
                                onClick={() => setAlunoParaRemover(aluno)}
                              >
                                <Trash2 size={14} />
                                Remover
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            </TabsContent>

            <TabsContent value="sala-de-aula">
              <TurmaClassroomsPanel
                turmaId={turma.id}
                turmaNome={turma.nome}
                currentModuleName={moduloAtual?.nome ?? null}
                canManage={canManageClassrooms}
                onError={setErro}
                onSuccess={setOkMsg}
              />
            </TabsContent>
          </Tabs>

          <Dialog open={modalAdicionarAberto} onOpenChange={(open) => (open ? setModalAdicionarAberto(true) : fecharModalAdicionar())}>
            <DialogContent className="max-w-2xl p-0">
              <DialogHeader className="border-b border-border/70 pb-4">
                <DialogTitle>Adicionar alunos a turma</DialogTitle>
                <DialogDescription>
                  Selecione os alunos que devem entrar em{" "}
                  <span className="font-semibold text-foreground">{turma.nome}</span>.
                </DialogDescription>
              </DialogHeader>

              {alunosDisponiveis.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Nenhum aluno disponivel para adicionar.
                </div>
              ) : (
                <div className="max-h-[420px] space-y-3 overflow-y-auto px-6 pb-2">
                  {alunosDisponiveis.map((aluno) => {
                    const selecionado = alunosSelecionados.includes(aluno.id);

                    return (
                      <label
                        key={aluno.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-4 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 transition",
                          selecionado && "border-primary/30 bg-primary/5"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/25"
                          checked={selecionado}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAlunosSelecionados((prev) => [...prev, aluno.id]);
                              return;
                            }

                            setAlunosSelecionados((prev) =>
                              prev.filter((selectedId) => selectedId !== aluno.id)
                            );
                          }}
                        />
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                          {aluno.nome.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {aluno.nome}
                          </div>
                          <div className="truncate text-sm text-muted-foreground">@{aluno.usuario}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                  onClick={() => fecharModalAdicionar()}
                  disabled={adicionando}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-xl px-4"
                  onClick={handleAdicionarAlunos}
                  disabled={adicionando || alunosSelecionados.length === 0}
                >
                  {adicionando ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    "Adicionar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmModal
            isOpen={Boolean(alunoParaRemover)}
            title="Remover aluno da turma"
            message={
              alunoParaRemover
                ? `Tem certeza que deseja remover "${alunoParaRemover.nome}" desta turma?`
                : ""
            }
            confirmText="Remover"
            cancelText="Cancelar"
            onConfirm={confirmarRemoverAluno}
            onCancel={() => {
              if (!removendoAlunoId) setAlunoParaRemover(null);
            }}
            danger
            isLoading={Boolean(removendoAlunoId)}
          />
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
