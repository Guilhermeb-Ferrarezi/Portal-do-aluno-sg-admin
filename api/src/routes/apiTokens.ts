import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authGuard, type AuthRequest } from "../middlewares/auth";
import { authOrApiTokenGuard, resolveAuthenticatedUserId, type ApiTokenAuthRequest } from "../middlewares/apiTokenAuth";
import {
  buildApiTokenScopeLabels,
  buildApiTokenValue,
  expandApiTokenScopes,
  mapApiTokenRow,
  normalizeApiTokenScopes,
  tokenScopesCatalog,
  type ApiTokenRow,
} from "../services/apiTokens";

type DbLike = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{
    rowCount?: number | null;
    rows: T[];
  }>;
};

const createTokenSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatorio").max(120, "Nome muito longo"),
  description: z.string().trim().max(300, "Descricao muito longa").nullable().optional(),
  scopes: z.array(z.string().trim()).default([]),
  expiresAt: z.string().datetime().nullable().optional(),
});

const updateTokenSchema = createTokenSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "Nenhum dado para atualizar.",
  }
);

function resolveExpiresAt(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data de expiracao invalida.");
  }
  return parsed.toISOString();
}

function mapScopesForResponse(scopes: string[]) {
  const labels = buildApiTokenScopeLabels(scopes);
  return {
    values: scopes,
    labels,
  };
}

function mapTokenRow(row: ApiTokenRow) {
  const token = mapApiTokenRow(row);
  return {
    ...token,
    scopesDetail: mapScopesForResponse(token.scopes),
  };
}

function buildTokenQueryResultRows(rows: ApiTokenRow[]) {
  return rows.map((row) => mapTokenRow(row));
}

