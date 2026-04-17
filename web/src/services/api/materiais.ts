import { apiFetch, uploadFormData, type UploadOptions } from "./core";
import type { PaginatedItemsResponse } from "./core";
import type { Turma } from "./turmas";
import type { UserRef } from "./core";

export type Material = {
  id: string;
  titulo: string;
  tipo: "arquivo" | "link";
  modulo: string;
  descricao: string | null;
  url: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  turmas?: Turma[];
  alunos?: UserRef[];
  aluno_ids?: string[];
};

export async function listarMateriais(modulo?: string): Promise<Material[]>;
export async function listarMateriais(params: {
  modulo?: string;
  q?: string;
  tipo?: "todos" | "link" | "pdf" | "word" | "excel" | "powerpoint" | "imagem" | "texto" | "compactado" | "arquivo";
  page?: number;
  limit?: number;
}): Promise<PaginatedItemsResponse<Material>>;
export async function listarMateriais(
  moduloOrParams?: string | {
    modulo?: string;
    q?: string;
    tipo?: "todos" | "link" | "pdf" | "word" | "excel" | "powerpoint" | "imagem" | "texto" | "compactado" | "arquivo";
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
  return apiFetch<Material[] | PaginatedItemsResponse<Material>>(`/materiais${query ? `?${query}` : ""}`);
}

export async function obterMaterial(id: string) {
  return apiFetch<Material>(`/materiais/${id}`);
}

export async function criarMaterial(dados: FormData, options?: UploadOptions) {
  return uploadFormData<{ message: string; material: Material }>("/materiais", dados, options);
}

export async function atualizarMaterial(id: string, dados: FormData, options?: UploadOptions) {
  return uploadFormData<{ message: string; material: Material }>(`/materiais/${id}`, dados, {
    ...options,
    method: "PUT",
  });
}

export async function deletarMaterial(id: string) {
  return apiFetch<{ message: string }>(`/materiais/${id}`, {
    method: "DELETE",
  });
}

export async function atribuirMaterialTurmas(materialId: string, turmaIds: string[]) {
  return apiFetch<{ message: string }>(`/materiais/${materialId}/turmas`, {
    method: "POST",
    body: JSON.stringify({ turma_ids: turmaIds }),
  });
}

export async function removerMaterialDaTurma(materialId: string, turmaId: string) {
  return apiFetch<{ message: string }>(`/materiais/${materialId}/turmas/${turmaId}`, {
    method: "DELETE",
  });
}
