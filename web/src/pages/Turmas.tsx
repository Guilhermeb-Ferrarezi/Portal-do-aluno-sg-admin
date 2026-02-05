import React from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import {
  FadeInUp,
  PulseLoader,
  AnimatedButton,
  AnimatedToast,
  ConditionalFieldAnimation,
  AnimatedSelect,
  AnimatedToggle,
} from "../components/animate-ui";
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
  apiFetch,
  type Turma,
  type User,
} from "../services/api";
import { getUserId } from "../auth/auth";
import ConfirmModal from "../components/ConfirmModal";
import "./Turmas.css";

type Template = {
  id: string;
  titulo: string;
  modulo: string;
  tema?: string | null;
  categoria?: string;
};

export default function TurmasPage() {
  const navigate = useNavigate();
  const role = getRole();
  const userId = getUserId();
  const canCreate = role === "admin";

  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [turmasAll, setTurmasAll] = React.useState<Turma[]>([]);
  const [filtroTurmas, setFiltroTurmas] = React.useState<"minhas" | "todas">("minhas");
  const [loading, setLoading] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState<{type: 'success'|'error'; msg: string} | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Form
  const [nome, setNome] = React.useState("");
  const [tipo, setTipo] = React.useState<"turma" | "particular">("turma");
  const [categoria, setCategoria] = React.useState<"programacao" | "informatica">("programacao");
  const [descricao, setDescricao] = React.useState("");
  const [professorId, setProfessorId] = React.useState("");
  const [professores, setProfessores] = React.useState<User[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);

  // Cronograma
  const [templatesDisponiveis, setTemplatesDisponiveis] = React.useState<Template[]>([]);
  const [templatesSelecionados, setTemplatesSelecionados] = React.useState<string[]>([]);
  const [semanaTemplates, setSemanaTemplates] = React.useState(1);
  const [carregandoTemplates, setCarregandoTemplates] = React.useState(false);

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
      if (role === "admin") {
        setTurmasAll(data);
        if (filtroTurmas === "todas") {
          setTurmas(data);
        } else if (userId) {
          setTurmas(data.filter((turma) => turma.professorId === userId));
        } else {
          setTurmas([]);
        }
      } else {
        setTurmas(data);
      }
    } catch (e) {
      setToastMsg({ type: 'error', msg: e instanceof Error ? e.message : "Erro ao carregar turmas" });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();

    // Se for admin, carregar lista de responsáveis (admins + professores)
    if (role === "admin") {
      Promise.all([
        apiFetch<User[]>("/users?role=professor"),
        apiFetch<User[]>("/users?role=admin")
      ])
        .then(([profs, admins]) => {
          const responsaveis = [...admins, ...profs]
            .sort((a, b) => a.nome.localeCompare(b.nome));
          setProfessores(responsaveis);
        })
        .catch((e) => console.error("Erro ao carregar responsáveis:", e));
    }
  }, [role]);

  React.useEffect(() => {
    if (role !== "admin") return;
    setCarregandoTemplates(true);
    apiFetch<{ templates: Template[] }>("/templates")
      .then((data) => setTemplatesDisponiveis(data.templates || []))
      .catch((e) => console.error("Erro ao carregar templates:", e))
      .finally(() => setCarregandoTemplates(false));
  }, [role]);

  React.useEffect(() => {
    if (role !== "admin") return;
    if (filtroTurmas === "todas") {
      setTurmas(turmasAll);
      return;
    }
    if (!userId) {
      setTurmas([]);
      return;
    }
    setTurmas(turmasAll.filter((turma) => turma.professorId === userId));
  }, [filtroTurmas, role, turmasAll, userId]);

  async function adicionarTemplatesNoCronograma(turmaId: string) {
    if (templatesSelecionados.length === 0) return;

    const semanaFinal = Math.max(1, Math.min(semanaTemplates, duracaoSemanas || 1));

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
    const novos = templatesSelecionados.filter((id) => !atuais.includes(id));
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

        // Admin pode definir professor ao editar
        if (role === "admin") {
          atualizarDados.professor_id = professorId || null;
        }

        // Adicionar campos de cronograma
        atualizarDados.data_inicio = dataInicio || null;
        atualizarDados.duracao_semanas = duracaoSemanas;
        atualizarDados.cronograma_ativo = cronogramaAtivo;

        await atualizarTurma(editandoId, atualizarDados);

        if (templatesSelecionados.length > 0) {
          try {
            await adicionarTemplatesNoCronograma(editandoId);
            setToastMsg({ type: 'success', msg: "Turma atualizada e templates adicionados!" });
          } catch (err) {
            console.error("Erro ao adicionar templates no cronograma:", err);
            setToastMsg({ type: 'success', msg: "Turma atualizada!" });
            setToastMsg({ type: 'error', msg: "Falha ao adicionar templates ao cronograma." });
          }
        } else {
          setToastMsg({ type: 'success', msg: "Turma atualizada!" });
        }

        setEditandoId(null);
      } else {
        const criarDados: any = { nome, tipo, categoria, descricao: descricao || null };

        // Se for admin e selecionou um professor, adicionar ao dados
        if (role === "admin" && professorId) {
          criarDados.professor_id = professorId;
        }

        // Adicionar campos de cronograma
        criarDados.data_inicio = dataInicio || null;
        criarDados.duracao_semanas = duracaoSemanas;
        criarDados.cronograma_ativo = cronogramaAtivo;

        const created = await criarTurma(criarDados);
        const turmaCriada = created.turma;

        if (templatesSelecionados.length > 0 && turmaCriada) {
          try {
            await adicionarTemplatesNoCronograma(turmaCriada.id);
            setToastMsg({ type: 'success', msg: "Turma criada e templates adicionados! Agora adicione alunos." });
          } catch (err) {
            console.error("Erro ao adicionar templates no cronograma:", err);
            setToastMsg({ type: 'success', msg: "Turma criada! Agora adicione alunos." });
            setToastMsg({ type: 'error', msg: "Falha ao adicionar templates ao cronograma." });
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
      setProfessorId("");
      setDataInicio("");
      setDuracaoSemanas(12);
      setCronogramaAtivo(false);
      setTemplatesSelecionados([]);
      setSemanaTemplates(1);

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
    setProfessorId(turma.professorId || "");
    setDataInicio(turma.dataInicio ? turma.dataInicio.split('T')[0] : "");
    setDuracaoSemanas(turma.duracaoSemanas || 12);
    setCronogramaAtivo(turma.cronogramaAtivo || false);
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
    setProfessorId("");
    setDataInicio("");
    setDuracaoSemanas(12);
    setCronogramaAtivo(false);
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

  const disabled =
    saving || !nome.trim();

  const emptyTitle =
    role === "admin" && filtroTurmas === "minhas"
      ? "Nenhuma turma vinculada a você"
      : role === "aluno"
      ? "Não registrado em nenhuma turma"
      : "Nenhuma turma registrada";
  const emptyDescription = !canCreate
    ? "Você ainda não está registrado em nenhuma turma. Aguarde administrador adicioná-lo a uma turma."
    : role === "admin" && filtroTurmas === "minhas"
    ? "Crie uma turma ou altere para \"Todas\" para ver todas as turmas."
    : "Crie sua primeira turma preenchendo o formulario acima.";

  return (
    <DashboardLayout
      title="Minhas Turmas"
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
          {role === "admin" ? (
            <div className="turmasHeaderLeft">
              <span className="turmasFilterLabel">Exibir:</span>
              <div className="turmasFilter">
                <button
                  type="button"
                  className={`turmasFilterBtn ${filtroTurmas === "minhas" ? "active" : ""}`}
                  onClick={() => setFiltroTurmas("minhas")}
                >
                  Minhas
                </button>
                <button
                  type="button"
                  className={`turmasFilterBtn ${filtroTurmas === "todas" ? "active" : ""}`}
                  onClick={() => setFiltroTurmas("todas")}
                >
                  Todas
                </button>
              </div>
            </div>
          ) : (
            <div />
          )}
          <button className="refreshBtn" onClick={load} disabled={loading}>
            {loading ? "⏳ Carregando..." : "🔄 Atualizar"}
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

              {role === "admin" && (
                <div className="turmaInputGroup">
                  <label className="turmaLabel">Responsável pela Turma</label>
                  <AnimatedSelect
                    className="turmaSelect"
                    value={professorId}
                    onChange={(e) => setProfessorId(e.target.value)}
                  >
                    <option value="">Nenhum responsável</option>
                    {professores.map((prof) => (
                      <option key={prof.id} value={prof.id}>
                        {prof.nome} ({prof.role === "admin" ? "Admin" : "Professor"})
                      </option>
                    ))}
                  </AnimatedSelect>
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Deixe em branco para nenhum responsável, ou selecione um admin/professor
                  </small>
                </div>
              )}

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
                  Configuracao de Cronograma (Opcional)
                </h3>

                <div className="turmaInputGroup">
                  <label className="turmaLabel">Data de Inicio da Turma</label>
                  <input
                    type="date"
                    className="turmaInput"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
                    Data em que a turma comeca (para liberacao semanal de exercicios)
                  </small>
                </div>

                <div className="turmaInputGroup">
                  <label className="turmaLabel">Duracao do Cronograma (semanas)</label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    className="turmaInput"
                    value={duracaoSemanas}
                    onChange={(e) => setDuracaoSemanas(parseInt(e.target.value) || 12)}
                  />
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
                    Quantas semanas tera o cronograma (padrao: 12 semanas)
                  </small>
                </div>

                <div className="turmaInputGroup">
                  <label style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <AnimatedToggle
                      checked={cronogramaAtivo}
                      onChange={setCronogramaAtivo}
                    />
                    <span className="turmaLabel" style={{ margin: 0 }}>Ativar Cronograma Automatico</span>
                  </label>
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
                    Se ativado, os exercicios serao liberados automaticamente conforme o cronograma
                  </small>
                </div>
              </div>

              <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                  Adicionar templates ao cronograma
                </h3>

                <div className="turmaInputGroup">
                  <label className="turmaLabel">Semana para liberar</label>
                  <input
                    type="number"
                    min="1"
                    max={duracaoSemanas}
                    className="turmaInput"
                    value={semanaTemplates}
                    onChange={(e) => setSemanaTemplates(parseInt(e.target.value) || 1)}
                  />
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
                    Escolha a semana do cronograma para esses templates
                  </small>
                </div>

                {carregandoTemplates ? (
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>Carregando templates...</div>
                ) : (() => {
                  const filtrados = templatesDisponiveis.filter((template) => (template.categoria || "programacao") === categoria);
                  return filtrados.length === 0 ? (
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>
                      {templatesDisponiveis.length === 0
                        ? "Nenhum template cadastrado."
                        : `Nenhum template de ${categoria === "informatica" ? "Informática" : "Programação"} encontrado.`}
                    </div>
                  ) : (
                    <div className="templatesSelectorList">
                      {filtrados.map((template) => (
                        <label key={template.id} className="templateCheckboxItem">
                          <input
                            type="checkbox"
                            checked={templatesSelecionados.includes(template.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTemplatesSelecionados([...templatesSelecionados, template.id]);
                              } else {
                                setTemplatesSelecionados(
                                  templatesSelecionados.filter((id) => id !== template.id)
                                );
                              }
                            }}
                          />
                          <div className="templateCheckboxInfo">
                            <div className="templateCheckboxTitle">{template.titulo}</div>
                            <div className="templateCheckboxMeta">{template.modulo || "Sem modulo"}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  );
                })()}

                {!cronogramaAtivo && (
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, display: "block" }}>
                    O cronograma esta desativado. Os templates serao salvos, mas nao serao liberados automaticamente.
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
                    ? "⏳ Salvando..."
                    : editandoId
                    ? "💾 Atualizar Turma"
                    : "➕ Criar Turma"}
                </AnimatedButton>
                {editandoId && (
                  <AnimatedButton
                    type="button"
                    className="turmaCancelBtn"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    ❌ Cancelar
                  </AnimatedButton>
                )}
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
              <div className="emptyIcon">📚</div>
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
                            {turma.tipo === "turma" ? "👥 Grupo" : "👤 Particular"}
                          </span>
                        </div>
                        {canCreate && (
                          <div className="turmaCardActions">
                            <AnimatedButton
                              className="turmaEditBtn"
                              onClick={() => handleEdit(turma)}
                              title="Editar turma"
                            >
                              ✏️
                            </AnimatedButton>
                            <AnimatedButton
                              className="turmaDeleteBtn"
                              onClick={() => abrirModalDeletar(turma.id, turma.nome)}
                              title="Deletar turma"
                            >
                              🗑️
                            </AnimatedButton>
                          </div>
                        )}
                      </div>

                      {turma.descricao && (
                        <p className="turmaCardDescription">{turma.descricao}</p>
                      )}

                      <div className="turmaCardStats">
                        <div className="statItem">
                          <span className="statIcon">👥</span>
                          <span className="statText">Alunos</span>
                        </div>
                        <div className="statItem">
                          <span className="statIcon">📅</span>
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
                            👥 Gerenciar Alunos
                          </AnimatedButton>
                        )}
                        <AnimatedButton
                          className="turmaViewBtn"
                          onClick={() => navigate(`/dashboard/turmas/${turma.id}`)}
                        >
                          Ver Detalhes →
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
        <ConditionalFieldAnimation isVisible={modalAdicionarAberto}>
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
                  {adicionando ? "⏳ Adicionando..." : "Adicionar"}
                </AnimatedButton>
              </div>
            </div>
          </div>
        </ConditionalFieldAnimation>
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
