export type Role = "admin" | "professor" | "aluno";
type NumericRole = 1 | 2 | 3;

type TokenPayload = {
  sub?: string;
  usuario?: string;
  role?: Role | NumericRole | string | number;
  iat?: number;
  exp?: number;
};

const AUTH_CHANGED_EVENT = "auth-changed";

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem("refreshToken");
}

export function setRefreshToken(token: string) {
  localStorage.setItem("refreshToken", token);
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function parseTokenPayload(token: string): TokenPayload | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload));
  } catch {
    return null;
  }
}

export function normalizeRole(input: unknown): Role | null {
  if (input === "admin" || input === 3 || input === "3") return "admin";
  if (input === "professor" || input === 2 || input === "2") return "professor";
  if (input === "aluno" || input === 1 || input === "1") return "aluno";
  return null;
}

export function getTokenExpiryMs(token: string | null = getToken()): number | null {
  if (!token) return null;
  const payload = parseTokenPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp * 1000;
}

export function isTokenExpired(token: string | null = getToken(), now = Date.now()): boolean {
  const exp = getTokenExpiryMs(token);
  if (!exp) return false;
  return exp <= now;
}

export function onAuthChanged(handler: () => void) {
  const listener = () => handler();
  if (typeof window !== "undefined") {
    window.addEventListener(AUTH_CHANGED_EVENT, listener);
  }
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(AUTH_CHANGED_EVENT, listener);
    }
  };
}

export function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export function getUserId(): string | null {
  const token = getToken();
  if (!token) return null;

  const decoded = parseTokenPayload(token);
  return typeof decoded?.sub === "string" ? decoded.sub : null;
}

export function getRole(): Role | null {
  // compat: remove role legado de versões antigas que persistiam isso no localStorage
  localStorage.removeItem("role");

  const token = getToken();
  if (!token) return null;

  const decoded = parseTokenPayload(token);
  return normalizeRole(decoded?.role);
}

export function getName(): string | null {
  const n = localStorage.getItem("nome");
  return n && n.trim().length > 0 ? n : null;
}

export function isLoggedIn(): boolean {
  const token = getToken();
  if (token && token.length > 10 && !isTokenExpired(token)) return true;
  return !!getRefreshToken();
}

export function hasRole(allowed: Role[]): boolean {
  const role = getRole();
  return !!role && allowed.includes(role);
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("nome");
  localStorage.removeItem("role");
  notifyAuthChanged();
}
