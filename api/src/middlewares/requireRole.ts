import type { NextFunction, Response } from "express";
import type { AuthRequest, LegacyRole, NumericRole, Role } from "./auth";

// Fase 1: painel/API de gestao temporariamente apenas para admin (role 3).
const PANEL_ADMIN_ROLE: NumericRole = 3;

function normalizeRole(value: Role): NumericRole {
  if (value === 1 || value === "aluno") return 1;
  if (value === 2 || value === "professor") return 2;
  return 3;
}

export function requireRole(allowed: Array<Role | LegacyRole>) {
  const allowedNumeric = allowed.map(normalizeRole);

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const roleId = req.user?.roleId;

    if (!roleId || !allowedNumeric.includes(roleId)) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    if (roleId !== PANEL_ADMIN_ROLE) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    return next();
  };
}
