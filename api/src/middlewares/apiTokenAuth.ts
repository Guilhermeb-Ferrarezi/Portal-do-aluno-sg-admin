import type { NextFunction, Response } from "express";
import { pool } from "../db";
import { authGuard, type AuthRequest, type SantosUser } from "./auth";
type LegacyRole = "aluno" | "professor" | "admin";
import {
  hashApiTokenSecret,
  isApiTokenExpired,
  mapApiTokenRow,
  parseApiTokenValue,
  type ApiTokenDetails,
  type ApiTokenRow,
} from "../services/apiTokens";
import { authenticateCodexPortalToken } from "../services/codexTokens";

export type ApiTokenContext = ApiTokenDetails & {
  userId: number;
};

export type ApiTokenAuthRequest = AuthRequest & {
  apiToken?: ApiTokenContext;
};

type DbLike = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{
    rowCount?: number | null;
    rows: T[];
  }>;
};

async function authenticateApiToken(
  token: string,
  db: DbLike
): Promise<ApiTokenContext | null> {
  const parsed = parseApiTokenValue(token);
  if (!parsed) return null;

  const result = await db.query<ApiTokenRow>(
    `SELECT public_id, user_id, name, description, scopes, expires_at, revoked_at, last_used_at, created_at, token_hash
     FROM api_tokens
     WHERE public_id = $1
       AND COALESCE(kind, 'integration') <> 'codex'
     LIMIT 1`,
    [parsed.publicId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const hashedSecret = hashApiTokenSecret(parsed.secret);
  const rowTokenHash = (row as ApiTokenRow & { token_hash?: string | null }).token_hash;
  if (!rowTokenHash || rowTokenHash !== hashedSecret) return null;
  if (row.revoked_at) return null;
  if (isApiTokenExpired(row.expires_at)) return null;

  await db.query(`UPDATE api_tokens SET last_used_at = NOW() WHERE public_id = $1`, [
    parsed.publicId,
  ]);

  const normalized = mapApiTokenRow(row);
  return {
    ...normalized,
    userId: row.user_id,
  };
}

const LEGACY_ROLE_MAP: Record<LegacyRole, number> = { aluno: 1, professor: 2, admin: 3 };

export function authOrApiTokenGuard(jwtSecret: string, db: DbLike = pool) {
  const santosGuard = authGuard(jwtSecret);

  return async (req: ApiTokenAuthRequest, res: Response, next: NextFunction) => {
    // 1. Cookie de sessão (novo auth centralizado) — takes priority
    if (req.cookies?.access_token) {
      return santosGuard(req, res, next);
    }

    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ code: "UNAUTHORIZED", message: "Não autenticado" });

    // 2. API token — check format first (O(1), no DB hit for non-matching tokens)
    const parsed = parseApiTokenValue(token);
    if (parsed) {
      const apiToken = await authenticateApiToken(token, db);
      if (!apiToken) return res.status(401).json({ code: "UNAUTHORIZED", message: "Token inválido ou expirado" });
      req.apiToken = apiToken;
      return next();
    }

    // 3. Bearer JWT do Santos auth (mobile / SSR) — falls through to santosGuard
    return santosGuard(req, res, next);
  };
}

export function resolveAuthenticatedUserId(req: ApiTokenAuthRequest) {
  if (req.apiToken) return req.apiToken.userId;
  if (!req.user) return null;
  return req.user.id; // UUID do novo auth
}

export function requireApiTokenScopeIfPresent(scope: string) {
  return async (req: ApiTokenAuthRequest, res: Response, next: NextFunction) => {
    if (req.apiToken && !req.apiToken.scopes.includes(scope)) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Escopo insuficiente" });
    }
    return next();
  };
}

export function requireRoleOrApiTokenScope(roles: LegacyRole[], scope: string) {
  return async (req: ApiTokenAuthRequest, res: Response, next: NextFunction) => {
    if (req.apiToken) {
      if (!req.apiToken.scopes.includes(scope)) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Escopo insuficiente" });
      }
      return next();
    }

    if (!req.user) return res.status(401).json({ code: "UNAUTHORIZED", message: "Não autenticado" });

    // Admin passa tudo
    if (req.user.role === 3) return next();

    const allowedNums = roles.map((r) => LEGACY_ROLE_MAP[r]);
    if (!allowedNums.includes(req.user.role)) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Sem permissão" });
    }

    return next();
  };
}
