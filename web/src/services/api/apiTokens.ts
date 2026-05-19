import { apiFetch } from "./core";

export type ApiTokenScopeItem = {
  value: string;
  label: string;
  description: string;
};

export type ApiTokenScopeGroup = {
  key: string;
  label: string;
  description: string;
  items: ApiTokenScopeItem[];
};

export type ApiTokenDetails = {
  publicId: string;
  name: string;
  description: string | null;
  scopes: string[];
  scopesDetail?: {
    values: string[];
    labels: string[];
  };
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  status: "active" | "revoked" | "expired";
};

export type ApiTokenCreatedResponse = {
  token: ApiTokenDetails;
  secret: string;
  secretHint: string;
  scopes: string[];
  scopesDetail: {
    values: string[];
    labels: string[];
  };
};

export async function listarApiTokenScopes() {
  return apiFetch<{ items: ApiTokenScopeGroup[] }>("/tokens/scopes");
}

export async function listarApiTokens() {
  return apiFetch<{ items: ApiTokenDetails[]; total: number }>("/tokens");
}

export async function criarApiToken(dados: {
  name: string;
  description?: string | null;
  scopes: string[];
  expiresAt?: string | null;
}) {
  return apiFetch<ApiTokenCreatedResponse>("/tokens", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarApiToken(
  publicId: string,
  dados: {
    name?: string;
    description?: string | null;
    scopes?: string[];
    expiresAt?: string | null;
  }
) {
  return apiFetch<{ token: ApiTokenDetails; scopesDetail: { values: string[]; labels: string[] } }>(
    `/tokens/${encodeURIComponent(publicId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(dados),
    }
  );
}

export async function revogarApiToken(publicId: string) {
  return apiFetch<{ token: ApiTokenDetails }>(`/tokens/${encodeURIComponent(publicId)}`, {
    method: "DELETE",
  });
}
