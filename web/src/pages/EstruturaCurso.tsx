import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import PaginatedSelect from "../components/PaginatedSelect";
import {
  listarCursos,
  criarCurso,
  listarModulosPorCurso,
  listarFasesDoModulo,
  criarModulo,
  criarFase,
  deletarCurso,
  deletarModulo,
  deletarFase,
  reordenarModulo,
  reordenarFase,
  obterEstruturaStats,
  listarExerciciosPorFase,
  reordenarExercicio,
  listarContainersPorFase,
  criarContainer,
  adicionarExerciciosAoContainer,
  removerExercicioDoContainer,
  deletarContainerGroup,
  type Curso,
  type Modulo,
  type Fase,
  type ExercicioFase,
  type ContainerGroup,
} from "../services/api";
import { AnimatedButton, AnimatedToast } from "../components/animate-ui";
import { Loader2, Plus, Layers, GitBranch, Trash2, PenLine, School, ChevronUp, ChevronDown, Eye, Package, RefreshCw } from "lucide-react";
import CriarExercicioForm from "../components/CriarExercicioForm";
import CriarTurmaForm from "../components/CriarTurmaForm";

type AbaEstrutura = "curso" | "modulo" | "fase" | "exercicios" | "conteiners" | "turmas";
type AbaTipoContainer = "normal" | "daily";
type DetalheModalState =
  | { tipo: "curso"; item: Curso }
  | { tipo: "modulo"; item: Modulo }
  | { tipo: "fase"; item: Fase }
  | null;

type ContainerConfirmState =
  | { tipo: "delete-container"; container: ContainerGroup }
  | { tipo: "remove-exercise"; containerTaskId: string; exerciseTitle: string }
  | null;

