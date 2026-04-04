import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getUserId } from "../auth/auth";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import ConfirmModal from "../components/ConfirmModal";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import PaginatedSelect from "../components/PaginatedSelect";
import MultipleChoiceQuestion from "../components/Exercise/MultipleChoiceQuestion";
import MultipleChoiceQuestionEditor from "../components/Exercise/MultipleChoiceQuestionEditor";
import ExerciseAIDraftGenerator from "../components/ExerciseAIDraftGenerator";
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
  type Exercicio,
  type ExerciseAIDraft,
  type Curso,
  type Fase,
  type Modulo,
  type Turma,
  type User,
} from "../services/api";
import { useToastActions } from "../contexts/ToastContext";
import {
  normalizeListPayload,
  inferCategoriaFromCourseName,
  getTipoInfo,
  getAlunoIds,
  getAlunoNames,
  formatAlunoLabel,
  formatIsoToDateTimeLocal,
  createDefaultMultipleChoiceQuestion,
  parseDifficultyValue,
  buildMultiplaRegrasValue,
  getMultiplaQuestoesFromRegras,
  getExerciseEditorComponentType,
  mapDraftMultiplaQuestoes,
  collectRequiredFieldWarnings,
  mapAnswerStudentsToOptions,
  mapAnsweredExercisesToOptions,
  getRespostasDiretasKey,
  getRespostaDiretaValue,
  getRespostaDiretaLabel,
  parseRespostaDiretaNavState,
} from "./exercises/helpers";
import {
  pageContainerClass,
  panelClass,
  subtlePanelClass,
  sectionTitleClass,
  helperTextClass,
  fieldGroupClass,
  fieldLabelClass,
  fieldInputClass,
  fieldTextareaClass,
  fieldSelectClass,
  warningControlClass,
  warningTextClass,
  rowClass,
  compactRowClass,
  radioRowClass,
  secondaryButtonClass,
  primaryButtonClass,
  fieldWarnWrapClass,
  toggleGroupClass,
  toggleOptionClass,
  toggleDotClass,
  toggleDotInnerClass,
  courseSelectedClass,
  statusToggleClass,
  responseCardClass,
  responseBadgeClass,
  loadingStateClass,
  spinnerClass,
  emptyStateClass,
  emptyIconClass,
  emptyTitleClass,
  exerciseCardClass,
  exerciseTypePillClass,
  accessBadgeClass,
  turmaBadgeClass,
  modalBodyClass,
  modalFooterGhostButtonClass,
  modalFooterPrimaryButtonClass,
} from "./exercises/styles";
import type {
  CategoriaExercicio,
  RequiredFieldKey,
  InfoOverlayKey,
  ExerciseListViewItem,
  ExercisesVirtualWindow,
  RespostasAlunoOption,
  RespostasExercicioOption,
  RespostaDiretaOption,
} from "./exercises/types";


