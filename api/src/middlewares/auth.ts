import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type NumericRole = 1 | 2 | 3;
export type LegacyRole = "aluno" | "professor" | "admin";
export type Role = NumericRole | LegacyRole;

export type JwtPayload = {
  sub: string;
  usuario: string;
  role: NumericRole;
  iat: number;
  exp: number;
};

export type AuthUser = {
  sub: string;
  usuario: string;
  role: LegacyRole;
  roleId: NumericRole;
  iat: number;
  exp: number;
};

export type AuthRequest = Request & { user?: AuthUser };

function parseNumericRole(value: unknown): NumericRole | null {
  if (value === 1 || value === 2 || value === 3) return value;
  if (value === "1") return 1;
  if (value === "2") return 2;
  if (value === "3") return 3;
  return null;
}

function toLegacyRole(role: NumericRole): LegacyRole {
  if (role === 1) return "aluno";
  if (role === 2) return "professor";
  return "admin";
}

export function authGuard(jwtSecret: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ message: "Token ausente" });

    try {
      const rawPayload = jwt.verify(token, jwtSecret) as Partial<JwtPayload> & {
        role?: unknown;
      };

      const roleId = parseNumericRole(rawPayload.role);
      if (!roleId || !rawPayload.sub || !rawPayload.usuario) {
        return res.status(401).json({ message: "Token inválido ou expirado" });
      }

      req.user = {
        sub: String(rawPayload.sub),
        usuario: String(rawPayload.usuario),
        role: toLegacyRole(roleId),
        roleId,
        iat: Number(rawPayload.iat ?? 0),
        exp: Number(rawPayload.exp ?? 0),
      };

      return next();
    } catch {
      return res.status(401).json({ message: "Token inválido ou expirado" });
    }
  };
}
