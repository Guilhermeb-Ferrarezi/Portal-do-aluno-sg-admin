import { apiFetch, uploadFormData, type UploadOptions } from "./core";
import type { PaginatedItemsResponse } from "./core";
import type { Turma } from "./turmas";
import type { UserRef } from "./core";

export type Videoaula = {
  id: string;
  titulo: string;
  descricao: string | null;
  modulo: string;
  moduloId?: string;
  duracao: string | null;
  tipo: "youtube" | "vimeo" | "arquivo";
  url: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
  dataAdicionada?: string;
  turmas?: Turma[];
  alunos?: UserRef[];
  aluno_ids?: string[];
};

export async function listarVideoaulas(modulo?: string): Promise<Videoaula[]>;
export async function listarVideoaulas(params: {
  modulo?: string;
  q?: string;
  tipo?: "todos" | "youtube" | "vimeo" | "arquivo";
  page?: number;
  limit?: number;
}): Promise<PaginatedItemsResponse<Videoaula>>;
export async function listarVideoaulas(
  moduloOrParams?: string | {
    modulo?: string;
    q?: string;
    tipo?: "todos" | "youtube" | "vimeo" | "arquivo";
    page?: number;
    limit?: number;
  }
) {
  const params = typeof moduloOrParams === "string" ? { modulo: moduloOrParams } : (moduloOrParams ?? {});
  const search = new URLSearchParams();
  if (params.modulo) search.set("modulo", params.modulo);
  if (params.q) search.set("q", params.q);
  if (params.tipo && params.tipo !== "todos") search.set("tipo", params.tipo);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch<Videoaula[] | PaginatedItemsResponse<Videoaula>>(`/videoaulas${query ? `?${query}` : ""}`);
}

export async function obterVideoaula(id: string) {
  return apiFetch<Videoaula>(`/videoaulas/${id}`);
}

export async function criarVideoaula(dados: FormData, options?: UploadOptions) {
  return uploadFormData<{ message: string; videoaula: Videoaula }>("/videoaulas", dados, options);
}

export async function atualizarVideoaula(id: string, dados: FormData, options?: UploadOptions) {
  return uploadFormData<{ message: string; videoaula: Videoaula }>(`/videoaulas/${id}`, dados, {
    ...options,
    method: "PUT",
  });
}

export async function deletarVideoaula(id: string) {
  return apiFetch<{ message: string }>(`/videoaulas/${id}`, {
    method: "DELETE",
  });
}

export async function atribuirVideoaulaTurmas(videoaulaId: string, turmaIds: string[]) {
  return apiFetch<{ message: string }>(`/videoaulas/${videoaulaId}/turmas`, {
    method: "POST",
    body: JSON.stringify({ turma_ids: turmaIds }),
  });
}

export async function removerVideoaulaDaTurma(videoaulaId: string, turmaId: string) {
  return apiFetch<{ message: string }>(`/videoaulas/${videoaulaId}/turmas/${turmaId}`, {
    method: "DELETE",
  });
}
