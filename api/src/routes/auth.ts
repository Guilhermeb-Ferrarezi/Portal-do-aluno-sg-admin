import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../db";
import { authGuard, type AuthRequest } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import { getRequestId } from "../observability/requestObservability";
import { logActivity } from "../utils/activityLog";
import { verifyPasswordForLoginMigration } from "../utils/verifyPassword";
import type { StudentViewSsoStore } from "../services/studentViewSsoStore";
import type { PasswordResetStore } from "../services/passwordResetStore";
import type { PasswordResetMailer } from "../services/passwordResetMailer";

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

type AuthRouterOptions = {
  studentPortalBaseUrl?: string;
  studentPortalSsoCallbackPath?: string;
  studentPortalSsoSharedSecret?: string;
  studentPortalSsoTtlSeconds?: number;
  studentViewSsoStore?: StudentViewSsoStore;
  passwordResetBaseUrl?: string;
  passwordResetTtlMinutes?: number;
  passwordResetTokenSecret?: string;
  passwordResetStore?: PasswordResetStore;
  passwordResetMailer?: PasswordResetMailer;
};

const loginSchema = z.object({
  usuario: z.string().min(1, "Usuario obrigatorio"),
  senha: z.string().min(1, "Senha obrigatoria"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20, "Refresh token invalido"),
});

const passwordResetRequestSchema = z.object({
  usuario: z
    .string()
    .min(1, "Usuario obrigatorio")
    .refine((value) => {
      const normalized = value.trim();
      if (!normalized.includes("@")) {
        return true;
      }
      return z.email().safeParse(normalized).success;
    }, "Informe um e-mail valido."),
});

const passwordResetValidateSchema = z.object({
  token: z.string().min(32, "Token invalido").max(256, "Token invalido"),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(32, "Token invalido").max(256, "Token invalido"),
  novaSenha: z.string().min(6, "Senha muito curta"),
});

