import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserId } from "../auth/auth";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import ConfirmModal from "../components/ConfirmModal";
import Pagination from "../components/Pagination";
import MonacoEditor from "../components/MonacoEditor";
import MouseInteractiveBox from "../components/Exercise/MouseInteractiveBox";
import MultipleChoiceQuestion from "../components/Exercise/MultipleChoiceQuestion";
import { ScaleIn, AnimatedRadioLabel, AnimatedButton, AnimatedToast, ConditionalFieldAnimation, AnimatedSelect, FadeInUp, AnimatedToggle } from "../components/animate-ui";
import {
  RefreshCcw,
  Loader2,
  Laptop,
  Monitor,
  ClipboardList,
  Code,
  PenLine,
  ListChecks,
  MousePointer,
  Keyboard,
  Image,
  Trash2,
  Plus,
  Eye,
  Settings,
  AlertTriangle,
  Save,
  Sparkles,
  XCircle,
  X,
  Lightbulb,
  Users,
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
  const gabaritoLang = "javascript"; // Linguagem padrÃ£o, nÃ£o editÃ¡vel
  const [modulo, setModulo] = React.useState("");
  const [tema, setTema] = React.useState("");
  const [prazo, setPrazo] = React.useState(""); // datetime-local
  const [publishNow, setPublishNow] = React.useState(true); // Publicar agora ou agendar
  const [publishedAt, setPublishedAt] = React.useState(""); // datetime-local
  const [categoria, setCategoria] = React.useState("programacao"); // programacao ou informatica
  const [componenteInterativo, setComponenteInterativo] = React.useState("nenhum"); // nenhum, mouse, multipla, escrita, ou cÃ³digo
  const [diaNumero, setDiaNumero] = React.useState(1); // NÃºmero do dia para componentes interativos
  // Regras para Mouse Interativo
  const [mouseRegras, setMouseRegras] = React.useState({
    clicksSimples: 0,
    duplosClicks: 0,
    clicksDireitos: 0,
  });
  // Regras para MÃºltipla Escolha
  const [multiplaQuestoes, setMultiplaQuestoes] = React.useState<Array<{
    pergunta: string;
    opcoes: Array<{ letter: string; text: string }>;
    respostaCorreta: string;
  }>>([{
    pergunta: "",
    opcoes: [
      { letter: "A", text: "" },
      { letter: "B", text: "" },
      { letter: "C", text: "" },
      { letter: "D", text: "" }
    ],
    respostaCorreta: ""
  }]);
  // Tipos de atalho para exercÃ­cios de atalho
  const [atalhoTipo, setAtalhoTipo] = React.useState<"copiar-colar" | "copiar-colar-imagens" | "selecionar-deletar">("copiar-colar");
  const [permitirRepeticao, setPermitirRepeticao] = React.useState(false);
  const [maxTentativas, setMaxTentativas] = React.useState<string>("");
  const [penalidadeTentativa, setPenalidadeTentativa] = React.useState<string>("");
  const [intervaloReenvio, setIntervaloReenvio] = React.useState<string>("");
  const [anexosAtivo, setAnexosAtivo] = React.useState(false);
  const [anexoArquivo, setAnexoArquivo] = React.useState<File | null>(null);
  const [anexoAtual, setAnexoAtual] = React.useState<{ url: string; nome: string } | null>(null);
  const [anexoPreviewUrl, setAnexoPreviewUrl] = React.useState<string | null>(null);
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [modoAtribuicao, setModoAtribuicao] = React.useState<"turma" | "aluno">("turma");
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
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

  // Filtros
  const [moduloFiltro, setModuloFiltro] = React.useState("");
  const [tipoFiltro, setTipoFiltro] = React.useState(""); // codigo, texto, todas
  const [buscaFiltro, setBuscaFiltro] = React.useState("");

  // Turmas
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [turmaFiltro, setTurmaFiltro] = React.useState("todas");
  const [statusFiltro, setStatusFiltro] = React.useState("todos");

  // Alunos
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunoFiltro, setAlunoFiltro] = React.useState("");

  // PaginaÃ§Ã£o
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);

  const alunoNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    alunosDisponiveis.forEach((aluno) => {
      map.set(aluno.id, aluno.nome || aluno.usuario || aluno.id);
    });
    return map;
  }, [alunosDisponiveis]);

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
    if (names.length === 0) return "Aluno especÃ­fico";
    if (names.length === 1) return `Para: ${names[0]}`;
    if (names.length === 2) return `Para: ${names.join(", ")}`;
    return `Para: ${names[0]} +${names.length - 1}`;
  }

  function getRespostasDiretasKey(alunoId: string, exercicioId: string) {
    return `${alunoId}:${exercicioId}`;
  }


  // Modal de confirmaÃ§Ã£o
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
      setErro(e instanceof Error ? e.message : "Erro ao carregar exercÃ­cios");
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
      setErro(e instanceof Error ? e.message : "Erro ao carregar tarefas diÃƒÂ¡rias");
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
      setRespostasExercicioPagination({
        page: respostasExercicioPage,
        limit: respostasExercicioLimit,
        total: 0,
        totalPages: 1,
      });
      setErro(e instanceof Error ? e.message : "Erro ao carregar exercÃ­cios respondidos do aluno");
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
      return;
    }
    setRespostasAlunoAbertoId(alunoId);
    setRespostasAlunoId(alunoId);
    setRespostasExercicioFiltro("");
    setRespostasExercicioPage(1);
  }

  React.useEffect(() => {
    load();

    // Carregar turmas e alunos disponÃ­veis se for professor/admin
    if (canCreate) {
      listarTurmas()
        .then(setTurmasDisponiveis)
        .catch((e) => console.error("Erro ao carregar turmas:", e));

      listarAlunos()
        .then(setAlunosDisponiveis)
        .catch((e) => console.error("Erro ao carregar alunos:", e));
    }
  }, []);

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

  React.useEffect(() => {
    if (!anexoArquivo) {
      setAnexoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(anexoArquivo);
    setAnexoPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [anexoArquivo]);

  async function handleSubmit() {
    try {
      setSaving(true);
      setErro(null);
      setOkMsg(null);

      const gabaritoLimpo = gabarito.trim();

      // Auto-gerar descriÃ§Ã£o se for componente interativo em InformÃ¡tica
      let descricaoFinal = descricao.trim();
      let tituloFinal = titulo.trim();

      // Determinar o `tipoExercicio` explicitamente a partir das seleÃ§Ãµes do formulÃ¡rio
      let tipoSelecionado: string | undefined = undefined;
      if (categoria === "programacao") {
        if (componenteInterativo === "") tipoSelecionado = "codigo"; // Monaco
        else tipoSelecionado = componenteInterativo || undefined;
      } else {
        // Para informÃ¡tica, o valor vazio representa 'nenhum'
        if (componenteInterativo === "") tipoSelecionado = "nenhum";
        else tipoSelecionado = componenteInterativo || undefined;
      }

      if (tipoSelecionado === "nenhum") {
        setErro("Selecione um tipo de exercÃ­cio vÃ¡lido (nÃ£o Ã© permitido 'Nenhum').");
        setSaving(false);
        return;
      }

      const maxTentativasNum = maxTentativas.trim() ? Number(maxTentativas) : null;
      const penalidadeNum = penalidadeTentativa.trim() ? Number(penalidadeTentativa) : 0;
      const intervaloNum = intervaloReenvio.trim() ? Number(intervaloReenvio) : null;

      const dados: any = {
        titulo: tituloFinal,
        descricao: descricaoFinal,
        modulo: modulo.trim(),
        tema: tema.trim() ? tema.trim() : null,
        prazo: prazo ? new Date(prazo).toISOString() : null,
        publicado: publishNow,
        published_at: publishNow ? null : (publishedAt ? new Date(publishedAt).toISOString() : null),
        categoria: categoria,
        ...(gabaritoLimpo && categoria === "programacao" ? { gabarito: gabaritoLimpo } : {}),
        // Incluir o tipo de exercÃ­cio determinado explicitamente
        ...(tipoSelecionado ? { tipoExercicio: tipoSelecionado } : {}),
        // Adicionar regras do mouse se for componente interativo
        ...(componenteInterativo === "mouse" ? {
          mouse_regras: JSON.stringify(mouseRegras)
        } : {}),
        // Adicionar regras de mÃºltipla escolha se for componente interativo
        ...(componenteInterativo === "multipla" ? {
          multipla_regras: JSON.stringify({ questoes: multiplaQuestoes })
        } : {}),
        // Adicionar tipo de atalho se for componente de atalho
        ...(componenteInterativo === "atalho" ? {
          atalho_tipo: atalhoTipo
        } : {}),
        permitir_repeticao: permitirRepeticao,
        max_tentativas: permitirRepeticao ? maxTentativasNum : null,
        penalidade_por_tentativa: permitirRepeticao ? penalidadeNum : 0,
        intervalo_reenvio: permitirRepeticao ? intervaloNum : null,
      };

      if (modoAtribuicao === "turma" && turmasSelecionadas.length > 0) {
        dados.turma_ids = turmasSelecionadas;
      } else if (modoAtribuicao === "aluno" && alunosSelecionados.length > 0) {
        dados.aluno_ids = alunosSelecionados;
      }

      let exercicioId = editandoId;
      if (editandoId) {
        // Atualizar exercÃ­cio existente
        await atualizarExercicio(editandoId, dados);
        setOkMsg("ExercÃ­cio atualizado!");
        setEditandoId(null);
      } else {
        // Criar novo exercÃ­cio
        const created = await criarExercicio(dados);
        exercicioId = (created as any)?.exercicio?.id ?? null;
        setOkMsg("ExercÃ­cio criado!");
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

      setTitulo("");
      setDescricao("");
      setGabarito("");
      setModulo("");
      setTema("");
      setPrazo("");
      setPublishNow(true);
      setPublishedAt("");
      setCategoria("programacao");
      setComponenteInterativo("");
      setDiaNumero(1);
      setMouseRegras({ clicksSimples: 0, duplosClicks: 0, clicksDireitos: 0 });
      setAtalhoTipo("copiar-colar");
      setPermitirRepeticao(false);
      setMaxTentativas("");
      setPenalidadeTentativa("");
      setIntervaloReenvio("");
      setAnexosAtivo(false);
      setAnexoArquivo(null);
      setAnexoAtual(null);
      setTurmasSelecionadas([]);
      setAlunosSelecionados([]);
      setModoAtribuicao("turma");
      setMultiplaQuestoes([{
        pergunta: "",
        opcoes: [
          { letter: "A", text: "" },
          { letter: "B", text: "" },
          { letter: "C", text: "" },
          { letter: "D", text: "" }
        ],
        respostaCorreta: ""
      }]);
      setTurmasSelecionadas([]);

      await load();
      if (dailyLoaded) {
        await loadDailyTasks();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar exercÃ­cio");
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
    setModulo(exercicio.modulo);
    setTema(exercicio.tema || "");

    // Converter data de ISO para formato datetime-local
    if (exercicio.prazo) {
      const date = new Date(exercicio.prazo);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setPrazo(`${year}-${month}-${day}T${hours}:${minutes}`);
    }

    // PublicaÃ§Ã£o imediata vs agendada vs rascunho
    if (exercicio.publishedAt) {
      const pubDate = new Date(exercicio.publishedAt);
      if (pubDate > new Date()) {
        const year = pubDate.getFullYear();
        const month = String(pubDate.getMonth() + 1).padStart(2, "0");
        const day = String(pubDate.getDate()).padStart(2, "0");
        const hours = String(pubDate.getHours()).padStart(2, "0");
        const minutes = String(pubDate.getMinutes()).padStart(2, "0");
        setPublishNow(false);
        setPublishedAt(`${year}-${month}-${day}T${hours}:${minutes}`);
      } else {
        setPublishNow(exercicio.publicado !== false);
        setPublishedAt("");
      }
    } else {
      setPublishNow(exercicio.publicado !== false);
      setPublishedAt("");
    }

    // Carregar turmas do exercÃ­cio se existirem
    if (exercicio.turmas) {
      setTurmasSelecionadas(exercicio.turmas.map((t) => t.id));
    } else {
      setTurmasSelecionadas([]);
    }

    const alunoIds = getAlunoIds(exercicio);
    if (alunoIds.length > 0) {
      setModoAtribuicao("aluno");
      setAlunosSelecionados(alunoIds);
      setTurmasSelecionadas([]);
    } else {
      setModoAtribuicao("turma");
      setAlunosSelecionados([]);
    }

    // Restaurar categoria
    setCategoria(exercicio.categoria || "programacao");

    // Restaurar componente interativo baseado em regras
    if (exercicio.mouse_regras) {
      setComponenteInterativo("mouse");
      try {
        const regras = JSON.parse(exercicio.mouse_regras);
        setMouseRegras(regras);
      } catch (e) {
        console.error("Erro ao parsear mouse_regras:", e);
        setComponenteInterativo("");
      }
    } else if (exercicio.multipla_regras) {
      setComponenteInterativo("multipla");
      try {
        const regras = JSON.parse(exercicio.multipla_regras);
        setMultiplaQuestoes(regras.questoes || []);
      } catch (e) {
        console.error("Erro ao parsear multipla_regras:", e);
        setComponenteInterativo("");
      }
    } else if (exercicio.atalho_tipo) {
      setComponenteInterativo("atalho");
      setAtalhoTipo(exercicio.atalho_tipo as "copiar-colar" | "copiar-colar-imagens" | "selecionar-deletar");
    } else {
      setComponenteInterativo("");
    }

    setPermitirRepeticao(exercicio.permitir_repeticao ?? false);
    setMaxTentativas(exercicio.maxTentativas ? String(exercicio.maxTentativas) : "");
    setPenalidadeTentativa(
      exercicio.penalidadePorTentativa !== null && exercicio.penalidadePorTentativa !== undefined
        ? String(exercicio.penalidadePorTentativa)
        : ""
    );
    setIntervaloReenvio(exercicio.intervaloReenvio ? String(exercicio.intervaloReenvio) : "");

    // Restaurar estado de publicaÃ§Ã£o
    setPublishNow(exercicio.publicado !== false);
    if (exercicio.publishedAt) {
      const date = new Date(exercicio.publishedAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setPublishedAt(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setPublishedAt("");
    }

    // Restaurar diaNumero do tÃ­tulo (se aplicÃ¡vel)
    const diaMatch = exercicio.titulo.match(/^Dia (\d+):/);
    if (diaMatch) {
      setDiaNumero(parseInt(diaMatch[1], 10));
    } else {
      setDiaNumero(1);
    }

    setEditandoId(exercicio.id);
    setOkMsg(null);
    setErro(null);

    // Scroll atÃ© o formulÃ¡rio
    setTimeout(() => {
      const formElement = document.querySelector(".createExerciseCard");
      formElement?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function handleCancel() {
    setActiveSection("lista");
    setTitulo("");
    setDescricao("");
    setGabarito("");
    setModulo("");
    setTema("");
    setPrazo("");
    setPublishNow(true);
    setPublishedAt("");
    setCategoria("programacao");
    setComponenteInterativo("");
    setDiaNumero(1);
    setAtalhoTipo("copiar-colar");
    setPermitirRepeticao(false);
    setMaxTentativas("");
    setPenalidadeTentativa("");
    setIntervaloReenvio("");
    setMouseRegras({ clicksSimples: 0, duplosClicks: 0, clicksDireitos: 0 });
    setMultiplaQuestoes([{
      pergunta: "",
      opcoes: [
        { letter: "A", text: "" },
        { letter: "B", text: "" },
        { letter: "C", text: "" },
        { letter: "D", text: "" }
      ],
      respostaCorreta: ""
    }]);
    setTurmasSelecionadas([]);
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
      setOkMsg("ExercÃ­cio deletado com sucesso!");

      fecharModalDeletar();
      await load();
      if (dailyLoaded) {
        await loadDailyTasks();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao deletar exercÃ­cio");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    // FunÃ§Ã£o mantida para compatibilidade, mas agora abre o modal
    const exercicio = sourceItems.find((ex) => ex.id === id);
    abrirModalDeletar(id, exercicio?.titulo || "ExercÃ­cio");
  }

  // ValidaÃ§Ã£o especial para componentes interativos
  const isInteractiveComponentInformatica = categoria === "informatica" && componenteInterativo !== "";
  const disabled =
    saving ||
    componenteInterativo === "nenhum" || // Tipo "Nenhum" nÃ£o pode ser publicado
    modulo.trim().length < 1 ||
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
    <DashboardLayout title="ExercÃ­cios" subtitle="Veja e pratique os exercÃ­cios disponÃ­veis">
      <div className="exercisesContainer">
        {/* HEADER COM BOTÃƒO */}
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
                Criar exercÃ­cios
              </button>
            )}
            <button
              type="button"
              className={`exercisesTab ${activeSection === "lista" ? "active" : ""}`}
              onClick={() => setActiveSection("lista")}
            >
              ExercÃ­cios
            </button>
            <button
              type="button"
              className={`exercisesTab ${activeSection === "tarefa-diaria" ? "active" : ""}`}
              onClick={() => setActiveSection("tarefa-diaria")}
            >
              {iconLabel(<Calendar size={14} />, "Tarefa diÃ¡ria")}
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



        {/* SEÃ‡ÃƒO DE CRIAR */}
        {canCreate && activeSection === "criar" && (
          <FadeInUp duration={0.28}>
            <div className="createExerciseCard">
              <h2 className="exFormTitle">Criar novo exercÃ­cio</h2>

              <div className="exFormGrid">
                <div className="exInputGroup">
                  <label className="exLabel">TÃ­tulo *</label>
                  <input
                    className="exInput"
                    placeholder="ex: ExercÃ­cio 15.3: Layout Responsivo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>

                <div className="exInputGroup">
                  <label className="exLabel">DescriÃ§Ã£o *</label>
                  <textarea
                    className="exTextarea"
                    placeholder="Descreva o exercÃ­cio em detalhes..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>

                <div className="exInputGroup">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <label className="exLabel" style={{ marginBottom: 0 }}>Anexos * </label>
                    <AnimatedToggle
                      checked={anexosAtivo}
                      onChange={(checked) => {
                        setAnexosAtivo(checked);
                        if (!checked) setAnexoArquivo(null);
                      }}
                    />
                  </div>
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, display: "block" }}>
                    Se ativado, vocÃª pode anexar um arquivo ao exercÃ­cio.
                  </small>

                  {anexosAtivo && (
                    <div style={{ marginTop: 12 }}>
                      <label className="exLabel">Arquivo do exercÃ­cio</label>
                      <label className="filePicker">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip"
                          onChange={(e) => setAnexoArquivo(e.target.files?.[0] ?? null)}
                        />
                        <span className="filePickerIcon">ðŸ“Ž</span>
                        <span className="filePickerText">
                          {anexoArquivo?.name || "Selecionar arquivo"}
                        </span>
                      </label>
                      {anexoPreviewUrl && anexoArquivo && (
                        <div className="filePreview">
                          {anexoArquivo.type.startsWith("image/") ? (
                            <img src={anexoPreviewUrl} alt={anexoArquivo.name} />
                          ) : anexoArquivo.type === "application/pdf" ? (
                            <embed src={anexoPreviewUrl} type="application/pdf" />
                          ) : (
                            <div className="filePreviewMeta">
                              <div className="filePreviewName">{anexoArquivo.name}</div>
                              <div className="filePreviewInfo">
                                {(anexoArquivo.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {anexoAtual?.url && !anexoArquivo && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                          <a href={anexoAtual.url} target="_blank" rel="noreferrer">
                            {anexoAtual.nome || "Baixar anexo atual"}
                          </a>
                          <button
                            type="button"
                            style={{ marginLeft: 10, color: "var(--red)", background: "transparent", border: "none", cursor: "pointer" }}
                            onClick={async () => {
                              if (!editandoId) return;
                              await removerExercicioArquivo(editandoId);
                              setAnexoAtual(null);
                            }}
                          >
                            Remover anexo
                          </button>
                        </div>
                      )}
                      {anexoArquivo && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                          {anexoArquivo.name} â€¢ {(anexoArquivo.size / 1024).toFixed(1)} KB
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CATEGORIA - PROGRAMACAO vs INFORMATICA */}
                <div className="exInputRow">
                  <div className="exInputGroup">
                    <div className="exToggleGroup">
                      <label className={`exToggleOption ${categoria === "programacao" ? "active" : ""}`}>
                        <input
                          className="exToggleInput"
                          type="radio"
                          name="categoria"
                          value="programacao"
                          checked={categoria === "programacao"}
                          onChange={(e) => {
                            setCategoria(e.target.value as any);
                            setComponenteInterativo("");
                          }}
                        />
                        <span className="exToggleDot" aria-hidden="true" />
                        <span className="exToggleLabel">
                          {iconLabel(<Laptop size={14} />, "Programacao")}
                        </span>
                      </label>

                      <label className={`exToggleOption ${categoria === "informatica" ? "active" : ""}`}>
                        <input
                          className="exToggleInput"
                          type="radio"
                          name="categoria"
                          value="informatica"
                          checked={categoria === "informatica"}
                          onChange={(e) => {
                            setCategoria(e.target.value as any);
                            setComponenteInterativo("");
                          }}
                        />
                        <span className="exToggleDot" aria-hidden="true" />
                        <span className="exToggleLabel">
                          {iconLabel(<Monitor size={14} />, "Informatica")}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* COMPONENTES INTERATIVOS - Para Programacao */}
                {categoria === "programacao" && (
                  <>
                    <div className="exInputGroup">
                      <label className="exLabel">Tipo de ExercÃ­cio</label>
                      <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                        <AnimatedRadioLabel
                          name="tipoExercicio"
                          value="nenhum"
                          checked={componenteInterativo === "nenhum"}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="Nenhum (Normal)"
                          icon={<ClipboardList size={14} />} 
                        />
                        <AnimatedRadioLabel
                          name="tipoExercicio"
                          value=""
                          checked={componenteInterativo === ""}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="CÃ³digo (Monaco)"
                          icon={<Code size={14} />} 
                        />
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
                          label="MÃºltipla Escolha"
                          icon={<ListChecks size={14} />} 
                        />
                      </div>
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                        Selecione o tipo de exercÃ­cio para ProgramaÃ§Ã£o
                      </small>
                    </div>

                    {/* GABARITO / CÃ“DIGO ESPERADO - Apenas para tipo CÃ³digo */}
                    {componenteInterativo === "" && (
                      <ScaleIn>
                        <div className="exInputGroup">
                          <label className="exLabel">Gabarito / CÃ³digo esperado</label>
                          <MonacoEditor
                            value={gabarito}
                            onChange={(v) => setGabarito(v || "")}
                            language={gabaritoLang}
                            height="240px"
                            theme="dark"
                          />
                          <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                            Esse texto serÃ¡ usado para comparar se a resposta do aluno estÃ¡ parecida com o esperado.
                          </small>
                        </div>
                      </ScaleIn>
                    )}

                    {/* EXERCÃCIO DE ESCRITA - Para ProgramaÃ§Ã£o */}
                    {componenteInterativo === "escrita" && (
                      <ScaleIn>
                        <div className="exInputGroup">
                          <label className="exLabel">Resposta/Gabarito Esperado</label>
                          <textarea
                            className="exInput"
                            value={gabarito}
                            onChange={(e) => setGabarito(e.target.value)}
                            placeholder="Digite o gabarito ou resposta esperada para o exercÃ­cio de escrita..."
                            style={{ minHeight: "200px", fontFamily: "inherit", resize: "vertical" }}
                          />
                          <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                            Este texto serÃ¡ usado como referÃªncia para avaliar a resposta do aluno.
                          </small>
                        </div>
                      </ScaleIn>
                    )}

                    {/* QUESTÃ•ES DE MÃšLTIPLA ESCOLHA - Para ProgramaÃ§Ã£o */}
                    {componenteInterativo === "multipla" && (
                      <ScaleIn>
                        <>
                          <div style={{ background: "var(--background-secondary)", border: "1px solid #fcd34d", borderRadius: "8px", padding: "14px", marginTop: "12px" }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", margin: "0 0 12px 0" }}>
                              {iconLabel(<ListChecks size={14} />, "Configurar QuestÃµes de MÃºltipla Escolha:")}
                            </p>

                            {multiplaQuestoes.map((questao, qIndex) => (
                              <div key={qIndex} style={{ background: "var(--card)", padding: "12px", borderRadius: "6px", marginBottom: "12px", border: "1px solid #fde68a" }}>
                                <h4 style={{ margin: "0 0 8px 0", fontSize: 13 }}>QuestÃ£o {qIndex + 1}</h4>

                                <div style={{ marginBottom: "8px" }}>
                                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Pergunta:</label>
                                  <input
                                    className="exInput"
                                    type="text"
                                    value={questao.pergunta}
                                    onChange={(e) => {
                                      const novas = [...multiplaQuestoes];
                                      novas[qIndex].pergunta = e.target.value;
                                      setMultiplaQuestoes(novas);
                                    }}
                                    placeholder="Digite a pergunta"
                                  />
                                </div>

                                <div style={{ marginBottom: "8px" }}>
                                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>OpÃ§Ãµes:</label>
                                  {questao.opcoes.map((opcao, oIndex) => (
                                    <input
                                      key={oIndex}
                                      className="exInput"
                                      type="text"
                                      value={opcao.text}
                                      onChange={(e) => {
                                        const novas = [...multiplaQuestoes];
                                        novas[qIndex].opcoes[oIndex].text = e.target.value;
                                        setMultiplaQuestoes(novas);
                                      }}
                                      placeholder={`OpÃ§Ã£o ${opcao.letter}`}
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
                                      const novas = [...multiplaQuestoes];
                                      novas[qIndex].respostaCorreta = e.target.value;
                                      setMultiplaQuestoes(novas);
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
                                      border: "none",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      fontSize: 12,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {iconLabel(<Trash2 size={14} />, "Remover QuestÃ£o")}
                                  </button>
                                )}
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => {
                                setMultiplaQuestoes([
                                  ...multiplaQuestoes,
                                  {
                                    pergunta: "",
                                    opcoes: [
                                      { letter: "A", text: "" },
                                      { letter: "B", text: "" },
                                      { letter: "C", text: "" },
                                      { letter: "D", text: "" }
                                    ],
                                    respostaCorreta: ""
                                  }
                                ]);
                              }}
                              style={{
                                padding: "8px 16px",
                                background: "#dcfce7",
                                color: "#166534",
                                border: "1px solid #86efac",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontWeight: 600,
                                marginTop: "8px",
                              }}
                            >
                              {iconLabel(<Plus size={14} />, "Adicionar Outra QuestÃ£o")}
                            </button>
                          </div>

                          <div style={{ background: "var(--background-secondary)", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px", marginTop: "12px" }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: "0 0 12px 0" }}>
                              {iconLabel(<Eye size={14} />, "PrÃ©-visualizaÃ§Ã£o:")}
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

                {/* COMPONENTES INTERATIVOS - Apenas para InformÃ¡tica */}
                {categoria === "informatica" && (
                  <>
                    <div className="exInputGroup">
                      <label className="exLabel">Componente Interativo</label>
                      <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                        <AnimatedRadioLabel
                          name="componenteInterativoInformatica"
                          value=""
                          checked={componenteInterativo === ""}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="Nenhum (Normal)"
                          icon={<ClipboardList size={14} />} 
                        />
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
                          value="mouse"
                          checked={componenteInterativo === "mouse"}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="Mouse"
                          icon={<MousePointer size={14} />} 
                        />
                        <AnimatedRadioLabel
                          name="componenteInterativoInformatica"
                          value="multipla"
                          checked={componenteInterativo === "multipla"}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="MÃºltipla Escolha"
                          icon={<ListChecks size={14} />} 
                        />
                        <AnimatedRadioLabel
                          name="componenteInterativoInformatica"
                          value="atalho"
                          checked={componenteInterativo === "atalho"}
                          onChange={(e) => setComponenteInterativo(e.target.value)}
                          label="Atalho"
                          icon={<Keyboard size={14} />} 
                        />
                      </div>
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                        Selecione o tipo de componente para InformÃ¡tica
                      </small>
                    </div>

                    {/* EXERCÃCIO DE ESCRITA - Para InformÃ¡tica */}
                    {componenteInterativo === "escrita" && (
                      <ScaleIn>
                        <div className="exInputGroup">
                          <label className="exLabel">Resposta/Gabarito Esperado</label>
                          <textarea
                            className="exInput"
                            value={gabarito}
                            onChange={(e) => setGabarito(e.target.value)}
                            placeholder="Digite o gabarito ou resposta esperada para o exercÃ­cio de escrita..."
                            style={{ minHeight: "200px", fontFamily: "inherit", resize: "vertical" }}
                          />
                          <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                            Este texto serÃ¡ usado como referÃªncia para avaliar a resposta do aluno.
                          </small>
                        </div>
                      </ScaleIn>
                    )}

                    {/* Campo "Dia #" quando um componente Ã© selecionado */}
                    <ConditionalFieldAnimation isVisible={componenteInterativo !== ""}>
                      <div className="exInputGroup">
                        <label className="exLabel">Dia #</label>
                        <input
                          className="exInput"
                          type="number"
                          min="1"
                          value={diaNumero}
                          onChange={(e) => setDiaNumero(parseInt(e.target.value) || 1)}
                          placeholder="Digite o nÃºmero do dia"
                        />
                        <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                          Usado apenas para organizaÃ§Ã£o interna (nÃ£o altera o tÃ­tulo automaticamente).
                        </small>
                      </div>
                    </ConditionalFieldAnimation>

                    {/* REGRAS DO MOUSE - Apenas para componente Mouse */}
                    <ConditionalFieldAnimation isVisible={componenteInterativo === "mouse"}>
                      <>
                        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "14px", marginTop: "12px" }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", margin: "0 0 12px 0" }}>
                            {iconLabel(<Settings size={14} />, "Definir Regras de Sucesso:")}
                          </p>

                          <div className="exInputRow">
                            <div className="exInputGroup">
                              <label className="exLabel">Cliques Esquerdos</label>
                              <input
                                className="exInput"
                                type="number"
                                min="0"
                                value={mouseRegras.clicksSimples}
                                onChange={(e) => setMouseRegras({ ...mouseRegras, clicksSimples: parseInt(e.target.value) || 0 })}
                                placeholder="Ex: 5"
                              />
                              <small style={{ fontSize: 11, color: "var(--muted)" }}>Quantos cliques simples sÃ£o necessÃ¡rios?</small>
                            </div>

                            <div className="exInputGroup">
                              <label className="exLabel">Duplos Cliques</label>
                              <input
                                className="exInput"
                                type="number"
                                min="0"
                                value={mouseRegras.duplosClicks}
                                onChange={(e) => setMouseRegras({ ...mouseRegras, duplosClicks: parseInt(e.target.value) || 0 })}
                                placeholder="Ex: 3"
                              />
                              <small style={{ fontSize: 11, color: "var(--muted)" }}>Quantos duplos cliques sÃ£o necessÃ¡rios?</small>
                            </div>

                            <div className="exInputGroup">
                              <label className="exLabel">Cliques Direitos</label>
                              <input
                                className="exInput"
                                type="number"
                                min="0"
                                value={mouseRegras.clicksDireitos}
                                onChange={(e) => setMouseRegras({ ...mouseRegras, clicksDireitos: parseInt(e.target.value) || 0 })}
                                placeholder="Ex: 2"
                              />
                              <small style={{ fontSize: 11, color: "var(--muted)" }}>Quantos cliques direitos sÃ£o necessÃ¡rios?</small>
                            </div>
                          </div>
                        </div>
                      </>
                    </ConditionalFieldAnimation>

                    {/* PREVIEW DO COMPONENTE MOUSE */}
                    <ConditionalFieldAnimation isVisible={componenteInterativo === "mouse"}>
                      <div style={{
                        background: "#f9fafb",
                        border: "2px dashed #e5e7eb",
                        borderRadius: "12px",
                        padding: "20px",
                        marginTop: "16px",
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginTop: 0, marginBottom: "12px" }}>
                          {iconLabel(<Eye size={14} />, "PREVIEW - Como o aluno vai ver:")}
                        </p>
                        <MouseInteractiveBox
                          title="InteraÃ§Ã£o com Mouse"
                          instruction="Clique, duplo-clique ou clique direito para registrar suas aÃ§Ãµes"
                        />
                      </div>
                    </ConditionalFieldAnimation>

                    {/* FORMULÃRIO DINÃ‚MICO PARA MÃšLTIPLA ESCOLHA */}
                    <ConditionalFieldAnimation isVisible={componenteInterativo === "multipla"}>
                      <div style={{
                        background: "#f9fafb",
                        border: "2px dashed #e5e7eb",
                        borderRadius: "12px",
                        padding: "20px",
                        marginTop: "16px",
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginTop: 0, marginBottom: "16px" }}>
                          {iconLabel(<ListChecks size={14} />, "Criar QuestÃµes")} ({multiplaQuestoes.length})
                        </p>

                        {/* Loop atravÃ©s de cada questÃ£o */}
                        {multiplaQuestoes.map((questao, qIndex) => (
                          <div key={qIndex} style={{
                            background: "var(--card)",
                            border: "1px solid var(--line)",
                            borderRadius: "8px",
                            padding: "16px",
                            marginBottom: "16px",
                          }}>
                            <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1f2937" }}>
                              QuestÃ£o {qIndex + 1}
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
                                  const novaQuestoes = [...multiplaQuestoes];
                                  novaQuestoes[qIndex].pergunta = e.target.value;
                                  setMultiplaQuestoes(novaQuestoes);
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

                            {/* Campos de opÃ§Ãµes */}
                            {questao.opcoes.map((opcao, oIndex) => (
                              <div key={oIndex} style={{ marginBottom: "12px" }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
                                  OpÃ§Ã£o {opcao.letter}
                                </label>
                                <input
                                  type="text"
                                  placeholder={`Digite a opÃ§Ã£o ${opcao.letter}...`}
                                  value={opcao.text}
                                  onChange={(e) => {
                                    const novaQuestoes = [...multiplaQuestoes];
                                    novaQuestoes[qIndex].opcoes[oIndex].text = e.target.value;
                                    setMultiplaQuestoes(novaQuestoes);
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
                                        const novaQuestoes = [...multiplaQuestoes];
                                        novaQuestoes[qIndex].respostaCorreta = e.target.value;
                                        setMultiplaQuestoes(novaQuestoes);
                                      }}
                                      style={{ marginRight: "6px", cursor: "pointer" }}
                                    />
                                    {opcao.letter}
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* BotÃ£o remover questÃ£o */}
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
                                {iconLabel(<Trash2 size={14} />, "Remover QuestÃ£o")}
                              </button>
                            )}
                          </div>
                        ))}

                        {/* BotÃ£o adicionar questÃ£o */}
                        <button
                          type="button"
                          onClick={() => {
                            setMultiplaQuestoes([...multiplaQuestoes, {
                              pergunta: "",
                              opcoes: [
                                { letter: "A", text: "" },
                                { letter: "B", text: "" },
                                { letter: "C", text: "" },
                                { letter: "D", text: "" }
                              ],
                              respostaCorreta: ""
                            }]);
                          }}
                          style={{
                            padding: "8px 16px",
                            background: "#dbeafe",
                            color: "#0c4a6e",
                            border: "1px solid #93c5fd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: 500,
                            marginBottom: "16px",
                          }}
                        >
                          {iconLabel(<Plus size={14} />, "Adicionar Outra QuestÃ£o")}
                        </button>

                        {/* PREVIEW DINÃ‚MICO DA PRIMEIRA QUESTÃƒO */}
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

                {/* TIPO DE ATALHO - Para componente de atalho em InformÃ¡tica */}
                {categoria === "informatica" && componenteInterativo === "atalho" && (
                  <ScaleIn>
                    <div className="exInputGroup">
                      <label className="exLabel">Selecione o Tipo de Atalho</label>
                      <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                        <AnimatedRadioLabel
                          name="atalhoTipo"
                          value="copiar-colar"
                          checked={atalhoTipo === "copiar-colar"}
                          onChange={(e) => setAtalhoTipo(e.target.value as any)}
                          label="Copiar e Colar Texto"
                          icon={<ClipboardList size={14} />} 
                        />
                        <AnimatedRadioLabel
                          name="atalhoTipo"
                          value="copiar-colar-imagens"
                          checked={atalhoTipo === "copiar-colar-imagens"}
                          onChange={(e) => setAtalhoTipo(e.target.value as any)}
                          label="Copiar e Colar Imagem"
                          icon={<Image size={14} />} 
                        />
                        <AnimatedRadioLabel
                          name="atalhoTipo"
                          value="selecionar-deletar"
                          checked={atalhoTipo === "selecionar-deletar"}
                          onChange={(e) => setAtalhoTipo(e.target.value as any)}
                          label="Selecionar Tudo e Deletar"
                          icon={<Trash2 size={14} />} 
                        />
                      </div>
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                        Escolha qual atalho o aluno irÃ¡ treinar
                      </small>
                    </div>
                  </ScaleIn>
                )}

                {/* PERMITIR REPETIÃ‡ÃƒO */}
                <div className="exInputRow">
                  <div className="exInputGroup">
                    <label className="exLabel" style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", cursor: "pointer" }}>
                      <AnimatedToggle
                        checked={permitirRepeticao}
                        onChange={setPermitirRepeticao}
                      />
                      Permitir repetiÃ§Ã£o
                    </label>
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      Se ativado, alunos podem enviar mÃºltiplas respostas
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
                    <label className="exLabel">MÃ³dulo *</label>
                    <input
                      className="exInput"
                      placeholder="ex: MÃ“DULO 4"
                      value={modulo}
                      onChange={(e) => setModulo(e.target.value)}
                    />
                  </div>

                  <div className="exInputGroup">
                    <label className="exLabel">Tema</label>
                    <input
                      className="exInput"
                      placeholder="ex: HTML5 e CSS3 AvanÃ§ado"
                      value={tema}
                      onChange={(e) => setTema(e.target.value)}
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

                {/* AGENDAMENTO DE PUBLICAÃ‡ÃƒO */}
                <div className="exInputRow">
                  <div className="exInputGroup">
                    <label className="exLabel" style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", cursor: "pointer" }}>
                      <AnimatedToggle
                        checked={publishNow}
                        onChange={setPublishNow}
                      />
                      Publicar agora
                    </label>
                  </div>
                </div>

                <ConditionalFieldAnimation isVisible={!publishNow}>
                  <div className="exInputRow">
                    <div className="exInputGroup" style={{ cursor: "pointer" }}>
                      <label className="exLabel" style={{ cursor: "pointer" }}>{iconLabel(<Calendar size={14} />, "Agendar PublicaÃ§Ã£o")}</label>
                      <input
                        className="exInput"
                        type="datetime-local"
                        value={publishedAt}
                        onChange={(e) => setPublishedAt(e.target.value)}
                        required={!publishNow}
                        style={{ cursor: "pointer" }}
                      />
                      <small style={{ color: "#666", marginTop: "4px" }}>
                        O exercÃ­cio serÃ¡ visÃ­vel a partir dessa data e hora
                      </small>
                    </div>
                  </div>
                </ConditionalFieldAnimation>

                {canCreate && (turmasDisponiveis.length > 0 || alunosDisponiveis.length > 0) && (
                  <>
                    <div className="exInputGroup">
                      <label className="exLabel">AtribuiÃ§Ã£o</label>
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                        <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontSize: "14px" }}>
                          <input
                            type="radio"
                            name="modoAtribuicao"
                            value="turma"
                            checked={modoAtribuicao === "turma"}
                            onChange={() => {
                              setModoAtribuicao("turma");
                              setAlunosSelecionados([]);
                            }}
                            style={{ marginRight: "6px", cursor: "pointer" }}
                          />
                          {iconLabel(<Users size={14} />, "Turma EspecÃ­fica")}
                        </label>
                        <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontSize: "14px" }}>
                          <input
                            type="radio"
                            name="modoAtribuicao"
                            value="aluno"
                            checked={modoAtribuicao === "aluno"}
                            onChange={() => {
                              setModoAtribuicao("aluno");
                              setTurmasSelecionadas([]);
                            }}
                            style={{ marginRight: "6px", cursor: "pointer" }}
                          />
                          {iconLabel(<UserIcon size={14} />, "Aluno EspecÃ­fico")}
                        </label>
                      </div>
                    </div>

                    {modoAtribuicao === "turma" && turmasDisponiveis.length > 0 && (
                      <div className="exInputGroup">
                        <label className="exLabel">Turmas</label>
                        <AnimatedSelect
                          className="exSelect"
                          multiple
                          value={turmasSelecionadas}
                          onChange={(e) =>
                            setTurmasSelecionadas(
                              Array.from(e.target.selectedOptions, (opt) => opt.value)
                            )
                          }
                          size={3}
                        >
                          {turmasDisponiveis.map((turma) => (
                            <option key={turma.id} value={turma.id}>
                              {turma.nome}
                            </option>
                          ))}
                        </AnimatedSelect>
                        <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                          Segure Ctrl/Cmd para selecionar mÃºltiplas turmas. Deixe vazio para "Todos".
                        </small>
                      </div>
                    )}

                    {modoAtribuicao === "aluno" && alunosDisponiveis.length > 0 && (
                      <>
                        <div className="exInputGroup">
                          <label className="exLabel">Pesquisar Alunos</label>
                          <input
                            type="text"
                            className="exInput"
                            placeholder="Digite nome ou usuÃ¡rio..."
                            value={alunoFiltro}
                            onChange={(e) => setAlunoFiltro(e.target.value)}
                            style={{ width: "100%" }}
                          />
                        </div>

                        <div className="exInputGroup">
                          <label className="exLabel">Alunos</label>
                          <AnimatedSelect
                            className="exSelect"
                            multiple
                            value={alunosSelecionados}
                            onChange={(e) =>
                              setAlunosSelecionados(
                                Array.from(e.target.selectedOptions, (opt) => opt.value)
                              )
                            }
                            size={3}
                          >
                            {alunosDisponiveis
                              .filter(
                                (aluno) =>
                                  alunoFiltro === "" ||
                                  aluno.nome.toLowerCase().includes(alunoFiltro.toLowerCase()) ||
                                  (aluno.email ?? aluno.usuario ?? "")
                                    .toLowerCase()
                                    .includes(alunoFiltro.toLowerCase())
                              )
                              .map((aluno) => (
                                <option key={aluno.id} value={aluno.id}>
                                  {aluno.nome} ({aluno.email ?? aluno.usuario ?? "-"})
                                </option>
                              ))}
                          </AnimatedSelect>
                          <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                            Segure Ctrl/Cmd para selecionar mÃºltiplos alunos
                          </small>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* AVISO: Tipo "Nenhum" nÃ£o pode ser publicado */}
                {componenteInterativo === "nenhum" && (
                  <ConditionalFieldAnimation isVisible={true} duration={0.3}>
                    <div style={{
                      padding: "12px",
                      marginBottom: "12px",
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: "6px",
                      color: "#dc2626",
                      fontSize: "13px",
                      fontWeight: "500",
                    }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> <strong>Tipo "Nenhum"</strong></span> Ã© apenas um seletor para alunos. NÃ£o Ã© possÃ­vel publicar um exercÃ­cio com este tipo. Escolha um tipo vÃ¡lido: CÃ³digo, Escrita ou DigitaÃ§Ã£o.
                    </div>
                  </ConditionalFieldAnimation>
                )}

                <div style={{ display: "flex", gap: "12px" }}>
                  <AnimatedButton
                    className="exSubmitBtn"
                    onClick={handleSubmit}
                    disabled={disabled}
                    loading={saving}
                    style={{ flex: 1 }}
                  >
                    {editandoId
                      ? iconLabel(<Save size={16} />, "Atualizar ExercÃ­cio")
                      : iconLabel(<Sparkles size={16} />, "Publicar ExercÃ­cio")}
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

                <div className="exFormNote">
                  {iconLabel(<Lightbulb size={16} />, "ExercÃ­cios podem ser publicados para turmas, alunos especÃ­ficos ou para todos.")}
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
                placeholder="Filtrar usuários por nome ou e-mail"
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
                <option value="5">5 por página</option>
                <option value="10">10 por página</option>
                <option value="20">20 por página</option>
              </select>
            </div>

            {loadingRespostasAlunos ? (
              <div className="loadingState">
                <div className="spinner" />
                Carregando usuários...
              </div>
            ) : respostasAlunos.length === 0 ? (
              <div className="emptyState">Nenhum usuário respondeu ainda (tabela answer).</div>
            ) : (
              <>
                <div className="responsesSummaryTop">
                  <strong>{respostasAlunoPagination.total} usuário(s) com respostas</strong>
                  <span>
                    Página {respostasAlunoPagination.page} de {respostasAlunoPagination.totalPages}
                  </span>
                </div>

                <div className="responsesStudentsList">
                  {respostasAlunos.map((aluno) => {
                    const aberto = respostasAlunoAbertoId === aluno.id;
                    return (
                      <div key={aluno.id} className={`responsesStudentItem ${aberto ? "isOpen" : ""}`}>
                        <button
                          type="button"
                          className="responsesStudentToggle"
                          onClick={() => toggleRespostasAluno(aluno.id)}
                        >
                          <div>
                            <div className="responsesStudentName">{aluno.nome}</div>
                            <div className="responsesStudentEmail">{aluno.email || "Sem e-mail/usuário"}</div>
                          </div>
                          <div className="responsesStudentMeta">
                            <span>{aluno.totalRespostas} resposta(s)</span>
                            <span>{aluno.totalExercicios} exercício(s)</span>
                            <span>
                              {aluno.lastAnsweredAt
                                ? `Última: ${new Date(aluno.lastAnsweredAt).toLocaleDateString("pt-BR")}`
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
                                placeholder="Filtrar exercícios deste usuário"
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
                                <option value="5">5 por página</option>
                                <option value="10">10 por página</option>
                                <option value="20">20 por página</option>
                              </select>
                            </div>

                            {loadingRespostasExercicios ? (
                              <div className="loadingState responsesInnerLoading">
                                <div className="spinner" />
                                Carregando exercícios...
                              </div>
                            ) : respostasExerciciosAluno.length === 0 ? (
                              <div className="emptyState">Este usuário ainda não possui exercícios respondidos.</div>
                            ) : (
                              <div className="responsesExercisesList">
                                {respostasExerciciosAluno.map((exercicio) => {
                                  const directKey = getRespostasDiretasKey(aluno.id, exercicio.id);
                                  const respostasDiretas = respostasDiretasPorExercicio[directKey] ?? [];
                                  const carregandoRespostasDiretas = loadingRespostasDiretas[directKey] ?? false;
                                  const seletorValue = seletorRespostaDireta[directKey] ?? "";

                                  return (
                                    <div key={exercicio.id} className="responsesExerciseItem">
                                      <div>
                                        <div className="responsesExerciseTitle">{exercicio.titulo}</div>
                                        <div className="responsesExerciseMeta">
                                          {[exercicio.modulo, exercicio.tema].filter(Boolean).join(" • ") || "Sem módulo/fase"}
                                        </div>
                                        <div className="responsesExerciseMeta">
                                          {exercicio.lastAnsweredAt
                                            ? `Última resposta: ${new Date(exercicio.lastAnsweredAt).toLocaleString("pt-BR")}`
                                            : "Sem data"}
                                        </div>
                                      </div>

                                      <div className="responsesExerciseActions">
                                        <select
                                          className="exSelect responsesDirectSelect"
                                          value={seletorValue}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setSeletorRespostaDireta((prev) => ({ ...prev, [directKey]: value }));
                                            if (!value) return;
                                            const [answerIdRaw, questionIdRaw] = value.split(":");
                                            const answerId = Number(answerIdRaw);
                                            const questionId = Number(questionIdRaw);
                                            navigate(`/dashboard/exercicios/${exercicio.id}`, {
                                              state: {
                                                from: location.pathname,
                                                fromSection: "respostas",
                                                prefilterAlunoId: aluno.id,
                                                prefilterAnswerId: Number.isFinite(answerId) ? answerId : null,
                                                prefilterQuestionId: Number.isFinite(questionId) ? questionId : null,
                                              },
                                            });
                                          }}
                                          disabled={carregandoRespostasDiretas || respostasDiretas.length === 0}
                                        >
                                          <option value="">
                                            {carregandoRespostasDiretas
                                              ? "Carregando respostas..."
                                              : respostasDiretas.length > 0
                                                ? "Ir direto para resposta"
                                                : "Sem respostas listadas"}
                                          </option>
                                          {respostasDiretas.map((resposta) => (
                                            <option
                                              key={resposta.answerId}
                                              value={`${resposta.answerId}:${resposta.questionId}`}
                                            >
                                              {`Resposta #${resposta.answerId} • Pergunta ${resposta.questionId} • ${resposta.answeredAt ? new Date(resposta.answeredAt).toLocaleDateString("pt-BR") : "Sem data"}`}
                                            </option>
                                          ))}
                                        </select>

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
                                  Página {respostasExercicioPagination.page} de {respostasExercicioPagination.totalPages} ({respostasExercicioPagination.total} exercícios)
                                </span>
                                <button
                                  type="button"
                                  className="responsesPageBtn"
                                  disabled={respostasExercicioPage >= respostasExercicioPagination.totalPages}
                                  onClick={() =>
                                    setRespostasExercicioPage((p) => Math.min(respostasExercicioPagination.totalPages, p + 1))
                                  }
                                >
                                  Próxima
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
                    {respostasAlunoPagination.total} usuário(s)
                  </span>
                  <button
                    type="button"
                    className="responsesPageBtn"
                    disabled={respostasAlunoPage >= respostasAlunoPagination.totalPages}
                    onClick={() => setRespostasAlunoPage((p) => Math.min(respostasAlunoPagination.totalPages, p + 1))}
                  >
                    Próxima
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {/* FILTROS DE EXERCÃCIOS */}
        {(activeSection === "lista" || activeSection === "tarefa-diaria") && (
          <>
            <div className="filtersSection">
              {/* Linha 1: Busca por tÃ­tulo */}
              <div className="filterRow">
                <div className="filterGroup" style={{ flex: 1 }}>
                  <input
                    className="exInput"
                    type="text"
                    placeholder={activeSection === "tarefa-diaria" ? "Buscar tarefa diÃ¡ria..." : "Buscar por tÃ­tulo..."}
                    value={buscaFiltro}
                    onChange={(e) => setBuscaFiltro(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {/* Linha 2: MÃ³dulo, Tipo, Turmas, Aluno */}
              <div className="filterRow" style={{ gap: "12px" }}>
                {/* Filtro de modulo */}
                <div className="filterGroup">
                  <select
                    className="exSelect"
                    value={moduloFiltro}
                    onChange={(e) => setModuloFiltro(e.target.value)}
                    style={{ minWidth: 160 }}
                  >
                    <option value="">Todos os MÃ³dulos</option>
                    {Array.from(new Set(sourceItems.map((ex) => ex.modulo)))
                      .sort()
                      .map((mod) => (
                        <option key={mod} value={mod}>
                          {mod}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Filtro de tipo */}
                <div className="filterGroup">
                  <select
                    className="exSelect"
                    value={tipoFiltro}
                    onChange={(e) => setTipoFiltro(e.target.value)}
                    style={{ minWidth: 160 }}
                  >
                    <option value="">Todos os Tipos</option>
                    <option value="codigo">CÃ³digo</option>
                    <option value="texto">Texto</option>
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

            {/* LISTA DE EXERCÃCIOS */}
            <div>
              {loading && sourceItems.length === 0 ? (
                <div className="loadingState">
                  <div className="spinner" />
                  Carregando exercÃ­cios...
                </div>
              ) : !loading && sourceItems.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyIcon" style={{ display: "inline-flex" }}><BookOpen size={22} /></div>
                  <div className="emptyTitle">Nenhum exercÃ­cio disponÃ­vel</div>
                  <p style={{ margin: "8px 0 0 0", color: "var(--muted)" }}>
                    Volte mais tarde para novos exercÃ­cios!
                  </p>
                </div>
              ) : (
                <>
                  {/* Filtros e PaginaÃ§Ã£o */}
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

                        // Filtro de tipo
                        if (tipoFiltro && ex.tipoExercicio !== tipoFiltro) {
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
                                ? "Nenhuma tarefa diÃ¡ria encontrada"
                                : "Nenhum exercÃ­cio encontrado"}
                            </div>
                            <p style={{ margin: "8px 0 0 0", color: "var(--muted)" }}>
                              {activeSection === "tarefa-diaria"
                                ? "Nenhuma tarefa diÃ¡ria foi retornada do banco para os filtros selecionados."
                                : "Ajuste os filtros e tente novamente."}
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
                                ? "DisponÃ­vel apenas para vocÃª"
                                : alunoNames.length > 0
                                  ? `DisponÃ­vel apenas para: ${alunoNames.join(", ")}`
                                  : "DisponÃ­vel para aluno(s) especÃ­fico(s)";
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
                                                title="Rascunho - nÃ£o visÃ­vel para alunos"
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
                                                title="ExercÃ­cio programado para publicaÃ§Ã£o"
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
                                            title="Editar exercÃ­cio"
                                          >
                                            <Pencil size={14} />
                                          </button>
                                          <button
                                            className="exerciseDeleteBtn"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDelete(ex.id);
                                            }}
                                            title="Deletar exercÃ­cio"
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
                                      <span className="exerciseAccessBadge isAll" title="DisponÃ­vel para todos os alunos">
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

        {/* MODAL DE CONFIRMAÃ‡ÃƒO PARA DELETAR */}
        <ConfirmModal
          isOpen={modalDeletar.isOpen}
          title="Deletar ExercÃ­cio"
          message={`Tem certeza que deseja deletar "${modalDeletar.exercicioTitulo}"? Esta aÃ§Ã£o nÃ£o pode ser desfeita e todas as submissÃµes serÃ£o perdidas.`}
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

