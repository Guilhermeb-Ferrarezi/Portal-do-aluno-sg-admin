import crypto from "crypto";
import type { AuthUser } from "../middlewares/auth";
import { pool } from "../db";
import { hashApiTokenSecret, parseApiTokenValue } from "./apiTokens";

type DbLike = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{
    rowCount?: number | null;
    rows: T[];
  }>;
};

type CodexTokenRow = {
  public_id: string;
  user_id: number;
  name: string;
  description: string | null;
  scopes: string[] | string | null;
  kind?: string | null;
  codex_version?: number | null;
  token_hash?: string | null;
  expires_at: string | Date | null;
  revoked_at: string | Date | null;
  last_used_at: string | Date | null;
  created_at: string | Date;
};

type UserRow = {
  id: number;
  email: string;
  name: string;
  role: number;
};

function resolveTokenSeed() {
  const seed = process.env.CODEX_API_TOKEN_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (!seed) {
    throw new Error("JWT_SECRET ausente para gerar token do Codex.");
  }
  return seed;
}

function toAuthUser(row: UserRow): AuthUser {
  const issuedAt = Math.floor(Date.now() / 1000);
  const role = (Math.min(row.role, 4) as 1 | 2 | 3 | 4);

  return {
    id: String(row.id),
    email: row.email,
    username: null,
    name: row.name,
    role,
    customRoleId: null,
    avatarUrl: null,
    suspendedAt: null,
    sub: String(row.id),
    usuario: row.email,
    roleId: (Math.min(row.role, 3) as 1 | 2 | 3),
    iat: issuedAt,
    exp: issuedAt + 60 * 60 * 24,
  };
}

function deriveCodexSecret(publicId: string, userId: number, version: number, seed = resolveTokenSeed()) {
  return crypto
    .createHmac("sha256", seed)
    .update(`codex:${publicId}:${userId}:${version}`)
    .digest("base64url");
}

function buildCodexToken(publicId: string, userId: number, version: number) {
  const secret = deriveCodexSecret(publicId, userId, version);
  return {
    token: `pat_${publicId}.${secret}`,
    publicId,
    secret,
    secretHash: hashApiTokenSecret(secret),
    secretHint: secret.slice(-4),
    version,
  };
}

export function buildCodexApiTokenValue(publicId: string, userId: number, version = 1) {
  return buildCodexToken(publicId, userId, version);
}

export async function ensureCodexApiToken(db: DbLike = pool, userId: number) {
  const existing = await db.query<CodexTokenRow>(
    `SELECT public_id, user_id, name, description, scopes, kind, codex_version, token_hash, expires_at, revoked_at, last_used_at, created_at
     FROM api_tokens
     WHERE user_id = $1
       AND COALESCE(kind, 'integration') = 'codex'
     LIMIT 1`,
    [userId]
  );

  const row = existing.rows[0];
  if (row) {
    if (row.revoked_at) {
      throw new Error("Token Codex revogado. Peça para criar um novo login do Codex.");
    }

    const version = Number.isFinite(Number(row.codex_version)) && Number(row.codex_version) > 0
      ? Math.floor(Number(row.codex_version))
      : 1;
    return buildCodexToken(row.public_id, row.user_id, version);
  }

  const publicId = crypto.randomUUID();
  const version = 1;
  const issued = buildCodexToken(publicId, userId, version);
  const inserted = await db.query<CodexTokenRow>(
    `INSERT INTO api_tokens
       (public_id, user_id, name, description, scopes, token_hash, expires_at, revoked_at, last_used_at, created_at, kind, codex_version)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, NULL, NULL, NULL, NOW(), 'codex', $7)
     RETURNING public_id, user_id, name, description, scopes, kind, codex_version, token_hash, expires_at, revoked_at, last_used_at, created_at`,
    [
      publicId,
      userId,
      "Codex interno",
      "Token interno gerenciado pelo chat de IA.",
      JSON.stringify([]),
      issued.secretHash,
      version,
    ]
  );

  const created = inserted.rows[0];
  if (!created) {
    throw new Error("Nao foi possivel criar o token do Codex.");
  }

  return buildCodexToken(created.public_id, created.user_id, version);
}

export async function authenticateCodexPortalToken(token: string, db: DbLike = pool): Promise<AuthUser | null> {
  const parsed = parseApiTokenValue(token);
  if (!parsed) return null;

  const result = await db.query<CodexTokenRow>(
    `SELECT public_id, user_id, name, description, scopes, kind, codex_version, token_hash, expires_at, revoked_at, last_used_at, created_at
     FROM api_tokens
     WHERE public_id = $1
       AND COALESCE(kind, 'integration') = 'codex'
     LIMIT 1`,
    [parsed.publicId]
  );

  const row = result.rows[0];
  if (!row) return null;
  if (row.revoked_at) return null;

  const version = Number.isFinite(Number(row.codex_version)) && Number(row.codex_version) > 0
    ? Math.floor(Number(row.codex_version))
    : 1;
  const expectedSecret = deriveCodexSecret(row.public_id, row.user_id, version);
  const expectedHash = hashApiTokenSecret(expectedSecret);
  if (hashApiTokenSecret(parsed.secret) !== expectedHash) {
    return null;
  }

  await db.query(`UPDATE api_tokens SET last_used_at = NOW() WHERE public_id = $1`, [parsed.publicId]);

  const userResult = await db.query<UserRow>(
    `SELECT id, email, name, role
     FROM "user"
     WHERE id = $1
     LIMIT 1`,
    [row.user_id]
  );

  const user = userResult.rows[0];
  if (!user) return null;

  return toAuthUser(user);
}
