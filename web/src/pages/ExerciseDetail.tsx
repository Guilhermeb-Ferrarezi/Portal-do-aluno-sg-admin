import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Loader2, RefreshCcw, Save, Search } from "lucide-react";
import { getRole } from "../auth/auth";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import {
  atualizarAnswer,
  atualizarAnswersEmLote,
  listarAnswersExercicio,
  obterExercicio,
  type Exercicio,
  type ExerciseAnswersByStudent,
} from "../services/api";
import "./ExerciseDetail.css";

type EditingAnswer = {
  answerText: string;
  feedback: string;
  selectedOption: string;
  isCorrect: "true" | "false" | "null";
};

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const role = getRole();
  const canReview = role === "admin" || role === "professor";

  const [exercicio, setExercicio] = React.useState<Exercicio | null>(null);
  const [alunos, setAlunos] = React.useState<ExerciseAnswersByStudent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<number | null>(null);
  const [savingBatch, setSavingBatch] = React.useState(false);
  const [editing, setEditing] = React.useState<Record<number, EditingAnswer>>({});

  const [studentFilter, setStudentFilter] = React.useState<string>("todos");
  const [questionFilter, setQuestionFilter] = React.useState<string>("todas");
  const [statusFilter, setStatusFilter] = React.useState<"todos" | "corrigida" | "pendente">("todos");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<"recent" | "oldest" | "student">("recent");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(5);

  const [stats, setStats] = React.useState({
    totalAlunos: 0,
    totalAnswers: 0,
    corrigidas: 0,
    pendentes: 0,
    corretas: 0,
    incorretas: 0,
  });
  const [pagination, setPagination] = React.useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [batchIsCorrect, setBatchIsCorrect] = React.useState<"null" | "true" | "false">("null");
  const [openStudentIds, setOpenStudentIds] = React.useState<Set<number>>(new Set());
  const [openAnswerIds, setOpenAnswerIds] = React.useState<Set<number>>(new Set());

  const load = React.useCallback(async () => {
    if (!id || !canReview) return;
    try {
      setLoading(true);
      setErro(null);

      const [ex, ans] = await Promise.all([
        obterExercicio(id),
        listarAnswersExercicio(id, {
          page,
          limit,
          q: query,
          alunoId: studentFilter === "todos" ? "todos" : Number(studentFilter),
          status: statusFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sort,
        }),
      ]);

      setExercicio(ex);
      setAlunos(ans.alunos);
      if (ans.stats) setStats(ans.stats);
      if (ans.pagination) setPagination(ans.pagination);

      const next: Record<number, EditingAnswer> = {};
      ans.alunos.forEach((aluno) => {
        aluno.answers.forEach((a) => {
          next[a.id] = {
            answerText: a.answerText ?? "",
            feedback: a.feedback ?? "",
            selectedOption: a.selectedOption == null ? "" : String(a.selectedOption),
            isCorrect: a.isCorrect == null ? "null" : a.isCorrect ? "true" : "false",
          };
        });
      });
      setEditing(next);
      setSelectedIds(new Set());
      setOpenStudentIds(new Set());
      setOpenAnswerIds(new Set());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar painel de respostas");
    } finally {
      setLoading(false);
    }
  }, [id, canReview, page, limit, query, studentFilter, statusFilter, dateFrom, dateTo, sort]);

  React.useEffect(() => {
    if (!canReview) return;
    void load();
  }, [load, canReview]);

  async function salvarAnswer(answerId: number) {
    const data = editing[answerId];
    if (!data) return;
    const answer = alunos.flatMap((aluno) => aluno.answers).find((a) => a.id === answerId);
    const isDissertativa = !!answer && (answer.options?.length ?? 0) === 0;
    try {
      setSavingId(answerId);
      setErro(null);
      const payload: {
        answer_text: string | null;
        selected_option: number | null;
        is_correct: boolean | null;
        feedback?: string | null;
      } = {
        answer_text: data.answerText,
        selected_option: data.selectedOption.trim() === "" ? null : Number(data.selectedOption),
        is_correct: data.isCorrect === "null" ? null : data.isCorrect === "true",
      };
      if (isDissertativa) {
        payload.feedback = data.feedback;
      }
      await atualizarAnswer(answerId, payload);
      setOkMsg(`Resposta ${answerId} atualizada`);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar resposta");
    } finally {
      setSavingId(null);
    }
  }

  async function salvarBatch() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setSavingBatch(true);
      setErro(null);
      await atualizarAnswersEmLote({
        answer_ids: ids,
        patch: {
          is_correct: batchIsCorrect === "null" ? null : batchIsCorrect === "true",
        },
      });
      setOkMsg(`${ids.length} resposta(s) atualizadas em lote`);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar em lote");
    } finally {
      setSavingBatch(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const answerCards = React.useMemo(
    () =>
      alunos.flatMap((aluno) =>
        aluno.answers.map((answer) => ({
          ...answer,
          alunoId: aluno.alunoId,
          alunoNome: aluno.alunoNome,
          alunoEmail: aluno.alunoEmail,
        }))
      ),
    [alunos]
  );

  const questionOptions = React.useMemo(() => {
    const seen = new Set<number>();
    const options: Array<{ id: number; label: string }> = [];
    for (const a of answerCards) {
      if (seen.has(a.questionId)) continue;
      seen.add(a.questionId);
      const enunciado = (a.question ?? "").trim();
      const curto = enunciado.length > 70 ? `${enunciado.slice(0, 70)}...` : enunciado;
      options.push({
        id: a.questionId,
        label: `Pergunta ${a.questionId}${curto ? ` - ${curto}` : ""}`,
      });
    }
    return options.sort((x, y) => x.id - y.id);
  }, [answerCards]);

  const visibleAnswersByStudent = React.useMemo(() => {
    if (questionFilter === "todas") {
      return alunos.filter((aluno) => aluno.answers.length > 0);
    }
    const qId = Number(questionFilter);
    if (!Number.isFinite(qId)) {
      return alunos.filter((aluno) => aluno.answers.length > 0);
    }
    return alunos
      .map((aluno) => ({
        ...aluno,
        answers: aluno.answers.filter((a) => a.questionId === qId),
      }))
      .filter((aluno) => aluno.answers.length > 0);
  }, [alunos, questionFilter]);

  const allVisibleIds = React.useMemo(
    () => visibleAnswersByStudent.flatMap((aluno) => aluno.answers.map((a) => a.id)),
    [visibleAnswersByStudent]
  );

  function toggleStudent(alunoId: number) {
    setOpenStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(alunoId)) next.delete(alunoId);
      else next.add(alunoId);
      return next;
    });
  }

  function toggleAnswer(answerId: number) {
    setOpenAnswerIds((prev) => {
      const next = new Set(prev);
      if (next.has(answerId)) next.delete(answerId);
      else next.add(answerId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const allSelected = allVisibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allVisibleIds);
    });
  }

  function handleBack() {
    const navState = location.state as
      | { from?: string; fromSection?: "criar" | "lista" | "tarefa-diaria" }
      | null;

    if (navState?.from === "/dashboard/exercicios") {
      navigate("/dashboard/exercicios", {
        state: navState.fromSection ? { restoreSection: navState.fromSection } : null,
      });
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/dashboard/exercicios");
  }

  return (
    <DashboardLayout
      title="Painel de Respostas"
      subtitle={exercicio ? `Respostas do exercício: ${exercicio.titulo}` : "Carregando..."}
    >
      <div className="exerciseDetailContainer">
        <div className="rvTopBar">
          <button className="edBackBtn" onClick={handleBack}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <button className="refreshBtn" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={16} /> : <RefreshCcw size={16} />} Atualizar
          </button>

          <div className="rvStats">
            <span>Alunos: {stats.totalAlunos}</span>
            <span>Respostas: {stats.totalAnswers}</span>
            <span>Pendentes: {stats.pendentes}</span>
            <span>Corretas: {stats.corretas}</span>
            <span>Incorretas: {stats.incorretas}</span>
          </div>
        </div>

        {erro && <div className="exMessage error">{erro}</div>}
        {okMsg && <div className="exMessage success">{okMsg}</div>}

        {!canReview ? (
          <div className="emptyState">Esta tela é exclusiva de administração.</div>
        ) : loading ? (
          <div className="loadingState">Carregando respostas...</div>
        ) : (
          <>
            <div className="rvFilters">
              <div className="rvFilterField">
                <label className="rvFilterLabel">Filtro: Busca</label>
                <div className="rvSearch">
                  <Search size={14} />
                  <input
                    className="rvInput"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Buscar por pergunta, resposta, aluno ou id"
                  />
                </div>
              </div>

              <div className="rvFilterField">
                <label className="rvFilterLabel">Filtro: Aluno</label>
                <select
                  className="rvSelect"
                  value={studentFilter}
                  onChange={(e) => {
                    setStudentFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="todos">Todos os alunos</option>
                  {alunos.map((a) => (
                    <option key={a.alunoId} value={String(a.alunoId)}>
                      {a.alunoNome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rvFilterField">
                <label className="rvFilterLabel">Filtro: Questão</label>
                <select
                  className="rvSelect"
                  value={questionFilter}
                  onChange={(e) => setQuestionFilter(e.target.value)}
                >
                  <option value="todas">Todas as questões</option>
                  {questionOptions.map((q) => (
                    <option key={q.id} value={String(q.id)}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rvFilterField">
                <label className="rvFilterLabel">Filtro: Status</label>
                <select
                  className="rvSelect"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as "todos" | "corrigida" | "pendente");
                    setPage(1);
                  }}
                >
                  <option value="todos">Todos os status</option>
                  <option value="corrigida">Com correção</option>
                  <option value="pendente">Sem correção</option>
                </select>
              </div>
            </div>

            <div className="rvFilters" style={{ marginTop: -2 }}>
              <div className="rvFilterField">
                <label className="rvFilterLabel">Filtro: Data inicial</label>
                <input className="rvInput" type="datetime-local" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              </div>
              <div className="rvFilterField">
                <label className="rvFilterLabel">Filtro: Data final</label>
                <input className="rvInput" type="datetime-local" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              </div>
              <div className="rvFilterField">
                <label className="rvFilterLabel">Filtro: Ordenação</label>
                <select className="rvSelect" value={sort} onChange={(e) => { setSort(e.target.value as any); setPage(1); }}>
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                  <option value="student">Por aluno</option>
                </select>
              </div>
            </div>

            <div className="rvBatchBar">
              <label className="rvCheckLabel">
                <input type="checkbox" checked={allVisibleIds.length > 0 && allVisibleIds.every((x) => selectedIds.has(x))} onChange={toggleSelectAllVisible} />
                Selecionar visíveis ({selectedIds.size})
              </label>
              <select className="rvSelect small" value={batchIsCorrect} onChange={(e) => setBatchIsCorrect(e.target.value as any)}>
                <option value="null">Sem correção</option>
                <option value="true">Marcar como correta</option>
                <option value="false">Marcar como incorreta</option>
              </select>
              <button className="edPrimaryBtn" disabled={savingBatch || selectedIds.size === 0} onClick={() => void salvarBatch()}>
                {savingBatch ? <Loader2 size={14} /> : <Save size={14} />} Salvar em lote
              </button>
            </div>

            {visibleAnswersByStudent.length === 0 ? (
              <div className="emptyState">Nenhuma resposta encontrada para este exercício.</div>
            ) : (
              <div className="rvGrid">
                {visibleAnswersByStudent.map((aluno) => {
                  const isOpen = openStudentIds.has(aluno.alunoId);
                  return (
                    <div key={aluno.alunoId} className="rvStudentCard">
                      <button
                        type="button"
                        className="rvStudentToggle"
                        onClick={() => toggleStudent(aluno.alunoId)}
                      >
                        <div>
                          <h3 className="rvStudentName">{aluno.alunoNome}</h3>
                          <div className="rvStudentEmail">{aluno.alunoEmail}</div>
                        </div>
                        <div className="rvStudentMeta">
                          <span className="rvCount">{aluno.answers.length} questão(ões)</span>
                          <span className="rvStudentChevron">
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="rvAnswers">
                          {aluno.answers.map((a) => {
                            const options = a.options ?? [];
                            const isDissertativa = options.length === 0;
                            const selectedOptionId = editing[a.id]?.selectedOption ?? (a.selectedOption == null ? "" : String(a.selectedOption));
                            const isAnswerOpen = openAnswerIds.has(a.id);
                            const perguntaCurta = (a.question ?? "").trim();
                            const perguntaPreview =
                              perguntaCurta.length > 78 ? `${perguntaCurta.slice(0, 78)}...` : perguntaCurta;
                            return (
                              <div key={a.id} className="rvAnswerCard">
                                <div className="rvAnswerToggleRow">
                                  <label className="rvCheckLabel rvCheckCompact">
                                    <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} />
                                  </label>
                                  <button
                                    type="button"
                                    className="rvAnswerToggle"
                                    onClick={() => toggleAnswer(a.id)}
                                  >
                                    <div className="rvAnswerToggleMain">
                                      <span className="rvAnswerId">Resposta #{a.id}</span>
                                      <span className="rvAnswerQuestionBadge">Pergunta {a.questionId}</span>
                                      {perguntaPreview ? <span className="rvAnswerPreview">{perguntaPreview}</span> : null}
                                    </div>
                                    <span className="rvStudentChevron">
                                      {isAnswerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </span>
                                  </button>
                                </div>

                                {isAnswerOpen && (
                                  <>
                                    <div className="rvQuestionBlock">
                                      <div className="rvQuestionNumber">Pergunta {a.questionId}</div>
                                      <div className="rvQuestion">{a.question}</div>
                                    </div>

                                    {options.length > 0 && (
                                      <div className="rvOptionsList">
                                        {options.map((opt) => {
                                          const isSelected =
                                            String(opt.id) === selectedOptionId || String(opt.position) === selectedOptionId;
                                          return (
                                            <div key={opt.id} className={`rvOptionItem ${isSelected ? "selected" : ""}`}>
                                              <span className={`rvOptionBullet ${isSelected ? "selected" : ""}`}>{isSelected ? "●" : "○"}</span>
                                              <span className="rvOptionText">{opt.text}</span>
                                              {isSelected && <span className="rvOptionTag">Selecionada</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    <textarea
                                      className="rvTextarea"
                                      value={editing[a.id]?.answerText ?? ""}
                                      onChange={(e) =>
                                        setEditing((prev) => ({
                                          ...prev,
                                          [a.id]: {
                                            ...(prev[a.id] ?? { answerText: "", feedback: "", selectedOption: "", isCorrect: "null" }),
                                            answerText: e.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="Resposta (dissertativa)"
                                    />

                                    {isDissertativa && (
                                      <>
                                        <div className="rvFieldLabel">Feedback para o aluno</div>
                                        <textarea
                                          className="rvTextarea rvFeedbackTextarea"
                                          value={editing[a.id]?.feedback ?? ""}
                                          onChange={(e) =>
                                            setEditing((prev) => ({
                                              ...prev,
                                              [a.id]: {
                                                ...(prev[a.id] ?? { answerText: "", feedback: "", selectedOption: "", isCorrect: "null" }),
                                                feedback: e.target.value,
                                              },
                                            }))
                                          }
                                          placeholder="Digite aqui o feedback da resposta..."
                                        />
                                      </>
                                    )}

                                    <div className="rvControls">
                                      <select
                                        className="rvSelect small"
                                        value={editing[a.id]?.selectedOption ?? ""}
                                        onChange={(e) =>
                                          setEditing((prev) => ({
                                            ...prev,
                                            [a.id]: {
                                              ...(prev[a.id] ?? { answerText: "", feedback: "", selectedOption: "", isCorrect: "null" }),
                                              selectedOption: e.target.value,
                                            },
                                          }))
                                        }
                                      >
                                        <option value="">Sem opção</option>
                                        {options.map((opt) => (
                                          <option key={opt.id} value={String(opt.position)}>
                                            {opt.position}. {opt.text}
                                          </option>
                                        ))}
                                      </select>

                                      <select
                                        className="rvSelect small"
                                        value={editing[a.id]?.isCorrect ?? "null"}
                                        onChange={(e) =>
                                          setEditing((prev) => ({
                                            ...prev,
                                            [a.id]: {
                                              ...(prev[a.id] ?? { answerText: "", feedback: "", selectedOption: "", isCorrect: "null" }),
                                              isCorrect: e.target.value as "true" | "false" | "null",
                                            },
                                          }))
                                        }
                                      >
                                        <option value="null">Sem correção</option>
                                        <option value="true">Correta</option>
                                        <option value="false">Incorreta</option>
                                      </select>

                                      <button className="edPrimaryBtn" onClick={() => void salvarAnswer(a.id)} disabled={savingId === a.id}>
                                        {savingId === a.id ? <Loader2 size={14} /> : <Save size={14} />} Salvar
                                      </button>

                                      {(editing[a.id]?.isCorrect === "true" || a.isCorrect === true) && (
                                        <span className="rvOk">
                                          <CheckCircle2 size={14} /> Correta
                                        </span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rvPagination">
              <button className="edBackBtn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
              <span>Página {pagination.page} de {pagination.totalPages} ({pagination.total} itens)</span>
              <button className="edBackBtn" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}>Próxima</button>
              <select className="rvSelect small" value={String(limit)} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
