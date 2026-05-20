import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { authenticateCodexPortalToken } from "../services/codexTokens";

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

export async function authenticateToken(token: string, jwtSecret: string): Promise<AuthUser | null> {
  try {
    const rawPayload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
    }) as JwtPayload;
    if (!rawPayload || typeof rawPayload !== "object") {
      return null;
    }

    const subFromToken = pickFirstString(rawPayload, NAME_IDENTIFIER_CLAIMS);
    const usuarioFromToken = pickFirstString(rawPayload, EMAIL_CLAIMS);
    const roleFromToken = ROLE_CLAIMS
      .map((claimKey) => parseNumericRole(rawPayload[claimKey]))
      .find((roleId): roleId is NumericRole => roleId !== null) ?? null;

    if (!roleFromToken || !subFromToken || !usuarioFromToken) {
      return null;
    }

    return {
      sub: String(subFromToken),
      usuario: String(usuarioFromToken),
      role: toLegacyRole(roleFromToken),
      roleId: roleFromToken,
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
      const codexUser = await authenticateCodexPortalToken(token, pool);
      if (!codexUser) {
        return res.status(401).json({ message: "Token invalido ou expirado" });
      }

      req.user = codexUser;
      return next();
    }

    req.user = user;
    return next();
  };
}
