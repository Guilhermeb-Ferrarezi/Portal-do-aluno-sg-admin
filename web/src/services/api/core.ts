import { logout } from "../../auth/auth";
import { env } from "@/env";

export type UserRef = {
  id: string;
  usuario?: string;
  email?: string;
  nome?: string;
};

export const API_BASE_URL = env.apiUrl;

const AUTH_ORIGIN = "https://auth.santos-tech.com";

export function handleUnauthorized(message: string): never {
  logout();
  if (typeof window !== "undefined") {
    const redirectUrl = window.location.href;
    window.location.replace(`${AUTH_ORIGIN}?redirect=${encodeURIComponent(redirectUrl)}`);
  }
  throw new Error(message);
}

export async function buildJsonHeaders(base?: HeadersInit) {
  const headers = new Headers(base);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function buildAuthHeaders(base?: HeadersInit) {
  return new Headers(base);
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
      request.withCredentials = true;

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
    if (error.name === "UnauthorizedUploadError") {
      handleUnauthorized(error.message);
    }
    throw error;
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
    credentials: "include",
  });

  if (!res.ok) {
    const message = await parseError(res);
    if (res.status === 401) {
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
