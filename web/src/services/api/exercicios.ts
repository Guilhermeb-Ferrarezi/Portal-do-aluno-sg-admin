import { apiFetch, API_BASE_URL, buildAuthHeaders, handleUnauthorized, parseError } from "./core";
import type { PaginatedItemsResponse } from "./core";
import type { Turma } from "./turmas";
import type { UserRef } from "./core";

export type TipoExercicio = "nenhum" | "codigo" | "texto" | "escrita" | "mouse" | "multipla" | "atalho";

export type Exercicio = {
  id: string;
  titulo: string;
  descricao: string;
  modulo: string;
  tema: string | null;
  phaseId?: string | null;
  prazo: string | null;
  videoUrl?: string | null;
  difficulty?: number | null;
  indexOrder?: number | null;
  isFinalExercise?: boolean;
  pointsRedeem?: number | null;
  exercisePeriod?: string | null;
  publishedAt: string | null;
  isDailyTask?: boolean;
  dailyTaskId?: string | null;
  dailyTaskName?: string | null;
  tipoExercicio?: "nenhum" | "codigo" | "texto" | "escrita" | "mouse" | "multipla" | "atalho" | null;
  categoria?: "programacao" | "informatica";
  mouse_regras?: string | null;
  multipla_regras?: string | null;
  atalho_tipo?: "copiar-colar" | "copiar-colar-imagens" | "selecionar-deletar" | null;
  publicado?: boolean;
  permitir_repeticao?: boolean;
  maxTentativas?: number | null;
  penalidadePorTentativa?: number | null;
  intervaloReenvio?: number | null;
  anexoUrl?: string | null;
  anexoNome?: string | null;
  containerName?: string | null;
  containerDay?: number | null;
  createdAt: string;
  turmas?: Turma[];
  alunos?: UserRef[];
  aluno_ids?: string[];
};

export type ExerciseMultipleChoiceOption = {
  letter: string;
  text: string;
};

export type ExerciseMultipleChoiceQuestion = {
  pergunta: string;
  opcoes: ExerciseMultipleChoiceOption[];
  respostaCorreta: string;
};

export type ExerciseAIDraft = {
  titulo: string;
  descricao: string;
  difficulty: number;
  pointsRedeem: number;
  suggestedComponentType: "escrita" | "multipla";
  multiplaQuestoes: ExerciseMultipleChoiceQuestion[];
};

export type Submissao = {
  id: string;
  exercicioId: string;
  alunoId: string;
  resposta: string;
  tipoResposta: TipoExercicio;
  linguagem: string | null;
  nota: number | null;
  corrigida: boolean;
  feedbackProfessor: string | null;
  isLate?: boolean;
  verificacaoDescricao?: number | null;
  arquivoUrl?: string | null;
  arquivoNome?: string | null;
  createdAt: string;
};

export type ExerciseAnswerItem = {
  id: number;
  questionId: number;
  question: string;
  options?: Array<{ id: number; text: string; isCorrect: boolean; position: number }>;
  answerText: string | null;
  selectedOption: number | null;
  isCorrect: boolean | null;
  feedback: string | null;
  answeredAt: string | null;
};

export type ExerciseAnswersByStudent = {
  alunoId: number;
  alunoNome: string;
  alunoEmail: string;
  answers: ExerciseAnswerItem[];
};

export type ExerciseAnswersResponse = {
  exercicioId: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats?: {
    totalAlunos: number;
    totalAnswers: number;
    corrigidas: number;
    pendentes: number;
    corretas: number;
    incorretas: number;
  };
  totalAlunos: number;
  totalAnswers: number;
  alunos: ExerciseAnswersByStudent[];
};

export type ExerciseAnswerStudent = {
  alunoId: number;
  alunoNome: string;
  alunoEmail: string;
  totalAnswers: number;
  totalExercicios?: number;
  lastAnsweredAt: string | null;
};

export type AnsweredExerciseByStudent = {
  exercicioId: number;
  exercicioTitulo: string;
  exercicioModulo: string | null;
  exercicioTema: string | null;
  totalAnswers: number;
  lastAnsweredAt: string | null;
};

export async function listarExercicios(): Promise<Exercicio[]>;
export async function listarExercicios(params: {
  page?: number;
  limit?: number;
  q?: string;
  modulo?: string;
  turmaId?: string;
  status?: "todos" | "publicado" | "programado" | "rascunho";
}): Promise<PaginatedItemsResponse<Exercicio>>;
export async function listarExercicios(params?: {
  page?: number;
  limit?: number;
  q?: string;
  modulo?: string;
  turmaId?: string;
  status?: "todos" | "publicado" | "programado" | "rascunho";
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.q) search.set("q", params.q);
  if (params?.modulo) search.set("modulo", params.modulo);
  if (params?.turmaId) search.set("turmaId", params.turmaId);
  if (params?.status && params.status !== "todos") search.set("status", params.status);
  const query = search.toString();
  return apiFetch<Exercicio[] | PaginatedItemsResponse<Exercicio>>(
    `/exercicios${query ? `?${query}` : ""}`
  );
}

