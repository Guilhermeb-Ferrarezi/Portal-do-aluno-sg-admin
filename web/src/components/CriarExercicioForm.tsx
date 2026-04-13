import React from "react";
import { cn } from "@/lib/utils";
import Pagination from "./Pagination";
import PaginatedSelect from "./PaginatedSelect";
import MultipleChoiceQuestion from "./Exercise/MultipleChoiceQuestion";
import MultipleChoiceQuestionEditor from "./Exercise/MultipleChoiceQuestionEditor";
import ExerciseAIDraftGenerator from "./ExerciseAIDraftGenerator";
import {
  ScaleIn,
  AnimatedRadioLabel,
  AnimatedButton,
  ConditionalFieldAnimation,
  AnimatedSelect,
  FadeInUp,
  AnimatedToggle,
} from "./animate-ui";
import {
  Laptop,
  Monitor,
  PenLine,
  ListChecks,
  Eye,
  Sparkles,
  BookOpen,
} from "lucide-react";
import {
  criarExercicio,
  listarExerciciosPorFase,
  listarContainersPorFase,
  adicionarExerciciosAoContainer,
  listarCursos,
  listarModulos,
  listarModulosPorCurso,
  listarFasesDoModulo,
  listarTurmas,
  anexarExercicioArquivo,
  type ExerciseAIDraft,
  type ContainerGroup,
  type Curso,
  type Modulo,
  type Fase,
  type Turma,
} from "../services/api";
import { useToastActions } from "../contexts/ToastContext";

type CategoriaExercicio = "programacao" | "informatica";
type RequiredFieldKey = "titulo" | "descricao" | "curso" | "modulo" | "fase" | "prazo" | "multipla" | "ordem";
const CONTAINER_BLOCKED_DIFFICULTIES = new Set([2, 3]);
const CONTAINER_BLOCKED_MESSAGE = "Lower e Prova Semanal não podem ser adicionados em container.";

function inferCategoriaFromCourseName(courseName: string | null | undefined): CategoriaExercicio {
  const normalized = (courseName ?? "").toLowerCase();
  if (normalized.includes("inform") || normalized.includes("excel") || normalized.includes("office")) {
    return "informatica";
  }
  return "programacao";
}

function getDefaultMultiplaQuestoes() {
  return [{
    pergunta: "",
    opcoes: [
      { letter: "A", text: "" },
      { letter: "B", text: "" },
      { letter: "C", text: "" },
      { letter: "D", text: "" },
    ],
    respostaCorreta: "",
  }];
}

function normalizeListPayload<T>(payload: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray((payload as { items?: T[] }).items)) {
    return (payload as { items: T[] }).items;
  }
  return [];
}

interface CriarExercicioFormProps {
  onCreated?: () => void;
}

