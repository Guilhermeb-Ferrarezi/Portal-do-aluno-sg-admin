import crypto from "crypto";

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

export type ApiTokenRow = {
  public_id: string;
  user_id: number;
  name: string;
  description: string | null;
  scopes: string[] | string | null;
  expires_at: string | Date | null;
  revoked_at: string | Date | null;
  last_used_at: string | Date | null;
  created_at: string | Date;
};

export type ApiTokenDetails = {
  publicId: string;
  name: string;
  description: string | null;
  scopes: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  status: "active" | "revoked" | "expired";
};

export type IssuedApiToken = {
  token: string;
  publicId: string;
  secret: string;
  secretHash: string;
  secretHint: string;
};

export const tokenScopesCatalog: ApiTokenScopeGroup[] = [
  {
    key: "operacoes",
    label: "Operacoes",
    description: "Acesso a tarefas operacionais do portal.",
    items: [
      {
        value: "turmas:read",
        label: "Ler turmas",
        description: "Visualizar turmas e seus detalhes.",
      },
      {
        value: "turmas:write",
        label: "Editar turmas",
        description: "Criar e alterar turmas.",
      },
      {
        value: "metas:read",
        label: "Ler metas",
        description: "Visualizar metas cadastradas.",
      },
      {
        value: "metas:write",
        label: "Editar metas",
        description: "Criar e alterar metas.",
      },
      {
        value: "medalhas:read",
        label: "Ler medalhas",
        description: "Visualizar medalhas e conquistas.",
      },
      {
        value: "medalhas:write",
        label: "Editar medalhas",
        description: "Criar e alterar medalhas.",
      },
      {
        value: "ranking_notas:read",
        label: "Ler ranking de notas",
        description: "Consultar o ranking de notas.",
      },
      {
        value: "ranking_notas:write",
        label: "Editar ranking de notas",
        description: "Alterar regras e registros do ranking de notas.",
      },
      {
        value: "ranking_pontos:read",
        label: "Ler ranking de pontos",
        description: "Consultar o ranking de pontos.",
      },
      {
        value: "ranking_pontos:write",
        label: "Editar ranking de pontos",
        description: "Alterar regras e registros do ranking de pontos.",
      },
      {
        value: "eventos_ranking:read",
        label: "Ler eventos de ranking",
        description: "Consultar eventos e historico de ranking.",
      },
      {
        value: "eventos_ranking:write",
        label: "Editar eventos de ranking",
        description: "Criar ou alterar eventos de ranking.",
      },
      {
        value: "notificacoes:read",
        label: "Ler notificacoes",
        description: "Consultar notificacoes do portal.",
      },
      {
        value: "notificacoes:write",
        label: "Editar notificacoes",
        description: "Criar e alterar notificacoes.",
      },
    ],
  },
  {
    key: "conteudo",
    label: "Conteudo",
    description: "Acesso aos recursos de estrutura e materiais.",
    items: [
      {
        value: "estrutura_geral:read",
        label: "Ler estrutura geral",
        description: "Visualizar a estrutura geral do portal.",
      },
      {
        value: "estrutura_geral:write",
        label: "Editar estrutura geral",
        description: "Criar e alterar a estrutura geral do portal.",
      },
      {
        value: "materiais:read",
        label: "Ler materiais",
        description: "Consultar materiais.",
      },
      {
        value: "materiais:write",
        label: "Editar materiais",
        description: "Criar e alterar materiais.",
      },
      {
        value: "videos:read",
        label: "Ler videos",
        description: "Consultar videos.",
      },
      {
        value: "videos:write",
        label: "Editar videos",
        description: "Criar e alterar videos.",
      },
    ],
  },
  {
    key: "administracao",
    label: "Administracao",
    description: "Acesso a usuarios e auditoria.",
    items: [
      {
        value: "usuarios:read",
        label: "Ler usuarios",
        description: "Consultar usuarios do sistema.",
      },
      {
        value: "usuarios:write",
        label: "Editar usuarios",
        description: "Criar e alterar usuarios.",
      },
      {
        value: "logs:read",
        label: "Ler logs",
        description: "Visualizar logs e auditoria.",
      },
    ],
  },
];

const validScopeValues = new Set(
  tokenScopesCatalog.flatMap((group) => group.items.map((item) => item.value))
);

export function hashApiTokenSecret(secret: string) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function parseApiTokenValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("pat_")) return null;

  const payload = trimmed.slice(4);
  const separatorIndex = payload.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex >= payload.length - 1) {
    return null;
  }

  const publicId = payload.slice(0, separatorIndex).trim();
  const secret = payload.slice(separatorIndex + 1).trim();
  if (!publicId || !secret) return null;

  return { publicId, secret };
}

export function buildApiTokenValue(publicId = crypto.randomUUID()): IssuedApiToken {
  const secret = crypto.randomBytes(32).toString("base64url");
  return {
    token: `pat_${publicId}.${secret}`,
    publicId,
    secret,
    secretHash: hashApiTokenSecret(secret),
    secretHint: secret.slice(-4),
  };
}

export function normalizeApiTokenScopes(scopes: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const scope of scopes) {
    const value = scope.trim();
    if (!value) continue;
    if (!validScopeValues.has(value)) {
      throw new Error("Escopo de API token invalido.");
    }
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function expandApiTokenScopes(scopes: string[]) {
  const expanded = new Set<string>();

  for (const scope of scopes) {
    expanded.add(scope);
    if (scope.endsWith(":write")) {
      expanded.add(scope.replace(/:write$/, ":read"));
    }
  }

  return Array.from(expanded);
}

export function isValidApiTokenScope(value: string) {
  return validScopeValues.has(value);
}

export function mapApiTokenRow(row: ApiTokenRow): ApiTokenDetails {
  const scopes: unknown[] = Array.isArray(row.scopes)
    ? row.scopes
    : typeof row.scopes === "string"
      ? (JSON.parse(row.scopes) as unknown[])
      : [];

  const createdAt = new Date(row.created_at);
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const revokedAt = row.revoked_at ? new Date(row.revoked_at) : null;
  const lastUsedAt = row.last_used_at ? new Date(row.last_used_at) : null;
  const isExpired = Boolean(expiresAt && expiresAt.getTime() < Date.now());
  const status = revokedAt ? "revoked" : isExpired ? "expired" : "active";

  return {
    publicId: row.public_id,
    name: row.name,
    description: row.description,
    scopes: scopes.filter((scope): scope is string => typeof scope === "string"),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    revokedAt: revokedAt ? revokedAt.toISOString() : null,
    lastUsedAt: lastUsedAt ? lastUsedAt.toISOString() : null,
    createdAt: createdAt.toISOString(),
    status,
  };
}

export function isApiTokenExpired(expiresAt: string | Date | null) {
  if (!expiresAt) return false;
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
}

export function buildApiTokenScopeLabels(scopes: string[]) {
  const labels = scopes
    .map((scope) => {
      for (const group of tokenScopesCatalog) {
        const found = group.items.find((item) => item.value === scope);
        if (found) return found.label;
      }
      return scope;
    })
    .filter(Boolean);

  return labels;
}
