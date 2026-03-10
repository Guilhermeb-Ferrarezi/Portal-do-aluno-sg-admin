import React from "react";
import { createPortal } from "react-dom";
import {
  AnimatedButton,
  AnimatedToast,
  AnimatedSelect,
} from "./animate-ui";
import { Loader2, Plus, Search, Check, Users, UserPlus } from "lucide-react";
import {
  criarTurma,
  listarCursos,
  listarModulosPorCurso,
  listarAlunos,
  adicionarAlunosNaTurma,
  type Curso,
  type Modulo,
  type User,
  type Turma,
} from "../services/api";

interface CriarTurmaFormProps {
  onCreated?: () => void;
}

export default function CriarTurmaForm({ onCreated }: CriarTurmaFormProps) {
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );

  const [nome, setNome] = React.useState("");
  const [cursos, setCursos] = React.useState<Curso[]>([]);
  const [modulosCurso, setModulosCurso] = React.useState<Modulo[]>([]);
  const [courseIdSelecionado, setCourseIdSelecionado] = React.useState("");
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");

  const [dataInicio, setDataInicio] = React.useState("");
  const [duracaoSemanas, setDuracaoSemanas] = React.useState(12);
  const [cronogramaAtivo, setCronogramaAtivo] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Modal Adicionar Alunos
  const [modalAdicionarAberto, setModalAdicionarAberto] = React.useState(false);
  const [turmaAcabadaCriar, setTurmaAcabadaCriar] = React.useState<Turma | null>(null);
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [adicionando, setAdicionando] = React.useState(false);
  const [buscaAluno, setBuscaAluno] = React.useState("");

  const alunosFiltrados = React.useMemo(() => {
    const q = buscaAluno.toLowerCase();
    if (!q) return alunosDisponiveis;
    return alunosDisponiveis.filter(
      (a) => a.nome.toLowerCase().includes(q) || (a.usuario ?? "").toLowerCase().includes(q),
    );
  }, [alunosDisponiveis, buscaAluno]);

  async function carregarModulosDoCurso(courseId: string) {
    if (!courseId) {
      setModulosCurso([]);
      setModuloIdSelecionado("");
      return;
    }
    const mods = await listarModulosPorCurso(courseId);
    setModulosCurso(mods);
    setModuloIdSelecionado(mods[0]?.id ?? "");
  }

  React.useEffect(() => {
    listarCursos()
      .then((data) => {
        const items = Array.isArray(data) ? data : (data as any).items ?? [];
        setCursos(items);
        const firstId = items[0]?.id ?? "";
        setCourseIdSelecionado(firstId);
        if (firstId) carregarModulosDoCurso(firstId).catch(console.error);
      })
      .catch(console.error);
  }, []);

  React.useEffect(() => {
    if (!courseIdSelecionado) {
      setModulosCurso([]);
      setModuloIdSelecionado("");
      return;
    }
    carregarModulosDoCurso(courseIdSelecionado).catch(console.error);
  }, [courseIdSelecionado]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setToastMsg({ type: "error", msg: "Nome da turma é obrigatório" });
      return;
    }

    try {
      setSaving(true);
      const criarDados: Record<string, unknown> = {
        nome,
        tipo: "turma",
        categoria: "programacao",
        descricao: null,
        data_inicio: dataInicio || null,
        duracao_semanas: duracaoSemanas,
        cronograma_ativo: cronogramaAtivo,
      };
      if (courseIdSelecionado) criarDados.course_id = Number(courseIdSelecionado);
      if (moduloIdSelecionado) criarDados.current_module_id = Number(moduloIdSelecionado);

      const created = await criarTurma(criarDados as any);
      const turmaCriada = created.turma;
      setToastMsg({ type: "success", msg: "Turma criada! Agora adicione alunos." });

      setNome("");
      setDataInicio("");
      setDuracaoSemanas(12);
      setCronogramaAtivo(false);

      if (turmaCriada) {
        setTurmaAcabadaCriar(turmaCriada);
        const alunos = await listarAlunos();
        setAlunosDisponiveis(alunos);
        setModalAdicionarAberto(true);
      }

      onCreated?.();
    } catch (err) {
      setToastMsg({ type: "error", msg: err instanceof Error ? err.message : "Erro ao criar turma" });
    } finally {
      setSaving(false);
    }
  }

  function fecharModalAdicionar() {
    setModalAdicionarAberto(false);
    setTurmaAcabadaCriar(null);
    setAlunosSelecionados([]);
    setAlunosDisponiveis([]);
    setBuscaAluno("");
  }

  async function handleAdicionarAlunos() {
    if (!turmaAcabadaCriar || alunosSelecionados.length === 0) return;
    try {
      setAdicionando(true);
      await adicionarAlunosNaTurma(turmaAcabadaCriar.id, alunosSelecionados);
      setToastMsg({ type: "success", msg: "Alunos adicionados com sucesso!" });
      fecharModalAdicionar();
    } catch (err) {
      setToastMsg({ type: "error", msg: err instanceof Error ? err.message : "Erro ao adicionar alunos" });
    } finally {
      setAdicionando(false);
    }
  }

  const disabled = saving || !nome.trim() || !courseIdSelecionado || !moduloIdSelecionado;

  return (
    <>
      <AnimatedToast
        message={toastMsg?.msg || null}
        type={toastMsg?.type || "success"}
        duration={3000}
        onClose={() => setToastMsg(null)}
      />

      <div className="estruturaCard" style={{ gridColumn: "1 / -1" }}>
        <div className="estruturaCardHead">
          <h2>Criar Nova Turma</h2>
          <p>Preencha os dados para criar uma nova turma.</p>
        </div>

        <form onSubmit={handleSubmit} className="estruturaForm">
          <span>Nome da Turma *</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="ex: Turma A 2024"
            required
          />

          <span>Curso *</span>
          <AnimatedSelect
            className="turmaSelect"
            value={courseIdSelecionado}
            onChange={(e) => setCourseIdSelecionado(e.target.value)}
          >
            <option value="">Selecione um curso</option>
            {cursos
              .filter((c) => !c.isPaid)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </AnimatedSelect>

          <span>Módulo Inicial</span>
          <input
            className="turmaSelect"
            value={modulosCurso.length > 0 ? `${modulosCurso[0].indexOrder}. ${modulosCurso[0].nome}` : "Nenhum módulo disponível"}
            readOnly
            disabled
            style={{ opacity: 0.7, cursor: "not-allowed" }}
          />
          <small style={{ fontSize: 12, color: "var(--muted)" }}>
            A turma sempre inicia no primeiro módulo do curso.
          </small>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              Configuração de Cronograma (Opcional)
            </h3>

            <span>Data de Início da Turma</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <small style={{ fontSize: 12, color: "var(--muted)" }}>
              Data em que a turma começa (para liberação semanal de exercícios)
            </small>

            <span>Duração do Cronograma (semanas)</span>
            <input
              type="number"
              min="1"
              max="52"
              value={duracaoSemanas}
              onChange={(e) => setDuracaoSemanas(parseInt(e.target.value) || 12)}
            />

            <button
              type="button"
              className={`turmaCronoToggle ${cronogramaAtivo ? "isActive" : ""}`}
              onClick={() => setCronogramaAtivo((prev) => !prev)}
              aria-pressed={cronogramaAtivo}
            >
              <span className="turmaCronoSwitch" aria-hidden="true">
                <span className="turmaCronoThumb" />
              </span>
              <span className="turmaCronoLabel">Ativar Cronograma Automático</span>
            </button>
            <small style={{ fontSize: 12, color: "var(--muted)" }}>
              Se ativado, os exercícios serão liberados automaticamente conforme o cronograma
            </small>
          </div>

          <AnimatedButton className="estruturaSubmitBtn" type="submit" disabled={disabled}>
            {saving
              ? iconLabel(<Loader2 size={16} />, "Criando...")
              : iconLabel(<Plus size={16} />, "Criar Turma")}
          </AnimatedButton>
        </form>
      </div>

      {/* Modal Adicionar Alunos após criação */}
      {modalAdicionarAberto &&
        createPortal(
          <div
            className="modalOverlay"
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              fecharModalAdicionar();
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                e.preventDefault();
                fecharModalAdicionar();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="modalContent">
              {/* Header */}
              <div className="modalHeader">
                <div className="modalHeaderLeft">
                  <h3>Adicionar Alunos</h3>
                  <span className="modalHeaderSub">{turmaAcabadaCriar?.nome}</span>
                </div>
                {alunosSelecionados.length > 0 && (
                  <span className="modalSelectedBadge">
                    <UserPlus size={14} />
                    {alunosSelecionados.length} selecionado{alunosSelecionados.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {alunosDisponiveis.length === 0 ? (
                <div className="alunosEmptyState">
                  <Users size={48} />
                  <p>Nenhum aluno disponível para adicionar.</p>
                </div>
              ) : (
                <>
                  {/* Search & Select All */}
                  <div className="modalToolbar">
                    <div className="modalSearchWrap">
                      <Search size={16} className="modalSearchIcon" />
                      <input
                        className="modalSearchInput"
                        type="text"
                        placeholder="Buscar aluno por nome ou usuário..."
                        value={buscaAluno}
                        onChange={(e) => setBuscaAluno(e.target.value)}
                      />
                    </div>
                    <div className="modalSelectAllRow">
                      <span className="modalCountText">
                        {alunosFiltrados.length} aluno{alunosFiltrados.length !== 1 ? "s" : ""} encontrado{alunosFiltrados.length !== 1 ? "s" : ""}
                      </span>
                      <button
                        type="button"
                        className="modalSelectAllBtn"
                        onClick={() => {
                          const todosIds = alunosFiltrados.map((a) => a.id);
                          const todosSelecionados = todosIds.every((id) => alunosSelecionados.includes(id));
                          if (todosSelecionados) {
                            setAlunosSelecionados(alunosSelecionados.filter((id) => !todosIds.includes(id)));
                          } else {
                            setAlunosSelecionados([...new Set([...alunosSelecionados, ...todosIds])]);
                          }
                        }}
                      >
                        {alunosFiltrados.map((a) => a.id).every((id) => alunosSelecionados.includes(id))
                          ? "Desmarcar todos"
                          : "Selecionar todos"}
                      </button>
                    </div>
                  </div>

                  {/* Student list */}
                  <div className="alunosSelectorList">
                    {alunosFiltrados.map((aluno) => {
                        const isSelected = alunosSelecionados.includes(aluno.id);
                        return (
                          <label
                            key={aluno.id}
                            className={`alunoCheckboxItem${isSelected ? " selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAlunosSelecionados([...alunosSelecionados, aluno.id]);
                                } else {
                                  setAlunosSelecionados(alunosSelecionados.filter((id) => id !== aluno.id));
                                }
                              }}
                            />
                            <span className="alunoCustomCheck">
                              {isSelected && <Check size={14} strokeWidth={3} />}
                            </span>
                            <span className="alunoCheckboxAvatar">
                              {aluno.nome.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="alunoCheckboxInfo">
                              <div className="alunoCheckboxName">{aluno.nome}</div>
                              <div className="alunoCheckboxUser">@{aluno.usuario ?? aluno.nome}</div>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </>
              )}

              <div className="modalActions">
                <AnimatedButton onClick={fecharModalAdicionar} className="modalBtnCancel" disabled={adicionando}>
                  Pular por enquanto
                </AnimatedButton>
                <AnimatedButton
                  onClick={handleAdicionarAlunos}
                  className="modalBtnConfirm"
                  disabled={adicionando || alunosSelecionados.length === 0}
                >
                  {adicionando
                    ? iconLabel(<Loader2 size={16} />, "Adicionando...")
                    : iconLabel(<UserPlus size={16} />, `Adicionar (${alunosSelecionados.length})`)}
                </AnimatedButton>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
