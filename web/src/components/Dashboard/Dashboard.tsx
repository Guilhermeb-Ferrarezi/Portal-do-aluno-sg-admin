import React from "react";
import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
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
} from "../../services/api";
import {
  Calendar,
  PenLine,
  School,
  Plus,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  Users,
  ClipboardList,
} from "lucide-react";

function ordenarExerciciosRecentes(items: Exercicio[]) {
  return [...items]
    .sort((a, b) => {
      const da = new Date(a.publishedAt ?? a.prazo ?? a.createdAt ?? 0).getTime();
      const db = new Date(b.publishedAt ?? b.prazo ?? b.createdAt ?? 0).getTime();
      return db - da;
    })
    .slice(0, 6);
}

function RingProgress({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(value, 100));
  const style = {
    background: `conic-gradient(var(--red) ${normalized}%, var(--ring) 0)`,
  } as React.CSSProperties;

  return (
    <div className="ring" style={style} aria-label={`Progresso ${normalized}%`}>
      <div className="ringInner">
        <span className="ringValue">{normalized}%</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const name = getName() ?? "Aluno";
  const role = getRole();
  const isAdmin = role === "admin";
  const isManagementView = role === "admin" || role === "professor";
  const canCreateUser = hasRole(["admin"]);

  const [totalTurmasAluno, setTotalTurmasAluno] = React.useState(0);
  const [hasTurmas, setHasTurmas] = React.useState(false);
  const [turmasResponsavel, setTurmasResponsavel] = React.useState(0);
  const [totalTurmasDoSistema, setTotalTurmasDoSistema] = React.useState(0);
  const [totalAlunos, setTotalAlunos] = React.useState(0);
  const [totalAlunosDoSistema, setTotalAlunosDoSistema] = React.useState(0);

  const [totalExercicios, setTotalExercicios] = React.useState(0);
  const [totalExerciciosPublicados, setTotalExerciciosPublicados] = React.useState(0);
  const [exerciciosProgramados, setExerciciosProgramados] = React.useState(0);
  const [exerciciosRascunho, setExerciciosRascunho] = React.useState(0);
  const [exerciciosPendentes, setExerciciosPendentes] = React.useState(0);
  const [exerciciosRecentes, setExerciciosRecentes] = React.useState<Exercicio[]>([]);

  const [submissoes, setSubmissoes] = React.useState<Submissao[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setErro(null);

        if (isManagementView) {
          const [
            turmasResponsavelResult,
            totalTurmasResult,
            contagemAlunos,
            paginaExercicios,
            programadosResult,
            publicadosResult,
            rascunhosResult,
          ] = await Promise.all([
            obterTurmasResponsavel().catch(() => ({ total: 0 })),
            obterTotalTurmas().catch(() => ({ total: 0 })),
            obterContagemAlunosDashboard().catch(() => ({ total: 0, totalSistema: 0 })),
            listarExercicios({ page: 1, limit: 6, status: "todos" }),
            listarExercicios({ page: 1, limit: 1, status: "programado" }),
            listarExercicios({ page: 1, limit: 1, status: "publicado" }),
            listarExercicios({ page: 1, limit: 1, status: "rascunho" }),
          ]);

          if (!active) return;

          setTurmasResponsavel(turmasResponsavelResult.total);
          setTotalTurmasDoSistema(totalTurmasResult.total);
          setHasTurmas(turmasResponsavelResult.total > 0);

          setTotalAlunos(contagemAlunos.total);
          setTotalAlunosDoSistema(contagemAlunos.totalSistema ?? 0);

          setTotalExercicios(paginaExercicios.total);
          setTotalExerciciosPublicados(publicadosResult.total);
          setExerciciosProgramados(programadosResult.total);
          setExerciciosRascunho(rascunhosResult.total);
          setExerciciosPendentes(0);
          setExerciciosRecentes(ordenarExerciciosRecentes(paginaExercicios.items));
        } else {
          const [turmasPage, exerciciosData, contagemAlunos] = await Promise.all([
            listarTurmas({ page: 1, limit: 1 }).catch(() => ({
              items: [],
              total: 0,
              pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
            })),
            listarExercicios(),
            obterContagemAlunosDashboard().catch(() => ({ total: 0, totalSistema: 0 })),
          ]);

          if (!active) return;

          const now = new Date();
          const programados = exerciciosData.filter(
            (e) => !!e.publishedAt && new Date(e.publishedAt) > now
          ).length;
          const pendentes = exerciciosData.filter(
            (e) => !!e.prazo && new Date(e.prazo) > now
          ).length;

          setTotalTurmasAluno(turmasPage.total);
          setHasTurmas(turmasPage.total > 0);

          setTotalAlunos(contagemAlunos.total);
          setTotalAlunosDoSistema(contagemAlunos.totalSistema ?? 0);

          setTotalExercicios(exerciciosData.length);
          setTotalExerciciosPublicados(exerciciosData.length);
          setExerciciosProgramados(programados);
          setExerciciosRascunho(0);
          setExerciciosPendentes(pendentes);
          setExerciciosRecentes(ordenarExerciciosRecentes(exerciciosData));
        }

        void todasMinhasSubmissoes()
          .then((submissoesData) => {
            if (!active) return;
            setSubmissoes(submissoesData);
          })
          .catch(() => {
            if (!active) return;
            setSubmissoes([]);
          });
      } catch (e) {
        if (!active) return;
        setErro(e instanceof Error ? e.message : "Erro ao carregar dados do dashboard");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [isManagementView]);

  const exerciciosConcluidos = React.useMemo(
    () => new Set(submissoes.map((item) => item.exercicioId)).size,
    [submissoes]
  );
  const exerciciosAtivos = Math.max(totalExerciciosPublicados - exerciciosProgramados, 0);

  const progressoOverall = isManagementView
    ? totalExerciciosPublicados > 0
      ? Math.round((exerciciosAtivos / totalExerciciosPublicados) * 100)
      : 0
    : totalExercicios > 0
      ? Math.round((exerciciosConcluidos / totalExercicios) * 100)
      : 0;

  const progressoLabelA = "Turmas";
  const progressoValueA = isManagementView
    ? isAdmin && totalTurmasDoSistema > 0
      ? `${turmasResponsavel}/${totalTurmasDoSistema}`
      : `${turmasResponsavel}`
    : `${totalTurmasAluno}`;

  const progressoLabelB = isManagementView ? "Exercicios ativos" : "Exercicios resolvidos";
  const progressoValueB = isManagementView
    ? `${exerciciosAtivos}/${Math.max(totalExerciciosPublicados, 1)}`
    : `${exerciciosConcluidos}/${Math.max(totalExercicios, 1)}`;

  const taxaAgendamento = totalExerciciosPublicados > 0
    ? Math.round((exerciciosProgramados / totalExerciciosPublicados) * 100)
    : 0;

  if (loading) {
    return (
      <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
        <div className="dashboardSections">
          <section className="card dashboardSkeletonIntro">
            <div className="skeletonLine skeletonTitle" />
            <div className="skeletonLine skeletonSub" />
          </section>
          <section className={isManagementView ? "grid4" : "grid3"}>
            {Array.from({ length: isManagementView ? 4 : 3 }).map((_, idx) => (
              <div key={idx} className="card skeletonCard">
                <div className="skeletonLine skeletonKicker" />
                <div className="skeletonLine skeletonBig" />
                <div className="skeletonLine skeletonRow" />
                <div className="skeletonLine skeletonRow" />
              </div>
            ))}
          </section>
        </div>
      </DashboardLayout>
    );
  }

  if (erro) {
    return (
      <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
        <div className="card dashboardErrorCard">
          <div className="cardTitle">Falha ao carregar dashboard</div>
          <p className="mutedSmall">{erro}</p>
          <RippleButton
            className="dashboardActionBtn"
            onClick={() => window.location.reload()}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RefreshCcw size={16} /> Tentar novamente
            </span>
          </RippleButton>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard" subtitle={`Bem-vindo de volta, ${name}`}>
      <FadeInUp>
        <div className={`dashboardSections ${isManagementView ? "adminBoard" : ""}`}>
          {isManagementView && (
            <section className="card adminOverview">
              <div>
                <div className="kicker">Visao administrativa</div>
                <div className="adminOverviewTitle">Painel operacional</div>
                <p className="muted">
                  Leitura consolidada de turmas, alunos e exercicios com foco em operacao.
                </p>
              </div>
              <div className="adminOverviewStats">
                <div className="adminOverviewChip">
                  <Users size={14} />
                  <span>{totalAlunos} alunos vinculados</span>
                </div>
                <div className="adminOverviewChip">
                  <ClipboardList size={14} />
                  <span>{exerciciosAtivos} exercicios ativos</span>
                </div>
                <div className="adminOverviewChip">
                  <ShieldCheck size={14} />
                  <span>{taxaAgendamento}% em agendamento</span>
                </div>
              </div>
            </section>
          )}

          <section className={isManagementView ? "grid4" : "grid3"}>
            {(isManagementView || hasTurmas) && (
              <m.div
                className="card"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0, duration: 0.3 }}
              >
                <div className="cardHead">
                  <div>
                    <div className="kicker">{isManagementView ? "Turmas geridas" : "Turmas"}</div>
                    <div className="big">{isManagementView ? turmasResponsavel : totalTurmasAluno}</div>
                  </div>
                </div>
                <div className="kv">
                  <div className="kvRow">
                    <span>{isManagementView ? "Sob responsabilidade" : "Turmas registradas"}</span>
                    <strong>{isManagementView ? turmasResponsavel : totalTurmasAluno}</strong>
                  </div>
                  {isAdmin && (
                    <div className="kvRow">
                      <span>Total no sistema</span>
                      <strong style={{ color: "var(--muted)", fontSize: "14px" }}>{totalTurmasDoSistema}</strong>
                    </div>
                  )}
                </div>
              </m.div>
            )}

            {(isManagementView || hasTurmas) && (
              <m.div
                className="card"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
                <div className="cardHead">
                  <div>
                    <div className="kicker">{isManagementView ? "Cobertura de alunos" : "Alunos"}</div>
                    <div className="big">{totalAlunos}</div>
                  </div>
                </div>
                <div className="kv">
                  <div className="kvRow">
                    <span>{isManagementView ? "Alunos vinculados" : "Alunos nas turmas"}</span>
                    <strong>{totalAlunos}</strong>
                  </div>
                  {isAdmin && (
                    <div className="kvRow">
                      <span>Total no sistema</span>
                      <strong style={{ color: "var(--muted)", fontSize: "14px" }}>{totalAlunosDoSistema}</strong>
                    </div>
                  )}
                </div>
              </m.div>
            )}

            <m.div
              className="card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <div className="cardHead">
                <div>
                  <div className="kicker">{isManagementView ? "Operacao de exercicios" : "Exercicios"}</div>
                  <div className="big">{isManagementView ? exerciciosAtivos : totalExercicios}</div>
                </div>
              </div>
              <div className="kv">
                {isManagementView ? (
                  <>
                    <div className="kvRow">
                      <span>Publicados</span>
                      <strong>{totalExerciciosPublicados}</strong>
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
            </m.div>

            {isManagementView && (
              <m.div
                className="card"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <div className="cardHead">
                  <div>
                    <div className="kicker">Backlog editorial</div>
                    <div className="big">{exerciciosRascunho}</div>
                  </div>
                </div>
                <p className="mutedSmall" style={{ marginTop: 8 }}>
                  Exercicios em rascunho aguardando revisao ou publicacao.
                </p>
              </m.div>
            )}
          </section>

          <section className="grid2">
            <m.div
              className="card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.3 }}
            >
              <div className="cardTitle">Exercicios recentes</div>
              <div className="taskList">
                {exerciciosRecentes.length === 0 ? (
                  <div style={{ padding: "12px", opacity: 0.6, textAlign: "center" }}>
                    Nenhum exercicio disponivel
                  </div>
                ) : (
                  exerciciosRecentes.map((ex) => {
                    const isPassed = !!ex.prazo && new Date(ex.prazo) < new Date();
                    const isProgrammed = !!ex.publishedAt && new Date(ex.publishedAt) > new Date();
                    return (
                      <div
                        key={ex.id}
                        className="taskRow"
                        onClick={() => navigate(`/dashboard/exercicios/${ex.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            navigate(`/dashboard/exercicios/${ex.id}`);
                          }
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
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  background: "#3b82f6",
                                  color: "white",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <Calendar size={14} /> Programado
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="mutedSmall">
                            {isProgrammed && ex.publishedAt
                              ? `Publicacao: ${new Date(ex.publishedAt).toLocaleDateString("pt-BR")}`
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
            </m.div>

            <m.div
              className="card"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.3 }}
            >
              <div className="cardHead">
                <div>
                  <div className="kicker">{isManagementView ? "Saude operacional" : "Progresso"}</div>
                  <div className="big">{progressoOverall}%</div>
                </div>
                <RingProgress value={progressoOverall} />
              </div>
              <div className="kv" style={{ marginTop: "12px" }}>
                <div className="kvRow">
                  <span>{progressoLabelA}</span>
                  <strong>{progressoValueA}</strong>
                </div>
                <div className="kvRow">
                  <span>{progressoLabelB}</span>
                  <strong>{progressoValueB}</strong>
                </div>
              </div>
            </m.div>
          </section>

          <section>
            <m.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.3 }}
            >
              <GradientBackground className="card">
                <div className="cardTitle">Acoes rapidas</div>
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
                      <PenLine size={16} /> Exercicios
                    </span>
                  </RippleButton>

                  {(role === "admin" || role === "professor" || hasTurmas) && (
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
                          <Plus size={16} /> Criar usuario
                        </span>
                      </RippleButton>

                      <RippleButton
                        onClick={() => navigate("/dashboard/usuarios")}
                        className="dashboardActionBtn"
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <KeyRound size={16} /> Gerenciar usuarios
                        </span>
                      </RippleButton>
                    </>
                  )}
                </div>
              </GradientBackground>
            </m.div>
          </section>
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
