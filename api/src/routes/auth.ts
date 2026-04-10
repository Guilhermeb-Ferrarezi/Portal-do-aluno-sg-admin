import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../db";
import { logActivity } from "../utils/activityLog";

export type Role = 1 | 2 | 3;

type DbUserRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: number;
};

type RefreshTokenRow = {
  id: string;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  name: string;
  email: string;
  role: number;
};

const loginSchema = z.object({
  usuario: z.string().min(1, "Usuario obrigatorio"),
  senha: z.string().min(1, "Senha obrigatoria"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20, "Refresh token invalido"),
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sha256Base64(value: string) {
  return crypto.createHash("sha256").update(value).digest("base64");
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function resolveHomeApiBaseUrl(rawUrl: string) {
  const trimmed = rawUrl.trim().replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

async function verifyPassword(inputPassword: string, storedHash: string) {
  const normalized = storedHash.trim();
  const normalizedBcrypt = normalized.replace(/^\$\$2([aby])\$\$/i, "$2$1$");

  if (
    normalizedBcrypt.startsWith("$2a$") ||
    normalizedBcrypt.startsWith("$2b$") ||
    normalizedBcrypt.startsWith("$2y$")
  ) {
    return bcrypt.compare(inputPassword, normalizedBcrypt);
  }

  const matchesBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
  if (matchesBase64 && normalized.length >= 43) {
    return sha256Base64(inputPassword) === normalized;
  }

  if (/^[A-Fa-f0-9]{64}$/.test(normalized)) {
    return sha256Hex(inputPassword) === normalized.toLowerCase();
  }

  return false;
}

function parseDurationToMs(value: string, fallbackMs: number) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+)([smhdw])$/i);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };
    return amount * (multipliers[unit] ?? 0);
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  return fallbackMs;
}

function isValidRole(role: number): role is Role {
  return role === 1 || role === 2 || role === 3;
}

