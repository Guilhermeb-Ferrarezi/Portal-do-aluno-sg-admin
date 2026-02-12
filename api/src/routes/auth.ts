import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../db";

export type Role = "admin" | "professor" | "aluno";

type DbUserRow = {
  id: string;
  usuario: string;
  nome: string;
  senha_hash: string;
  role: Role;
  ativo: boolean;
};

type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  usuario: string;
  nome: string;
  role: Role;
  ativo: boolean;
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
      { sub: user.id, usuario: user.usuario, role: user.role },
      jwtSecret,
      { expiresIn }
    );
  }

  async function issueRefreshToken(userId: string) {
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

    try {
      const result = await pool.query<DbUserRow>(
        `SELECT id, usuario, nome, senha_hash, role, ativo
         FROM users
         WHERE LOWER(usuario) = LOWER($1)
         LIMIT 1`,
        [usuario]
      );

      const user = result.rows[0];
      if (!user || user.ativo === false) {
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      if (!user.senha_hash || user.senha_hash.trim() === "") {
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      const ok = await bcrypt.compare(senha, user.senha_hash);
      if (!ok) {
        return res.status(401).json({ message: "Usuario ou senha invalidos" });
      }

      const token = signAccessToken(user);
      const refreshToken = await issueRefreshToken(user.id);

      return res.status(200).json({
        message: "Login realizado com sucesso",
        token,
        refreshToken,
        user: {
          id: user.id,
          usuario: user.usuario,
          nome: user.nome,
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
        `SELECT rt.id, rt.user_id, rt.token_hash, rt.expires_at, rt.revoked_at,
                u.usuario, u.nome, u.role, u.ativo
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = $1
         LIMIT 1`,
        [refreshHash]
      );

      const row = result.rows[0];
      if (!row) {
        return res.status(401).json({ message: "Refresh token invalido" });
      }

      if (row.revoked_at) {
        return res.status(401).json({ message: "Refresh token revogado" });
      }

      if (!row.expires_at || row.expires_at <= new Date()) {
        return res.status(401).json({ message: "Refresh token expirado" });
      }

      if (row.ativo === false) {
        return res.status(401).json({ message: "Usuario inativo" });
      }

      await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);

      const newRefreshToken = await issueRefreshToken(row.user_id);
      const token = jwt.sign(
        { sub: row.user_id, usuario: row.usuario, role: row.role },
        jwtSecret,
        { expiresIn: jwtExpiresIn as jwt.SignOptions["expiresIn"] }
      );

      return res.status(200).json({
        token,
        refreshToken: newRefreshToken,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  router.post("/logout", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(200).json({ message: "Logout finalizado" });
    }

    try {
      const refreshHash = hashToken(parsed.data.refreshToken);
      await pool.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
        [refreshHash]
      );
      return res.status(200).json({ message: "Logout finalizado" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  return router;
}
