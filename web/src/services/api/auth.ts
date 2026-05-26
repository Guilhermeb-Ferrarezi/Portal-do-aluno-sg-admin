import { logout } from "../../auth/auth";
import { apiFetch, API_BASE_URL, parseError } from "./core";

const AUTH_ORIGIN = "https://auth.santos-tech.com";
const CENTRAL_AUTH_URL = "https://api.santos-tech.com";

export async function logoutWithServer() {
  logout();
  try {
    await fetch(`${CENTRAL_AUTH_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // best-effort
  }
  window.location.replace(AUTH_ORIGIN);
}

export async function createPresenceSocketTicket() {
  return apiFetch<{ ok: boolean; ticket: string; expiresAt: string }>(
    "/presence/socket-ticket",
    { method: "POST" }
  );
}

export async function startStudentViewSso(returnTo?: string) {
  return apiFetch<{ redirectUrl: string; expiresAt: string }>(
    "/auth/student-view/start",
    {
      method: "POST",
      body: JSON.stringify(returnTo ? { returnTo } : {}),
    }
  );
}

export async function login(_dados: { usuario: string; senha: string }): Promise<never> {
  window.location.replace(AUTH_ORIGIN);
  throw new Error("redirecting");
}

export async function solicitarRecuperacaoSenha(dados: { usuario: string }) {
  const res = await fetch(`${API_BASE_URL}/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ message: string; expiresAt?: string }>;
}

export async function validarTokenRecuperacaoSenha(token: string) {
  const searchParams = new URLSearchParams({ token });
  const res = await fetch(`${API_BASE_URL}/auth/password-reset/validate?${searchParams.toString()}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ valid: true; email: string; expiresAt: string }>;
}

export async function redefinirSenha(dados: { token: string; novaSenha: string }) {
  const res = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ message: string }>;
}