export default function ExerciciosPage() {
  const { addToast } = useToastActions();
  const navigate = useNavigate();
  const location = useLocation();
  const role = getRole() ?? "aluno";
  const userId = getUserId();
  const isStaff = role === "admin" || role === "professor";
  const canCreate = isStaff;
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </span>
  );

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
  }>>(() => [createDefaultMultipleChoiceQuestion()]);

  function updateCreateMultiplaQuestaoOpcao(qIndex: number, oIndex: number, value: string) {
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

  function updateCreateMultiplaQuestaoCorreta(qIndex: number, value: string) {
    setMultiplaQuestoes((prev) =>
      prev.map((questao, index) =>
        index !== qIndex ? questao : { ...questao, respostaCorreta: value }
      )
    );
  }

  function removeCreateMultiplaQuestao(qIndex: number) {
    setMultiplaQuestoes((prev) => prev.filter((_, index) => index !== qIndex));
  }

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
  void cursosToggleOrdenados;

  const cursosGratuitosDisponiveis = React.useMemo(
    () => cursosDisponiveis.filter((curso) => curso.isPaid !== true),
    [cursosDisponiveis]
  );

  const cursosToggleFiltrados = React.useMemo(() => {
    const termo = cursoCardsFiltro.trim().toLowerCase();
    if (!termo) return cursosGratuitosDisponiveis;
    return cursosGratuitosDisponiveis.filter((curso) => {
      const nome = curso.nome?.toLowerCase() ?? "";
      const descricao = curso.descricao?.toLowerCase() ?? "";
      return nome.includes(termo) || descricao.includes(termo);
    });
  }, [cursosGratuitosDisponiveis, cursoCardsFiltro]);
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
      setMultiplaQuestoes([createDefaultMultipleChoiceQuestion()]);
    }
  }

  function resetExerciseFormState(params?: { clearAttachments?: boolean }) {
    setFieldWarnings({});
    setTitulo("");
    setDescricao("");
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
    setMultiplaQuestoes([createDefaultMultipleChoiceQuestion()]);

    if (params?.clearAttachments) {
      setAnexosAtivo(false);
      setAnexoArquivo(null);
      setAnexoAtual(null);
    }
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

  function navegarParaRespostaDireta(exercicioId: string, alunoId: string, value: string) {
    if (!value) return;
    const { answerId, questionId } = parseRespostaDiretaNavState(value);
    navigate(`/dashboard/exercicios/${exercicioId}`, {
      state: {
        from: location.pathname,
        fromSection: "respostas",
        prefilterAlunoId: alunoId,
        prefilterAnswerId: answerId,
        prefilterQuestionId: questionId,
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
  }>>(() => [createDefaultMultipleChoiceQuestion()]);
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
        prazo,
        categoria,
        componenteInterativo,
        multiplaQuestoes,
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
        ...(tipoSelecionado ? { tipoExercicio: tipoSelecionado } : {}),
        multipla_regras: componenteInterativo === "multipla"
          ? buildMultiplaRegrasValue(multiplaQuestoes, descricaoFinal)
          : null,
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
          prazo,
          categoria,
          componenteInterativo,
          multiplaQuestoes,
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
    setEditAttrPrazo(formatIsoToDateTimeLocal(exercicio.prazo));
    setEditAttrVideoUrl(exercicio.videoUrl ?? "");
    setEditAttrDifficulty(exercicio.difficulty !== null && exercicio.difficulty !== undefined ? String(exercicio.difficulty) : "");
    setEditAttrIndexOrder(exercicio.indexOrder !== null && exercicio.indexOrder !== undefined ? String(exercicio.indexOrder) : "");
    setEditAttrPointsRedeem(exercicio.pointsRedeem !== null && exercicio.pointsRedeem !== undefined ? String(exercicio.pointsRedeem) : "");
    setEditAttrExercisePeriod(formatIsoToDateTimeLocal(exercicio.exercisePeriod));
    setEditAttrIsFinalExercise(exercicio.isFinalExercise === true);
    setEditAttrIsDailyTask(exercicio.isDailyTask === true);

    const componentType = getExerciseEditorComponentType(exercicio);
    setEditAttrComponenteInterativo(componentType);

    if (componentType === "multipla") {
      setEditAttrMultiplaQuestoes(getMultiplaQuestoesFromRegras(exercicio.multipla_regras));
    } else {
      setEditAttrComponenteInterativo("escrita");
      setEditAttrMultiplaQuestoes([createDefaultMultipleChoiceQuestion()]);
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
        multipla_regras: editAttrComponenteInterativo === "multipla"
          ? buildMultiplaRegrasValue(editAttrMultiplaQuestoes, descricaoFinal)
          : null,
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
    // A API já pagina a lista e o componente limita o page size a 50.
    // Virtualizar lotes tão pequenos trouxe glitches de scroll/layout.
    paginatedExercises.length > 80;

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
      <div className={pageContainerClass}>
        {/* HEADER COM BOTAO */}
        <div className="flex items-center justify-end">
          <button
            className={secondaryButtonClass}
            onClick={handleRefresh}
            disabled={loading}
            type="button"
          >
            {loading
              ? iconLabel(<Loader2 size={16} />, "Carregando...")
              : iconLabel(<RefreshCcw size={16} />, "Atualizar")}
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-[26px] border border-border/70 bg-card/90 p-3 shadow-[0_14px_30px_rgba(0,0,0,0.08)] sm:flex-row sm:items-center sm:justify-start sm:gap-4">
          <span className="inline-flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {iconLabel(<Eye size={14} />, "Exibir:")}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                activeSection === "lista"
                  ? "border-primary/55 bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(var(--primary-rgb),0.24)]"
                  : "border-border/70 bg-background/80 text-foreground hover:border-primary/35 hover:bg-accent"
              )}
              onClick={() => setActiveSection("lista")}
            >
              {iconLabel(<ListChecks size={14} />, "Exercicios")}
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                activeSection === "tarefa-diaria"
                  ? "border-primary/55 bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(var(--primary-rgb),0.24)]"
                  : "border-border/70 bg-background/80 text-foreground hover:border-primary/35 hover:bg-accent"
              )}
              onClick={() => setActiveSection("tarefa-diaria")}
            >
              {iconLabel(<Calendar size={14} />, "Tarefa diaria")}
            </button>
            {isStaff && (
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                  activeSection === "respostas"
                    ? "border-primary/55 bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(var(--primary-rgb),0.24)]"
                    : "border-border/70 bg-background/80 text-foreground hover:border-primary/35 hover:bg-accent"
                )}
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
            <div className={panelClass}>
              <h2 className={sectionTitleClass}>Editar exercicio</h2>

              <div className="mt-5 grid gap-5">
                <div className={fieldGroupClass}>
                  <span className={fieldLabelClass}>Nome do exercício *</span>
                  <input
                    className={cn(fieldInputClass, fieldWarnings.titulo && warningControlClass)}
                    placeholder="ex: Exercicio 15.3: Layout Responsivo"
                    value={titulo}
                    onChange={(e) => {
                      setTitulo(e.target.value);
                      clearFieldWarning("titulo");
                    }}
                  />
                  {fieldWarnings.titulo && <small className={warningTextClass}>{fieldWarnings.titulo}</small>}
                </div>

                <div className={fieldGroupClass}>
                  <span className={fieldLabelClass}>Pergunta *</span>
                  <textarea
                    className={cn(fieldTextareaClass, fieldWarnings.descricao && warningControlClass)}
                    placeholder="Descreva a pergunta do exercício em detalhes..."
                    value={descricao}
                    onChange={(e) => {
                      setDescricao(e.target.value);
                      clearFieldWarning("descricao");
                    }}
                  />
                  {fieldWarnings.descricao && <small className={warningTextClass}>{fieldWarnings.descricao}</small>}
                </div>

                {/* Temporariamente desativado: anexos */}
                {/* CATEGORIA - PROGRAMACAO vs INFORMATICA */}
                <div className={rowClass}>
                  <div className={cn(fieldGroupClass, "xl:col-span-3")}>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        className={fieldInputClass}
                        value={cursoCardsFiltro}
                        onChange={(e) => setCursoCardsFiltro(e.target.value)}
                        placeholder="Filtrar cursos por nome ou descrição"
                      />
                      {cursoCardsFiltro.trim() && (
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => setCursoCardsFiltro("")}
                        >
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
                              name="course_id"
                              value={curso.id}
                              checked={isAtivo}
                              onChange={() => handleSelecionarCurso(curso.id)}
                            />
                            <span className={toggleDotClass(isAtivo)} aria-hidden="true">
                              <span className={toggleDotInnerClass(isAtivo)} />
                            </span>
                            <span className="inline-flex items-center gap-2 text-sm font-medium">
                              {iconLabel(cursoCategoria === "informatica" ? <Monitor size={14} /> : <Laptop size={14} />, curso.nome)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {fieldWarnings.curso && <small className={warningTextClass}>{fieldWarnings.curso}</small>}
                    <div className="mt-3 flex flex-col gap-3">
                      <div className={courseSelectedClass(Boolean(cursoSelecionado))}>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {iconLabel(<BookOpen size={13} />, cursoSelecionado ? "Curso selecionado" : "Selecao de curso")}
                        </span>
                        <strong className="text-sm font-semibold text-foreground">
                          {cursoSelecionado ? cursoSelecionado.nome : "Selecione um curso para ver detalhes"}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => setMostrarDetalhesCurso((prev) => !prev)}
                        disabled={!cursoSelecionado}
                      >
                        {iconLabel(<Eye size={14} />, mostrarDetalhesCurso ? "Ocultar detalhes" : "Ver detalhes")}
                      </button>
                    </div>
                    {cursosToggleFiltrados.length === 0 && (
                      <small className={helperTextClass}>
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
                      <div className={cn(subtlePanelClass, "mt-3 grid gap-4")}>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="grid gap-1 rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                            <small className={fieldLabelClass}>Categoria</small>
                            <strong>
                              {inferCategoriaFromCourseName(cursoSelecionado?.nome) === "informatica" ? "Informática" : "Programação"}
                            </strong>
                          </div>
                          <div className="grid gap-1 rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                            <small className={fieldLabelClass}>Modelo</small>
                            <strong>{cursoSelecionado?.isPaid ? "Pago" : "Gratuito"}</strong>
                          </div>
                          <div className="grid gap-1 rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                            <small className={fieldLabelClass}>Módulos cadastrados</small>
                            <strong>{modulosDoCursoSelecionado.length}</strong>
                          </div>
                          <div className="grid gap-1 rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                            <small className={fieldLabelClass}>ID do curso</small>
                            <strong>{cursoSelecionado?.id}</strong>
                          </div>
                        </div>
                        {cursoSelecionado?.descricao && (
                          <p className="text-sm leading-6 text-muted-foreground">{cursoSelecionado.descricao}</p>
                        )}
                        {modulosDoCursoSelecionado.length > 0 && (
                          <div className="grid gap-2">
                            <small className={fieldLabelClass}>Trilha de modulos</small>
                            <div className="flex flex-wrap gap-2">
                              {modulosDoCursoSelecionado.slice(0, 5).map((modulo) => (
                                <span
                                  key={modulo.id}
                                  className="inline-flex items-center rounded-full border border-border/70 bg-background/75 px-3 py-1 text-xs font-semibold text-muted-foreground"
                                >
                                  {modulo.nome}
                                </span>
                              ))}
                              {modulosDoCursoSelecionado.length > 5 && (
                                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
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
                    <div className={fieldGroupClass}>
                      <span className={fieldLabelClass}>Tipo de Exercicio</span>
                      <div className={radioRowClass}>
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
                      <small className={helperTextClass}>
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
                                    updateCreateMultiplaQuestaoOpcao(qIndex, oIndex, value)
                                  }
                                  onChangeCorreta={(value) =>
                                    updateCreateMultiplaQuestaoCorreta(qIndex, value)
                                  }
                                  onRemoveQuestao={
                                    multiplaQuestoes.length > 1
                                      ? () => removeCreateMultiplaQuestao(qIndex)
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
                                <div key={`prog-preview-${idx}`}>
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

                {/* COMPONENTES INTERATIVOS - Apenas para Informatica */}
                {categoria === "informatica" && (
                  <>
                    <div className={fieldGroupClass}>
                      <span className={fieldLabelClass}>Componente Interativo</span>
                      <div className={radioRowClass}>
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
                      <small className={helperTextClass}>
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
                                updateCreateMultiplaQuestaoOpcao(qIndex, oIndex, value)
                              }
                              onChangeCorreta={(value) =>
                                updateCreateMultiplaQuestaoCorreta(qIndex, value)
                              }
                              onRemoveQuestao={
                                multiplaQuestoes.length > 1
                                  ? () => removeCreateMultiplaQuestao(qIndex)
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

                <div className={rowClass}>
                  <div className={cn(fieldGroupClass, "xl:col-span-3")}>
                    <span className={fieldLabelClass}>Curso selecionado *</span>
                    <div
                      className={cn(
                        "grid gap-2 rounded-[24px] border px-4 py-4",
                        cursoSelecionado
                          ? "border-border/70 bg-background/80"
                          : "border-border/60 bg-muted/25 text-muted-foreground"
                      )}
                    >
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
                    <small className={helperTextClass}>
                      Os módulos abaixo são filtrados automaticamente pelo curso selecionado.
                    </small>
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
                    {fieldWarnings.modulo && <small className={warningTextClass}>{fieldWarnings.modulo}</small>}
                  </div>

                  <div className={fieldGroupClass}>
                    <span className={fieldLabelClass}>Fase *</span>
                    <div className={fieldWarnWrapClass(Boolean(fieldWarnings.fase))}>
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
                    {fieldWarnings.fase && <small className={warningTextClass}>{fieldWarnings.fase}</small>}
                  </div>

                  <div className={fieldGroupClass}>
                    <span className={fieldLabelClass}>Prazo (Valido apenas nas tarefas diarias) *</span>
                    <input
                      className={cn(fieldInputClass, fieldWarnings.prazo && warningControlClass)}
                      type="datetime-local"
                      value={prazo}
                      onChange={(e) => {
                        setPrazo(e.target.value);
                        clearFieldWarning("prazo");
                      }}
                    />
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
                    <span className={fieldLabelClass}>Video URL</span>
                    <input
                      className={fieldInputClass}
                      type="url"
                      placeholder="https://..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                    <small className={helperTextClass}>
                      Link opcional de apoio para este exercicio.
                    </small>
                  </div>

                  <div className={fieldGroupClass}>
                    <span className={fieldLabelClass}>Dificuldade</span>
                    <AnimatedSelect
                      className={fieldSelectClass}
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      <option value="1">Normal</option>
                      <option value="2">Lower (Recuperação)</option>
                      <option value="3">Prova Semanal</option>
                    </AnimatedSelect>
                    <small className={helperTextClass}>
                      Escolha um nivel compativel com a validacao da API.
                    </small>
                  </div>

                  {/* Campo Ordem removido da criação conforme correções.md */}
                </div>

                <div className={compactRowClass}>
                  <div className={fieldGroupClass}>
                    <span className={fieldLabelClass}>Pontos de resgate</span>
                    <input
                      className={fieldInputClass}
                      type="number"
                      min="0"
                      placeholder="0"
                      value={pointsRedeem}
                      onChange={(e) => setPointsRedeem(e.target.value)}
                    />
                    <small className={helperTextClass}>
                      Pontos que o aluno recebe ao concluir o exercicio.
                    </small>
                  </div>

                  <div className={fieldGroupClass}>
                    <span className={fieldLabelClass}>Periodo do exercicio</span>
                    <input
                      className={fieldInputClass}
                      type="datetime-local"
                      value={exercisePeriod}
                      onChange={(e) => setExercisePeriod(e.target.value)}
                    />
                    <small className={helperTextClass}>
                      Data e hora de quando começou o exercício (opcional).
                    </small>
                  </div>
                </div>

                <div className={compactRowClass}>
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
                      <AnimatedToggle
                        checked={isFinalExercise}
                        onChange={setIsFinalExercise}
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">Exercicio final</span>
                        <span className="text-sm leading-6 text-muted-foreground">Marque se este for o exercicio de fechamento da fase.</span>
                      </span>
                    </div>
                  </div>
                  <div className={fieldGroupClass}>
                    <div
                      className={statusToggleClass(isDailyTask)}
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
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">Tarefas diárias</span>
                        <span className="text-sm leading-6 text-muted-foreground">Mostra este exercicio na aba de tarefa diaria.</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className={fieldGroupClass}>
                  <small className={helperTextClass}>
                    Acesso definido por fase no novo schema. Atribuicao por aluno/turma sera adicionada depois.
                  </small>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <AnimatedButton
                    className={primaryButtonClass}
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
                      className={secondaryButtonClass}
                      onClick={handleCancel}
                      disabled={saving}
                      style={{ flex: 1 }}
                    >
                      {iconLabel(<X size={16} />, "Cancelar")}
                    </AnimatedButton>
                  )}
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                  {iconLabel(<Lightbulb size={16} />, "Exercicios podem ser publicados para turmas, alunos especificos ou para todos.")}
                </div>
              </div>
            </div>
          </FadeInUp>
        )}

        {isStaff && activeSection === "respostas" && (
          <div className={panelClass}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={fieldInputClass}
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
                className={cn(fieldSelectClass, "min-w-[11rem]")}
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
              <div className={loadingStateClass}>
                <div className={spinnerClass} />
                Carregando usuarios...
              </div>
            ) : respostasAlunos.length === 0 ? (
              <div className={emptyStateClass}>Nenhum usuario respondeu ainda (tabela answer).</div>
            ) : (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-foreground">
                    {respostasAlunoPagination.total} usuario(s)
                  <span className="text-muted-foreground">
                    Pagina {respostasAlunoPagination.page} de {respostasAlunoPagination.totalPages}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
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
                        className={cn(
                          responseCardClass,
                          aberto && "border-sky-400/45 shadow-[0_14px_34px_rgba(37,99,235,0.18)]"
                        )}
                        style={studentAnimationStyle}
                      >
                        <button
                          type="button"
                          className="flex w-full flex-col gap-4 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
                          onClick={() => toggleRespostasAluno(aluno.id)}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="flex size-11 items-center justify-center rounded-2xl border border-sky-500/25 bg-sky-500/10 text-sm font-bold text-sky-100"
                              aria-hidden="true"
                            >
                              {initials || "A"}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-foreground">{aluno.nome}</div>
                              <div className="truncate text-sm text-muted-foreground">{aluno.email || "Sem e-mail/usuario"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            <div className="flex flex-wrap justify-end gap-2">
                              <span className={responseBadgeClass}>{aluno.totalRespostas} resposta(s)</span>
                              <span className={responseBadgeClass}>{aluno.totalExercicios} exercicio(s)</span>
                            </div>
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                              {aluno.lastAnsweredAt
                                ? `Ultima: ${new Date(aluno.lastAnsweredAt).toLocaleDateString("pt-BR")}`
                                : "Sem data"}
                            </span>
                          </div>
                          <span className="text-muted-foreground">
                            {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </button>

                        {aberto && (
                          <div className="grid gap-4 border-t border-sky-500/15 px-4 pb-4 pt-4">
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                              <input
                                className={fieldInputClass}
                                type="text"
                                placeholder="Filtrar exercicios deste usuario"
                                value={respostasExercicioFiltro}
                                onChange={(e) => {
                                  setRespostasExercicioFiltro(e.target.value);
                                  setRespostasExercicioPage(1);
                                }}
                              />
                              <select
                                className={cn(fieldSelectClass, "min-w-[11rem]")}
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
                              <div className={loadingStateClass}>
                                <div className={spinnerClass} />
                                Carregando exercicios...
                              </div>
                            ) : respostasExerciciosAluno.length === 0 ? (
                              <div className={emptyStateClass}>Este usuario ainda nao possui exercicios respondidos.</div>
                            ) : (
                              <div className="grid gap-3">
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
                                      className={cn(
                                        "rounded-[22px] border border-border/70 bg-background/70 transition",
                                        abertoExercicio && "border-primary/35 bg-primary/5"
                                      )}
                                      style={exerciseAnimationStyle}
                                    >
                                      <button
                                        type="button"
                                        className="flex w-full flex-col gap-4 px-4 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                                        onClick={() => setRespostaExercicioAbertoKey((prev) => (prev === directKey ? null : directKey))}
                                        aria-expanded={abertoExercicio}
                                      >
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-semibold text-foreground">{exercicio.titulo}</div>
                                          <div className="mt-1 text-sm text-muted-foreground">
                                            {[exercicio.modulo, exercicio.tema].filter(Boolean).join(" - ") || "Sem modulo/fase"}
                                          </div>
                                          <div className="mt-1 text-sm text-muted-foreground">
                                            {exercicio.lastAnsweredAt
                                              ? `Ultima resposta: ${new Date(exercicio.lastAnsweredAt).toLocaleString("pt-BR")}`
                                              : "Sem data"}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-auto">
                                          <span className={responseBadgeClass}>{exercicio.totalRespostas} resposta(s)</span>
                                          <span className={responseBadgeClass}>{respostasDiretas.length} listada(s)</span>
                                          <span className="text-muted-foreground">
                                            {abertoExercicio ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                          </span>
                                        </div>
                                      </button>

                                      {abertoExercicio && (
                                        <div className="grid gap-4 border-t border-border/60 px-4 pb-4 pt-4">
                                          {carregandoRespostasDiretas ? (
                                            <div className={loadingStateClass}>
                                              <div className={spinnerClass} />
                                              Carregando respostas...
                                            </div>
                                          ) : respostasDiretas.length === 0 ? (
                                            <div className={emptyStateClass}>Nenhuma resposta listada para este exercicio.</div>
                                          ) : (
                                            <div className="grid gap-2" role="listbox" aria-label="Respostas do exercicio">
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
                                                    className={cn(
                                                      "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition",
                                                      selecionada
                                                        ? "border-primary/40 bg-primary/10 text-foreground"
                                                        : "border-border/70 bg-background/80 text-muted-foreground hover:border-primary/30 hover:bg-accent hover:text-foreground"
                                                    )}
                                                    style={directRowAnimationStyle}
                                                    onClick={() => {
                                                      setSeletorRespostaDireta((prev) => ({ ...prev, [directKey]: value }));
                                                      navegarParaRespostaDireta(exercicio.id, aluno.id, value);
                                                    }}
                                                  >
                                                    <span className="font-medium">{getRespostaDiretaLabel(resposta)}</span>
                                                    {selecionada ? (
                                                      <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                                                        Selecionada
                                                      </span>
                                                    ) : null}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}

                                          <div className="flex justify-end">
                                            <button
                                              type="button"
                                              className={cn(secondaryButtonClass, "px-3 py-2 text-xs")}
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
                              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                <button
                                  type="button"
                                  className={cn(secondaryButtonClass, "px-3 py-2 text-xs")}
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
                                  className={cn(secondaryButtonClass, "px-3 py-2 text-xs")}
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

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  <button
                    type="button"
                    className={cn(secondaryButtonClass, "px-3 py-2 text-xs")}
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
                    className={cn(secondaryButtonClass, "px-3 py-2 text-xs")}
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
            <div className={cn(panelClass, "p-4 sm:p-5")}>
              {/* Linha 1: Busca por Titulo */}
              <div className="flex flex-col gap-3">
                <div className="min-w-0">
                  <input
                    className={fieldInputClass}
                    type="text"
                    placeholder={activeSection === "tarefa-diaria" ? "Buscar tarefa diaria..." : "Buscar por Titulo..."}
                    value={buscaFiltro}
                    onChange={(e) => {
                      setBuscaFiltro(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>

              {/* Linha 2: Modulo, Turmas, Status */}
              <div className="mt-3 flex flex-col gap-3 xl:flex-row">
                {/* Filtro de modulo */}
                <div className="xl:min-w-[10rem]">
                  <select
                    className={fieldSelectClass}
                    value={moduloFiltro}
                    onChange={(e) => {
                      setModuloFiltro(e.target.value);
                      setCurrentPage(1);
                    }}
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
                  <div className="xl:min-w-[12rem]">
                    <select
                      className={fieldSelectClass}
                      value={turmaFiltro}
                      onChange={(e) => {
                        setTurmaFiltro(e.target.value);
                        setCurrentPage(1);
                      }}
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
                  <div className="xl:min-w-[10rem]">
                    <select
                      className={fieldSelectClass}
                      value={statusFiltro}
                      onChange={(e) => {
                        setStatusFiltro(e.target.value as "todos" | "publicado" | "programado" | "rascunho");
                        setCurrentPage(1);
                      }}
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
                <div className={loadingStateClass}>
                  <div className={spinnerClass} />
                                Carregando exercicios...
                </div>
              ) : !loading && sourceItems.length === 0 ? (
                <div className={emptyStateClass}>
                  <div className={emptyIconClass}><BookOpen size={22} /></div>
                  <div className={emptyTitleClass}>Nenhum Exercicio Disponivel</div>
                  <p className="m-0 text-sm text-muted-foreground">
                    Volte mais tarde para novos Exercicios!
                  </p>
                </div>
              ) : (
                <>
                  {/* Filtros e Paginacao */}
                  <div className="mb-4">
                    {totalItemsSection === 0 ? (
                      <div className={emptyStateClass}>
                        <div className={emptyIconClass}><BookOpen size={22} /></div>
                        <div className={emptyTitleClass}>
                          {activeSection === "tarefa-diaria"
                            ? "Nenhuma tarefa diaria encontrada"
                            : "Nenhum Exercicio encontrado"}
                        </div>
                        <p className="m-0 text-sm text-muted-foreground">
                          {activeSection === "tarefa-diaria"
                            ? "Nenhuma tarefa diaria foi retornada do banco para os filtros selecionados."
                            : "Ajuste os filtros e tente naovamente."}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4" ref={exercisesListVirtualHostRef}>
                          {shouldVirtualizeExercises && exercisesVirtualWindow && exercisesVirtualWindow.topSpacerHeight > 0 && (
                            <div
                              style={{ height: exercisesVirtualWindow.topSpacerHeight }}
                              aria-hidden="true"
                            />
                          )}
                          <div className="grid gap-4 xl:grid-cols-2" ref={exercisesListGridRef}>
                            {visibleExercises.map((item, visibleIndex) => {
                            const { ex, alunoIds, hasAlunoAssignment, publishedAtMs, prazoMs } = item;
                            const alunoNames = hasAlunoAssignment ? getAlunoNames(ex, alunoNameById) : [];
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
                                className={exerciseCardClass(canCreate)}
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
                                    e.preventDefault();
                                    navigate(`/dashboard/exercicios/${ex.id}`, {
                                      state: {
                                        from: location.pathname,
                                        fromSection: activeSection,
                                      },
                                    });
                                  }
                                }}
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start gap-2">
                                      <h3 className="text-lg font-semibold text-foreground">{ex.titulo}</h3>
                                      {isStaff && isDraft && (
                                        <span
                                          className="inline-flex items-center rounded-full border border-slate-500/30 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-300"
                                          title="Rascunho - nao visivel para alunos"
                                        >
                                          Rascunho
                                        </span>
                                      )}
                                      {isStaff && !isDraft && isScheduled && (
                                        <span
                                          className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200"
                                          title="Exercicio programado para Publicacao"
                                        >
                                          Programado
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <span className={exerciseTypePillClass(tipoInfo.className)}>{tipoInfo.label}</span>
                                      <span className="inline-flex items-center rounded-full border border-border/70 bg-background/75 px-3 py-1 text-xs font-semibold text-muted-foreground">
                                        {ex.modulo}
                                      </span>
                                      <span className="inline-flex items-center rounded-full border border-border/70 bg-background/75 px-3 py-1 text-xs font-semibold text-muted-foreground">
                                        {ex.tema?.trim() ? ex.tema : "Sem fase"}
                                      </span>
                                      {ex.containerName && (
                                        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                                          {ex.containerName}{ex.containerDay ? ` (Dia ${ex.containerDay})` : ""}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-3 lg:items-end">
                                      <div className="flex items-center">
                                        <div
                                          className={cn(
                                            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                                            isOverdue
                                              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                                              : "border-border/70 bg-background/75 text-muted-foreground"
                                          )}
                                        >
                                        {prazoLabel}
                                      </div>
                                    </div>

                                    {canCreate && (
                                      <div className="flex items-center gap-2">
                                        <button
                                          className={cn(secondaryButtonClass, "px-3 py-2")}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            abrirModalEditOpcoes(ex);
                                          }}
                                          title="Editar Exercicio"
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button
                                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15"
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

                                <div className="grid gap-2 rounded-[24px] border border-border/70 bg-muted/20 p-4">
                                  <div className={fieldLabelClass}>Pergunta</div>
                                  <p className="text-sm leading-6 text-muted-foreground">{ex.descricao?.trim() || "Sem enunciado cadastrado."}</p>
                                </div>

                                {/* Badges de acesso/turmas */}
                                <div className="flex flex-wrap gap-2">
                                  {hasAlunoAssignment ? (
                                    <span className={accessBadgeClass("aluno")} title={alunoTitle}>
                                      {iconLabel(<UserIcon size={12} />, alunoLabel)}
                                    </span>
                                  ) : ex.turmas && ex.turmas.length > 0 ? (
                                    <>
                                      <span className={accessBadgeClass("turmas")}>
                                        {iconLabel(<Landmark size={12} />, `${ex.turmas.length} turma${ex.turmas.length > 1 ? "s" : ""}`)}
                                      </span>
                                      {ex.turmas.map((turma) => (
                                        <span
                                          key={turma.id}
                                          className={turmaBadgeClass(turma.tipo)}
                                          title={`${turma.tipo}: ${turma.nome}`}
                                        >
                                          {turma.nome}
                                        </span>
                                      ))}
                                    </>
                                  ) : (
                                    <span className={accessBadgeClass("all")} title="Disponivel para todos os alunos">
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
          footer={<AnimatedButton className={primaryButtonClass} onClick={() => setInfoOverlay(null)}>Entendi</AnimatedButton>}
        >
          {infoOverlay === "dificuldade" ? (
            <div className={modalBodyClass}>
              <p>A dificuldade minima e 1.</p>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>1 = Facil</li>
                <li>2 = Medio</li>
                <li>3 = Dificil</li>
              </ul>
              <p className="text-xs leading-5 text-muted-foreground">Use 4 ou mais apenas para exercicios avancados.</p>
            </div>
          ) : (
            <div className={modalBodyClass}>
              <p>A ordem define a posicao do exercicio dentro da mesma fase/modulo.</p>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
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
          <div className={modalBodyClass}>
            <p className="text-sm text-muted-foreground">
              O que deseja fazer com este exercício?
            </p>
            <AnimatedButton
              className={primaryButtonClass}
              onClick={handleEscolherEditar}
            >
              {iconLabel(<PenLine size={16} />, "Editar Exercício")}
            </AnimatedButton>
            <small className={helperTextClass}>
              Alterar título, descrição, tipo, dificuldade e demais atributos.
            </small>
            <AnimatedButton
              className={secondaryButtonClass}
              onClick={handleEscolherRealocar}
            >
              {iconLabel(<RefreshCcw size={16} />, "Realocar Exercício")}
            </AnimatedButton>
            <small className={helperTextClass}>
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
                className={modalFooterGhostButtonClass}
                onClick={fecharModalEditarAtributos}
              >
                Cancelar
              </AnimatedButton>
              <AnimatedButton
                className={modalFooterPrimaryButtonClass}
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
          <div className={modalBodyClass}>
            {editAttrErro && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{editAttrErro}</div>
            )}

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Título</span>
              <input
                className={fieldInputClass}
                value={editAttrTitulo}
                onChange={(e) => setEditAttrTitulo(e.target.value)}
                placeholder="Título do exercício"
              />
            </div>

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Descrição</span>
              <textarea
                className={fieldTextareaClass}
                value={editAttrDescricao}
                onChange={(e) => setEditAttrDescricao(e.target.value)}
                placeholder="Descrição do exercício"
                rows={3}
              />
            </div>

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Tipo de componente</span>
              <div className={radioRowClass}>
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
              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Questões</span>
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
                  className={secondaryButtonClass}
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

            <div className={compactRowClass}>
              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Prazo</span>
                <input
                  className={fieldInputClass}
                  type="datetime-local"
                  value={editAttrPrazo}
                  onChange={(e) => setEditAttrPrazo(e.target.value)}
                />
              </div>
              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Dificuldade</span>
                <AnimatedSelect
                  className={fieldSelectClass}
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

            <div className={compactRowClass}>
              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Ordem</span>
                <input
                  className={fieldInputClass}
                  type="number"
                  min={1}
                  value={editAttrIndexOrder}
                  onChange={(e) => setEditAttrIndexOrder(e.target.value)}
                  placeholder="Ex: 1"
                />
              </div>
              <div className={fieldGroupClass}>
                <span className={fieldLabelClass}>Pontos</span>
                <input
                  className={fieldInputClass}
                  type="number"
                  min={0}
                  value={editAttrPointsRedeem}
                  onChange={(e) => setEditAttrPointsRedeem(e.target.value)}
                  placeholder="Ex: 100"
                />
              </div>
            </div>

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>URL do Vídeo</span>
              <input
                className={fieldInputClass}
                value={editAttrVideoUrl}
                onChange={(e) => setEditAttrVideoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Período do exercício</span>
              <input
                className={fieldInputClass}
                type="datetime-local"
                value={editAttrExercisePeriod}
                onChange={(e) => setEditAttrExercisePeriod(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <AnimatedToggle
                  checked={editAttrIsFinalExercise}
                  onChange={() => setEditAttrIsFinalExercise(!editAttrIsFinalExercise)}
                />
                Exercício final
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
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
                className={modalFooterGhostButtonClass}
                onClick={fecharModalRealocar}
              >
                Cancelar
              </AnimatedButton>
              <AnimatedButton
                className={modalFooterPrimaryButtonClass}
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
          <div className={modalBodyClass}>
            <p className="m-0 text-sm text-muted-foreground">
              Selecione o novo destino para o exercício.
            </p>

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Curso</span>
              <AnimatedSelect
                className={fieldSelectClass}
                value={realocCursoId}
                onChange={(e) => handleRealocCursoChange(e.target.value)}
              >
                <option value="">Selecione um curso</option>
                {realocCursos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </AnimatedSelect>
            </div>

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Módulo</span>
              <AnimatedSelect
                className={fieldSelectClass}
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

            <div className={fieldGroupClass}>
              <span className={fieldLabelClass}>Fase</span>
              <AnimatedSelect
                className={fieldSelectClass}
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
