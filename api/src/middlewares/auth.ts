import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db";

export type NumericRole = 1 | 2 | 3;
export type LegacyRole = "aluno" | "professor" | "admin";
export type Role = NumericRole | LegacyRole;

export type JwtPayload = {
  sub?: string;
  usuario?: string;
  role?: NumericRole | LegacyRole | string | number;
  iat?: number;
  exp?: number;
} & Record<string, unknown>;

export type AuthUser = {
  sub: string;
  usuario: string;
  role: LegacyRole;
  roleId: NumericRole;
  iat: number;
  exp: number;
};

export type AuthRequest = Request & { user?: AuthUser };

const NAME_IDENTIFIER_CLAIMS = [
  "sub",
  "nameid",
  "nameidentifier",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
];

const EMAIL_CLAIMS = [
  "usuario",
  "email",
  "unique_name",
  "upn",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
];

const ROLE_CLAIMS = [
  "role",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
];

function pickFirstString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function parseNumericRole(value: unknown): NumericRole | null {
  if (value === 1 || value === 2 || value === 3) return value;
  if (value === "1") return 1;
  if (value === "2") return 2;
  if (value === "3") return 3;
  if (value === "aluno") return 1;
  if (value === "professor") return 2;
  if (value === "admin") return 3;
  return null;
}

function toLegacyRole(role: NumericRole): LegacyRole {
  if (role === 1) return "aluno";
  if (role === 2) return "professor";
  return "admin";
}

async function resolveRoleFromDatabase(sub: string | null, usuario: string | null) {
  if (sub) {
    const numericSub = Number(sub);
    if (Number.isInteger(numericSub) && numericSub > 0) {
      const byId = await pool.query<{ id: number; email: string; role: number }>(
        `SELECT id, email, role
         FROM "user"
         WHERE id = $1
         LIMIT 1`,
        [numericSub]
      );

      if (byId.rowCount) {
        const row = byId.rows[0];
        const roleId = parseNumericRole(row.role);
        if (roleId) {
          return {
            sub: String(row.id),
            usuario: row.email,
            roleId,
          };
        }
      }
    }
  }

  if (usuario) {
    const byEmail = await pool.query<{ id: number; email: string; role: number }>(
      `SELECT id, email, role
       FROM "user"
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [usuario]
    );

    if (byEmail.rowCount) {
      const row = byEmail.rows[0];
      const roleId = parseNumericRole(row.role);
      if (roleId) {
        return {
          sub: String(row.id),
          usuario: row.email,
          roleId,
        };
      }
    }
  }

  return null;
}

export async function authenticateToken(token: string, jwtSecret: string): Promise<AuthUser | null> {
  try {
    const rawPayload = jwt.verify(token, jwtSecret) as JwtPayload;
    if (!rawPayload || typeof rawPayload !== "object") {
      return null;
    }

    const subFromToken = pickFirstString(rawPayload, NAME_IDENTIFIER_CLAIMS);
    const usuarioFromToken = pickFirstString(rawPayload, EMAIL_CLAIMS);
    const roleFromToken = ROLE_CLAIMS
      .map((claimKey) => parseNumericRole(rawPayload[claimKey]))
      .find((roleId): roleId is NumericRole => roleId !== null) ?? null;

    let sub = subFromToken;
    let usuario = usuarioFromToken;
    let roleId = roleFromToken;

    if (!roleId || !sub || !usuario) {
      const fallback = await resolveRoleFromDatabase(subFromToken, usuarioFromToken);
      if (fallback) {
        sub = sub ?? fallback.sub;
        usuario = usuario ?? fallback.usuario;
        roleId = roleId ?? fallback.roleId;
      }
    }

    if (!roleId || !sub || !usuario) {
      return null;
    }

    return {
      sub: String(sub),
      usuario: String(usuario),
      role: toLegacyRole(roleId),
      roleId,
      iat: Number(rawPayload.iat ?? 0),
      exp: Number(rawPayload.exp ?? 0),
    };
  } catch {
    return null;
  }
}

export function authGuard(jwtSecret: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ message: "Token ausente" });

    const user = await authenticateToken(token, jwtSecret);
    if (!user) {
      return res.status(401).json({ message: "Token invalido ou expirado" });
    }

    req.user = user;
    return next();
  };
}
