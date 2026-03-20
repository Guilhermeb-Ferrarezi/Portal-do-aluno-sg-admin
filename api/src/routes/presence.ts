import { Router } from "express";
import {
  authenticateToken,
  type AuthRequest,
  type AuthUser,
  type LegacyRole,
  type NumericRole,
} from "../middlewares/auth";
import { getKnownLastSeenAt, persistUserLastSeen } from "../presence/presenceStore";
import { broadcastPresenceUpdate } from "../realtime/presence";
import { issuePresenceSocketTicket } from "../realtime/presenceTickets";

function pickNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseRoleId(value: unknown): NumericRole | null {
  if (value === 1 || value === "1") return 1;
  if (value === 2 || value === "2") return 2;
  if (value === 3 || value === "3") return 3;
  if (value === "aluno") return 1;
  if (value === "professor") return 2;
  if (value === "admin") return 3;
  return null;
}

function toLegacyRole(roleId: NumericRole): LegacyRole {
  if (roleId === 1) return "aluno";
  if (roleId === 2) return "professor";
  return "admin";
}

function resolveTrustedProxyUser(
  req: AuthRequest,
  presenceProxySecret: string | undefined
): AuthUser | null {
  if (!presenceProxySecret) {
    return null;
  }

  const providedSecret = req.header("x-presence-proxy-secret")?.trim();
  if (!providedSecret || providedSecret !== presenceProxySecret) {
    return null;
  }

  const body = typeof req.body === "object" && req.body !== null
    ? (req.body as Record<string, unknown>)
    : {};

  const userId = pickNonEmptyString(body.userId ?? body.sub);
  const usuario = pickNonEmptyString(body.usuario ?? body.email);
  const roleId = parseRoleId(body.roleId ?? body.role) ?? 1;

  if (!userId || !/^\d+$/.test(userId) || !usuario) {
    return null;
  }

  const issuedAt = Math.floor(Date.now() / 1000);

  return {
    sub: userId,
    usuario,
    roleId,
    role: toLegacyRole(roleId),
    iat: issuedAt,
    exp: issuedAt + 60,
  };
}

async function resolvePresenceUser(
  req: AuthRequest,
  jwtSecret: string,
  presenceProxySecret?: string
) {
  const trustedProxyUser = resolveTrustedProxyUser(req, presenceProxySecret);
  if (trustedProxyUser) {
    return trustedProxyUser;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return null;
  }

  return authenticateToken(token, jwtSecret);
}

export function presenceRouter(jwtSecret: string, presenceProxySecret?: string) {
  const router = Router();

  router.post("/presence/socket-ticket", async (req: AuthRequest, res) => {
    const user = await resolvePresenceUser(req, jwtSecret, presenceProxySecret);
    if (!user) {
      return res.status(401).json({ message: "Token ausente" });
    }

    const ticket = issuePresenceSocketTicket(user);

    return res.json({
      ok: true,
      ...ticket,
    });
  });

  router.post("/presence/heartbeat", async (req: AuthRequest, res) => {
    try {
      const user = await resolvePresenceUser(req, jwtSecret, presenceProxySecret);
      if (!user) {
        return res.status(401).json({ message: "Token ausente" });
      }

      const userId = user.sub;
      const persistedLastSeenAt = await persistUserLastSeen(userId, false);
      const lastSeenAt = persistedLastSeenAt ?? getKnownLastSeenAt(userId);

      if (persistedLastSeenAt) {
        broadcastPresenceUpdate(userId, true, persistedLastSeenAt);
      }

      return res.json({
        ok: true,
        lastSeenAt,
      });
    } catch (error) {
      console.error("presence http heartbeat error:", error);
      return res.status(500).json({ message: "Nao foi possivel atualizar a presenca." });
    }
  });

  return router;
}
