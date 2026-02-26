import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "./DashboardLayout";
import { getName, getRole, hasRole } from "../../auth/auth";
import { RippleButton, GradientBackground, FadeInUp } from "../animate-ui";
import {
  listarTurmas,
  obterTurmasResponsavel,
  obterTotalTurmas,
  obterContagemAlunosDashboard,
  listarExercicios,
  todasMinhasSubmissoes,
  type Exercicio,
  type Submissao,
  type Turma,
} from "../../services/api";
import {
  Calendar,
  Flame,
  PenLine,
  School,
  Plus,
  KeyRound,
} from "lucide-react";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calcularSequencia(submissoes: Submissao[]) {
  if (!submissoes.length) return 0;

  const diasAtivos = new Set(
    submissoes.map((s) => toDateKey(new Date(s.createdAt)))
  );

  let sequencia = 0;
  const cursor = new Date();

  while (true) {
    const chave = toDateKey(cursor);
    if (!diasAtivos.has(chave)) break;
    sequencia += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return sequencia;
}

function calcularMediaNota(submissoes: Submissao[]) {
  const notasPorExercicio = new Map<string, { nota: number; createdAt: string }>();

  for (const submissao of submissoes) {
    // Converter nota para número se necessário (defesa adicional)
    const notaNum = typeof submissao.nota === 'string' ? parseFloat(submissao.nota) : submissao.nota;

    // Ignorar notas inválidas
    if (notaNum === null || notaNum === undefined || isNaN(notaNum)) continue;

    const atual = notasPorExercicio.get(submissao.exercicioId);
    if (!atual || new Date(submissao.createdAt) > new Date(atual.createdAt)) {
      notasPorExercicio.set(submissao.exercicioId, {
        nota: notaNum,
        createdAt: submissao.createdAt,
      });
    }
  }

  if (notasPorExercicio.size === 0) return null;

  const soma = Array.from(notasPorExercicio.values()).reduce(
    (total, item) => total + item.nota,
    0
  );
  const mediaBruta = soma / notasPorExercicio.size;

  // Validação adicional de NaN
  if (isNaN(mediaBruta)) return null;

  return mediaBruta > 10 ? mediaBruta / 10 : mediaBruta;
}

function RingProgress({ value }: { value: number }) {
  const style = {
    background: `conic-gradient(var(--red) ${value}%, var(--ring) 0)`,
  } as React.CSSProperties;

  return (
    <div className="ring" style={style} aria-label={`Progresso ${value}%`}>
      <div className="ringInner">
        <span className="ringValue">{value}%</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const name = getName() ?? "Aluno";
  const role = getRole();
  const isAdmin = role === "admin";
  const canCreateUser = hasRole(["admin"]);

  // Estados
  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [turmasResponsavel, setTurmasResponsavel] = React.useState(0);
  const [totalTurmasDoSistema, setTotalTurmasDoSistema] = React.useState(0);
  const [exercicios, setExercicios] = React.useState<Exercicio[]>([]);
  const [submissoes, setSubmissoes] = React.useState<Submissao[]>([]);
  const [totalAlunos, setTotalAlunos] = React.useState(0);
  const [totalAlunosDoSistema, setTotalAlunosDoSistema] = React.useState(0);
  const [sequencia, setSequencia] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  // Carregar dados
  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setErro(null);

        const [
          turmasData,
          exerciciosData,
          turmasResponsavelResult,
          totalTurmasResult,
          contagemAlunos,
        ] = await Promise.all([
          listarTurmas(),
          listarExercicios(),
          obterTurmasResponsavel().catch(() => ({ total: 0 })),
          obterTotalTurmas().catch(() => ({ total: 0 })),
          obterContagemAlunosDashboard().catch(() => ({ total: 0, totalSistema: 0 })),
        ]);

        if (!active) return;

        setTurmas(turmasData);
        setTurmasResponsavel(turmasResponsavelResult.total);
        setTotalTurmasDoSistema(totalTurmasResult.total);
        setExercicios(exerciciosData);
        setTotalAlunos(contagemAlunos.total);
        setTotalAlunosDoSistema(contagemAlunos.totalSistema ?? 0);

        void todasMinhasSubmissoes()
          .then((submissoesData) => {
            if (!active) return;
            setSubmissoes(submissoesData);
            setSequencia(calcularSequencia(submissoesData));
          })
          .catch(() => {
            if (!active) return;
            setSubmissoes([]);
            setSequencia(0);
          });
      } catch (e) {
        if (!active) return;
        setErro(e instanceof Error ? e.message : "Erro ao carregar dados");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [role]);

  if (loading) {
    return (
      <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
        <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
          Carregando...
        </div>
      </DashboardLayout>
    );
  }

  if (erro) {
    return (
      <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--red)",
            fontSize: "14px",
          }}
        >
          Erro ao carregar dados: {erro}
        </div>
      </DashboardLayout>
    );
  }

  // Calcular estatísticas
  const isManagementView = role === "admin" || role === "professor";
  const now = new Date();
  const totalExercicios = exercicios.length;
  const exerciciosPendentes = exercicios.filter(
    (e) => e.prazo && new Date(e.prazo) > now
  ).length;
  const exerciciosProgramados = exercicios.filter(
    (e) => !!e.publishedAt && new Date(e.publishedAt) > now
  ).length;
  const exerciciosAtivos = Math.max(totalExercicios - exerciciosProgramados, 0);

  // Exercícios recentes (últimos 5)
  const exerciciosRecentes = [...exercicios]
    .sort((a, b) => {
      const da = new Date(a.publishedAt ?? a.prazo ?? 0).getTime();
      const db = new Date(b.publishedAt ?? b.prazo ?? 0).getTime();
      return db - da;
    })
    .slice(0, 6);

  // Simular estatísticas (em produção, viriam da API)
  const progresso = {
    overall: 65,
    modulos: "3/6",
    exercicios: "41/60",
  };

  const streak = sequencia;
  const mediaNota = calcularMediaNota(submissoes);
  const ranking = 5;

  return (
    <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
      <FadeInUp>
        <div className={`dashboardSections ${isManagementView ? "adminBoard" : ""}`}>
          {/* SEÇÃO 1: ESTATÍSTICAS */}
          <section className={isManagementView ? "grid4" : "grid3"}>
            {(isManagementView || turmas.length > 0) && (
              <motion.div
                className="card"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 * 0.1, duration: 0.3 }}
              >
                <div className="cardHead">
                  <div>
                    <div className="kicker">{isManagementView ? "Turmas geridas" : "Turmas"}</div>
                    <div className="big">{role === "aluno" ? turmas.length : turmasResponsavel}</div>
                  </div>
                </div>
                <div className="kv">
                  <div className="kvRow">
                    <span>{isManagementView ? "Sob responsabilidade" : "Turmas registradas"}</span>
                    <strong>{role === "aluno" ? turmas.length : turmasResponsavel}</strong>
                  </div>
                  {isAdmin && (
                    <div className="kvRow">
                      <span>Total no sistema</span>
                      <strong style={{ color: "var(--muted)", fontSize: "14px" }}>{totalTurmasDoSistema}</strong>
                    </div>
                  )}
                  {role === "professor" && (
                    <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "8px", lineHeight: "1.5" }}>
                      {turmasResponsavel > 0
                        ? `Você está responsável por ${turmasResponsavel} turma${turmasResponsavel !== 1 ? "s" : ""}.`
                        : "Você não está responsável por nenhuma turma ainda."}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {(isManagementView || turmas.length > 0) && (
              <motion.div
                className="card"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 * 0.1, duration: 0.3 }}
              >
                <div className="cardHead">
                  <div>
                    <div className="kicker">{isManagementView ? "Cobertura de alunos" : "ALUNOS"}</div>
                    <div className="big">{totalAlunos}</div>
                  </div>
                </div>
                <div className="kv">
                  <div className="kvRow">
                    <span>{isManagementView ? "Alunos vinculados" : `Alunos nas ${isAdmin ? "minhas turmas" : "turmas"}`}</span>
                    <strong>{totalAlunos}</strong>
                  </div>
                  {isAdmin && (
                    <div className="kvRow">
                      <span>Total no sistema</span>
                      <strong style={{ color: "var(--muted)", fontSize: "14px" }}>{totalAlunosDoSistema}</strong>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            <motion.div
              className="card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 * 0.1, duration: 0.3 }}
            >
              <div className="cardHead">
                <div>
                  <div className="kicker">{isManagementView ? "Operacao de exercicios" : "EXERCICIOS"}</div>
                  <div className="big">{isManagementView ? exerciciosAtivos : totalExercicios}</div>
                </div>
              </div>
              <div className="kv">
                {isManagementView ? (
                  <>
                    <div className="kvRow">
                      <span>Publicados</span>
                      <strong>{totalExercicios}</strong>
                    </div>
                    <div className="kvRow">
                      <span>Programados</span>
                      <strong>{exerciciosProgramados}</strong>
                    </div>
                  </>
                ) : (
                  <div className="kvRow">
                    <span>Pendentes</span>
                    <strong style={{ color: "var(--red)" }}>{exerciciosPendentes}</strong>
                  </div>
                )}
              </div>
            </motion.div>
          </section>

          {/* SEÇÃO 2: PROGRESSO E ATIVIDADES */}
          <section className="grid2">
            <motion.div
              className="card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3 * 0.1, duration: 0.3 }}
            >
              <div className="cardTitle">Exercícios Recentes</div>
              <div className="taskList">
                {exerciciosRecentes.length === 0 ? (
                  <div style={{ padding: "12px", opacity: 0.6, textAlign: "center" }}>
                    Nenhum exercício disponível
                  </div>
                ) : (
                  exerciciosRecentes.map((ex) => {
                    const isPassed =
                      ex.prazo && new Date(ex.prazo) < new Date();
                    const isProgrammed =
                      ex.publishedAt ? new Date(ex.publishedAt) > new Date() : false;
                    return (
                      <div
                        key={ex.id}
                        className="taskRow"
                        onClick={() => navigate(`/dashboard/exercicios/${ex.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            navigate(`/dashboard/exercicios/${ex.id}`);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <span
                          className={`taskDot ${isProgrammed ? "blue" : isPassed ? "red" : "gray"}`}
                          aria-hidden="true"
                        />
                        <div className="taskText">
                          <div className="taskTitle" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {ex.titulo}
                            {isProgrammed && (
                              <span style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                background: "#3b82f6",
                                color: "white",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                whiteSpace: "nowrap"
                              }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <Calendar size={14} /> Programado
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="mutedSmall">
                            {isProgrammed && ex.publishedAt
                              ? `Publicação: ${new Date(ex.publishedAt).toLocaleDateString("pt-BR")}`
                              : ex.prazo
                                ? `Prazo: ${new Date(ex.prazo).toLocaleDateString("pt-BR")}`
                                : "Sem prazo"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>

            <motion.div
              className="card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 4 * 0.1, duration: 0.3 }}
            >
              <div className="cardHead">
                <div>
                  <div className="kicker">PROGRESSO</div>
                  <div className="big">{progresso.overall}%</div>
                </div>
                <RingProgress value={progresso.overall} />
              </div>
              <div className="kv" style={{ marginTop: "12px" }}>
                <div className="kvRow">
                  <span>Módulos</span>
                  <strong>{progresso.modulos}</strong>
                </div>
                <div className="kvRow">
                  <span>Exercícios</span>
                  <strong>{progresso.exercicios}</strong>
                </div>
              </div>
            </motion.div>
          </section>

          {/* SEÇÃO 3: INFORMAÇÕES ADICIONAIS */}
          <section className="grid2">
            <motion.div
              className="card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 5 * 0.1, duration: 0.3 }}
            >
              <div className="cardHead">
                <div>
                  <div className="kicker">SEQUÊNCIA</div>
                  <div className="big">
                    {streak} <span className="bigSub">dias</span>
                  </div>
                </div>
                <div className="streakBadge" aria-hidden="true">
                  <Flame size={18} />
                </div>
              </div>
              <p className="muted">
                {streak > 0
                  ? "Continue assim! Você está em uma ótima sequência de estudos."
                  : "Envie uma atividade hoje para iniciar sua sequência."}
              </p>
            </motion.div>

            <motion.div
              className="card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 6 * 0.1, duration: 0.3 }}
            >
              <div className="cardTitle">Seu Desempenho</div>
              <div className="perf">
                <div className="perfRow">
                  <span className="muted">Média de notas</span>
                  <strong>
                    {mediaNota !== null && !isNaN(mediaNota)
                      ? `${mediaNota.toFixed(1)}/10`
                      : "Nenhum exercício corrigido"}
                  </strong>
                </div>
                {mediaNota !== null && !isNaN(mediaNota) ? (
                  <>
                    <div className="bar">
                      <div
                        className="barFillGreen"
                        style={{ width: `${Math.min(mediaNota * 10, 100)}%` }}
                      />
                    </div>
                    <div className="perfRow" style={{ marginTop: 14 }}>
                      <span className="muted">Ranking</span>
                      <strong>#{ranking}</strong>
                    </div>
                  </>
                ) : (
                  <div className="mutedSmall" style={{ marginTop: 10 }}>
                    Envie um exercício e aguarde a correção para ver sua média.
                  </div>
                )}
              </div>
            </motion.div>
          </section>

          {/* SEÇÃO 4: AÇÕES RÁPIDAS */}
          <section>
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 7 * 0.1, duration: 0.3 }}
            >
              <GradientBackground className="card">
                <div className="cardTitle">Ações Rápidas</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "12px",
                    marginTop: "16px",
                  }}
                >
                  <RippleButton
                    onClick={() => navigate("/dashboard/exercicios")}
                    className="dashboardActionBtn"
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <PenLine size={16} /> Exercícios
                    </span>
                  </RippleButton>

                  {(role === "admin" || role === "professor" || turmas.length > 0) && (
                    <RippleButton
                      onClick={() => navigate("/dashboard/turmas")}
                      className="dashboardActionBtn"
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <School size={16} /> Turmas
                      </span>
                    </RippleButton>
                  )}

                  {canCreateUser && (
                    <>
                      <RippleButton
                        onClick={() => navigate("/dashboard/criar-usuario")}
                        className="dashboardActionBtn"
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Plus size={16} /> Criar Usuário
                        </span>
                      </RippleButton>

                      <RippleButton
                        onClick={() => navigate("/dashboard/usuarios")}
                        className="dashboardActionBtn"
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <KeyRound size={16} /> Gerenciar Usuários
                        </span>
                      </RippleButton>

                    </>
                  )}
                </div>
              </GradientBackground>
            </motion.div>
          </section>
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
