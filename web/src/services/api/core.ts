import {
  getToken,
  isTokenExpired,
  logout,
  getRefreshToken,
  setToken,
  setRefreshToken,
} from "../../auth/auth";

export type UserRef = {
  id: string;
  usuario?: string;
  email?: string;
  nome?: string;
};

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      token?: string;
      refreshToken?: string;
    };

    if (data.token) setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);

    return data.token ?? null;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function ensureAccessToken(): Promise<string | null> {
  const token = getToken();
  if (token && !isTokenExpired(token)) return token;

  const refreshed = await refreshAccessToken();
  return refreshed ?? null;
}

export function handleUnauthorized(message: string): never {
  logout();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
  throw new Error(message);
}

export async function buildJsonHeaders(base?: HeadersInit) {
  const headers = new Headers(base);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = await ensureAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export async function buildAuthHeaders(base?: HeadersInit) {
  const headers = new Headers(base);
  const token = await ensureAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export async function parseError(res: Response) {
  const data = await res.json().catch(() => null);
  return data?.message ?? `Erro ${res.status}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const headers = await buildJsonHeaders(options.headers);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const message = await parseError(res);
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed && !path.startsWith("/auth/refresh")) {
        const retryHeaders = await buildJsonHeaders(options.headers);
        const retry = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers: retryHeaders,
        });
        if (retry.ok) {
          return (await retry.json()) as T;
        }
      }
      handleUnauthorized(message);
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedItemsResponse<T> = {
  items: T[];
  total: number;
  pagination: PaginationMeta;
};
