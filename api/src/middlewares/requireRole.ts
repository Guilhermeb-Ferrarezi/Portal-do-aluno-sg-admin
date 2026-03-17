import type { NextFunction, Response } from "express";
import type { AuthRequest, LegacyRole, NumericRole, Role } from "./auth";

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
      return res.status(403).json({ message: "Sem permissao" });
    }

    return next();
  };
}
