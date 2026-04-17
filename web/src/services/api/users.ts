import { getRole as getAuthRole, type Role } from "../../auth/auth";
import { apiFetch, uploadFormData, type UploadOptions } from "./core";
import type { PaginatedItemsResponse } from "./core";

export type User = {
  id: string;
  email?: string;
  usuario?: string;
  nome: string;
  bio?: string | null;
  profilePictureUrl?: string | null;
  coverPictureUrl?: string | null;
  role: Role;
  lastSeenAt?: string | null;
  isOnline?: boolean;
};

export type UserMe = User & {
  ativo: boolean;
  createdAt: string;
};

export async function obterUsuarioAtual() {
  return apiFetch<UserMe>("/users/me");
}

export async function atualizarMeuPerfil(dados: {
  nome?: string;
  bio?: string;
  profilePictureUrl?: string;
  coverPictureUrl?: string;
}) {
  return apiFetch<{ message: string; user: UserMe }>("/users/me", {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function uploadMinhaFotoPerfil(file: File, options?: UploadOptions) {
  const form = new FormData();
  form.append("file", file);

  return uploadFormData<{
    message: string;
    profilePictureUrl: string;
    user: UserMe;
  }>("/users/me/profile-picture", form, options);
}

export async function uploadMeuBannerPerfil(file: File, options?: UploadOptions) {
  const form = new FormData();
  form.append("file", file);

  return uploadFormData<{
    message: string;
    coverPictureUrl: string;
    user: UserMe;
  }>("/users/me/cover-picture", form, options);
}

export async function alterarMinhaSenha(dados: { senhaAtual: string; novaSenha: string }) {
  return apiFetch<{ message: string }>("/users/me/password", {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function listarProfessores() {
  return apiFetch<User[]>("/users?role=professor");
}

export async function listarAlunos() {
  return apiFetch<User[]>("/users?role=aluno");
}

export async function listarAdmins() {
  return apiFetch<User[]>("/users?role=admin");
}

export async function listarUsuariosPaginado(params?: {
  role?: "admin" | "professor" | "aluno";
  q?: string;
  page?: number;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.role) search.set("role", params.role);
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch<PaginatedItemsResponse<User>>(`/users${query ? `?${query}` : ""}`);
}

export async function atualizarUsuario(
  id: string,
  dados: { nome?: string; email?: string; usuario?: string; role?: Role; ativo?: boolean }
) {
  const payload = {
    ...dados,
    usuario: dados.email ?? dados.usuario,
  };
  return apiFetch<{ message: string; user: UserMe }>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deletarUsuario(id: string) {
  return apiFetch<{ message: string }>(`/users/${id}`, {
    method: "DELETE",
  });
}

export function getRole(): Role | null {
  return getAuthRole();
}