export default function CriarExercicioForm({ onCreated }: CriarExercicioFormProps) {
  const { addToast } = useToastActions();
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </span>
  );
  const formCardClass =
    "rounded-[28px] border border-border/70 bg-card/95 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.12)] sm:p-6";
  const titleClass = "text-2xl font-black tracking-[-0.03em] text-foreground sm:text-[1.9rem]";
  const formGridClass = "grid gap-5";
  const fieldGroupClass = "flex flex-col gap-2";
  const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";
  const fieldInputClass =
    "h-11 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-3 focus:ring-ring/30";
  const fieldTextareaClass = cn(fieldInputClass, "min-h-28 h-auto py-3 leading-6");
  const warningControlClass = "border-amber-300/80 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10";
  const warningTextClass = "text-xs font-medium text-amber-700 dark:text-amber-300";
  const rowClass = "grid gap-4 xl:grid-cols-3";
  const compactRowClass = "grid gap-4 md:grid-cols-2";
  const radioRowClass = "mt-2 flex flex-wrap gap-3";
  const toggleGroupClass = (warning = false) =>
    cn(
      "grid max-h-[22rem] gap-2 overflow-y-auto rounded-[24px] border border-border/70 bg-muted/25 p-3 pr-2",
      warning && "border-amber-300/80 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
    );
  const toggleOptionClass = (active: boolean) =>
    cn(
      "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition",
      active
        ? "border-primary/45 bg-primary/10 text-foreground shadow-[0_0_0_1px_rgba(var(--primary-rgb),0.12)]"
        : "border-border/70 bg-background/75 text-muted-foreground hover:border-primary/30 hover:bg-accent hover:text-foreground"
    );
  const toggleDotClass = (active: boolean) =>
    cn(
      "inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition",
      active
        ? "border-primary/60 bg-primary/10 shadow-[0_0_0_4px_rgba(var(--primary-rgb),0.12)]"
        : "border-border/70 bg-background/80"
    );
  const toggleDotInnerClass = (active: boolean) =>
    cn("size-2 rounded-full transition", active ? "bg-primary" : "bg-transparent");
  const toggleLabelClass = "inline-flex items-center gap-2 text-sm font-medium";
  const courseSectionClass = "grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)] xl:items-start";
  const courseListColumnClass = "flex flex-col gap-3";
  const courseSidebarClass = "flex flex-col gap-3";
  const courseFilterRowClass = "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]";
  const courseActionsClass = "mt-3 flex flex-col gap-3";
  const coursePaginationSummaryClass =
    "flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-xs font-medium text-muted-foreground";
  const courseSelectedClass = (hasSelection: boolean) =>
    cn(
      "grid gap-1 rounded-2xl border px-4 py-3",
      hasSelection
        ? "border-emerald-300/70 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/10"
        : "border-border/70 bg-muted/35"
    );
  const courseSelectedLabelClass = "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
  const courseSelectedValueClass = "text-sm font-semibold text-foreground";
  const courseQuickStatsClass = "grid gap-3 sm:grid-cols-2";
  const courseQuickStatCardClass = "grid gap-1 rounded-2xl border border-border/70 bg-background/75 px-4 py-3";
  const secondaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
  const courseDetailsPanelClass = "mt-3 grid gap-4 rounded-[24px] border border-border/70 bg-muted/20 p-4";
  const courseDetailsGridClass = "grid gap-3 sm:grid-cols-2 xl:grid-cols-4";
  const courseDetailItemClass = "grid gap-1 rounded-2xl border border-border/70 bg-background/75 px-4 py-3";
  const courseDescriptionClass = "text-sm leading-6 text-muted-foreground";
  const courseModulesPreviewClass = "grid gap-2";
  const courseModulesChipsClass = "flex flex-wrap gap-2";
  const courseModuleChipClass = (isMore = false) =>
    cn(
      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
      isMore
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-border/70 bg-background/75 text-muted-foreground"
    );
  const fieldWarnWrapClass = (warning = false) =>
    cn(
      "rounded-[24px] transition",
      warning && "rounded-[24px] border border-amber-300/80 bg-amber-50/60 p-2 dark:border-amber-500/30 dark:bg-amber-500/10"
    );
  const statusToggleClass = (active: boolean) =>
    cn(
      "flex h-full cursor-pointer items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition",
      active
        ? "border-primary/45 bg-primary/10"
        : "border-border/70 bg-background/80 hover:border-primary/30 hover:bg-accent/60"
    );
  const statusToggleContentClass = "flex min-w-0 flex-col gap-1";
  const statusToggleTitleClass = "text-sm font-semibold text-foreground";
  const statusToggleDescriptionClass = "text-sm leading-6 text-muted-foreground";
  const sectionHintClass = "text-xs leading-5 text-muted-foreground";
  const containerToggleShellClass = (disabled: boolean) =>
    cn(
      "flex items-center gap-3 rounded-2xl border px-4 py-3 transition",
      disabled
        ? "cursor-not-allowed border-border/50 bg-muted/25 opacity-60"
        : "cursor-pointer border-border/70 bg-background/70 hover:border-primary/30 hover:bg-accent/50"
    );
  const containerToggleTextClass = "text-sm font-medium text-foreground select-none";
  const containerSummaryClass = "mt-2 rounded-2xl border border-border/60 bg-background/70 p-3";
  const containerSummaryHeadClass =
    "mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";
  const containerSummaryListClass = "flex flex-col gap-1.5";
  const containerSummaryItemClass =
    "flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/35 px-3 py-2 text-sm";
  const containerSummaryOrderClass = "min-w-7 shrink-0 text-xs font-bold text-primary";
  const containerSummaryTitleClass = "flex-1 text-foreground";
  const submitButtonClass =
    "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";
  const subtleHintClass = "text-xs text-slate-500 dark:text-slate-400";

  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [cursosDisponiveis, setCursosDisponiveis] = React.useState<Curso[]>([]);
  const [cursoIdSelecionado, setCursoIdSelecionado] = React.useState("");
  const [todosModulosDisponiveis, setTodosModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [modulosDisponiveis, setModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [moduloSelectBusca, setModuloSelectBusca] = React.useState("");
  const [moduloSelectPagina, setModuloSelectPagina] = React.useState(1);
  const [moduloSelectTotalPages, setModuloSelectTotalPages] = React.useState(1);
  const [moduloSelectCarregando, setModuloSelectCarregando] = React.useState(false);
  const [moduloSelecionadoCache, setModuloSelecionadoCache] = React.useState<Modulo | null>(null);
  const [fasesDisponiveis, setFasesDisponiveis] = React.useState<Fase[]>([]);
  const [faseSelectBusca, setFaseSelectBusca] = React.useState("");
  const [faseSelectPagina, setFaseSelectPagina] = React.useState(1);
  const [faseSelectTotalPages, setFaseSelectTotalPages] = React.useState(1);
  const [faseSelectCarregando, setFaseSelectCarregando] = React.useState(false);
  const [faseSelecionadaCache, setFaseSelecionadaCache] = React.useState<Fase | null>(null);
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");
  const [faseIdSelecionada, setFaseIdSelecionada] = React.useState("");
  const [prazo, setPrazo] = React.useState("");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("");
  const [indexOrder, setIndexOrder] = React.useState("");
  const [pointsRedeem, setPointsRedeem] = React.useState("");
  const [isFinalExercise, setIsFinalExercise] = React.useState(false);
  const [isDailyTask, setIsDailyTask] = React.useState(false);
  const [categoria, setCategoria] = React.useState<CategoriaExercicio>("programacao");
  const [componenteInterativo, setComponenteInterativo] = React.useState("escrita");
  const [multiplaQuestoes, setMultiplaQuestoes] = React.useState<Array<{
    pergunta: string;
    opcoes: Array<{ letter: string; text: string }>;
    respostaCorreta: string;
  }>>(() => getDefaultMultiplaQuestoes());
  const [anexosAtivo, setAnexosAtivo] = React.useState(false);
  const [anexoArquivo, setAnexoArquivo] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [fieldWarnings, setFieldWarnings] = React.useState<Partial<Record<RequiredFieldKey, string>>>({});
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [cursoCardsFiltro, setCursoCardsFiltro] = React.useState("");
  const [cursoCardsPagina, setCursoCardsPagina] = React.useState(1);
  const [cursoCardsItensPorPagina, setCursoCardsItensPorPagina] = React.useState(5);
  const [mostrarDetalhesCurso, setMostrarDetalhesCurso] = React.useState(false);
  const [containersDaFase, setContainersDaFase] = React.useState<ContainerGroup[]>([]);
  const [carregandoContainersFase, setCarregandoContainersFase] = React.useState(false);
  const [adicionarEmContainer, setAdicionarEmContainer] = React.useState(false);
  const [containerSelecionadoKey, setContainerSelecionadoKey] = React.useState("");

  const createDepsLoadedRef = React.useRef(false);
  const createDepsLoadingRef = React.useRef(false);

  function updateMultiplaQuestaoOpcao(qIndex: number, oIndex: number, value: string) {
    setMultiplaQuestoes((prev) =>
      prev.map((questao, index) =>
        index !== qIndex
          ? questao
          : {
              ...questao,
              opcoes: questao.opcoes.map((opcao, optionIndex) =>
                optionIndex !== oIndex ? opcao : { ...opcao, text: value }
              ),
            }
      )
    );
  }

  function updateMultiplaQuestaoCorreta(qIndex: number, value: string) {
    setMultiplaQuestoes((prev) =>
      prev.map((questao, index) =>
        index !== qIndex ? questao : { ...questao, respostaCorreta: value }
      )
    );
  }

  function removeMultiplaQuestao(qIndex: number) {
    setMultiplaQuestoes((prev) => prev.filter((_, index) => index !== qIndex));
  }

  const moduloSelecionado = React.useMemo(
    () => modulosDisponiveis.find((m) => m.id === moduloIdSelecionado) ?? moduloSelecionadoCache ?? todosModulosDisponiveis.find((m) => m.id === moduloIdSelecionado) ?? null,
    [moduloSelecionadoCache, modulosDisponiveis, todosModulosDisponiveis, moduloIdSelecionado]
  );

  const faseSelecionada = React.useMemo(
    () => fasesDisponiveis.find((f) => f.id === faseIdSelecionada) ?? faseSelecionadaCache ?? null,
    [fasesDisponiveis, faseIdSelecionada, faseSelecionadaCache]
  );

  const cursoSelecionado = React.useMemo(
    () => cursosDisponiveis.find((c) => c.id === cursoIdSelecionado) ?? null,
    [cursosDisponiveis, cursoIdSelecionado]
  );

  const modulosDoCursoSelecionado = React.useMemo(
    () => todosModulosDisponiveis.filter((m) => m.courseId === cursoIdSelecionado),
    [todosModulosDisponiveis, cursoIdSelecionado]
  );

  const cursosToggleOrdenados = React.useMemo(() => {
    const cursosGratuitos = cursosDisponiveis.filter((c) => c.isPaid !== true);
    if (turmasDisponiveis.length === 0) return cursosGratuitos;
    const cursoIdsPorTurma = new Set(
      turmasDisponiveis.filter((t) => t.tipo === "turma" && t.courseId).map((t) => t.courseId as string)
    );
    if (cursoIdsPorTurma.size === 0) return cursosGratuitos;
    return cursosGratuitos.filter((c) => cursoIdsPorTurma.has(c.id));
  }, [cursosDisponiveis, turmasDisponiveis]);
  void cursosToggleOrdenados;

  const cursosGratuitosDisponiveis = React.useMemo(
    () => cursosDisponiveis.filter((c) => c.isPaid !== true),
    [cursosDisponiveis]
  );

  const cursosToggleFiltrados = React.useMemo(() => {
    const termo = cursoCardsFiltro.trim().toLowerCase();
    if (!termo) return cursosGratuitosDisponiveis;
    return cursosGratuitosDisponiveis.filter((c) => {
      const nome = c.nome?.toLowerCase() ?? "";
      const desc = c.descricao?.toLowerCase() ?? "";
      return nome.includes(termo) || desc.includes(termo);
    });
  }, [cursosGratuitosDisponiveis, cursoCardsFiltro]);

  const cursosCardsTotalPaginas = Math.max(1, Math.ceil(cursosToggleFiltrados.length / cursoCardsItensPorPagina));

  const cursosTogglePaginados = React.useMemo(() => {
    const inicio = (cursoCardsPagina - 1) * cursoCardsItensPorPagina;
    return cursosToggleFiltrados.slice(inicio, inicio + cursoCardsItensPorPagina);
  }, [cursosToggleFiltrados, cursoCardsPagina, cursoCardsItensPorPagina]);

  const clearFieldWarning = React.useCallback((field: RequiredFieldKey) => {
    setFieldWarnings((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const showErrorToast = React.useCallback((message: string, duration = 4000) => {
    addToast(message, "error", duration);
  }, [addToast]);

  async function getNextAvailableIndex(phaseId: string) {
    const exerciciosDaFase = await listarExerciciosPorFase(phaseId);
    const usedIndexes = new Set(
      exerciciosDaFase
        .map((ex) => Number(ex.indexOrder))
        .filter((value) => Number.isInteger(value) && value > 0)
    );

    let nextIndex = 1;
    while (usedIndexes.has(nextIndex)) {
      nextIndex += 1;
    }

    return nextIndex;
  }

  const handleSelecionarCurso = React.useCallback((courseId: string) => {
    clearFieldWarning("curso");
    clearFieldWarning("modulo");
    clearFieldWarning("fase");
    clearFieldWarning("ordem");
    const trocouCurso = courseId !== cursoIdSelecionado;
    if (trocouCurso) {
      setModuloIdSelecionado("");
      setModulosDisponiveis([]);
      setModuloSelecionadoCache(null);
      setModuloSelectBusca("");
      setModuloSelectPagina(1);
      setModuloSelectTotalPages(1);
      setFaseIdSelecionada("");
      setFasesDisponiveis([]);
      setFaseSelecionadaCache(null);
      setFaseSelectBusca("");
      setFaseSelectPagina(1);
      setFaseSelectTotalPages(1);
      setMostrarDetalhesCurso(false);
    }
    setCursoIdSelecionado(courseId);
    const curso = cursosDisponiveis.find((item) => item.id === courseId);
    if (!curso) return;
    const categoriaInferida = inferCategoriaFromCourseName(curso.nome);
    if (categoriaInferida !== categoria) {
      setCategoria(categoriaInferida);
      setComponenteInterativo("escrita");
    }
  }, [categoria, clearFieldWarning, cursoIdSelecionado, cursosDisponiveis]);

  function collectRequiredFieldWarnings(params: {
    tituloFinal: string;
    descricaoFinal: string;
    moduloNome: string;
    phaseIdNum: number;
    courseIdNum: number;
  }) {
    const warnings: Partial<Record<RequiredFieldKey, string>> = {};
    const isInteractiveComponentInformatica = categoria === "informatica" && componenteInterativo !== "";
    if (!isInteractiveComponentInformatica && params.tituloFinal.length < 2) {
      warnings.titulo = "Titulo obrigatorio (minimo 2 caracteres).";
    }
    if (!isInteractiveComponentInformatica && params.descricaoFinal.length < 2) {
      warnings.descricao = "Descricao obrigatoria (minimo 2 caracteres).";
    }
    if (!Number.isFinite(params.courseIdNum) || params.courseIdNum <= 0) {
      warnings.curso = "Selecione um curso.";
    }
    if (!params.moduloNome) {
      warnings.modulo = "Selecione um modulo.";
    }
    if (!Number.isFinite(params.phaseIdNum) || params.phaseIdNum <= 0) {
      warnings.fase = "Selecione uma fase.";
    }
    if (isDailyTaskEfetivo && !prazo) {
      warnings.prazo = "Prazo obrigatorio.";
    }
    if (componenteInterativo === "multipla" && multiplaQuestoes.some((q) => !q.respostaCorreta || q.opcoes.some((o) => !o.text))) {
      warnings.multipla = "Complete todas as opcoes e a resposta correta.";
    }
    return warnings;
  }

  function parseDifficultyValue(value: string) {
    const normalized = value.trim();
    if (!normalized) return null;

    const legacyMap: Record<string, number> = {
      normal: 1,
      lower: 2,
      prova_semanal: 3,
    };

    const mapped = legacyMap[normalized] ?? Number(normalized);
    if (!Number.isInteger(mapped) || mapped < 1) return null;
    return mapped;
  }

  function getContainerGroupKey(container: ContainerGroup) {
    return `${container.name}__${container.containerDateTargetInt ?? "null"}__${container.isDailyTask ? "daily" : "normal"}`;
  }

  const dificuldadeBloqueadaParaContainer = React.useMemo(() => {
    const dificuldadeSelecionada = parseDifficultyValue(difficulty);
    return dificuldadeSelecionada !== null && CONTAINER_BLOCKED_DIFFICULTIES.has(dificuldadeSelecionada);
  }, [difficulty]);

  const containerSelecionado = React.useMemo(
    () => containersDaFase.find((container) => getContainerGroupKey(container) === containerSelecionadoKey) ?? null,
    [containerSelecionadoKey, containersDaFase]
  );

  const isDailyTaskForcadoPorContainer = containerSelecionado?.isDailyTask === true;
  const isDailyTaskEfetivo = isDailyTask || isDailyTaskForcadoPorContainer;
  const prazoObrigatorio = isDailyTaskEfetivo;

  const opcoesDificuldade = React.useMemo(() => {
    const opcoes = [
      { value: "", label: "Selecione" },
      { value: "1", label: "Normal" },
      { value: "2", label: "Lower (Recuperação)" },
      { value: "3", label: "Prova Semanal" },
    ];

    if (adicionarEmContainer) {
      return opcoes.filter((opcao) => opcao.value === "1");
    }

    return opcoes;
  }, [adicionarEmContainer]);

  function buildMultiplaQuestoesPayload(
    questoes: Array<{ pergunta: string; opcoes: Array<{ letter: string; text: string }>; respostaCorreta: string }>,
    perguntaBase: string
  ) {
    const fallbackPergunta = perguntaBase.trim();
    return questoes.map((questao, index) => ({
      ...questao,
      pergunta: fallbackPergunta || `Questao ${index + 1}`,
    }));
  }

  function buildMultiplaRegrasValue(
    questoes: Array<{ pergunta: string; opcoes: Array<{ letter: string; text: string }>; respostaCorreta: string }>,
    perguntaBase: string
  ) {
    return JSON.stringify({ questoes: buildMultiplaQuestoesPayload(questoes, perguntaBase) });
  }

  function mapDraftMultiplaQuestoes(draft: ExerciseAIDraft) {
    if (draft.multiplaQuestoes.length === 0) {
      return getDefaultMultiplaQuestoes();
    }

    return draft.multiplaQuestoes.map((questao) => ({
      pergunta: questao.pergunta ?? "",
      opcoes: questao.opcoes.map((opcao) => ({
        letter: opcao.letter,
        text: opcao.text,
      })),
      respostaCorreta: questao.respostaCorreta ?? "",
    }));
  }

  function applyAIDraft(
    draft: ExerciseAIDraft,
    nextComponentType: "escrita" | "multipla" = componenteInterativo === "multipla" ? "multipla" : "escrita"
  ) {
    clearFieldWarning("titulo");
    clearFieldWarning("descricao");
    clearFieldWarning("multipla");
    if (nextComponentType !== componenteInterativo) {
      setComponenteInterativo(nextComponentType);
    }
    setTitulo(draft.titulo);
    setDescricao(draft.descricao);
    setDifficulty(String(draft.difficulty));
    setPointsRedeem(String(draft.pointsRedeem));

    if (nextComponentType === "multipla") {
      if (draft.multiplaQuestoes.length > 0) {
        setMultiplaQuestoes(mapDraftMultiplaQuestoes(draft));
      }
      return;
    }

    if (componenteInterativo === "multipla") {
      setMultiplaQuestoes(getDefaultMultiplaQuestoes());
    }
  }

  function resetForm() {
    setFieldWarnings({});
    setTitulo("");
    setDescricao("");
    setCursoIdSelecionado("");
    setModuloIdSelecionado("");
    setModuloSelecionadoCache(null);
    setModuloSelectBusca("");
    setModuloSelectPagina(1);
    setModuloSelectTotalPages(1);
    setFaseIdSelecionada("");
    setMostrarDetalhesCurso(false);
    setPrazo("");
    setVideoUrl("");
    setDifficulty("");
    setIndexOrder("");
    setPointsRedeem("");
    setIsFinalExercise(false);
    setIsDailyTask(false);
    setCategoria("programacao");
    setComponenteInterativo("escrita");
    setMultiplaQuestoes(getDefaultMultiplaQuestoes());
    setContainersDaFase([]);
    setAdicionarEmContainer(false);
    setContainerSelecionadoKey("");
    setAnexosAtivo(false);
    setAnexoArquivo(null);
  }

  async function ensureCreateDependenciesLoaded(force = false) {
    if (createDepsLoadingRef.current) return;
    if (createDepsLoadedRef.current && !force) return;
    createDepsLoadingRef.current = true;
    try {
      const [cursosResult, modulosResult, turmasResult] = await Promise.allSettled([
        listarCursos(),
        listarModulos(),
        listarTurmas(),
      ]);
      if (cursosResult.status === "fulfilled") {
        setCursosDisponiveis(normalizeListPayload<Curso>(cursosResult.value as Curso[] | { items?: Curso[] }));
        createDepsLoadedRef.current = true;
      }
      if (modulosResult.status === "fulfilled") {
        setTodosModulosDisponiveis(normalizeListPayload<Modulo>(modulosResult.value as Modulo[] | { items?: Modulo[] }));
      }
      if (turmasResult.status === "fulfilled") {
        const turmas = Array.isArray(turmasResult.value) ? turmasResult.value : (turmasResult.value as any)?.items ?? [];
        setTurmasDisponiveis(turmas);
      }
    } catch (e) {
      console.error("Erro ao carregar dependencias de criacao:", e);
    } finally {
      createDepsLoadingRef.current = false;
    }
  }

  React.useEffect(() => {
    void ensureCreateDependenciesLoaded();
  }, []);

  React.useEffect(() => {
    if (!cursoIdSelecionado) {
      setModulosDisponiveis([]);
      setModuloIdSelecionado("");
      setModuloSelecionadoCache(null);
      setFasesDisponiveis([]);
      setFaseIdSelecionada("");
      return;
    }

    let ativo = true;
    setModuloSelectCarregando(true);

    listarModulosPorCurso(cursoIdSelecionado, {
      page: moduloSelectPagina,
      limit: 8,
      q: moduloSelectBusca || undefined,
    })
      .then((response) => {
        if (!ativo) return;

        const modulos = normalizeListPayload<Modulo>(response as Modulo[] | { items?: Modulo[] });
        setModulosDisponiveis(modulos);

        if (!Array.isArray(response)) {
          setModuloSelectTotalPages(response.pagination.totalPages);
        } else {
          setModuloSelectTotalPages(1);
        }

        if (modulos.length > 0) {
          setTodosModulosDisponiveis((prev) => {
            const map = new Map<string, Modulo>();
            prev.forEach((m) => map.set(m.id, m));
            modulos.forEach((m) => map.set(m.id, m));
            return Array.from(map.values());
          });
        }
      })
      .catch(console.error)
      .finally(() => {
        if (ativo) setModuloSelectCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [cursoIdSelecionado, moduloSelectBusca, moduloSelectPagina]);

  React.useEffect(() => {
    const found = modulosDisponiveis.find((m) => m.id === moduloIdSelecionado) ?? null;
    if (found) {
      setModuloSelecionadoCache(found);
    }
  }, [moduloIdSelecionado, modulosDisponiveis]);

  React.useEffect(() => {
    if (!cursoSelecionado) return;
    const categoriaInferida = inferCategoriaFromCourseName(cursoSelecionado.nome);
    if (categoriaInferida !== categoria) {
      setCategoria(categoriaInferida);
      setComponenteInterativo("escrita");
    }
  }, [cursoSelecionado, categoria]);

  React.useEffect(() => {
    if (cursosGratuitosDisponiveis.length === 0) return;
    const cursoAtualValido = cursosGratuitosDisponiveis.some((curso) => curso.id === cursoIdSelecionado);
    if (!cursoAtualValido) {
      handleSelecionarCurso(cursosGratuitosDisponiveis[0]!.id);
    }
  }, [cursosGratuitosDisponiveis, cursoIdSelecionado, handleSelecionarCurso]);

  React.useEffect(() => { setCursoCardsPagina(1); }, [cursoCardsFiltro]);
  React.useEffect(() => { if (cursoCardsPagina > cursosCardsTotalPaginas) setCursoCardsPagina(cursosCardsTotalPaginas); }, [cursoCardsPagina, cursosCardsTotalPaginas]);

  React.useEffect(() => {
    if (!moduloIdSelecionado) {
      setFasesDisponiveis([]);
      setFaseIdSelecionada("");
      setFaseSelecionadaCache(null);
      setFaseSelectBusca("");
      setFaseSelectPagina(1);
      setFaseSelectTotalPages(1);
      return;
    }

    let ativo = true;
    setFaseSelectCarregando(true);

    listarFasesDoModulo(moduloIdSelecionado, {
      page: faseSelectPagina,
      limit: 8,
      q: faseSelectBusca || undefined,
    })
      .then((response) => {
        if (!ativo) return;

        if (Array.isArray(response)) {
          setFasesDisponiveis(response);
          setFaseSelectTotalPages(1);
          setFaseIdSelecionada((prev) => (prev && response.some((f) => f.id === prev) ? prev : prev));
          return;
        }

        setFasesDisponiveis(response.items);
        setFaseSelectTotalPages(response.pagination.totalPages);
        setFaseIdSelecionada((prev) => (prev && response.items.some((f) => f.id === prev) ? prev : prev));
      })
      .catch(console.error)
      .finally(() => {
        if (ativo) setFaseSelectCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [faseSelectBusca, faseSelectPagina, moduloIdSelecionado]);

  React.useEffect(() => {
    const found = fasesDisponiveis.find((f) => f.id === faseIdSelecionada) ?? null;
    if (found) {
      setFaseSelecionadaCache(found);
    }
  }, [fasesDisponiveis, faseIdSelecionada]);

  React.useEffect(() => {
    if (!faseIdSelecionada) {
      setContainersDaFase([]);
      setAdicionarEmContainer(false);
      setContainerSelecionadoKey("");
      return;
    }

    let ativo = true;
    setCarregandoContainersFase(true);

    listarContainersPorFase(faseIdSelecionada)
      .then((resultado) => {
        if (!ativo) return;
        setContainersDaFase(resultado);
      })
      .catch(() => {
        if (!ativo) return;
        setContainersDaFase([]);
      })
      .finally(() => {
        if (ativo) setCarregandoContainersFase(false);
      });

    return () => {
      ativo = false;
    };
  }, [faseIdSelecionada]);

  React.useEffect(() => {
    if (!adicionarEmContainer || !dificuldadeBloqueadaParaContainer) return;
    setAdicionarEmContainer(false);
    setContainerSelecionadoKey("");
    showErrorToast(CONTAINER_BLOCKED_MESSAGE);
  }, [adicionarEmContainer, dificuldadeBloqueadaParaContainer, showErrorToast]);

  React.useEffect(() => {
    if (!prazoObrigatorio) {
      clearFieldWarning("prazo");
    }
  }, [clearFieldWarning, prazoObrigatorio]);

  React.useEffect(() => {
    if (!adicionarEmContainer) return;
    if (difficulty !== "1") {
      setDifficulty("1");
    }
  }, [adicionarEmContainer, difficulty]);

  React.useEffect(() => {
    if (!containerSelecionado) return;
    if (containerSelecionado.isDailyTask !== isDailyTask) {
      setIsDailyTask(containerSelecionado.isDailyTask);
    }
  }, [containerSelecionado, isDailyTask]);

  function handleChangeIsDailyTask(nextValue: boolean) {
    if (isDailyTaskForcadoPorContainer && !nextValue) {
      return;
    }
    setIsDailyTask(nextValue);
  }

  async function handleSubmit() {
    try {
      setSaving(true);
      const descricaoFinal = descricao.trim();
      const tituloFinal = titulo.trim();
      const tipoSelecionado: "escrita" | "multipla" = componenteInterativo === "multipla" ? "multipla" : "escrita";
      const dificuldadeNum = parseDifficultyValue(difficulty);
      const ordemNum = indexOrder.trim() ? Number(indexOrder) : null;
      const pontosNum = pointsRedeem.trim() ? Number(pointsRedeem) : null;
      const videoUrlLimpa = videoUrl.trim();
      const courseIdNum = Number(cursoIdSelecionado);
      const phaseIdNum = Number(faseIdSelecionada);

      if (indexOrder.trim() && (!Number.isInteger(ordemNum) || Number(ordemNum) < 1)) {
        showErrorToast("Ordem deve ser um numero inteiro maior ou igual a 1.");
        setSaving(false);
        return;
      }
      if (pointsRedeem.trim() && (!Number.isInteger(pontosNum) || Number(pontosNum) < 0)) {
        showErrorToast("Pontos deve ser um numero inteiro maior ou igual a 0.");
        setSaving(false);
        return;
      }
      if (videoUrlLimpa) {
        try { new URL(videoUrlLimpa); } catch { showErrorToast("Video URL invalida."); setSaving(false); return; }
      }
      if (difficulty.trim() && dificuldadeNum === null) {
        showErrorToast("Selecione uma dificuldade valida.");
        setSaving(false);
        return;
      }

      const moduloNome = moduloSelecionado?.nome?.trim() ?? "";
      const faseNome = faseSelecionada?.nome?.trim() ?? null;
      const requiredWarnings = collectRequiredFieldWarnings({ tituloFinal, descricaoFinal, moduloNome, phaseIdNum, courseIdNum });

      if (Object.keys(requiredWarnings).length > 0) {
        setFieldWarnings(requiredWarnings);
        showErrorToast("Preencha os campos obrigatorios em destaque.");
        setSaving(false);
        return;
      }
      setFieldWarnings({});

      let containerParaAdicionar: ContainerGroup | null = null;
      if (adicionarEmContainer) {
        if (CONTAINER_BLOCKED_DIFFICULTIES.has(dificuldadeNum ?? 1)) {
          showErrorToast(CONTAINER_BLOCKED_MESSAGE);
          setSaving(false);
          return;
        }

        if (!containerSelecionadoKey) {
          showErrorToast("Selecione um container para adicionar o exercício.");
          setSaving(false);
          return;
        }

        containerParaAdicionar = containersDaFase.find((container) => getContainerGroupKey(container) === containerSelecionadoKey) ?? null;
        if (!containerParaAdicionar) {
          showErrorToast("Container selecionado não encontrado para esta fase.");
          setSaving(false);
          return;
        }
      }

      let ordemFinal = ordemNum;
      if (ordemFinal === null) {
        try {
          ordemFinal = await getNextAvailableIndex(faseIdSelecionada);
        } catch {
          showErrorToast("Nao foi possivel calcular a proxima ordem disponivel para esta fase.");
          setSaving(false);
          return;
        }
      }

      const exercisePeriodIso = new Date().toISOString();
      const prazoIso = prazo ? new Date(prazo).toISOString() : new Date().toISOString();

      const dados: Record<string, unknown> = {
        titulo: tituloFinal,
        descricao: descricaoFinal,
        phase_id: phaseIdNum,
        course_id: courseIdNum,
        modulo: moduloNome,
        tema: faseNome,
        prazo: prazoIso,
        video_url: videoUrlLimpa || null,
        difficulty: dificuldadeNum,
        index_order: ordemFinal,
        is_final_exercise: isFinalExercise,
        is_daily_task: isDailyTaskEfetivo,
        points_redeem: pontosNum,
        exercise_period: exercisePeriodIso,
        publicado: true,
        published_at: null,
        categoria,
        ...(tipoSelecionado ? { tipoExercicio: tipoSelecionado } : {}),
        multipla_regras: componenteInterativo === "multipla" ? buildMultiplaRegrasValue(multiplaQuestoes, descricaoFinal) : null,
        permitir_repeticao: false,
        max_tentativas: null,
        penalidade_por_tentativa: 0,
        intervalo_reenvio: null,
      };

      const created = await criarExercicio(dados as any);
      const exercicioId = (created as any)?.exercicio?.id ?? null;
      addToast("Exercicio criado!", "success", 3000);

      if (exercicioId && containerParaAdicionar) {
        const exercicioIdNumero = Number(exercicioId);
        if (!Number.isFinite(exercicioIdNumero) || exercicioIdNumero <= 0) {
          addToast("Exercicio criado, mas não foi possível adicionar no container automaticamente.", "error", 3500);
        } else {
          try {
            await adicionarExerciciosAoContainer({
              name: containerParaAdicionar.name,
              phase_id: Number(containerParaAdicionar.phaseId),
              container_date_target_int: containerParaAdicionar.containerDateTargetInt,
              is_daily_task: containerParaAdicionar.isDailyTask,
              exercise_ids: [exercicioIdNumero],
            });
            addToast("Exercicio adicionado ao container!", "success", 3000);
          } catch {
            addToast("Exercicio criado, mas houve erro ao adicionar no container.", "error", 3500);
          }
        }
      }

      if (exercicioId && anexosAtivo && anexoArquivo) {
        await anexarExercicioArquivo(exercicioId, anexoArquivo);
      }

      resetForm();
      onCreated?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao salvar Exercicio";
      if (message.toLowerCase().includes("index disponivel") || message.toLowerCase().includes("menor ordem")) {
        setFieldWarnings((prev) => ({ ...prev, ordem: message }));
      }
      showErrorToast(message);
    } finally {
      setSaving(false);
    }
  }

  const disabled =
    saving ||
    !titulo.trim() ||
    !cursoIdSelecionado ||
    !moduloIdSelecionado ||
    !faseIdSelecionada ||
    (prazoObrigatorio && !prazo);
  const aiDifficultyValue = parseDifficultyValue(difficulty);
  const hasAIDraftOverwriteContent =
    componenteInterativo === "multipla"
      ? Boolean(
        titulo.trim() ||
        descricao.trim() ||
        difficulty.trim() ||
        pointsRedeem.trim() ||
        multiplaQuestoes.some((questao) =>
          questao.respostaCorreta.trim() || questao.opcoes.some((opcao) => opcao.text.trim())
        )
      )
      : Boolean(titulo.trim() || descricao.trim() || difficulty.trim() || pointsRedeem.trim());

  return (
    <div className="col-span-full">
      <FadeInUp duration={0.28}>
        <div className={formCardClass}>
          <h2 className={titleClass}>Criar novo exercicio</h2>

          <div className={formGridClass}>
            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Nome do exercício *</span>
              <input
                className={cn(fieldInputClass, fieldWarnings.titulo && warningControlClass)}
                placeholder="ex: Exercicio 15.3: Layout Responsivo"
                value={titulo}
                onChange={(e) => { setTitulo(e.target.value); clearFieldWarning("titulo"); }}
              />
              {fieldWarnings.titulo && <small className={warningTextClass}>{fieldWarnings.titulo}</small>}
            </div>

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Pergunta *</span>
              <textarea
                className={cn(fieldTextareaClass, fieldWarnings.descricao && warningControlClass)}
                placeholder="Descreva a pergunta do exercício em detalhes..."
                value={descricao}
                onChange={(e) => { setDescricao(e.target.value); clearFieldWarning("descricao"); }}
              />
              {fieldWarnings.descricao && <small className={warningTextClass}>{fieldWarnings.descricao}</small>}
            </div>

            {/* TIPO DE EXERCICIO - Programacao */}
            {categoria === "programacao" && (
              <>
                <div className={fieldGroupClass}>
                  <span className={fieldLabelClass}>Tipo de Exercicio</span>
                  <div className={radioRowClass}>
                    <AnimatedRadioLabel name="tipoExCriar" value="escrita" checked={componenteInterativo === "escrita"} onChange={(e) => setComponenteInterativo(e.target.value)} label="Escrita" icon={<PenLine size={14} />} />
                    <AnimatedRadioLabel name="tipoExCriar" value="multipla" checked={componenteInterativo === "multipla"} onChange={(e) => setComponenteInterativo(e.target.value)} label="Multipla Escolha" icon={<ListChecks size={14} />} />
                  </div>
                </div>

                {componenteInterativo === "multipla" && (
                  <ScaleIn>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <ListChecks size={14} className="text-amber-700 dark:text-amber-300" />
                          <span>Configurar questões de múltipla escolha</span>
                        </div>
                        <div className="space-y-3">
                          {multiplaQuestoes.map((questao, qIndex) => (
                            <MultipleChoiceQuestionEditor
                              key={`prog-q-${qIndex}`}
                              questionIndex={qIndex}
                              opcoes={questao.opcoes}
                              respostaCorreta={questao.respostaCorreta}
                              onChangeOpcao={(oIndex, value) =>
                                updateMultiplaQuestaoOpcao(qIndex, oIndex, value)
                              }
                              onChangeCorreta={(value) =>
                                updateMultiplaQuestaoCorreta(qIndex, value)
                              }
                              onRemoveQuestao={
                                multiplaQuestoes.length > 1
                                  ? () => removeMultiplaQuestao(qIndex)
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Eye size={14} className="text-emerald-700 dark:text-emerald-300" />
                          <span>Pré-visualização</span>
                        </div>
                        <div className="mt-3 space-y-4">
                          {multiplaQuestoes.map((questao, idx) => (
                            <div key={`preview-${idx}`}>
                              <MultipleChoiceQuestion
                                question={`Q${idx + 1}: ${descricao.trim() || "Enunciado do exercício"}`}
                                options={questao.opcoes}
                                selectedAnswer=""
                                onAnswer={() => {}}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScaleIn>
                )}
                {fieldWarnings.multipla && <small className={warningTextClass}>{fieldWarnings.multipla}</small>}
              </>
            )}

            {/* TIPO DE EXERCICIO - Informatica */}
            {categoria === "informatica" && (
              <>
                <div className={fieldGroupClass}>
                  <span className={fieldLabelClass}>Componente Interativo</span>
                  <div className={radioRowClass}>
                    <AnimatedRadioLabel name="compInfoCriar" value="escrita" checked={componenteInterativo === "escrita"} onChange={(e) => setComponenteInterativo(e.target.value)} label="Escrita" icon={<PenLine size={14} />} />
                    <AnimatedRadioLabel name="compInfoCriar" value="multipla" checked={componenteInterativo === "multipla"} onChange={(e) => setComponenteInterativo(e.target.value)} label="Multipla Escolha" icon={<ListChecks size={14} />} />
                  </div>
                </div>

                <ConditionalFieldAnimation isVisible={componenteInterativo === "multipla"}>
                  <div className="mt-4 space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-slate-500/20 dark:bg-slate-500/5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ListChecks size={14} className="text-slate-700 dark:text-slate-300" />
                      <span>Criar questões ({multiplaQuestoes.length})</span>
                    </div>
                    <div className="space-y-3">
                      {multiplaQuestoes.map((questao, qIndex) => (
                        <MultipleChoiceQuestionEditor
                          key={`info-q-${qIndex}`}
                          questionIndex={qIndex}
                          opcoes={questao.opcoes}
                          respostaCorreta={questao.respostaCorreta}
                          onChangeOpcao={(oIndex, value) =>
                            updateMultiplaQuestaoOpcao(qIndex, oIndex, value)
                          }
                          onChangeCorreta={(value) =>
                            updateMultiplaQuestaoCorreta(qIndex, value)
                          }
                          onRemoveQuestao={
                            multiplaQuestoes.length > 1
                              ? () => removeMultiplaQuestao(qIndex)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                    {multiplaQuestoes.length > 0 && descricao.trim() && (
                      <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 p-4 dark:border-sky-500/20 dark:bg-sky-500/5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Eye size={14} className="text-sky-700 dark:text-sky-300" />
                          <span>Preview do aluno</span>
                        </div>
                        <div className="mt-3">
                          <MultipleChoiceQuestion
                            question={`Q1: ${descricao.trim()}`}
                            options={multiplaQuestoes[0].opcoes}
                            selectedAnswer=""
                            onAnswer={() => {}}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </ConditionalFieldAnimation>
              </>
            )}

            {/* CURSO / MODULO / FASE / PRAZO */}
            <div className={rowClass}>
              <div className={cn(fieldGroupClass, "xl:col-span-3")}>
                <span className={fieldLabelClass}>Curso *</span>
                <div className={courseSectionClass}>
                  <div className={courseListColumnClass}>
                    <div className={courseFilterRowClass}>
                      <input
                        className={fieldInputClass}
                        value={cursoCardsFiltro}
                        onChange={(e) => setCursoCardsFiltro(e.target.value)}
                        placeholder="Filtrar cursos por nome ou descrição"
                      />
                      {cursoCardsFiltro.trim() && (
                        <button type="button" className={secondaryButtonClass} onClick={() => setCursoCardsFiltro("")}>
                          Limpar
                        </button>
                      )}
                    </div>

                    <div className={toggleGroupClass(Boolean(fieldWarnings.curso))}>
                      {cursosTogglePaginados.map((curso) => {
                        const cursoCategoria = inferCategoriaFromCourseName(curso.nome);
                        const isAtivo = curso.id === cursoIdSelecionado;
                        return (
                          <label key={curso.id} className={toggleOptionClass(isAtivo)}>
                            <input
                              className="sr-only"
                              type="radio"
                              name="course_id_criar"
                              value={curso.id}
                              checked={isAtivo}
                              onChange={() => handleSelecionarCurso(curso.id)}
                            />
                            <span className={toggleDotClass(isAtivo)} aria-hidden="true">
                              <span className={toggleDotInnerClass(isAtivo)} />
                            </span>
                            <span className={toggleLabelClass}>
                              {iconLabel(cursoCategoria === "informatica" ? <Monitor size={14} /> : <Laptop size={14} />, curso.nome)}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {fieldWarnings.curso && <small className={warningTextClass}>{fieldWarnings.curso}</small>}
                    {cursosToggleFiltrados.length === 0 && (
                      <small className={subtleHintClass}>Nenhum curso encontrado no banco.</small>
                    )}
                    {cursosToggleFiltrados.length > 0 && (
                      <div className={coursePaginationSummaryClass}>
                        <span>
                          Exibindo {Math.min((cursoCardsPagina - 1) * cursoCardsItensPorPagina + 1, cursosToggleFiltrados.length)} a{" "}
                          {Math.min(cursoCardsPagina * cursoCardsItensPorPagina, cursosToggleFiltrados.length)} de {cursosToggleFiltrados.length} cursos
                        </span>
                        <span>
                          Página {cursoCardsPagina} de {cursosCardsTotalPaginas}
                        </span>
                      </div>
                    )}
                    {cursosToggleFiltrados.length > 0 && (
                      <Pagination
                        currentPage={cursoCardsPagina}
                        itemsPerPage={cursoCardsItensPorPagina}
                        totalItems={cursosToggleFiltrados.length}
                        onPageChange={setCursoCardsPagina}
                        onItemsPerPageChange={setCursoCardsItensPorPagina}
                      />
                    )}
                  </div>

                  <div className={courseSidebarClass}>
                    <div className={courseSelectedClass(Boolean(cursoSelecionado))}>
                      <span className={courseSelectedLabelClass}>
                        {iconLabel(<BookOpen size={13} />, cursoSelecionado ? "Curso selecionado" : "Selecao de curso")}
                      </span>
                      <strong className={courseSelectedValueClass}>
                        {cursoSelecionado ? cursoSelecionado.nome : "Selecione um curso para ver detalhes"}
                      </strong>
                    </div>

                    {cursoSelecionado && (
                      <div className={courseQuickStatsClass}>
                        <div className={courseQuickStatCardClass}>
                          <small>Categoria</small>
                          <strong>{inferCategoriaFromCourseName(cursoSelecionado.nome) === "informatica" ? "Informática" : "Programação"}</strong>
                        </div>
                        <div className={courseQuickStatCardClass}>
                          <small>Módulos</small>
                          <strong>{modulosDoCursoSelecionado.length}</strong>
                        </div>
                      </div>
                    )}

                    <div className={courseActionsClass}>
                      <button type="button" className={secondaryButtonClass} onClick={() => setMostrarDetalhesCurso((prev) => !prev)} disabled={!cursoSelecionado}>
                        {iconLabel(<Eye size={14} />, mostrarDetalhesCurso ? "Ocultar detalhes" : "Ver detalhes")}
                      </button>
                    </div>

                    <ConditionalFieldAnimation isVisible={Boolean(cursoSelecionado && mostrarDetalhesCurso)}>
                      <div className={courseDetailsPanelClass}>
                        <div className={courseDetailsGridClass}>
                          <div className={courseDetailItemClass}>
                            <small>Categoria</small>
                            <strong>{inferCategoriaFromCourseName(cursoSelecionado?.nome) === "informatica" ? "Informática" : "Programação"}</strong>
                          </div>
                          <div className={courseDetailItemClass}>
                            <small>Modelo</small>
                            <strong>{cursoSelecionado?.isPaid ? "Pago" : "Gratuito"}</strong>
                          </div>
                          <div className={courseDetailItemClass}>
                            <small>Módulos cadastrados</small>
                            <strong>{modulosDoCursoSelecionado.length}</strong>
                          </div>
                          <div className={courseDetailItemClass}>
                            <small>ID do curso</small>
                            <strong>{cursoSelecionado?.id}</strong>
                          </div>
                        </div>
                        {cursoSelecionado?.descricao && <p className={courseDescriptionClass}>{cursoSelecionado.descricao}</p>}
                        {modulosDoCursoSelecionado.length > 0 && (
                          <div className={courseModulesPreviewClass}>
                            <small>Trilha de modulos</small>
                            <div className={courseModulesChipsClass}>
                              {modulosDoCursoSelecionado.slice(0, 5).map((m) => (
                                <span key={m.id} className={courseModuleChipClass()}>{m.nome}</span>
                              ))}
                              {modulosDoCursoSelecionado.length > 5 && (
                                <span className={courseModuleChipClass(true)}>+{modulosDoCursoSelecionado.length - 5} modulos</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </ConditionalFieldAnimation>
                  </div>
                </div>
              </div>
            </div>

            <div className={rowClass}>
              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Modulo *</span>
                <div className={fieldWarnWrapClass(Boolean(fieldWarnings.modulo))}>
                  <PaginatedSelect
                    value={moduloIdSelecionado}
                    onChange={(value) => {
                      setModuloIdSelecionado(value);
                      const found = modulosDisponiveis.find((m) => m.id === value) ?? null;
                      if (found) setModuloSelecionadoCache(found);
                      setFaseIdSelecionada("");
                      clearFieldWarning("modulo");
                      clearFieldWarning("fase");
                      clearFieldWarning("ordem");
                    }}
                    options={modulosDisponiveis.map((m) => ({ value: m.id, label: m.nome, meta: m.indexOrder ? `Ordem #${m.indexOrder}` : undefined }))}
                    selectedOption={moduloSelecionado ? {
                      value: moduloSelecionado.id,
                      label: moduloSelecionado.nome,
                      meta: moduloSelecionado.indexOrder ? `Ordem #${moduloSelecionado.indexOrder}` : undefined,
                    } : null}
                    placeholder={cursoIdSelecionado ? "Selecione um modulo" : "Selecione um curso primeiro"}
                    disabled={!cursoIdSelecionado}
                    allowPageSizeChange={false}
                    emptyText="Nenhum modulo encontrado"
                    remote={{
                      query: moduloSelectBusca,
                      onQueryChange: setModuloSelectBusca,
                      page: moduloSelectPagina,
                      totalPages: moduloSelectTotalPages,
                      onPageChange: setModuloSelectPagina,
                      loading: moduloSelectCarregando,
                    }}
                  />
                </div>
                {fieldWarnings.modulo && <small className={warningTextClass}>{fieldWarnings.modulo}</small>}
              </div>

              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Fase *</span>
                <div className={fieldWarnWrapClass(Boolean(fieldWarnings.fase))}>
                  <PaginatedSelect
                    value={faseIdSelecionada}
                    onChange={(value) => {
                      setFaseIdSelecionada(value);
                      const found = fasesDisponiveis.find((f) => f.id === value) ?? null;
                      if (found) setFaseSelecionadaCache(found);
                      clearFieldWarning("fase");
                      clearFieldWarning("ordem");
                    }}
                    options={fasesDisponiveis.map((f) => ({ value: f.id, label: f.nome, meta: `Semana ${f.weekNumber}` }))}
                    selectedOption={faseSelecionada ? {
                      value: faseSelecionada.id,
                      label: faseSelecionada.nome,
                      meta: `Semana ${faseSelecionada.weekNumber}`,
                    } : null}
                    placeholder={moduloIdSelecionado ? "Selecione uma fase" : "Selecione um modulo primeiro"}
                    disabled={!moduloIdSelecionado}
                    allowPageSizeChange={false}
                    emptyText="Nenhuma fase encontrada"
                    remote={{
                      query: faseSelectBusca,
                      onQueryChange: setFaseSelectBusca,
                      page: faseSelectPagina,
                      totalPages: faseSelectTotalPages,
                      onPageChange: setFaseSelectPagina,
                      loading: faseSelectCarregando,
                    }}
                  />
                </div>
                {fieldWarnings.fase && <small className={warningTextClass}>{fieldWarnings.fase}</small>}
              </div>

              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Prazo {prazoObrigatorio ? "*" : ""}</span>
                <input
                  className={cn(
                    fieldInputClass,
                    !prazoObrigatorio && "opacity-70",
                    fieldWarnings.prazo && warningControlClass
                  )}
                  type="datetime-local"
                  value={prazo}
                  onChange={(e) => {
                    setPrazo(e.target.value);
                    clearFieldWarning("prazo");
                  }}
                />
                <small className={sectionHintClass}>
                  {prazoObrigatorio
                    ? "Obrigatório enquanto o exercício estiver marcado como tarefa diária."
                    : "Se ficar vazio, a API recebe a data e hora atuais."}
                </small>
                {fieldWarnings.prazo && <small className={warningTextClass}>{fieldWarnings.prazo}</small>}
              </div>
            </div>

            <div className={fieldGroupClass}>
              <ExerciseAIDraftGenerator
                courseId={cursoIdSelecionado}
                moduleId={moduloIdSelecionado}
                phaseId={faseIdSelecionada}
                categoria={categoria}
                componentType={componenteInterativo === "multipla" ? "multipla" : "escrita"}
                difficulty={aiDifficultyValue}
                hasContentToOverwrite={hasAIDraftOverwriteContent}
                onApplyDraft={applyAIDraft}
              />
            </div>

            <div className={compactRowClass}>
              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Dificuldade</span>
                <AnimatedSelect
                  className={fieldInputClass}
                  value={difficulty}
                  onChange={(e) => {
                    const proximaDificuldade = e.target.value;
                    const proximaDificuldadeNum = parseDifficultyValue(proximaDificuldade);
                    if (adicionarEmContainer && proximaDificuldadeNum !== null && CONTAINER_BLOCKED_DIFFICULTIES.has(proximaDificuldadeNum)) {
                      showErrorToast(CONTAINER_BLOCKED_MESSAGE);
                      return;
                    }
                    setDifficulty(proximaDificuldade);
                  }}
                >
                  {opcoesDificuldade.map((opcao) => (
                    <option key={opcao.value || "empty"} value={opcao.value}>
                      {opcao.label}
                    </option>
                  ))}
                </AnimatedSelect>
                {adicionarEmContainer && (
                  <small className={subtleHintClass}>
                    Com container ativo, somente a dificuldade normal pode ser usada.
                  </small>
                )}
              </div>
              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Pontos de resgate</span>
                <input className={fieldInputClass} type="number" min="0" placeholder="0" value={pointsRedeem} onChange={(e) => setPointsRedeem(e.target.value)} />
                <small className={sectionHintClass}>Valor entregue ao aluno quando o exercício for concluído.</small>
              </div>
            </div>

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Container (opcional)</span>
              <div className="flex flex-col gap-2">
                <label
                  className={containerToggleShellClass(
                    !faseIdSelecionada || containersDaFase.length === 0 || carregandoContainersFase
                  )}
                >
                  <AnimatedToggle
                    checked={adicionarEmContainer}
                    onChange={(checked) => {
                      if (checked && dificuldadeBloqueadaParaContainer) {
                        showErrorToast(CONTAINER_BLOCKED_MESSAGE);
                        return;
                      }
                      setAdicionarEmContainer(checked);
                      if (!checked) setContainerSelecionadoKey("");
                    }}
                    disabled={!faseIdSelecionada || containersDaFase.length === 0 || carregandoContainersFase}
                  />
                  <span className={containerToggleTextClass}>Adicionar a um container</span>
                </label>

                {adicionarEmContainer && (
                  <>
                    <AnimatedSelect
                      className={fieldInputClass}
                      value={containerSelecionadoKey}
                      onChange={(e) => {
                        const value = e.target.value;
                        setContainerSelecionadoKey(value);
                        const container = containersDaFase.find((item) => getContainerGroupKey(item) === value) ?? null;
                        if (container && container.isDailyTask !== isDailyTask) {
                          setIsDailyTask(container.isDailyTask);
                        }
                      }}
                    >
                      <option value="" disabled>Selecione o container</option>
                      {containersDaFase.map((container, idx) => {
                        const key = `${container.name}__${container.containerDateTargetInt ?? "null"}__${idx}`;
                        const value = getContainerGroupKey(container);
                        return (
                          <option key={key} value={value}>
                            {container.name}
                            {container.containerDateTargetInt != null ? ` (Dia ${container.containerDateTargetInt})` : ""}
                            {container.isDailyTask ? " • Tarefa Diária" : ""}
                          </option>
                        );
                      })}
                    </AnimatedSelect>

                    {containerSelecionadoKey && (() => {
                      if (!containerSelecionado || containerSelecionado.exercises.length === 0) {
                        return <small className={subtleHintClass}>Nenhum exercício neste container.</small>;
                      }

                      return (
                        <div className={containerSummaryClass}>
                          <div className={containerSummaryHeadClass}>
                            {containerSelecionado.exercises.length} exercício{containerSelecionado.exercises.length !== 1 ? "s" : ""} neste container
                          </div>
                          <div className={containerSummaryListClass}>
                            {containerSelecionado.exercises.map((exercise) => (
                              <div key={exercise.containerTaskId} className={containerSummaryItemClass}>
                                <span className={containerSummaryOrderClass}>#{exercise.indexOrder ?? "?"}</span>
                                <span className={containerSummaryTitleClass}>{exercise.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {!faseIdSelecionada && (
                  <small className={subtleHintClass}>Selecione uma fase para carregar os containers.</small>
                )}
                {faseIdSelecionada && carregandoContainersFase && (
                  <small className={subtleHintClass}>Carregando containers da fase...</small>
                )}
                {faseIdSelecionada && !carregandoContainersFase && containersDaFase.length === 0 && (
                  <small className={subtleHintClass}>Nenhum container encontrado para esta fase.</small>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className={fieldGroupClass}>
                <div
                  className={statusToggleClass(isFinalExercise)}
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsFinalExercise(!isFinalExercise)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsFinalExercise(!isFinalExercise);
                    }
                  }}
                >
                  <AnimatedToggle checked={isFinalExercise} onChange={setIsFinalExercise} />
                  <span className={statusToggleContentClass}>
                    <span className={statusToggleTitleClass}>Exercicio final</span>
                    <span className={statusToggleDescriptionClass}>Marque se este for o exercicio de fechamento da fase.</span>
                  </span>
                </div>
              </div>
              <div className={fieldGroupClass}>
                <div
                  className={statusToggleClass(isDailyTaskEfetivo)}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleChangeIsDailyTask(!isDailyTaskEfetivo)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleChangeIsDailyTask(!isDailyTaskEfetivo);
                    }
                  }}
                >
                  <AnimatedToggle checked={isDailyTaskEfetivo} onChange={handleChangeIsDailyTask} />
                  <span className={statusToggleContentClass}>
                    <span className={statusToggleTitleClass}>Tarefas diárias</span>
                    <span className={statusToggleDescriptionClass}>
                      {isDailyTaskForcadoPorContainer
                        ? "Ligado automaticamente porque o container selecionado e de tarefa diaria."
                        : "Mostra este exercicio na aba de tarefa diaria."}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <AnimatedButton className={cn(submitButtonClass, "flex-1")} onClick={handleSubmit} disabled={disabled} loading={saving}>
                {iconLabel(<Sparkles size={16} />, "Publicar Exercicio")}
              </AnimatedButton>
            </div>

 
          </div>
        </div>
      </FadeInUp>
    </div>
  );
}
