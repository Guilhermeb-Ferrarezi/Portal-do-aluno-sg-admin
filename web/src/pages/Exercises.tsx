import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserId } from "../auth/auth";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import ConfirmModal from "../components/ConfirmModal";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import PaginatedSelect from "../components/PaginatedSelect";
import MultipleChoiceQuestion from "../components/Exercise/MultipleChoiceQuestion";
import MultipleChoiceQuestionEditor from "../components/Exercise/MultipleChoiceQuestionEditor";
import { ScaleIn, AnimatedRadioLabel, AnimatedButton, AnimatedToast, ConditionalFieldAnimation, AnimatedSelect, FadeInUp, AnimatedToggle } from "../components/animate-ui";
import {
  RefreshCcw,
  Loader2,
  Laptop,
  Monitor,
  PenLine,
  ListChecks,
  Trash2,
  Eye,
  Save,
  Sparkles,
  X,
  Lightbulb,
  User as UserIcon,
  Globe,
  Landmark,
  BookOpen,
  Pencil,
  Calendar,
  MessageSquareText,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import {
  criarExercicio,
  atualizarExercicio,
  deletarExercicio,
  listarExercicios,
  listarTarefasDiarias,
  listarCursos,
  listarModulos,
  listarModulosPorCurso,
  listarFasesDoModulo,
  listarTurmas,
  listarAlunos,
  anexarExercicioArquivo,
  removerExercicioArquivo,
  listarAlunosQueResponderamPaginado,
  listarExerciciosRespondidosPorAluno,
  listarAnswersExercicio,
  getRole,
  type AnsweredExerciseByStudent,
  type Exercicio,
  type ExerciseAnswerStudent,
  type Curso,
  type Fase,
  type Modulo,
  type Turma,
  type User,
} from "../services/api";
import { useToastActions } from "../contexts/ToastContext";
import "./Exercises.css";


export default function ExerciciosPage() {
  const { addToast } = useToastActions();
  const navigate = useNavigate();
  const location = useLocation();
  const role = getRole() ?? "aluno";
  const userId = getUserId();
  const isStaff = role === "admin" || role === "professor";
  const canCreate = isStaff;
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );

  type RespostasAlunoOption = {
    id: string;
    nome: string;
    email: string;
    totalRespostas: number;
    totalExercicios: number;
    lastAnsweredAt: string | null;
  };

  type RespostasExercicioOption = {
    id: string;
    titulo: string;
    modulo: string | null;
    tema: string | null;
    totalRespostas: number;
    lastAnsweredAt: string | null;
  };

  type RespostaDiretaOption = {
    answerId: number;
    questionId: number;
    answeredAt: string | null;
    isCorrect: boolean | null;
  };

  type CategoriaExercicio = "programacao" | "informatica";
  type RequiredFieldKey = "titulo" | "descricao" | "curso" | "modulo" | "fase" | "prazo" | "multipla" | "ordem";
  type InfoOverlayKey = "dificuldade" | "ordem";
  type ExerciseListViewItem = {
    ex: Exercicio;
    alunoIds: string[];
    hasAlunoAssignment: boolean;
    turmaIds: string[];
    publishedAtMs: number | null;
    prazoMs: number | null;
  };
  type ExercisesVirtualWindow = {
    visibleItems: ExerciseListViewItem[];
    topSpacerHeight: number;
    bottomSpacerHeight: number;
  };

  function normalizeListPayload<T>(payload: T[] | { items?: T[] } | null | undefined): T[] {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray((payload as { items?: T[] }).items)) {
      return (payload as { items: T[] }).items;
    }
    return [];
  }

  function inferCategoriaFromCourseName(courseName: string | null | undefined): CategoriaExercicio {
    const normalized = (courseName ?? "").toLowerCase();
    if (normalized.includes("inform") || normalized.includes("excel") || normalized.includes("office")) {
      return "informatica";
    }
    return "programacao";
  }

  function getTipoInfo(ex: Exercicio): { label: string; className: string } {
    switch (ex.tipoExercicio) {
      case "codigo":
        return { label: "Codigo", className: "isCodigo" };
      case "escrita":
        return { label: "Escrita", className: "isEscrita" };
      case "mouse":
        return { label: "Mouse", className: "isMouse" };
      case "multipla":
        return { label: "Multipla", className: "isMultipla" };
      case "atalho":
        return { label: "Atalho", className: "isAtalho" };
      default:
        return { label: "Exercicio", className: "isDefault" };
    }
  }

  const [items, setItems] = React.useState<Exercicio[]>([]);
  const [dailyItems, setDailyItems] = React.useState<Exercicio[]>([]);
  const [dailyLoaded, setDailyLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [fieldWarnings, setFieldWarnings] = React.useState<Partial<Record<RequiredFieldKey, string>>>({});
  const [infoOverlay, setInfoOverlay] = React.useState<InfoOverlayKey | null>(null);

  // form
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [gabarito, setGabarito] = React.useState("");
  const [cursosDisponiveis, setCursosDisponiveis] = React.useState<Curso[]>([]);
  const [cursoIdSelecionado, setCursoIdSelecionado] = React.useState("");
  const [todosModulosDisponiveis, setTodosModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [modulosDisponiveis, setModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [fasesDisponiveis, setFasesDisponiveis] = React.useState<Fase[]>([]);
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");
  const [faseIdSelecionada, setFaseIdSelecionada] = React.useState("");
  const [prazo, setPrazo] = React.useState(""); // datetime-local
  const [videoUrl, setVideoUrl] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("");
  const [indexOrder, setIndexOrder] = React.useState("");
  const [pointsRedeem, setPointsRedeem] = React.useState("");
  const [exercisePeriod, setExercisePeriod] = React.useState(""); // datetime-local
  const [isFinalExercise, setIsFinalExercise] = React.useState(false);
  const [isDailyTask, setIsDailyTask] = React.useState(false);
  const [categoria, setCategoria] = React.useState<CategoriaExercicio>("programacao");
  const [componenteInterativo, setComponenteInterativo] = React.useState("escrita"); // temporario: apenas escrita e multipla
  // Regras para Multipla Escolha
  const [multiplaQuestoes, setMultiplaQuestoes] = React.useState<Array<{
    pergunta: string;
    opcoes: Array<{ letter: string; text: string }>;
    respostaCorreta: string;
  }>>(() => getDefaultMultiplaQuestoes());
  const [anexosAtivo, setAnexosAtivo] = React.useState(false);
  const [anexoArquivo, setAnexoArquivo] = React.useState<File | null>(null);
  const [anexoAtual, setAnexoAtual] = React.useState<{ url: string; nome: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<"criar" | "lista" | "tarefa-diaria" | "respostas">(() => {
    return "lista";
  });
  const [respostasAlunoId, setRespostasAlunoId] = React.useState("");
  const [respostasAlunoAbertoId, setRespostasAlunoAbertoId] = React.useState<string | null>(null);
  const [respostasAlunos, setRespostasAlunos] = React.useState<RespostasAlunoOption[]>([]);
  const [loadingRespostasAlunos, setLoadingRespostasAlunos] = React.useState(false);
  const [respostasAlunoFiltro, setRespostasAlunoFiltro] = React.useState("");
  const [respostasAlunoPage, setRespostasAlunoPage] = React.useState(1);
  const [respostasAlunoLimit, setRespostasAlunoLimit] = React.useState(10);
  const [respostasAlunoPagination, setRespostasAlunoPagination] = React.useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [respostasExerciciosAluno, setRespostasExerciciosAluno] = React.useState<RespostasExercicioOption[]>([]);
  const [loadingRespostasExercicios, setLoadingRespostasExercicios] = React.useState(false);
  const [respostasExercicioFiltro, setRespostasExercicioFiltro] = React.useState("");
  const [respostasExercicioPage, setRespostasExercicioPage] = React.useState(1);
  const [respostasExercicioLimit, setRespostasExercicioLimit] = React.useState(6);
  const [respostasExercicioPagination, setRespostasExercicioPagination] = React.useState({
    page: 1,
    limit: 6,
    total: 0,
    totalPages: 1,
  });
  const [respostasDiretasPorExercicio, setRespostasDiretasPorExercicio] = React.useState<Record<string, RespostaDiretaOption[]>>({});
  const [loadingRespostasDiretas, setLoadingRespostasDiretas] = React.useState<Record<string, boolean>>({});
  const [seletorRespostaDireta, setSeletorRespostaDireta] = React.useState<Record<string, string>>({});
  const [respostaExercicioAbertoKey, setRespostaExercicioAbertoKey] = React.useState<string | null>(null);
  const [cursoCardsFiltro, setCursoCardsFiltro] = React.useState("");
  const [cursoCardsPagina, setCursoCardsPagina] = React.useState(1);
  const [cursoCardsItensPorPagina, setCursoCardsItensPorPagina] = React.useState(5);
  const [mostrarDetalhesCurso, setMostrarDetalhesCurso] = React.useState(false);

  // Filtros
  const [moduloFiltro, setModuloFiltro] = React.useState("");
  const [buscaFiltro, setBuscaFiltro] = React.useState("");

  // Turmas
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [turmaFiltro, setTurmaFiltro] = React.useState("todas");
  const [statusFiltro, setStatusFiltro] = React.useState<"todos" | "publicado" | "programado" | "rascunho">("todos");
  const [totalItemsLista, setTotalItemsLista] = React.useState(0);
  const [totalItemsTarefaDiaria, setTotalItemsTarefaDiaria] = React.useState(0);

  // Alunos
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);

  // Paginacao
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);
  const deferredBuscaFiltro = React.useDeferredValue(buscaFiltro);
  const buscaFiltroQuery = deferredBuscaFiltro.trim();
  const exercisesListVirtualHostRef = React.useRef<HTMLDivElement | null>(null);
  const exercisesListGridRef = React.useRef<HTMLDivElement | null>(null);
  const [virtualScrollY, setVirtualScrollY] = React.useState(
    typeof window !== "undefined" ? window.scrollY : 0
  );
  const [virtualViewportHeight, setVirtualViewportHeight] = React.useState(
    typeof window !== "undefined" ? window.innerHeight : 0
  );
  const [virtualContainerTop, setVirtualContainerTop] = React.useState(0);
  const [virtualColumns, setVirtualColumns] = React.useState(1);
  const [virtualGap, setVirtualGap] = React.useState(20);
  const [virtualRowHeight, setVirtualRowHeight] = React.useState(340);
  const createDepsLoadedRef = React.useRef(false);
  const createDepsLoadingRef = React.useRef(false);
  const turmasLoadedRef = React.useRef(false);
  const turmasLoadingRef = React.useRef(false);
  const alunosLookupLoadedRef = React.useRef(false);
  const alunosLookupLoadingRef = React.useRef(false);

  const alunoNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    alunosDisponiveis.forEach((aluno) => {
      map.set(aluno.id, aluno.nome || aluno.usuario || aluno.id);
    });
    return map;
  }, [alunosDisponiveis]);

  const moduloSelecionado = React.useMemo(
    () =>
      modulosDisponiveis.find((m) => m.id === moduloIdSelecionado) ??
      todosModulosDisponiveis.find((m) => m.id === moduloIdSelecionado) ??
      null,
    [modulosDisponiveis, todosModulosDisponiveis, moduloIdSelecionado]
  );

  const faseSelecionada = React.useMemo(
    () => fasesDisponiveis.find((f) => f.id === faseIdSelecionada) ?? null,
    [fasesDisponiveis, faseIdSelecionada]
  );

  const cursoSelecionado = React.useMemo(
    () => cursosDisponiveis.find((curso) => curso.id === cursoIdSelecionado) ?? null,
    [cursosDisponiveis, cursoIdSelecionado]
  );

  const modulosDoCursoSelecionado = React.useMemo(
    () => todosModulosDisponiveis.filter((modulo) => modulo.courseId === cursoIdSelecionado),
    [todosModulosDisponiveis, cursoIdSelecionado]
  );

  const cursosToggleOrdenados = React.useMemo(() => {
    // Apenas cursos gratuitos (isPaid !== true) e que estão vinculados a turmas do tipo "turma"
    const cursosGratuitos = cursosDisponiveis.filter((curso) => curso.isPaid !== true);

    if (turmasDisponiveis.length === 0) {
      return cursosGratuitos;
    }

    const cursoIdsPorTurma = new Set(
      turmasDisponiveis
        .filter((turma) => turma.tipo === "turma" && turma.courseId)
        .map((turma) => turma.courseId as string)
    );

    // Se nenhuma turma tiver courseId, mantemos apenas o filtro por gratuidade
    if (cursoIdsPorTurma.size === 0) {
      return cursosGratuitos;
    }

    return cursosGratuitos.filter((curso) => cursoIdsPorTurma.has(curso.id));
  }, [cursosDisponiveis, turmasDisponiveis]);
  const cursosToggleFiltrados = React.useMemo(() => {
    const termo = cursoCardsFiltro.trim().toLowerCase();
    if (!termo) return cursosToggleOrdenados;
    return cursosToggleOrdenados.filter((curso) => {
      const nome = curso.nome?.toLowerCase() ?? "";
      const descricao = curso.descricao?.toLowerCase() ?? "";
      return nome.includes(termo) || descricao.includes(termo);
    });
  }, [cursosToggleOrdenados, cursoCardsFiltro]);
  const cursosCardsTotalPaginas = Math.max(1, Math.ceil(cursosToggleFiltrados.length / cursoCardsItensPorPagina));
  const cursosTogglePaginados = React.useMemo(() => {
    const inicio = (cursoCardsPagina - 1) * cursoCardsItensPorPagina;
    return cursosToggleFiltrados.slice(inicio, inicio + cursoCardsItensPorPagina);
  }, [cursosToggleFiltrados, cursoCardsPagina, cursoCardsItensPorPagina]);

  function handleSelecionarCurso(courseId: string) {
    clearFieldWarning("curso");
    clearFieldWarning("modulo");
    clearFieldWarning("fase");
    clearFieldWarning("ordem");
    const trocouCurso = courseId !== cursoIdSelecionado;
    if (trocouCurso) {
      setModuloIdSelecionado("");
      setModulosDisponiveis([]);
      setFaseIdSelecionada("");
      setFasesDisponiveis([]);
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
  }

  function clearFieldWarning(field: RequiredFieldKey) {
    setFieldWarnings((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

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
    if (!prazo) {
      warnings.prazo = "Prazo obrigatorio.";
    }
    if (
      componenteInterativo === "multipla" &&
      multiplaQuestoes.some((q) => !q.respostaCorreta || q.opcoes.some((o) => !o.text))
    ) {
      warnings.multipla = "Complete todas as opcoes e a resposta correta.";
    }

    return warnings;
  }

  function toDatetimeLocal(value: string | null | undefined) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function getDefaultMultiplaQuestoes() {
    return [{
      pergunta: "",
      opcoes: [
        { letter: "A", text: "" },
        { letter: "B", text: "" },
        { letter: "C", text: "" },
        { letter: "D", text: "" }
      ],
      respostaCorreta: ""
    }];
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

  function buildMultiplaQuestoesPayload(
    questoes: Array<{ pergunta: string; opcoes: Array<{ letter: string; text: string }>; respostaCorreta: string }>,
    perguntaBase: string
  ) {
    const fallbackPergunta = perguntaBase.trim();
    return questoes.map((questao, index) => ({
      ...questao,
      pergunta: fallbackPergunta || `Questão ${index + 1}`,
    }));
  }

  function resetExerciseFormState(params?: { clearAttachments?: boolean }) {
    setFieldWarnings({});
    setTitulo("");
    setDescricao("");
    setGabarito("");
    setCursoIdSelecionado("");
    setModuloIdSelecionado("");
    setFaseIdSelecionada("");
    setMostrarDetalhesCurso(false);
    setPrazo("");
    setVideoUrl("");
    setDifficulty("");
    setIndexOrder("");
    setPointsRedeem("");
    setExercisePeriod("");
    setIsFinalExercise(false);
    setIsDailyTask(false);
    setCategoria("programacao");
    setComponenteInterativo("escrita");
    setMultiplaQuestoes(getDefaultMultiplaQuestoes());

    if (params?.clearAttachments) {
      setAnexosAtivo(false);
      setAnexoArquivo(null);
      setAnexoAtual(null);
    }
  }

  function getAlunoIds(exercicio: Exercicio): string[] {
    const alunos = Array.isArray((exercicio as any).alunos)
      ? (exercicio as any).alunos.map((a: any) => a?.id).filter(Boolean)
      : [];
    const idsSnake = Array.isArray((exercicio as any).aluno_ids)
      ? (exercicio as any).aluno_ids
      : [];
    const idsCamel = Array.isArray((exercicio as any).alunoIds)
      ? (exercicio as any).alunoIds
      : [];
    return Array.from(new Set([...alunos, ...idsSnake, ...idsCamel]));
  }

  function getAlunoNames(exercicio: Exercicio): string[] {
    const alunos = Array.isArray((exercicio as any).alunos)
      ? (exercicio as any).alunos
        .map((a: any) => a?.nome || a?.usuario || a?.id)
        .filter(Boolean)
      : [];
    if (alunos.length > 0) return alunos as string[];

    const ids = getAlunoIds(exercicio);
    return ids
      .map((id) => alunoNameById.get(id))
      .filter((nome): nome is string => !!nome);
  }

  function formatAlunoLabel(names: string[]) {
    if (names.length === 0) return "Aluno especifico";
    if (names.length === 1) return `Para: ${names[0]}`;
    if (names.length === 2) return `Para: ${names.join(", ")}`;
    return `Para: ${names[0]} +${names.length - 1}`;
  }

  async function ensureCreateDependenciesLoaded(force = false) {
    if (!canCreate || createDepsLoadingRef.current) return;
    if (createDepsLoadedRef.current && !force) return;
    createDepsLoadingRef.current = true;
    try {
      const [cursosResult, modulosResult] = await Promise.allSettled([
        listarCursos(),
        listarModulos(),
      ]);

      let cursosCarregados = false;

      if (cursosResult.status === "fulfilled") {
        const cursos = normalizeListPayload<Curso>(
          cursosResult.value as Curso[] | { items?: Curso[] }
        );
        setCursosDisponiveis(cursos);
        cursosCarregados = true;
      } else {
        console.error("Erro ao carregar cursos:", cursosResult.reason);
      }

      if (modulosResult.status === "fulfilled") {
        const modulos = normalizeListPayload<Modulo>(
          modulosResult.value as Modulo[] | { items?: Modulo[] }
        );
        setTodosModulosDisponiveis(modulos);
      } else {
        console.error("Erro ao carregar modulos:", modulosResult.reason);
      }

      createDepsLoadedRef.current = cursosCarregados;
      if (!cursosCarregados) {
        setErro("Nao foi possivel carregar cursos para criar exercicio.");
      }
    } catch (e) {
      console.error("Erro ao carregar dependencias de criacao:", e);
    } finally {
      createDepsLoadingRef.current = false;
    }
  }

  async function ensureTurmasLoaded() {
    if (!canCreate || turmasLoadedRef.current || turmasLoadingRef.current) return;
    turmasLoadingRef.current = true;
    try {
      const turmas = await listarTurmas();
      setTurmasDisponiveis(turmas);
      turmasLoadedRef.current = true;
    } catch (e) {
      console.error("Erro ao carregar turmas:", e);
    } finally {
      turmasLoadingRef.current = false;
    }
  }

  async function ensureAlunosLookupLoaded(exercicios: Exercicio[]) {
    if (!canCreate || alunosLookupLoadedRef.current || alunosLookupLoadingRef.current) return;
    if (alunosDisponiveis.length > 0) {
      alunosLookupLoadedRef.current = true;
      return;
    }

    const needsLookup = exercicios.some((exercicio) => {
      const alunosPayload = Array.isArray((exercicio as any).alunos) ? (exercicio as any).alunos : [];
      const hasInlineName = alunosPayload.some(
        (aluno: any) =>
          (typeof aluno?.nome === "string" && aluno.nome.trim().length > 0) ||
          (typeof aluno?.usuario === "string" && aluno.usuario.trim().length > 0)
      );
      const hasIds = getAlunoIds(exercicio).length > 0;
      return hasIds && !hasInlineName;
    });

    if (!needsLookup) return;

    alunosLookupLoadingRef.current = true;
    try {
      const alunos = await listarAlunos();
      setAlunosDisponiveis(alunos);
      alunosLookupLoadedRef.current = true;
    } catch (e) {
      console.error("Erro ao carregar alunos:", e);
    } finally {
      alunosLookupLoadingRef.current = false;
    }
  }

  function getRespostasDiretasKey(alunoId: string, exercicioId: string) {
    return `${alunoId}:${exercicioId}`;
  }

  function getRespostaDiretaValue(resposta: RespostaDiretaOption) {
    return `${resposta.answerId}:${resposta.questionId}`;
  }

  function getRespostaDiretaLabel(resposta: RespostaDiretaOption) {
    return `Resposta #${resposta.answerId} - Pergunta ${resposta.questionId} - ${resposta.answeredAt ? new Date(resposta.answeredAt).toLocaleDateString("pt-BR") : "Sem data"}`;
  }

  function navegarParaRespostaDireta(exercicioId: string, alunoId: string, value: string) {
    if (!value) return;
    const [answerIdRaw, questionIdRaw] = value.split(":");
    const answerId = Number(answerIdRaw);
    const questionId = Number(questionIdRaw);
    navigate(`/dashboard/exercicios/${exercicioId}`, {
      state: {
        from: location.pathname,
        fromSection: "respostas",
        prefilterAlunoId: alunoId,
        prefilterAnswerId: Number.isFinite(answerId) ? answerId : null,
        prefilterQuestionId: Number.isFinite(questionId) ? questionId : null,
      },
    });
  }


  // Modal de confirmacao
  const [modalDeletar, setModalDeletar] = React.useState<{
    isOpen: boolean;
    exercicioId: string | null;
    exercicioTitulo: string | null;
  }>({ isOpen: false, exercicioId: null, exercicioTitulo: null });

  // Modal de opções de editar (Editar Exercício / Realocar Exercício)
  const [modalEditOpcoes, setModalEditOpcoes] = React.useState<{
    isOpen: boolean;
    exercicio: Exercicio | null;
  }>({ isOpen: false, exercicio: null });

  // Modal de editar atributos (sem mudar turma/curso/módulo/fase)
  const [modalEditarAtributos, setModalEditarAtributos] = React.useState<{
    isOpen: boolean;
    exercicio: Exercicio | null;
  }>({ isOpen: false, exercicio: null });
  const [editAttrTitulo, setEditAttrTitulo] = React.useState("");
  const [editAttrDescricao, setEditAttrDescricao] = React.useState("");
  const [editAttrPrazo, setEditAttrPrazo] = React.useState("");
  const [editAttrVideoUrl, setEditAttrVideoUrl] = React.useState("");
  const [editAttrDifficulty, setEditAttrDifficulty] = React.useState("");
  const [editAttrIndexOrder, setEditAttrIndexOrder] = React.useState("");
  const [editAttrPointsRedeem, setEditAttrPointsRedeem] = React.useState("");
  const [editAttrExercisePeriod, setEditAttrExercisePeriod] = React.useState("");
  const [editAttrIsFinalExercise, setEditAttrIsFinalExercise] = React.useState(false);
  const [editAttrIsDailyTask, setEditAttrIsDailyTask] = React.useState(false);
  const [editAttrComponenteInterativo, setEditAttrComponenteInterativo] = React.useState("escrita");
  const [editAttrMultiplaQuestoes, setEditAttrMultiplaQuestoes] = React.useState<Array<{
    pergunta: string;
    opcoes: Array<{ letter: string; text: string }>;
    respostaCorreta: string;
  }>>(() => getDefaultMultiplaQuestoes());
  const [editAttrSaving, setEditAttrSaving] = React.useState(false);
  const [editAttrErro, setEditAttrErro] = React.useState<string | null>(null);

  // Modal de realocar exercício
  const [modalRealocar, setModalRealocar] = React.useState<{
    isOpen: boolean;
    exercicio: Exercicio | null;
  }>({ isOpen: false, exercicio: null });
  const [realocCursoId, setRealocCursoId] = React.useState("");
  const [realocModuloId, setRealocModuloId] = React.useState("");
  const [realocFaseId, setRealocFaseId] = React.useState("");
  const [realocCursos, setRealocCursos] = React.useState<Curso[]>([]);
  const [realocModulos, setRealocModulos] = React.useState<Modulo[]>([]);
  const [realocFases, setRealocFases] = React.useState<Fase[]>([]);
  const [realocSaving, setRealocSaving] = React.useState(false);

  async function load() {
    try {
      setLoading(true);
      setErro(null);

      const response = await listarExercicios({
        q: buscaFiltroQuery || undefined,
        modulo: moduloFiltro || undefined,
        turmaId: turmaFiltro !== "todas" ? turmaFiltro : undefined,
        status: isStaff ? statusFiltro : undefined,
        page: currentPage,
        limit: itemsPerPage,
      });

      const normalized = response.items.filter((ex) => ex.isDailyTask !== true);
      setItems(normalized);
      setTotalItemsLista(response.total);
      if (currentPage > response.pagination.totalPages) {
        setCurrentPage(response.pagination.totalPages);
      }
      void ensureAlunosLookupLoaded(normalized);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar Exercicios");
    } finally {
      setLoading(false);
    }
  }

  async function loadDailyTasks() {
    try {
      setLoading(true);
      setErro(null);

      const response = await listarTarefasDiarias({
        q: buscaFiltroQuery || undefined,
        modulo: moduloFiltro || undefined,
        turmaId: turmaFiltro !== "todas" ? turmaFiltro : undefined,
        status: isStaff ? statusFiltro : undefined,
        page: currentPage,
        limit: itemsPerPage,
      });

      const normalized = response.items.filter((ex) => ex.isDailyTask !== false);
      setDailyItems(normalized);
      setTotalItemsTarefaDiaria(response.total);
      if (currentPage > response.pagination.totalPages) {
        setCurrentPage(response.pagination.totalPages);
      }
      setDailyLoaded(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar tarefas diarias");
    } finally {
      setLoading(false);
    }
  }

  function mapAnswerStudentsToOptions(alunos: ExerciseAnswerStudent[]): RespostasAlunoOption[] {
    return alunos.map((aluno) => ({
      id: String(aluno.alunoId),
      nome: aluno.alunoNome,
      email: aluno.alunoEmail ?? "",
      totalRespostas: aluno.totalAnswers ?? 0,
      totalExercicios: aluno.totalExercicios ?? 0,
      lastAnsweredAt: aluno.lastAnsweredAt ?? null,
    }));
  }

  function mapAnsweredExercisesToOptions(exercicios: AnsweredExerciseByStudent[]): RespostasExercicioOption[] {
    return exercicios.map((exercicio) => ({
      id: String(exercicio.exercicioId),
      titulo: exercicio.exercicioTitulo,
      modulo: exercicio.exercicioModulo ?? null,
      tema: exercicio.exercicioTema ?? null,
      totalRespostas: exercicio.totalAnswers ?? 0,
      lastAnsweredAt: exercicio.lastAnsweredAt ?? null,
    }));
  }

  async function loadRespostasAlunos() {
    try {
      setLoadingRespostasAlunos(true);
      const response = await listarAlunosQueResponderamPaginado({
        q: respostasAlunoFiltro || undefined,
        page: respostasAlunoPage,
        limit: respostasAlunoLimit,
      });
      const options = mapAnswerStudentsToOptions(response.alunos);
      setRespostasAlunos(options);
      setRespostasAlunoPagination(response.pagination);
      setRespostasAlunoId((prev) => {
        if (!prev) return "";
        if (options.some((o) => o.id === prev)) return prev;
        return "";
      });
    } catch (e) {
      setRespostasAlunos([]);
      setRespostasAlunoId("");
      setRespostasAlunoAbertoId(null);
      setRespostasExerciciosAluno([]);
      setRespostasAlunoPagination({
        page: respostasAlunoPage,
        limit: respostasAlunoLimit,
        total: 0,
        totalPages: 1,
      });
      setErro(e instanceof Error ? e.message : "Erro ao carregar alunos que responderam");
    } finally {
      setLoadingRespostasAlunos(false);
    }
  }

  async function loadExerciciosRespondidosDoAluno(alunoId: string) {
    if (!alunoId) {
      setRespostasExerciciosAluno([]);
      setRespostasDiretasPorExercicio({});
      setLoadingRespostasDiretas({});
      setSeletorRespostaDireta({});
      setRespostaExercicioAbertoKey(null);
      return;
    }

    try {
      setLoadingRespostasExercicios(true);
      const response = await listarExerciciosRespondidosPorAluno(alunoId, {
        q: respostasExercicioFiltro || undefined,
        page: respostasExercicioPage,
        limit: respostasExercicioLimit,
      });
      const options = mapAnsweredExercisesToOptions(response.exercicios);
      setRespostasExerciciosAluno(options);
      setRespostasExercicioPagination(response.pagination);
      setRespostasDiretasPorExercicio({});
      setLoadingRespostasDiretas({});
      setSeletorRespostaDireta({});
      setRespostaExercicioAbertoKey(null);

      for (const exercicio of options) {
        const key = getRespostasDiretasKey(alunoId, exercicio.id);
        setLoadingRespostasDiretas((prev) => ({ ...prev, [key]: true }));
        void listarAnswersExercicio(exercicio.id, {
          alunoId: Number(alunoId),
          page: 1,
          limit: 200,
          sort: "recent",
        })
          .then((resposta) => {
            const alunoComRespostas = resposta.alunos.find((a) => String(a.alunoId) === String(alunoId));
            const respostas = (alunoComRespostas?.answers ?? []).map((answer) => ({
              answerId: answer.id,
              questionId: answer.questionId,
              answeredAt: answer.answeredAt ?? null,
              isCorrect: answer.isCorrect ?? null,
            }));
            setRespostasDiretasPorExercicio((prev) => ({
              ...prev,
              [key]: respostas,
            }));
          })
          .catch(() => {
            setRespostasDiretasPorExercicio((prev) => ({
              ...prev,
              [key]: [],
            }));
          })
          .finally(() => {
            setLoadingRespostasDiretas((prev) => ({ ...prev, [key]: false }));
          });
      }
    } catch (e) {
      setRespostasExerciciosAluno([]);
      setRespostasDiretasPorExercicio({});
      setLoadingRespostasDiretas({});
      setSeletorRespostaDireta({});
      setRespostaExercicioAbertoKey(null);
      setRespostasExercicioPagination({
        page: respostasExercicioPage,
        limit: respostasExercicioLimit,
        total: 0,
        totalPages: 1,
      });
      setErro(e instanceof Error ? e.message : "Erro ao carregar Exercicios respondidos do aluno");
    } finally {
      setLoadingRespostasExercicios(false);
    }
  }

  function toggleRespostasAluno(alunoId: string) {
    if (respostasAlunoAbertoId === alunoId) {
      setRespostasAlunoAbertoId(null);
      setRespostasAlunoId("");
      setRespostasExerciciosAluno([]);
      setRespostasDiretasPorExercicio({});
      setLoadingRespostasDiretas({});
      setSeletorRespostaDireta({});
      setRespostaExercicioAbertoKey(null);
      return;
    }
    setRespostasAlunoAbertoId(alunoId);
    setRespostasAlunoId(alunoId);
    setRespostasExercicioFiltro("");
    setRespostasExercicioPage(1);
  }

  React.useEffect(() => {
    if (canCreate) {
      void ensureTurmasLoaded();
    }
  }, [canCreate]);

  React.useEffect(() => {
    if (activeSection === "tarefa-diaria") {
      void loadDailyTasks();
      return;
    }
    void load();
  }, [activeSection, currentPage, itemsPerPage, buscaFiltroQuery, moduloFiltro, turmaFiltro, statusFiltro, isStaff]);

  React.useEffect(() => {
    if (!canCreate || !editandoId) return;
    void ensureCreateDependenciesLoaded();
  }, [editandoId, canCreate]);

  React.useEffect(() => {
    if (!cursoIdSelecionado) {
      setModulosDisponiveis([]);
      setModuloIdSelecionado("");
      setFasesDisponiveis([]);
      setFaseIdSelecionada("");
      return;
    }

    listarModulosPorCurso(cursoIdSelecionado)
      .then((response) => {
        const modulos = normalizeListPayload<Modulo>(
          response as Modulo[] | { items?: Modulo[] }
        );
        setModulosDisponiveis(modulos);
        setModuloIdSelecionado((prev) =>
          prev && modulos.some((modulo) => modulo.id === prev) ? prev : ""
        );
        if (modulos.length > 0) {
          setTodosModulosDisponiveis((prev) => {
            const map = new Map<string, Modulo>();
            prev.forEach((modulo) => map.set(modulo.id, modulo));
            modulos.forEach((modulo) => map.set(modulo.id, modulo));
            return Array.from(map.values());
          });
        }
      })
      .catch((e) => {
        console.error("Erro ao carregar modulos do curso:", e);
        const fallback = todosModulosDisponiveis.filter((m) => m.courseId === cursoIdSelecionado);
        setModulosDisponiveis(fallback);
        setModuloIdSelecionado((prev) =>
          prev && fallback.some((modulo) => modulo.id === prev) ? prev : ""
        );
      });
  }, [cursoIdSelecionado]);

  React.useEffect(() => {
    if (!cursoSelecionado) return;
    const categoriaInferida = inferCategoriaFromCourseName(cursoSelecionado.nome);
    if (categoriaInferida !== categoria) {
      setCategoria(categoriaInferida);
      setComponenteInterativo("escrita");
    }
  }, [cursoSelecionado, categoria]);

  React.useEffect(() => {
    setCursoCardsPagina(1);
  }, [cursoCardsFiltro]);

  React.useEffect(() => {
    if (cursoCardsPagina > cursosCardsTotalPaginas) {
      setCursoCardsPagina(cursosCardsTotalPaginas);
    }
  }, [cursoCardsPagina, cursosCardsTotalPaginas]);

  React.useEffect(() => {
    if (!moduloIdSelecionado) {
      setFasesDisponiveis([]);
      setFaseIdSelecionada("");
      return;
    }

    listarFasesDoModulo(moduloIdSelecionado)
      .then((response) => {
        const fases = normalizeListPayload<Fase>(
          response as Fase[] | { items?: Fase[] }
        );
        setFasesDisponiveis(fases);
        setFaseIdSelecionada((prev) =>
          prev && fases.some((fase) => fase.id === prev) ? prev : ""
        );
      })
      .catch((e) => {
        console.error("Erro ao carregar fases do modulo:", e);
        setFasesDisponiveis([]);
        setFaseIdSelecionada("");
      });
  }, [moduloIdSelecionado]);

  React.useEffect(() => {
    const state = location.state as { restoreSection?: "criar" | "lista" | "tarefa-diaria" | "respostas" } | null;
    const restoreSection = state?.restoreSection;
    if (!restoreSection) return;

    setActiveSection(restoreSection);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeSection]);

  React.useEffect(() => {
    if (!isStaff || activeSection !== "respostas") return;
    void loadRespostasAlunos();
  }, [activeSection, isStaff, respostasAlunoFiltro, respostasAlunoPage, respostasAlunoLimit]);

  React.useEffect(() => {
    if (!isStaff || activeSection !== "respostas") return;
    void loadExerciciosRespondidosDoAluno(respostasAlunoId);
  }, [activeSection, isStaff, respostasAlunoId, respostasExercicioFiltro, respostasExercicioPage, respostasExercicioLimit]);

  async function handleSubmit() {
    try {
      setSaving(true);
      setErro(null);
      setOkMsg(null);

      const gabaritoLimpo = gabarito.trim();

      const descricaoFinal = descricao.trim();
      const tituloFinal = titulo.trim();

      const tipoSelecionado: "escrita" | "multipla" =
        componenteInterativo === "multipla" ? "multipla" : "escrita";

      const dificuldadeNum = parseDifficultyValue(difficulty);
      const ordemNum = indexOrder.trim() ? Number(indexOrder) : null;
      const pontosNum = pointsRedeem.trim() ? Number(pointsRedeem) : null;
      const videoUrlLimpa = videoUrl.trim();
      const courseIdNum = Number(cursoIdSelecionado);
      const phaseIdNum = Number(faseIdSelecionada);

      if (indexOrder.trim() && (!Number.isInteger(ordemNum) || Number(ordemNum) < 1)) {
        setErro("Ordem deve ser um numero inteiro maior ou igual a 1.");
        setSaving(false);
        return;
      }
      if (pointsRedeem.trim() && (!Number.isInteger(pontosNum) || Number(pontosNum) < 0)) {
        setErro("Pontos deve ser um numero inteiro maior ou igual a 0.");
        setSaving(false);
        return;
      }
      if (videoUrlLimpa) {
        try {
          void new URL(videoUrlLimpa);
        } catch {
          setErro("Video URL invalida.");
          setSaving(false);
          return;
        }
      }
      if (difficulty.trim() && dificuldadeNum === null) {
        setErro("Selecione uma dificuldade valida.");
        setSaving(false);
        return;
      }

      const moduloNome = moduloSelecionado?.nome?.trim() ?? "";
      const faseNome = faseSelecionada?.nome?.trim() ?? null;

      const requiredWarnings = collectRequiredFieldWarnings({
        tituloFinal,
        descricaoFinal,
        moduloNome,
        phaseIdNum,
        courseIdNum,
      });

      if (Object.keys(requiredWarnings).length > 0) {
        setFieldWarnings(requiredWarnings);
        setErro("Preencha os campos obrigatorios em destaque.");
        setSaving(false);
        return;
      }
      setFieldWarnings({});

      const dados: any = {
        titulo: tituloFinal,
        descricao: descricaoFinal,
        phase_id: phaseIdNum,
        course_id: courseIdNum,
        modulo: moduloNome,
        tema: faseNome,
        prazo: prazo ? new Date(prazo).toISOString() : null,
        video_url: videoUrlLimpa || null,
        difficulty: dificuldadeNum,
        index_order: ordemNum,
        is_final_exercise: isFinalExercise,
        is_daily_task: isDailyTask,
        points_redeem: pontosNum,
        exercise_period: exercisePeriod ? new Date(exercisePeriod).toISOString() : null,
        publicado: true,
        published_at: null,
        categoria: categoria,
        ...(gabaritoLimpo && categoria === "programacao" ? { gabarito: gabaritoLimpo } : {}),
        ...(tipoSelecionado ? { tipoExercicio: tipoSelecionado } : {}),
        ...(componenteInterativo === "multipla" ? {
          multipla_regras: JSON.stringify({ Questoes: buildMultiplaQuestoesPayload(multiplaQuestoes, descricaoFinal) })
        } : {}),
        permitir_repeticao: false,
        max_tentativas: null,
        penalidade_por_tentativa: 0,
        intervalo_reenvio: null,
      };

      let exercicioId = editandoId;
      if (editandoId) {
        // Atualizar Exercicio existente
        await atualizarExercicio(editandoId, dados);
        setOkMsg("Exercicio atualizado!");
        setEditandoId(null);
      } else {
        // Criar novo Exercicio
        const created = await criarExercicio(dados);
        exercicioId = (created as any)?.exercicio?.id ?? null;
        addToast("Exercicio criado!", "success", 3000);
      }

      if (exercicioId) {
        if (anexosAtivo && anexoArquivo) {
          const result = await anexarExercicioArquivo(exercicioId, anexoArquivo);
          if (result.anexoUrl) {
            setAnexoAtual({ url: result.anexoUrl, nome: result.anexoNome || "Anexo" });
          }
        } else if (!anexosAtivo && anexoAtual?.url) {
          await removerExercicioArquivo(exercicioId);
          setAnexoAtual(null);
        }
      }

      resetExerciseFormState({ clearAttachments: true });

      await load();
      if (dailyLoaded) {
        await loadDailyTasks();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao salvar Exercicio";
      if (message.toLowerCase().includes("index disponivel") || message.toLowerCase().includes("menor ordem")) {
        setFieldWarnings((prev) => ({
          ...prev,
          ordem: message,
        }));
      }
      if (message.toLowerCase().includes("dados invalid")) {
        const warnings = collectRequiredFieldWarnings({
          tituloFinal: titulo.trim(),
          descricaoFinal: descricao.trim(),
          moduloNome: moduloSelecionado?.nome?.trim() ?? "",
          phaseIdNum: Number(faseIdSelecionada),
          courseIdNum: Number(cursoIdSelecionado),
        });
        if (Object.keys(warnings).length > 0) {
          setFieldWarnings(warnings);
        }
      }
      setErro(message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setActiveSection("lista");
    resetExerciseFormState();
    setEditandoId(null);
    setOkMsg(null);
  }

  function abrirModalDeletar(id: string, titulo: string) {
    setModalDeletar({ isOpen: true, exercicioId: id, exercicioTitulo: titulo });
  }

  function fecharModalDeletar() {
    setModalDeletar({ isOpen: false, exercicioId: null, exercicioTitulo: null });
  }

  async function confirmarDeletar() {
    if (!modalDeletar.exercicioId) return;

    try {
      setSaving(true);
      setErro(null);
      setOkMsg(null);

      await deletarExercicio(modalDeletar.exercicioId);
      setOkMsg("Exercicio deletado com sucesso!");

      fecharModalDeletar();
      await load();
      if (dailyLoaded) {
        await loadDailyTasks();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao deletar Exercicio");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    // Funao mantida para compatibilidade, mas agora abre o modal
    const exercicio = sourceItems.find((ex) => ex.id === id);
    abrirModalDeletar(id, exercicio?.titulo || "Exercicio");
  }

  function abrirModalEditOpcoes(exercicio: Exercicio) {
    setModalEditOpcoes({ isOpen: true, exercicio });
  }

  function fecharModalEditOpcoes() {
    setModalEditOpcoes({ isOpen: false, exercicio: null });
  }

  function handleEscolherEditar() {
    if (!modalEditOpcoes.exercicio) return;
    const ex = modalEditOpcoes.exercicio;
    fecharModalEditOpcoes();
    abrirModalEditarAtributos(ex);
  }

  function abrirModalEditarAtributos(exercicio: Exercicio) {
    setEditAttrTitulo(exercicio.titulo);
    setEditAttrDescricao(exercicio.descricao);
    setEditAttrPrazo(toDatetimeLocal(exercicio.prazo));
    setEditAttrVideoUrl(exercicio.videoUrl ?? "");
    setEditAttrDifficulty(exercicio.difficulty !== null && exercicio.difficulty !== undefined ? String(exercicio.difficulty) : "");
    setEditAttrIndexOrder(exercicio.indexOrder !== null && exercicio.indexOrder !== undefined ? String(exercicio.indexOrder) : "");
    setEditAttrPointsRedeem(exercicio.pointsRedeem !== null && exercicio.pointsRedeem !== undefined ? String(exercicio.pointsRedeem) : "");
    setEditAttrExercisePeriod(toDatetimeLocal(exercicio.exercisePeriod));
    setEditAttrIsFinalExercise(exercicio.isFinalExercise === true);
    setEditAttrIsDailyTask(exercicio.isDailyTask === true);

    if (exercicio.multipla_regras) {
      setEditAttrComponenteInterativo("multipla");
      try {
        const regras = JSON.parse(exercicio.multipla_regras);
        const questoes = Array.isArray(regras?.Questoes) ? regras.Questoes : [];
        setEditAttrMultiplaQuestoes(questoes.length > 0 ? questoes : getDefaultMultiplaQuestoes());
      } catch {
        setEditAttrComponenteInterativo("escrita");
        setEditAttrMultiplaQuestoes(getDefaultMultiplaQuestoes());
      }
    } else {
      setEditAttrComponenteInterativo("escrita");
      setEditAttrMultiplaQuestoes(getDefaultMultiplaQuestoes());
    }

    setEditAttrErro(null);
    setEditAttrSaving(false);
    setModalEditarAtributos({ isOpen: true, exercicio });
  }

  function fecharModalEditarAtributos() {
    setModalEditarAtributos({ isOpen: false, exercicio: null });
    setEditAttrErro(null);
  }

  async function confirmarEditarAtributos() {
    const ex = modalEditarAtributos.exercicio;
    if (!ex) return;

    const tituloFinal = editAttrTitulo.trim();
    const descricaoFinal = editAttrDescricao.trim();
    if (tituloFinal.length < 2) {
      setEditAttrErro("Título deve ter pelo menos 2 caracteres.");
      return;
    }
    if (descricaoFinal.length < 2) {
      setEditAttrErro("Descrição deve ter pelo menos 2 caracteres.");
      return;
    }

    const ordemNum = editAttrIndexOrder.trim() ? Number(editAttrIndexOrder) : null;
    if (editAttrIndexOrder.trim() && (!Number.isInteger(ordemNum) || Number(ordemNum) < 1)) {
      setEditAttrErro("Ordem deve ser um número inteiro maior ou igual a 1.");
      return;
    }
    const pontosNum = editAttrPointsRedeem.trim() ? Number(editAttrPointsRedeem) : null;
    if (editAttrPointsRedeem.trim() && (!Number.isInteger(pontosNum) || Number(pontosNum) < 0)) {
      setEditAttrErro("Pontos deve ser um número inteiro maior ou igual a 0.");
      return;
    }
    if (editAttrVideoUrl.trim()) {
      try { new URL(editAttrVideoUrl.trim()); } catch {
        setEditAttrErro("URL do vídeo inválida.");
        return;
      }
    }

    const tipoSelecionado: "escrita" | "multipla" =
      editAttrComponenteInterativo === "multipla" ? "multipla" : "escrita";
    const difficultyValue = parseDifficultyValue(editAttrDifficulty);

    if (editAttrDifficulty.trim() && difficultyValue === null) {
      setEditAttrErro("Selecione uma dificuldade valida.");
      return;
    }

    try {
      setEditAttrSaving(true);
      setEditAttrErro(null);

      await atualizarExercicio(ex.id, {
        titulo: tituloFinal,
        descricao: descricaoFinal,
        phase_id: Number(ex.phaseId),
        modulo: ex.modulo,
        tema: ex.tema ?? null,
        prazo: editAttrPrazo ? new Date(editAttrPrazo).toISOString() : null,
        video_url: editAttrVideoUrl.trim() || null,
        difficulty: difficultyValue,
        index_order: ordemNum,
        is_final_exercise: editAttrIsFinalExercise,
        is_daily_task: editAttrIsDailyTask,
        points_redeem: pontosNum,
        exercise_period: editAttrExercisePeriod ? new Date(editAttrExercisePeriod).toISOString() : null,
        publicado: true,
        published_at: null,
        categoria: ex.categoria ?? "programacao",
        tipoExercicio: tipoSelecionado,
        ...(editAttrComponenteInterativo === "multipla" ? {
          multipla_regras: JSON.stringify({ Questoes: buildMultiplaQuestoesPayload(editAttrMultiplaQuestoes, descricaoFinal) })
        } : {}),
      });

      setOkMsg("Exercício atualizado com sucesso!");
      fecharModalEditarAtributos();
      await load();
      if (dailyLoaded) await loadDailyTasks();
    } catch (e) {
      setEditAttrErro(e instanceof Error ? e.message : "Erro ao atualizar exercício");
    } finally {
      setEditAttrSaving(false);
    }
  }

  async function handleEscolherRealocar() {
    if (!modalEditOpcoes.exercicio) return;
    const ex = modalEditOpcoes.exercicio;
    fecharModalEditOpcoes();
    setModalRealocar({ isOpen: true, exercicio: ex });

    // Load courses for reallocation
    try {
      const cursosResult = await listarCursos();
      const cursos = normalizeListPayload<Curso>(cursosResult as Curso[] | { items?: Curso[] });
      setRealocCursos(cursos);

      // Pre-select current course/module/phase
      const origemModulos = todosModulosDisponiveis.length > 0 ? todosModulosDisponiveis : modulosDisponiveis;
      const moduloNormalizado = (ex.modulo || "").trim().toLowerCase();
      const moduloEncontrado = origemModulos.find((m) => m.nome.trim().toLowerCase() === moduloNormalizado);
      const cursoAtual = moduloEncontrado?.courseId ?? "";
      setRealocCursoId(cursoAtual);
      if (cursoAtual) {
        const modsResult = await listarModulosPorCurso(cursoAtual);
        const mods = normalizeListPayload<Modulo>(modsResult as Modulo[] | { items?: Modulo[] });
        setRealocModulos(mods);
        setRealocModuloId(moduloEncontrado?.id ?? "");
        if (moduloEncontrado?.id) {
          const fasesResult = await listarFasesDoModulo(moduloEncontrado.id);
          const fases = normalizeListPayload<Fase>(fasesResult as Fase[] | { items?: Fase[] });
          setRealocFases(fases);
          setRealocFaseId(ex.phaseId ? String(ex.phaseId) : "");
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados para realocação");
    }
  }

  function fecharModalRealocar() {
    setModalRealocar({ isOpen: false, exercicio: null });
    setRealocCursoId("");
    setRealocModuloId("");
    setRealocFaseId("");
    setRealocCursos([]);
    setRealocModulos([]);
    setRealocFases([]);
  }

  async function handleRealocCursoChange(newCursoId: string) {
    setRealocCursoId(newCursoId);
    setRealocModuloId("");
    setRealocFaseId("");
    setRealocFases([]);
    if (!newCursoId) {
      setRealocModulos([]);
      return;
    }
    try {
      const modsResult = await listarModulosPorCurso(newCursoId);
      const mods = normalizeListPayload<Modulo>(modsResult as Modulo[] | { items?: Modulo[] });
      setRealocModulos(mods);
    } catch {
      setRealocModulos([]);
    }
  }

  async function handleRealocModuloChange(newModuloId: string) {
    setRealocModuloId(newModuloId);
    setRealocFaseId("");
    if (!newModuloId) {
      setRealocFases([]);
      return;
    }
    try {
      const fasesResult = await listarFasesDoModulo(newModuloId);
      const fases = normalizeListPayload<Fase>(fasesResult as Fase[] | { items?: Fase[] });
      setRealocFases(fases);
    } catch {
      setRealocFases([]);
    }
  }

  async function confirmarRealocar() {
    if (!modalRealocar.exercicio || !realocFaseId) return;
    const ex = modalRealocar.exercicio;
    try {
      setRealocSaving(true);
      if (!ex.prazo) {
        throw new Error("Este exercício não possui prazo definido. Edite o exercício e defina um prazo antes de realocar.");
      }

      const moduloSel = realocModulos.find((m) => m.id === realocModuloId);
      const faseSel = realocFases.find((f) => f.id === realocFaseId);
      const courseIdNum = Number(realocCursoId);
      if (!Number.isFinite(courseIdNum) || courseIdNum <= 0) {
        throw new Error("Selecione um curso válido para realocar o exercício.");
      }

      await atualizarExercicio(ex.id, {
        titulo: ex.titulo,
        descricao: ex.descricao,
        phase_id: Number(realocFaseId),
        course_id: courseIdNum,
        modulo: moduloSel?.nome ?? ex.modulo,
        tema: faseSel?.nome ?? ex.tema ?? null,
        prazo: ex.prazo,
        video_url: ex.videoUrl ?? null,
        difficulty: (ex.difficulty as any) ?? null,
        index_order: ex.indexOrder ?? null,
        is_final_exercise: ex.isFinalExercise ?? false,
        is_daily_task: ex.isDailyTask ?? false,
        points_redeem: ex.pointsRedeem ?? null,
        exercise_period: ex.exercisePeriod ?? null,
        categoria: ex.categoria ?? "programacao",
        tipoExercicio: ex.tipoExercicio ?? "escrita",
        multipla_regras: ex.multipla_regras ?? null,
        mouse_regras: ex.mouse_regras ?? null,
        max_tentativas: ex.maxTentativas ?? null,
        penalidade_por_tentativa: ex.penalidadePorTentativa ?? null,
        intervalo_reenvio: ex.intervaloReenvio ?? null,
      });
      setOkMsg("Exercício realocado com sucesso!");
      fecharModalRealocar();
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao realocar exercício");
    } finally {
      setRealocSaving(false);
    }
  }

  // Validacao especial para componentes interativos
  const isInteractiveComponentInformatica = categoria === "informatica" && componenteInterativo !== "";
  const disabled =
    saving ||
    !cursoIdSelecionado ||
    !moduloIdSelecionado ||
    !faseIdSelecionada ||
    (!isInteractiveComponentInformatica && titulo.trim().length < 2) ||
    (!isInteractiveComponentInformatica && descricao.trim().length < 2) ||
    (componenteInterativo === "multipla" && multiplaQuestoes.some(q => !q.respostaCorreta || q.opcoes.some(o => !o.text)));

  const sourceItems = activeSection === "tarefa-diaria" ? dailyItems : items;
  const totalItemsSection = activeSection === "tarefa-diaria" ? totalItemsTarefaDiaria : totalItemsLista;
  const prazoDateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const sourceItemsView = React.useMemo<ExerciseListViewItem[]>(() => {
    return sourceItems.map((ex) => {
      const alunoIds = getAlunoIds(ex);
      const publishedAtTs =
        typeof ex.publishedAt === "string" ? Date.parse(ex.publishedAt) : Number.NaN;
      const prazoTs = typeof ex.prazo === "string" ? Date.parse(ex.prazo) : Number.NaN;

      return {
        ex,
        alunoIds,
        hasAlunoAssignment: alunoIds.length > 0,
        turmaIds: Array.isArray(ex.turmas) ? ex.turmas.map((turma) => turma.id) : [],
        publishedAtMs: Number.isFinite(publishedAtTs) ? publishedAtTs : null,
        prazoMs: Number.isFinite(prazoTs) ? prazoTs : null,
      };
    });
  }, [sourceItems]);

  const moduloFilterOptions = React.useMemo(
    () => Array.from(new Set(sourceItems.map((ex) => ex.modulo))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [sourceItems]
  );

  const filteredExercises = React.useMemo<ExerciseListViewItem[]>(() => {
    return sourceItemsView.filter((item) => {
      const { alunoIds, hasAlunoAssignment } = item;
      if (!isStaff && hasAlunoAssignment && (!userId || !alunoIds.includes(userId))) {
        return false;
      }
      return true;
    });
  }, [sourceItemsView, isStaff, userId]);

  const paginatedExercises = filteredExercises;
  const renderNowMs = Date.now();
  const shouldVirtualizeExercises =
    (activeSection === "lista" || activeSection === "tarefa-diaria") &&
    paginatedExercises.length > 18;

  const updateExercisesVirtualMetrics = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const hostNode = exercisesListVirtualHostRef.current;
    const gridNode = exercisesListGridRef.current;
    if (!hostNode || !gridNode) return;

    const hostRect = hostNode.getBoundingClientRect();
    const hostTop = hostRect.top + window.scrollY;
    const styles = window.getComputedStyle(gridNode);
    const rowGapRaw = styles.rowGap || styles.gap || "20";
    const parsedRowGap = Number.parseFloat(rowGapRaw);
    const nextGap = Number.isFinite(parsedRowGap) ? parsedRowGap : 20;
    const gridColumnsRaw = styles.gridTemplateColumns || "";
    const nextColumns = Math.max(1, gridColumnsRaw.split(" ").filter(Boolean).length);

    setVirtualContainerTop((prev) => (Math.abs(prev - hostTop) > 0.5 ? hostTop : prev));
    setVirtualGap((prev) => (Math.abs(prev - nextGap) > 0.5 ? nextGap : prev));
    setVirtualColumns((prev) => (prev !== nextColumns ? nextColumns : prev));
  }, []);

  const measureExerciseCardRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const nextHeight = node.getBoundingClientRect().height + virtualGap;
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
      setVirtualRowHeight((prev) => (Math.abs(prev - nextHeight) > 2 ? nextHeight : prev));
    },
    [virtualGap]
  );

  React.useEffect(() => {
    if (!shouldVirtualizeExercises || typeof window === "undefined") return;

    let rafId = 0;
    const syncVirtualScrollY = (nextScrollY: number) => {
      setVirtualScrollY((prev) => (Math.abs(prev - nextScrollY) > 2 ? nextScrollY : prev));
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncVirtualScrollY(window.scrollY);
      });
    };
    const onResize = () => {
      setVirtualViewportHeight((prev) => (prev !== window.innerHeight ? window.innerHeight : prev));
      syncVirtualScrollY(window.scrollY);
      updateExercisesVirtualMetrics();
    };

    setVirtualViewportHeight((prev) => (prev !== window.innerHeight ? window.innerHeight : prev));
    syncVirtualScrollY(window.scrollY);
    updateExercisesVirtualMetrics();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    const hostNode = exercisesListVirtualHostRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && hostNode
        ? new ResizeObserver(() => updateExercisesVirtualMetrics())
        : null;

    if (hostNode && resizeObserver) {
      resizeObserver.observe(hostNode);
    }

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [shouldVirtualizeExercises, updateExercisesVirtualMetrics]);

  const exercisesVirtualWindow = React.useMemo<ExercisesVirtualWindow | null>(() => {
    if (!shouldVirtualizeExercises) return null;
    const safeColumns = Math.max(1, virtualColumns);
    const safeRowHeight = Math.max(260, virtualRowHeight);
    const totalRows = Math.max(1, Math.ceil(paginatedExercises.length / safeColumns));
    const totalHeight = totalRows * safeRowHeight;
    const viewportStart = Math.max(0, virtualScrollY - virtualContainerTop);
    const viewportEnd = viewportStart + virtualViewportHeight;
    const overscanPx = safeRowHeight * 2;
    const startRow = Math.max(0, Math.floor((viewportStart - overscanPx) / safeRowHeight));
    const endRow = Math.min(totalRows - 1, Math.ceil((viewportEnd + overscanPx) / safeRowHeight));
    const startIndex = startRow * safeColumns;
    const endIndexExclusive = Math.min(
      paginatedExercises.length,
      (endRow + 1) * safeColumns
    );
    const visibleItems = paginatedExercises.slice(startIndex, endIndexExclusive);
    const visibleRows = Math.max(1, Math.ceil(visibleItems.length / safeColumns));
    const topSpacerHeight = startRow * safeRowHeight;
    const renderedHeight = visibleRows * safeRowHeight;
    const bottomSpacerHeight = Math.max(0, totalHeight - topSpacerHeight - renderedHeight);

    return {
      visibleItems,
      topSpacerHeight,
      bottomSpacerHeight,
    };
  }, [
    shouldVirtualizeExercises,
    virtualColumns,
    virtualRowHeight,
    paginatedExercises,
    virtualScrollY,
    virtualContainerTop,
    virtualViewportHeight,
  ]);

  const visibleExercises = exercisesVirtualWindow?.visibleItems ?? paginatedExercises;

  function handleRefresh() {
    if (editandoId) {
      void ensureCreateDependenciesLoaded(true);
      return;
    }
    if (activeSection === "respostas") {
      void load();
      void loadRespostasAlunos();
      if (respostasAlunoId) {
        void loadExerciciosRespondidosDoAluno(respostasAlunoId);
      }
      return;
    }
    if (activeSection === "tarefa-diaria") {
      void loadDailyTasks();
      return;
    }
    void load();
  }

  return (
    <DashboardLayout title="Exercicios" subtitle="Veja e pratique os exercicios disponiveis">
      <div className="exercisesContainer">
        {/* HEADER COM BOTAO */}
        <div className="exercisesHeader">
          <div className="headerActions" />
          <button className="refreshBtn" onClick={handleRefresh} disabled={loading}>
            {loading
              ? iconLabel(<Loader2 size={16} />, "Carregando...")
              : iconLabel(<RefreshCcw size={16} />, "Atualizar")}
          </button>
        </div>

        <div className="exercisesTabs">
          <span className="exercisesTabsLabel">{iconLabel(<Eye size={14} />, "Exibir:")}</span>
          <div className="exercisesTabsGroup">
            <button
              type="button"
              className={`exercisesTab ${activeSection === "lista" ? "active" : ""}`}
              onClick={() => setActiveSection("lista")}
            >
              {iconLabel(<ListChecks size={14} />, "Exercicios")}
            </button>
            <button
              type="button"
              className={`exercisesTab ${activeSection === "tarefa-diaria" ? "active" : ""}`}
              onClick={() => setActiveSection("tarefa-diaria")}
            >
              {iconLabel(<Calendar size={14} />, "Tarefa diaria")}
            </button>
            {isStaff && (
              <button
                type="button"
                className={`exercisesTab ${activeSection === "respostas" ? "active" : ""}`}
                onClick={() => setActiveSection("respostas")}
              >
                {iconLabel(<MessageSquareText size={14} />, "Respostas")}
              </button>
            )}
          </div>
        </div>

        {/* MENSAGENS */}
        <AnimatedToast
          message={erro}
          type="error"
          duration={4000}
          onClose={() => setErro(null)}
        />

        <AnimatedToast
          message={okMsg}
          type="success"
          duration={3000}
          onClose={() => setOkMsg(null)}
        />



        {/* SECAO DE EDITAR */}
        {canCreate && editandoId && (
          <FadeInUp duration={0.28}>
            <div className="createExerciseCard">
              <h2 className="exFormTitle">Editar exercicio</h2>

              <div className="exFormGrid">
                <div className="exInputGroup">
                  <span className="exLabel">Nome do exercício *</span>
                  <input
                    className={`exInput ${fieldWarnings.titulo ? "isWarning" : ""}`}
                    placeholder="ex: Exercicio 15.3: Layout Responsivo"
                    value={titulo}
                    onChange={(e) => {
                      setTitulo(e.target.value);
                      clearFieldWarning("titulo");
                    }}
                  />
                  {fieldWarnings.titulo && <small className="exFieldWarning">{fieldWarnings.titulo}</small>}
                </div>

                <div className="exInputGroup">
                  <span className="exLabel">Pergunta *</span>
                  <textarea
                    className={`exTextarea ${fieldWarnings.descricao ? "isWarning" : ""}`}
                    placeholder="Descreva a pergunta do exercício em detalhes..."
                    value={descricao}
                    onChange={(e) => {
                      setDescricao(e.target.value);
                      clearFieldWarning("descricao");
                    }}
                  />
                  {fieldWarnings.descricao && <small className="exFieldWarning">{fieldWarnings.descricao}</small>}
                </div>

                {/* Temporariamente desativado: anexos */}
                {/* CATEGORIA - PROGRAMACAO vs INFORMATICA */}
                <div className="exInputRow">
                  <div className="exInputGroup">
                    <div className="exCoursesFilterRow">
                      <input
                        className="exInput"
                        value={cursoCardsFiltro}
                        onChange={(e) => setCursoCardsFiltro(e.target.value)}
                        placeholder="Filtrar cursos por nome ou descrição"
                      />
                      {cursoCardsFiltro.trim() && (
                        <button
                          type="button"
                          className="exCoursesFilterClearBtn"
                          onClick={() => setCursoCardsFiltro("")}
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                    <div className={`exToggleGroup ${fieldWarnings.curso ? "isWarning" : ""}`}>
                      {cursosTogglePaginados.map((curso) => {
                        const cursoCategoria = inferCategoriaFromCourseName(curso.nome);
                        const isAtivo = curso.id === cursoIdSelecionado;
                        return (
                          <label key={curso.id} className={`exToggleOption ${isAtivo ? "active" : ""}`}>
                            <input
                              className="exToggleInput"
                              type="radio"
                              name="course_id"
                              value={curso.id}
                              checked={isAtivo}
                              onChange={() => handleSelecionarCurso(curso.id)}
                            />
                            <span className="exToggleDot" aria-hidden="true" />
                            <span className="exToggleLabel">
                              {iconLabel(cursoCategoria === "informatica" ? <Monitor size={14} /> : <Laptop size={14} />, curso.nome)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {fieldWarnings.curso && <small className="exFieldWarning">{fieldWarnings.curso}</small>}
                    <div className="exCourseCardsActions">
                      <div className={`exCourseCardsSelected ${cursoSelecionado ? "" : "isEmpty"}`}>
                        <span className="exCourseCardsSelectedLabel">
                          {iconLabel(<BookOpen size={13} />, cursoSelecionado ? "Curso selecionado" : "Selecao de curso")}
                        </span>
                        <strong className="exCourseCardsSelectedValue">
                          {cursoSelecionado ? cursoSelecionado.nome : "Selecione um curso para ver detalhes"}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="exCourseDetailsBtn"
                        onClick={() => setMostrarDetalhesCurso((prev) => !prev)}
                        disabled={!cursoSelecionado}
                      >
                        {iconLabel(<Eye size={14} />, mostrarDetalhesCurso ? "Ocultar detalhes" : "Ver detalhes")}
                      </button>
                    </div>
                    {cursosToggleFiltrados.length === 0 && (
                      <small style={{ color: "#94a3b8", marginTop: "6px" }}>
                        Nenhum curso encontrado no banco.
                      </small>
                    )}
                    <Pagination
                      currentPage={cursoCardsPagina}
                      itemsPerPage={cursoCardsItensPorPagina}
                      totalItems={cursosToggleFiltrados.length}
                      onPageChange={setCursoCardsPagina}
                      onItemsPerPageChange={setCursoCardsItensPorPagina}
                    />
                    <ConditionalFieldAnimation isVisible={Boolean(cursoSelecionado && mostrarDetalhesCurso)}>
                      <div className="exCourseDetailsPanel">
                        <div className="exCourseDetailsGrid">
                          <div className="exCourseDetailItem">
                            <small>Categoria</small>
                            <strong>
                              {inferCategoriaFromCourseName(cursoSelecionado?.nome) === "informatica" ? "Informática" : "Programação"}
                            </strong>
                          </div>
                          <div className="exCourseDetailItem">
                            <small>Modelo</small>
                            <strong>{cursoSelecionado?.isPaid ? "Pago" : "Gratuito"}</strong>
                          </div>
                          <div className="exCourseDetailItem">
                            <small>Módulos cadastrados</small>
                            <strong>{modulosDoCursoSelecionado.length}</strong>
                          </div>
                          <div className="exCourseDetailItem">
                            <small>ID do curso</small>
                            <strong>{cursoSelecionado?.id}</strong>
                          </div>
                        </div>
                        {cursoSelecionado?.descricao && (
                          <p className="exCourseDescription">{cursoSelecionado.descricao}</p>
                        )}
                        {modulosDoCursoSelecionado.length > 0 && (
                          <div className="exCourseModulesPreview">
                            <small>Trilha de modulos</small>
                            <div className="exCourseModulesChips">
                              {modulosDoCursoSelecionado.slice(0, 5).map((modulo) => (
                                <span key={modulo.id} className="exCourseModuleChip">
                                  {modulo.nome}
                                </span>
                              ))}
                              {modulosDoCursoSelecionado.length > 5 && (
                                <span className="exCourseModuleChip isMore">
                                  +{modulosDoCursoSelecionado.length - 5} modulos
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </ConditionalFieldAnimation>
                  </div>
                </div>

                {/* COMPONENTES INTERATIVOS - Para Programacao */}
                {categoria === "programacao" && (
                  <>
                    <div className="exInputGroup">
                      <span className="exLabel">Tipo de Exercicio</span>
                      <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                        <AnimatedRadioLabel
                          name="tipoExercicio"
                          value="escrita"
                          checked={componenteInterativo === "escrita"}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="Escrita"
                          icon={<PenLine size={14} />} 
                        />
                        <AnimatedRadioLabel
                          name="tipoExercicio"
                          value="multipla"
                          checked={componenteInterativo === "multipla"}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="Multipla Escolha"
                          icon={<ListChecks size={14} />} 
                        />
                      </div>
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                        Selecione o tipo de exercicio para Programacao
                      </small>
                    </div>

                    {/* EXERCICIO DE ESCRITA - Para Programacao */}
                    {/* Temporariamente desativado: Resposta/Gabarito conforme correções.md
                    {componenteInterativo === "escrita" && (
                      <ScaleIn>
                        <div className="exInputGroup">
                          <span className="exLabel">Resposta/Gabarito Esperado</span>
                          <textarea
                            className="exInput"
                            value={gabarito}
                            onChange={(e) => setGabarito(e.target.value)}
                            placeholder="Digite o gabarito ou resposta esperada para o exercicio de escrita..."
                            style={{ minHeight: "200px", fontFamily: "inherit", resize: "vertical" }}
                          />
                          <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                            Este texto sera usado como referencia para avaliar a resposta do aluno.
                          </small>
                        </div>
                      </ScaleIn>
                    )}
                    */}

                    {/* QUESTOES DE MULTIPLA ESCOLHA - Para Programacao */}
                    {componenteInterativo === "multipla" && (
                      <ScaleIn>
                        <>
                          <div style={{ background: "var(--background-secondary)", border: "1px solid #fcd34d", borderRadius: "8px", padding: "14px", marginTop: "12px" }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", margin: "0 0 12px 0" }}>
                              {iconLabel(<ListChecks size={14} />, "Configurar Questoes de Multipla Escolha:")}
                            </p>

                            {multiplaQuestoes.map((questao, qIndex) => (
                              <div key={`prog-q-${questao.pergunta}-${questao.respostaCorreta}-${questao.opcoes.map((o) => o.text).join("|")}`} style={{ background: "var(--card)", padding: "12px", borderRadius: "6px", marginBottom: "12px", border: "1px solid #fde68a" }}>
                                <h4 style={{ margin: "0 0 8px 0", fontSize: 13 }}>Questao {qIndex + 1}</h4>

                                <div style={{ marginBottom: "8px" }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Opcoes:</span>
                                  {questao.opcoes.map((opcao, oIndex) => (
                                    <input
                                      key={`prog-op-${questao.pergunta}-${opcao.letter}-${opcao.text}`}
                                      className="exInput"
                                      type="text"
                                      value={opcao.text}
                                      onChange={(e) => {
                                        const naovas = [...multiplaQuestoes];
                                        naovas[qIndex].opcoes[oIndex].text = e.target.value;
                                        setMultiplaQuestoes(naovas);
                                      }}
                                      placeholder={`Opcao ${opcao.letter}`}
                                      style={{ marginBottom: "6px" }}
                                    />
                                  ))}
                                </div>

                                <div style={{ marginBottom: "8px" }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Resposta Correta:</span>
                                  <AnimatedSelect
                                    className="exSelect"
                                    value={questao.respostaCorreta}
                                    onChange={(e) => {
                                      const naovas = [...multiplaQuestoes];
                                      naovas[qIndex].respostaCorreta = e.target.value;
                                      setMultiplaQuestoes(naovas);
                                    }}
                                  >
                                    <option value="">-- Selecione --</option>
                                    {questao.opcoes.map((opcao) => (
                                      <option key={opcao.letter} value={opcao.letter}>
                                        {opcao.letter}: {opcao.text}
                                      </option>
                                    ))}
                                  </AnimatedSelect>
                                </div>

                                {multiplaQuestoes.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMultiplaQuestoes(multiplaQuestoes.filter((_, i) => i !== qIndex));
                                    }}
                                    style={{
                                      padding: "6px 12px",
                                      background: "#fee2e2",
                                      color: "#991b1b",
                                      border: "naone",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      fontSize: 12,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {iconLabel(<Trash2 size={14} />, "Remover Questao")}
                                  </button>
                                )}
                              </div>
                            ))}

                            {/* Temporariamente desativado: adicionar outra questao */}
                          </div>

                          <div style={{ background: "var(--background-secondary)", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px", marginTop: "12px" }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: "0 0 12px 0" }}>
                              {iconLabel(<Eye size={14} />, "Pre-visualizacao:")}
                            </p>
                            {multiplaQuestoes.map((questao, idx) => (
                              <div
                                key={`${questao.pergunta}-${questao.respostaCorreta}-${questao.opcoes.map((o) => o.text).join("|")}`}
                                style={{ marginBottom: "16px" }}
                              >
                                <MultipleChoiceQuestion
                                  question={`Q${idx + 1}: ${descricao.trim() || "Enunciado do exercício"}`}
                                  options={questao.opcoes}
                                  selectedAnswer=""
                                  onAnswer={() => { }}
                                />
                              </div>
                            ))}
                          </div>
                        </>
                      </ScaleIn>
                    )}
                    {fieldWarnings.multipla && <small className="exFieldWarning">{fieldWarnings.multipla}</small>}
                  </>
                )}

                {/* COMPONENTES INTERATIVOS - Apenas para Informatica */}
                {categoria === "informatica" && (
                  <>
                    <div className="exInputGroup">
                      <span className="exLabel">Componente Interativo</span>
                      <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                        <AnimatedRadioLabel
                          name="componenteInterativoInformatica"
                          value="escrita"
                          checked={componenteInterativo === "escrita"}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="Escrita"
                          icon={<PenLine size={14} />} 
                        />
                        <AnimatedRadioLabel
                          name="componenteInterativoInformatica"
                          value="multipla"
                          checked={componenteInterativo === "multipla"}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="Multipla Escolha"
                          icon={<ListChecks size={14} />} 
                        />
                      </div>
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                        Selecione o tipo de componente para Informatica
                      </small>
                    </div>

                    {/* EXERCICIO DE ESCRITA - Para Informatica */}
                    {/* Temporariamente desativado: Resposta/Gabarito conforme correções.md
                    {componenteInterativo === "escrita" && (
                      <ScaleIn>
                        <div className="exInputGroup">
                          <span className="exLabel">Resposta/Gabarito Esperado</span>
                          <textarea
                            className="exInput"
                            value={gabarito}
                            onChange={(e) => setGabarito(e.target.value)}
                            placeholder="Digite o gabarito ou resposta esperada para o Exercicio de escrita..."
                            style={{ minHeight: "200px", fontFamily: "inherit", resize: "vertical" }}
                          />
                          <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                            Este texto sera usado como referencia para avaliar a resposta do aluno.
                          </small>
                        </div>
                      </ScaleIn>
                    )}
                    */}

                    {/* FORMULARIO DINAMICO PARA MULTIPLA ESCOLHA */}
                    <ConditionalFieldAnimation isVisible={componenteInterativo === "multipla"}>
                      <div style={{
                        background: "#f9fafb",
                        border: "2px dashed #e5e7eb",
                        borderRadius: "12px",
                        padding: "20px",
                        marginTop: "16px",
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginTop: 0, marginBottom: "16px" }}>
                          {iconLabel(<ListChecks size={14} />, "Criar Questoes")} ({multiplaQuestoes.length})
                        </p>

                        {/* Loop atraves de cada Questao */}
                        {multiplaQuestoes.map((questao, qIndex) => (
                          <div key={`info-q-${questao.pergunta}-${questao.respostaCorreta}-${questao.opcoes.map((o) => o.text).join("|")}`} style={{
                            background: "var(--card)",
                            border: "1px solid var(--line)",
                            borderRadius: "8px",
                            padding: "16px",
                            marginBottom: "16px",
                          }}>
                            <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1f2937" }}>
                              Questao {qIndex + 1}
                            </h4>

                            {/* Campos de opcoes */}
                            {questao.opcoes.map((opcao, oIndex) => (
                              <div key={`info-op-${questao.pergunta}-${opcao.letter}-${opcao.text}`} style={{ marginBottom: "12px" }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
                                  Opcao {opcao.letter}
                                </label>
                                <input
                                  type="text"
                                  placeholder={`Digite a Opcao ${opcao.letter}...`}
                                  value={opcao.text}
                                  onChange={(e) => {
                                    const naovaQuestoes = [...multiplaQuestoes];
                                    naovaQuestoes[qIndex].opcoes[oIndex].text = e.target.value;
                                    setMultiplaQuestoes(naovaQuestoes);
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "4px",
                                    fontSize: "14px",
                                    fontFamily: "inherit",
                                    boxSizing: "border-box",
                                  }}
                                />
                              </div>
                            ))}

                            {/* Radio buttons para resposta correta */}
                            <div style={{ marginBottom: "12px" }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 0, marginBottom: "8px" }}>
                                Resposta Correta:
                              </p>
                              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                                {questao.opcoes.map((opcao) => (
                                  <label key={opcao.letter} style={{ display: "flex", alignItems: "center", fontSize: "14px", cursor: "pointer" }}>
                                    <input
                                      type="radio"
                                      name={`respostaCorreta_${qIndex}`}
                                      value={opcao.letter}
                                      checked={questao.respostaCorreta === opcao.letter}
                                      onChange={(e) => {
                                        const naovaQuestoes = [...multiplaQuestoes];
                                        naovaQuestoes[qIndex].respostaCorreta = e.target.value;
                                        setMultiplaQuestoes(naovaQuestoes);
                                      }}
                                      style={{ marginRight: "6px", cursor: "pointer" }}
                                    />
                                    {opcao.letter}
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Botao remover Questao */}
                            {multiplaQuestoes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMultiplaQuestoes(multiplaQuestoes.filter((_, i) => i !== qIndex));
                                }}
                                style={{
                                  padding: "6px 12px",
                                  background: "#fecaca",
                                  color: "#991b1b",
                                  border: "1px solid #fca5a5",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                }}
                              >
                                {iconLabel(<Trash2 size={14} />, "Remover Questao")}
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Botao adicionar Questao */}
                        {/* Temporariamente desativado: adicionar outra questao */}

                        {/* PREVIEW DINAMICO DA PRIMEIRA QUESTAO */}
                        {multiplaQuestoes.length > 0 && descricao.trim() && (
                          <div style={{
                            background: "var(--card)",
                            border: "2px solid var(--line)",
                            borderRadius: "8px",
                            padding: "16px",
                            marginTop: "16px",
                          }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#0c4a6e", marginTop: 0, marginBottom: "12px" }}>
                              {iconLabel(<Eye size={14} />, "PREVIEW - Como o aluno vai ver:")}
                            </p>
                            <MultipleChoiceQuestion
                              question={`Q1: ${descricao.trim()}`}
                              options={multiplaQuestoes[0].opcoes}
                              onAnswer={() => { }}
                            />
                          </div>
                        )}
                      </div>
                    </ConditionalFieldAnimation>
                  </>
                )}

                <div className="exInputRow">
                  <div className="exInputGroup">
                    <span className="exLabel">Curso selecionado *</span>
                    <div className={`exCourseSummary ${cursoSelecionado ? "" : "isEmpty"}`}>
                      {cursoSelecionado ? (
                        <>
                          <strong>
                            {iconLabel(
                              inferCategoriaFromCourseName(cursoSelecionado.nome) === "informatica"
                                ? <Monitor size={14} />
                                : <Laptop size={14} />,
                              cursoSelecionado.nome
                            )}
                          </strong>
                          {cursoSelecionado.descricao && <span>{cursoSelecionado.descricao}</span>}
                        </>
                      ) : (
                        <span>Selecione um curso acima para liberar os módulos e fases.</span>
                      )}
                    </div>
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Os módulos abaixo são filtrados automaticamente pelo curso selecionado.
                    </small>
                  </div>
                </div>

                <div className="exInputRow">
                  <div className="exInputGroup">
                    <span className="exLabel">Modulo *</span>
                    <div className={`exFieldWarnWrap ${fieldWarnings.modulo ? "isWarning" : ""}`}>
                      <PaginatedSelect
                        value={moduloIdSelecionado}
                        onChange={(value) => {
                          setModuloIdSelecionado(value);
                          setFaseIdSelecionada("");
                          clearFieldWarning("modulo");
                          clearFieldWarning("fase");
                          clearFieldWarning("ordem");
                        }}
                        options={modulosDisponiveis.map((moduloOption) => ({
                          value: moduloOption.id,
                          label: moduloOption.nome,
                          meta: moduloOption.indexOrder ? `Ordem #${moduloOption.indexOrder}` : undefined,
                        }))}
                        placeholder={cursoIdSelecionado ? "Selecione um modulo" : "Selecione um curso primeiro"}
                        disabled={!cursoIdSelecionado}
                        pageSize={8}
                        emptyText="Nenhum modulo encontrado"
                      />
                    </div>
                    {fieldWarnings.modulo && <small className="exFieldWarning">{fieldWarnings.modulo}</small>}
                  </div>

                  <div className="exInputGroup">
                    <span className="exLabel">Fase *</span>
                    <div className={`exFieldWarnWrap ${fieldWarnings.fase ? "isWarning" : ""}`}>
                      <PaginatedSelect
                        value={faseIdSelecionada}
                        onChange={(value) => {
                          setFaseIdSelecionada(value);
                          clearFieldWarning("fase");
                          clearFieldWarning("ordem");
                        }}
                        options={fasesDisponiveis.map((fase) => ({
                          value: fase.id,
                          label: fase.nome,
                          meta: `Semana ${fase.weekNumber}`,
                        }))}
                        placeholder={moduloIdSelecionado ? "Selecione uma fase" : "Selecione um modulo primeiro"}
                        disabled={!moduloIdSelecionado}
                        pageSize={8}
                        emptyText="Nenhuma fase encontrada"
                      />
                    </div>
                    {fieldWarnings.fase && <small className="exFieldWarning">{fieldWarnings.fase}</small>}
                  </div>

                  <div className="exInputGroup">
                    <span className="exLabel">Prazo (Valido apenas nas tarefas diarias) *</span>
                    <input
                      className={`exInput ${fieldWarnings.prazo ? "isWarning" : ""}`}
                      type="datetime-local"
                      value={prazo}
                      onChange={(e) => {
                        setPrazo(e.target.value);
                        clearFieldWarning("prazo");
                      }}
                    />
                    {fieldWarnings.prazo && <small className="exFieldWarning">{fieldWarnings.prazo}</small>}
                  </div>
                </div>

                <div className="exInputRow">
                  <div className="exInputGroup">
                    <span className="exLabel">Video URL</span>
                    <input
                      className="exInput"
                      type="url"
                      placeholder="https://..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Link opcional de apoio para este exercicio.
                    </small>
                  </div>

                  <div className="exInputGroup">
                    <span className="exLabel">Dificuldade</span>
                    <AnimatedSelect
                      className="exSelect"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      <option value="1">Normal</option>
                      <option value="2">Lower (Recuperação)</option>
                      <option value="3">Prova Semanal</option>
                    </AnimatedSelect>
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Escolha um nivel compativel com a validacao da API.
                    </small>
                  </div>

                  {/* Campo Ordem removido da criação conforme correções.md */}
                </div>

                <div className="exInputRow">
                  <div className="exInputGroup">
                    <span className="exLabel">Pontos de resgate</span>
                    <input
                      className="exInput"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={pointsRedeem}
                      onChange={(e) => setPointsRedeem(e.target.value)}
                    />
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Pontos que o aluno recebe ao concluir o exercicio.
                    </small>
                  </div>

                  <div className="exInputGroup">
                    <span className="exLabel">Periodo do exercicio</span>
                    <input
                      className="exInput"
                      type="datetime-local"
                      value={exercisePeriod}
                      onChange={(e) => setExercisePeriod(e.target.value)}
                    />
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Data e hora de quando começou o exercício (opcional).
                    </small>
                  </div>
                </div>

                <div className="exInputRow">
                  <div className="exInputGroup">
                    <div
                      className={`exStatusToggle ${isFinalExercise ? "isActive" : ""}`}
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
                      <AnimatedToggle
                        checked={isFinalExercise}
                        onChange={setIsFinalExercise}
                      />
                      <span className="exStatusToggleContent">
                        <span className="exStatusToggleTitle">Exercicio final</span>
                        <span className="exStatusToggleDescription">Marque se este for o exercicio de fechamento da fase.</span>
                      </span>
                    </div>
                  </div>
                  <div className="exInputGroup">
                    <div
                      className={`exStatusToggle ${isDailyTask ? "isActive" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setIsDailyTask(!isDailyTask)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setIsDailyTask(!isDailyTask);
                        }
                      }}
                    >
                      <AnimatedToggle
                        checked={isDailyTask}
                        onChange={setIsDailyTask}
                      />
                      <span className="exStatusToggleContent">
                        <span className="exStatusToggleTitle">Tarefas diárias</span>
                        <span className="exStatusToggleDescription">Mostra este exercicio na aba de tarefa diaria.</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="exInputGroup">
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Acesso definido por fase no novo schema. Atribuicao por aluno/turma sera adicionada depois.
                  </small>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <AnimatedButton
                    className="exSubmitBtn"
                    onClick={handleSubmit}
                    disabled={disabled}
                    loading={saving}
                    style={{ flex: 1 }}
                  >
                    {editandoId
                      ? iconLabel(<Save size={16} />, "Atualizar Exercicio")
                      : iconLabel(<Sparkles size={16} />, "Publicar Exercicio")}
                  </AnimatedButton>
                  {editandoId && (
                    <AnimatedButton
                      className="exSubmitBtn"
                      onClick={handleCancel}
                      disabled={saving}
                      style={{
                        background: "linear-gradient(135deg, #6b7280, #4b5563)",
                        flex: 1,
                      }}
                    >
                      {iconLabel(<X size={16} />, "Cancelar")}
                    </AnimatedButton>
                  )}
                </div>

                <div className="exFormnaote">
                  {iconLabel(<Lightbulb size={16} />, "Exercicios podem ser publicados para turmas, alunos especificos ou para todos.")}
                </div>
              </div>
            </div>
          </FadeInUp>
        )}

        {isStaff && activeSection === "respostas" && (
          <div className="responsesHub">
            <div className="responsesToolbar">
              <input
                className="exInput"
                type="text"
                placeholder="Filtrar usuarios por nome ou e-mail"
                value={respostasAlunoFiltro}
                onChange={(e) => {
                  setRespostasAlunoFiltro(e.target.value);
                  setRespostasAlunoPage(1);
                  setRespostasAlunoAbertoId(null);
                  setRespostasAlunoId("");
                }}
              />
              <select
                className="exSelect responsesLimitSelect"
                value={String(respostasAlunoLimit)}
                onChange={(e) => {
                  setRespostasAlunoLimit(Number(e.target.value));
                  setRespostasAlunoPage(1);
                  setRespostasAlunoAbertoId(null);
                  setRespostasAlunoId("");
                }}
              >
                                <option value="5">5 por pagina</option>
                                <option value="10">10 por pagina</option>
                                <option value="20">20 por pagina</option>
              </select>
            </div>

            {loadingRespostasAlunos ? (
              <div className="loadingState">
                <div className="spinner" />
                Carregando usuarios...
              </div>
            ) : respostasAlunos.length === 0 ? (
              <div className="emptyState">Nenhum usuario respondeu ainda (tabela answer).</div>
            ) : (
              <>
                <div className="responsesSummaryTop">
                    {respostasAlunoPagination.total} usuario(s)
                  <span>
                    Pagina {respostasAlunoPagination.page} de {respostasAlunoPagination.totalPages}
                  </span>
                </div>

                <div className="responsesStudentsList">
                  {respostasAlunos.map((aluno, alunoIndex) => {
                    const aberto = respostasAlunoAbertoId === aluno.id;
                    const initials = (aluno.nome || "Aluno")
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((parte) => parte.charAt(0))
                      .join("")
                      .toUpperCase();
                    const studentAnimationStyle = {
                      "--responses-student-delay": `${Math.min(alunoIndex, 12) * 45}ms`,
                    } as React.CSSProperties;
                    return (
                      <div
                        key={aluno.id}
                        className={`responsesStudentItem ${aberto ? "isOpen" : ""}`}
                        style={studentAnimationStyle}
                      >
                        <button
                          type="button"
                          className="responsesStudentToggle"
                          onClick={() => toggleRespostasAluno(aluno.id)}
                        >
                          <div className="responsesStudentIdentity">
                            <span className="responsesStudentAvatar" aria-hidden="true">
                              {initials || "A"}
                            </span>
                            <div>
                              <div className="responsesStudentName">{aluno.nome}</div>
                              <div className="responsesStudentEmail">{aluno.email || "Sem e-mail/usuario"}</div>
                            </div>
                          </div>
                          <div className="responsesStudentMeta">
                            <div className="responsesStudentMetaCounts">
                              <span className="responsesStudentMetaBadge">{aluno.totalRespostas} resposta(s)</span>
                              <span className="responsesStudentMetaBadge">{aluno.totalExercicios} exercicio(s)</span>
                            </div>
                            <span className="responsesStudentLast">
                              {aluno.lastAnsweredAt
                                ? `Ultima: ${new Date(aluno.lastAnsweredAt).toLocaleDateString("pt-BR")}`
                                : "Sem data"}
                            </span>
                          </div>
                          <span className="responsesStudentChevron">
                            {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </button>

                        {aberto && (
                          <div className="responsesExercisesWrap">
                            <div className="responsesExercisesToolbar">
                              <input
                                className="exInput"
                                type="text"
                                placeholder="Filtrar exercicios deste usuario"
                                value={respostasExercicioFiltro}
                                onChange={(e) => {
                                  setRespostasExercicioFiltro(e.target.value);
                                  setRespostasExercicioPage(1);
                                }}
                              />
                              <select
                                className="exSelect responsesLimitSelect"
                                value={String(respostasExercicioLimit)}
                                onChange={(e) => {
                                  setRespostasExercicioLimit(Number(e.target.value));
                                  setRespostasExercicioPage(1);
                                }}
                              >
                                <option value="5">5 por pagina</option>
                                <option value="10">10 por pagina</option>
                                <option value="20">20 por pagina</option>
                              </select>
                            </div>

                            {loadingRespostasExercicios ? (
                              <div className="loadingState responsesInnerLoading">
                                <div className="spinner" />
                                Carregando exercicios...
                              </div>
                            ) : respostasExerciciosAluno.length === 0 ? (
                              <div className="emptyState">Este usuario ainda nao possui exercicios respondidos.</div>
                            ) : (
                              <div className="responsesExercisesList">
                                {respostasExerciciosAluno.map((exercicio, exercicioIndex) => {
                                  const directKey = getRespostasDiretasKey(aluno.id, exercicio.id);
                                  const respostasDiretas = respostasDiretasPorExercicio[directKey] ?? [];
                                  const carregandoRespostasDiretas = loadingRespostasDiretas[directKey] ?? false;
                                  const seletorValue = seletorRespostaDireta[directKey] ?? "";
                                  const abertoExercicio = respostaExercicioAbertoKey === directKey;
                                  const exerciseAnimationStyle = {
                                    "--responses-exercise-delay": `${Math.min(exercicioIndex, 10) * 38}ms`,
                                  } as React.CSSProperties;

                                  return (
                                    <div
                                      key={exercicio.id}
                                      className={`responsesExerciseItem ${abertoExercicio ? "isOpen" : ""}`}
                                      style={exerciseAnimationStyle}
                                    >
                                      <button
                                        type="button"
                                        className="responsesExerciseToggle"
                                        onClick={() => setRespostaExercicioAbertoKey((prev) => (prev === directKey ? null : directKey))}
                                        aria-expanded={abertoExercicio}
                                      >
                                        <div className="responsesExerciseInfo">
                                          <div className="responsesExerciseTitle">{exercicio.titulo}</div>
                                          <div className="responsesExerciseMeta">
                                            {[exercicio.modulo, exercicio.tema].filter(Boolean).join(" - ") || "Sem modulo/fase"}
                                          </div>
                                          <div className="responsesExerciseMeta">
                                            {exercicio.lastAnsweredAt
                                              ? `Ultima resposta: ${new Date(exercicio.lastAnsweredAt).toLocaleString("pt-BR")}`
                                              : "Sem data"}
                                          </div>
                                        </div>

                                        <div className="responsesExerciseToggleMeta">
                                          <span className="responsesStudentMetaBadge">{exercicio.totalRespostas} resposta(s)</span>
                                          <span className="responsesStudentMetaBadge">{respostasDiretas.length} listada(s)</span>
                                          <span className="responsesStudentChevron">
                                            {abertoExercicio ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                          </span>
                                        </div>
                                      </button>

                                      {abertoExercicio && (
                                        <div className="responsesExercisePanel">
                                          {carregandoRespostasDiretas ? (
                                            <div className="loadingState responsesInnerLoading">
                                              <div className="spinner" />
                                              Carregando respostas...
                                            </div>
                                          ) : respostasDiretas.length === 0 ? (
                                            <div className="emptyState">Nenhuma resposta listada para este exercicio.</div>
                                          ) : (
                                            <div className="responsesDirectList" role="listbox" aria-label="Respostas do exercicio">
                                              {respostasDiretas.map((resposta, respostaIndex) => {
                                                const value = getRespostaDiretaValue(resposta);
                                                const selecionada = seletorValue === value;
                                                const directRowAnimationStyle = {
                                                  "--responses-direct-delay": `${Math.min(respostaIndex, 14) * 30}ms`,
                                                } as React.CSSProperties;

                                                return (
                                                  <button
                                                    key={`${resposta.answerId}-${resposta.questionId}`}
                                                    type="button"
                                                    className={`responsesDirectRow ${selecionada ? "isSelected" : ""}`}
                                                    style={directRowAnimationStyle}
                                                    onClick={() => {
                                                      setSeletorRespostaDireta((prev) => ({ ...prev, [directKey]: value }));
                                                      navegarParaRespostaDireta(exercicio.id, aluno.id, value);
                                                    }}
                                                  >
                                                    <span className="responsesDirectRowLabel">{getRespostaDiretaLabel(resposta)}</span>
                                                    {selecionada ? <span className="responsesDirectRowBadge">Selecionada</span> : null}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}

                                          <div className="responsesExerciseActions">
                                            <button
                                              type="button"
                                              className="responsesOpenBtn small"
                                              onClick={() =>
                                                navigate(`/dashboard/exercicios/${exercicio.id}`, {
                                                  state: {
                                                    from: location.pathname,
                                                    fromSection: "respostas",
                                                    prefilterAlunoId: aluno.id,
                                                  },
                                                })
                                              }
                                            >
                                              Ver respostas
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {!loadingRespostasExercicios && respostasExerciciosAluno.length > 0 && (
                              <div className="responsesPagination">
                                <button
                                  type="button"
                                  className="responsesPageBtn"
                                  disabled={respostasExercicioPage <= 1}
                                  onClick={() => setRespostasExercicioPage((p) => Math.max(1, p - 1))}
                                >
                                  Anterior
                                </button>
                                <span>
                                  Pagina {respostasExercicioPagination.page} de {respostasExercicioPagination.totalPages} ({respostasExercicioPagination.total} exercicios)
                                </span>
                                <button
                                  type="button"
                                  className="responsesPageBtn"
                                  disabled={respostasExercicioPage >= respostasExercicioPagination.totalPages}
                                  onClick={() =>
                                    setRespostasExercicioPage((p) => Math.min(respostasExercicioPagination.totalPages, p + 1))
                                  }
                                >
                                  Proxima
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="responsesPagination">
                  <button
                    type="button"
                    className="responsesPageBtn"
                    disabled={respostasAlunoPage <= 1}
                    onClick={() => setRespostasAlunoPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span>
                    {respostasAlunoPagination.total} usuario(s)
                  </span>
                  <button
                    type="button"
                    className="responsesPageBtn"
                    disabled={respostasAlunoPage >= respostasAlunoPagination.totalPages}
                    onClick={() => setRespostasAlunoPage((p) => Math.min(respostasAlunoPagination.totalPages, p + 1))}
                  >
                                  Proxima
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {/* FILTROS DE ExercicioS */}
        {(activeSection === "lista" || activeSection === "tarefa-diaria") && (
          <>
            <div className="filtersSection">
              {/* Linha 1: Busca por Titulo */}
              <div className="filterRow">
                <div className="filterGroup" style={{ flex: 1 }}>
                  <input
                    className="exInput"
                    type="text"
                    placeholder={activeSection === "tarefa-diaria" ? "Buscar tarefa diaria..." : "Buscar por Titulo..."}
                    value={buscaFiltro}
                    onChange={(e) => {
                      setBuscaFiltro(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {/* Linha 2: Modulo, Turmas, Status */}
              <div className="filterRow" style={{ gap: "12px" }}>
                {/* Filtro de modulo */}
                <div className="filterGroup">
                  <select
                    className="exSelect"
                    value={moduloFiltro}
                    onChange={(e) => {
                      setModuloFiltro(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ minWidth: 160 }}
                  >
                    <option value="">Todos os Modulos</option>
                    {moduloFilterOptions.map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro de turmas */}
                {turmasDisponiveis.length > 0 && (
                  <div className="filterGroup">
                    <select
                      className="exSelect"
                      value={turmaFiltro}
                      onChange={(e) => {
                        setTurmaFiltro(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{ minWidth: 180 }}
                    >
                      <option value="todas">Todas as turmas</option>
                      {turmasDisponiveis.map((turma) => (
                        <option key={turma.id} value={turma.id}>
                          {turma.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Filtro de status (staff only) */}
                {isStaff && (
                  <div className="filterGroup">
                    <select
                      className="exSelect"
                      value={statusFiltro}
                      onChange={(e) => {
                        setStatusFiltro(e.target.value as "todos" | "publicado" | "programado" | "rascunho");
                        setCurrentPage(1);
                      }}
                      style={{ minWidth: 160 }}
                    >
                      <option value="todos">Todos os status</option>
                      <option value="publicado">Publicado</option>
                      <option value="programado">Programado</option>
                      <option value="rascunho">Rascunho</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* LISTA DE ExercicioS */}
            <div>
              {loading && sourceItems.length === 0 ? (
                <div className="loadingState">
                  <div className="spinner" />
                                Carregando exercicios...
                </div>
              ) : !loading && sourceItems.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyIcon" style={{ display: "inline-flex" }}><BookOpen size={22} /></div>
                  <div className="emptyTitle">Nenhum Exercicio Disponivel</div>
                  <p style={{ margin: "8px 0 0 0", color: "var(--muted)" }}>
                    Volte mais tarde para novos Exercicios!
                  </p>
                </div>
              ) : (
                <>
                  {/* Filtros e Paginacao */}
                  <div style={{ marginBottom: "16px" }}>
                    {totalItemsSection === 0 ? (
                      <div className="emptyState">
                        <div className="emptyIcon" style={{ display: "inline-flex" }}><BookOpen size={22} /></div>
                        <div className="emptyTitle">
                          {activeSection === "tarefa-diaria"
                            ? "Nenhuma tarefa diaria encontrada"
                            : "Nenhum Exercicio encontrado"}
                        </div>
                        <p style={{ margin: "8px 0 0 0", color: "var(--muted)" }}>
                          {activeSection === "tarefa-diaria"
                            ? "Nenhuma tarefa diaria foi retornada do banco para os filtros selecionados."
                            : "Ajuste os filtros e tente naovamente."}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="exercisesListVirtualHost" ref={exercisesListVirtualHostRef}>
                          {shouldVirtualizeExercises && exercisesVirtualWindow && exercisesVirtualWindow.topSpacerHeight > 0 && (
                            <div
                              className="exercisesListVirtualSpacer"
                              style={{ height: exercisesVirtualWindow.topSpacerHeight }}
                              aria-hidden="true"
                            />
                          )}
                          <div className="exercisesList" ref={exercisesListGridRef}>
                            {visibleExercises.map((item, visibleIndex) => {
                            const { ex, alunoIds, hasAlunoAssignment, publishedAtMs, prazoMs } = item;
                            const alunoNames = hasAlunoAssignment ? getAlunoNames(ex) : [];
                            const showParaMim = !isStaff && !!userId && alunoIds.includes(userId);
                            const alunoLabel = showParaMim ? "Para mim" : formatAlunoLabel(alunoNames);
                            const alunoTitle = showParaMim
                              ? "Disponivel apenas para vocee"
                              : alunoNames.length > 0
                                ? `Disponivel apenas para: ${alunoNames.join(", ")}`
                                : "Disponivel para aluno(s) especifico(s)";
                            const tipoInfo = getTipoInfo(ex);
                            const isPublished = ex.publicado !== false;
                            const isScheduled = publishedAtMs !== null && publishedAtMs > renderNowMs;
                            const isDraft = !isPublished && !isScheduled;
                            const isOverdue = prazoMs !== null && prazoMs < renderNowMs;
                            const prazoLabel = prazoMs !== null ? prazoDateFormatter.format(prazoMs) : "Sem prazo";
                            const shouldMeasureCard = shouldVirtualizeExercises && visibleIndex === 0;
                            const cardAnimationStyle = {
                              "--card-enter-delay": `${Math.min(visibleIndex, 10) * 45}ms`,
                            } as React.CSSProperties;

                            return (
                              <div
                                key={ex.id}
                                className={`exerciseCard ${canCreate ? "canEdit" : ""}`}
                                style={cardAnimationStyle}
                                ref={shouldMeasureCard ? measureExerciseCardRef : undefined}
                                onClick={() =>
                                  navigate(`/dashboard/exercicios/${ex.id}`, {
                                    state: {
                                      from: location.pathname,
                                      fromSection: activeSection,
                                    },
                                  })
                                }
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    navigate(`/dashboard/exercicios/${ex.id}`, {
                                      state: {
                                        from: location.pathname,
                                        fromSection: activeSection,
                                      },
                                    });
                                  }
                                }}
                              >
                                <div className="exerciseHeader">
                                  <div className="exerciseInfo">
                                    <div className="exerciseTitleContainer">
                                      <h3 className="exerciseTitle">{ex.titulo}</h3>
                                      {isStaff && isDraft && (
                                        <span
                                          className="exerciseBadge"
                                          style={{
                                            background: "rgba(156, 163, 175, 0.15)",
                                            color: "#6b7280",
                                            borderColor: "rgba(156, 163, 175, 0.3)",
                                          }}
                                          title="Rascunho - nao visivel para alunos"
                                        >
                                          Rascunho
                                        </span>
                                      )}
                                      {isStaff && !isDraft && isScheduled && (
                                        <span
                                          className="exerciseBadge"
                                          style={{
                                            background: "rgba(59, 130, 246, 0.1)",
                                            color: "#3b82f6",
                                            borderColor: "rgba(59, 130, 246, 0.2)",
                                          }}
                                          title="Exercicio programado para Publicacao"
                                        >
                                          Programado
                                        </span>
                                      )}
                                    </div>
                                    <div className="exerciseMetaLine">
                                      <span className={`exerciseTypePill ${tipoInfo.className}`}>{tipoInfo.label}</span>
                                      <span className="exerciseModulePill">{ex.modulo}</span>
                                      <span className="exercisePhasePill">{ex.tema?.trim() ? ex.tema : "Sem fase"}</span>
                                      {ex.containerName && (
                                        <span className="exerciseContainerPill">
                                          {ex.containerName}{ex.containerDay ? ` (Dia ${ex.containerDay})` : ""}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="exerciseMetaAndActions">
                                      <div className="exerciseMeta">
                                        <div className={`exerciseDeadline ${isOverdue ? "overdue" : ""}`}>
                                        {prazoLabel}
                                      </div>
                                    </div>

                                    {canCreate && (
                                      <div className="exerciseActions">
                                        <button
                                          className="exerciseEditBtn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            abrirModalEditOpcoes(ex);
                                          }}
                                          title="Editar Exercicio"
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button
                                          className="exerciseDeleteBtn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(ex.id);
                                          }}
                                          title="Deletar Exercicio"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="exerciseQuestionBox">
                                  <div className="exerciseQuestionLabel">Pergunta</div>
                                  <p className="exerciseQuestionText">{ex.descricao?.trim() || "Sem enunciado cadastrado."}</p>
                                </div>

                                {/* Badges de acesso/turmas */}
                                <div className="exerciseAccessRow">
                                  {hasAlunoAssignment ? (
                                    <span className="exerciseAccessBadge isAluno" title={alunoTitle}>
                                      {iconLabel(<UserIcon size={12} />, alunoLabel)}
                                    </span>
                                  ) : ex.turmas && ex.turmas.length > 0 ? (
                                    <>
                                      <span className="exerciseAccessBadge isTurmas">
                                        {iconLabel(<Landmark size={12} />, `${ex.turmas.length} turma${ex.turmas.length > 1 ? "s" : ""}`)}
                                      </span>
                                      {ex.turmas.map((turma) => (
                                        <span
                                          key={turma.id}
                                          className={`exerciseTurmaBadge ${turma.tipo === "turma" ? "isTurma" : "isParticular"}`}
                                          title={`${turma.tipo}: ${turma.nome}`}
                                        >
                                          {turma.nome}
                                        </span>
                                      ))}
                                    </>
                                  ) : (
                                    <span className="exerciseAccessBadge isAll" title="Disponivel para todos os alunos">
                                      {iconLabel(<Globe size={12} />, "Para Todos")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                          {shouldVirtualizeExercises && exercisesVirtualWindow && exercisesVirtualWindow.bottomSpacerHeight > 0 && (
                            <div
                              className="exercisesListVirtualSpacer"
                              style={{ height: exercisesVirtualWindow.bottomSpacerHeight }}
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <Pagination
                          currentPage={currentPage}
                          itemsPerPage={itemsPerPage}
                          totalItems={totalItemsSection}
                          onPageChange={setCurrentPage}
                          onItemsPerPageChange={setItemsPerPage}
                        />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )
        }

        {/* MODAL DE CONFIRMACAO PARA DELETAR */}
        <ConfirmModal
          isOpen={modalDeletar.isOpen}
          title="Deletar Exercicio"
          message={`Tem certeza que deseja deletar "${modalDeletar.exercicioTitulo}"? Esta acao nao pode ser desfeita e todas as submissoes serao perdidas.`}
          confirmText="Deletar"
          cancelText="Cancelar"
          onConfirm={confirmarDeletar}
          onCancel={fecharModalDeletar}
          danger={true}
          isLoading={saving}
        />

        <Modal
          isOpen={infoOverlay !== null}
          onClose={() => setInfoOverlay(null)}
          title={infoOverlay === "dificuldade" ? "Como funciona a dificuldade" : "Como funciona a ordem"}
          size="sm"
          footer={
            <AnimatedButton className="exInfoModalBtn" onClick={() => setInfoOverlay(null)}>
              Entendi
            </AnimatedButton>
          }
        >
          {infoOverlay === "dificuldade" ? (
            <div className="exInfoModalContent">
              <p>A dificuldade minima e 1.</p>
              <ul className="exInfoList">
                <li>1 = Facil</li>
                <li>2 = Medio</li>
                <li>3 = Dificil</li>
              </ul>
              <p className="exInfoHint">Use 4 ou mais apenas para exercicios avancados.</p>
            </div>
          ) : (
            <div className="exInfoModalContent">
              <p>A ordem define a posicao do exercicio dentro da mesma fase/modulo.</p>
              <ul className="exInfoList">
                <li>A menor ordem permitida e 1.</li>
                <li>Menor ordem aparece primeiro.</li>
              </ul>
            </div>
          )}
        </Modal>

        {/* MODAL DE OPCOES DE EDITAR */}
        <Modal
          isOpen={modalEditOpcoes.isOpen}
          onClose={fecharModalEditOpcoes}
          title={`Editar: ${modalEditOpcoes.exercicio?.titulo ?? "Exercício"}`}
          size="sm"
        >
          <div className="exActionChoiceModal">
            <p className="exActionChoiceLead">
              O que deseja fazer com este exercício?
            </p>
            <AnimatedButton
              className="exActionChoiceBtn exActionChoiceBtnPrimary"
              onClick={handleEscolherEditar}
            >
              {iconLabel(<PenLine size={16} />, "Editar Exercício")}
            </AnimatedButton>
            <small className="exActionChoiceHint">
              Alterar título, descrição, tipo, dificuldade e demais atributos.
            </small>
            <AnimatedButton
              className="exActionChoiceBtn exActionChoiceBtnSecondary"
              onClick={handleEscolherRealocar}
            >
              {iconLabel(<RefreshCcw size={16} />, "Realocar Exercício")}
            </AnimatedButton>
            <small className="exActionChoiceHint">
              Mover o exercício para outra fase, módulo ou curso.
            </small>
          </div>
        </Modal>

        {/* MODAL DE EDITAR ATRIBUTOS */}
        <Modal
          isOpen={modalEditarAtributos.isOpen}
          onClose={fecharModalEditarAtributos}
          title={`Editar: ${modalEditarAtributos.exercicio?.titulo ?? "Exercício"}`}
          size="md"
          footer={
            <>
              <AnimatedButton
                className="exModalFooterBtn exModalFooterBtnGhost"
                onClick={fecharModalEditarAtributos}
              >
                Cancelar
              </AnimatedButton>
              <AnimatedButton
                className="exModalFooterBtn exModalFooterBtnPrimary"
                disabled={editAttrSaving || editAttrTitulo.trim().length < 2}
                onClick={confirmarEditarAtributos}
              >
                {editAttrSaving
                  ? iconLabel(<Loader2 size={16} />, "Salvando...")
                  : iconLabel(<Save size={16} />, "Salvar Alterações")}
              </AnimatedButton>
            </>
          }
        >
          <div className="exEditAttrModalBody">
            {editAttrErro && (
              <div className="exEditAttrErro">{editAttrErro}</div>
            )}

            <div className="exInputGroup">
              <span className="exLabel">Título</span>
              <input
                className="exInput"
                value={editAttrTitulo}
                onChange={(e) => setEditAttrTitulo(e.target.value)}
                placeholder="Título do exercício"
              />
            </div>

            <div className="exInputGroup">
              <span className="exLabel">Descrição</span>
              <textarea
                className="exInput"
                value={editAttrDescricao}
                onChange={(e) => setEditAttrDescricao(e.target.value)}
                placeholder="Descrição do exercício"
                rows={3}
                style={{ resize: "vertical" }}
              />
            </div>

            <div className="exInputGroup">
              <span className="exLabel">Tipo de componente</span>
              <div style={{ display: "flex", gap: 12 }}>
                <AnimatedRadioLabel
                  name="editAttrComponenteInterativo"
                  value="escrita"
                  checked={editAttrComponenteInterativo === "escrita"}
                  onChange={() => setEditAttrComponenteInterativo("escrita")}
                  label="Dissertativo"
                  icon={<PenLine size={14} />}
                />
                <AnimatedRadioLabel
                  name="editAttrComponenteInterativo"
                  value="multipla"
                  checked={editAttrComponenteInterativo === "multipla"}
                  onChange={() => setEditAttrComponenteInterativo("multipla")}
                  label="Múltipla Escolha"
                  icon={<ListChecks size={14} />}
                />
              </div>
            </div>

            {editAttrComponenteInterativo === "multipla" && (
              <div className="exInputGroup">
                <span className="exLabel">Questões</span>
                {editAttrMultiplaQuestoes.map((q, qi) => (
                  <MultipleChoiceQuestionEditor
                    key={qi}
                    questionIndex={qi}
                    opcoes={q.opcoes}
                    respostaCorreta={q.respostaCorreta}
                    onChangeOpcao={(oi, val) => {
                      const clone = [...editAttrMultiplaQuestoes];
                      const opcoes = [...clone[qi].opcoes];
                      opcoes[oi] = { ...opcoes[oi], text: val };
                      clone[qi] = { ...clone[qi], opcoes };
                      setEditAttrMultiplaQuestoes(clone);
                    }}
                    onChangeCorreta={(val) => {
                      const clone = [...editAttrMultiplaQuestoes];
                      clone[qi] = { ...clone[qi], respostaCorreta: val };
                      setEditAttrMultiplaQuestoes(clone);
                    }}
                    onAddOpcao={() => {
                      const clone = [...editAttrMultiplaQuestoes];
                      const letters = clone[qi].opcoes.map((o) => o.letter);
                      const next = String.fromCharCode(65 + letters.length);
                      clone[qi] = { ...clone[qi], opcoes: [...clone[qi].opcoes, { letter: next, text: "" }] };
                      setEditAttrMultiplaQuestoes(clone);
                    }}
                    onRemoveOpcao={(oi) => {
                      const clone = [...editAttrMultiplaQuestoes];
                      const opcoes = clone[qi].opcoes.filter((_, i) => i !== oi);
                      clone[qi] = { ...clone[qi], opcoes };
                      setEditAttrMultiplaQuestoes(clone);
                    }}
                    onRemoveQuestao={editAttrMultiplaQuestoes.length > 1 ? () => {
                      setEditAttrMultiplaQuestoes(editAttrMultiplaQuestoes.filter((_, i) => i !== qi));
                    } : undefined}
                  />
                ))}
                <AnimatedButton
                  className="exActionChoiceBtn exActionChoiceBtnSecondary"
                  style={{ marginTop: 8, alignSelf: "flex-start" }}
                  onClick={() => setEditAttrMultiplaQuestoes([
                    ...editAttrMultiplaQuestoes,
                    { pergunta: "", opcoes: [{ letter: "A", text: "" }, { letter: "B", text: "" }, { letter: "C", text: "" }, { letter: "D", text: "" }], respostaCorreta: "" }
                  ])}
                >
                  + Adicionar Questão
                </AnimatedButton>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="exInputGroup">
                <span className="exLabel">Prazo</span>
                <input
                  className="exInput"
                  type="datetime-local"
                  value={editAttrPrazo}
                  onChange={(e) => setEditAttrPrazo(e.target.value)}
                />
              </div>
              <div className="exInputGroup">
                <span className="exLabel">Dificuldade</span>
                <AnimatedSelect
                  className="exSelect"
                  value={editAttrDifficulty}
                  onChange={(e) => setEditAttrDifficulty(e.target.value)}
                >
                  <option value="">Padrão</option>
                  <option value="1">Normal</option>
                  <option value="2">Lower (Recuperação)</option>
                  <option value="3">Prova Semanal</option>
                </AnimatedSelect>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="exInputGroup">
                <span className="exLabel">Ordem</span>
                <input
                  className="exInput"
                  type="number"
                  min={1}
                  value={editAttrIndexOrder}
                  onChange={(e) => setEditAttrIndexOrder(e.target.value)}
                  placeholder="Ex: 1"
                />
              </div>
              <div className="exInputGroup">
                <span className="exLabel">Pontos</span>
                <input
                  className="exInput"
                  type="number"
                  min={0}
                  value={editAttrPointsRedeem}
                  onChange={(e) => setEditAttrPointsRedeem(e.target.value)}
                  placeholder="Ex: 100"
                />
              </div>
            </div>

            <div className="exInputGroup">
              <span className="exLabel">URL do Vídeo</span>
              <input
                className="exInput"
                value={editAttrVideoUrl}
                onChange={(e) => setEditAttrVideoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="exInputGroup">
              <span className="exLabel">Período do exercício</span>
              <input
                className="exInput"
                type="datetime-local"
                value={editAttrExercisePeriod}
                onChange={(e) => setEditAttrExercisePeriod(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <AnimatedToggle
                  checked={editAttrIsFinalExercise}
                  onChange={() => setEditAttrIsFinalExercise(!editAttrIsFinalExercise)}
                />
                Exercício final
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <AnimatedToggle
                  checked={editAttrIsDailyTask}
                  onChange={() => setEditAttrIsDailyTask(!editAttrIsDailyTask)}
                />
                Tarefa diária
              </label>
            </div>
          </div>
        </Modal>

        {/* MODAL DE REALOCAR EXERCICIO */}
        <Modal
          isOpen={modalRealocar.isOpen}
          onClose={fecharModalRealocar}
          title={`Realocar: ${modalRealocar.exercicio?.titulo ?? "Exercício"}`}
          size="md"
          footer={
            <>
              <AnimatedButton
                className="exModalFooterBtn exModalFooterBtnGhost"
                onClick={fecharModalRealocar}
              >
                Cancelar
              </AnimatedButton>
              <AnimatedButton
                className="exModalFooterBtn exModalFooterBtnPrimary"
                disabled={realocSaving || !realocFaseId}
                onClick={confirmarRealocar}
              >
                {realocSaving
                  ? iconLabel(<Loader2 size={16} />, "Realocando...")
                  : iconLabel(<Check size={16} />, "Confirmar Realocação")}
              </AnimatedButton>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
              Selecione o novo destino para o exercício.
            </p>

            <div className="exInputGroup">
              <span className="exLabel">Curso</span>
              <AnimatedSelect
                className="exSelect"
                value={realocCursoId}
                onChange={(e) => handleRealocCursoChange(e.target.value)}
              >
                <option value="">Selecione um curso</option>
                {realocCursos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </AnimatedSelect>
            </div>

            <div className="exInputGroup">
              <span className="exLabel">Módulo</span>
              <AnimatedSelect
                className="exSelect"
                value={realocModuloId}
                onChange={(e) => handleRealocModuloChange(e.target.value)}
                disabled={!realocCursoId}
              >
                <option value="">{realocCursoId ? "Selecione um módulo" : "Selecione um curso primeiro"}</option>
                {realocModulos.map((m) => (
                  <option key={m.id} value={m.id}>{m.indexOrder}. {m.nome}</option>
                ))}
              </AnimatedSelect>
            </div>

            <div className="exInputGroup">
              <span className="exLabel">Fase</span>
              <AnimatedSelect
                className="exSelect"
                value={realocFaseId}
                onChange={(e) => setRealocFaseId(e.target.value)}
                disabled={!realocModuloId}
              >
                <option value="">{realocModuloId ? "Selecione uma fase" : "Selecione um módulo primeiro"}</option>
                {realocFases.map((f) => (
                  <option key={f.id} value={f.id}>Semana {f.weekNumber} - {f.nome}</option>
                ))}
              </AnimatedSelect>
            </div>
          </div>
        </Modal>
      </div >
    </DashboardLayout >
  );
}
