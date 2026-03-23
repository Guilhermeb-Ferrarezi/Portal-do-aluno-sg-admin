import React from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  Info,
  Users,
  Lock,
  Laptop,
  Monitor,
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Play,
} from "lucide-react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { FlipButton, FadeInUp, AnimatedButton, AnimatedToast } from "../components/animate-ui";
import {
  obterTurma,
  removerAlunoDaTurma,
  adicionarAlunosNaTurma,
  iniciarFasesNaTurma,
  listarAlunos,
  getRole,
  type Turma,
  type User,
  type TurmaAluno,
} from "../services/api";
import "./TurmaDetail.css";

type TurmaComAlunos = Turma & {
  faseInicial?: { id: string; nome: string } | null;
  alunos: TurmaAluno[];
  exercicios: Array<{ id: string; titulo: string; modulo: string }>;
};

function isAlunoStartable(aluno: TurmaAluno) {
  return aluno.role === "aluno" && (
    aluno.faseInicialStatus === "nao_iniciado" ||
    aluno.faseInicialStatus === "desconhecido" ||
    !aluno.faseInicialStatus
  );
}

export default function TurmaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = getRole();
  const canManageTurmas = role === "admin" || role === "professor";
  const backPath = canManageTurmas ? "/dashboard/turmas" : "/dashboard";

  const [turma, setTurma] = React.useState<TurmaComAlunos | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  const [modalAdicionarAberto, setModalAdicionarAberto] = React.useState(false);
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [adicionando, setAdicionando] = React.useState(false);
  const [iniciandoLote, setIniciandoLote] = React.useState(false);
  const [iniciandoAlunoId, setIniciandoAlunoId] = React.useState<string | null>(null);
  const [alunosParaIniciar, setAlunosParaIniciar] = React.useState<string[]>([]);
  const [abaSelecionada, setAbaSelecionada] = React.useState<"info" | "alunos">("info");

  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErro(null);
      const data = await obterTurma(id);
      setTurma(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar turma");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (!id) {
      navigate(backPath);
      return;
    }
    void load();
  }, [backPath, id, load, navigate]);

  React.useEffect(() => {
    if (!turma) {
      setAlunosParaIniciar([]);
      return;
    }

    const idsValidos = new Set(
      turma.alunos.filter((aluno) => isAlunoStartable(aluno)).map((aluno) => aluno.id)
    );

    setAlunosParaIniciar((prev) => prev.filter((alunoId) => idsValidos.has(alunoId)));
  }, [turma]);

  const alunosIniciaveis = React.useMemo(
    () => turma?.alunos.filter((aluno) => isAlunoStartable(aluno)) ?? [],
    [turma]
  );

  const todosIniciaveisSelecionados =
    alunosIniciaveis.length > 0 && alunosParaIniciar.length === alunosIniciaveis.length;

  async function handleRemoverAluno(alunoId: string) {
    if (!id || !turma) return;

    if (!window.confirm("Tem certeza que deseja remover este aluno da turma?")) {
      return;
    }

    try {
      setErro(null);
      setOkMsg(null);
      await removerAlunoDaTurma(id, alunoId);
      setOkMsg("Aluno removido com sucesso!");
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover aluno");
    }
  }

  async function abrirModalAdicionar() {
    try {
      const alunos = await listarAlunos();
      const alunosNaTurma = turma?.alunos.map((aluno) => aluno.id) ?? [];
      const disponiveis = alunos.filter((aluno) => !alunosNaTurma.includes(aluno.id));
      setAlunosDisponiveis(disponiveis);
      setModalAdicionarAberto(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar alunos");
    }
  }

  async function handleAdicionarAlunos() {
    if (!id || alunosSelecionados.length === 0) return;

    try {
      setAdicionando(true);
      setErro(null);
      await adicionarAlunosNaTurma(id, alunosSelecionados);
      setOkMsg("Alunos adicionados com sucesso!");
      setModalAdicionarAberto(false);
      setAlunosSelecionados([]);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao adicionar alunos");
    } finally {
      setAdicionando(false);
    }
  }

  async function handleIniciarFasesSelecionadas() {
    if (!id || alunosParaIniciar.length === 0) return;

    try {
      setIniciandoLote(true);
      setErro(null);
      setOkMsg(null);

      const result = await iniciarFasesNaTurma(id, alunosParaIniciar);
      const faseNome = result.fase?.nome ? ` (${result.fase.nome})` : "";
      setOkMsg(`${result.totalAlunos} aluno(s) iniciados${faseNome}.`);
      setAlunosParaIniciar([]);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao iniciar fases");
    } finally {
      setIniciandoLote(false);
    }
  }

  async function handleIniciarFaseAluno(alunoId: string) {
    if (!id) return;

    try {
      setIniciandoAlunoId(alunoId);
      setErro(null);
      setOkMsg(null);

      const result = await iniciarFasesNaTurma(id, [alunoId]);
      const faseNome = result.fase?.nome ? ` (${result.fase.nome})` : "";
      setOkMsg(`Fase inicial iniciada para ${result.totalAlunos} aluno(s)${faseNome}.`);
      setAlunosParaIniciar((prev) => prev.filter((selectedId) => selectedId !== alunoId));
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao iniciar fase do aluno");
    } finally {
      setIniciandoAlunoId(null);
    }
  }

  function handleToggleAlunoParaIniciar(alunoId: string) {
    setAlunosParaIniciar((prev) =>
      prev.includes(alunoId)
        ? prev.filter((selectedId) => selectedId !== alunoId)
        : [...prev, alunoId]
    );
  }

  function handleToggleSelecionarTodos() {
    if (todosIniciaveisSelecionados) {
      setAlunosParaIniciar([]);
      return;
    }

    setAlunosParaIniciar(alunosIniciaveis.map((aluno) => aluno.id));
  }

  if (loading && !turma) {
    return (
      <DashboardLayout title="Carregando..." subtitle="">
        <div className="loadingState">
          <div className="spinner" />
          Carregando turma...
        </div>
      </DashboardLayout>
    );
  }

  if (!turma) {
    return (
      <DashboardLayout title="Turma nao encontrada" subtitle="">
        <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)" }}>
          A turma solicitada nao foi encontrada.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={turma.nome}
      subtitle={`${turma.tipo === "turma" ? "Turma" : "Turma Particular"} - ${turma.alunos.length} ${turma.alunos.length === 1 ? "aluno" : "alunos"}`}
    >
      <FadeInUp duration={0.28}>
        <div className="turmaDetailContainer">
          <AnimatedToast
            message={erro}
            type="error"
            onClose={() => setErro(null)}
          />
          <AnimatedToast
            message={okMsg}
            type="success"
            onClose={() => setOkMsg(null)}
          />

          {(canManageTurmas || role === "aluno") && (
            <div className="turmaTabs">
              <AnimatedButton
                onClick={() => setAbaSelecionada("info")}
                className={`turmaTabButton ${abaSelecionada === "info" ? "active" : ""}`}
              >
                {iconLabel(<Info size={16} />, "Informacoes")}
              </AnimatedButton>
              <AnimatedButton
                onClick={() => setAbaSelecionada("alunos")}
                className={`turmaTabButton ${abaSelecionada === "alunos" ? "active" : ""}`}
              >
                {iconLabel(<Users size={16} />, "Alunos")}
              </AnimatedButton>
            </div>
          )}

          {abaSelecionada === "info" && (
            <div className="turmaInfoCard">
              <div className="turmaInfoHeader">
                <div>
                  <h3 className="turmaInfoTitle">{turma.nome}</h3>
                  <p className="turmaInfoMeta">
                    {turma.tipo === "turma"
                      ? iconLabel(<Users size={14} />, "Turma (Grupo)")
                      : iconLabel(<Lock size={14} />, "Turma Particular")}
                    {turma.categoria && (
                      <> - {turma.categoria === "programacao"
                        ? iconLabel(<Laptop size={14} />, "Programacao")
                        : iconLabel(<Monitor size={14} />, "Informatica")}</>
                    )}
                    {turma.descricao && <> - {turma.descricao}</>}
                  </p>
                </div>

                <AnimatedButton
                  className="btnBack"
                  onClick={() => navigate(backPath)}
                >
                  {iconLabel(<ArrowLeft size={16} />, "Voltar")}
                </AnimatedButton>
              </div>
            </div>
          )}

          {abaSelecionada === "alunos" && (
            <div className="turmaSection">
              <div className="turmaSectionHeader">
                <div>
                  <h2 className="turmaSectionTitle">
                    {iconLabel(<Users size={18} />, `Alunos (${turma.alunos.length})`)}
                  </h2>
                  {turma.faseInicial ? (
                    <p className="turmaPhaseHint">
                      Fase inicial do modulo atual: <strong>{turma.faseInicial.nome}</strong>
                    </p>
                  ) : (
                    <p className="turmaPhaseHint isWarning">
                      O modulo atual da turma ainda nao possui fases para iniciar.
                    </p>
                  )}
                </div>

                {canManageTurmas && (
                  <div className="turmaSectionActions">
                    {turma.faseInicial && alunosIniciaveis.length > 0 && (
                      <>
                        {alunosIniciaveis.length > 1 && (
                          <label className="selectAllToggle">
                            <input
                              type="checkbox"
                              checked={todosIniciaveisSelecionados}
                              onChange={handleToggleSelecionarTodos}
                            />
                            <span>Selecionar todos</span>
                          </label>
                        )}
                        <AnimatedButton
                          onClick={handleIniciarFasesSelecionadas}
                          className="btnIniciarFases"
                          disabled={iniciandoLote || alunosParaIniciar.length === 0}
                        >
                          {iniciandoLote
                            ? iconLabel(<Loader2 size={16} />, "Iniciando...")
                            : iconLabel(<Play size={16} />, `Iniciar fases${alunosParaIniciar.length > 0 ? ` (${alunosParaIniciar.length})` : ""}`)}
                        </AnimatedButton>
                      </>
                    )}
                    <AnimatedButton
                      onClick={abrirModalAdicionar}
                      className="btnAdicionarAluno"
                    >
                      {iconLabel(<Plus size={16} />, "Adicionar aluno")}
                    </AnimatedButton>
                  </div>
                )}
              </div>

              {turma.alunos.length === 0 ? (
                <div className="emptySection">
                  <p>Nenhum aluno cadastrado nesta turma ainda.</p>
                </div>
              ) : (
                <div className="alunosList">
                  {turma.alunos.map((aluno) => {
                    const podeIniciar = canManageTurmas && !!turma.faseInicial && isAlunoStartable(aluno);
                    const selecionado = alunosParaIniciar.includes(aluno.id);
                    const iniciandoEsteAluno = iniciandoAlunoId === aluno.id;
                    const statusClass = `status-${aluno.faseInicialStatus ?? "desconhecido"}`;

                    return (
                      <div key={aluno.id} className={`alunoCard ${selecionado ? "isSelected" : ""}`}>
                        <div className="alunoCardMain">
                          {canManageTurmas && turma.faseInicial && aluno.role === "aluno" && (
                            <label className="alunoSelect">
                              <input
                                type="checkbox"
                                checked={selecionado}
                                disabled={!podeIniciar}
                                onChange={() => handleToggleAlunoParaIniciar(aluno.id)}
                              />
                            </label>
                          )}

                          <div className="alunoInfo">
                            <div className="alunoAvatar">
                              {aluno.nome.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="alunoDetails">
                              <div className="alunoStatusRow">
                                <div className="alunoName">{aluno.nome}</div>
                                <span className={`alunoStatusBadge ${statusClass}`}>
                                  {aluno.faseInicialStatusLabel ?? "Desconhecido"}
                                </span>
                              </div>
                              <div className="alunoUsername">@{aluno.usuario}</div>
                            </div>
                          </div>
                        </div>

                        {canManageTurmas && (
                          <div className="alunoActions">
                            {turma.faseInicial && aluno.role === "aluno" && (
                              <AnimatedButton
                                className={`btnIniciarAluno ${podeIniciar ? "isReady" : "isStarted"}`}
                                disabled={!podeIniciar || iniciandoLote || iniciandoEsteAluno}
                                onClick={() => handleIniciarFaseAluno(aluno.id)}
                              >
                                {iniciandoEsteAluno
                                  ? iconLabel(<Loader2 size={14} />, "Iniciando...")
                                  : podeIniciar
                                    ? iconLabel(<Play size={14} />, "Iniciar fase")
                                    : "Ja iniciada"}
                              </AnimatedButton>
                            )}
                            <FlipButton
                              front={<Trash2 size={16} />}
                              back="Remover?"
                              onClick={() => handleRemoverAluno(aluno.id)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {modalAdicionarAberto && createPortal(
            <div
              className="modalOverlay"
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                setModalAdicionarAberto(false);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                  e.preventDefault();
                  setModalAdicionarAberto(false);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="modalContent">
                <h3>Adicionar alunos a turma</h3>

                {alunosDisponiveis.length === 0 ? (
                  <p style={{ color: "var(--muted)", textAlign: "center" }}>
                    Nenhum aluno disponivel para adicionar.
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
                                alunosSelecionados.filter((selectedId) => selectedId !== aluno.id)
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
                    onClick={() => setModalAdicionarAberto(false)}
                    className="modalBtnCancel"
                    disabled={adicionando}
                  >
                    Cancelar
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
