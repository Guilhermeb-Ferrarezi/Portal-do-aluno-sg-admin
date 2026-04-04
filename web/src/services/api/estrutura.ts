import { apiFetch } from "./core";
import type { PaginatedItemsResponse } from "./core";

export type Modulo = {
  id: string;
  nome: string;
  courseId: string;
  indexOrder: number;
  descricao?: string | null;
};

export type Curso = {
  id: string;
  nome: string;
  descricao?: string | null;
  isPaid?: boolean;
  durationHours?: number | null;
  level?: string | null;
  focus?: string | null;
  price?: number | null;
};

export type Fase = {
  id: string;
  moduleId: string;
  nome: string;
  weekNumber: number;
  indexOrder: number;
  adminAuthorize: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ExercicioFase = {
  id: string;
  titulo: string;
  descricao: string;
  indexOrder: number;
  difficulty: number | null;
  typeExercise: number | null;
  isDailyTask: boolean;
  phaseId: string;
  createdAt: string;
  updatedAt: string;
};

export type ContainerGroup = {
  name: string;
  phaseId: string;
  containerDateTargetInt: number | null;
  isDailyTask: boolean;
  exercises: Array<{
    id: string;
    containerTaskId: string;
    title: string;
    description: string | null;
    indexOrder: number | null;
  }>;
};

export type ContainerExerciseInfo = {
  name: string;
  containerDateTargetInt: number | null;
  phaseId: string;
};

export async function listarModulos() {
  return apiFetch<Modulo[]>("/modules");
}

export async function obterEstruturaStats() {
  return apiFetch<{ cursos: number; modulos: number; fases: number }>("/estrutura/stats");
}

export async function listarCursos(): Promise<Curso[]>;
export async function listarCursos(params: {
  q?: string;
  page?: number;
  limit?: number;
  isPaid?: boolean;
}): Promise<PaginatedItemsResponse<Curso>>;
export async function listarCursos(params?: {
  q?: string;
  page?: number;
  limit?: number;
  isPaid?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (typeof params?.isPaid === "boolean") search.set("isPaid", String(params.isPaid));
  const query = search.toString();
  return apiFetch<Curso[] | PaginatedItemsResponse<Curso>>(`/courses${query ? `?${query}` : ""}`);
}

export async function criarCurso(dados: {
  nome: string;
  descricao?: string | null;
  is_paid?: boolean;
  duration_hours?: number | null;
  level?: string | null;
  focus?: string | null;
  price?: number | null;
}) {
  return apiFetch<{ message: string; curso: Curso }>("/courses", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function deletarCurso(id: string) {
  return apiFetch<{ message: string }>(`/courses/${id}`, {
    method: "DELETE",
  });
}

export async function listarModulosPorCurso(courseId: string): Promise<Modulo[]>;
export async function listarModulosPorCurso(courseId: string, params: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedItemsResponse<Modulo>>;
export async function listarModulosPorCurso(courseId: string, params?: {
  q?: string;
  page?: number;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch<Modulo[] | PaginatedItemsResponse<Modulo>>(
    `/courses/${courseId}/modules${query ? `?${query}` : ""}`
  );
}

export async function criarModulo(dados: {
  nome: string;
  descricao?: string | null;
  course_id: number;
  index_order?: number;
}) {
  return apiFetch<{ message: string; modulo: Modulo }>("/modules", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function deletarModulo(id: string) {
  return apiFetch<{ message: string }>(`/modules/${id}`, {
    method: "DELETE",
  });
}

export async function reordenarModulo(id: string, direction: "up" | "down") {
  return apiFetch<{ message: string }>(`/modules/${id}/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ direction }),
  });
}

export async function listarFasesDoModulo(moduleId: string): Promise<Fase[]>;
export async function listarFasesDoModulo(moduleId: string, params: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedItemsResponse<Fase>>;
export async function listarFasesDoModulo(moduleId: string, params?: {
  q?: string;
  page?: number;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch<Fase[] | PaginatedItemsResponse<Fase>>(
    `/modules/${moduleId}/phases${query ? `?${query}` : ""}`
  );
}

export async function criarFase(moduleId: string, dados: {
  nome: string;
  week_number?: number;
  index_order?: number;
  admin_authorize?: boolean;
}) {
  return apiFetch<{ message: string; fase: Fase }>(`/modules/${moduleId}/phases`, {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function deletarFase(id: string) {
  return apiFetch<{ message: string }>(`/phases/${id}`, {
    method: "DELETE",
  });
}

export async function reordenarFase(id: string, direction: "up" | "down") {
  return apiFetch<{ message: string }>(`/phases/${id}/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ direction }),
  });
}

export async function listarExerciciosPorFase(
  phaseId: string,
  options: { difficulty?: number } = {}
) {
  const params = new URLSearchParams();
  if (options.difficulty != null) {
    params.set("difficulty", String(options.difficulty));
  }

  const query = params.toString();
  return apiFetch<ExercicioFase[]>(`/exercicios/by-phase/${phaseId}${query ? `?${query}` : ""}`);
}

export async function listarContainersPorFase(phaseId: string) {
  return apiFetch<ContainerGroup[]>(`/containers/by-phase/${phaseId}`);
}

export async function criarContainer(dados: {
  name: string;
  phase_id: number;
  exercise_ids: number[];
  is_daily_task?: boolean;
  container_date_target_int?: number | null;
}) {
  return apiFetch<{ message: string; count: number }>("/containers", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function deletarContainerGroup(dados: {
  name: string;
  phase_id: number;
  container_date_target_int: number | null;
  is_daily_task: boolean;
}) {
  return apiFetch<{ message: string; deleted: number }>("/containers/group", {
    method: "DELETE",
    body: JSON.stringify(dados),
  });
}

export async function adicionarExerciciosAoContainer(dados: {
  name: string;
  phase_id: number;
  container_date_target_int: number | null;
  is_daily_task: boolean;
  exercise_ids: number[];
}) {
  return apiFetch<{ message: string; count: number }>("/containers/group/add-exercises", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function removerExercicioDoContainer(containerTaskId: string) {
  return apiFetch<{ message: string }>(`/containers/${containerTaskId}`, {
    method: "DELETE",
  });
}