export default function EstruturaCursoPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [toastMsg, setToastMsg] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [cursos, setCursos] = React.useState<Curso[]>([]);
  const [totalCursos, setTotalCursos] = React.useState(0);
  const [carregandoCursos, setCarregandoCursos] = React.useState(false);
  const [courseIdSelecionado, setCourseIdSelecionado] = React.useState("");

  const [modulosCurso, setModulosCurso] = React.useState<Modulo[]>([]);
  const [totalModulos, setTotalModulos] = React.useState(0);
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");

  const [fasesModulo, setFasesModulo] = React.useState<Fase[]>([]);
  const [totalFases, setTotalFases] = React.useState(0);

  // Global stats for overview cards
  const [globalStats, setGlobalStats] = React.useState({ cursos: 0, modulos: 0, fases: 0 });
  const [cursoSelectOpcoes, setCursoSelectOpcoes] = React.useState<Curso[]>([]);
  const [cursoSelectBusca, setCursoSelectBusca] = React.useState("");
  const [cursoSelectPagina, setCursoSelectPagina] = React.useState(1);
  const [cursoSelectTotalPages, setCursoSelectTotalPages] = React.useState(1);
  const [cursoSelectCarregando, setCursoSelectCarregando] = React.useState(false);
  const [cursoSelectSelecionado, setCursoSelectSelecionado] = React.useState<Curso | null>(null);
  const [moduloSelectOpcoes, setModuloSelectOpcoes] = React.useState<Modulo[]>([]);
  const [moduloSelectBusca, setModuloSelectBusca] = React.useState("");
  const [moduloSelectPagina, setModuloSelectPagina] = React.useState(1);
  const [moduloSelectTotalPages, setModuloSelectTotalPages] = React.useState(1);
  const [moduloSelectCarregando, setModuloSelectCarregando] = React.useState(false);
  const [moduloSelectSelecionado, setModuloSelectSelecionado] = React.useState<Modulo | null>(null);

  const [novoCursoNome, setNovoCursoNome] = React.useState("");
  const [novoCursoDescricao, setNovoCursoDescricao] = React.useState("");
  const [novoCursoPago, setNovoCursoPago] = React.useState(false);
  const [novoCursoDuracao, setNovoCursoDuracao] = React.useState<number | "">("");
  const [novoCursoNivel, setNovoCursoNivel] = React.useState("");
  const [novoCursoFoco, setNovoCursoFoco] = React.useState("");
  const [novoCursoPreco, setNovoCursoPreco] = React.useState<number | "">("");
  const [criandoCurso, setCriandoCurso] = React.useState(false);

  const [novoModuloNome, setNovoModuloNome] = React.useState("");
  const [novoModuloDescricao, setNovoModuloDescricao] = React.useState("");
  const [criandoModulo, setCriandoModulo] = React.useState(false);

  const [novaFaseNome, setNovaFaseNome] = React.useState("");
  const [novaFaseWeek, setNovaFaseWeek] = React.useState(1);
  const [criandoFase, setCriandoFase] = React.useState(false);

  const [filtroCursoId, _setFiltroCursoId] = React.useState("");
  const [paginaCursos, setPaginaCursos] = React.useState(1);
  const [itensCursos, setItensCursos] = React.useState(5);

  const [filtroModuloId, setFiltroModuloId] = React.useState("");
  const [paginaModulos, setPaginaModulos] = React.useState(1);
  const [itensModulos, setItensModulos] = React.useState(5);

  const [carregandoModulos, setCarregandoModulos] = React.useState(false);
  const [carregandoFases, setCarregandoFases] = React.useState(false);
  const [reordenando, setReordenando] = React.useState(false);

  const [filtroFaseId, setFiltroFaseId] = React.useState("");
  const [paginaFases, setPaginaFases] = React.useState(1);
  const [itensFases, setItensFases] = React.useState(5);
  const [detalheModal, setDetalheModal] = React.useState<DetalheModalState>(null);
  const [confirmarDeleteDetalhe, setConfirmarDeleteDetalhe] = React.useState(false);
  const [deletandoDetalhe, setDeletandoDetalhe] = React.useState(false);

  // Exercises for selected phase
  const [exerciciosFase, setExerciciosFase] = React.useState<ExercicioFase[]>([]);
  const [faseIdParaExercicios, setFaseIdParaExercicios] = React.useState("");

  // Container state
  const [containers, setContainers] = React.useState<ContainerGroup[]>([]);
  const [carregandoContainers, setCarregandoContainers] = React.useState(false);
  const [faseIdParaContainers, setFaseIdParaContainers] = React.useState("");
  const [exerciciosDispContainer, setExerciciosDispContainer] = React.useState<ExercicioFase[]>([]);
  const [novoContainerNome, setNovoContainerNome] = React.useState("");
  const [novoContainerDia, setNovoContainerDia] = React.useState<number | "">(1);
  const [novoContainerIsDailyTask, setNovoContainerIsDailyTask] = React.useState(false);
  const [novoContainerExerciseIds, setNovoContainerExerciseIds] = React.useState<string[]>([]);
  const [criandoContainer, setCriandoContainer] = React.useState(false);
  const [paginaContainers, setPaginaContainers] = React.useState(1);
  const [itensContainers, setItensContainers] = React.useState(5);
  const [abaTipoContainer, setAbaTipoContainer] = React.useState<AbaTipoContainer>("normal");
  const [containerEditorKey, setContainerEditorKey] = React.useState<string | null>(null);
  const [containerEditorExerciseIds, setContainerEditorExerciseIds] = React.useState<string[]>([]);
  const [salvandoContainerEditor, setSalvandoContainerEditor] = React.useState(false);
  const [atualizandoContainers, setAtualizandoContainers] = React.useState(false);
  const [containerConfirmState, setContainerConfirmState] = React.useState<ContainerConfirmState>(null);
  const [processandoContainerConfirm, setProcessandoContainerConfirm] = React.useState(false);

  const CONTAINER_BLOCKED_DIFFICULTIES = React.useMemo(() => new Set([2, 3, 4]), []);
  const CONTAINER_BLOCKED_TYPE_EXERCISES = React.useMemo(() => new Set([3]), []);
  const CONTAINER_BLOCKED_MESSAGE = "Lower, Prova Semanal, exercícios com dificuldade 4 e exercícios com type_exercise 3 não podem ser adicionados em container";

  const isContainerExerciseAllowed = React.useCallback(
    (exercicio: ExercicioFase) =>
      !CONTAINER_BLOCKED_DIFFICULTIES.has(exercicio.difficulty ?? 1) &&
      !CONTAINER_BLOCKED_TYPE_EXERCISES.has(exercicio.typeExercise ?? -1),
    [CONTAINER_BLOCKED_DIFFICULTIES, CONTAINER_BLOCKED_TYPE_EXERCISES]
  );

  const abaAtiva: AbaEstrutura = React.useMemo(() => {
    if (location.pathname.endsWith("/modulos")) return "modulo";
    if (location.pathname.endsWith("/fases")) return "fase";
    if (location.pathname.endsWith("/exercicios")) return "exercicios";
    if (location.pathname.endsWith("/conteiners")) return "conteiners";
    if (location.pathname.endsWith("/turmas")) return "turmas";
    return "curso";
  }, [location.pathname]);

  const rotaAba = (aba: AbaEstrutura) => {
    if (aba === "modulo") return "/dashboard/estrutura-curso/modulos";
    if (aba === "fase") return "/dashboard/estrutura-curso/fases";
    if (aba === "exercicios") return "/dashboard/estrutura-curso/exercicios";
    if (aba === "conteiners") return "/dashboard/estrutura-curso/conteiners";
    if (aba === "turmas") return "/dashboard/estrutura-curso/turmas";
    return "/dashboard/estrutura-curso/cursos";
  };

  const carregarCursos = React.useCallback(async () => {
    try {
      setCarregandoCursos(true);
      const response = await listarCursos({
        page: paginaCursos,
        limit: itensCursos,
      });
      const items = response.items;
      setCursos(items);
      setTotalCursos(response.total);
      setCourseIdSelecionado((prev) => (items.some((c) => c.id === prev) ? prev : items[0]?.id || ""));
      if (paginaCursos > response.pagination.totalPages) {
        setPaginaCursos(response.pagination.totalPages);
      }
    } finally {
      setCarregandoCursos(false);
    }
  }, [itensCursos, paginaCursos]);

  React.useEffect(() => {
    carregarCursos().catch((e) =>
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao carregar cursos" })
    );
  }, [carregarCursos]);

  // Load global stats
  const carregarStats = React.useCallback(() => {
    obterEstruturaStats()
      .then(setGlobalStats)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    carregarStats();
  }, [carregarStats]);

  React.useEffect(() => {
    let ativo = true;

    setCursoSelectCarregando(true);
    listarCursos({ page: cursoSelectPagina, limit: 8, q: cursoSelectBusca || undefined, isPaid: false })
      .then((data) => {
        if (!ativo || Array.isArray(data)) return;
        setCursoSelectOpcoes(data.items);
        setCursoSelectTotalPages(data.pagination.totalPages);
        if (!courseIdSelecionado && data.items.length > 0) {
          setCourseIdSelecionado(data.items[0].id);
        }
      })
      .catch(() => {
        if (!ativo) return;
        setCursoSelectOpcoes([]);
        setCursoSelectTotalPages(1);
      })
      .finally(() => {
        if (ativo) setCursoSelectCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [courseIdSelecionado, cursoSelectBusca, cursoSelectPagina]);

  React.useEffect(() => {
    const fromMainList = cursos.find((curso) => curso.id === courseIdSelecionado) ?? null;
    const fromSelectList = cursoSelectOpcoes.find((curso) => curso.id === courseIdSelecionado) ?? null;
    setCursoSelectSelecionado((prev) => fromMainList ?? fromSelectList ?? prev);
  }, [courseIdSelecionado, cursoSelectOpcoes, cursos]);

  const cursoSelectOpcoesGratuitas = React.useMemo(
    () => cursoSelectOpcoes.filter((curso) => !curso.isPaid),
    [cursoSelectOpcoes]
  );

  const cursoSelectSelecionadoGratuito = React.useMemo(
    () => cursoSelectOpcoesGratuitas.find((curso) => curso.id === courseIdSelecionado) ?? null,
    [courseIdSelecionado, cursoSelectOpcoesGratuitas]
  );

  React.useEffect(() => {
    if (abaAtiva !== "fase" && abaAtiva !== "conteiners") return;
    if (courseIdSelecionado && cursoSelectOpcoesGratuitas.some((curso) => curso.id === courseIdSelecionado)) return;

    const nextCourseId = cursoSelectOpcoesGratuitas[0]?.id ?? "";
    if (courseIdSelecionado !== nextCourseId) {
      setCourseIdSelecionado(nextCourseId);
    }
  }, [abaAtiva, courseIdSelecionado, cursoSelectOpcoesGratuitas]);

  React.useEffect(() => {
    if (!courseIdSelecionado) {
      setModuloSelectOpcoes([]);
      setModuloSelectBusca("");
      setModuloSelectPagina(1);
      setModuloSelectTotalPages(1);
      setModuloSelectSelecionado(null);
      return;
    }

    let ativo = true;
    setModuloSelectCarregando(true);

    listarModulosPorCurso(courseIdSelecionado, {
      page: moduloSelectPagina,
      limit: 8,
      q: moduloSelectBusca || undefined,
    })
      .then((data) => {
        if (!ativo || Array.isArray(data)) return;
        setModuloSelectOpcoes(data.items);
        setModuloSelectTotalPages(data.pagination.totalPages);
      })
      .catch(() => {
        if (!ativo) return;
        setModuloSelectOpcoes([]);
        setModuloSelectTotalPages(1);
      })
      .finally(() => {
        if (ativo) setModuloSelectCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [courseIdSelecionado, moduloSelectBusca, moduloSelectPagina]);

  React.useEffect(() => {
    if (!courseIdSelecionado) {
      setModulosCurso([]);
      setTotalModulos(0);
      setModuloIdSelecionado("");
      return;
    }

    setCarregandoModulos(true);
    listarModulosPorCurso(courseIdSelecionado, { page: paginaModulos, limit: itensModulos })
      .then((response) => {
        const mods = response.items;
        setModulosCurso(mods);
        setTotalModulos(response.total);
        setModuloIdSelecionado((prev) => (mods.some((m) => m.id === prev) ? prev : mods[0]?.id || ""));
        if (paginaModulos > response.pagination.totalPages) {
          setPaginaModulos(response.pagination.totalPages);
        }
      })
      .catch((e) => setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao carregar modulos" }))
      .finally(() => setCarregandoModulos(false));
  }, [courseIdSelecionado, itensModulos, paginaModulos]);

  React.useEffect(() => {
    if (!moduloIdSelecionado) {
      setFasesModulo([]);
      setTotalFases(0);
      return;
    }

    setCarregandoFases(true);
    listarFasesDoModulo(moduloIdSelecionado, { page: paginaFases, limit: itensFases })
      .then((response) => {
        setFasesModulo(response.items);
        setTotalFases(response.total);
        if (paginaFases > response.pagination.totalPages) {
          setPaginaFases(response.pagination.totalPages);
        }
      })
      .catch((e) => setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao carregar fases" }))
      .finally(() => setCarregandoFases(false));
  }, [itensFases, moduloIdSelecionado, paginaFases]);

  React.useEffect(() => setPaginaCursos(1), [filtroCursoId, itensCursos]);
  React.useEffect(() => setPaginaModulos(1), [filtroModuloId, courseIdSelecionado, itensModulos]);
  React.useEffect(() => setPaginaFases(1), [filtroFaseId, moduloIdSelecionado, itensFases]);

  React.useEffect(() => {
    const fromMainList = modulosCurso.find((modulo) => modulo.id === moduloIdSelecionado) ?? null;
    const fromSelectList = moduloSelectOpcoes.find((modulo) => modulo.id === moduloIdSelecionado) ?? null;
    setModuloSelectSelecionado((prev) => fromMainList ?? fromSelectList ?? prev);
  }, [moduloIdSelecionado, moduloSelectOpcoes, modulosCurso]);

  // Load exercises when a phase is clicked for exercise list view
  React.useEffect(() => {
    if (!faseIdParaExercicios) {
      setExerciciosFase([]);
      return;
    }
    listarExerciciosPorFase(faseIdParaExercicios)
      .then(setExerciciosFase)
      .catch(() => setExerciciosFase([]));
  }, [faseIdParaExercicios]);

  async function handleReordenarExercicio(id: string, direction: "up" | "down") {
    if (reordenando) return;
    try {
      setReordenando(true);
      await reordenarExercicio(id, direction);
      if (faseIdParaExercicios) {
        const updated = await listarExerciciosPorFase(faseIdParaExercicios);
        setExerciciosFase(updated);
      }
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao reordenar exercício" });
    } finally {
      setReordenando(false);
    }
  }

  const refreshContainersData = React.useCallback(async (phaseId: string, options?: { showLoading?: boolean; silent?: boolean }) => {
    const { showLoading = false, silent = false } = options ?? {};

    if (showLoading) {
      setCarregandoContainers(true);
    } else {
      setAtualizandoContainers(true);
    }

    try {
      const [updatedContainers, updatedExercises] = await Promise.all([
        listarContainersPorFase(phaseId),
        listarExerciciosPorFase(phaseId, { difficulty: 1 }),
      ]);
      setContainers(updatedContainers);
      setExerciciosDispContainer(updatedExercises);
    } catch (e) {
      if (showLoading) {
        setContainers([]);
        setExerciciosDispContainer([]);
      }
      if (!silent) {
        setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao atualizar containers" });
      }
    } finally {
      if (showLoading) {
        setCarregandoContainers(false);
      } else {
        setAtualizandoContainers(false);
      }
    }
  }, []);

  // Container effects
  React.useEffect(() => {
    if (!faseIdParaContainers) {
      setContainers([]);
      setExerciciosDispContainer([]);
      setPaginaContainers(1);
      setContainerEditorKey(null);
      setContainerEditorExerciseIds([]);
      return;
    }
    void refreshContainersData(faseIdParaContainers, { showLoading: true, silent: true });
  }, [faseIdParaContainers, refreshContainersData]);

  React.useEffect(() => {
    setPaginaContainers(1);
  }, [abaTipoContainer, faseIdParaContainers, itensContainers]);

  React.useEffect(() => {
    const totalContainersFiltrados = containers.filter((container) =>
      abaTipoContainer === "daily" ? container.isDailyTask : !container.isDailyTask
    ).length;
    const totalPages = Math.max(1, Math.ceil(totalContainersFiltrados / itensContainers));
    if (paginaContainers > totalPages) {
      setPaginaContainers(totalPages);
    }
  }, [abaTipoContainer, containers, itensContainers, paginaContainers]);

  function handleReordenarNovoContainerExercise(id: string, direction: "up" | "down") {
    setNovoContainerExerciseIds((prev) => {
      const currentIndex = prev.findIndex((itemId) => itemId === id);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      return next;
    });
  }

  async function handleCriarContainer(e: React.FormEvent) {
    e.preventDefault();
    if (!faseIdParaContainers || !novoContainerNome.trim() || novoContainerExerciseIds.length === 0) {
      setToastMsg({ type: "error", msg: "Preencha nome, selecione fase e exercícios" });
      return;
    }
    try {
      setCriandoContainer(true);
      const exerciseIdsPermitidos = novoContainerExerciseIds
        .map((id) => exerciciosDispContainer.find((ex) => ex.id === id))
        .filter(
          (ex): ex is ExercicioFase => {
            if (!ex) return false;
            return isContainerExerciseAllowed(ex);
          }
        )
        .map((ex) => Number(ex.id));

      if (exerciseIdsPermitidos.length !== novoContainerExerciseIds.length) {
        setToastMsg({ type: "error", msg: CONTAINER_BLOCKED_MESSAGE });
        return;
      }

      if (exerciseIdsPermitidos.length === 0) {
        setToastMsg({ type: "error", msg: CONTAINER_BLOCKED_MESSAGE });
        return;
      }

      await criarContainer({
        name: novoContainerNome.trim(),
        phase_id: Number(faseIdParaContainers),
        exercise_ids: exerciseIdsPermitidos,
        is_daily_task: novoContainerIsDailyTask,
        container_date_target_int: novoContainerDia || null,
      });
      setNovoContainerNome("");
      setNovoContainerDia(1);
      setNovoContainerExerciseIds([]);
      setNovoContainerIsDailyTask(false);
      setToastMsg({ type: "success", msg: "Container criado com sucesso!" });
      const updated = await listarContainersPorFase(faseIdParaContainers);
      setContainers(updated);
    } catch (err) {
      setToastMsg({ type: "error", msg: err instanceof Error ? err.message : "Erro ao criar container" });
    } finally {
      setCriandoContainer(false);
    }
  }

  function handleDeletarContainer(container: ContainerGroup) {
    setContainerConfirmState({ tipo: "delete-container", container });
  }

  async function handleConfirmContainerAction() {
    if (!containerConfirmState || !faseIdParaContainers) return;

    try {
      setProcessandoContainerConfirm(true);

      if (containerConfirmState.tipo === "delete-container") {
        const { container } = containerConfirmState;
        await deletarContainerGroup({
          name: container.name,
          phase_id: Number(container.phaseId),
          container_date_target_int: container.containerDateTargetInt,
          is_daily_task: container.isDailyTask,
        });
        setToastMsg({ type: "success", msg: "Container deletado" });
      } else {
        await removerExercicioDoContainer(containerConfirmState.containerTaskId);
        setToastMsg({ type: "success", msg: "Exercício removido do container" });
      }

      await refreshContainersData(faseIdParaContainers, { silent: true });
      setContainerConfirmState(null);
    } catch (err) {
      setToastMsg({
        type: "error",
        msg: err instanceof Error
          ? err.message
          : containerConfirmState.tipo === "delete-container"
            ? "Erro ao deletar container"
            : "Erro ao remover exercício do container",
      });
    } finally {
      setProcessandoContainerConfirm(false);
    }
  }

  function getContainerGroupKey(container: ContainerGroup) {
    return `${container.phaseId}|${container.name}|${container.containerDateTargetInt ?? "null"}|${container.isDailyTask ? "daily" : "normal"}`;
  }

  const containersFiltradosPorTipo = React.useMemo(
    () => containers.filter((container) => (abaTipoContainer === "daily" ? container.isDailyTask : !container.isDailyTask)),
    [abaTipoContainer, containers]
  );

  const containerEditorSelecionado = React.useMemo(
    () => containers.find((container) => getContainerGroupKey(container) === containerEditorKey) ?? null,
    [containers, containerEditorKey]
  );

  React.useEffect(() => {
    if (!containerEditorKey) return;
    const existeNaAba = containersFiltradosPorTipo.some(
      (container) => getContainerGroupKey(container) === containerEditorKey
    );
    if (!existeNaAba) {
      setContainerEditorKey(null);
      setContainerEditorExerciseIds([]);
    }
  }, [containerEditorKey, containersFiltradosPorTipo]);

  function handleToggleContainerEditorGlobal() {
    if (containerEditorKey) {
      setContainerEditorKey(null);
      setContainerEditorExerciseIds([]);
      return;
    }

    const primeiroContainer = containersFiltradosPorTipo[0];
    if (!primeiroContainer) return;
    setContainerEditorKey(getContainerGroupKey(primeiroContainer));
  }

  async function handleAdicionarExerciciosNoContainer() {
    if (!containerEditorSelecionado) {
      setToastMsg({ type: "error", msg: "Selecione um container para adicionar exercícios" });
      return;
    }

    if (containerEditorExerciseIds.length === 0) {
      setToastMsg({ type: "error", msg: "Selecione ao menos um exercício para adicionar" });
      return;
    }

    try {
      setSalvandoContainerEditor(true);
      const exerciseIdsPermitidos = containerEditorExerciseIds
        .map((id) => exerciciosDispContainer.find((ex) => ex.id === id))
        .filter(
          (ex): ex is ExercicioFase => {
            if (!ex) return false;
            return isContainerExerciseAllowed(ex);
          }
        )
        .map((ex) => Number(ex.id));

      if (exerciseIdsPermitidos.length !== containerEditorExerciseIds.length) {
        setToastMsg({ type: "error", msg: CONTAINER_BLOCKED_MESSAGE });
        return;
      }

      if (exerciseIdsPermitidos.length === 0) {
        setToastMsg({ type: "error", msg: CONTAINER_BLOCKED_MESSAGE });
        return;
      }

      await adicionarExerciciosAoContainer({
        name: containerEditorSelecionado.name,
        phase_id: Number(containerEditorSelecionado.phaseId),
        container_date_target_int: containerEditorSelecionado.containerDateTargetInt,
        is_daily_task: containerEditorSelecionado.isDailyTask,
        exercise_ids: exerciseIdsPermitidos,
      });

      const updated = await listarContainersPorFase(containerEditorSelecionado.phaseId);
      setContainers(updated);
      setContainerEditorExerciseIds([]);
      setToastMsg({ type: "success", msg: "Exercícios adicionados ao container" });
    } catch (err) {
      setToastMsg({ type: "error", msg: err instanceof Error ? err.message : "Erro ao adicionar exercícios no container" });
    } finally {
      setSalvandoContainerEditor(false);
    }
  }

  async function handleReordenarExercicioContainer(exerciseId: string, direction: "up" | "down") {
    if (reordenando || !faseIdParaContainers) return;
    try {
      setReordenando(true);
      await reordenarExercicio(exerciseId, direction);
      const [updatedContainers, updatedExercises] = await Promise.all([
        listarContainersPorFase(faseIdParaContainers),
        listarExerciciosPorFase(faseIdParaContainers, { difficulty: 1 }),
      ]);
      setContainers(updatedContainers);
      setExerciciosDispContainer(updatedExercises);
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao reordenar exercício do container" });
    } finally {
      setReordenando(false);
    }
  }

  function handleRemoveExercicioFromContainer(containerTaskId: string, exerciseTitle: string) {
    if (reordenando || !faseIdParaContainers) return;
    setContainerConfirmState({ tipo: "remove-exercise", containerTaskId, exerciseTitle });
  }

  async function handleCriarCurso(e: React.FormEvent) {
    e.preventDefault();
    if (!novoCursoNome.trim()) {
      setToastMsg({ type: "error", msg: "Informe o nome do curso" });
      return;
    }

    try {
      setCriandoCurso(true);
      const result = await criarCurso({
        nome: novoCursoNome.trim(),
        descricao: novoCursoDescricao.trim() || null,
        is_paid: novoCursoPago,
        duration_hours: novoCursoDuracao || null,
        level: novoCursoNivel || null,
        focus: novoCursoPago ? (novoCursoFoco || null) : null,
        price: novoCursoPreco !== "" ? novoCursoPreco : null,
      });

      setNovoCursoNome("");
      setNovoCursoDescricao("");
      setNovoCursoPago(false);
      setNovoCursoDuracao("");
      setNovoCursoNivel("");
      setNovoCursoFoco("");
      setNovoCursoPreco("");
      setToastMsg({ type: "success", msg: "Curso criado com sucesso" });

      await carregarCursos();
      carregarStats();
      setCursoSelectPagina(1);
      if (result.curso?.id) {
        setCourseIdSelecionado(result.curso.id);
        setCursoSelectSelecionado(result.curso);
      }
      navigate(rotaAba("modulo"));
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao criar curso" });
    } finally {
      setCriandoCurso(false);
    }
  }

  async function handleCriarModulo(e: React.FormEvent) {
    e.preventDefault();
    if (!courseIdSelecionado || !novoModuloNome.trim()) {
      setToastMsg({ type: "error", msg: "Selecione o curso e informe o nome do módulo" });
      return;
    }

    try {
      setCriandoModulo(true);
      const result = await criarModulo({
        nome: novoModuloNome.trim(),
        descricao: novoModuloDescricao.trim() || null,
        course_id: Number(courseIdSelecionado),
      });

      setNovoModuloNome("");
      setNovoModuloDescricao("");
      setToastMsg({ type: "success", msg: "Módulo criado com sucesso" });

      const modsResponse = await listarModulosPorCurso(courseIdSelecionado, {
        page: paginaModulos,
        limit: itensModulos,
      });
      const mods = modsResponse.items;
      setModulosCurso(mods);
      setTotalModulos(modsResponse.total);
      carregarStats();
      const nextId = result.modulo.id || mods[0]?.id || "";
      setModuloIdSelecionado(nextId);
      setModuloSelectSelecionado(result.modulo ?? null);
      navigate(rotaAba("fase"));
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao criar módulo" });
    } finally {
      setCriandoModulo(false);
    }
  }

  async function handleCriarFase(e: React.FormEvent) {
    e.preventDefault();
    if (!moduloIdSelecionado || !novaFaseNome.trim()) {
      setToastMsg({ type: "error", msg: "Selecione o módulo e informe o nome da fase" });
      return;
    }

    try {
      setCriandoFase(true);
      await criarFase(moduloIdSelecionado, {
        nome: novaFaseNome.trim(),
        week_number: novaFaseWeek,
      });

      setNovaFaseNome("");
      setNovaFaseWeek((prev) => prev + 1);
      setToastMsg({ type: "success", msg: "Fase criada com sucesso" });

      const fasesResponse = await listarFasesDoModulo(moduloIdSelecionado, {
        page: paginaFases,
        limit: itensFases,
      });
      setFasesModulo(fasesResponse.items);
      setTotalFases(fasesResponse.total);
      carregarStats();
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao criar fase" });
    } finally {
      setCriandoFase(false);
    }
  }

  async function handleReordenarModulo(id: string, direction: "up" | "down") {
    if (reordenando) return;
    try {
      setReordenando(true);
      await reordenarModulo(id, direction);
      const modsResponse = await listarModulosPorCurso(courseIdSelecionado, {
        page: paginaModulos,
        limit: itensModulos,
      });
      setModulosCurso(modsResponse.items);
      setTotalModulos(modsResponse.total);
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao reordenar módulo" });
    } finally {
      setReordenando(false);
    }
  }

  async function handleReordenarFase(id: string, direction: "up" | "down") {
    if (reordenando) return;
    try {
      setReordenando(true);
      await reordenarFase(id, direction);
      const fasesResponse = await listarFasesDoModulo(moduloIdSelecionado, {
        page: paginaFases,
        limit: itensFases,
      });
      setFasesModulo(fasesResponse.items);
      setTotalFases(fasesResponse.total);
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao reordenar fase" });
    } finally {
      setReordenando(false);
    }
  }

  const cursosFiltrados = React.useMemo(() => {
    return cursos.filter((c) => {
      const matchesSelect = !filtroCursoId || c.id === filtroCursoId;
      return matchesSelect;
    });
  }, [cursos, filtroCursoId]);

  const modulosFiltrados = React.useMemo(() => {
    return modulosCurso.filter((m) => {
      const matchesSelect = !filtroModuloId || m.id === filtroModuloId;
      return matchesSelect;
    });
  }, [modulosCurso, filtroModuloId]);

  const fasesFiltradas = React.useMemo(() => {
    return fasesModulo.filter((f) => {
      const matchesSelect = !filtroFaseId || f.id === filtroFaseId;
      return matchesSelect;
    });
  }, [fasesModulo, filtroFaseId]);

  const paginaCursosItens = cursosFiltrados;
  const paginaModulosItens = modulosFiltrados;
  const paginaFasesItens = fasesFiltradas;
  const totalCursosPaginacao = filtroCursoId ? cursosFiltrados.length : totalCursos;
  const totalModulosPaginacao = filtroModuloId ? modulosFiltrados.length : totalModulos;
  const totalFasesPaginacao = filtroFaseId ? fasesFiltradas.length : totalFases;
  const totalContainersPaginacao = containersFiltradosPorTipo.length;
  const containersPaginados = React.useMemo(() => {
    const start = (paginaContainers - 1) * itensContainers;
    return containersFiltradosPorTipo.slice(start, start + itensContainers);
  }, [containersFiltradosPorTipo, itensContainers, paginaContainers]);
  const exerciciosAlocadosEmContainers = React.useMemo(() => {
    const alocados = new Set<string>();
    for (const container of containers) {
      for (const ex of container.exercises) {
        alocados.add(ex.id);
      }
    }
    return alocados;
  }, [containers]);
  const exerciciosFiltradosNovoContainer = React.useMemo(
    () => exerciciosDispContainer.filter((ex) => (novoContainerIsDailyTask ? ex.isDailyTask === true : ex.isDailyTask !== true)),
    [exerciciosDispContainer, novoContainerIsDailyTask]
  );
  const exerciciosPermitidosNovoContainer = React.useMemo(
    () => exerciciosFiltradosNovoContainer.filter(isContainerExerciseAllowed),
    [exerciciosFiltradosNovoContainer, isContainerExerciseAllowed]
  );
  const exerciciosFiltradosParaAbaContainer = React.useMemo(
    () => exerciciosDispContainer.filter((ex) => (abaTipoContainer === "daily" ? ex.isDailyTask === true : ex.isDailyTask !== true)),
    [abaTipoContainer, exerciciosDispContainer]
  );
  const exerciciosPermitidosContainerEditor = React.useMemo(
    () => exerciciosFiltradosParaAbaContainer.filter(isContainerExerciseAllowed),
    [exerciciosFiltradosParaAbaContainer, isContainerExerciseAllowed]
  );
  const exerciciosPermitidosNaoAlocados = React.useMemo(
    () => exerciciosPermitidosContainerEditor.filter((ex) => !exerciciosAlocadosEmContainers.has(ex.id)),
    [exerciciosAlocadosEmContainers, exerciciosPermitidosContainerEditor]
  );
  const exerciciosDispContainerMap = React.useMemo(
    () => new Map(exerciciosPermitidosNovoContainer.map((ex) => [ex.id, ex])),
    [exerciciosPermitidosNovoContainer]
  );
  const exerciciosSelecionadosContainer = React.useMemo(
    () =>
      novoContainerExerciseIds
        .map((id) => exerciciosDispContainerMap.get(id))
        .filter((ex): ex is ExercicioFase => Boolean(ex)),
    [exerciciosDispContainerMap, novoContainerExerciseIds]
  );

  React.useEffect(() => {
    const exerciciosPermitidosIds = new Set(exerciciosPermitidosNovoContainer.map((ex) => ex.id));
    setNovoContainerExerciseIds((prev) => {
      const next = prev.filter((id) => exerciciosPermitidosIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [exerciciosPermitidosNovoContainer]);

  React.useEffect(() => {
    const exerciciosPermitidosIds = new Set(exerciciosPermitidosNaoAlocados.map((ex) => ex.id));
    setContainerEditorExerciseIds((prev) => {
      const next = prev.filter((id) => exerciciosPermitidosIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [exerciciosPermitidosNaoAlocados]);

  const cursoSelecionado = React.useMemo(
    () => cursos.find((curso) => curso.id === courseIdSelecionado) || null,
    [cursos, courseIdSelecionado]
  );

  const moduloSelecionado = React.useMemo(
    () => modulosCurso.find((modulo) => modulo.id === moduloIdSelecionado) || moduloSelectSelecionado || null,
    [moduloSelectSelecionado, modulosCurso, moduloIdSelecionado]
  );

  async function handleDeletarDetalhe() {
    if (!detalheModal || deletandoDetalhe) return;
    const tipoLabel =
      detalheModal.tipo === "curso"
        ? "curso"
        : detalheModal.tipo === "modulo"
          ? "módulo"
          : "fase";

    try {
      setDeletandoDetalhe(true);

      if (detalheModal.tipo === "curso") {
        await deletarCurso(detalheModal.item.id);
        await carregarCursos();
      } else if (detalheModal.tipo === "modulo") {
        await deletarModulo(detalheModal.item.id);
        if (courseIdSelecionado) {
          const modsResponse = await listarModulosPorCurso(courseIdSelecionado, {
            page: paginaModulos,
            limit: itensModulos,
          });
          const mods = modsResponse.items;
          setModulosCurso(mods);
          setTotalModulos(modsResponse.total);
          const nextId = mods[0]?.id || "";
          setModuloIdSelecionado(nextId);
        } else {
          setModulosCurso([]);
          setTotalModulos(0);
          setModuloIdSelecionado("");
        }
      } else {
        await deletarFase(detalheModal.item.id);
        if (moduloIdSelecionado) {
          const fasesResponse = await listarFasesDoModulo(moduloIdSelecionado, {
            page: paginaFases,
            limit: itensFases,
          });
          setFasesModulo(fasesResponse.items);
          setTotalFases(fasesResponse.total);
        } else {
          setFasesModulo([]);
          setTotalFases(0);
        }
      }

      setToastMsg({ type: "success", msg: `${tipoLabel} deletado com sucesso` });
      setConfirmarDeleteDetalhe(false);
      setDetalheModal(null);
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : `Erro ao deletar ${tipoLabel}` });
    } finally {
      setDeletandoDetalhe(false);
    }
  }

  const stageTabs: Array<{ key: AbaEstrutura; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: "curso", label: "Cursos", icon: Plus },
    { key: "modulo", label: "Módulos", icon: Layers },
    { key: "fase", label: "Fase", icon: GitBranch },
    { key: "exercicios", label: "Exercícios", icon: PenLine },
    { key: "conteiners", label: "Contêiners", icon: Package },
    { key: "turmas", label: "Turmas", icon: School },
  ];

  const pageClass =
    "mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-1.5 font-[Manrope,Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] max-md:gap-3";
  const tabsClass =
    "flex max-w-full flex-wrap items-center gap-2 rounded-[20px] border border-border bg-card p-1.5 max-md:flex-col max-md:items-stretch max-md:rounded-2xl max-md:p-2.5";
  const tabsLabelClass = "px-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase";
  const tabButtonClass = (active: boolean) =>
    cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 max-md:w-full max-md:rounded-xl",
      active
        ? "border-primary/20 bg-primary/10 text-primary shadow-sm"
        : "border-transparent bg-background text-foreground/70 shadow-sm hover:border-border hover:bg-accent"
    );
  const overviewGridClass = "grid gap-2.5 sm:grid-cols-3";
  const overviewCardClass = "flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm";
  const overviewLabelClass = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
  const overviewValueClass = "text-2xl font-bold tracking-tight text-foreground";
  const gridClass = "grid gap-3.5 xl:grid-cols-2";
  const gridTopAlignedClass = cn(gridClass, "items-start");
  const cardClass =
    "flex min-h-fit flex-col rounded-2xl border border-border bg-card p-5 shadow-sm max-md:rounded-xl max-md:p-3.5";
  const cardHeadClass = "mb-3.5";
  const cardTitleClass = "text-[clamp(1.35rem,2.2vw,2rem)] leading-tight font-semibold tracking-tight text-foreground";
  const cardDescriptionClass = "mt-1 text-sm text-muted-foreground";
  const compactTitleClass = "m-0 text-base font-semibold text-foreground";
  const compactDescriptionClass = "m-0 text-xs text-muted-foreground";
  const controlClass =
    "w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm text-foreground transition placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20";
  const selectClass = cn(controlClass, "appearance-none");
  const formClass = cn(
    "flex flex-col gap-2.5",
    "[&>span]:mt-0.5 [&>span]:text-[11px] [&>span]:font-bold [&>span]:uppercase [&>span]:tracking-[0.14em] [&>span]:text-foreground/80",
    "[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-input [&>input]:bg-background [&>input]:px-3.5 [&>input]:py-3 [&>input]:text-sm [&>input]:text-foreground [&>input]:transition [&>input]:placeholder:text-muted-foreground/80 [&>input]:focus-visible:border-ring [&>input]:focus-visible:outline-none [&>input]:focus-visible:ring-4 [&>input]:focus-visible:ring-ring/20",
    "[&>textarea]:min-h-24 [&>textarea]:w-full [&>textarea]:resize-y [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-input [&>textarea]:bg-background [&>textarea]:px-3.5 [&>textarea]:py-3 [&>textarea]:text-sm [&>textarea]:text-foreground [&>textarea]:transition [&>textarea]:placeholder:text-muted-foreground/80 [&>textarea]:focus-visible:border-ring [&>textarea]:focus-visible:outline-none [&>textarea]:focus-visible:ring-4 [&>textarea]:focus-visible:ring-ring/20",
    "[&>select]:w-full [&>select]:appearance-none [&>select]:rounded-xl [&>select]:border [&>select]:border-input [&>select]:bg-background [&>select]:px-3.5 [&>select]:py-3 [&>select]:text-sm [&>select]:text-foreground [&>select]:transition [&>select]:focus-visible:border-ring [&>select]:focus-visible:outline-none [&>select]:focus-visible:ring-4 [&>select]:focus-visible:ring-ring/20"
  );
  const switchRowClass = "mt-1 inline-flex items-center gap-3 self-start";
  const switchInputClass = "peer sr-only";
  const switchTrackClass =
    "inline-flex h-7 w-12 items-center rounded-full border border-border bg-muted px-1 transition peer-checked:border-primary/60 peer-checked:bg-primary/15 peer-focus-visible:ring-4 peer-focus-visible:ring-ring/20";
  const switchThumbClass = "size-5 rounded-full bg-foreground/90 shadow-sm transition peer-checked:translate-x-5";
  const switchTextClass = "text-sm font-semibold text-foreground";
  const infoBoxClass = "rounded-xl border border-accent/25 bg-accent/10 px-3 py-2.5";
  const infoBoxTitleClass = "text-sm font-semibold text-foreground";
  const infoBoxTextClass = "mt-1 text-xs text-muted-foreground";
  const submitButtonClass =
    "mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";
  const clearFilterButtonClass =
    "self-start rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground";
  const selectedInfoClass = "grid gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3";
  const selectedLabelClass = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
  const selectedMetaClass = "text-sm text-foreground/80";
  const selectedActionClass =
    "inline-flex items-center gap-2 self-start rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-border hover:bg-accent";
  const viewerListClass = "flex max-h-[360px] flex-col gap-2 overflow-auto pr-1";
  const viewerListSpacedClass = cn(viewerListClass, "mt-2.5");
  const viewerEmptyClass = "rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground break-words";
  const loadingClass =
    "inline-flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground";
  const loadingIconClass = "animate-spin";
  const viewerItemClass = (active = false) =>
    cn(
      "flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm max-md:items-start",
      active && "border-primary/30 bg-primary/10"
    );
  const viewerItemStaticClass = "flex w-full cursor-default items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 max-md:items-start";
  const viewerItemTitleClass = "min-w-0 flex-1 break-words font-medium text-foreground";
  const viewerItemMetaClass = "shrink-0 text-xs text-muted-foreground sm:text-sm";
  const viewerRowClass = "flex items-center gap-1.5 max-md:items-start";
  const reorderButtonsClass = "flex shrink-0 flex-col gap-0.5";
  const reorderButtonClass =
    "flex size-6 items-center justify-center rounded-md border border-border/60 bg-card p-0 text-muted-foreground transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30";
  const reorderDangerButtonClass =
    "flex size-7 shrink-0 items-center justify-center rounded-md border border-red-200 bg-transparent p-0 text-red-600 transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-red-900/60 dark:text-red-400";
  const phaseExercisePanelClass = "mt-4 border-t border-border/50 pt-3.5";
  const exercisePanelHeadClass = "mb-2 flex flex-col gap-1";
  const containerSwitchRowClass = "inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium text-foreground";
  const containerCheckboxClass = "size-4 accent-primary";
  const containerExerciseListClass =
    "flex max-h-[260px] flex-col gap-1 overflow-y-auto rounded-xl border border-border/60 bg-background/60 p-2";
  const containerExerciseOptionClass = (selected: boolean) =>
    cn(
      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-2 py-1.5 text-sm transition max-md:flex-wrap max-md:items-start",
      selected ? "border-primary/40 bg-primary/10" : "border-transparent hover:bg-primary/5"
    );
  const containerExerciseInputClass = "peer sr-only";
  const containerExerciseCheckClass =
    "inline-flex size-[18px] shrink-0 items-center justify-center rounded-md border border-border bg-muted transition after:block after:size-2 after:rounded-[3px] after:bg-transparent after:content-[''] peer-checked:border-primary/60 peer-checked:bg-primary/15 peer-checked:after:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-ring/20";
  const containerExerciseTitleClass = "min-w-0 flex-1 break-words text-sm font-medium text-foreground";
  const containerSelectedWrapClass = "mt-2.5 rounded-xl border border-border/50 bg-card/80 p-2.5";
  const containerSelectedHeadClass = "mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground";
  const containerSelectedListClass = "flex flex-col gap-1.5";
  const containerSelectedItemClass =
    "flex items-center gap-2.5 rounded-lg border border-border/40 bg-muted/40 p-1.5 max-md:items-start";
  const containerSelectedInfoClass = "min-w-0 flex flex-col";
  const containerSelectedTitleClass = "break-words text-sm font-semibold text-foreground";
  const containerActionRowClass = "mb-2.5 flex flex-wrap gap-2";
  const containerHeaderActionsClass = "inline-flex flex-wrap items-center gap-2 max-md:w-full max-md:justify-end";
  const containerActionButtonClass = (active = false) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:pointer-events-none disabled:opacity-50 max-sm:w-full max-sm:justify-center",
      active
        ? "border-primary/45 bg-primary/12 text-foreground"
        : "border-border/60 bg-muted/40 text-foreground hover:border-primary/40 hover:bg-primary/10"
    );
  const containerAddPanelClass = "mb-2.5 rounded-xl border border-border/50 bg-muted/30 p-2.5";
  const containerAddActionsClass = "mt-2.5";
  const containerGroupsClass = "mt-2.5 flex max-h-[min(58vh,680px)] flex-col gap-2.5 overflow-y-auto pr-1";
  const containerGroupCardClass = "rounded-xl border border-border/60 bg-card/90 p-3.5 transition hover:border-primary/40";
  const containerGroupHeaderClass = "mb-2.5 flex items-center justify-between gap-2.5 max-md:flex-col max-md:items-stretch";
  const containerGroupInfoClass = "flex flex-wrap items-center gap-2";
  const containerDeleteButtonClass =
    "flex size-7 items-center justify-center rounded-lg border border-border/60 bg-transparent text-muted-foreground transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-400";
  const containerGroupExercisesClass = "flex flex-col gap-1 border-l-2 border-primary/35 pl-2.5";
  const containerExerciseItemClass = "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-primary/5 max-md:items-start";
  const containerExerciseItemInfoClass = "flex min-w-0 flex-1 items-center justify-between gap-2 max-md:flex-col max-md:items-start";
  const containerFooterClass = "mt-2 border-t border-border/40 pt-2 text-xs font-medium text-muted-foreground";
  const detailsGridClass = "flex flex-col gap-2.5";
  const detailRowClass = "flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5";
  const detailLabelClass = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
  const detailValueClass = "break-words text-sm font-semibold text-foreground";
  const detailHintClass = "rounded-xl border border-dashed border-primary/35 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground";
  const modalGhostButtonClass =
    "inline-flex min-h-[42px] min-w-[130px] items-center justify-center gap-2 rounded-xl border border-border/65 bg-muted/40 text-foreground hover:border-primary/35";
  const modalDangerButtonClass =
    "inline-flex min-h-[42px] min-w-[130px] items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive/60";
  const renderDetailRow = (label: string, value: React.ReactNode) => (
    <div className={detailRowClass}>
      <span className={detailLabelClass}>{label}</span>
      <strong className={detailValueClass}>{value}</strong>
    </div>
  );

  return (
    <DashboardLayout title="Estrutura do Curso" subtitle="Criação e listagem separadas por página">
      <div className={pageClass}>
        <AnimatedToast
          message={toastMsg?.msg || null}
          type={toastMsg?.type || "success"}
          duration={3000}
          onClose={() => setToastMsg(null)}
        />

        <div className={tabsClass} role="tablist" aria-label="Etapas de estrutura">
          <span className={tabsLabelClass}>EXIBIR:</span>
          {stageTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={tabButtonClass(abaAtiva === key)}
              onClick={() => navigate(rotaAba(key))}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className={overviewGridClass} aria-label="Resumo da estrutura">
          <div className={overviewCardClass}>
            <span className={overviewLabelClass}>Cursos</span>
            <strong className={overviewValueClass}>{globalStats.cursos}</strong>
          </div>
          <div className={overviewCardClass}>
            <span className={overviewLabelClass}>Módulos</span>
            <strong className={overviewValueClass}>{globalStats.modulos}</strong>
          </div>
          <div className={overviewCardClass}>
            <span className={overviewLabelClass}>Fases</span>
            <strong className={overviewValueClass}>{globalStats.fases}</strong>
          </div>
        </div>

        {abaAtiva === "curso" && (
          <div className={gridClass}>
            <div className={cardClass}>
              <div className={cardHeadClass}>
                <h2 className={cardTitleClass}>Criar Curso</h2>
                <p className={cardDescriptionClass}>Formulário de criação de curso.</p>
              </div>
              <form onSubmit={handleCriarCurso} className={formClass}>
                <span>Nome do curso *</span>
                <input value={novoCursoNome} onChange={(e) => setNovoCursoNome(e.target.value)} placeholder="Ex: Programação Full Stack" />

                <span>Descrição</span>
                <textarea value={novoCursoDescricao} onChange={(e) => setNovoCursoDescricao(e.target.value)} placeholder="Opcional" />

                <label className={switchRowClass}>
                  <input type="checkbox" className={switchInputClass} checked={novoCursoPago} onChange={(e) => setNovoCursoPago(e.target.checked)} />
                  <span className={switchTrackClass} aria-hidden="true">
                    <span className={switchThumbClass} />
                  </span>
                  <span className={switchTextClass}>{novoCursoPago ? "Curso pago" : "Curso gratuito"}</span>
                </label>

                <span>Duração (horas)</span>
                <input type="number" min={1} value={novoCursoDuracao} onChange={(e) => setNovoCursoDuracao(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 120" />

                <span>Nível de dificuldade</span>
                <select value={novoCursoNivel} onChange={(e) => setNovoCursoNivel(e.target.value)}>
                  <option value="" disabled>Selecione o nível</option>
                  <option value="iniciante">Iniciante</option>
                  <option value="iniciante-intermediario">Iniciante -&gt; Intermediário</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="intermediario-avancado">Intermediário -&gt; Avançado</option>
                  <option value="avancado">Avançado</option>
                </select>

                {!novoCursoPago && (
                  <div className={infoBoxClass}>
                    <span className={infoBoxTitleClass}>Turmas via Cadastro</span>
                    <p className={infoBoxTextClass}>
                      Cursos gratuitos têm turmas criadas via cadastro de alunos.
                    </p>
                  </div>
                )}

                {novoCursoPago && (
                  <>
                    <span>Foco do curso</span>
                    <input value={novoCursoFoco} onChange={(e) => setNovoCursoFoco(e.target.value)} placeholder="Ex: Desenvolvimento Web, Data Science" />
                  </>
                )}

                <span>Preço (R$)</span>
                <input type="number" min={0} step="0.01" value={novoCursoPreco} onChange={(e) => setNovoCursoPreco(e.target.value ? Number(e.target.value) : "")} placeholder={novoCursoPago ? "Ex: 497.00" : "0 (gratuito)"} />

                <AnimatedButton className={submitButtonClass} type="submit" disabled={criandoCurso}>
                  {criandoCurso ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar curso</>}
                </AnimatedButton>
              </form>
            </div>

            <div className={cardClass}>
              <div className={cardHeadClass}>
                <h2 className={cardTitleClass}>Cursos Disponíveis</h2>
              </div>
              {cursoSelecionado && (
                <div className={selectedInfoClass}>
                  <span className={selectedLabelClass}>Curso selecionado:</span>
                  <strong>{cursoSelecionado.nome}</strong>
                  <span className={selectedMetaClass}>
                    {[
                      cursoSelecionado.isPaid ? "Pago" : "Gratuito",
                      cursoSelecionado.durationHours ? `${cursoSelecionado.durationHours}h` : null,
                      cursoSelecionado.price != null && cursoSelecionado.price > 0
                        ? `R$ ${Number(cursoSelecionado.price).toFixed(2)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </span>
                  <AnimatedButton
                    type="button"
                    className={selectedActionClass}
                    onClick={() => setDetalheModal({ tipo: "curso", item: cursoSelecionado })}
                  >
                    <Eye size={16} /> Ver detalhes
                  </AnimatedButton>
                </div>
              )}
              <div className={viewerListSpacedClass}>
                {carregandoCursos ? (
                  <div className={loadingClass} role="status" aria-live="polite">
                    <Loader2 size={18} className={loadingIconClass} />
                    <span>Carregando cursos...</span>
                  </div>
                ) : paginaCursosItens.length === 0 ? (
                  <div className={viewerEmptyClass}>Nenhum curso encontrado.</div>
                ) : (
                  paginaCursosItens.map((curso) => (
                    <button
                      key={curso.id}
                      type="button"
                      className={viewerItemClass(curso.id === courseIdSelecionado)}
                      onClick={() => {
                        setCourseIdSelecionado(curso.id);
                      }}
                    >
                      <span className={viewerItemTitleClass}>{curso.nome}</span>
                      <span className={viewerItemMetaClass}>{curso.isPaid ? "Pago" : "Gratuito"}</span>
                    </button>
                  ))
                )}
              </div>
              <Pagination
                currentPage={paginaCursos}
                itemsPerPage={itensCursos}
                totalItems={totalCursosPaginacao}
                onPageChange={setPaginaCursos}
                onItemsPerPageChange={setItensCursos}
              />
            </div>
          </div>
        )}

        {abaAtiva === "modulo" && (
          <div className={gridClass}>
            <div className={cardClass}>
              <div className={cardHeadClass}>
                <h2 className={cardTitleClass}>Criar Módulo</h2>
                <p className={cardDescriptionClass}>Formulário de criação de módulo.</p>
              </div>
              <form onSubmit={handleCriarModulo} className={formClass}>
                <span>Curso *</span>
                <PaginatedSelect
                  value={courseIdSelecionado}
                  onChange={(value) => {
                    setCourseIdSelecionado(value);
                    const found = cursoSelectOpcoes.find((curso) => curso.id === value) ?? null;
                    if (found) setCursoSelectSelecionado(found);
                  }}
                  options={cursoSelectOpcoes.filter((curso) => !curso.isPaid).map((curso) => ({
                    value: curso.id,
                    label: curso.nome,
                    meta: "Gratuito",
                  }))}
                  selectedOption={cursoSelectSelecionado ? {
                    value: cursoSelectSelecionado.id,
                    label: cursoSelectSelecionado.nome,
                    meta: cursoSelectSelecionado.isPaid ? "Pago" : "Gratuito",
                  } : null}
                  placeholder="Selecione um curso gratuito"
                  emptyText="Nenhum curso gratuito cadastrado"
                  allowPageSizeChange={false}
                  remote={{
                    query: cursoSelectBusca,
                    onQueryChange: setCursoSelectBusca,
                    page: cursoSelectPagina,
                    totalPages: cursoSelectTotalPages,
                    onPageChange: setCursoSelectPagina,
                    loading: cursoSelectCarregando,
                  }}
                />

                <span>Nome do módulo *</span>
                <input value={novoModuloNome} onChange={(e) => setNovoModuloNome(e.target.value)} placeholder="Ex: JavaScript + DOM" />

                <span>Descrição</span>
                <textarea value={novoModuloDescricao} onChange={(e) => setNovoModuloDescricao(e.target.value)} placeholder="Opcional" />

                <AnimatedButton className={submitButtonClass} type="submit" disabled={criandoModulo}>
                  {criandoModulo ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar módulo</>}
                </AnimatedButton>
              </form>
            </div>

            <div className={cardClass}>
              <div className={cardHeadClass}>
                <h2 className={cardTitleClass}>Módulos Disponíveis</h2>
                <p className={cardDescriptionClass}>Filtre e visualize os módulos do curso selecionado.</p>
              </div>
              <div className={formClass}>
                <PaginatedSelect
                  value={filtroModuloId}
                  onChange={setFiltroModuloId}
                  options={modulosCurso.map((m) => ({
                    value: m.id,
                    label: m.nome,
                    meta: `Ordem #${m.indexOrder}`,
                  }))}
                  placeholder="Filtrar por módulo (lista paginada)"
                  disabled={!courseIdSelecionado}
                  emptyText="Nenhum módulo para selecionar"
                />
                {filtroModuloId && (
                  <button type="button" className={clearFilterButtonClass} onClick={() => setFiltroModuloId("")}>
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className={viewerListSpacedClass}>
                {!courseIdSelecionado ? (
                  <div className={viewerEmptyClass}>Selecione um curso para listar módulos.</div>
                ) : carregandoModulos ? (
                  <div className={loadingClass} role="status" aria-live="polite">
                    <Loader2 size={18} className={loadingIconClass} />
                    <span>Carregando módulos...</span>
                  </div>
                ) : paginaModulosItens.length === 0 ? (
                  <div className={viewerEmptyClass}>Nenhum módulo encontrado.</div>
                ) : (
                  paginaModulosItens.map((mod, idx) => (
                    <div key={mod.id} className={viewerRowClass}>
                      <div className={reorderButtonsClass}>
                        <button
                          type="button"
                          className={reorderButtonClass}
                          title="Mover para cima"
                          disabled={reordenando || (idx === 0 && paginaModulos === 1)}
                          onClick={(e) => { e.stopPropagation(); handleReordenarModulo(mod.id, "up"); }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          className={reorderButtonClass}
                          title="Mover para baixo"
                          disabled={reordenando || (idx === paginaModulosItens.length - 1 && paginaModulos * itensModulos >= totalModulosPaginacao)}
                          onClick={(e) => { e.stopPropagation(); handleReordenarModulo(mod.id, "down"); }}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className={viewerItemClass(mod.id === moduloIdSelecionado)}
                        onClick={() => {
                          setModuloIdSelecionado(mod.id);
                          setDetalheModal({ tipo: "modulo", item: mod });
                        }}
                      >
                        <span className={viewerItemTitleClass}>{mod.nome}</span>
                        <span className={viewerItemMetaClass}>#{mod.indexOrder}</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
              <Pagination
                currentPage={paginaModulos}
                itemsPerPage={itensModulos}
                totalItems={totalModulosPaginacao}
                onPageChange={setPaginaModulos}
                onItemsPerPageChange={setItensModulos}
              />
            </div>
          </div>
        )}

        {abaAtiva === "fase" && (
          <div className={gridClass}>
            <div className={cardClass}>
              <div className={cardHeadClass}>
                <h2 className={cardTitleClass}>Criar Fase</h2>
                <p className={cardDescriptionClass}>Formulário de criação de fase.</p>
              </div>
              <form onSubmit={handleCriarFase} className={formClass}>
                <span>Curso *</span>
                <PaginatedSelect
                  value={courseIdSelecionado}
                  onChange={(value) => {
                    setCourseIdSelecionado(value);
                    const found = cursoSelectOpcoesGratuitas.find((curso) => curso.id === value) ?? null;
                    if (found) setCursoSelectSelecionado(found);
                  }}
                  options={cursoSelectOpcoesGratuitas.map((curso) => ({
                    value: curso.id,
                    label: curso.nome,
                    meta: curso.isPaid ? "Pago" : "Gratuito",
                  }))}
                  selectedOption={cursoSelectSelecionadoGratuito ? {
                    value: cursoSelectSelecionadoGratuito.id,
                    label: cursoSelectSelecionadoGratuito.nome,
                    meta: cursoSelectSelecionadoGratuito.isPaid ? "Pago" : "Gratuito",
                  } : null}
                  placeholder="Selecione um curso gratuito"
                  emptyText="Nenhum curso gratuito cadastrado"
                  allowPageSizeChange={false}
                  remote={{
                    query: cursoSelectBusca,
                    onQueryChange: setCursoSelectBusca,
                    page: cursoSelectPagina,
                    totalPages: cursoSelectTotalPages,
                    onPageChange: setCursoSelectPagina,
                    loading: cursoSelectCarregando,
                  }}
                />

                <span>Módulo *</span>
                <PaginatedSelect
                  value={moduloIdSelecionado}
                  onChange={(value) => {
                    setModuloIdSelecionado(value);
                    const found = moduloSelectOpcoes.find((mod) => mod.id === value) ?? null;
                    if (found) setModuloSelectSelecionado(found);
                  }}
                  options={moduloSelectOpcoes.map((mod) => ({
                    value: mod.id,
                    label: mod.nome,
                    meta: `Ordem #${mod.indexOrder}`,
                  }))}
                  selectedOption={moduloSelectSelecionado ? {
                    value: moduloSelectSelecionado.id,
                    label: moduloSelectSelecionado.nome,
                    meta: `Ordem #${moduloSelectSelecionado.indexOrder}`,
                  } : null}
                  placeholder={courseIdSelecionado ? "Selecione um módulo" : "Selecione um curso primeiro"}
                  disabled={!courseIdSelecionado}
                  allowPageSizeChange={false}
                  emptyText="Nenhum módulo cadastrado para este curso"
                  remote={{
                    query: moduloSelectBusca,
                    onQueryChange: setModuloSelectBusca,
                    page: moduloSelectPagina,
                    totalPages: moduloSelectTotalPages,
                    onPageChange: setModuloSelectPagina,
                    loading: moduloSelectCarregando,
                  }}
                />

                <span>Nome da fase *</span>
                <input value={novaFaseNome} onChange={(e) => setNovaFaseNome(e.target.value)} placeholder="Ex: Semana 1 - Introdução" />

                {/* Semana removida da criação conforme correções.md - editar somente na lista */}

                <AnimatedButton className={submitButtonClass} type="submit" disabled={criandoFase || !moduloIdSelecionado}>
                  {criandoFase ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar fase</>}
                </AnimatedButton>
              </form>
            </div>

            <div className={cardClass}>
              <div className={cardHeadClass}>
                <h2 className={cardTitleClass}>Fases Disponíveis</h2>
                <p className={cardDescriptionClass}>Filtre e visualize as fases do módulo selecionado.</p>
              </div>
              <div className={formClass}>
                <PaginatedSelect
                  value={filtroFaseId}
                  onChange={setFiltroFaseId}
                  options={fasesModulo.map((f) => ({
                    value: f.id,
                    label: f.nome,
                    meta: `Semana ${f.weekNumber}`,
                  }))}
                  placeholder="Filtrar por fase (lista paginada)"
                  disabled={!moduloIdSelecionado}
                  emptyText="Nenhuma fase para selecionar"
                />
                {filtroFaseId && (
                  <button type="button" className={clearFilterButtonClass} onClick={() => setFiltroFaseId("")}>
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className={viewerListSpacedClass}>
                {!moduloIdSelecionado ? (
                  <div className={viewerEmptyClass}>Selecione um módulo para listar fases.</div>
                ) : carregandoFases ? (
                  <div className={loadingClass} role="status" aria-live="polite">
                    <Loader2 size={18} className={loadingIconClass} />
                    <span>Carregando fases...</span>
                  </div>
                ) : paginaFasesItens.length === 0 ? (
                  <div className={viewerEmptyClass}>Nenhuma fase encontrada.</div>
                ) : (
                  paginaFasesItens.map((fase, idx) => (
                    <div key={fase.id} className={viewerRowClass}>
                      <div className={reorderButtonsClass}>
                        <button
                          type="button"
                          className={reorderButtonClass}
                          title="Mover para cima"
                          disabled={reordenando || (idx === 0 && paginaFases === 1)}
                          onClick={(e) => { e.stopPropagation(); handleReordenarFase(fase.id, "up"); }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          className={reorderButtonClass}
                          title="Mover para baixo"
                          disabled={reordenando || (idx === paginaFasesItens.length - 1 && paginaFases * itensFases >= totalFasesPaginacao)}
                          onClick={(e) => { e.stopPropagation(); handleReordenarFase(fase.id, "down"); }}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className={viewerItemClass(fase.id === faseIdParaExercicios)}
                        onClick={() => {
                          setFaseIdParaExercicios(fase.id);
                          setDetalheModal({ tipo: "fase", item: fase });
                        }}
                      >
                        <span className={viewerItemTitleClass}>{fase.nome}</span>
                        <span className={viewerItemMetaClass}>Semana {fase.weekNumber}</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
              <Pagination
                currentPage={paginaFases}
                itemsPerPage={itensFases}
                totalItems={totalFasesPaginacao}
                onPageChange={setPaginaFases}
                onItemsPerPageChange={setItensFases}
              />

              {/* Exercises for selected phase */}
              {faseIdParaExercicios && (
                <div className={phaseExercisePanelClass}>
                  <div className={exercisePanelHeadClass}>
                    <h3 className={compactTitleClass}>Exercícios da Fase</h3>
                    <p className={compactDescriptionClass}>Exercícios vinculados à fase selecionada. Reordene com as setas.</p>
                  </div>
                  <div className={viewerListClass}>
                    {exerciciosFase.length === 0 ? (
                      <div className={viewerEmptyClass}>Nenhum exercício vinculado a esta fase.</div>
                    ) : (
                      exerciciosFase.map((ex, idx) => (
                        <div key={ex.id} className={viewerRowClass}>
                          <div className={reorderButtonsClass}>
                            <button
                              type="button"
                              className={reorderButtonClass}
                              title="Mover para cima"
                              disabled={reordenando || idx === 0}
                              onClick={(e) => { e.stopPropagation(); handleReordenarExercicio(ex.id, "up"); }}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              className={reorderButtonClass}
                              title="Mover para baixo"
                              disabled={reordenando || idx === exerciciosFase.length - 1}
                              onClick={(e) => { e.stopPropagation(); handleReordenarExercicio(ex.id, "down"); }}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          <div className={viewerItemStaticClass}>
                            <span className={viewerItemTitleClass}>{ex.titulo}</span>
                            <span className={viewerItemMetaClass}>Ordem #{ex.indexOrder}{ex.difficulty != null ? ` • Dif. ${ex.difficulty}` : ""}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {abaAtiva === "exercicios" && (
          <div className={gridClass}>
            <CriarExercicioForm />
          </div>
        )}

        {abaAtiva === "conteiners" && (
          <div className={gridTopAlignedClass}>
            <div className={cardClass}>
              <div className={cardHeadClass}>
                <h2 className={cardTitleClass}>Criar Container</h2>
                <p className={cardDescriptionClass}>Agrupe exercícios em um container dentro de uma fase.</p>
              </div>
              <form onSubmit={handleCriarContainer} className={formClass}>
                <span>Curso *</span>
                <PaginatedSelect
                  value={courseIdSelecionado}
                  onChange={(value) => {
                    setCourseIdSelecionado(value);
                    const found = cursoSelectOpcoesGratuitas.find((c) => c.id === value) ?? null;
                    if (found) setCursoSelectSelecionado(found);
                    setFaseIdParaContainers("");
                  }}
                  options={cursoSelectOpcoesGratuitas.map((curso) => ({
                    value: curso.id,
                    label: curso.nome,
                    meta: curso.isPaid ? "Pago" : "Gratuito",
                  }))}
                  selectedOption={cursoSelectSelecionadoGratuito ? {
                    value: cursoSelectSelecionadoGratuito.id,
                    label: cursoSelectSelecionadoGratuito.nome,
                    meta: cursoSelectSelecionadoGratuito.isPaid ? "Pago" : "Gratuito",
                  } : null}
                  placeholder="Selecione um curso gratuito"
                  emptyText="Nenhum curso gratuito cadastrado"
                  allowPageSizeChange={false}
                  remote={{
                    query: cursoSelectBusca,
                    onQueryChange: setCursoSelectBusca,
                    page: cursoSelectPagina,
                    totalPages: cursoSelectTotalPages,
                    onPageChange: setCursoSelectPagina,
                    loading: cursoSelectCarregando,
                  }}
                />

                <span>Módulo *</span>
                <PaginatedSelect
                  value={moduloIdSelecionado}
                  onChange={(value) => {
                    setModuloIdSelecionado(value);
                    const found = moduloSelectOpcoes.find((m) => m.id === value) ?? null;
                    if (found) setModuloSelectSelecionado(found);
                    setFaseIdParaContainers("");
                  }}
                  options={moduloSelectOpcoes.map((mod) => ({
                    value: mod.id,
                    label: mod.nome,
                    meta: `Ordem #${mod.indexOrder}`,
                  }))}
                  selectedOption={moduloSelectSelecionado ? {
                    value: moduloSelectSelecionado.id,
                    label: moduloSelectSelecionado.nome,
                    meta: `Ordem #${moduloSelectSelecionado.indexOrder}`,
                  } : null}
                  placeholder={courseIdSelecionado ? "Selecione um módulo" : "Selecione um curso primeiro"}
                  disabled={!courseIdSelecionado}
                  allowPageSizeChange={false}
                  emptyText="Nenhum módulo cadastrado para este curso"
                  remote={{
                    query: moduloSelectBusca,
                    onQueryChange: setModuloSelectBusca,
                    page: moduloSelectPagina,
                    totalPages: moduloSelectTotalPages,
                    onPageChange: setModuloSelectPagina,
                    loading: moduloSelectCarregando,
                  }}
                />

                <span>Fase *</span>
                <PaginatedSelect
                  value={faseIdParaContainers}
                  onChange={setFaseIdParaContainers}
                  options={fasesModulo.map((f) => ({
                    value: f.id,
                    label: f.nome,
                    meta: `Semana ${f.weekNumber}`,
                  }))}
                  placeholder={moduloIdSelecionado ? "Selecione uma fase" : "Selecione um módulo primeiro"}
                  disabled={!moduloIdSelecionado}
                  emptyText="Nenhuma fase para selecionar"
                />

                <span>Nome do Container *</span>
                <input value={novoContainerNome} onChange={(e) => setNovoContainerNome(e.target.value)} placeholder="Ex: FlexBox e Alinhamento" />

                <span>Dia Alvo</span>
                <input type="number" min={1} value={novoContainerDia} onChange={(e) => setNovoContainerDia(e.target.value ? Number(e.target.value) : "")} placeholder="Número do dia" />

                <label className={containerSwitchRowClass}>
                  <input className={containerCheckboxClass} type="checkbox" checked={novoContainerIsDailyTask} onChange={(e) => setNovoContainerIsDailyTask(e.target.checked)} />
                  <span>Tarefa Diária</span>
                </label>

                <span>Exercícios *</span>
                {!faseIdParaContainers ? (
                  <div className={viewerEmptyClass}>Selecione uma fase para ver exercícios.</div>
                ) : exerciciosPermitidosNovoContainer.length === 0 ? (
                  <div className={viewerEmptyClass}>Nenhum exercício nesta fase.</div>
                ) : (
                  <div className={containerExerciseListClass}>
                    {exerciciosPermitidosNovoContainer.map((ex) => {
                      const selecionado = novoContainerExerciseIds.includes(ex.id);
                      return (
                      <label key={ex.id} className={containerExerciseOptionClass(selecionado)}>
                        <input
                          className={containerExerciseInputClass}
                          type="checkbox"
                          checked={selecionado}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNovoContainerExerciseIds((prev) => [...prev, ex.id]);
                            } else {
                              setNovoContainerExerciseIds((prev) => prev.filter((id) => id !== ex.id));
                            }
                          }}
                        />
                        <span className={containerExerciseCheckClass} aria-hidden="true" />
                        <span className={containerExerciseTitleClass}>{ex.titulo}</span>
                        <span className={cn(viewerItemMetaClass, "max-md:w-full max-md:pl-7 max-md:text-left")}>#{ex.indexOrder}</span>
                      </label>
                    );
                    })}
                  </div>
                )}

                {exerciciosSelecionadosContainer.length > 0 && (
                  <div className={containerSelectedWrapClass}>
                    <div className={containerSelectedHeadClass}>
                      Ordem dos exercícios no container
                    </div>
                    <div className={containerSelectedListClass}>
                      {exerciciosSelecionadosContainer.map((ex, idx) => (
                        <div key={ex.id} className={containerSelectedItemClass}>
                          <div className={reorderButtonsClass}>
                            <button
                              type="button"
                              className={reorderButtonClass}
                              title="Mover para cima"
                              disabled={idx === 0}
                              onClick={() => handleReordenarNovoContainerExercise(ex.id, "up")}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              className={reorderButtonClass}
                              title="Mover para baixo"
                              disabled={idx === exerciciosSelecionadosContainer.length - 1}
                              onClick={() => handleReordenarNovoContainerExercise(ex.id, "down")}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          <div className={containerSelectedInfoClass}>
                            <span className={containerSelectedTitleClass}>{ex.titulo}</span>
                            <span className={viewerItemMetaClass}>Posição #{idx + 1}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <AnimatedButton className={submitButtonClass} type="submit" disabled={criandoContainer || !faseIdParaContainers || novoContainerExerciseIds.length === 0}>
                  {criandoContainer ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar Container</>}
                </AnimatedButton>
              </form>
            </div>

            <div className={cn(cardClass, "self-start")}>
              <div className={cardHeadClass}>
                <h2 className={cardTitleClass}>Containers da Fase</h2>
                <p className={cardDescriptionClass}>Containers agrupando exercícios da fase selecionada.</p>
              </div>
              {!faseIdParaContainers ? (
                <div className={viewerEmptyClass}>Selecione uma fase para ver containers.</div>
              ) : carregandoContainers ? (
                <div className={loadingClass} role="status" aria-live="polite">
                  <Loader2 size={18} className={loadingIconClass} />
                  <span>Carregando containers...</span>
                </div>
              ) : containers.length === 0 ? (
                <div className={viewerEmptyClass}>Nenhum container encontrado para esta fase.</div>
              ) : (
                <>
                <div className={containerActionRowClass}>
                  <button
                    type="button"
                    className={containerActionButtonClass(abaTipoContainer === "normal")}
                    aria-pressed={abaTipoContainer === "normal"}
                    onClick={() => setAbaTipoContainer("normal")}
                  >
                    Containers Normais
                  </button>
                  <button
                    type="button"
                    className={containerActionButtonClass(abaTipoContainer === "daily")}
                    aria-pressed={abaTipoContainer === "daily"}
                    onClick={() => setAbaTipoContainer("daily")}
                  >
                    Containers de Tarefa Diária
                  </button>
                </div>

                <div className={cn(containerHeaderActionsClass, "mb-2.5")}>
                  <button
                    type="button"
                    className={containerActionButtonClass()}
                    onClick={() => {
                      if (!faseIdParaContainers) return;
                      void refreshContainersData(faseIdParaContainers, { silent: false });
                    }}
                    disabled={!faseIdParaContainers || carregandoContainers || atualizandoContainers}
                  >
                    {atualizandoContainers ? <Loader2 size={14} className={loadingIconClass} /> : <RefreshCw size={14} />}
                    Atualizar
                  </button>
                  <button
                    type="button"
                    className={containerActionButtonClass()}
                    onClick={handleToggleContainerEditorGlobal}
                    disabled={containersFiltradosPorTipo.length === 0 || atualizandoContainers}
                  >
                    <Plus size={14} />
                    {containerEditorKey ? "Fechar" : "Adicionar exercícios"}
                  </button>
                </div>

                {containersFiltradosPorTipo.length === 0 && (
                  <div className={cn(viewerEmptyClass, "mb-2.5")}>
                    {abaTipoContainer === "daily"
                      ? "Nenhum container de tarefa diária encontrado para esta fase."
                      : "Nenhum container normal encontrado para esta fase."}
                  </div>
                )}

                {containerEditorKey && containersFiltradosPorTipo.length > 0 && (
                  <div className={containerAddPanelClass}>
                    <div className={containerSelectedHeadClass}>Adicionar novos exercícios</div>

                    <span className="mb-2 block text-xs text-muted-foreground">
                      Container de destino
                    </span>
                    <select
                      className={cn(selectClass, "mb-2.5")}
                      value={containerEditorKey}
                      onChange={(e) => {
                        setContainerEditorKey(e.target.value);
                        setContainerEditorExerciseIds([]);
                      }}
                    >
                      {containersFiltradosPorTipo.map((container, idx) => {
                        const key = getContainerGroupKey(container);
                        return (
                          <option key={`${key}-${idx}`} value={key}>
                            {container.name}
                            {container.containerDateTargetInt != null ? ` (Dia ${container.containerDateTargetInt})` : ""}
                          </option>
                        );
                      })}
                    </select>

                    {exerciciosPermitidosNaoAlocados.length === 0 ? (
                      <div className={viewerEmptyClass}>Todos os exercícios da fase já estão em containers.</div>
                    ) : (
                      <>
                        <div className={containerExerciseListClass}>
                          {exerciciosPermitidosNaoAlocados.map((ex) => {
                              const selecionado = containerEditorExerciseIds.includes(ex.id);
                              return (
                                <label key={`global-add-${ex.id}`} className={containerExerciseOptionClass(selecionado)}>
                                  <input
                                    className={containerExerciseInputClass}
                                    type="checkbox"
                                    checked={selecionado}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setContainerEditorExerciseIds((prev) => [...prev, ex.id]);
                                      } else {
                                        setContainerEditorExerciseIds((prev) => prev.filter((id) => id !== ex.id));
                                      }
                                    }}
                                  />
                                  <span className={containerExerciseCheckClass} aria-hidden="true" />
                                  <span className={containerExerciseTitleClass}>{ex.titulo}</span>
                                  <span className={cn(viewerItemMetaClass, "max-md:w-full max-md:pl-7 max-md:text-left")}>#{ex.indexOrder}</span>
                                </label>
                              );
                            })}
                        </div>
                        <div className={containerAddActionsClass}>
                          <AnimatedButton
                            type="button"
                            className={submitButtonClass}
                            disabled={salvandoContainerEditor || containerEditorExerciseIds.length === 0}
                            onClick={handleAdicionarExerciciosNoContainer}
                          >
                            {salvandoContainerEditor ? <><Loader2 size={16} /> Salvando...</> : <><Plus size={16} /> Adicionar selecionados</>}
                          </AnimatedButton>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {containersFiltradosPorTipo.length > 0 && (
                  <div className={containerGroupsClass}>
                    {containersPaginados.map((container, i) => (
                      <div key={`${container.name}-${container.containerDateTargetInt}-${i}`} className={containerGroupCardClass}>
                        <div className={containerGroupHeaderClass}>
                          <div className={containerGroupInfoClass}>
                            <strong>{container.name}</strong>
                            {container.containerDateTargetInt != null && (
                              <Badge variant="outline" className="border-sky-400/30 bg-sky-500/10 text-sky-200">
                                Dia {container.containerDateTargetInt}
                              </Badge>
                            )}
                            {container.isDailyTask && (
                              <Badge variant="outline" className="border-amber-400/30 bg-amber-500/10 text-amber-200">
                                Tarefa Diária
                              </Badge>
                            )}
                          </div>
                          <div className={containerHeaderActionsClass}>
                            <button type="button" className={containerDeleteButtonClass} onClick={() => handleDeletarContainer(container)} title="Deletar container">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className={containerGroupExercisesClass}>
                          {container.exercises.map((ex, idx) => (
                            <div key={ex.containerTaskId} className={containerExerciseItemClass}>
                              <div className={reorderButtonsClass}>
                                <button
                                  type="button"
                                  className={reorderButtonClass}
                                  title="Mover para cima"
                                  disabled={reordenando || idx === 0}
                                  onClick={() => handleReordenarExercicioContainer(ex.id, "up")}
                                >
                                  <ChevronUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  className={reorderButtonClass}
                                  title="Mover para baixo"
                                  disabled={reordenando || idx === container.exercises.length - 1}
                                  onClick={() => handleReordenarExercicioContainer(ex.id, "down")}
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </div>
                              <div className={containerExerciseItemInfoClass}>
                                <span className={viewerItemTitleClass}>{ex.title}</span>
                                <span className={viewerItemMetaClass}>#{ex.indexOrder ?? "-"}</span>
                              </div>
                              <button
                                type="button"
                                className={reorderDangerButtonClass}
                                title="Remover exercício do container"
                                disabled={reordenando}
                                onClick={() => handleRemoveExercicioFromContainer(ex.containerTaskId, ex.title)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className={containerFooterClass}>
                          {container.exercises.length} exercício{container.exercises.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Pagination
                  currentPage={paginaContainers}
                  itemsPerPage={itensContainers}
                  totalItems={totalContainersPaginacao}
                  onPageChange={setPaginaContainers}
                  onItemsPerPageChange={setItensContainers}
                />
                </>
              )}
            </div>
          </div>
        )}

        {abaAtiva === "turmas" && (
          <div className={gridClass}>
            <CriarTurmaForm />
          </div>
        )}

        <ConfirmDialog
          isOpen={!!containerConfirmState}
          onClose={() => {
            if (processandoContainerConfirm) return;
            setContainerConfirmState(null);
          }}
          onConfirm={handleConfirmContainerAction}
          title={
            containerConfirmState?.tipo === "delete-container"
              ? "Deletar Container"
              : "Remover Exercício"
          }
          message={
            containerConfirmState?.tipo === "delete-container"
              ? `Tem certeza que deseja deletar o container "${containerConfirmState.container.name}"${containerConfirmState.container.containerDateTargetInt != null ? ` (Dia ${containerConfirmState.container.containerDateTargetInt})` : ""}? Esta ação não pode ser desfeita.`
              : `Tem certeza que deseja remover o exercício "${containerConfirmState?.exerciseTitle ?? ""}" do container?`
          }
          confirmText={containerConfirmState?.tipo === "delete-container" ? "Deletar" : "Remover"}
          cancelText="Cancelar"
          isLoading={processandoContainerConfirm}
          isDangerous
        />

        <ConfirmDialog
          isOpen={confirmarDeleteDetalhe}
          onClose={() => {
            if (deletandoDetalhe) return;
            setConfirmarDeleteDetalhe(false);
          }}
          onConfirm={handleDeletarDetalhe}
          title={
            detalheModal
              ? `Deletar ${detalheModal.tipo === "curso" ? "curso" : detalheModal.tipo === "modulo" ? "módulo" : "fase"}`
              : "Deletar item"
          }
          message={
            detalheModal
              ? `Tem certeza que deseja deletar ${detalheModal.tipo === "curso" ? "o curso" : detalheModal.tipo === "modulo" ? "o módulo" : "a fase"} "${detalheModal.item.nome || "item"}"?`
              : "Tem certeza que deseja deletar este item?"
          }
          confirmText="Deletar"
          cancelText="Cancelar"
          isLoading={deletandoDetalhe}
          isDangerous
        />

        <Modal
          isOpen={!!detalheModal}
          onClose={() => {
            setConfirmarDeleteDetalhe(false);
            setDetalheModal(null);
          }}
          title={
            detalheModal
              ? detalheModal.tipo === "curso"
                ? "Detalhes do curso"
                : detalheModal.tipo === "modulo"
                  ? "Detalhes do módulo"
                  : "Detalhes da fase"
              : "Detalhes"
          }
          size="md"
          footer={
            <>
              <AnimatedButton
                className={modalGhostButtonClass}
                onClick={() => {
                  setConfirmarDeleteDetalhe(false);
                  setDetalheModal(null);
                }}
              >
                Fechar
              </AnimatedButton>
              <AnimatedButton
                className={modalDangerButtonClass}
                onClick={() => setConfirmarDeleteDetalhe(true)}
                disabled={deletandoDetalhe}
              >
                {deletandoDetalhe ? (
                  <>
                    <Loader2 size={14} /> Deletando...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Deletar
                  </>
                )}
              </AnimatedButton>
            </>
          }
        >
          {detalheModal && (
            <div className={detailsGridClass}>
              {renderDetailRow("ID", detalheModal.item.id)}
              {renderDetailRow("Nome", detalheModal.item.nome)}

              {detalheModal.tipo === "curso" && (
                <>
                  {renderDetailRow("Descrição", detalheModal.item.descricao?.trim() || "Sem descrição")}
                  {renderDetailRow("Tipo", detalheModal.item.isPaid ? "Pago" : "Gratuito")}
                  {renderDetailRow("Duração", detalheModal.item.durationHours ? `${detalheModal.item.durationHours}h` : "-")}
                  {renderDetailRow("Nível", detalheModal.item.level || "-")}
                  {detalheModal.item.isPaid && (
                    renderDetailRow("Foco", detalheModal.item.focus || "-")
                  )}
                  {renderDetailRow("Preço", detalheModal.item.price != null ? `R$ ${Number(detalheModal.item.price).toFixed(2)}` : "Gratuito")}
                  {renderDetailRow("Módulos vinculados", courseIdSelecionado === detalheModal.item.id ? modulosCurso.length : "-")}
                </>
              )}

              {detalheModal.tipo === "modulo" && (
                <>
                  {renderDetailRow("Curso ID", detalheModal.item.courseId)}
                  {renderDetailRow("Ordem", `#${detalheModal.item.indexOrder}`)}
                  {renderDetailRow("Descrição", detalheModal.item.descricao?.trim() || "Sem descrição")}
                  {renderDetailRow("Fases vinculadas", moduloIdSelecionado === detalheModal.item.id ? fasesModulo.length : "-")}
                </>
              )}

              {detalheModal.tipo === "fase" && (
                <>
                  {renderDetailRow("Módulo ID", detalheModal.item.moduleId)}
                  {renderDetailRow("Semana", detalheModal.item.weekNumber)}
                  {renderDetailRow("Ordem", `#${detalheModal.item.indexOrder}`)}
                  {renderDetailRow("Admin autoriza", detalheModal.item.adminAuthorize ? "Sim" : "Não")}
                  {renderDetailRow("Criada em", detalheModal.item.createdAt ? new Date(detalheModal.item.createdAt).toLocaleString("pt-BR") : "-")}
                  {renderDetailRow("Atualizada em", detalheModal.item.updatedAt ? new Date(detalheModal.item.updatedAt).toLocaleString("pt-BR") : "-")}
                </>
              )}

              {detalheModal.tipo === "curso" && cursoSelecionado && courseIdSelecionado === detalheModal.item.id && (
                <div className={detailHintClass}>
                  Curso selecionado atualmente para criação de módulos.
                </div>
              )}

              {detalheModal.tipo === "modulo" && moduloSelecionado && moduloIdSelecionado === detalheModal.item.id && (
                <div className={detailHintClass}>
                  Módulo selecionado atualmente para criação de fases.
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