export function authRouter(
  jwtSecret: string,
  jwtExpiresIn: string,
  refreshTokenExpiresIn: string
) {
  const router = Router();
  const refreshExpiresMs = parseDurationToMs(
    refreshTokenExpiresIn,
    30 * 24 * 60 * 60 * 1000
  );

  function signAccessToken(user: DbUserRow) {
    const expiresIn = jwtExpiresIn as jwt.SignOptions["expiresIn"];
    return jwt.sign(
      {
        sub: String(user.id),
        usuario: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn }
    );
  }

  async function issueRefreshToken(userId: number) {
    const refreshToken = crypto.randomBytes(48).toString("hex");
    const refreshHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshExpiresMs);

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, refreshHash, expiresAt]
    );

    return refreshToken;
  }

  router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados invalidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { usuario, senha } = parsed.data;
    const loginInput = usuario.trim().replace(/\s+/g, " ");

    try {
      const result = await pool.query<DbUserRow>(
        `SELECT id, name, email, password_hash, role
         FROM "user"
         WHERE LOWER(email) = LOWER($1)
            OR LOWER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))) = LOWER($1)
         LIMIT 1`,
        [loginInput]
      );

      const user = result.rows[0];
      if (!user) {
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      if (!isValidRole(user.role)) {
        logActivity({
          actorId: String(user.id),
          actorRole: String(user.role),
          action: "login_failed",
          entityType: "auth",
          entityId: String(user.id),
          metadata: { motivo: "role_not_allowed", loginInput },
          req: req as any,
        }).catch((error) => console.error("activity log error:", error));
        return res.status(403).json({ message: "Acesso indisponível para este perfil" });
      }

      if (!user.password_hash || user.password_hash.trim() === "") {
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      const ok = await verifyPassword(senha, user.password_hash);
      if (!ok) {
        logActivity({
          actorId: String(user.id),
          actorRole: String(user.role),
          action: "login_failed",
          entityType: "auth",
          entityId: String(user.id),
          metadata: { motivo: "invalid_password", loginInput },
          req: req as any,
        }).catch((error) => console.error("activity log error:", error));
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      const token = signAccessToken(user);
      const refreshToken = await issueRefreshToken(user.id);

      logActivity({
        actorId: String(user.id),
        actorRole: String(user.role),
        action: "login",
        entityType: "auth",
        entityId: String(user.id),
        metadata: { loginInput },
        req: req as any,
      }).catch((error) => console.error("activity log error:", error));

      return res.status(200).json({
        message: "Login realizado com sucesso",
        token,
        refreshToken,
        user: {
          id: user.id,
          usuario: user.email,
          email: user.email,
          nome: user.name,
          role: user.role,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  router.post("/refresh", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Refresh token invalido" });
    }

    const refreshToken = parsed.data.refreshToken;
    const refreshHash = hashToken(refreshToken);

    try {
      const result = await pool.query<RefreshTokenRow>(
        `SELECT rt."Id" as id, rt.user_id, rt.token_hash, rt.expires_at, rt.revoked_at,
                u.name, u.email, u.role
         FROM refresh_tokens rt
         JOIN "user" u ON u.id = rt.user_id
         WHERE rt.token_hash = $1
         LIMIT 1`,
        [refreshHash]
      );

      const row = result.rows[0];
      if (!row) {
        return res.status(401).json({ message: "Refresh token invalido" });
      }

      if (!isValidRole(row.role)) {
        return res.status(403).json({ message: "Acesso indisponível para este perfil" });
      }

      if (row.revoked_at) {
        return res.status(401).json({ message: "Refresh token revogado" });
      }

      if (!row.expires_at || row.expires_at <= new Date()) {
        return res.status(401).json({ message: "Refresh token expirado" });
      }

      await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE "Id" = $1`, [
        row.id,
      ]);

      const newRefreshToken = await issueRefreshToken(row.user_id);
      const token = jwt.sign(
        { sub: String(row.user_id), usuario: row.email, role: row.role },
        jwtSecret,
        { expiresIn: jwtExpiresIn as jwt.SignOptions["expiresIn"] }
      );

      logActivity({
        actorId: String(row.user_id),
        actorRole: String(row.role),
        action: "token_refresh",
        entityType: "auth",
        entityId: String(row.user_id),
        metadata: { refreshTokenId: row.id },
        req: req as any,
      }).catch((error) => console.error("activity log error:", error));

      return res.status(200).json({
        token,
        refreshToken: newRefreshToken,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  router.get("/sso", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";

    if (!code) {
      return res.status(400).json({ message: "Codigo SSO ausente." });
    }

    const homeApiUrl = process.env.SSO_HOME_API_URL;
    const sharedSecret =
      process.env.SSO_SHARED_SECRET || process.env.ADMIN_PORTAL_SSO_SECRET;
    const projectId = process.env.SSO_PROJECT_ID?.trim() || "portal-aluno";

    if (!homeApiUrl || !sharedSecret) {
      return res.status(500).json({ message: "SSO nao configurado neste servidor." });
    }

    try {
      const exchangeResponse = await fetch(
        `${resolveHomeApiBaseUrl(homeApiUrl)}/sso/exchange`,
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sso-shared-secret": sharedSecret,
        },
        body: JSON.stringify({ projectId, code }),
        }
      );

      if (!exchangeResponse.ok) {
        const body = await exchangeResponse.json().catch(() => null);
        const message =
          (body as { message?: string } | null)?.message ??
          "Falha ao validar codigo SSO.";
        return res.status(exchangeResponse.status).json({ message });
      }

      const { user: ssoUser } = (await exchangeResponse.json()) as {
        user: { id: string; username: string; email: string; role: string };
      };

      const existing = await pool.query<DbUserRow>(
        `SELECT id, name, email, password_hash, role
         FROM "user"
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [ssoUser.email]
      );

      const localUser = existing.rows[0];

      if (!localUser) {
        return res.status(403).json({
          message: "Usuario nao encontrado no portal do aluno.",
        });
      }

      if (!isValidRole(localUser.role)) {
        return res.status(403).json({
          message: "Acesso indisponivel para este perfil.",
        });
      }

      const token = signAccessToken(localUser);
      const refreshToken = await issueRefreshToken(localUser.id);

      logActivity({
        actorId: String(localUser.id),
        actorRole: String(localUser.role),
        action: "sso_login",
        entityType: "auth",
        entityId: String(localUser.id),
        metadata: { provider: "santos-tech-home", ssoUserId: ssoUser.id },
        req: req as any,
      }).catch((error) => console.error("activity log error:", error));

      return res.json({
        message: "Login SSO realizado com sucesso",
        token,
        refreshToken,
        user: {
          id: localUser.id,
          usuario: localUser.email,
          email: localUser.email,
          nome: localUser.name,
          role: localUser.role,
        },
      });
    } catch (error) {
      console.error("SSO exchange error:", error);
      return res.status(502).json({ message: "Erro ao comunicar com o servidor SSO." });
    }
  });

  router.post("/logout", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(200).json({ message: "Logout finalizado" });
    }

    try {
      const refreshHash = hashToken(parsed.data.refreshToken);
      const tokenOwner = await pool.query<{ user_id: number }>(
        `SELECT user_id FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`,
        [refreshHash]
      );
      await pool.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
        [refreshHash]
      );

      const userId = tokenOwner.rows[0]?.user_id;
      if (userId) {
        logActivity({
          actorId: String(userId),
          actorRole: null,
          action: "logout",
          entityType: "auth",
          entityId: String(userId),
          req: req as any,
        }).catch((error) => console.error("activity log error:", error));
      }

      return res.status(200).json({ message: "Logout finalizado" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  return router;
}
