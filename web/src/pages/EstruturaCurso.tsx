import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
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
  type Curso,
  type Modulo,
  type Fase,
  type ExercicioFase,
} from "../services/api";
import { AnimatedButton, AnimatedToast } from "../components/animate-ui";
import { Loader2, Plus, Layers, GitBranch, Trash2, PenLine, School, ChevronUp, ChevronDown, Eye } from "lucide-react";
import CriarExercicioForm from "../components/CriarExercicioForm";
import CriarTurmaForm from "../components/CriarTurmaForm";
import "./EstruturaCurso.css";

type AbaEstrutura = "curso" | "modulo" | "fase" | "exercicios" | "turmas";
type DetalheModalState =
  | { tipo: "curso"; item: Curso }
  | { tipo: "modulo"; item: Modulo }
  | { tipo: "fase"; item: Fase }
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
  const [deletandoDetalhe, setDeletandoDetalhe] = React.useState(false);

  // Exercises for selected phase
  const [exerciciosFase, setExerciciosFase] = React.useState<ExercicioFase[]>([]);
  const [faseIdParaExercicios, setFaseIdParaExercicios] = React.useState("");

  const abaAtiva: AbaEstrutura = React.useMemo(() => {
    if (location.pathname.endsWith("/modulos")) return "modulo";
    if (location.pathname.endsWith("/fases")) return "fase";
    if (location.pathname.endsWith("/exercicios")) return "exercicios";
    if (location.pathname.endsWith("/turmas")) return "turmas";
    return "curso";
  }, [location.pathname]);

  const rotaAba = (aba: AbaEstrutura) => {
    if (aba === "modulo") return "/dashboard/estrutura-curso/modulos";
    if (aba === "fase") return "/dashboard/estrutura-curso/fases";
    if (aba === "exercicios") return "/dashboard/estrutura-curso/exercicios";
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
    listarCursos({ page: cursoSelectPagina, limit: 8, q: cursoSelectBusca || undefined })
      .then((data) => {
        if (!ativo || Array.isArray(data)) return;
        setCursoSelectOpcoes(data.items);
        setCursoSelectTotalPages(data.pagination.totalPages);
        if (!courseIdSelecionado && data.items.length > 0) {
          const free = data.items.find((c) => !c.isPaid) ?? data.items[0];
          if (free) setCourseIdSelecionado(free.id);
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
    setCursoSelectSelecionado(fromMainList ?? fromSelectList ?? cursoSelectSelecionado);
  }, [courseIdSelecionado, cursoSelectOpcoes, cursos]);

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
    setModuloSelectSelecionado(fromMainList ?? fromSelectList ?? moduloSelectSelecionado);
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

    const nome = detalheModal.item.nome || "item";
    const tipoLabel =
      detalheModal.tipo === "curso"
        ? "curso"
        : detalheModal.tipo === "modulo"
          ? "módulo"
          : "fase";

    if (!window.confirm(`Tem certeza que deseja deletar ${tipoLabel} "${nome}"?`)) {
      return;
    }

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
      setDetalheModal(null);
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : `Erro ao deletar ${tipoLabel}` });
    } finally {
      setDeletandoDetalhe(false);
    }
  }

  return (
    <DashboardLayout title="Estrutura do Curso" subtitle="Criação e listagem separadas por página">
      <div className="estruturaContainerSingle">
        <AnimatedToast
          message={toastMsg?.msg || null}
          type={toastMsg?.type || "success"}
          duration={3000}
          onClose={() => setToastMsg(null)}
        />

        <div className="estruturaTabs" role="tablist" aria-label="Etapas de estrutura">
          <button type="button" className={`estruturaTabBtn ${abaAtiva === "curso" ? "active" : ""}`} onClick={() => navigate(rotaAba("curso"))}>
            <Plus size={16} /> Cursos
          </button>
          <button type="button" className={`estruturaTabBtn ${abaAtiva === "modulo" ? "active" : ""}`} onClick={() => navigate(rotaAba("modulo"))}>
            <Layers size={16} /> Módulos
          </button>
          <button type="button" className={`estruturaTabBtn ${abaAtiva === "fase" ? "active" : ""}`} onClick={() => navigate(rotaAba("fase"))}>
            <GitBranch size={16} /> Fase
          </button>
          <button type="button" className={`estruturaTabBtn ${abaAtiva === "exercicios" ? "active" : ""}`} onClick={() => navigate(rotaAba("exercicios"))}>
            <PenLine size={16} /> Exercícios
          </button>
          <button type="button" className={`estruturaTabBtn ${abaAtiva === "turmas" ? "active" : ""}`} onClick={() => navigate(rotaAba("turmas"))}>
            <School size={16} /> Turmas
          </button>
        </div>

        <div className="estruturaOverview" aria-label="Resumo da estrutura">
          <div className="estruturaOverviewCard">
            <span>Cursos</span>
            <strong>{globalStats.cursos}</strong>
          </div>
          <div className="estruturaOverviewCard">
            <span>Módulos</span>
            <strong>{globalStats.modulos}</strong>
          </div>
          <div className="estruturaOverviewCard">
            <span>Fases</span>
            <strong>{globalStats.fases}</strong>
          </div>
        </div>

        {abaAtiva === "curso" && (
          <div className="estruturaGrid">
            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Criar Curso</h2>
                <p>Formulário de criação de curso.</p>
              </div>
              <form onSubmit={handleCriarCurso} className="estruturaForm">
                <span>Nome do curso *</span>
                <input value={novoCursoNome} onChange={(e) => setNovoCursoNome(e.target.value)} placeholder="Ex: Programação Full Stack" />

                <span>Descrição</span>
                <textarea value={novoCursoDescricao} onChange={(e) => setNovoCursoDescricao(e.target.value)} placeholder="Opcional" />

                <label className="estruturaSwitchRow">
                  <input type="checkbox" className="estruturaSwitchInput" checked={novoCursoPago} onChange={(e) => setNovoCursoPago(e.target.checked)} />
                  <span className="estruturaSwitchTrack" aria-hidden="true">
                    <span className="estruturaSwitchThumb" />
                  </span>
                  <span className="estruturaSwitchText">{novoCursoPago ? "Curso pago" : "Curso gratuito"}</span>
                </label>

                <span>Duração (horas)</span>
                <input type="number" min={1} value={novoCursoDuracao} onChange={(e) => setNovoCursoDuracao(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 120" />

                <span>Nível de dificuldade</span>
                <select value={novoCursoNivel} onChange={(e) => setNovoCursoNivel(e.target.value)}>
                  <option value="">Selecione o nível</option>
                  <option value="iniciante">Iniciante</option>
                  <option value="iniciante-intermediario">Iniciante -&gt; Intermediário</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="intermediario-avancado">Intermediário -&gt; Avançado</option>
                  <option value="avancado">Avançado</option>
                </select>

                {!novoCursoPago && (
                  <div className="estruturaInfoBox">
                    <span>Turmas via Cadastro</span>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "4px 0 0" }}>
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

                <AnimatedButton className="estruturaSubmitBtn" type="submit" disabled={criandoCurso}>
                  {criandoCurso ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar curso</>}
                </AnimatedButton>
              </form>
            </div>

            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Cursos Disponíveis</h2>
              </div>
              {cursoSelecionado && (
                <div className="estruturaSelectedInfo">
                  <span className="estruturaSelectedLabel">Curso selecionado:</span>
                  <strong>{cursoSelecionado.nome}</strong>
                  <span className="viewerItemMeta">{cursoSelecionado.isPaid ? "Pago" : "Gratuito"}{cursoSelecionado.durationHours ? ` • ${cursoSelecionado.durationHours}h` : ""}{cursoSelecionado.price != null && cursoSelecionado.price > 0 ? ` • R$ ${Number(cursoSelecionado.price).toFixed(2)}` : ""}</span>
                  <AnimatedButton
                    type="button"
                    className="estruturaSelectedAction"
                    onClick={() => setDetalheModal({ tipo: "curso", item: cursoSelecionado })}
                  >
                    <Eye size={16} /> Ver detalhes
                  </AnimatedButton>
                </div>
              )}
              <div className="viewerList" style={{ marginTop: 10 }}>
                {carregandoCursos ? (
                  <div className="estruturaLoadingCursos" role="status" aria-live="polite">
                    <Loader2 size={18} className="estruturaLoadingCursosIcon" />
                    <span>Carregando cursos...</span>
                  </div>
                ) : paginaCursosItens.length === 0 ? (
                  <div className="viewerEmpty">Nenhum curso encontrado.</div>
                ) : (
                  paginaCursosItens.map((curso) => (
                    <button
                      key={curso.id}
                      type="button"
                      className={`viewerItem ${curso.id === courseIdSelecionado ? "active" : ""}`}
                      onClick={() => {
                        setCourseIdSelecionado(curso.id);
                      }}
                    >
                      <span className="viewerItemTitle">{curso.nome}</span>
                      <span className="viewerItemMeta">{curso.isPaid ? "Pago" : "Gratuito"}</span>
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
          <div className="estruturaGrid">
            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Criar Módulo</h2>
                <p>Formulário de criação de módulo.</p>
              </div>
              <form onSubmit={handleCriarModulo} className="estruturaForm">
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

                <AnimatedButton className="estruturaSubmitBtn" type="submit" disabled={criandoModulo}>
                  {criandoModulo ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar módulo</>}
                </AnimatedButton>
              </form>
            </div>

            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Módulos Disponíveis</h2>
                <p>Filtre e visualize os módulos do curso selecionado.</p>
              </div>
              <div className="estruturaForm">
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
                  <button type="button" className="filtroLimparBtn" onClick={() => setFiltroModuloId("")}>
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className="viewerList" style={{ marginTop: 10 }}>
                {!courseIdSelecionado ? (
                  <div className="viewerEmpty">Selecione um curso para listar módulos.</div>
                ) : carregandoModulos ? (
                  <div className="estruturaLoadingCursos" role="status" aria-live="polite">
                    <Loader2 size={18} className="estruturaLoadingCursosIcon" />
                    <span>Carregando módulos...</span>
                  </div>
                ) : paginaModulosItens.length === 0 ? (
                  <div className="viewerEmpty">Nenhum módulo encontrado.</div>
                ) : (
                  paginaModulosItens.map((mod, idx) => (
                    <div key={mod.id} className="viewerItemRow">
                      <div className="reorderBtns">
                        <button
                          type="button"
                          className="reorderBtn"
                          title="Mover para cima"
                          disabled={reordenando || (idx === 0 && paginaModulos === 1)}
                          onClick={(e) => { e.stopPropagation(); handleReordenarModulo(mod.id, "up"); }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="reorderBtn"
                          title="Mover para baixo"
                          disabled={reordenando || (idx === paginaModulosItens.length - 1 && paginaModulos * itensModulos >= totalModulosPaginacao)}
                          onClick={(e) => { e.stopPropagation(); handleReordenarModulo(mod.id, "down"); }}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className={`viewerItem ${mod.id === moduloIdSelecionado ? "active" : ""}`}
                        onClick={() => {
                          setModuloIdSelecionado(mod.id);
                          setDetalheModal({ tipo: "modulo", item: mod });
                        }}
                      >
                        <span className="viewerItemTitle">{mod.nome}</span>
                        <span className="viewerItemMeta">#{mod.indexOrder}</span>
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
          <div className="estruturaGrid">
            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Criar Fase</h2>
                <p>Formulário de criação de fase.</p>
              </div>
              <form onSubmit={handleCriarFase} className="estruturaForm">
                <span>Curso *</span>
                <PaginatedSelect
                  value={courseIdSelecionado}
                  onChange={(value) => {
                    setCourseIdSelecionado(value);
                    const found = cursoSelectOpcoes.find((curso) => curso.id === value) ?? null;
                    if (found) setCursoSelectSelecionado(found);
                  }}
                  options={cursoSelectOpcoes.map((curso) => ({
                    value: curso.id,
                    label: curso.nome,
                    meta: curso.isPaid ? "Pago" : "Gratuito",
                  }))}
                  selectedOption={cursoSelectSelecionado ? {
                    value: cursoSelectSelecionado.id,
                    label: cursoSelectSelecionado.nome,
                    meta: cursoSelectSelecionado.isPaid ? "Pago" : "Gratuito",
                  } : null}
                  placeholder="Selecione um curso"
                  emptyText="Nenhum curso cadastrado"
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

                <AnimatedButton className="estruturaSubmitBtn" type="submit" disabled={criandoFase || !moduloIdSelecionado}>
                  {criandoFase ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar fase</>}
                </AnimatedButton>
              </form>
            </div>

            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Fases Disponíveis</h2>
                <p>Filtre e visualize as fases do módulo selecionado.</p>
              </div>
              <div className="estruturaForm">
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
                  <button type="button" className="filtroLimparBtn" onClick={() => setFiltroFaseId("")}>
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className="viewerList" style={{ marginTop: 10 }}>
                {!moduloIdSelecionado ? (
                  <div className="viewerEmpty">Selecione um módulo para listar fases.</div>
                ) : carregandoFases ? (
                  <div className="estruturaLoadingCursos" role="status" aria-live="polite">
                    <Loader2 size={18} className="estruturaLoadingCursosIcon" />
                    <span>Carregando fases...</span>
                  </div>
                ) : paginaFasesItens.length === 0 ? (
                  <div className="viewerEmpty">Nenhuma fase encontrada.</div>
                ) : (
                  paginaFasesItens.map((fase, idx) => (
                    <div key={fase.id} className="viewerItemRow">
                      <div className="reorderBtns">
                        <button
                          type="button"
                          className="reorderBtn"
                          title="Mover para cima"
                          disabled={reordenando || (idx === 0 && paginaFases === 1)}
                          onClick={(e) => { e.stopPropagation(); handleReordenarFase(fase.id, "up"); }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="reorderBtn"
                          title="Mover para baixo"
                          disabled={reordenando || (idx === paginaFasesItens.length - 1 && paginaFases * itensFases >= totalFasesPaginacao)}
                          onClick={(e) => { e.stopPropagation(); handleReordenarFase(fase.id, "down"); }}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className={`viewerItem ${fase.id === faseIdParaExercicios ? "active" : ""}`}
                        onClick={() => {
                          setFaseIdParaExercicios(fase.id);
                          setDetalheModal({ tipo: "fase", item: fase });
                        }}
                      >
                        <span className="viewerItemTitle">{fase.nome}</span>
                        <span className="viewerItemMeta">Semana {fase.weekNumber}</span>
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
                <div style={{ marginTop: 16, borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)", paddingTop: 14 }}>
                  <div className="estruturaCardHead" style={{ padding: "0 0 8px" }}>
                    <h3 style={{ fontSize: "1rem", margin: 0 }}>Exercícios da Fase</h3>
                    <p style={{ fontSize: "0.82rem", margin: 0 }}>Exercícios vinculados à fase selecionada. Reordene com as setas.</p>
                  </div>
                  <div className="viewerList">
                    {exerciciosFase.length === 0 ? (
                      <div className="viewerEmpty">Nenhum exercício vinculado a esta fase.</div>
                    ) : (
                      exerciciosFase.map((ex, idx) => (
                        <div key={ex.id} className="viewerItemRow">
                          <div className="reorderBtns">
                            <button
                              type="button"
                              className="reorderBtn"
                              title="Mover para cima"
                              disabled={reordenando || idx === 0}
                              onClick={(e) => { e.stopPropagation(); handleReordenarExercicio(ex.id, "up"); }}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="reorderBtn"
                              title="Mover para baixo"
                              disabled={reordenando || idx === exerciciosFase.length - 1}
                              onClick={(e) => { e.stopPropagation(); handleReordenarExercicio(ex.id, "down"); }}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          <div className="viewerItem" style={{ cursor: "default" }}>
                            <span className="viewerItemTitle">{ex.titulo}</span>
                            <span className="viewerItemMeta">Ordem #{ex.indexOrder}{ex.difficulty != null ? ` • Dif. ${ex.difficulty}` : ""}</span>
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
          <div className="estruturaGrid">
            <CriarExercicioForm />
          </div>
        )}

        {abaAtiva === "turmas" && (
          <div className="estruturaGrid">
            <CriarTurmaForm />
          </div>
        )}

        <Modal
          isOpen={!!detalheModal}
          onClose={() => setDetalheModal(null)}
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
              <AnimatedButton className="estruturaModalBtn estruturaModalBtnGhost" onClick={() => setDetalheModal(null)}>
                Fechar
              </AnimatedButton>
              <AnimatedButton className="estruturaModalBtn estruturaModalBtnDanger" onClick={handleDeletarDetalhe} disabled={deletandoDetalhe}>
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
            <div className="estruturaDetalhesGrid">
              <div className="estruturaDetalheRow">
                <span>ID</span>
                <strong>{detalheModal.item.id}</strong>
              </div>
              <div className="estruturaDetalheRow">
                <span>Nome</span>
                <strong>{detalheModal.item.nome}</strong>
              </div>

              {detalheModal.tipo === "curso" && (
                <>
                  <div className="estruturaDetalheRow">
                    <span>Descrição</span>
                    <strong>{detalheModal.item.descricao?.trim() || "Sem descrição"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Tipo</span>
                    <strong>{detalheModal.item.isPaid ? "Pago" : "Gratuito"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Duração</span>
                    <strong>{detalheModal.item.durationHours ? `${detalheModal.item.durationHours}h` : "-"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Nível</span>
                    <strong>{detalheModal.item.level || "-"}</strong>
                  </div>
                  {detalheModal.item.isPaid && (
                    <div className="estruturaDetalheRow">
                      <span>Foco</span>
                      <strong>{detalheModal.item.focus || "-"}</strong>
                    </div>
                  )}
                  <div className="estruturaDetalheRow">
                    <span>Preço</span>
                    <strong>{detalheModal.item.price != null ? `R$ ${Number(detalheModal.item.price).toFixed(2)}` : "Gratuito"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Módulos vinculados</span>
                    <strong>{courseIdSelecionado === detalheModal.item.id ? modulosCurso.length : "-"}</strong>
                  </div>
                </>
              )}

              {detalheModal.tipo === "modulo" && (
                <>
                  <div className="estruturaDetalheRow">
                    <span>Curso ID</span>
                    <strong>{detalheModal.item.courseId}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Ordem</span>
                    <strong>#{detalheModal.item.indexOrder}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Descrição</span>
                    <strong>{detalheModal.item.descricao?.trim() || "Sem descrição"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Fases vinculadas</span>
                    <strong>{moduloIdSelecionado === detalheModal.item.id ? fasesModulo.length : "-"}</strong>
                  </div>
                </>
              )}

              {detalheModal.tipo === "fase" && (
                <>
                  <div className="estruturaDetalheRow">
                    <span>Módulo ID</span>
                    <strong>{detalheModal.item.moduleId}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Semana</span>
                    <strong>{detalheModal.item.weekNumber}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Ordem</span>
                    <strong>#{detalheModal.item.indexOrder}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Admin autoriza</span>
                    <strong>{detalheModal.item.adminAuthorize ? "Sim" : "Não"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Criada em</span>
                    <strong>{detalheModal.item.createdAt ? new Date(detalheModal.item.createdAt).toLocaleString("pt-BR") : "-"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Atualizada em</span>
                    <strong>{detalheModal.item.updatedAt ? new Date(detalheModal.item.updatedAt).toLocaleString("pt-BR") : "-"}</strong>
                  </div>
                </>
              )}

              {detalheModal.tipo === "curso" && cursoSelecionado && courseIdSelecionado === detalheModal.item.id && (
                <div className="estruturaDetalheHint">
                  Curso selecionado atualmente para criação de módulos.
                </div>
              )}

              {detalheModal.tipo === "modulo" && moduloSelecionado && moduloIdSelecionado === detalheModal.item.id && (
                <div className="estruturaDetalheHint">
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
