import React from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  Info,
  Users,
  BookOpen,
  Calendar,
  Lock,
  Laptop,
  Monitor,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  AlertTriangle,
  Pin,
  Clock,
  RefreshCcw,
  CheckCircle,
  Pause,
  Loader2,
} from "lucide-react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { FlipButton, FadeInUp, AnimatedButton, AnimatedToast, ConditionalFieldAnimation } from "../components/animate-ui";
import {
  obterTurma,
  atualizarTurma,
  removerAlunoDaTurma,
  adicionarAlunosNaTurma,
  listarAlunos,
  apiFetch,
  getRole,
  obterCronograma,
  configurarCronograma,
  type Turma,
  type User,
  type Exercicio,
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

  const [responsaveis, setResponsaveis] = React.useState<User[]>([]);
  const [professorSelecionado, setProfessorSelecionado] = React.useState("");
  const [salvandoResponsavel, setSalvandoResponsavel] = React.useState(false);

  const [modalAdicionarAberto, setModalAdicionarAberto] = React.useState(false);
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [adicionando, setAdicionando] = React.useState(false);

  // Estado para cronograma
  const [templates, setTemplates] = React.useState<Exercicio[]>([]);
  const [cronograma, setCronograma] = React.useState<Record<number, Array<{ id: string; titulo: string; modulo: string }>>>({});
  const [carregandoCronograma, setCarregandoCronograma] = React.useState(false);
  const [salvandoCronograma, setSalvandoCronograma] = React.useState(false);
  const [templateSelecionado, setTemplateSelecionado] = React.useState<string>("");
  const [semanaSelecionada, setSemanaSelecionada] = React.useState<number>(1);
  const [abaSelecionada, setAbaSelecionada] = React.useState<"info" | "alunos" | "exercicios" | "cronograma">("info");
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

  React.useEffect(() => {
    if (role !== "admin") return;
    Promise.all([
      apiFetch<User[]>("/users?role=professor"),
      apiFetch<User[]>("/users?role=admin"),
    ])
      .then(([profs, admins]) => {
        const responsaveisOrdenados = [...admins, ...profs].sort((a, b) =>
          a.nome.localeCompare(b.nome)
        );
        setResponsaveis(responsaveisOrdenados);
      })
      .catch((e) => console.error("Erro ao carregar responsáveis:", e));
  }, [role]);

  React.useEffect(() => {
    if (role !== "admin") return;
    setProfessorSelecionado(turma?.professorId ?? "");
  }, [role, turma?.professorId]);

  async function handleAtualizarResponsavel() {
    if (!id || role !== "admin") return;
    const professorId = professorSelecionado || null;

    try {
      setSalvandoResponsavel(true);
      setErro(null);
      setOkMsg(null);
      await atualizarTurma(id, { professor_id: professorId });
      setOkMsg("Responsável atualizado com sucesso!");
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar responsável");
    } finally {
      setSalvandoResponsavel(false);
    }
  }

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

  async function carregarCronograma() {
    if (!id) return;
    try {
      setCarregandoCronograma(true);
      setErro(null);
      const data = await obterCronograma(id);
      // Converter número de string para number
      const cronogramaFormatado = Object.fromEntries(
        Object.entries(data.cronograma).map(([key, value]) => [Number(key), value])
      );
      setCronograma(cronogramaFormatado);
    } catch (e) {
      console.error("Erro ao carregar cronograma:", e);
      // Não mostrar erro se o cronograma está vazio
    } finally {
      setCarregandoCronograma(false);
    }
  }

  async function carregarTemplates() {
    // Apenas admins podem carregar templates
    if (role !== "admin") return;

    try {
      const data = await apiFetch<{ templates: Exercicio[] }>("/templates");
      setTemplates(data.templates);
    } catch (e) {
      console.error("Erro ao carregar templates:", e);
    }
  }

  React.useEffect(() => {
    if (abaSelecionada === "cronograma" && id) {
      carregarCronograma();
      carregarTemplates();
    }
  }, [abaSelecionada, id, role]);

  async function handleAdicionarTemplateSemana(semana: number) {
    if (!id || !templateSelecionado) {
      setErro("Por favor, selecione um template");
      return;
    }

    try {
      setSalvandoCronograma(true);
      setErro(null);
      setOkMsg(null);

      // Criar array de semanas com os exercícios
      const cronogramaAtualizado: Record<number, Array<{ id: string; titulo: string; modulo: string }>> = { ...cronograma };

      if (!cronogramaAtualizado[semana]) {
        cronogramaAtualizado[semana] = [];
      }

      // Evitar duplicatas
      if (!cronogramaAtualizado[semana].find((ex) => ex.id === templateSelecionado)) {
        const template = templates.find((t) => t.id === templateSelecionado);
        if (template) {
          cronogramaAtualizado[semana].push({
            id: template.id,
            titulo: template.titulo,
            modulo: template.modulo || "",
          });
        }
      }

      // Preparar dados para envio
      const semanas = Object.entries(cronogramaAtualizado).map(([semanaNum, exercicios]) => ({
        semana: Number(semanaNum),
        exercicios: exercicios.map((ex) => ex.id),
      }));

      await configurarCronograma(id, semanas);
      setCronograma(cronogramaAtualizado);
      setTemplateSelecionado("");
      setOkMsg("Exercício adicionado à semana!");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao adicionar exercício");
    } finally {
      setSalvandoCronograma(false);
    }
  }

  async function handleRemoverExercicioSemana(semana: number, exercicioId: string) {
    if (!id) return;

    try {
      setSalvandoCronograma(true);
      setErro(null);
      setOkMsg(null);

      const cronogramaAtualizado = { ...cronograma };
      if (cronogramaAtualizado[semana]) {
        cronogramaAtualizado[semana] = cronogramaAtualizado[semana].filter(
          (ex) => ex.id !== exercicioId
        );
        if (cronogramaAtualizado[semana].length === 0) {
          delete cronogramaAtualizado[semana];
        }
      }

      // Preparar dados para envio
      const semanas = Object.entries(cronogramaAtualizado).map(([semanaNum, exercicios]) => ({
        semana: Number(semanaNum),
        exercicios: exercicios.map((ex) => ex.id),
      }));

      await configurarCronograma(id, semanas);
      setCronograma(cronogramaAtualizado);
      setOkMsg("Exercício removido da semana!");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover exercício");
    } finally {
      setSalvandoCronograma(false);
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

  const responsavelAtual = (() => {
    if (!turma.professorId) return "Nenhum responsável definido";
    const found = responsaveis.find((user) => user.id === turma.professorId);
    if (!found) return "Responsável não encontrado";
    return `${found.nome} (${found.role === "admin" ? "Admin" : "Professor"})`;
  })();

  return (
    <DashboardLayout
      title={turma.nome}
      subtitle={`${turma.tipo === "turma" ? "Turma" : "Turma Particular"} • ${turma.alunos.length} ${turma.alunos.length === 1 ? "aluno" : "alunos"}`}
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
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--border)", justifyContent: "center" }}>
            <AnimatedButton
              onClick={() => setAbaSelecionada("info")}
              style={{
                padding: "12px 16px",
                background: abaSelecionada === "info" ? "var(--primary)" : "transparent",
                color: abaSelecionada === "info" ? "white" : "var(--text)",
                border: "2px solid transparent",
                borderRadius: "12px",
                margin: "5px",
                cursor: "pointer",
                fontWeight: abaSelecionada === "info" ? 600 : 400,
                borderBottom: abaSelecionada === "info" ? "2px solid var(--primary)" : "none",
              }}
            >
              {iconLabel(<Info size={16} />, "Informações")}
            </AnimatedButton>
            <AnimatedButton
              onClick={() => setAbaSelecionada("alunos")}
              style={{
                padding: "12px 16px",
                background: abaSelecionada === "alunos" ? "var(--primary)" : "transparent",
                color: abaSelecionada === "alunos" ? "white" : "var(--text)",
                border: "2px solid transparent",
                borderRadius: "12px",
                margin: "5px",
                cursor: "pointer",
                fontWeight: abaSelecionada === "alunos" ? 600 : 400,
                borderBottom: abaSelecionada === "alunos" ? "2px solid var(--primary)" : "none",
              }}
            >
              {iconLabel(<Users size={16} />, "Alunos")}
            </AnimatedButton>
            <AnimatedButton
              onClick={() => setAbaSelecionada("exercicios")}
              style={{
                padding: "12px 16px",
                background: abaSelecionada === "exercicios" ? "var(--primary)" : "transparent",
                color: abaSelecionada === "exercicios" ? "white" : "var(--text)",
                border: "2px solid transparent",
                borderRadius: "12px",
                margin: "5px",
                cursor: "pointer",
                fontWeight: abaSelecionada === "exercicios" ? 600 : 400,
                borderBottom: abaSelecionada === "exercicios" ? "2px solid var(--primary)" : "none",
              }}
            >
              {iconLabel(<BookOpen size={16} />, "Exercícios")}
            </AnimatedButton>
            {canManageTurmas && turma.dataInicio && (
              <AnimatedButton
                onClick={() => setAbaSelecionada("cronograma")}
                style={{
                  padding: "12px 16px",
                  background: abaSelecionada === "cronograma" ? "var(--primary)" : "transparent",
                  color: abaSelecionada === "cronograma" ? "white" : "var(--text)",
                  border: "2px solid transparent",
                  borderRadius: "12px",
                  margin: "5px",
                  cursor: "pointer",
                  fontWeight: abaSelecionada === "cronograma" ? 600 : 400,
                  borderBottom: abaSelecionada === "cronograma" ? "2px solid var(--primary)" : "none",
                }}
              >
                {iconLabel(<Calendar size={16} />, "Cronograma")}
              </AnimatedButton>
            )}
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
                  <> • {turma.categoria === "programacao"
                    ? iconLabel(<Laptop size={14} />, "Programação")
                    : iconLabel(<Monitor size={14} />, "Informática")}</>
                )}
                {turma.descricao && <> • {turma.descricao}</>}
              </p>
            </div>

            <AnimatedButton
              className="btnBack"
              onClick={() => navigate(backPath)}
            >
              {iconLabel(<ArrowLeft size={16} />, "Voltar")}
            </AnimatedButton>
          </div>

          <ConditionalFieldAnimation isVisible={role === "admin"}>
            <div className="responsavelSection">
              <div className="responsavelHeader">
                <div>
                  <div className="responsavelLabel">Responsável pela turma</div>
                  <div className="responsavelValue">{responsavelAtual}</div>
                </div>
                <div className="responsavelControls">
                  <select
                    className="responsavelSelect"
                    value={professorSelecionado}
                    onChange={(e) => setProfessorSelecionado(e.target.value)}
                  >
                    <option value="">Sem responsável</option>
                    {responsaveis.map((responsavel) => (
                      <option key={responsavel.id} value={responsavel.id}>
                        {responsavel.nome} ({responsavel.role === "admin" ? "Admin" : "Professor"})
                      </option>
                    ))}
                  </select>
                  <AnimatedButton
                    type="button"
                    className="responsavelBtn"
                    onClick={handleAtualizarResponsavel}
                    disabled={
                      salvandoResponsavel ||
                      (professorSelecionado || null) === turma.professorId
                    }
                  >
                    {salvandoResponsavel ? "Salvando..." : "Atualizar"}
                  </AnimatedButton>
                </div>
              </div>
              <span className="responsavelHint">
                Você pode selecionar um admin/professor ou deixar sem responsável.
              </span>
            </div>
          </ConditionalFieldAnimation>
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

        {/* SEÇÃO DE EXERCÍCIOS */}
        {abaSelecionada === "exercicios" && turma.exercicios.length > 0 && (
          <div className="turmaSection">
            <h2 className="turmaSectionTitle">
              {iconLabel(<BookOpen size={18} />, `Exercícios Atribuídos (${turma.exercicios.length})`)}
            </h2>

            <div className="exerciciosList">
              {turma.exercicios.map((ex) => (
                <div key={ex.id} className="exercicioItem">
                  <div className="exercicioInfo">
                    <div className="exercicioTitle">{ex.titulo}</div>
                    <div className="exercicioMeta">{ex.modulo}</div>
                  </div>
                  <AnimatedButton
                    className="btnVisualizar"
                    onClick={() =>
                      navigate(`/dashboard/exercicios/${ex.id}`)
                    }
                  >
                    {iconLabel(<ArrowRight size={16} />, "Ver")}
                  </AnimatedButton>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEÇÃO DE CRONOGRAMA */}
        {abaSelecionada === "cronograma" && (
          <div className="turmaSection">
            <h2 className="turmaSectionTitle">
              {iconLabel(<Calendar size={18} />, "Cronograma Semanal")}
            </h2>

            {!turma.dataInicio ? (
              <div className="cronogramaWarning">
                {iconLabel(<AlertTriangle size={16} />, "Configure a data de início da turma para usar o cronograma")}
              </div>
            ) : (
              <>
                <div className="cronogramaInfoBox">
                  <p className="cronogramaInfoLine">
                    <strong><Pin size={14} /> Início:</strong> {new Date(turma.dataInicio).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="cronogramaInfoLine">
                    <strong><Clock size={14} /> Duração:</strong> {turma.duracaoSemanas} semanas
                  </p>
                  <p className="cronogramaInfoLine">
                    <strong><RefreshCcw size={14} /> Status:</strong>{" "}
                    {turma.cronogramaAtivo ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle size={14} /> Cronograma Ativo
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Pause size={14} /> Cronograma Pausado
                      </span>
                    )}
                  </p>
                </div>

                {carregandoCronograma ? (
                  <div className="cronogramaLoading">
                    Carregando cronograma...
                  </div>
                ) : (
                  <>
                    {/* Seletor para adicionar template - apenas para admins */}
                    {role === "admin" ? (
                    <div className="addTemplateBox">
                      <h3 className="templateBoxTitle">
                        {iconLabel(<Plus size={16} />, "Adicionar Template a uma Semana")}
                      </h3>

                      <div className="templateBoxControls">
                        <div className="templateBoxField">
                          <label className="templateBoxLabel">
                            Semana
                          </label>
                          <select
                            value={semanaSelecionada}
                            onChange={(e) => setSemanaSelecionada(Number(e.target.value))}
                            className="templateBoxSelect"
                          >
                            {Array.from({ length: turma.duracaoSemanas || 12 }, (_, i) => i + 1).map((semana: number) => (
                              <option key={semana} value={semana}>
                                Semana {semana}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="templateBoxFieldLarge">
                          <label className="templateBoxLabel">
                            Template
                          </label>
                          <select
                            value={templateSelecionado}
                            onChange={(e) => setTemplateSelecionado(e.target.value)}
                            className="templateBoxSelect"
                          >
                            <option value="">Selecione um template...</option>
                            {templates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.titulo} ({template.modulo || "Sem módulo"})
                              </option>
                            ))}
                          </select>
                        </div>

                        <AnimatedButton
                          onClick={() => handleAdicionarTemplateSemana(semanaSelecionada)}
                          disabled={salvandoCronograma || !templateSelecionado}
                          className="btnAdicionarTemplate"
                        >
                          {salvandoCronograma ? "Adicionando..." : "Adicionar"}
                        </AnimatedButton>
                      </div>
                    </div>
                    ) : (
                    <div className="cronogramaAdminOnly">
                      <p className="cronogramaAdminOnlyText">
                        {iconLabel(<Info size={16} />, "Apenas administradores podem adicionar templates ao cronograma.")}
                      </p>
                    </div>
                    )}

                    {/* Visualização do cronograma */}
                    <div className="cronogramaVisualization">
                      <h3 className="cronogramaVizTitle">Cronograma por Semana</h3>

                      {Array.from({ length: turma.duracaoSemanas || 12 }, (_, i) => i + 1).map((semana: number) => {
                        const exerciciosDaSemana = cronograma[semana] || [];
                        return (
                        <div
                          key={semana}
                          className={`cronogramaSemanaCard ${exerciciosDaSemana.length > 0 ? "hasExercicios" : ""}`}
                        >
                          <div className="cronogramaSemanaHeader">
                            <h4 className="cronogramaSemanaTitle">
                              Semana {semana}
                              {exerciciosDaSemana.length > 0 && (
                                <span className="cronogramaSemanaCount">
                                  ({exerciciosDaSemana.length} exercício{exerciciosDaSemana.length > 1 ? "s" : ""})
                                </span>
                              )}
                            </h4>
                          </div>

                          {exerciciosDaSemana.length > 0 ? (
                            <div className="cronogramaExerciciosList">
                              {exerciciosDaSemana.map((exercicio: any) => (
                                <div
                                  key={exercicio.id}
                                  className="cronogramaExercicioItem"
                                >
                                  <div className="cronogramaExercicioInfo">
                                    <div className="cronogramaExercicioTitulo">{exercicio.titulo}</div>
                                    <div className="cronogramaExercicioModulo">
                                      {exercicio.modulo || "Sem módulo"}
                                    </div>
                                  </div>
                                  <AnimatedButton
                                    onClick={() => handleRemoverExercicioSemana(semana, exercicio.id)}
                                    disabled={salvandoCronograma}
                                    className="btnRemoverExercicio"
                                  >
                                    {iconLabel(<Trash2 size={16} />, "Remover")}
                                  </AnimatedButton>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ padding: "12px", color: "var(--muted)", fontSize: "14px", textAlign: "center" }}>
                              Nenhum exercício atribuído
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* MODAL DE ADICIONAR ALUNOS */}
        {modalAdicionarAberto && createPortal(
          <div className="modalOverlay" onClick={() => setModalAdicionarAberto(false)}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
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
