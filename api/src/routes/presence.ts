import { Router } from "express";
import crypto from "crypto";
import {
  authenticateToken,
  type AuthRequest,
  type AuthUser,
  type LegacyRole,
  type NumericRole,
} from "../middlewares/auth";
import { getRequestId } from "../observability/requestObservability";
import { getKnownLastSeenAt, persistUserLastSeen } from "../presence/presenceStore";
import { extractPresenceClientFingerprint } from "../realtime/presenceClientFingerprint";
import { broadcastPresenceUpdate } from "../realtime/presence";
import { issuePresenceSocketTicket } from "../realtime/presenceTickets";
import { logActivity } from "../utils/activityLog";

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

function isTrustedPresenceProxyIp(ip: string | undefined) {
  if (!ip) {
    return false;
  }

  const normalized = ip.replace(/^::ffff:/i, "").trim().toLowerCase();
  if (normalized === "::1" || normalized === "127.0.0.1" || normalized === "localhost") {
    return true;
  }

  if (normalized.startsWith("10.") || normalized.startsWith("192.168.")) {
    return true;
  }

  const private172 = normalized.match(/^172\.(\d{1,2})\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return normalized.startsWith("fc") || normalized.startsWith("fd");
}

function hasValidPresenceProxySecret(req: AuthRequest, presenceProxySecret: string | undefined) {
  if (!presenceProxySecret) {
    return false;
  }

  const providedSecret = req.header("x-presence-proxy-secret")?.trim();
  if (!providedSecret || !isTrustedPresenceProxyIp(req.ip)) {
    return false;
  }

  const expected = Buffer.from(presenceProxySecret);
  const received = Buffer.from(providedSecret);
  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

function resolveTrustedProxyUser(
  req: AuthRequest,
  presenceProxySecret: string | undefined
): AuthUser | null {
  if (!hasValidPresenceProxySecret(req, presenceProxySecret)) {
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

function resolvePresenceRoute(req: AuthRequest) {
  return req.originalUrl.split("?")[0] || req.path;
}

function presenceMetadata(
  req: AuthRequest,
  source: string,
  outcome: string,
  statusCode: number,
  extra: Record<string, unknown> = {}
) {
  return {
    requestId: req.res ? getRequestId(req, req.res) : null,
    route: resolvePresenceRoute(req),
    statusCode,
    outcome,
    source,
    contextArea: "presence",
    ...extra,
  };
}

function trackPresenceActivity(params: {
  req: AuthRequest;
  actor: { id: string | null; role?: string | null };
  action: string;
  metadata: Record<string, unknown>;
}) {
  return logActivity({
    actor: params.actor,
    action: params.action,
    entityType: "presence",
    entityId: params.actor.id,
    metadata: params.metadata,
    req: params.req,
  }).catch((error) => console.error("presence activity log error:", error));
}

export function presenceRouter(jwtSecret: string, presenceProxySecret?: string) {
  const router = Router();

  router.post("/presence/socket-ticket", async (req: AuthRequest, res) => {
    const user = await resolvePresenceUser(req, jwtSecret, presenceProxySecret);
    if (!user) {
      void trackPresenceActivity({
        req,
        actor: { id: null },
        action: "presence_socket_ticket_denied",
        metadata: presenceMetadata(req, "presence.socket-ticket", "denied", 401, {
          errorType: "MissingToken",
        }),
      });
      return res.status(401).json({ message: "Token ausente" });
    }

    const trustedProxyRequest = hasValidPresenceProxySecret(req, presenceProxySecret);
    const ticket = issuePresenceSocketTicket(
      user,
      extractPresenceClientFingerprint(
        req,
        trustedProxyRequest
          ? {
              ip: req.header("x-presence-client-ip") ?? undefined,
              userAgent: req.header("x-presence-client-user-agent") ?? undefined,
            }
          : undefined
      )
    );

    return res.json({
      ok: true,
      ...ticket,
    });
  });

  router.post("/presence/heartbeat", async (req: AuthRequest, res) => {
    try {
      const user = await resolvePresenceUser(req, jwtSecret, presenceProxySecret);
      if (!user) {
        void trackPresenceActivity({
          req,
          actor: { id: null },
          action: "presence_heartbeat_denied",
          metadata: presenceMetadata(req, "presence.heartbeat", "denied", 401, {
            errorType: "MissingToken",
          }),
        });
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
      void trackPresenceActivity({
        req,
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "presence_heartbeat_failed",
        metadata: presenceMetadata(req, "presence.heartbeat", "server_error", 500, {
          errorType: error instanceof Error ? error.name : "PresenceHeartbeatError",
        }),
      });
      return res.status(500).json({ message: "Nao foi possivel atualizar a presenca." });
    }
  });

  return router;
}
