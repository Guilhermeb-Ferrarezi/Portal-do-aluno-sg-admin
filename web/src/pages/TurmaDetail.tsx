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
} from "lucide-react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { FlipButton, FadeInUp, AnimatedButton, AnimatedToast } from "../components/animate-ui";
import {
  obterTurma,
  removerAlunoDaTurma,
  adicionarAlunosNaTurma,
  listarAlunos,
  getRole,
  type Turma,
  type User,
} from "../services/api";
import "./TurmaDetail.css";

type TurmaComAlunos = Turma & {
  alunos: User[];
  exercicios: Array<{ id: string; titulo: string; modulo: string }>;
};

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
  const [abaSelecionada, setAbaSelecionada] = React.useState<"info" | "alunos">("info");
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );

  async function load() {
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
  }

  React.useEffect(() => {
    if (!id) {
      navigate(backPath);
      return;
    }
    load();
  }, [backPath, id, navigate]);


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
      // Filtrar apenas alunos que não estão na turma
      const alunosNaTurma = turma?.alunos.map((a) => a.id) || [];
      const alunosDisponiveis = alunos.filter(
        (aluno) => !alunosNaTurma.includes(aluno.id)
      );
      setAlunosDisponiveis(alunosDisponiveis);
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
      <DashboardLayout title="Turma não encontrada" subtitle="">
        <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)" }}>
          A turma solicitada não foi encontrada.
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

          {/* ABAS */}
          {(canManageTurmas || role === "aluno") && (
            <div className="turmaTabs">
              <AnimatedButton
                onClick={() => setAbaSelecionada("info")}
                className={`turmaTabButton ${abaSelecionada === "info" ? "active" : ""}`}
              >
                {iconLabel(<Info size={16} />, "Informações")}
              </AnimatedButton>
              <AnimatedButton
                onClick={() => setAbaSelecionada("alunos")}
                className={`turmaTabButton ${abaSelecionada === "alunos" ? "active" : ""}`}
              >
                {iconLabel(<Users size={16} />, "Alunos")}
              </AnimatedButton>
              {/* Exercícios e Cronograma removidos conforme correções.md */}
            </div>
          )}

          {/* INFORMAÇÕES DA TURMA */}
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
                        ? iconLabel(<Laptop size={14} />, "Programação")
                        : iconLabel(<Monitor size={14} />, "Informática")}</>
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

          {/* SEÇÃO DE ALUNOS */}
          {abaSelecionada === "alunos" && (
            <div className="turmaSection">
              <div className="turmaSectionHeader">
                <h2 className="turmaSectionTitle">
                  {iconLabel(<Users size={18} />, `Alunos (${turma.alunos.length})`)}
                </h2>
                {(role === "admin" || role === "professor") && (
                  <AnimatedButton
                    onClick={abrirModalAdicionar}
                    className="btnAdicionarAluno"
                  >
                    {iconLabel(<Plus size={16} />, "Adicionar aluno")}
                  </AnimatedButton>
                )}
              </div>

              {turma.alunos.length === 0 ? (
                <div className="emptySection">
                  <p>Nenhum aluno cadastrado nesta turma ainda.</p>
                </div>
              ) : (
                <div className="alunosList">
                  {turma.alunos.map((aluno) => (
                    <div key={aluno.id} className="alunoCard">
                      <div className="alunoInfo">
                        <div className="alunoAvatar">
                          {aluno.nome.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="alunoDetails">
                          <div className="alunoName">{aluno.nome}</div>
                          <div className="alunoUsername">@{aluno.usuario}</div>
                        </div>
                      </div>
                      {(role === "admin" || role === "professor") && (
                        <FlipButton
                          front={<Trash2 size={16} />}
                          back="Remover?"
                          onClick={() => handleRemoverAluno(aluno.id)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SEÇÃO DE EXERCÍCIOS - Removida conforme correções.md */}

          {/* SEÇÃO DE CRONOGRAMA - Removida conforme correções.md */}

          {/* MODAL DE ADICIONAR ALUNOS */}
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
                <h3>Adicionar alunos à turma</h3>

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


