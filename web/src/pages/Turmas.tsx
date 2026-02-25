import React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import {
  FadeInUp,
  PulseLoader,
  AnimatedButton,
  AnimatedToast,
  AnimatedSelect,
  AnimatedToggle,
} from "../components/animate-ui";
import {
  RefreshCcw,
  Loader2,
  Save,
  Plus,
  X,
  BookOpen,
  Users,
  User as UserIcon,
  Pencil,
  Trash2,
  Calendar,
  ArrowRight,
} from "lucide-react";
import {
  listarTurmas,
  criarTurma,
  atualizarTurma,
  deletarTurma,
  getRole,
  listarAlunos,
  adicionarAlunosNaTurma,
  configurarCronograma,
  obterCronograma,
  listarCursos,
  listarModulosPorCurso,
  criarModulo,
  criarFase,
  listarFasesDoModulo,
  listarExercicios,
  type Turma,
  type User,
  type Curso,
  type Modulo,
  type Fase,
  type Exercicio,
} from "../services/api";
import ConfirmModal from "../components/ConfirmModal";
import "./Turmas.css";

export default function TurmasPage() {
  const navigate = useNavigate();
  const role = getRole();
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );
  const canCreate = role === "admin";

  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);

  // Form
  const [nome, setNome] = React.useState("");
  const [tipo, setTipo] = React.useState<"turma" | "particular">("turma");
  const [categoria, setCategoria] = React.useState<"programacao" | "informatica">("programacao");
  const [descricao, setDescricao] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [cursos, setCursos] = React.useState<Curso[]>([]);
  const [modulosCurso, setModulosCurso] = React.useState<Modulo[]>([]);
  const [courseIdSelecionado, setCourseIdSelecionado] = React.useState("");
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");

  // Form criação de módulo/fase
  const [novoModuloNome, setNovoModuloNome] = React.useState("");
  const [novoModuloDescricao, setNovoModuloDescricao] = React.useState("");
  const [novoModuloCourseId, setNovoModuloCourseId] = React.useState("");
  const [criandoModulo, setCriandoModulo] = React.useState(false);

  const [novaFaseNome, setNovaFaseNome] = React.useState("");
  const [novaFaseWeek, setNovaFaseWeek] = React.useState(1);
  const [novaFaseModuloId, setNovaFaseModuloId] = React.useState("");
  const [fasesModuloAtual, setFasesModuloAtual] = React.useState<Fase[]>([]);
  const [criandoFase, setCriandoFase] = React.useState(false);

  // Cronograma
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = React.useState<Exercicio[]>([]);
  const [exerciciosSelecionados, setExerciciosSelecionados] = React.useState<string[]>([]);
  const [semanaExercicios, setSemanaExercicios] = React.useState(1);
  const [carregandoExercicios, setCarregandoExercicios] = React.useState(false);

  const [dataInicio, setDataInicio] = React.useState("");
  const [duracaoSemanas, setDuracaoSemanas] = React.useState(12);
  const [cronogramaAtivo, setCronogramaAtivo] = React.useState(false);

  // Modal
  const [modalDeletar, setModalDeletar] = React.useState<{
    isOpen: boolean;
    turmaId: string | null;
    turmaNome: string | null;
  }>({ isOpen: false, turmaId: null, turmaNome: null });

  // Modal Adicionar Alunos
  const [modalAdicionarAberto, setModalAdicionarAberto] = React.useState(false);
  const [turmaAcabadaCriar, setTurmaAcabadaCriar] = React.useState<Turma | null>(null);
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [adicionando, setAdicionando] = React.useState(false);

  async function load() {
    try {
      setLoading(true);
      const data = await listarTurmas();
      setTurmas(data);
    } catch (e) {
      setToastMsg({ type: 'error', msg: e instanceof Error ? e.message : "Erro ao carregar turmas" });
    } finally {
      setLoading(false);
    }
  }

  async function carregarModulosDoCurso(courseId: string, moduloAtual?: string) {
    if (!courseId) {
      setModulosCurso([]);
      setModuloIdSelecionado("");
      return;
    }
    const mods = await listarModulosPorCurso(courseId);
    setModulosCurso(mods);
    if (moduloAtual && mods.some((m) => m.id === moduloAtual)) {
      setModuloIdSelecionado(moduloAtual);
      return;
    }
    setModuloIdSelecionado(mods[0]?.id ?? "");
  }

  React.useEffect(() => {
    load();

    if (role === "admin") {
      listarCursos()
        .then(async (data) => {
          setCursos(data);
          const firstCourseId = data[0]?.id ?? "";
          setCourseIdSelecionado(firstCourseId);
          setNovoModuloCourseId(firstCourseId);
          if (firstCourseId) {
            await carregarModulosDoCurso(firstCourseId);
          }
        })
        .catch((e) => console.error("Erro ao carregar cursos:", e));
    }
  }, [role]);

  React.useEffect(() => {
    if (role !== "admin") return;
    setCarregandoExercicios(true);
    listarExercicios()
      .then((data) => setExerciciosDisponiveis(data || []))
      .catch((e) => console.error("Erro ao carregar exercicios:", e))
      .finally(() => setCarregandoExercicios(false));
  }, [role]);

  React.useEffect(() => {
    if (role !== "admin") return;
    if (!courseIdSelecionado) {
      setModulosCurso([]);
      setModuloIdSelecionado("");
      return;
    }
    carregarModulosDoCurso(courseIdSelecionado).catch((e) => {
      console.error("Erro ao carregar módulos do curso:", e);
      setModulosCurso([]);
      setModuloIdSelecionado("");
    });
  }, [courseIdSelecionado, role]);

  React.useEffect(() => {
    if (role !== "admin") return;
    if (!novaFaseModuloId) {
      setFasesModuloAtual([]);
      return;
    }
    listarFasesDoModulo(novaFaseModuloId)
      .then(setFasesModuloAtual)
      .catch(() => setFasesModuloAtual([]));
  }, [novaFaseModuloId, role]);

  async function adicionarExerciciosNoCronograma(turmaId: string) {
    if (exerciciosSelecionados.length === 0) return;

    const semanaFinal = Math.max(1, Math.min(semanaExercicios, duracaoSemanas || 1));

    let cronogramaExistente: Record<number, Array<{ id: string }>> = {};

    try {
      const data = await obterCronograma(turmaId);
      cronogramaExistente = data.cronograma || {};
    } catch {
      cronogramaExistente = {};
    }

    const mapa: Record<number, string[]> = {};
    Object.entries(cronogramaExistente).forEach(([semana, exercicios]) => {
      const ids = exercicios.map((ex) => ex.id);
      mapa[Number(semana)] = ids;
    });

    const atuais = mapa[semanaFinal] ?? [];
    const novos = exerciciosSelecionados.filter((id) => !atuais.includes(id));
    mapa[semanaFinal] = [...atuais, ...novos];

    const semanas = Object.entries(mapa)
      .map(([semana, exercicios]) => ({
        semana: Number(semana),
        exercicios,
      }))
      .filter((item) => item.exercicios.length > 0)
      .sort((a, b) => a.semana - b.semana);

    await configurarCronograma(turmaId, semanas);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setToastMsg({ type: 'error', msg: "Nome da turma é obrigatório" });
      return;
    }

    try {
      setSaving(true);
      setToastMsg(null);

      if (editandoId) {
        const atualizarDados: any = { nome, tipo, categoria, descricao: descricao || null };

        // Adicionar campos de cronograma
        atualizarDados.data_inicio = dataInicio || null;
        atualizarDados.duracao_semanas = duracaoSemanas;
        atualizarDados.cronograma_ativo = cronogramaAtivo;
        if (courseIdSelecionado) atualizarDados.course_id = Number(courseIdSelecionado);
        if (moduloIdSelecionado) atualizarDados.current_module_id = Number(moduloIdSelecionado);

        await atualizarTurma(editandoId, atualizarDados);

        if (exerciciosSelecionados.length > 0) {
          try {
            await adicionarExerciciosNoCronograma(editandoId);
            setToastMsg({ type: 'success', msg: "Turma atualizada e exercicios adicionados!" });
          } catch (err) {
            console.error("Erro ao adicionar exercícios no cronograma:", err);
            setToastMsg({ type: 'success', msg: "Turma atualizada!" });
            setToastMsg({ type: 'error', msg: "Falha ao Adicionar exercícios ao cronograma." });
          }
        } else {
          setToastMsg({ type: 'success', msg: "Turma atualizada!" });
        }

        setEditandoId(null);
      } else {
        const criarDados: any = { nome, tipo, categoria, descricao: descricao || null };

        // Adicionar campos de cronograma
        criarDados.data_inicio = dataInicio || null;
        criarDados.duracao_semanas = duracaoSemanas;
        criarDados.cronograma_ativo = cronogramaAtivo;
        if (courseIdSelecionado) criarDados.course_id = Number(courseIdSelecionado);
        if (moduloIdSelecionado) criarDados.current_module_id = Number(moduloIdSelecionado);

        const created = await criarTurma(criarDados);
        const turmaCriada = created.turma;

        if (exerciciosSelecionados.length > 0 && turmaCriada) {
          try {
            await adicionarExerciciosNoCronograma(turmaCriada.id);
            setToastMsg({ type: 'success', msg: "Turma criada e exercicios adicionados! Agora adicione alunos." });
          } catch (err) {
            console.error("Erro ao adicionar exercícios no cronograma:", err);
            setToastMsg({ type: 'success', msg: "Turma criada! Agora adicione alunos." });
            setToastMsg({ type: 'error', msg: "Falha ao Adicionar exercícios ao cronograma." });
          }
        } else {
          setToastMsg({ type: 'success', msg: "Turma criada! Agora adicione alunos." });
        }

        if (turmaCriada) {
          setTurmaAcabadaCriar(turmaCriada);
          const alunos = await listarAlunos();
          setAlunosDisponiveis(alunos);
          setModalAdicionarAberto(true);
        }
      }

      setNome("");
      setTipo("turma");
      setCategoria("programacao");
      setDescricao("");
      setDataInicio("");
      setDuracaoSemanas(12);
      setCronogramaAtivo(false);
      setExerciciosSelecionados([]);
      setSemanaExercicios(1);

      if (editandoId) {
        await load();
      }
    } catch (e) {
      setToastMsg({ type: 'error', msg: e instanceof Error ? e.message : "Erro ao salvar turma" });
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(turma: Turma) {
    setNome(turma.nome);
    setTipo(turma.tipo);
    setCategoria(turma.categoria);
    setDescricao(turma.descricao || "");
    setDataInicio(turma.dataInicio ? turma.dataInicio.split('T')[0] : "");
    setDuracaoSemanas(turma.duracaoSemanas || 12);
    setCronogramaAtivo(turma.cronogramaAtivo || false);
    setCourseIdSelecionado(turma.courseId || "");
    if (turma.courseId) {
      carregarModulosDoCurso(turma.courseId, turma.currentModuleId || "").catch((e) =>
        console.error("Erro ao carregar módulos da turma:", e)
      );
    } else {
      setModuloIdSelecionado("");
    }
    setEditandoId(turma.id);

    setTimeout(() => {
      const formElement = document.querySelector(".turmaFormCard");
      formElement?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function handleCancel() {
    setNome("");
    setTipo("turma");
    setCategoria("programacao");
    setDescricao("");
    setDataInicio("");
    setDuracaoSemanas(12);
    setCronogramaAtivo(false);
    if (cursos[0]?.id) {
      setCourseIdSelecionado(cursos[0].id);
      setNovoModuloCourseId(cursos[0].id);
    } else {
      setCourseIdSelecionado("");
    }
    setModuloIdSelecionado("");
    setEditandoId(null);
  }

  function abrirModalDeletar(id: string, nome: string) {
    setModalDeletar({ isOpen: true, turmaId: id, turmaNome: nome });
  }

  function fecharModalDeletar() {
    setModalDeletar({ isOpen: false, turmaId: null, turmaNome: null });
  }

  async function confirmarDeletar() {
    if (!modalDeletar.turmaId) return;

    try {
      setSaving(true);
      await deletarTurma(modalDeletar.turmaId);
      setToastMsg({ type: 'success', msg: "Turma deletada com sucesso!" });
      fecharModalDeletar();
      await load();
    } catch (e) {
      setToastMsg({ type: 'error', msg: e instanceof Error ? e.message : "Erro ao deletar turma" });
    } finally {
      setSaving(false);
    }
  }

  function fecharModalAdicionar() {
    setModalAdicionarAberto(false);
    setTurmaAcabadaCriar(null);
    setAlunosSelecionados([]);
    setAlunosDisponiveis([]);
  }

  async function handleAdicionarAlunos() {
    if (!turmaAcabadaCriar || alunosSelecionados.length === 0) return;

    try {
      setAdicionando(true);
      await adicionarAlunosNaTurma(turmaAcabadaCriar.id, alunosSelecionados);
      setToastMsg({ type: 'success', msg: "Alunos adicionados com sucesso!" });
      fecharModalAdicionar();
      await load();
    } catch (e) {
      setToastMsg({ type: 'error', msg: e instanceof Error ? e.message : "Erro ao adicionar alunos" });
    } finally {
      setAdicionando(false);
    }
  }

  async function handleCriarModulo(e: React.FormEvent) {
    e.preventDefault();
    if (!novoModuloNome.trim() || !novoModuloCourseId) {
      setToastMsg({ type: "error", msg: "Informe curso e nome do módulo" });
      return;
    }

    try {
      setCriandoModulo(true);
      const created = await criarModulo({
        nome: novoModuloNome.trim(),
        descricao: novoModuloDescricao.trim() || null,
        course_id: Number(novoModuloCourseId),
      });
      setToastMsg({ type: "success", msg: "Módulo criado com sucesso!" });
      setNovoModuloNome("");
      setNovoModuloDescricao("");
      setCourseIdSelecionado(novoModuloCourseId);
      await carregarModulosDoCurso(novoModuloCourseId, created.modulo.id);
      setNovaFaseModuloId(created.modulo.id);
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao criar módulo" });
    } finally {
      setCriandoModulo(false);
    }
  }

  async function handleCriarFase(e: React.FormEvent) {
    e.preventDefault();
    if (!novaFaseModuloId || !novaFaseNome.trim()) {
      setToastMsg({ type: "error", msg: "Informe módulo e nome da fase" });
      return;
    }

    try {
      setCriandoFase(true);
      await criarFase(novaFaseModuloId, {
        nome: novaFaseNome.trim(),
        week_number: novaFaseWeek,
      });
      setToastMsg({ type: "success", msg: "Fase criada com sucesso!" });
      setNovaFaseNome("");
      const fases = await listarFasesDoModulo(novaFaseModuloId);
      setFasesModuloAtual(fases);
      setNovaFaseWeek((prev) => prev + 1);
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao criar fase" });
    } finally {
      setCriandoFase(false);
    }
  }

  const disabled =
    saving || !nome.trim() || !courseIdSelecionado || !moduloIdSelecionado;

  const emptyTitle =
    role === "aluno"
      ? "Não registrado em nenhuma turma"
      : "Nenhuma turma registrada";
  const emptyDescription = !canCreate
    ? "Você ainda não está registrado em nenhuma turma. Aguarde administrador adicioná-lo a uma turma."
    : "Crie sua primeira turma preenchendo o formulario acima.";

  return (
    <DashboardLayout
      title="Turmas"
      subtitle="Gerencie suas turmas e alunos"
    >
      <FadeInUp duration={0.28}>
        <div className="turmasContainer">
          <AnimatedToast
            message={toastMsg?.msg || null}
            type={toastMsg?.type || 'success'}
            duration={3000}
            onClose={() => setToastMsg(null)}
          />
          {/* HEADER */}
          <div className="turmasHeader">
            <div />
            <button className="refreshBtn" onClick={load} disabled={loading}>
            {loading
              ? iconLabel(<Loader2 size={16} />, "Carregando...")
              : iconLabel(<RefreshCcw size={16} />, "Atualizar")}
            </button>
          </div>

          {/* FORMULÁRIO */}
          {canCreate && (
            <div className="turmaFormCard">
              <h2 className="turmaFormTitle">
                {editandoId ? "Editar Turma" : "Criar Nova Turma"}
              </h2>

              <form onSubmit={handleSubmit} className="turmaForm">
                <div className="turmaInputGroup">
                  <label className="turmaLabel">Nome da Turma *</label>
                  <input
                    className="turmaInput"
                    placeholder="ex: Turma A 2024"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                <div className="turmaInputGroup">
                  <label className="turmaLabel">Tipo *</label>
                  <AnimatedSelect
                    className="turmaSelect"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as "turma" | "particular")}
                  >
                    <option value="turma">Turma (Grupo)</option>
                    <option value="particular">Particular</option>
                  </AnimatedSelect>
                </div>

                <div className="turmaInputGroup">
                  <label className="turmaLabel">Categoria *</label>
                  <AnimatedSelect
                    className="turmaSelect"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as "programacao" | "informatica")}
                  >
                    <option value="programacao">Programação</option>
                    <option value="informatica">Informática</option>
                  </AnimatedSelect>
                </div>

                <div className="turmaInputGroup">
                  <label className="turmaLabel">Curso *</label>
                  <AnimatedSelect
                    className="turmaSelect"
                    value={courseIdSelecionado}
                    onChange={(e) => setCourseIdSelecionado(e.target.value)}
                  >
                    <option value="">Selecione um curso</option>
                    {cursos.map((curso) => (
                      <option key={curso.id} value={curso.id}>
                        {curso.nome}
                      </option>
                    ))}
                  </AnimatedSelect>
                </div>

                <div className="turmaInputGroup">
                  <label className="turmaLabel">Módulo Inicial *</label>
                  <AnimatedSelect
                    className="turmaSelect"
                    value={moduloIdSelecionado}
                    onChange={(e) => setModuloIdSelecionado(e.target.value)}
                    disabled={!courseIdSelecionado || modulosCurso.length === 0}
                  >
                    <option value="">Selecione um módulo</option>
                    {modulosCurso.map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        {mod.indexOrder}. {mod.nome}
                      </option>
                    ))}
                  </AnimatedSelect>
                </div>

                <div className="turmaInputGroup">
                  <label className="turmaLabel">Descrição</label>
                  <textarea
                    className="turmaTextarea"
                    placeholder="Descrição opcional da turma..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>

                {/* CRONOGRAMA */}
                <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                    Configuração de Cronograma (Opcional)
                  </h3>

                  <div className="turmaInputGroup">
                    <label className="turmaLabel">Data de Início da Turma</label>
                    <input
                      type="date"
                      className="turmaInput"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                    <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
                      Data em que a turma começa (para liberação semanal de exercícios)
                    </small>
                  </div>

                  <div className="turmaInputGroup">
                    <label className="turmaLabel">Duração do Cronograma (semanas)</label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      className="turmaInput"
                      value={duracaoSemanas}
                      onChange={(e) => setDuracaoSemanas(parseInt(e.target.value) || 12)}
                    />
                    <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
                      Quantas semanas terá o cronograma (padrão: 12 semanas)
                    </small>
                  </div>

                  <div className="turmaInputGroup">
                    <label style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <AnimatedToggle
                        checked={cronogramaAtivo}
                        onChange={setCronogramaAtivo}
                      />
                      <span className="turmaLabel" style={{ margin: 0 }}>Ativar Cronograma Automático</span>
                    </label>
                    <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
                      Se ativado, os exercícios serão liberados automaticamente conforme o cronograma
                    </small>
                  </div>
                </div>

                <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                    Adicionar exercícios ao cronograma
                  </h3>

                  <div className="turmaInputGroup">
                    <label className="turmaLabel">Semana para liberar</label>
                    <input
                      type="number"
                      min="1"
                      max={duracaoSemanas}
                      className="turmaInput"
                      value={semanaExercicios}
                      onChange={(e) => setSemanaExercicios(parseInt(e.target.value) || 1)}
                    />
                    <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
                      Escolha a semana do cronograma para esses exercícios
                    </small>
                  </div>

                  {carregandoExercicios ? (
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>Carregando exercícios...</div>
                  ) : (() => {
                    const filtrados = exerciciosDisponiveis.filter((exercicio) => (exercicio.categoria || "programacao") === categoria);
                    return filtrados.length === 0 ? (
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        {exerciciosDisponiveis.length === 0
                          ? "Nenhum exercício cadastrado."
                          : `Nenhum exercício de ${categoria === "informatica" ? "Informática" : "Programação"} encontrado.`}
                      </div>
                    ) : (
                      <div className="exerciciosSelectorList">
                        {filtrados.map((exercicio) => (
                          <label key={exercicio.id} className="exercicioCheckboxItem">
                            <input
                              type="checkbox"
                              checked={exerciciosSelecionados.includes(exercicio.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setExerciciosSelecionados([...exerciciosSelecionados, exercicio.id]);
                                } else {
                                  setExerciciosSelecionados(
                                    exerciciosSelecionados.filter((id) => id !== exercicio.id)
                                  );
                                }
                              }}
                            />
                            <div className="exercicioCheckboxInfo">
                              <div className="exercicioCheckboxTitle">{exercicio.titulo}</div>
                              <div className="exercicioCheckboxMeta">{exercicio.modulo || "Sem modulo"}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })()}

                  {!cronogramaAtivo && (
                    <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, display: "block" }}>
                      O cronograma está desativado. Os exercícios serão salvos, mas não serão liberados automaticamente.
                    </small>
                  )}
                </div>

                <div className="turmaActions">
                  <AnimatedButton
                    type="submit"
                    className="turmaSubmitBtn"
                    disabled={disabled}
                  >
                    {saving
                      ? iconLabel(<Loader2 size={16} />, "Salvando...")
                      : editandoId
                        ? iconLabel(<Save size={16} />, "Atualizar Turma")
                        : iconLabel(<Plus size={16} />, "Criar Turma")}
                  </AnimatedButton>
                  {editandoId && (
                    <AnimatedButton
                      type="button"
                      className="turmaCancelBtn"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      {iconLabel(<X size={16} />, "Cancelar")}
                    </AnimatedButton>
                  )}
                </div>
              </form>
            </div>
          )}

          {canCreate && (
            <div className="turmaFormCard" style={{ marginTop: 16 }}>
              <h2 className="turmaFormTitle">Criar Módulo e Fase</h2>

              <form onSubmit={handleCriarModulo} className="turmaForm" style={{ marginBottom: 18 }}>
                <div className="turmaInputGroup">
                  <label className="turmaLabel">Curso do Módulo *</label>
                  <AnimatedSelect
                    className="turmaSelect"
                    value={novoModuloCourseId}
                    onChange={(e) => setNovoModuloCourseId(e.target.value)}
                  >
                    <option value="">Selecione um curso</option>
                    {cursos.map((curso) => (
                      <option key={curso.id} value={curso.id}>
                        {curso.nome}
                      </option>
                    ))}
                  </AnimatedSelect>
                </div>
                <div className="turmaInputGroup">
                  <label className="turmaLabel">Nome do Módulo *</label>
                  <input
                    className="turmaInput"
                    value={novoModuloNome}
                    onChange={(e) => setNovoModuloNome(e.target.value)}
                    placeholder="Ex: JavaScript + DOM"
                  />
                </div>
                <div className="turmaInputGroup">
                  <label className="turmaLabel">Descrição do Módulo</label>
                  <textarea
                    className="turmaTextarea"
                    value={novoModuloDescricao}
                    onChange={(e) => setNovoModuloDescricao(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="turmaActions">
                  <AnimatedButton className="turmaSubmitBtn" type="submit" disabled={criandoModulo}>
                    {criandoModulo ? iconLabel(<Loader2 size={16} />, "Criando módulo...") : iconLabel(<Plus size={16} />, "Criar Módulo")}
                  </AnimatedButton>
                </div>
              </form>

              <form onSubmit={handleCriarFase} className="turmaForm">
                <div className="turmaInputGroup">
                  <label className="turmaLabel">Módulo da Fase *</label>
                  <AnimatedSelect
                    className="turmaSelect"
                    value={novaFaseModuloId}
                    onChange={(e) => setNovaFaseModuloId(e.target.value)}
                  >
                    <option value="">Selecione um módulo</option>
                    {modulosCurso.map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        {mod.indexOrder}. {mod.nome}
                      </option>
                    ))}
                  </AnimatedSelect>
                </div>
                <div className="turmaInputGroup">
                  <label className="turmaLabel">Nome da Fase *</label>
                  <input
                    className="turmaInput"
                    value={novaFaseNome}
                    onChange={(e) => setNovaFaseNome(e.target.value)}
                    placeholder="Ex: Semana 1 - Introdução"
                  />
                </div>
                <div className="turmaInputGroup">
                  <label className="turmaLabel">Semana</label>
                  <input
                    type="number"
                    min={1}
                    className="turmaInput"
                    value={novaFaseWeek}
                    onChange={(e) => setNovaFaseWeek(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                {novaFaseModuloId && (
                  <small style={{ fontSize: 12, color: "var(--muted)" }}>
                    {fasesModuloAtual.length} fase(s) cadastrada(s) neste módulo.
                  </small>
                )}
                <div className="turmaActions">
                  <AnimatedButton className="turmaSubmitBtn" type="submit" disabled={criandoFase}>
                    {criandoFase ? iconLabel(<Loader2 size={16} />, "Criando fase...") : iconLabel(<Plus size={16} />, "Criar Fase")}
                  </AnimatedButton>
                </div>
              </form>
            </div>
          )}

          {/* LISTA DE TURMAS */}
          <div>
            {loading && turmas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <PulseLoader size="large" text="Carregando turmas..." />
              </div>
            ) : !loading && turmas.length === 0 ? (
              <div className="emptyState">
                <div className="emptyIcon" style={{ display: "inline-flex" }}>
                  <BookOpen size={22} />
                </div>
                <div className="emptyTitle">{emptyTitle}</div>
                <p style={{ margin: "8px 0 0 0", color: "var(--muted)" }}>
                  {emptyDescription}
                </p>
              </div>
            ) : (
              <>
                <div className="turmasList">
                  {(() => {
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const paginatedTurmas = turmas.slice(startIndex, endIndex);

                    return paginatedTurmas.map((turma, i) => (
                      <FadeInUp key={turma.id} delay={i * 0.05}>
                        <div className="turmaCard">
                          <div className="turmaCardHeader">
                            <div className="turmaCardInfo">
                              <h3 className="turmaCardTitle">{turma.nome}</h3>
                              <span className={`turmaBadge tipo-${turma.tipo}`}>
                                {turma.tipo === "turma"
                                  ? iconLabel(<Users size={14} />, "Grupo")
                                  : iconLabel(<UserIcon size={14} />, "Particular")}
                              </span>
                            </div>
                            {canCreate && (
                              <div className="turmaCardActions">
                                <AnimatedButton
                                  className="turmaEditBtn"
                                  onClick={() => handleEdit(turma)}
                                  title="Editar turma"
                                >
                                  <Pencil size={16} />
                                </AnimatedButton>
                                <AnimatedButton
                                  className="turmaDeleteBtn"
                                  onClick={() => abrirModalDeletar(turma.id, turma.nome)}
                                  title="Deletar turma"
                                >
                                  <Trash2 size={16} />
                                </AnimatedButton>
                              </div>
                            )}
                          </div>

                          {turma.descricao && (
                            <p className="turmaCardDescription">{turma.descricao}</p>
                          )}

                          <div className="turmaCardStats">
                            <div className="statItem">
                              <span className="statIcon" style={{ display: "inline-flex" }}>
                                <Users size={18} />
                              </span>
                              <span className="statText">Alunos</span>
                            </div>
                            <div className="statItem">
                              <span className="statIcon" style={{ display: "inline-flex" }}>
                                <Calendar size={18} />
                              </span>
                              <span className="statText">
                                {new Date(turma.createdAt).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="turmaCardFooter">
                            {canCreate && (
                              <AnimatedButton
                                className="turmaManageBtn"
                                onClick={() => navigate(`/dashboard/turmas/${turma.id}`)}
                              >
                                {iconLabel(<Users size={16} />, "Gerenciar Alunos")}
                              </AnimatedButton>
                            )}
                            <AnimatedButton
                              className="turmaViewBtn"
                              onClick={() => navigate(`/dashboard/turmas/${turma.id}`)}
                            >
                              {iconLabel(<ArrowRight size={16} />, "Ver Detalhes")}
                            </AnimatedButton>
                          </div>
                        </div>
                      </FadeInUp>
                    ));
                  })()}
                </div>

                <Pagination
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={turmas.length}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </>
            )}
          </div>

          {/* MODAL DE CONFIRMAÇÃO */}
          <ConfirmModal
            isOpen={modalDeletar.isOpen}
            title="Deletar Turma"
            message={`Tem certeza que deseja deletar "${modalDeletar.turmaNome}"? Todos os alunos serão removidos desta turma.`}
            confirmText="Deletar"
            cancelText="Cancelar"
            onConfirm={confirmarDeletar}
            onCancel={fecharModalDeletar}
            danger={true}
            isLoading={saving}
          />

          {/* MODAL ADICIONAR ALUNOS */}
          {modalAdicionarAberto && createPortal(
            <div className="modalOverlay" onClick={fecharModalAdicionar}>
              <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <h3>Adicionar alunos à turma: {turmaAcabadaCriar?.nome}</h3>

                {alunosDisponiveis.length === 0 ? (
                  <p style={{ color: "var(--muted)", textAlign: "center" }}>
                    Nenhum aluno disponível para adicionar.
                  </p>
                ) : (
                  <div className="alunosSelectorList">
                    {alunosDisponiveis.map((aluno) => (
                      <label key={aluno.id} className="alunoCheckboxItem">
                        <input
                          type="checkbox"
                          checked={alunosSelecionados.includes(aluno.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAlunosSelecionados([...alunosSelecionados, aluno.id]);
                            } else {
                              setAlunosSelecionados(
                                alunosSelecionados.filter((id) => id !== aluno.id)
                              );
                            }
                          }}
                        />
                        <span className="alunoCheckboxAvatar">
                          {aluno.nome.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="alunoCheckboxInfo">
                          <div className="alunoCheckboxName">{aluno.nome}</div>
                          <div className="alunoCheckboxUser">@{aluno.usuario}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="modalActions">
                  <AnimatedButton
                    onClick={fecharModalAdicionar}
                    className="modalBtnCancel"
                    disabled={adicionando}
                  >
                    Pular por enquanto
                  </AnimatedButton>
                  <AnimatedButton
                    onClick={handleAdicionarAlunos}
                    className="modalBtnConfirm"
                    disabled={adicionando || alunosSelecionados.length === 0}
                  >
                    {adicionando ? iconLabel(<Loader2 size={16} />, "Adicionando...") : "Adicionar"}
                  </AnimatedButton>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}