const studentViewStartSchema = z.object({
  returnTo: z.string().url("URL de retorno invalida").max(2048).optional(),
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashPasswordResetToken(token: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

function issueSecureUrlSafeToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function isSafePasswordResetTokenFormat(token: string) {
  return /^[A-Za-z0-9_-]+$/.test(token);
}

function resolveHomeApiBaseUrl(rawUrl: string) {
  const trimmed = rawUrl.trim().replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function getOriginFromUrl(rawValue: string | undefined) {
  if (!rawValue) return null;
  try {
    return new URL(rawValue).origin;
  } catch {
    return null;
  }
}

function resolveSafeStudentViewReturnTo(req: AuthRequest, rawValue: string | undefined) {
  if (!rawValue) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const allowedOrigins = new Set<string>();
  const requestOrigin = getOriginFromUrl(req.header("origin") ?? undefined);
  const refererOrigin = getOriginFromUrl(req.header("referer") ?? undefined);
  const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.header("host");
  const protocol = forwardedProto || req.protocol;

  if (requestOrigin) allowedOrigins.add(requestOrigin);
  if (refererOrigin) allowedOrigins.add(refererOrigin);
  if (host && protocol) allowedOrigins.add(`${protocol}://${host}`);

  if (allowedOrigins.size === 0 || !allowedOrigins.has(parsed.origin)) {
    return null;
  }

  return parsed.toString();
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
  refreshTokenExpiresIn: string,
  options: AuthRouterOptions = {}
) {
  const router = Router();
  const refreshExpiresMs = parseDurationToMs(
    refreshTokenExpiresIn,
    30 * 24 * 60 * 60 * 1000
  );
  const studentPortalBaseUrl =
    options.studentPortalBaseUrl?.trim() || "https://portal.santos-tech.com";
  const studentPortalSsoCallbackPath =
    options.studentPortalSsoCallbackPath?.trim() || "/api/Auth/sso/callback";
  const studentPortalSsoSharedSecret = options.studentPortalSsoSharedSecret?.trim();
  const studentPortalSsoTtlSeconds = Math.max(30, options.studentPortalSsoTtlSeconds ?? 120);
  const studentViewSsoStore = options.studentViewSsoStore;
  const passwordResetBaseUrl = options.passwordResetBaseUrl?.trim();
  const passwordResetTtlMinutes = Math.max(5, options.passwordResetTtlMinutes ?? 30);
  const passwordResetTokenSecret = options.passwordResetTokenSecret?.trim() || null;
  const passwordResetStore = options.passwordResetStore;
  const passwordResetMailer = options.passwordResetMailer;

  function requirePasswordResetTokenSecret() {
    if (!passwordResetTokenSecret) {
      throw new Error("PASSWORD_RESET_TOKEN_SECRET nao configurado.");
    }
    return passwordResetTokenSecret;
  }

  function resolvePasswordResetTokenHashes(rawToken: string) {
    const currentHash = hashPasswordResetToken(rawToken, requirePasswordResetTokenSecret());
    const legacyHash = hashToken(rawToken);
    return currentHash === legacyHash ? [currentHash] : [currentHash, legacyHash];
  }

  function resolveRequestRoute(req: AuthRequest) {
    return req.originalUrl.split("?")[0] || req.path;
  }

  function authObservabilityMetadata(
    req: AuthRequest,
    base: {
      source: string;
      outcome: string;
      statusCode: number;
      errorType?: string | null;
      contextArea?: string;
    } & Record<string, unknown>
  ) {
    return {
      requestId: req.res ? getRequestId(req, req.res) : null,
      route: resolveRequestRoute(req),
      contextArea: "auth",
      ...base,
    };
  }

  function trackAuthActivity(params: {
    req: AuthRequest;
    actor: { id: string | null; role?: string | null };
    action: string;
    entityId?: string | null;
    metadata: Record<string, unknown>;
  }) {
    return logActivity({
      actor: params.actor,
      action: params.action,
      entityType: "auth",
      entityId: params.entityId ?? params.actor.id,
      metadata: params.metadata,
      req: params.req,
    }).catch((error) => console.error("activity log error:", error));
  }

  function resolveStudentPortalCallbackUrl(code: string) {
    const callbackUrl = new URL(studentPortalSsoCallbackPath, studentPortalBaseUrl);
    callbackUrl.searchParams.set("code", code);
    return callbackUrl.toString();
  }

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

  async function issuePasswordResetToken(userId: number) {
    if (!passwordResetStore) {
      throw new Error("Redis da recuperacao de senha nao configurado.");
    }

    const resetToken = issueSecureUrlSafeToken();
    const tokenHash = hashPasswordResetToken(resetToken, requirePasswordResetTokenSecret());
    const expiresAt = new Date(Date.now() + passwordResetTtlMinutes * 60 * 1000);
    const userResult = await pool.query<Pick<DbUserRow, "id" | "email" | "role">>(
      `SELECT id, email, role
       FROM "user"
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );
    const user = userResult.rows[0];

    if (!user?.email) {
      throw new Error("Usuario nao encontrado para recuperacao de senha.");
    }

    await passwordResetStore.issue(
      tokenHash,
      {
        userId: String(user.id),
        email: user.email,
        role: user.role,
        expiresAt: expiresAt.toISOString(),
      },
      passwordResetTtlMinutes * 60
    );

    return {
      resetToken,
      expiresAt,
    };
  }

  function resolvePasswordResetUrl(req: AuthRequest, token: string) {
    const origin =
      passwordResetBaseUrl ||
      req.header("origin")?.trim() ||
      (req.header("host") ? `${req.protocol}://${req.header("host")}` : null);

    if (!origin) {
      return null;
    }

    try {
      const url = new URL("/recuperar-senha", origin);
      url.searchParams.set("token", token);
      return url.toString();
    } catch {
      return null;
    }
  }

  async function findValidPasswordResetToken(rawToken: string) {
    if (!passwordResetStore || !passwordResetTokenSecret) {
      return { ok: false as const, message: "Recuperacao de senha indisponivel no momento." };
    }

    if (!isSafePasswordResetTokenFormat(rawToken)) {
      return { ok: false as const, message: "Token de recuperacao invalido ou expirado." };
    }

    let tokenEntry = null;
    for (const tokenHash of resolvePasswordResetTokenHashes(rawToken)) {
      tokenEntry = await passwordResetStore.get(tokenHash);
      if (tokenEntry) {
        break;
      }
    }

    if (!tokenEntry) {
      return { ok: false as const, message: "Token de recuperacao invalido ou expirado." };
    }

    if (new Date(tokenEntry.expiresAt) <= new Date()) {
      return { ok: false as const, message: "Token de recuperacao expirado." };
    }

    return { ok: true as const, tokenEntry };
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
         ORDER BY id ASC
         LIMIT 1`,
        [loginInput]
      );

      const user = result.rows[0];
      if (!user) {
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: null },
          action: "login_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.login",
            outcome: "denied",
            statusCode: 401,
            errorType: "UserNotFound",
            loginInput,
          }),
        });
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      if (!isValidRole(user.role) || user.role === 1) {
        await bcrypt.compare(senha, "$2b$10$C6UzMDM.H6dfI/f/IKxGhuJx0P2Tn7YJYcqRR3YKHyCuXapnwYf6O");
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: String(user.id), role: String(user.role) },
          action: "login_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.login",
            outcome: "denied",
            statusCode: 401,
            errorType: user.role === 1 ? "StudentAdminPortalDenied" : "RoleNotAllowed",
            loginInput,
            motivo: user.role === 1 ? "student_admin_portal_denied" : "role_not_allowed",
          }),
        });
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      if (!user.password_hash || user.password_hash.trim() === "") {
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      const passwordCheck = await verifyPasswordForLoginMigration(senha, user.password_hash);
      if (!passwordCheck.ok) {
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: String(user.id), role: String(user.role) },
          action: "login_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.login",
            outcome: "denied",
            statusCode: 401,
            errorType: "InvalidPassword",
            loginInput,
            motivo: "invalid_password",
          }),
        });
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      if (passwordCheck.needsRehash) {
        const upgradedHash = await bcrypt.hash(senha, 10);
        await pool.query(`UPDATE "user" SET password_hash = $1 WHERE id = $2`, [
          upgradedHash,
          user.id,
        ]);
      }

      const token = signAccessToken(user);
      const refreshToken = await issueRefreshToken(user.id);

      void trackAuthActivity({
        req: req as AuthRequest,
        actor: { id: String(user.id), role: String(user.role) },
        action: "login",
        metadata: authObservabilityMetadata(req as AuthRequest, {
          source: "auth.login",
          outcome: "success",
          statusCode: 200,
          loginInput,
        }),
      });

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

  router.post("/password-reset/request", async (req, res) => {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados invalidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const loginInput = parsed.data.usuario.trim().replace(/\s+/g, " ");

    try {
      if (!passwordResetStore || !passwordResetMailer || !passwordResetTokenSecret) {
        return res.status(500).json({ message: "Recuperacao de senha indisponivel no momento." });
      }

      const result = await pool.query<DbUserRow>(
        `SELECT id, name, email, password_hash, role
         FROM "user"
         WHERE LOWER(email) = LOWER($1)
            OR LOWER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))) = LOWER($1)
         ORDER BY id ASC
         LIMIT 1`,
        [loginInput]
      );

      const user = result.rows[0];
      const genericMessage =
        "Se encontramos uma conta correspondente, enviamos as instrucoes para redefinir a senha.";

      if (!user || !isValidRole(user.role) || user.role === 1) {
        return res.status(200).json({ message: genericMessage });
      }

      const { resetToken, expiresAt } = await issuePasswordResetToken(user.id);
      const resetUrl = resolvePasswordResetUrl(req as AuthRequest, resetToken);
      if (!resetUrl) {
        throw new Error("PASSWORD_RESET_BASE_URL nao configurado para envio de e-mail.");
      }
      await passwordResetMailer.sendPasswordResetEmail({
        toEmail: user.email,
        toName: user.name,
        resetUrl,
        expiresAt: expiresAt.toISOString(),
      });

      void trackAuthActivity({
        req: req as AuthRequest,
        actor: { id: String(user.id), role: String(user.role) },
        action: "password_reset_requested",
        metadata: authObservabilityMetadata(req as AuthRequest, {
          source: "auth.password_reset.request",
          outcome: "success",
          statusCode: 200,
        }),
      });

      return res.status(200).json({
        message: genericMessage,
        ...(process.env.NODE_ENV !== "production"
          ? {
              expiresAt: expiresAt.toISOString(),
            }
          : {}),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  router.get("/password-reset/validate", async (req, res) => {
    const parsed = passwordResetValidateSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Token invalido" });
    }

    try {
      const validation = await findValidPasswordResetToken(parsed.data.token);
      if (!validation.ok) {
        return res.status(400).json({ message: validation.message, valid: false });
      }

      return res.status(200).json({
        valid: true,
        email: validation.tokenEntry.email,
        expiresAt: validation.tokenEntry.expiresAt,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  router.post("/password-reset/confirm", async (req, res) => {
    const parsed = passwordResetConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados invalidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      if (!passwordResetStore || !passwordResetTokenSecret) {
        return res.status(500).json({ message: "Recuperacao de senha indisponivel no momento." });
      }

      if (!isSafePasswordResetTokenFormat(parsed.data.token)) {
        return res.status(400).json({ message: "Token de recuperacao invalido ou expirado." });
      }

      let consumedEntry = null;
      for (const tokenHash of resolvePasswordResetTokenHashes(parsed.data.token)) {
        consumedEntry = await passwordResetStore.consume(tokenHash);
        if (consumedEntry) {
          break;
        }
      }

      if (!consumedEntry) {
        return res.status(400).json({ message: "Token de recuperacao invalido ou expirado." });
      }

      if (new Date(consumedEntry.expiresAt) <= new Date()) {
        return res.status(400).json({ message: "Token de recuperacao expirado." });
      }

      const senhaHash = await bcrypt.hash(parsed.data.novaSenha, 10);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query(`UPDATE "user" SET password_hash = $1 WHERE id = $2`, [
          senhaHash,
          Number(consumedEntry.userId),
        ]);
        await client.query(
          `UPDATE refresh_tokens
           SET revoked_at = NOW()
           WHERE user_id = $1
             AND revoked_at IS NULL`,
          [Number(consumedEntry.userId)]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      void trackAuthActivity({
        req: req as AuthRequest,
        actor: { id: consumedEntry.userId, role: String(consumedEntry.role) },
        action: "password_reset_completed",
        metadata: authObservabilityMetadata(req as AuthRequest, {
          source: "auth.password_reset.confirm",
          outcome: "success",
          statusCode: 200,
        }),
      });

      return res.status(200).json({
        message: "Senha redefinida com sucesso. Voce ja pode entrar com a nova senha.",
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
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: null },
          action: "token_refresh_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.refresh",
            outcome: "denied",
            statusCode: 401,
            errorType: "RefreshTokenInvalid",
          }),
        });
        return res.status(401).json({ message: "Refresh token invalido" });
      }

      if (!isValidRole(row.role)) {
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: String(row.user_id), role: String(row.role) },
          action: "token_refresh_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.refresh",
            outcome: "denied",
            statusCode: 403,
            errorType: "RoleNotAllowed",
            refreshTokenId: row.id,
          }),
        });
        return res.status(403).json({ message: "Acesso indisponivel para este perfil" });
      }

      if (row.role === 1) {
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: String(row.user_id), role: String(row.role) },
          action: "token_refresh_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.refresh",
            outcome: "denied",
            statusCode: 403,
            errorType: "StudentAdminPortalDenied",
            refreshTokenId: row.id,
          }),
        });
        return res.status(403).json({
          message: "Alunos nao podem acessar o portal administrativo.",
        });
      }

      if (row.revoked_at) {
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: String(row.user_id), role: String(row.role) },
          action: "token_refresh_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.refresh",
            outcome: "denied",
            statusCode: 401,
            errorType: "RefreshTokenRevoked",
            refreshTokenId: row.id,
          }),
        });
        return res.status(401).json({ message: "Refresh token revogado" });
      }

      if (!row.expires_at || row.expires_at <= new Date()) {
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: String(row.user_id), role: String(row.role) },
          action: "token_refresh_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.refresh",
            outcome: "denied",
            statusCode: 401,
            errorType: "RefreshTokenExpired",
            refreshTokenId: row.id,
          }),
        });
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

      void trackAuthActivity({
        req: req as AuthRequest,
        actor: { id: String(row.user_id), role: String(row.role) },
        action: "token_refresh",
        metadata: authObservabilityMetadata(req as AuthRequest, {
          source: "auth.refresh",
          outcome: "success",
          statusCode: 200,
          refreshTokenId: row.id,
        }),
      });

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
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: null },
          action: "sso_login_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.sso",
            outcome: "error",
            statusCode: exchangeResponse.status,
            errorType: "SsoExchangeRejected",
            provider: "santos-tech-home",
          }),
        });
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
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: null },
          action: "sso_login_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.sso",
            outcome: "denied",
            statusCode: 403,
            errorType: "UserNotFound",
            provider: "santos-tech-home",
            ssoUserId: ssoUser.id,
          }),
        });
        return res.status(403).json({
          message: "Usuario nao encontrado no portal do aluno.",
        });
      }

      if (!isValidRole(localUser.role)) {
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: String(localUser.id), role: String(localUser.role) },
          action: "sso_login_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.sso",
            outcome: "denied",
            statusCode: 403,
            errorType: "RoleNotAllowed",
            provider: "santos-tech-home",
            ssoUserId: ssoUser.id,
          }),
        });
        return res.status(403).json({
          message: "Acesso indisponivel para este perfil.",
        });
      }

      const token = signAccessToken(localUser);
      const refreshToken = await issueRefreshToken(localUser.id);

      void trackAuthActivity({
        req: req as AuthRequest,
        actor: { id: String(localUser.id), role: String(localUser.role) },
        action: "sso_login",
        metadata: authObservabilityMetadata(req as AuthRequest, {
          source: "auth.sso",
          outcome: "success",
          statusCode: 200,
          provider: "santos-tech-home",
          ssoUserId: ssoUser.id,
        }),
      });

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
      void trackAuthActivity({
        req: req as AuthRequest,
        actor: { id: null },
        action: "sso_login_failed",
        metadata: authObservabilityMetadata(req as AuthRequest, {
          source: "auth.sso",
          outcome: "error",
          statusCode: 502,
          errorType: "SsoExchangeError",
          provider: "santos-tech-home",
        }),
      });
      console.error("SSO exchange error:", error);
      return res.status(502).json({ message: "Erro ao comunicar com o servidor SSO." });
    }
  });

  router.post(
    "/student-view/start",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      if (!studentViewSsoStore) {
        return res.status(500).json({ message: "Redis do SSO do portal do aluno nao configurado." });
      }

      if (!studentPortalSsoSharedSecret) {
        return res.status(500).json({ message: "SSO do portal do aluno nao configurado." });
      }

      if (!req.user?.sub || !req.user.usuario) {
        return res.status(401).json({ message: "Sessao invalida." });
      }

      const parsedBody = studentViewStartSchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        return res.status(400).json({ message: "Dados invalidos para iniciar a visao do aluno." });
      }

      try {
        const userResult = await pool.query<Pick<DbUserRow, "id" | "name" | "email">>(
          `SELECT id, name, email
           FROM "user"
           WHERE id = $1
           LIMIT 1`,
          [Number(req.user.sub)]
        );

        const currentUser = userResult.rows[0];
        if (!currentUser?.email) {
          return res.status(404).json({ message: "Usuario atual nao encontrado." });
        }

        const code = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + studentPortalSsoTtlSeconds * 1000);
        const returnTo = resolveSafeStudentViewReturnTo(req, parsedBody.data.returnTo);

        await studentViewSsoStore.set(
          code,
          {
            sourceUserId: String(currentUser.id),
            sourceEmail: currentUser.email,
            sourceName: currentUser.name,
            returnTo,
          },
          studentPortalSsoTtlSeconds
        );

        void trackAuthActivity({
          req,
          actor: { id: String(currentUser.id), role: req.user.role },
          action: "student_view_sso_start",
          metadata: authObservabilityMetadata(req, {
            source: "auth.student-view.start",
            outcome: "success",
            statusCode: 200,
            target: "portal-aluno",
            expiresAt: expiresAt.toISOString(),
            returnTo,
          }),
        });

        return res.json({
          redirectUrl: resolveStudentPortalCallbackUrl(code),
          expiresAt: expiresAt.toISOString(),
        });
      } catch (error) {
        void trackAuthActivity({
          req,
          actor: { id: req.user?.sub ?? null, role: req.user?.role },
          action: "student_view_sso_start_failed",
          metadata: authObservabilityMetadata(req, {
            source: "auth.student-view.start",
            outcome: "error",
            statusCode: 502,
            errorType: "StudentViewSsoStartError",
            target: "portal-aluno",
          }),
        });
        console.error("student view sso start error:", error);
        return res.status(502).json({ message: "Nao foi possivel iniciar a visao do aluno." });
      }
    }
  );

  router.post("/student-view/exchange", async (req, res) => {
    const sharedSecret = req.header("x-sso-shared-secret")?.trim();
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";

    if (!studentPortalSsoSharedSecret) {
      return res.status(500).json({ message: "SSO do portal do aluno nao configurado." });
    }

    if (!sharedSecret || sharedSecret !== studentPortalSsoSharedSecret) {
      void trackAuthActivity({
        req: req as AuthRequest,
        actor: { id: null },
        action: "student_view_sso_exchange_failed",
        metadata: authObservabilityMetadata(req as AuthRequest, {
          source: "auth.student-view.exchange",
          outcome: "denied",
          statusCode: 403,
          errorType: "SharedSecretInvalid",
          target: "portal-aluno",
        }),
      });
      return res.status(403).json({ message: "Shared secret invalido." });
    }

    if (!code) {
      return res.status(400).json({ message: "Codigo SSO ausente." });
    }

    if (!studentViewSsoStore) {
      return res.status(500).json({ message: "Redis do SSO do portal do aluno nao configurado." });
    }

    try {
      const entry = await studentViewSsoStore.consume(code);
      if (!entry) {
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: null },
          action: "student_view_sso_exchange_failed",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.student-view.exchange",
            outcome: "denied",
            statusCode: 401,
            errorType: "SsoCodeInvalidOrExpired",
            target: "portal-aluno",
          }),
        });
        return res.status(401).json({ message: "Codigo SSO invalido ou expirado." });
      }

      void trackAuthActivity({
        req: req as AuthRequest,
        actor: { id: entry.sourceUserId },
        action: "student_view_sso_exchange",
        metadata: authObservabilityMetadata(req as AuthRequest, {
          source: "auth.student-view.exchange",
          outcome: "success",
          statusCode: 200,
          target: "portal-aluno",
          returnTo: entry.returnTo,
        }),
      });

      return res.json({
        user: {
          id: entry.sourceUserId,
          email: entry.sourceEmail,
          name: entry.sourceName,
        },
        returnTo: entry.returnTo,
      });
    } catch (error) {
      void trackAuthActivity({
        req: req as AuthRequest,
        actor: { id: null },
        action: "student_view_sso_exchange_failed",
        metadata: authObservabilityMetadata(req as AuthRequest, {
          source: "auth.student-view.exchange",
          outcome: "error",
          statusCode: 502,
          errorType: "StudentViewSsoExchangeError",
          target: "portal-aluno",
        }),
      });
      console.error("student view sso exchange error:", error);
      return res.status(502).json({ message: "Nao foi possivel validar a visao do aluno." });
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
        void trackAuthActivity({
          req: req as AuthRequest,
          actor: { id: String(userId) },
          action: "logout",
          metadata: authObservabilityMetadata(req as AuthRequest, {
            source: "auth.logout",
            outcome: "success",
            statusCode: 200,
          }),
        });
      }

      return res.status(200).json({ message: "Logout finalizado" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  return router;
}