export async function listarTarefasDiarias(): Promise<Exercicio[]>;
export async function listarTarefasDiarias(params: {
  page?: number;
  limit?: number;
  q?: string;
  modulo?: string;
  turmaId?: string;
  status?: "todos" | "publicado" | "programado" | "rascunho";
}): Promise<PaginatedItemsResponse<Exercicio>>;
export async function listarTarefasDiarias(params?: {
  page?: number;
  limit?: number;
  q?: string;
  modulo?: string;
  turmaId?: string;
  status?: "todos" | "publicado" | "programado" | "rascunho";
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.q) search.set("q", params.q);
  if (params?.modulo) search.set("modulo", params.modulo);
  if (params?.turmaId) search.set("turmaId", params.turmaId);
  if (params?.status && params.status !== "todos") search.set("status", params.status);
  const query = search.toString();
  return apiFetch<Exercicio[] | PaginatedItemsResponse<Exercicio>>(
    `/exercicios/daily-tasks${query ? `?${query}` : ""}`
  );
}

export async function obterExercicio(id: string) {
  return apiFetch<Exercicio>(`/exercicios/${id}`);
}

export async function gerarRascunhoExercicioIA(dados: {
  prompt: string;
  courseId: number;
  moduleId: number;
  phaseId: number;
  categoria: "programacao" | "informatica";
  componentType: "escrita" | "multipla";
  difficulty?: number | null;
}) {
  return apiFetch<{ message: string; draft: ExerciseAIDraft }>("/exercicios/ai/generate", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function criarExercicio(dados: {
  titulo: string;
  descricao: string;
  phase_id: number;
  course_id?: number;
  modulo: string;
  tema?: string | null;
  prazo?: string | null;
  video_url?: string | null;
  difficulty?: number | null;
  index_order?: number | null;
  is_final_exercise?: boolean;
  is_daily_task?: boolean;
  points_redeem?: number | null;
  exercise_period?: string | null;
  publicado?: boolean;
  published_at?: string | null;
  gabarito?: string | null;
  linguagem_esperada?: string | null;
  categoria?: "programacao" | "informatica";
  mouse_regras?: string | null;
  multipla_regras?: string | null;
  max_tentativas?: number | null;
  penalidade_por_tentativa?: number | null;
  intervalo_reenvio?: number | null;
  turma_ids?: string[];
  aluno_ids?: string[];
  tipoExercicio?: TipoExercicio;
}) {
  return apiFetch<{ message: string; exercicio: unknown }>("/exercicios", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarExercicio(id: string, dados: {
  titulo: string;
  descricao: string;
  phase_id: number;
  course_id?: number;
  modulo: string;
  tema?: string | null;
  prazo?: string | null;
  video_url?: string | null;
  difficulty?: number | null;
  index_order?: number | null;
  is_final_exercise?: boolean;
  is_daily_task?: boolean;
  points_redeem?: number | null;
  exercise_period?: string | null;
  publicado?: boolean;
  published_at?: string | null;
  gabarito?: string | null;
  linguagem_esperada?: string | null;
  categoria?: "programacao" | "informatica";
  mouse_regras?: string | null;
  multipla_regras?: string | null;
  max_tentativas?: number | null;
  penalidade_por_tentativa?: number | null;
  intervalo_reenvio?: number | null;
  turma_ids?: string[];
  aluno_ids?: string[];
  tipoExercicio?: TipoExercicio;
}) {
  return apiFetch<{ message: string; exercicio: unknown }>(`/exercicios/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function anexarExercicioArquivo(exercicioId: string, arquivo: File) {
  const form = new FormData();
  form.append("anexo", arquivo);

  const res = await fetch(`${API_BASE_URL}/exercicios/${exercicioId}/anexo`, {
    method: "POST",
    headers: await buildAuthHeaders(),
    body: form,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ message: string; anexoUrl: string | null; anexoNome: string | null }>;
}

export async function removerExercicioArquivo(exercicioId: string) {
  const res = await fetch(`${API_BASE_URL}/exercicios/${exercicioId}/anexo`, {
    method: "DELETE",
    headers: await buildAuthHeaders(),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ message: string }>;
}

export async function deletarExercicio(id: string) {
  return apiFetch<{ message: string }>(`/exercicios/${id}`, {
    method: "DELETE",
  });
}

export async function enviarSubmissao(exercicioId: string, dados: {
  resposta: string;
  tipo_resposta: TipoExercicio;
  linguagem?: string;
}) {
  return apiFetch<{ message: string; submissao: Submissao }>(
    `/exercicios/${exercicioId}/submissoes`,
    {
      method: "POST",
      body: JSON.stringify(dados),
    }
  );
}

export async function enviarSubmissaoComArquivo(exercicioId: string, dados: {
  resposta?: string;
  tipo_resposta: TipoExercicio;
  linguagem?: string;
  arquivo: File;
}) {
  const form = new FormData();
  if (typeof dados.resposta === "string") {
    form.append("resposta", dados.resposta);
  }
  form.append("tipo_resposta", dados.tipo_resposta);
  if (dados.linguagem) {
    form.append("linguagem", dados.linguagem);
  }
  form.append("arquivo", dados.arquivo);

  const res = await fetch(`${API_BASE_URL}/exercicios/${exercicioId}/submissoes`, {
    method: "POST",
    headers: await buildAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    const message = await parseError(res);
    if (res.status === 401) {
      handleUnauthorized(message);
    }
    throw new Error(message);
  }
  return res.json() as Promise<{ message: string; submissao: Submissao }>;
}

export async function minhasSubmissoes(exercicioId: string) {
  return apiFetch<Submissao[]>(`/exercicios/${exercicioId}/minhas-submissoes`);
}

export async function todasMinhasSubmissoes() {
  return apiFetch<Submissao[]>("/minhas-submissoes");
}

export async function listarSubmissoesExercicio(exercicioId: string) {
  return apiFetch<Array<Submissao & { alunoNome: string; alunoUsuario: string }>>(
    `/exercicios/${exercicioId}/submissoes`
  );
}

export async function listarAnswersExercicio(
  exercicioId: string,
  params?: {
    page?: number;
    limit?: number;
    q?: string;
    alunoId?: number | "todos";
    status?: "todos" | "corrigida" | "pendente";
    dateFrom?: string;
    dateTo?: string;
    sort?: "recent" | "oldest" | "student";
  }
) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.q) search.set("q", params.q);
  if (params?.alunoId && params.alunoId !== "todos") search.set("alunoId", String(params.alunoId));
  if (params?.status && params.status !== "todos") search.set("status", params.status);
  if (params?.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params?.dateTo) search.set("dateTo", params.dateTo);
  if (params?.sort) search.set("sort", params.sort);
  const query = search.toString();
  return apiFetch<ExerciseAnswersResponse>(`/exercicios/${exercicioId}/answers${query ? `?${query}` : ""}`);
}

export async function listarAlunosQueResponderam(exercicioId?: string) {
  if (!exercicioId) {
    return apiFetch<{
      totalAlunos: number;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      alunos: ExerciseAnswerStudent[];
    }>("/answers/students");
  }

  return apiFetch<{
    exercicioId: number;
    totalAlunos: number;
    alunos: ExerciseAnswerStudent[];
  }>(`/exercicios/${exercicioId}/answer-students`);
}

export async function listarAlunosQueResponderamPaginado(params?: {
  q?: string;
  page?: number;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch<{
    totalAlunos: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    alunos: ExerciseAnswerStudent[];
  }>(`/answers/students${query ? `?${query}` : ""}`);
}

export async function listarExerciciosRespondidosPorAluno(
  alunoId: string | number,
  params?: { q?: string; page?: number; limit?: number }
) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch<{
    alunoId: number;
    totalExercicios: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    exercicios: AnsweredExerciseByStudent[];
  }>(`/answers/students/${alunoId}/exercises${query ? `?${query}` : ""}`);
}

export async function atualizarAnswer(
  answerId: string | number,
  dados: { answer_text?: string | null; selected_option?: number | null; is_correct?: boolean | null; feedback?: string | null }
) {
  return apiFetch<{
    message: string;
    answer: {
      id: number;
      userId: number;
      questionId: number;
      exerciseId: number;
      answerText: string | null;
      selectedOption: number | null;
      isCorrect: boolean | null;
      feedback: string | null;
      answeredAt: string | null;
    };
  }>(`/answers/${answerId}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function atualizarAnswersEmLote(dados: {
  answer_ids: number[];
  patch: { answer_text?: string | null; selected_option?: number | null; is_correct?: boolean | null; feedback?: string | null };
}) {
  return apiFetch<{
    message: string;
    updatedCount: number;
    updatedIds: number[];
    notFoundCount: number;
    notFoundIds: number[];
  }>("/answers/batch", {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function corrigirSubmissao(submissaoId: string, dados: {
  nota: number;
  feedback?: string;
}) {
  return apiFetch<{ message: string; submissao: Submissao }>(
    `/submissoes/${submissaoId}/corrigir`,
    {
      method: "PUT",
      body: JSON.stringify(dados),
    }
  );
}

export async function reordenarExercicio(id: string, direction: "up" | "down") {
  return apiFetch<{ message: string }>(`/exercicios/${id}/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ direction }),
  });
}
