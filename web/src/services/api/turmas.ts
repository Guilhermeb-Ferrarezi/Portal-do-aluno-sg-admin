import { apiFetch } from "./core";
import type { PaginatedItemsResponse } from "./core";

export type Turma = {
  id: string;
  nome: string;
  tipo: "turma" | "particular";
  categoria: "programacao" | "informatica";
  professorId: string | null;
  descricao: string | null;
  ativo: boolean;
  dataInicio?: string | null;
  duracaoSemanas?: number;
  cronogramaAtivo?: boolean;
  courseId?: string;
  currentModuleId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type TurmaAlunoPhaseStatus =
  | "nao_iniciado"
  | "em_progresso"
  | "concluido"
  | "desconhecido";

export type TurmaAluno = User & {
  faseInicialStatus?: TurmaAlunoPhaseStatus;
  faseInicialStatusLabel?: string;
  faseInicialProgress?: number;
  faseInicialUnlockedAt?: string | null;
};

export type ClassRoomStatus = "rascunho" | "aberta" | "encerrada";

export type ClassRoomExercise = {
  id: string;
  title: string;
  description: string | null;
  termAt: string | null;
  isDailyTask: boolean;
  phaseName: string | null;
};

export type ClassRoom = {
  id: string;
  turmaId: string;
  nome: string;
  createdAt: string | null;
  isAuthorized: boolean;
  targetLimited: string | null;
  status: ClassRoomStatus;
  totalExercises: number;
  exercises: ClassRoomExercise[];
};

export type ClassRoomAvailableExercise = {
  id: string;
  title: string;
  description: string | null;
  termAt: string | null;
  isDailyTask: boolean;
  phaseName: string | null;
  selected: boolean;
};

export type CronogramaSemana = {
  semana: number;
  exercicios: Array<{
    id: string;
    titulo: string;
    modulo: string;
  }>;
};

// Import User type locally to avoid circular dep
import type { User } from "./users";

export async function listarTurmas(): Promise<Turma[]>;
export async function listarTurmas(params: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedItemsResponse<Turma>>;
export async function listarTurmas(params?: {
  q?: string;
  page?: number;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch<Turma[] | PaginatedItemsResponse<Turma>>(`/turmas${query ? `?${query}` : ""}`);
}

export async function obterTurmasResponsavel() {
  return apiFetch<{ total: number }>("/turmas/meus-responsaveis/count");
}

export async function obterTotalTurmas() {
  return apiFetch<{ total: number }>("/turmas/total");
}

export async function obterContagemAlunosDashboard() {
  return apiFetch<{ total: number; totalSistema: number }>("/turmas/alunos/count");
}

export async function obterTurma(id: string) {
  return apiFetch<Turma & {
    faseInicial?: { id: string; nome: string } | null;
    alunos: TurmaAluno[];
    exercicios: Array<{ id: string; titulo: string; modulo: string }>;
  }>(`/turmas/${id}`);
}

export async function criarTurma(dados: {
  nome: string;
  tipo: "turma" | "particular";
  categoria?: "programacao" | "informatica";
  professor_id?: string | null;
  descricao?: string | null;
  data_inicio?: string | null;
  duracao_semanas?: number;
  cronograma_ativo?: boolean;
  course_id?: number;
  current_module_id?: number;
}) {
  return apiFetch<{ message: string; turma: Turma }>("/turmas", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarTurma(id: string, dados: {
  nome?: string;
  tipo?: "turma" | "particular";
  categoria?: "programacao" | "informatica";
  professor_id?: string | null;
  descricao?: string | null;
  data_inicio?: string | null;
  duracao_semanas?: number;
  cronograma_ativo?: boolean;
  course_id?: number;
  current_module_id?: number;
}) {
  return apiFetch<{ message: string; turma: Turma }>(`/turmas/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function deletarTurma(id: string) {
  return apiFetch<{ message: string }>(`/turmas/${id}`, {
    method: "DELETE",
  });
}

export async function adicionarAlunosNaTurma(turmaId: string, alunoIds: string[]) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/alunos`, {
    method: "POST",
    body: JSON.stringify({ aluno_ids: alunoIds }),
  });
}

export async function removerAlunoDaTurma(turmaId: string, alunoId: string) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/alunos/${alunoId}`, {
    method: "DELETE",
  });
}

export async function iniciarFasesNaTurma(turmaId: string, alunoIds: string[]) {
  return apiFetch<{ message: string; fase?: { id: string; nome: string } | null; totalAlunos: number }>(
    `/turmas/${turmaId}/iniciar-fases`,
    {
      method: "POST",
      body: JSON.stringify({ aluno_ids: alunoIds }),
    }
  );
}

export async function atribuirExerciciosNaTurma(turmaId: string, exercicioIds: string[]) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/exercicios`, {
    method: "POST",
    body: JSON.stringify({ exercicio_ids: exercicioIds }),
  });
}

export async function removerExercicioDaTurma(turmaId: string, exercicioId: string) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/exercicios/${exercicioId}`, {
    method: "DELETE",
  });
}

export async function configurarCronograma(turmaId: string, semanas: Array<{
  semana: number;
  exercicios: string[];
}>) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/cronograma`, {
    method: "POST",
    body: JSON.stringify({ semanas }),
  });
}

export async function obterCronograma(turmaId: string) {
  return apiFetch<{
    cronograma: Record<number, Array<{ id: string; titulo: string; modulo: string }>>;
    turma: {
      id: string;
      nome: string;
      dataInicio: string | null;
      duracaoSemanas: number;
      cronogramaAtivo: boolean;
    };
  }>(`/turmas/${turmaId}/cronograma`);
}

export async function listarSalasDaTurma(turmaId: string) {
  return apiFetch<{
    turma: { id: string; nome: string };
    items: ClassRoom[];
  }>(`/turmas/${turmaId}/salas`);
}

export async function listarExerciciosDisponiveisSala(
  turmaId: string,
  params?: { roomId?: string }
) {
  const search = new URLSearchParams();
  if (params?.roomId) search.set("roomId", params.roomId);
  const query = search.toString();
  return apiFetch<{
    turmaId: string;
    items: ClassRoomAvailableExercise[];
  }>(`/turmas/${turmaId}/salas/exercicios-disponiveis${query ? `?${query}` : ""}`);
}

export async function criarSalaDaTurma(
  turmaId: string,
  dados: {
    nome: string;
    target_limited: string;
    is_authorized: boolean;
    exercise_ids: string[];
  }
) {
  return apiFetch<{ message: string; room: Omit<ClassRoom, "exercises"> }>(
    `/turmas/${turmaId}/salas`,
    {
      method: "POST",
      body: JSON.stringify(dados),
    }
  );
}

export async function atualizarSalaDaTurma(
  turmaId: string,
  roomId: string,
  dados: {
    nome: string;
    target_limited: string;
    is_authorized: boolean;
    exercise_ids: string[];
  }
) {
  return apiFetch<{ message: string; room: Omit<ClassRoom, "exercises"> }>(
    `/turmas/${turmaId}/salas/${roomId}`,
    {
      method: "PUT",
      body: JSON.stringify(dados),
    }
  );
}

export async function atualizarStatusSalaDaTurma(
  turmaId: string,
  roomId: string,
  dados: { is_authorized: boolean }
) {
  return apiFetch<{ message: string; room: Partial<ClassRoom> }>(
    `/turmas/${turmaId}/salas/${roomId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(dados),
    }
  );
}

export async function deletarSalaDaTurma(turmaId: string, roomId: string) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/salas/${roomId}`, {
    method: "DELETE",
  });
}
