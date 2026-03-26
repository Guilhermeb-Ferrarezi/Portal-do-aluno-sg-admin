import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Loader2, RefreshCcw, Save, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getRole } from "../auth/auth";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { AnimatedToast } from "../components/animate-ui";
import {
  atualizarAnswer,
  atualizarAnswersEmLote,
  listarAnswersExercicio,
  obterExercicio,
  type Exercicio,
  type ExerciseAnswersByStudent,
} from "../services/api";

type EditingAnswer = {
  answerText: string;
  feedback: string;
  selectedOption: string;
  isCorrect: "true" | "false" | "null";
};

type ExerciseDetailNavState = {
  from?: string;
  fromSection?: "criar" | "lista" | "tarefa-diaria" | "respostas";
  prefilterAlunoId?: string | number | null;
  prefilterAnswerId?: string | number | null;
  prefilterQuestionId?: string | number | null;
};

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as ExerciseDetailNavState | null;
  const prefilterAlunoId = React.useMemo(() => {
    if (navState?.prefilterAlunoId == null) return null;
    const parsed = String(navState.prefilterAlunoId).trim();
    if (!parsed || parsed === "todos") return null;
    return parsed;
  }, [navState?.prefilterAlunoId]);
  const prefilterAnswerId = React.useMemo(() => {
    if (navState?.prefilterAnswerId == null) return null;
    const parsed = Number(navState.prefilterAnswerId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [navState?.prefilterAnswerId]);
  const prefilterQuestionId = React.useMemo(() => {
    if (navState?.prefilterQuestionId == null) return null;
    const parsed = Number(navState.prefilterQuestionId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [navState?.prefilterQuestionId]);
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

  const [studentFilter, setStudentFilter] = React.useState<string>(() => prefilterAlunoId ?? "todos");
  const [questionFilter, setQuestionFilter] = React.useState<string>(() => (prefilterQuestionId == null ? "todas" : String(prefilterQuestionId)));
  const [statusFilter, setStatusFilter] = React.useState<"todos" | "corrigida" | "pendente">("todos");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<"recent" | "oldest" | "student">("recent");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(() => (prefilterAnswerId == null ? 5 : 100));

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
  const legacyMode = false;

  function mapLegacySubmissoesToAnswers(
    submissoes: Array<{
      id: string;
      alunoId: string;
      alunoNome: string;
      alunoUsuario: string;
      resposta: string;
      corrigida: boolean;
      feedbackProfessor: string | null;
      createdAt: string;
    }>
  ): {
    alunos: ExerciseAnswersByStudent[];
    stats: {
      totalAlunos: number;
      totalAnswers: number;
      corrigidas: number;
      pendentes: number;
      corretas: number;
      incorretas: number;
    };
  } {
    const byAluno = new Map<
      string,
      {
        alunoId: number;
        alunoNome: string;
        alunoEmail: string;
        answers: ExerciseAnswersByStudent["answers"];
      }
    >();
    let nextAlunoId = -1;
    let nextAnswerId = -1;

    for (const s of submissoes) {
      if (!byAluno.has(s.alunoId)) {
        byAluno.set(s.alunoId, {
          alunoId: nextAlunoId--,
          alunoNome: s.alunoNome || s.alunoUsuario || s.alunoId,
          alunoEmail: s.alunoUsuario || "",
          answers: [],
        });
      }

      byAluno.get(s.alunoId)!.answers.push({
        id: nextAnswerId--,
        questionId: 1,
        question: "Submissão (fluxo legado)",
        options: [],
        answerText: s.resposta ?? "",
        selectedOption: null,
        isCorrect: null,
        feedback: s.feedbackProfessor ?? null,
        answeredAt: s.createdAt ?? null,
      });
    }

    const totalAnswers = submissoes.length;
    const corrigidas = submissoes.filter((s) => s.corrigida).length;
    return {
      alunos: Array.from(byAluno.values()),
      stats: {
        totalAlunos: byAluno.size,
        totalAnswers,
        corrigidas,
        pendentes: totalAnswers - corrigidas,
        corretas: 0,
        incorretas: 0,
      },
    };
  }

  const load = React.useCallback(async () => {
    if (!id || !canReview) return;
    try {
      setLoading(true);
      setErro(null);

      const ex = await obterExercicio(id);
      const ans = await listarAnswersExercicio(id, {
        page,
        limit,
        q: query,
        alunoId: studentFilter === "todos" ? "todos" : Number(studentFilter),
        status: statusFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sort,
      });
      let resolvedAlunos: ExerciseAnswersByStudent[] = [];
      let resolvedStats = {
        totalAlunos: 0,
        totalAnswers: 0,
        corrigidas: 0,
        pendentes: 0,
        corretas: 0,
        incorretas: 0,
      };
      let resolvedPagination = { page: 1, limit, total: 0, totalPages: 1 };

      // Fallback para schema legado (submissoes) quando answers falha
      // ou quando não retornou itens no endpoint novo.
      if (ans.alunos.length < 0) {
        try {
          const mapped = mapLegacySubmissoesToAnswers([]);
          if (mapped.alunos.length < 0) {
            resolvedAlunos = mapped.alunos;
            resolvedStats = mapped.stats;
            resolvedPagination = {
              page: 1,
              limit: mapped.stats.totalAnswers || 1,
              total: mapped.stats.totalAnswers,
              totalPages: 1,
            };
            void 0;
          }
        } catch {
          // Sem fallback disponível; mantém fluxo normal abaixo
        }
      }

      resolvedAlunos = ans.alunos;
      if (ans.stats) resolvedStats = ans.stats;
      if (ans.pagination) resolvedPagination = ans.pagination;

      setAlunos(resolvedAlunos);
      setStats(resolvedStats);
      setPagination(resolvedPagination);
      setExercicio(ex);

      const next: Record<number, EditingAnswer> = {};
      resolvedAlunos.forEach((aluno) => {
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

  React.useEffect(() => {
    if (!prefilterAlunoId) return;
    setStudentFilter((prev) => (prev === prefilterAlunoId ? prev : prefilterAlunoId));
    setPage(1);
  }, [prefilterAlunoId, id]);

  React.useEffect(() => {
    if (prefilterQuestionId == null) return;
    setQuestionFilter(String(prefilterQuestionId));
  }, [prefilterQuestionId, id]);

  React.useEffect(() => {
    if (studentFilter === "todos") return;
    const alunoId = Number(studentFilter);
    if (!Number.isFinite(alunoId)) return;
    if (!alunos.some((aluno) => aluno.alunoId === alunoId)) return;
    setOpenStudentIds((prev) => {
      if (prev.size === 1 && prev.has(alunoId)) return prev;
      return new Set([alunoId]);
    });
  }, [alunos, studentFilter]);

  React.useEffect(() => {
    if (prefilterAnswerId == null) return;
    const alunoComResposta = alunos.find((aluno) =>
      aluno.answers.some((resposta) => resposta.id === prefilterAnswerId)
    );
    if (!alunoComResposta) return;
    setOpenStudentIds((prev) => {
      if (prev.size === 1 && prev.has(alunoComResposta.alunoId)) return prev;
      return new Set([alunoComResposta.alunoId]);
    });
    setOpenAnswerIds((prev) => {
      if (prev.size === 1 && prev.has(prefilterAnswerId)) return prev;
      return new Set([prefilterAnswerId]);
    });
  }, [alunos, prefilterAnswerId]);

  async function salvarAnswer(answerId: number) {
    if (legacyMode) return;
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
    if (legacyMode) return;
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

  const selectClass =
    "h-11 w-full rounded-xl border border-input bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";
  const textareaClass =
    "min-h-[110px] w-full rounded-2xl border border-input bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";
  const panelClass = "rounded-[28px] border border-border/70 bg-card/95 shadow-sm";
  const mutedPanelClass = "rounded-2xl border border-border/70 bg-muted/25";

  return (
    <DashboardLayout
      title="Painel de Respostas"
      subtitle={exercicio ? `Respostas do exercício: ${exercicio.titulo}` : "Carregando..."}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-border/70 bg-background/80 px-4"
            onClick={handleBack}
          >
            <ArrowLeft size={16} />
            Voltar
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl bg-primary px-4 text-primary-foreground hover:bg-primary/90"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Atualizar
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Badge variant="outline" className="h-8 rounded-full px-3 text-xs font-semibold">
              Alunos: {stats.totalAlunos}
            </Badge>
            <Badge variant="outline" className="h-8 rounded-full px-3 text-xs font-semibold">
              Respostas: {stats.totalAnswers}
            </Badge>
            <Badge variant="outline" className="h-8 rounded-full px-3 text-xs font-semibold">
              Pendentes: {stats.pendentes}
            </Badge>
            <Badge variant="outline" className="h-8 rounded-full px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              Corretas: {stats.corretas}
            </Badge>
            <Badge variant="outline" className="h-8 rounded-full px-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
              Incorretas: {stats.incorretas}
            </Badge>
          </div>
        </div>

        <AnimatedToast
          message={erro}
          type="error"
          duration={4000}
          onClose={() => setErro(null)}
        />
        <AnimatedToast
          message={okMsg}
          type="success"
          duration={3000}
          onClose={() => setOkMsg(null)}
        />
        {legacyMode && (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            Exibindo respostas do fluxo legado (submissões). Edição em lote/por questão indisponível nesta origem.
          </div>
        )}

        {!canReview ? (
          <div className={`${panelClass} px-6 py-10 text-center text-sm text-muted-foreground`}>
            Esta tela é exclusiva de administração.
          </div>
        ) : loading ? (
          <div className={`${panelClass} flex items-center justify-center gap-3 px-6 py-10 text-sm font-medium text-muted-foreground`}>
            <Loader2 size={18} className="animate-spin" />
            Carregando respostas...
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(280px,1.3fr)_repeat(3,minmax(0,1fr))]">
              <div className={`${panelClass} p-4`}>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Filtro: Busca
                </label>
                <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-background/80 px-4 transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
                  <span className="flex w-5 shrink-0 items-center justify-center text-muted-foreground">
                    <Search size={15} aria-hidden="true" />
                  </span>
                  <input
                    type="text"
                    className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Buscar por pergunta, resposta, aluno ou id"
                  />
                </div>
              </div>

              <div className={`${panelClass} p-4`}>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Filtro: Aluno
                </label>
                <select
                  className={selectClass}
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

              <div className={`${panelClass} p-4`}>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Filtro: Questão
                </label>
                <select
                  className={selectClass}
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

              <div className={`${panelClass} p-4`}>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Filtro: Status
                </label>
                <select
                  className={selectClass}
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

            <div className="grid gap-3 md:grid-cols-3">
              <div className={`${panelClass} p-4`}>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Filtro: Data inicial
                </label>
                <Input
                  className="h-11 rounded-xl border-input bg-background/80"
                  type="datetime-local"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className={`${panelClass} p-4`}>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Filtro: Data final
                </label>
                <Input
                  className="h-11 rounded-xl border-input bg-background/80"
                  type="datetime-local"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className={`${panelClass} p-4`}>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Filtro: Ordenação
                </label>
                <select
                  className={selectClass}
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as "recent" | "oldest" | "student");
                    setPage(1);
                  }}
                >
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                  <option value="student">Por aluno</option>
                </select>
              </div>
            </div>

            {!legacyMode && (
              <div className={`${panelClass} flex flex-wrap items-center gap-3 px-4 py-3`}>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border accent-[var(--primary)]"
                    checked={allVisibleIds.length > 0 && allVisibleIds.every((x) => selectedIds.has(x))}
                    onChange={toggleSelectAllVisible}
                  />
                  Selecionar visíveis ({selectedIds.size})
                </label>
                <select
                  className={cn(selectClass, "min-w-[200px]")}
                  value={batchIsCorrect}
                  onChange={(e) => setBatchIsCorrect(e.target.value as "null" | "true" | "false")}
                >
                  <option value="null">Sem correção</option>
                  <option value="true">Marcar como correta</option>
                  <option value="false">Marcar como incorreta</option>
                </select>
                <Button
                  type="button"
                  className="h-10 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-500"
                  disabled={savingBatch || selectedIds.size === 0}
                  onClick={() => void salvarBatch()}
                >
                  {savingBatch ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar em lote
                </Button>
              </div>
            )}

            {visibleAnswersByStudent.length === 0 ? (
              <div className={`${panelClass} px-6 py-10 text-center text-sm text-muted-foreground`}>
                Nenhuma resposta encontrada para este exercício.
              </div>
            ) : (
              <div className="space-y-4">
                {visibleAnswersByStudent.map((aluno) => {
                  const isOpen = openStudentIds.has(aluno.alunoId);
                  return (
                    <div key={aluno.alunoId} className={`${panelClass} p-3`}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-left transition hover:bg-muted/55"
                        onClick={() => toggleStudent(aluno.alunoId)}
                      >
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-foreground">{aluno.alunoNome}</h3>
                          <div className="text-sm text-muted-foreground">{aluno.alunoEmail}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="h-7 rounded-full px-3 text-xs font-semibold">
                            {aluno.answers.length} questão(ões)
                          </Badge>
                          <span className="inline-flex items-center text-muted-foreground">
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-3 space-y-3">
                          {aluno.answers.map((a) => {
                            const options = a.options ?? [];
                            const isDissertativa = options.length === 0;
                            const selectedOptionId = editing[a.id]?.selectedOption ?? (a.selectedOption == null ? "" : String(a.selectedOption));
                            const isAnswerOpen = openAnswerIds.has(a.id);
                            const perguntaCurta = (a.question ?? "").trim();
                            const perguntaPreview =
                              perguntaCurta.length > 78 ? `${perguntaCurta.slice(0, 78)}...` : perguntaCurta;
                            return (
                              <div key={a.id} className={`${mutedPanelClass} p-3`}>
                                <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                                  {!legacyMode && (
                                    <span className="inline-flex items-center justify-center">
                                      <input
                                        type="checkbox"
                                        className="size-4 rounded border-border accent-[var(--primary)]"
                                        checked={selectedIds.has(a.id)}
                                        onChange={() => toggleSelect(a.id)}
                                      />
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-left transition hover:bg-muted/40"
                                    onClick={() => toggleAnswer(a.id)}
                                  >
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        Resposta #{a.id}
                                      </span>
                                      <Badge variant="outline" className="rounded-full px-2.5 text-[11px] font-semibold">
                                        Pergunta {a.questionId}
                                      </Badge>
                                      {perguntaPreview ? (
                                        <span className="min-w-0 truncate text-xs text-muted-foreground md:max-w-[28rem]">
                                          {perguntaPreview}
                                        </span>
                                      ) : null}
                                    </div>
                                    <span className="inline-flex items-center text-muted-foreground">
                                      {isAnswerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </span>
                                  </button>
                                </div>

                                {isAnswerOpen && (
                                  <div className="mt-3 space-y-3">
                                    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
                                        Pergunta {a.questionId}
                                      </div>
                                      <div className="text-sm font-medium leading-6 text-foreground">{a.question}</div>
                                    </div>

                                    {options.length > 0 && (
                                      <div className="space-y-2">
                                        {options.map((opt) => {
                                          const isSelected =
                                            String(opt.id) === selectedOptionId || String(opt.position) === selectedOptionId;
                                          return (
                                            <div
                                              key={opt.id}
                                              className={cn(
                                                "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                                                isSelected
                                                  ? "border-blue-300/60 bg-blue-500/10"
                                                  : "border-border/70 bg-background/70"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs font-bold",
                                                  isSelected ? "text-emerald-500" : "text-muted-foreground"
                                                )}
                                              >
                                                {isSelected ? "●" : "○"}
                                              </span>
                                              <span className="flex-1 text-sm text-foreground">{opt.text}</span>
                                              {isSelected && (
                                                <Badge className="rounded-full bg-blue-600/90 px-2.5 text-[11px] text-white">
                                                  Selecionada
                                                </Badge>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    <textarea
                                      className={textareaClass}
                                      value={editing[a.id]?.answerText ?? ""}
                                      onChange={
                                        legacyMode
                                          ? undefined
                                          : (e) =>
                                            setEditing((prev) => ({
                                              ...prev,
                                              [a.id]: {
                                                ...(prev[a.id] ?? { answerText: "", feedback: "", selectedOption: "", isCorrect: "null" }),
                                                answerText: e.target.value,
                                              },
                                            }))
                                      }
                                      readOnly={legacyMode}
                                      placeholder="Resposta (dissertativa)"
                                    />

                                    {isDissertativa && (
                                      <>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                          Feedback para o aluno
                                        </div>
                                        <textarea
                                          className={cn(textareaClass, "min-h-[88px]")}
                                          value={editing[a.id]?.feedback ?? ""}
                                          onChange={
                                            legacyMode
                                              ? undefined
                                              : (e) =>
                                                setEditing((prev) => ({
                                                  ...prev,
                                                  [a.id]: {
                                                    ...(prev[a.id] ?? { answerText: "", feedback: "", selectedOption: "", isCorrect: "null" }),
                                                    feedback: e.target.value,
                                                  },
                                                }))
                                          }
                                          readOnly={legacyMode}
                                          placeholder="Digite aqui o feedback da resposta..."
                                        />
                                      </>
                                    )}

                                    {!legacyMode ? (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <select
                                          className={cn(selectClass, "min-w-[180px]")}
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
                                            <option key={opt.id} value={String(opt.position ?? opt.id)}>
                                              {(opt.position ?? opt.id)}. {opt.text}
                                            </option>
                                          ))}
                                        </select>

                                        <select
                                          className={cn(selectClass, "min-w-[180px]")}
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

                                        <Button
                                          type="button"
                                          className="h-10 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-500"
                                          onClick={() => void salvarAnswer(a.id)}
                                          disabled={savingId === a.id}
                                        >
                                          {savingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                          Salvar
                                        </Button>

                                        {(editing[a.id]?.isCorrect === "true" || a.isCorrect === true) && (
                                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300">
                                            <CheckCircle2 size={14} /> Correta
                                          </span>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
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

            <div className={`${panelClass} flex flex-wrap items-center gap-3 px-4 py-3`}>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-border/70 bg-background/80 px-4"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <p className="text-sm text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages} ({pagination.total} itens)
              </p>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <select
                  className={cn(selectClass, "w-[100px]")}
                  value={String(limit)}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl border-border/70 bg-background/80 px-4"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