export function apiTokensRouter(
  jwtSecret: string,
  options?: {
    db?: DbLike;
  }
) {
  const router = Router();
  const db = options?.db ?? pool;

  router.get("/tokens/scopes", authGuard(jwtSecret), (_req, res) => {
    return res.json({
      items: tokenScopesCatalog,
    });
  });

  router.get("/tokens", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const userId = Number(req.user!.sub);
    const result = await db.query<ApiTokenRow>(
      `SELECT public_id, user_id, name, description, scopes, expires_at, revoked_at, last_used_at, created_at
       FROM api_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      items: buildTokenQueryResultRows(result.rows),
      total: result.rowCount ?? result.rows.length,
    });
  });

  router.post("/tokens", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const parsed = createTokenSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "Requisicao invalida.",
      });
    }

    let scopes: string[];
    try {
      scopes = expandApiTokenScopes(normalizeApiTokenScopes(parsed.data.scopes));
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Escopos invalidos.",
      });
    }

    if (scopes.length === 0) {
      return res.status(400).json({
        message: "Selecione ao menos um escopo.",
      });
    }

    let expiresAt: string | null | undefined;
    try {
      expiresAt = resolveExpiresAt(parsed.data.expiresAt);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Data de expiracao invalida.",
      });
    }

    const userId = Number(req.user!.sub);
    const issued = buildApiTokenValue();

    const result = await db.query<ApiTokenRow>(
      `INSERT INTO api_tokens
         (public_id, user_id, name, description, scopes, token_hash, expires_at, created_at, revoked_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW(), NULL, NULL)
       RETURNING public_id, user_id, name, description, scopes, expires_at, revoked_at, last_used_at, created_at`,
      [
        issued.publicId,
        userId,
        parsed.data.name,
        parsed.data.description?.trim() || null,
        JSON.stringify(scopes),
        issued.secretHash,
        expiresAt,
      ]
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(500).json({ message: "Nao foi possivel criar o token." });
    }

    return res.status(201).json({
      token: mapTokenRow(row),
      secret: issued.token,
      secretHint: issued.secretHint,
      scopes: scopes,
      scopesDetail: mapScopesForResponse(scopes),
    });
  });

  router.patch("/tokens/:publicId", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const publicId = String(req.params.publicId ?? "").trim();
    if (!publicId) {
      return res.status(400).json({ message: "Token invalido." });
    }

    const parsed = updateTokenSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "Requisicao invalida.",
      });
    }

    let scopes: string[] | undefined;
    if (parsed.data.scopes) {
      try {
        scopes = expandApiTokenScopes(normalizeApiTokenScopes(parsed.data.scopes));
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Escopos invalidos.",
        });
      }

      if (scopes.length === 0) {
        return res.status(400).json({
          message: "Selecione ao menos um escopo.",
        });
      }
    }

    let expiresAt: string | null | undefined;
    if (parsed.data.expiresAt !== undefined) {
      try {
        expiresAt = resolveExpiresAt(parsed.data.expiresAt);
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Data de expiracao invalida.",
        });
      }
    }

    const currentUserId = Number(req.user!.sub);
    const existing = await db.query<ApiTokenRow & { token_hash?: string | null }>(
      `SELECT public_id, user_id, name, description, scopes, expires_at, revoked_at, last_used_at, created_at, token_hash
       FROM api_tokens
       WHERE public_id = $1 AND user_id = $2
       LIMIT 1`,
      [publicId, currentUserId]
    );

    const existingRow = existing.rows[0];
    if (!existingRow) {
      return res.status(404).json({ message: "Token nao encontrado." });
    }

    if (existingRow.revoked_at) {
      return res.status(409).json({ message: "Token revogado nao pode ser alterado." });
    }

    const nextName = parsed.data.name?.trim() ?? existingRow.name;
    const nextDescription =
      parsed.data.description !== undefined
        ? parsed.data.description?.trim() || null
        : existingRow.description;
    const nextScopes = scopes ?? (Array.isArray(existingRow.scopes) ? existingRow.scopes : JSON.parse(String(existingRow.scopes ?? "[]")));
    const nextExpiresAt = expiresAt === undefined ? existingRow.expires_at : expiresAt;

    const updated = await db.query<ApiTokenRow>(
      `UPDATE api_tokens
       SET name = $1,
           description = $2,
           scopes = $3::jsonb,
           expires_at = $4
       WHERE public_id = $5 AND user_id = $6
       RETURNING public_id, user_id, name, description, scopes, expires_at, revoked_at, last_used_at, created_at`,
      [
        nextName,
        nextDescription,
        JSON.stringify(nextScopes),
        nextExpiresAt === undefined ? null : nextExpiresAt,
        publicId,
        currentUserId,
      ]
    );

    const updatedRow = updated.rows[0];
    if (!updatedRow) {
      return res.status(500).json({ message: "Nao foi possivel atualizar o token." });
    }

    return res.json({
      token: mapTokenRow(updatedRow),
      scopesDetail: mapScopesForResponse(mapApiTokenRow(updatedRow).scopes),
    });
  });

  router.delete("/tokens/:publicId", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const publicId = String(req.params.publicId ?? "").trim();
    if (!publicId) {
      return res.status(400).json({ message: "Token invalido." });
    }

    const currentUserId = Number(req.user!.sub);
    const existing = await db.query<ApiTokenRow>(
      `SELECT public_id, user_id, name, description, scopes, expires_at, revoked_at, last_used_at, created_at
       FROM api_tokens
       WHERE public_id = $1 AND user_id = $2
       LIMIT 1`,
      [publicId, currentUserId]
    );

    const existingRow = existing.rows[0];
    if (!existingRow) {
      return res.status(404).json({ message: "Token nao encontrado." });
    }

    const updated = await db.query<ApiTokenRow>(
      `UPDATE api_tokens
       SET revoked_at = NOW()
       WHERE public_id = $1 AND user_id = $2
       RETURNING public_id, user_id, name, description, scopes, expires_at, revoked_at, last_used_at, created_at`,
      [publicId, currentUserId]
    );

    const updatedRow = updated.rows[0];
    if (!updatedRow) {
      return res.status(500).json({ message: "Nao foi possivel revogar o token." });
    }

    return res.json({
      token: mapTokenRow(updatedRow),
    });
  });

  router.get(
    "/tokens/self",
    authOrApiTokenGuard(jwtSecret, db),
    async (req: ApiTokenAuthRequest, res) => {
      const userId = resolveAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Token ausente" });
      }

      if (req.apiToken && !req.apiToken.scopes.includes("usuarios:read")) {
        return res.status(403).json({ message: "Escopo insuficiente." });
      }

      const result = await db.query<{ id: number; name: string; email: string; role: number }>(
        `SELECT id, name, email, role
         FROM "user"
         WHERE id = $1
         LIMIT 1`,
        [userId]
      );

      const row = result.rows[0];
      if (!row) {
        return res.status(404).json({ message: "Usuario nao encontrado." });
      }

      return res.json({
        user: {
          id: String(row.id),
          nome: row.name,
          email: row.email,
          role: row.role,
        },
        apiToken: req.apiToken
          ? {
              publicId: req.apiToken.publicId,
              name: req.apiToken.name,
              scopes: req.apiToken.scopes,
              status: req.apiToken.status,
            }
          : null,
      });
    }
  );

  return router;
}
