import { getRole as getAuthRole, type Role } from "../../auth/auth";
import { apiFetch, API_BASE_URL, buildAuthHeaders, handleUnauthorized, parseError } from "./core";
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

export async function uploadMinhaFotoPerfil(file: File) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/users/me/profile-picture`, {
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

  return res.json() as Promise<{
    message: string;
    profilePictureUrl: string;
    user: UserMe;
  }>;
}

export async function uploadMeuBannerPerfil(file: File) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/users/me/cover-picture`, {
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

  return res.json() as Promise<{
    message: string;
    coverPictureUrl: string;
    user: UserMe;
  }>;
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
