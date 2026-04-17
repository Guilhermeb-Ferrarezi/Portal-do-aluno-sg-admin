import {
  getToken,
  isTokenExpired,
  logout,
  getRefreshToken,
  setToken,
  setRefreshToken,
} from "../../auth/auth";
import { env } from "@/env";
import { appRoutes } from "@/router/routes";

export type UserRef = {
  id: string;
  usuario?: string;
  email?: string;
  nome?: string;
};

export const API_BASE_URL = env.apiUrl;

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
  if (typeof window !== "undefined" && window.location.pathname !== appRoutes.login) {
    window.location.assign(appRoutes.login);
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

export type UploadProgress = {
  loaded: number;
  total: number | null;
  percent: number | null;
};

export type UploadOptions = {
  method?: "POST" | "PUT" | "PATCH";
  headers?: HeadersInit;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

export async function uploadFormData<T>(path: string, body: FormData, options: UploadOptions = {}) {
  const headers = await buildAuthHeaders(options.headers);
  const method = options.method ?? "POST";

  const executeRequest = () =>
    new Promise<T>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(method, `${API_BASE_URL}${path}`);

      headers.forEach((value, key) => {
        request.setRequestHeader(key, value);
      });

      if (options.signal) {
        if (options.signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }

        const abortRequest = () => request.abort();
        options.signal.addEventListener("abort", abortRequest, { once: true });
        request.addEventListener(
          "loadend",
          () => options.signal?.removeEventListener("abort", abortRequest),
          { once: true }
        );
      }

      request.upload.addEventListener("progress", (event) => {
        options.onProgress?.({
          loaded: event.loaded,
          total: event.lengthComputable ? event.total : null,
          percent: event.lengthComputable && event.total > 0 ? Math.round((event.loaded / event.total) * 100) : null,
        });
      });

      request.addEventListener("error", () => {
        reject(new Error("Erro de rede durante o upload"));
      });

      request.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });

      request.addEventListener("load", () => {
        const status = request.status;
        const rawText = request.responseText;
        const parsed = rawText ? JSON.parse(rawText) : null;

        if (status >= 200 && status < 300) {
          resolve(parsed as T);
          return;
        }

        const message = parsed?.message ?? `Erro ${status}`;
        if (status === 401) {
          const unauthorizedError = Object.assign(new Error(message), {
            name: "UnauthorizedUploadError",
          });
          reject(unauthorizedError);
          return;
        }

        reject(new Error(message));
      });

      request.send(body);
    });

  try {
    return await executeRequest();
  } catch (error) {
    if (!(error instanceof Error) || error.name === "AbortError") {
      throw error;
    }

    const shouldRetryUnauthorized = /401/.test(error.message);
    if (!shouldRetryUnauthorized || path.startsWith("/auth/refresh")) {
      throw error;
    }

    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      handleUnauthorized(error.message);
    }

    return executeRequest();
  }
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
