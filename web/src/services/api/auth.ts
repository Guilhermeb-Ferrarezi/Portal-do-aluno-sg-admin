import { getRefreshToken, logout } from "../../auth/auth";
import { apiFetch, API_BASE_URL, parseError } from "./core";

type Role = "admin" | "professor" | "aluno";
type ApiRole = Role | 1 | 2 | 3;

export async function login(dados: { usuario: string; senha: string }) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    message: string;
    token: string;
    refreshToken: string;
    user: { id: string; usuario?: string; email?: string; nome: string; role: ApiRole };
  }>;
}

export async function logoutWithServer() {
  const refreshToken = getRefreshToken();
  logout();
  if (!refreshToken) return;

  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // best-effort revoke
  }
}

export async function createPresenceSocketTicket() {
  return apiFetch<{ ok: boolean; ticket: string; expiresAt: string }>(
    "/presence/socket-ticket",
    {
      method: "POST",
    }
  );
}

export async function startStudentViewSso() {
  return apiFetch<{ redirectUrl: string; expiresAt: string }>(
    "/auth/student-view/start",
    {
      method: "POST",
    }
  );
}
