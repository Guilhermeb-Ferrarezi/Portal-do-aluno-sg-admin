import type { NextFunction, Response } from "express";
import { pool } from "../db";
import { authenticateToken, type AuthRequest, type LegacyRole } from "./auth";
import {
  hashApiTokenSecret,
  isApiTokenExpired,
  mapApiTokenRow,
  parseApiTokenValue,
  type ApiTokenDetails,
  type ApiTokenRow,
} from "../services/apiTokens";

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

export function authOrApiTokenGuard(jwtSecret: string, db: DbLike = pool) {
  return async (req: ApiTokenAuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Token ausente" });
    }

    const jwtUser = await authenticateToken(token, jwtSecret);
    if (jwtUser) {
      req.user = jwtUser;
      return next();
    }

    const apiToken = await authenticateApiToken(token, db);
    if (!apiToken) {
      return res.status(401).json({ message: "Token invalido ou expirado" });
    }

    req.apiToken = apiToken;
    return next();
  };
}

export function resolveAuthenticatedUserId(req: ApiTokenAuthRequest) {
  if (req.apiToken) return req.apiToken.userId;
  if (!req.user) return null;
  const userId = Number(req.user.sub);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export function requireApiTokenScopeIfPresent(scope: string) {
  return async (req: ApiTokenAuthRequest, res: Response, next: NextFunction) => {
    if (req.apiToken && !req.apiToken.scopes.includes(scope)) {
      return res.status(403).json({ message: "Escopo insuficiente." });
    }

    return next();
  };
}

export function requireRoleOrApiTokenScope(roles: LegacyRole[], scope: string) {
  return async (req: ApiTokenAuthRequest, res: Response, next: NextFunction) => {
    if (req.apiToken) {
      if (!req.apiToken.scopes.includes(scope)) {
        return res.status(403).json({ message: "Escopo insuficiente." });
      }
      return next();
    }

    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Sem permissao" });
    }

    return next();
  };
}
