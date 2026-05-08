import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconAction } from "@/components/ui/icon-action";
import { ListStatusState } from "@/components/ui/list-status-state";
import { usePersistedListParams } from "@/hooks/use-persisted-list-params";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  User as UserIcon,
  Users,
  X,
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import { FadeInUp, AnimatedToast } from "../components/animate-ui";
import ConfirmModal from "../components/ConfirmModal";
import {
  adicionarAlunosNaTurma,
  atualizarTurma,
  configurarCronograma,
  criarTurma,
  deletarTurma,
  getRole,
  listarAlunos,
  listarCursos,
  listarExercicios,
  listarModulosPorCurso,
  listarTurmas,
  obterCronograma,
  type Curso,
  type Exercicio,
  type Modulo,
  type Turma,
  type User,
} from "../services/api";

export default function TurmasPage() {
  const navigate = useNavigate();
  const role = getRole();
  const canCreate = role === "admin";

  const panelClass = "rounded-[28px] border border-border/70 bg-card/95 shadow-sm";
  const fieldClass =
    "h-11 w-full rounded-xl border border-input bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";
  const textMutedClass = "text-sm leading-6 text-muted-foreground";

  const formCardRef = React.useRef<HTMLDivElement | null>(null);

  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [erroLista, setErroLista] = React.useState<string | null>(null);
  const [toastMsg, setToastMsg] = React.useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const { values: queryState, setParams } = usePersistedListParams({
    page: {
      defaultValue: 1,
      parse: (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
      },
    },
    limit: {
      defaultValue: 5,
      parse: (value) => {
        const parsed = Number(value);
        return [5, 10, 20, 50].includes(parsed) ? parsed : 5;
      },
    },
  }, { pageKey: "page" });
  const [currentPage, setCurrentPage] = React.useState(queryState.page);
  const [itemsPerPage, setItemsPerPage] = React.useState(queryState.limit);
  const [nome, setNome] = React.useState("");
  const [tipo, setTipo] = React.useState<"turma" | "particular">("turma");
  const [categoria, setCategoria] = React.useState<"programacao" | "informatica">("programacao");
  const [descricao, setDescricao] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [formAberto, setFormAberto] = React.useState(false);
  const [cursos, setCursos] = React.useState<Curso[]>([]);
  const [modulosCurso, setModulosCurso] = React.useState<Modulo[]>([]);
  const [courseIdSelecionado, setCourseIdSelecionado] = React.useState("");
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");
  const [, setExerciciosDisponiveis] = React.useState<Exercicio[]>([]);
  const [exerciciosSelecionados, setExerciciosSelecionados] = React.useState<string[]>([]);
  const [semanaExercicios, setSemanaExercicios] = React.useState(1);
  const [, setCarregandoExercicios] = React.useState(false);
  const [dataInicio, setDataInicio] = React.useState("");
  const [duracaoSemanas, setDuracaoSemanas] = React.useState(12);
  const [cronogramaAtivo, setCronogramaAtivo] = React.useState(false);
  const [modalDeletar, setModalDeletar] = React.useState<{
    isOpen: boolean;
    turmaId: string | null;
    turmaNome: string | null;
  }>({ isOpen: false, turmaId: null, turmaNome: null });
  const [modalAdicionarAberto, setModalAdicionarAberto] = React.useState(false);
  const [turmaAcabadaCriar, setTurmaAcabadaCriar] = React.useState<Turma | null>(null);
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [adicionando, setAdicionando] = React.useState(false);

  const handleCurrentPageChange = React.useCallback((page: number) => {
    setCurrentPage(page);
    setParams({ page }, { resetPage: false });
  }, [setParams]);

  const handleItemsPerPageChange = React.useCallback((limit: number) => {
    setItemsPerPage(limit);
    setParams({ limit, page: 1 });
  }, [setParams]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setErroLista(null);
      const data = await listarTurmas({
        page: currentPage,
        limit: itemsPerPage,
      });
      setTurmas(data.items);
      setTotalItems(data.total);
      const safeTotalPages = Math.max(data.pagination.totalPages || 1, 1);
      if (currentPage > safeTotalPages) {
        handleCurrentPageChange(safeTotalPages);
        return;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar turmas";
      setErroLista(message);
      setToastMsg({
        type: "error",
        msg: message,
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, handleCurrentPageChange, itemsPerPage]);

  const carregarModulosDoCurso = React.useCallback(async (courseId: string, moduloAtual?: string) => {
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
  }, []);

  const resetForm = React.useCallback(() => {
    setNome("");
    setTipo("turma");
    setCategoria("programacao");
    setDescricao("");
    setDataInicio("");
    setDuracaoSemanas(12);
    setCronogramaAtivo(false);
    setExerciciosSelecionados([]);
    setSemanaExercicios(1);
    setEditandoId(null);

    const firstCourseId = cursos[0]?.id ?? "";
    setCourseIdSelecionado(firstCourseId);
    if (firstCourseId) {
      void carregarModulosDoCurso(firstCourseId);
    } else {
      setModuloIdSelecionado("");
      setModulosCurso([]);
    }
  }, [carregarModulosDoCurso, cursos]);

  const abrirCriacao = React.useCallback(() => {
    resetForm();
    setFormAberto(true);
    window.setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [resetForm]);

  const abrirDetalhes = React.useCallback((turmaId: string) => {
    navigate(appRoutes.turmaDetalhe(turmaId));
  }, [navigate]);

  const abrirSalaDeAula = React.useCallback((turmaId: string) => {
    navigate(`${appRoutes.turmaDetalhe(turmaId)}?tab=sala-de-aula`);
  }, [navigate]);

  React.useEffect(() => {
    if (role === "admin") {
      listarCursos()
        .then(async (data) => {
          setCursos(data);
          const firstCourseId = data[0]?.id ?? "";
          setCourseIdSelecionado(firstCourseId);
          if (firstCourseId) {
            await carregarModulosDoCurso(firstCourseId);
          }
        })
        .catch((e) => console.error("Erro ao carregar cursos:", e));
    }
  }, [carregarModulosDoCurso, role]);

  React.useEffect(() => {
    if (currentPage !== queryState.page) setCurrentPage(queryState.page);
    if (itemsPerPage !== queryState.limit) setItemsPerPage(queryState.limit);
  }, [currentPage, itemsPerPage, queryState.limit, queryState.page]);

  React.useEffect(() => {
    void load();
  }, [load]);

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
      console.error("Erro ao carregar modulos do curso:", e);
      setModulosCurso([]);
      setModuloIdSelecionado("");
    });
  }, [carregarModulosDoCurso, courseIdSelecionado, role]);

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
    const novos = exerciciosSelecionados.filter((itemId) => !atuais.includes(itemId));
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
      setToastMsg({ type: "error", msg: "Nome da turma e obrigatorio" });
      return;
    }

    try {
      setSaving(true);
      setToastMsg(null);

      if (editandoId) {
        const atualizarDados: any = { nome, tipo, categoria, descricao: descricao || null };
        atualizarDados.data_inicio = dataInicio || null;
        atualizarDados.duracao_semanas = duracaoSemanas;
        atualizarDados.cronograma_ativo = cronogramaAtivo;
        if (courseIdSelecionado) atualizarDados.course_id = Number(courseIdSelecionado);
        if (moduloIdSelecionado) atualizarDados.current_module_id = Number(moduloIdSelecionado);

        await atualizarTurma(editandoId, atualizarDados);

        if (exerciciosSelecionados.length > 0) {
          try {
            await adicionarExerciciosNoCronograma(editandoId);
            setToastMsg({
              type: "success",
              msg: "Turma atualizada e exercicios adicionados!",
            });
          } catch (err) {
            console.error("Erro ao adicionar exercicios no cronograma:", err);
            setToastMsg({ type: "error", msg: "Falha ao adicionar exercicios ao cronograma." });
          }
        } else {
          setToastMsg({ type: "success", msg: "Turma atualizada!" });
        }

        setEditandoId(null);
        setFormAberto(false);
      } else {
        const criarDados: any = { nome, tipo, categoria, descricao: descricao || null };
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
            setToastMsg({
              type: "success",
              msg: "Turma criada e exercicios adicionados! Agora adicione alunos.",
            });
          } catch (err) {
            console.error("Erro ao adicionar exercicios no cronograma:", err);
            setToastMsg({ type: "error", msg: "Falha ao adicionar exercicios ao cronograma." });
          }
        } else {
          setToastMsg({ type: "success", msg: "Turma criada! Agora adicione alunos." });
        }

        if (turmaCriada) {
          setTurmaAcabadaCriar(turmaCriada);
          const alunos = await listarAlunos();
          setAlunosDisponiveis(alunos);
          setModalAdicionarAberto(true);
        }
      }

      resetForm();
      await load();
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao salvar turma" });
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(turma: Turma) {
    setNome(turma.nome);
    setTipo(turma.tipo);
    setCategoria(turma.categoria);
    setDescricao(turma.descricao || "");
    setDataInicio(turma.dataInicio ? turma.dataInicio.split("T")[0] : "");
    setDuracaoSemanas(turma.duracaoSemanas || 12);
    setCronogramaAtivo(turma.cronogramaAtivo || false);
    setCourseIdSelecionado(turma.courseId || "");
    if (turma.courseId) {
      carregarModulosDoCurso(turma.courseId, turma.currentModuleId || "").catch((e) =>
        console.error("Erro ao carregar modulos da turma:", e)
      );
    } else {
      setModuloIdSelecionado("");
    }
    setEditandoId(turma.id);
    setFormAberto(true);

    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function handleCancel() {
    resetForm();
    setFormAberto(false);
  }

  function abrirModalDeletar(id: string, nomeAtual: string) {
    setModalDeletar({ isOpen: true, turmaId: id, turmaNome: nomeAtual });
  }

  function fecharModalDeletar() {
    setModalDeletar({ isOpen: false, turmaId: null, turmaNome: null });
  }

  async function confirmarDeletar() {
    if (!modalDeletar.turmaId) return;

    try {
      setSaving(true);
      await deletarTurma(modalDeletar.turmaId);
      setToastMsg({ type: "success", msg: "Turma deletada com sucesso!" });
      fecharModalDeletar();
      await load();
    } catch (e) {
      setToastMsg({
        type: "error",
        msg: e instanceof Error ? e.message : "Erro ao deletar turma",
      });
    } finally {
      setSaving(false);
    }
  }

  function fecharModalAdicionar(force = false) {
    if (adicionando && !force) return;
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
      setToastMsg({ type: "success", msg: "Alunos adicionados com sucesso!" });
      fecharModalAdicionar(true);
      await load();
    } catch (e) {
      setToastMsg({
        type: "error",
        msg: e instanceof Error ? e.message : "Erro ao adicionar alunos",
      });
    } finally {
      setAdicionando(false);
    }
  }

  const disabled = saving || !nome.trim() || !courseIdSelecionado || !moduloIdSelecionado;
  const emptyTitle = role === "aluno" ? "Nao registrado em nenhuma turma" : "Nenhuma turma registrada";
  const emptyDescription = !canCreate
    ? "Voce ainda nao esta registrado em nenhuma turma. Aguarde administrador adiciona-lo a uma turma."
    : "Crie a primeira turma, defina o cronograma e depois adicione os alunos no mesmo fluxo.";

  return (
    <DashboardLayout
      title="Turmas"
      subtitle="Gerencie suas turmas e alunos"
      quickActions={[
        {
          label: canCreate ? "Nova turma" : "Atualizar lista",
          icon: canCreate ? Plus : RefreshCcw,
          onClick: canCreate ? abrirCriacao : () => {
            void load();
          },
        },
        {
          label: "Atualizar lista",
          icon: RefreshCcw,
          onClick: () => {
            void load();
          },
          visible: canCreate,
        },
      ]}
    >
      <FadeInUp duration={0.28}>
        <div className="space-y-6">
          <AnimatedToast
            message={toastMsg?.msg || null}
            type={toastMsg?.type || "success"}
            duration={3000}
            onClose={() => setToastMsg(null)}
          />

          {canCreate && formAberto ? (
            <section ref={formCardRef} className={`${panelClass} p-6 sm:p-7`}>
              <div className="mb-6 flex flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {editandoId ? "Editar Turma" : "Criar nova turma"}
                </h2>
                <p className={textMutedClass}>
                  {editandoId
                    ? "Ajuste os dados da turma, modulo inicial e configuracoes do cronograma automatico."
                    : "Cadastre a turma, defina o modulo inicial e prepare o cronograma automatico antes de adicionar alunos."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="grid gap-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">Nome da Turma *</span>
                    <Input
                      className={fieldClass}
                      placeholder="ex: Turma A 2024"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">Curso *</span>
                    <select
                      className={fieldClass}
                      value={courseIdSelecionado}
                      onChange={(e) => setCourseIdSelecionado(e.target.value)}
                    >
                      <option value="">Selecione um curso</option>
                      {cursos
                        .filter((curso) => !curso.isPaid)
                        .map((curso) => (
                          <option key={curso.id} value={curso.id}>
                            {curso.nome}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">Modulo Inicial</span>
                    <select
                      className={fieldClass}
                      value={moduloIdSelecionado}
                      disabled
                      onChange={() => undefined}
                    >
                      <option value="">Selecione um modulo</option>
                      {modulosCurso.map((mod) => (
                        <option key={mod.id} value={mod.id}>
                          {mod.indexOrder}. {mod.nome}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-muted-foreground">
                      Modulo inicial e definido automaticamente. Apenas exibicao.
                    </span>
                  </label>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-muted/35 p-5">
                  <div className="mb-4 flex flex-col gap-1">
                    <h3 className="text-base font-semibold text-foreground">
                      Configuracao de Cronograma
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Defina a data de inicio e a duracao do plano semanal da turma.
                    </p>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Data de Inicio da Turma
                      </span>
                      <Input
                        type="date"
                        className={fieldClass}
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">
                        Data em que a turma comeca, usada para liberacao semanal de exercicios.
                      </span>
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Duracao do Cronograma (semanas)
                      </span>
                      <Input
                        type="number"
                        min="1"
                        max="52"
                        className={fieldClass}
                        value={duracaoSemanas}
                        onChange={(e) => setDuracaoSemanas(parseInt(e.target.value, 10) || 12)}
                      />
                      <span className="text-xs text-muted-foreground">
                        Quantas semanas tera o cronograma. Padrao: 12 semanas.
                      </span>
                    </label>
                  </div>

                  <label className="mt-5 flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/25"
                      checked={cronogramaAtivo}
                      onChange={(e) => setCronogramaAtivo(e.target.checked)}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-foreground">
                        Ativar Cronograma Automatico
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Se ativado, os exercicios sao liberados automaticamente conforme o cronograma.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" className="h-11 rounded-xl px-4" disabled={disabled}>
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        {editandoId ? "Atualizar Turma" : "Criar Turma"}
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    <X size={16} />
                    Cancelar
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          <section>
            {loading && turmas.length === 0 ? (
              <ListStatusState
                mode="loading"
                className={panelClass}
                loadingTitle="Carregando turmas..."
                loadingDescription="Buscando turmas, cronogramas e acessos recentes para professores e admins."
              />
            ) : erroLista && turmas.length === 0 ? (
              <ListStatusState
                mode="error"
                className={panelClass}
                title="Nao foi possivel carregar as turmas."
                description={erroLista}
                onRetry={() => {
                  void load();
                }}
              />
            ) : !loading && totalItems === 0 ? (
              <EmptyState
                className={`${panelClass} px-6 py-14`}
                icon={<BookOpen size={22} />}
                title={emptyTitle}
                description={emptyDescription}
                actionLabel={canCreate ? "Criar primeira turma" : "Atualizar lista"}
                onAction={canCreate ? abrirCriacao : () => {
                  void load();
                }}
              />
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-2">
                  {turmas.map((turma, index) => (
                    <FadeInUp key={turma.id} delay={index * 0.05}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <article className={`${panelClass} flex h-full flex-col p-6`}>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 space-y-3">
                                <div className="space-y-2">
                                  <h3 className="truncate text-xl font-bold tracking-tight text-foreground">
                                    {turma.nome}
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge
                                      className={cn(
                                        "rounded-full px-3 py-1",
                                        turma.tipo === "turma"
                                          ? "border-primary/25 bg-primary/10 text-primary"
                                          : "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300"
                                      )}
                                    >
                                      {turma.tipo === "turma" ? (
                                        <>
                                          <Users size={14} />
                                          Grupo
                                        </>
                                      ) : (
                                        <>
                                          <UserIcon size={14} />
                                          Particular
                                        </>
                                      )}
                                    </Badge>
                                  </div>
                                </div>

                                {turma.descricao ? (
                                  <p className="text-sm leading-6 text-muted-foreground">{turma.descricao}</p>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    Sem descricao cadastrada para esta turma.
                                  </p>
                                )}
                              </div>

                              <div className="flex items-start gap-2">
                                {canCreate ? (
                                  <div className="hidden gap-2 sm:flex">
                                    <IconAction
                                      label="Editar turma"
                                      icon={<Pencil size={16} />}
                                      variant="outline"
                                      onClick={() => handleEdit(turma)}
                                    />
                                    <IconAction
                                      label="Excluir turma"
                                      icon={<Trash2 size={16} />}
                                      variant="destructive"
                                      onClick={() => abrirModalDeletar(turma.id, turma.nome)}
                                    />
                                  </div>
                                ) : null}

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-10 w-10 rounded-xl border-border/70 bg-background/80 px-0"
                                      aria-label={`Acoes para ${turma.nome}`}
                                    >
                                      <MoreHorizontal size={16} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="min-w-52">
                                    <DropdownMenuLabel>{turma.nome}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => abrirDetalhes(turma.id)}>
                                      <ArrowRight size={15} />
                                      <span>Ver detalhes</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => abrirSalaDeAula(turma.id)}>
                                      <BookOpen size={15} />
                                      <span>Abrir sala de aula</span>
                                    </DropdownMenuItem>
                                    {canCreate ? (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => handleEdit(turma)}>
                                          <Pencil size={15} />
                                          <span>Editar turma</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onSelect={() => abrirModalDeletar(turma.id, turma.nome)}
                                        >
                                          <Trash2 size={15} />
                                          <span>Excluir turma</span>
                                        </DropdownMenuItem>
                                      </>
                                    ) : null}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3">
                              <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground">
                                <Users size={16} className="text-muted-foreground" />
                                <span>{turma.tipo === "turma" ? "Turma em grupo" : "Turma particular"}</span>
                              </div>
                              <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground">
                                <Calendar size={16} className="text-muted-foreground" />
                                <span>
                                  {new Date(turma.createdAt).toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            </div>

                            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                                onClick={() => abrirSalaDeAula(turma.id)}
                              >
                                <BookOpen size={16} />
                                Sala de aula
                              </Button>
                              <Button
                                type="button"
                                className="h-11 rounded-xl px-4"
                                onClick={() => abrirDetalhes(turma.id)}
                              >
                                <ArrowRight size={16} />
                                Ver Detalhes
                              </Button>
                            </div>
                          </article>
                        </ContextMenuTrigger>

                        <ContextMenuContent className="min-w-56">
                          <ContextMenuLabel>{turma.nome}</ContextMenuLabel>
                          <ContextMenuSeparator />
                          <ContextMenuItem onSelect={() => abrirDetalhes(turma.id)}>
                            <ArrowRight size={15} />
                            <span>Ver detalhes</span>
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={() => abrirSalaDeAula(turma.id)}>
                            <BookOpen size={15} />
                            <span>Abrir sala de aula</span>
                          </ContextMenuItem>
                          {canCreate ? (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem onSelect={() => handleEdit(turma)}>
                                <Pencil size={15} />
                                <span>Editar turma</span>
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => abrirModalDeletar(turma.id, turma.nome)}>
                                <Trash2 size={15} />
                                <span>Excluir turma</span>
                              </ContextMenuItem>
                            </>
                          ) : null}
                        </ContextMenuContent>
                      </ContextMenu>
                    </FadeInUp>
                  ))}
                </div>

                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={totalItems}
                    onPageChange={handleCurrentPageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                  />
                </div>
              </>
            )}
          </section>

          <ConfirmModal
            isOpen={modalDeletar.isOpen}
            title="Deletar Turma"
            message={`Tem certeza que deseja deletar "${modalDeletar.turmaNome}"? Todos os alunos serao removidos desta turma.`}
            confirmText="Deletar"
            cancelText="Cancelar"
            onConfirm={confirmarDeletar}
            onCancel={fecharModalDeletar}
            danger
            isLoading={saving}
          />

          <Dialog
            open={modalAdicionarAberto}
            onOpenChange={(open) => (open ? setModalAdicionarAberto(true) : fecharModalAdicionar())}
          >
            <DialogContent className="max-w-2xl p-0">
              <DialogHeader className="border-b border-border/70 pb-4">
                <DialogTitle>
                  Adicionar alunos a turma: {turmaAcabadaCriar?.nome}
                </DialogTitle>
                <DialogDescription>
                  Selecione os alunos que devem entrar nesta turma agora.
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
                  Pular por enquanto
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
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
