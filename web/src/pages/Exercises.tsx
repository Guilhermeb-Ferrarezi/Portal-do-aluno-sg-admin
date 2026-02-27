import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserId } from "../auth/auth";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import ConfirmModal from "../components/ConfirmModal";
import Pagination from "../components/Pagination";
import PaginatedSelect from "../components/PaginatedSelect";
import MultipleChoiceQuestion from "../components/Exercise/MultipleChoiceQuestion";
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
  XCircle,
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
import "./Exercises.css";


export default function ExerciciosPage() {
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
  const [publishnaow, setPublishnaow] = React.useState(true); // Publicar agora ou agendar
  const [publishedAt, setPublishedAt] = React.useState(""); // datetime-local
  const [categoria, setCategoria] = React.useState<CategoriaExercicio>("programacao");
  const [componenteInterativo, setComponenteInterativo] = React.useState("escrita"); // temporario: apenas escrita e multipla
  // Regras para Multipla Escolha
  const [multiplaQuestoes, setMultiplaQuestoes] = React.useState<Array<{
    pergunta: string;
    opcoes: Array<{ letter: string; text: string }>;
    respostaCorreta: string;
  }>>(() => getDefaultMultiplaQuestoes());
  const [permitirRepeticao, setPermitirRepeticao] = React.useState(false);
  const [maxTentativas, setMaxTentativas] = React.useState<string>("");
  const [penalidadeTentativa, setPenalidadeTentativa] = React.useState<string>("");
  const [intervaloReenvio, setIntervaloReenvio] = React.useState<string>("");
  const [anexosAtivo, setAnexosAtivo] = React.useState(false);
  const [anexoArquivo, setAnexoArquivo] = React.useState<File | null>(null);
  const [anexoAtual, setAnexoAtual] = React.useState<{ url: string; nome: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<"criar" | "lista" | "tarefa-diaria" | "respostas">("lista");
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
  const [statusFiltro, setStatusFiltro] = React.useState("todos");

  // Alunos
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);

  // Paginacao
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);

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

  const cursosToggleOrdenados = cursosDisponiveis;
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

  function applyPublicationStateFromExercise(exercicio: Exercicio) {
    const publicationDateLocal = toDatetimeLocal(exercicio.publishedAt);
    if (!publicationDateLocal) {
      setPublishnaow(exercicio.publicado !== false);
      setPublishedAt("");
      return;
    }

    const publicationDate = new Date(exercicio.publishedAt as string);
    if (!Number.isNaN(publicationDate.getTime()) && publicationDate > new Date()) {
      setPublishnaow(false);
      setPublishedAt(publicationDateLocal);
      return;
    }

    setPublishnaow(exercicio.publicado !== false);
    setPublishedAt("");
  }

  function resetExerciseFormState(params?: { clearAttachments?: boolean }) {
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
    setPublishnaow(true);
    setPublishedAt("");
    setCategoria("programacao");
    setComponenteInterativo("escrita");
    setPermitirRepeticao(false);
    setMaxTentativas("");
    setPenalidadeTentativa("");
    setIntervaloReenvio("");
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

  async function load() {
    try {
      setLoading(true);
      setErro(null);
      const data = await listarExercicios();
      setItems(data.filter((ex) => ex.isDailyTask !== true));
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
      const data = await listarTarefasDiarias();
      setDailyItems(data.filter((ex) => ex.isDailyTask !== false));
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
    load();

    // Carregar turmas e alunos disponiveis se for professor/admin
    if (canCreate) {
      listarCursos()
        .then(setCursosDisponiveis)
        .catch((e) => console.error("Erro ao carregar cursos:", e));

      listarModulos()
        .then((modulos) => {
          setTodosModulosDisponiveis(modulos);
        })
        .catch((e) => console.error("Erro ao carregar modulos:", e));

      listarTurmas()
        .then(setTurmasDisponiveis)
        .catch((e) => console.error("Erro ao carregar turmas:", e));

      listarAlunos()
        .then(setAlunosDisponiveis)
        .catch((e) => console.error("Erro ao carregar alunos:", e));
    }
  }, []);

  React.useEffect(() => {
    if (!cursoIdSelecionado) {
      setModulosDisponiveis([]);
      setModuloIdSelecionado("");
      setFasesDisponiveis([]);
      setFaseIdSelecionada("");
      return;
    }

    listarModulosPorCurso(cursoIdSelecionado)
      .then((modulos) => {
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
      .then((fases) => {
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
    if (activeSection === "tarefa-diaria") {
      void loadDailyTasks();
    }
  }, [activeSection]);

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

      let descricaoFinal = descricao.trim();
      let tituloFinal = titulo.trim();

      const tipoSelecionado: "escrita" | "multipla" =
        componenteInterativo === "multipla" ? "multipla" : "escrita";

      const maxTentativasNum = maxTentativas.trim() ? Number(maxTentativas) : null;
      const penalidadeNum = penalidadeTentativa.trim() ? Number(penalidadeTentativa) : 0;
      const intervaloNum = intervaloReenvio.trim() ? Number(intervaloReenvio) : null;
      const dificuldadeNum = difficulty.trim() ? Number(difficulty) : null;
      const ordemNum = indexOrder.trim() ? Number(indexOrder) : null;
      const pontosNum = pointsRedeem.trim() ? Number(pointsRedeem) : null;
      const videoUrlLimpa = videoUrl.trim();
      const courseIdNum = Number(cursoIdSelecionado);
      const phaseIdNum = Number(faseIdSelecionada);

      if (difficulty.trim() && (!Number.isInteger(dificuldadeNum) || Number(dificuldadeNum) < 0)) {
        setErro("Dificuldade deve ser um numero inteiro maior ou igual a 0.");
        setSaving(false);
        return;
      }
      if (indexOrder.trim() && (!Number.isInteger(ordemNum) || Number(ordemNum) < 0)) {
        setErro("Ordem deve ser um numero inteiro maior ou igual a 0.");
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
          // eslint-disable-next-line no-new
          new URL(videoUrlLimpa);
        } catch {
          setErro("Video URL invalida.");
          setSaving(false);
          return;
        }
      }

      if (!Number.isFinite(phaseIdNum) || phaseIdNum <= 0) {
        setErro("Selecione uma fase valida antes de salvar.");
        setSaving(false);
        return;
      }
      if (!Number.isFinite(courseIdNum) || courseIdNum <= 0) {
        setErro("Selecione um curso valido antes de salvar.");
        setSaving(false);
        return;
      }

      const moduloNome = moduloSelecionado?.nome?.trim() ?? "";
      const faseNome = faseSelecionada?.nome?.trim() ?? null;
      if (!moduloNome) {
        setErro("Selecione um modulo valido antes de salvar.");
        setSaving(false);
        return;
      }

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
        publicado: publishnaow,
        published_at: publishnaow ? null : (publishedAt ? new Date(publishedAt).toISOString() : null),
        categoria: categoria,
        ...(gabaritoLimpo && categoria === "programacao" ? { gabarito: gabaritoLimpo } : {}),
        ...(tipoSelecionado ? { tipoExercicio: tipoSelecionado } : {}),
        ...(componenteInterativo === "multipla" ? {
          multipla_regras: JSON.stringify({ Questoes: multiplaQuestoes })
        } : {}),
        permitir_repeticao: permitirRepeticao,
        max_tentativas: permitirRepeticao ? maxTentativasNum : null,
        penalidade_por_tentativa: permitirRepeticao ? penalidadeNum : 0,
        intervalo_reenvio: permitirRepeticao ? intervaloNum : null,
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
        setOkMsg("Exercicio criado!");
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
      setErro(e instanceof Error ? e.message : "Erro ao salvar Exercicio");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(exercicio: Exercicio) {
    setActiveSection("criar");
    setTitulo(exercicio.titulo);
    setDescricao(exercicio.descricao);
    setGabarito("");
    setAnexosAtivo(!!exercicio.anexoUrl);
    setAnexoArquivo(null);
    setAnexoAtual(
      exercicio.anexoUrl ? { url: exercicio.anexoUrl, nome: exercicio.anexoNome || "Anexo" } : null
    );
    const moduloNormalizado = (exercicio.modulo || "").trim().toLowerCase();
    const origemModulos =
      todosModulosDisponiveis.length > 0 ? todosModulosDisponiveis : modulosDisponiveis;
    const moduloEncontrado =
      origemModulos.find((m) => m.nome.trim().toLowerCase() === moduloNormalizado) ??
      origemModulos.find((m) => m.nome.trim().toLowerCase().includes(moduloNormalizado));
    setCursoIdSelecionado(moduloEncontrado?.courseId ?? "");
    setModuloIdSelecionado(moduloEncontrado?.id ?? "");
    setFaseIdSelecionada(exercicio.phaseId ? String(exercicio.phaseId) : "");
    setVideoUrl(exercicio.videoUrl ?? "");
    setDifficulty(exercicio.difficulty !== null && exercicio.difficulty !== undefined ? String(exercicio.difficulty) : "");
    setIndexOrder(exercicio.indexOrder !== null && exercicio.indexOrder !== undefined ? String(exercicio.indexOrder) : "");
    setPointsRedeem(
      exercicio.pointsRedeem !== null && exercicio.pointsRedeem !== undefined
        ? String(exercicio.pointsRedeem)
        : ""
    );
    setExercisePeriod(toDatetimeLocal(exercicio.exercisePeriod));
    setIsFinalExercise(exercicio.isFinalExercise === true);
    setIsDailyTask(exercicio.isDailyTask === true);

    // Converter data de ISO para formato datetime-local
    setPrazo(toDatetimeLocal(exercicio.prazo));

    applyPublicationStateFromExercise(exercicio);

    // Restaurar categoria
    setCategoria(exercicio.categoria || "programacao");

    if (exercicio.multipla_regras) {
      setComponenteInterativo("multipla");
      try {
        const regras = JSON.parse(exercicio.multipla_regras);
        const questoes = Array.isArray(regras?.Questoes) ? regras.Questoes : [];
        setMultiplaQuestoes(questoes.length > 0 ? questoes : getDefaultMultiplaQuestoes());
      } catch (e) {
        console.error("Erro ao parsear multipla_regras:", e);
        setComponenteInterativo("escrita");
        setMultiplaQuestoes(getDefaultMultiplaQuestoes());
      }
    } else {
      setComponenteInterativo("escrita");
      setMultiplaQuestoes(getDefaultMultiplaQuestoes());
    }

    setPermitirRepeticao(exercicio.permitir_repeticao ?? false);
    setMaxTentativas(exercicio.maxTentativas ? String(exercicio.maxTentativas) : "");
    setPenalidadeTentativa(
      exercicio.penalidadePorTentativa !== null && exercicio.penalidadePorTentativa !== undefined
        ? String(exercicio.penalidadePorTentativa)
        : ""
    );
    setIntervaloReenvio(exercicio.intervaloReenvio ? String(exercicio.intervaloReenvio) : "");

    setEditandoId(exercicio.id);
    setOkMsg(null);
    setErro(null);

    // Scroll ate o formulario
    setTimeout(() => {
      const formElement = document.querySelector(".createExerciseCard");
      formElement?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
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

  // Validacao especial para componentes interativos
  const isInteractiveComponentInformatica = categoria === "informatica" && componenteInterativo !== "";
  const disabled =
    saving ||
    !cursoIdSelecionado ||
    !moduloIdSelecionado ||
    !faseIdSelecionada ||
    (!isInteractiveComponentInformatica && titulo.trim().length < 2) ||
    (!isInteractiveComponentInformatica && descricao.trim().length < 2) ||
    (componenteInterativo === "multipla" && multiplaQuestoes.some(q => !q.pergunta || !q.respostaCorreta || q.opcoes.some(o => !o.text)));

  const sourceItems = activeSection === "tarefa-diaria" ? dailyItems : items;

  function handleRefresh() {
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
          <span className="exercisesTabsLabel">Exibir:</span>
          <div className="exercisesTabsGroup">
            {canCreate && (
              <button
                type="button"
                className={`exercisesTab ${activeSection === "criar" ? "active" : ""}`}
                onClick={() => setActiveSection("criar")}
              >
                Criar exercicios
              </button>
            )}
            <button
              type="button"
              className={`exercisesTab ${activeSection === "lista" ? "active" : ""}`}
              onClick={() => setActiveSection("lista")}
            >
              Exercicios
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
        {erro && (
          <div className="exMessage error">
            <span>
              <XCircle size={16} />
            </span>
            <span>{erro}</span>
          </div>
        )}

        <AnimatedToast
          message={okMsg}
          type="success"
          duration={3000}
          onClose={() => setOkMsg(null)}
        />



        {/* SECAO DE CRIAR */}
        {canCreate && activeSection === "criar" && (
          <FadeInUp duration={0.28}>
            <div className="createExerciseCard">
              <h2 className="exFormTitle">Criar novo exercicio</h2>

              <div className="exFormGrid">
                <div className="exInputGroup">
                  <label className="exLabel">Titulo *</label>
                  <input
                    className="exInput"
                    placeholder="ex: Exercicio 15.3: Layout Responsivo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>

                <div className="exInputGroup">
                  <label className="exLabel">Descricao *</label>
                  <textarea
                    className="exTextarea"
                    placeholder="Descreva o exercicio em detalhes..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
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
                    <div className="exToggleGroup">
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
                    <div className="exCourseCardsActions">
                      <div className={`exCourseCardsSelected ${cursoSelecionado ? "" : "isEmpty"}`}>
                        {cursoSelecionado
                          ? `Selecionado: ${cursoSelecionado.nome}`
                          : "Selecione um curso para ver detalhes"}
                      </div>
                      <button
                        type="button"
                        className="exCourseDetailsBtn"
                        onClick={() => setMostrarDetalhesCurso((prev) => !prev)}
                        disabled={!cursoSelecionado}
                      >
                        {mostrarDetalhesCurso ? "Ocultar detalhes" : "Ver detalhes"}
                      </button>
                    </div>
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
                          <p className="exCourseModulesPreview">
                            {modulosDoCursoSelecionado
                              .slice(0, 5)
                              .map((modulo) => modulo.nome)
                              .join(" • ")}
                            {modulosDoCursoSelecionado.length > 5 ? " • ..." : ""}
                          </p>
                        )}
                      </div>
                    </ConditionalFieldAnimation>
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
                  </div>
                </div>

                {/* COMPONENTES INTERATIVOS - Para Programacao */}
                {categoria === "programacao" && (
                  <>
                    <div className="exInputGroup">
                      <label className="exLabel">Tipo de Exercicio</label>
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
                    {componenteInterativo === "escrita" && (
                      <ScaleIn>
                        <div className="exInputGroup">
                          <label className="exLabel">Resposta/Gabarito Esperado</label>
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

                    {/* QUESTOES DE MULTIPLA ESCOLHA - Para Programacao */}
                    {componenteInterativo === "multipla" && (
                      <ScaleIn>
                        <>
                          <div style={{ background: "var(--background-secondary)", border: "1px solid #fcd34d", borderRadius: "8px", padding: "14px", marginTop: "12px" }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", margin: "0 0 12px 0" }}>
                              {iconLabel(<ListChecks size={14} />, "Configurar Questoes de Multipla Escolha:")}
                            </p>

                            {multiplaQuestoes.map((questao, qIndex) => (
                              <div key={qIndex} style={{ background: "var(--card)", padding: "12px", borderRadius: "6px", marginBottom: "12px", border: "1px solid #fde68a" }}>
                                <h4 style={{ margin: "0 0 8px 0", fontSize: 13 }}>Questao {qIndex + 1}</h4>

                                <div style={{ marginBottom: "8px" }}>
                                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Pergunta:</label>
                                  <input
                                    className="exInput"
                                    type="text"
                                    value={questao.pergunta}
                                    onChange={(e) => {
                                      const naovas = [...multiplaQuestoes];
                                      naovas[qIndex].pergunta = e.target.value;
                                      setMultiplaQuestoes(naovas);
                                    }}
                                    placeholder="Digite a pergunta"
                                  />
                                </div>

                                <div style={{ marginBottom: "8px" }}>
                                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Opcoes:</label>
                                  {questao.opcoes.map((opcao, oIndex) => (
                                    <input
                                      key={oIndex}
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
                                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Resposta Correta:</label>
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
                              <div key={idx} style={{ marginBottom: "16px" }}>
                                <MultipleChoiceQuestion
                                  question={`Q${idx + 1}: ${questao.pergunta}`}
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
                  </>
                )}

                {/* COMPONENTES INTERATIVOS - Apenas para Informatica */}
                {categoria === "informatica" && (
                  <>
                    <div className="exInputGroup">
                      <label className="exLabel">Componente Interativo</label>
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
                    {componenteInterativo === "escrita" && (
                      <ScaleIn>
                        <div className="exInputGroup">
                          <label className="exLabel">Resposta/Gabarito Esperado</label>
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
                          <div key={qIndex} style={{
                            background: "var(--card)",
                            border: "1px solid var(--line)",
                            borderRadius: "8px",
                            padding: "16px",
                            marginBottom: "16px",
                          }}>
                            <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1f2937" }}>
                              Questao {qIndex + 1}
                            </h4>

                            {/* Campo de pergunta */}
                            <div style={{ marginBottom: "12px" }}>
                              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
                                Pergunta
                              </label>
                              <input
                                type="text"
                                placeholder="Digite a pergunta..."
                                value={questao.pergunta}
                                onChange={(e) => {
                                  const naovaQuestoes = [...multiplaQuestoes];
                                  naovaQuestoes[qIndex].pergunta = e.target.value;
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

                            {/* Campos de opcoes */}
                            {questao.opcoes.map((opcao, oIndex) => (
                              <div key={oIndex} style={{ marginBottom: "12px" }}>
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
                        {multiplaQuestoes.length > 0 && multiplaQuestoes[0].pergunta && (
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
                              question={`Q1: ${multiplaQuestoes[0].pergunta}`}
                              options={multiplaQuestoes[0].opcoes}
                              onAnswer={() => { }}
                            />
                          </div>
                        )}
                      </div>
                    </ConditionalFieldAnimation>
                  </>
                )}

                {/* PERMITIR repeticao */}
                <div className="exInputRow">
                  <div className="exInputGroup">
                    <label className="exLabel" style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", cursor: "pointer" }}>
                      <AnimatedToggle
                        checked={permitirRepeticao}
                        onChange={setPermitirRepeticao}
                      />
                      Permitir repeticao
                    </label>
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Se ativado, alunos podem enviar multiplas respostas
                    </small>
                  </div>
                </div>

                {permitirRepeticao && (
                  <div className="exInputRow">
                    <div className="exInputGroup">
                      <label className="exLabel">Max. Tentativas</label>
                      <input
                        className="exInput"
                        type="number"
                        min="1"
                        placeholder="Ilimitado"
                        value={maxTentativas}
                        onChange={(e) => setMaxTentativas(e.target.value)}
                      />
                    </div>
                    <div className="exInputGroup">
                      <label className="exLabel">Penalidade por tentativa (%)</label>
                      <input
                        className="exInput"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={penalidadeTentativa}
                        onChange={(e) => setPenalidadeTentativa(e.target.value)}
                      />
                    </div>
                    <div className="exInputGroup">
                      <label className="exLabel">Intervalo entre tentativas (min)</label>
                      <input
                        className="exInput"
                        type="number"
                        min="1"
                        placeholder="Sem intervalo"
                        value={intervaloReenvio}
                        onChange={(e) => setIntervaloReenvio(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="exInputRow">
                  <div className="exInputGroup">
                    <label className="exLabel">Curso selecionado *</label>
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
                    <label className="exLabel">Modulo *</label>
                    <PaginatedSelect
                      value={moduloIdSelecionado}
                      onChange={(value) => {
                        setModuloIdSelecionado(value);
                        setFaseIdSelecionada("");
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

                  <div className="exInputGroup">
                    <label className="exLabel">Fase *</label>
                    <PaginatedSelect
                      value={faseIdSelecionada}
                      onChange={setFaseIdSelecionada}
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

                  <div className="exInputGroup">
                    <label className="exLabel">Prazo</label>
                    <input
                      className="exInput"
                      type="datetime-local"
                      value={prazo}
                      onChange={(e) => setPrazo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="exInputRow">
                  <div className="exInputGroup">
                    <label className="exLabel">Video URL</label>
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
                    <label className="exLabel">Dificuldade</label>
                    <input
                      className="exInput"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    />
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Nivel numerico para classificar dificuldade.
                    </small>
                  </div>

                  <div className="exInputGroup">
                    <label className="exLabel">Ordem</label>
                    <input
                      className="exInput"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={indexOrder}
                      onChange={(e) => setIndexOrder(e.target.value)}
                    />
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Posicao manual na lista da fase (menor vem primeiro).
                    </small>
                  </div>
                </div>

                <div className="exInputRow">
                  <div className="exInputGroup">
                    <label className="exLabel">Pontos de resgate</label>
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
                    <label className="exLabel">Periodo do exercicio</label>
                    <input
                      className="exInput"
                      type="datetime-local"
                      value={exercisePeriod}
                      onChange={(e) => setExercisePeriod(e.target.value)}
                    />
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Data/hora de referencia do periodo (opcional).
                    </small>
                  </div>
                </div>

                <div className="exInputRow">
                  <div className="exInputGroup">
                    <label className="exLabel" style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", cursor: "pointer" }}>
                      <AnimatedToggle
                        checked={isFinalExercise}
                        onChange={setIsFinalExercise}
                      />
                      Exercicio final
                    </label>
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Marque se este for o exercicio de fechamento da fase.
                    </small>
                  </div>
                  <div className="exInputGroup">
                    <label className="exLabel" style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", cursor: "pointer" }}>
                      <AnimatedToggle
                        checked={isDailyTask}
                        onChange={setIsDailyTask}
                      />
                      Tarefa diaria
                    </label>
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Mostra este exercicio na aba de tarefa diaria.
                    </small>
                  </div>
                </div>

                {/* AGENDAMENTO DE Publicacao */}
                <div className="exInputRow">
                  <div className="exInputGroup">
                    <label className="exLabel" style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", cursor: "pointer" }}>
                      <AnimatedToggle
                        checked={publishnaow}
                        onChange={setPublishnaow}
                      />
                      Publicar agora
                    </label>
                  </div>
                </div>

                <ConditionalFieldAnimation isVisible={!publishnaow}>
                  <div className="exInputRow">
                    <div className="exInputGroup" style={{ cursor: "pointer" }}>
                      <label className="exLabel" style={{ cursor: "pointer" }}>{iconLabel(<Calendar size={14} />, "Agendar Publicacao")}</label>
                      <input
                        className="exInput"
                        type="datetime-local"
                        value={publishedAt}
                        onChange={(e) => setPublishedAt(e.target.value)}
                        required={!publishnaow}
                        style={{ cursor: "pointer" }}
                      />
                      <small style={{ color: "#666", marginTop: "4px" }}>
                        O Exercicio sera visivel a partir dessa data e hora
                      </small>
                    </div>
                  </div>
                </ConditionalFieldAnimation>

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
                  {respostasAlunos.map((aluno) => {
                    const aberto = respostasAlunoAbertoId === aluno.id;
                    const initials = (aluno.nome || "Aluno")
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((parte) => parte.charAt(0))
                      .join("")
                      .toUpperCase();
                    return (
                      <div key={aluno.id} className={`responsesStudentItem ${aberto ? "isOpen" : ""}`}>
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
                                {respostasExerciciosAluno.map((exercicio) => {
                                  const directKey = getRespostasDiretasKey(aluno.id, exercicio.id);
                                  const respostasDiretas = respostasDiretasPorExercicio[directKey] ?? [];
                                  const carregandoRespostasDiretas = loadingRespostasDiretas[directKey] ?? false;
                                  const seletorValue = seletorRespostaDireta[directKey] ?? "";
                                  const abertoExercicio = respostaExercicioAbertoKey === directKey;

                                  return (
                                    <div key={exercicio.id} className={`responsesExerciseItem ${abertoExercicio ? "isOpen" : ""}`}>
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
                                              {respostasDiretas.map((resposta) => {
                                                const value = getRespostaDiretaValue(resposta);
                                                const selecionada = seletorValue === value;

                                                return (
                                                  <button
                                                    key={`${resposta.answerId}-${resposta.questionId}`}
                                                    type="button"
                                                    className={`responsesDirectRow ${selecionada ? "isSelected" : ""}`}
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
                    onChange={(e) => setBuscaFiltro(e.target.value)}
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
                    onChange={(e) => setModuloFiltro(e.target.value)}
                    style={{ minWidth: 160 }}
                  >
                    <option value="">Todos os Modulos</option>
                    {Array.from(new Set(sourceItems.map((ex) => ex.modulo)))
                      .sort()
                      .map((mod) => (
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
                      onChange={(e) => setTurmaFiltro(e.target.value)}
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
                      onChange={(e) => setStatusFiltro(e.target.value)}
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
                    {(() => {
                      const filteredExercises = sourceItems.filter((ex) => {
                        const alunoIds = getAlunoIds(ex);
                        const hasAlunoAssignment = alunoIds.length > 0;
                        if (!isStaff && hasAlunoAssignment) {
                          if (!userId || !alunoIds.includes(userId)) {
                            return false;
                          }
                        }
                        // Filtro de busca por titulo
                        if (
                          buscaFiltro &&
                          !(
                            ex.titulo.toLowerCase().includes(buscaFiltro.toLowerCase()) ||
                            (ex.descricao || "").toLowerCase().includes(buscaFiltro.toLowerCase()) ||
                            (ex.tema || "").toLowerCase().includes(buscaFiltro.toLowerCase())
                          )
                        ) {
                          return false;
                        }

                        // Filtro de modulo
                        if (moduloFiltro && ex.modulo !== moduloFiltro) {
                          return false;
                        }

                        // Filtro de status (staff only)
                        if (isStaff && statusFiltro !== "todos") {
                          const isPublished = ex.publicado !== false;
                          const isScheduled = ex.publishedAt && new Date(ex.publishedAt) > new Date();
                          if (statusFiltro === "rascunho" && (isPublished || isScheduled)) return false;
                          if (statusFiltro === "programado" && !isScheduled) return false;
                          if (statusFiltro === "publicado" && (!isPublished || isScheduled)) return false;
                        }

                        // Filtro de turma
                        if (turmaFiltro === "todas") return true;
                        if (hasAlunoAssignment) return false;
                        return ex.turmas?.some((t) => t.id === turmaFiltro);
                      });

                      if (filteredExercises.length === 0) {
                        return (
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
                        );
                      }

                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const paginatedExercises = filteredExercises.slice(startIndex, endIndex);

                      return (
                        <>
                          <div className="exercisesList">
                            {paginatedExercises.map((ex) => {
                              const alunoIds = getAlunoIds(ex);
                              const hasAlunoAssignment = alunoIds.length > 0;
                              const alunoNames = hasAlunoAssignment ? getAlunoNames(ex) : [];
                              const showParaMim =
                                !isStaff && !!userId && alunoIds.includes(userId);
                              const alunoLabel = showParaMim
                                ? "Para mim"
                                : formatAlunoLabel(alunoNames);
                              const alunoTitle = showParaMim
                                ? "Disponivel apenas para vocee"
                                : alunoNames.length > 0
                                  ? `Disponivel apenas para: ${alunoNames.join(", ")}`
                                  : "Disponivel para aluno(s) especifico(s)";
                              const tipoInfo = getTipoInfo(ex);

                              return (
                                <div
                                  key={ex.id}
                                  className={`exerciseCard ${canCreate ? "canEdit" : ""}`}
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
                                        {isStaff && (() => {
                                          const isPublished = ex.publicado !== false;
                                          const isScheduled = ex.publishedAt && new Date(ex.publishedAt) > new Date();
                                          const isDraft = !isPublished && !isScheduled;
                                          if (isDraft) {
                                            return (
                                              <span
                                                className="exerciseBadge"
                                                style={{
                                                  background: "rgba(156, 163, 175, 0.15)",
                                                  color: "#6b7280",
                                                  borderColor: "rgba(156, 163, 175, 0.3)"
                                                }}
                                                title="Rascunho - nao visivel para alunos"
                                              >
                                                Rascunho
                                              </span>
                                            );
                                          }
                                          if (isScheduled) {
                                            return (
                                              <span
                                                className="exerciseBadge"
                                                style={{
                                                  background: "rgba(59, 130, 246, 0.1)",
                                                  color: "#3b82f6",
                                                  borderColor: "rgba(59, 130, 246, 0.2)"
                                                }}
                                                title="Exercicio programado para Publicacao"
                                              >
                                                Programado
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </div>
                                      <div className="exerciseMetaLine">
                                        <span className={`exerciseTypePill ${tipoInfo.className}`}>{tipoInfo.label}</span>
                                        <span className="exerciseModulePill">{ex.modulo}</span>
                                        <span className="exercisePhasePill">{ex.tema?.trim() ? ex.tema : "Sem fase"}</span>
                                      </div>
                                    </div>
                                    <div className="exerciseMetaAndActions">
                                      <div className="exerciseMeta">
                                        <div className={`exerciseDeadline ${ex.prazo && new Date(ex.prazo) < new Date() ? "overdue" : ""
                                          }`}>
                                          {ex.prazo
                                            ? new Date(ex.prazo).toLocaleDateString("pt-BR", {
                                              day: "2-digit",
                                              month: "short",
                                              hour: "2-digit",
                                              minute: "2-digit"
                                            })
                                            : "Sem prazo"}
                                        </div>
                                      </div>

                                      {canCreate && (
                                        <div className="exerciseActions">
                                          <button
                                            className="exerciseEditBtn"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEdit(ex);
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

                          <Pagination
                            currentPage={currentPage}
                            itemsPerPage={itemsPerPage}
                            totalItems={filteredExercises.length}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                          />
                        </>
                      );
                    })()}
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
      </div >
    </DashboardLayout >
  );
}
