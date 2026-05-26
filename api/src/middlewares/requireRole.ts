import type { NextFunction, Response } from "express";
import type { AuthRequest } from "./auth";

export type LegacyRole = "aluno" | "professor" | "admin";
export type Role = LegacyRole | 1 | 2 | 3 | 4;

function toNumeric(role: Role): 1 | 2 | 3 | 4 {
  if (role === "aluno") return 1;
  if (role === "professor") return 2;
  if (role === "admin") return 3;
  return role as 1 | 2 | 3 | 4;
}

export function requireRole(allowed: Array<Role>) {
  const allowedNumeric = allowed.map(toNumeric);
  const adminAllowed = allowedNumeric.includes(3);

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ code: "UNAUTHORIZED", message: "Não autenticado" });

    // Admin (3) passa qualquer verificação
    if (user.role === 3) return next();

    // Custom role (4) tem acesso admin quando "admin" está na lista permitida
    if (user.role === 4 && adminAllowed) return next();

    if (!allowedNumeric.includes(user.role as 1 | 2 | 3 | 4)) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Sem permissão" });
    }

    return next();
  };
}

export function requireScope(resource: string, action: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ code: "UNAUTHORIZED", message: "Não autenticado" });

    // Admin tem tudo
    if (user.role === 3) return next();

    // Custom role: verifica permissions JSONB
    if (user.role === 4) {
      const allowed = user.permissions?.[resource] ?? [];
      if (!allowed.includes(action)) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Escopo insuficiente" });
      }
      return next();
    }

    // Roles fixos: controle via requireRole
    return next();
  };
}
