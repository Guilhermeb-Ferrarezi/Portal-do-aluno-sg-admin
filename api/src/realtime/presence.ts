import type { IncomingMessage, Server as HttpServer } from "http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { authenticateToken, type AuthUser } from "../middlewares/auth";
import { getKnownLastSeenAt, persistUserLastSeen } from "../presence/presenceStore";
import { consumePresenceSocketTicket } from "./presenceTickets";

type PresenceServerMessage =
  | { type: "presence:hello"; userId: string; isOnline: boolean; lastSeenAt: string }
  | { type: "presence:update"; userId: string; isOnline: boolean; lastSeenAt: string }
  | { type: "presence:error"; message: string };

type PresenceClientMessage = {
  type?: string;
};

type PresenceSocket = WebSocket & {
  lastActivityAt?: number;
};

const WS_PATHS = new Set(["/ws/presence", "/api/ws/presence"]);
const PROXY_KEEPALIVE_INTERVAL_MS = 20_000;
const SOCKET_STALE_TIMEOUT_MS = 70_000;
const PRESENCE_WS_PROTOCOL = "portal-aluno-presence.v1";
const PRESENCE_WS_TICKET_PREFIX = "presence-ticket.";

const socketsByUserId = new Map<string, Set<WebSocket>>();
const socketUserIds = new WeakMap<WebSocket, string>();

function safeSend(ws: WebSocket, message: PresenceServerMessage) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(message));
}

function broadcast(message: PresenceServerMessage) {
  for (const sockets of socketsByUserId.values()) {
    for (const ws of sockets) {
      safeSend(ws, message);
    }
  }
}

export function broadcastPresenceUpdate(userId: string, isOnline: boolean, lastSeenAt: string) {
  broadcast({
    type: "presence:update",
    userId,
    isOnline,
    lastSeenAt,
  });
}

function registerSocket(userId: string, ws: WebSocket) {
  const sockets = socketsByUserId.get(userId);
  if (sockets) {
    sockets.add(ws);
  } else {
    socketsByUserId.set(userId, new Set([ws]));
  }

  socketUserIds.set(ws, userId);
}

function unregisterSocket(ws: WebSocket) {
  const userId = socketUserIds.get(ws);
  if (!userId) return null;

  socketUserIds.delete(ws);
  const sockets = socketsByUserId.get(userId);
  if (!sockets) return userId;

  sockets.delete(ws);
  if (sockets.size === 0) {
    socketsByUserId.delete(userId);
  }

  return userId;
}

function extractBearerToken(request: IncomingMessage) {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

function extractRequestedProtocols(request: IncomingMessage) {
  const header = request.headers["sec-websocket-protocol"];
  const rawValue = Array.isArray(header) ? header.join(",") : header ?? "";

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractPresenceTicket(request: IncomingMessage) {
  const requestedProtocols = extractRequestedProtocols(request);
  const ticketProtocol = requestedProtocols.find((protocol) =>
    protocol.startsWith(PRESENCE_WS_TICKET_PREFIX)
  );

  if (!ticketProtocol) {
    return null;
  }

  if (!requestedProtocols.includes(PRESENCE_WS_PROTOCOL)) {
    return null;
  }

  const ticket = ticketProtocol.slice(PRESENCE_WS_TICKET_PREFIX.length).trim();
  return ticket || null;
}

function isPresencePath(pathname: string) {
  return WS_PATHS.has(pathname);
}

function normalizeOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname === "::1" ||
    normalizedHostname === "[::1]"
  );
}

function shouldAllowLoopbackOrigins(allowedOrigins: Set<string>) {
  for (const allowedOrigin of allowedOrigins) {
    const normalizedOrigin = normalizeOrigin(allowedOrigin);
    if (!normalizedOrigin) {
      continue;
    }

    if (isLoopbackHostname(new URL(normalizedOrigin).hostname)) {
      return true;
    }
  }

  return false;
}

function isAllowedOrigin(
  origin: string | undefined,
  allowedOrigins: Set<string>,
  allowAnyLoopbackOrigin: boolean
) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  if (!allowAnyLoopbackOrigin) {
    return false;
  }

  return isLoopbackHostname(new URL(normalizedOrigin).hostname);
}

async function authenticatePresenceRequest(request: IncomingMessage, jwtSecret: string) {
  const ticket = extractPresenceTicket(request);
  if (ticket) {
    return consumePresenceSocketTicket(ticket);
  }

  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }

  return authenticateToken(token, jwtSecret);
}

export function setupPresenceWebSocketServer(
  server: HttpServer,
  jwtSecret: string,
  allowedOrigins: string[]
) {
  const normalizedAllowedOrigins = new Set(
    allowedOrigins
      .map((origin) => normalizeOrigin(origin.trim()))
      .filter((origin): origin is string => Boolean(origin))
  );
  const allowAnyLoopbackOrigin = shouldAllowLoopbackOrigins(normalizedAllowedOrigins);

  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols(protocols) {
      if (protocols.has(PRESENCE_WS_PROTOCOL)) {
        return PRESENCE_WS_PROTOCOL;
      }

      return false;
    },
  });

  const keepAliveIntervalId = setInterval(() => {
    const now = Date.now();

    for (const sockets of socketsByUserId.values()) {
      for (const ws of sockets) {
        if (ws.readyState !== WebSocket.OPEN) {
          continue;
        }

        const presenceSocket = ws as PresenceSocket;
        const lastActivityAt = presenceSocket.lastActivityAt ?? 0;
        if (now - lastActivityAt > SOCKET_STALE_TIMEOUT_MS) {
          ws.terminate();
          continue;
        }

        try {
          ws.ping();
        } catch {
          ws.terminate();
        }
      }
    }
  }, PROXY_KEEPALIVE_INTERVAL_MS);

  server.on("close", () => {
    clearInterval(keepAliveIntervalId);
  });

  wss.on("connection", async (ws: WebSocket, _request: IncomingMessage, user: AuthUser) => {
    const presenceSocket = ws as PresenceSocket;
    presenceSocket.lastActivityAt = Date.now();
    registerSocket(user.sub, ws);

    try {
      const lastSeenAt =
        (await persistUserLastSeen(user.sub, true)) ?? new Date().toISOString();

      for (const onlineUserId of socketsByUserId.keys()) {
        safeSend(ws, {
          type: "presence:hello",
          userId: onlineUserId,
          isOnline: true,
          lastSeenAt: onlineUserId === user.sub ? lastSeenAt : getKnownLastSeenAt(onlineUserId),
        });
      }

      broadcastPresenceUpdate(user.sub, true, lastSeenAt);
    } catch (error) {
      console.error("presence connect error:", error);
      safeSend(ws, {
        type: "presence:error",
        message: "Nao foi possivel iniciar a presenca.",
      });
    }

    ws.on("pong", () => {
      presenceSocket.lastActivityAt = Date.now();
    });

    ws.on("message", async (raw: RawData) => {
      presenceSocket.lastActivityAt = Date.now();
      let payload: PresenceClientMessage | null = null;

      try {
        payload = JSON.parse(raw.toString()) as PresenceClientMessage;
      } catch {
        safeSend(ws, { type: "presence:error", message: "Mensagem invalida." });
        return;
      }

      if (payload?.type !== "presence:heartbeat") {
        return;
      }

      try {
        const lastSeenAt = await persistUserLastSeen(user.sub, false);
        if (lastSeenAt) {
          broadcastPresenceUpdate(user.sub, true, lastSeenAt);
        }
      } catch (error) {
        console.error("presence heartbeat error:", error);
      }
    });

    ws.on("close", async () => {
      const userId = unregisterSocket(ws);
      if (!userId) return;
      if (socketsByUserId.has(userId)) return;

      try {
        const lastSeenAt =
          (await persistUserLastSeen(userId, true)) ?? new Date().toISOString();

        broadcastPresenceUpdate(userId, false, lastSeenAt);
      } catch (error) {
        console.error("presence disconnect error:", error);
      }
    });

    ws.on("error", (error: Error) => {
      console.error("presence socket error:", error);
    });
  });

  server.on("upgrade", async (request, socket, head) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (!isPresencePath(url.pathname)) {
        socket.destroy();
        return;
      }

      if (!isAllowedOrigin(request.headers.origin, normalizedAllowedOrigins, allowAnyLoopbackOrigin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      const user = await authenticatePresenceRequest(request, jwtSecret);
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request, user);
      });
    } catch (error) {
      console.error("presence upgrade error:", error);
      socket.destroy();
    }
  });
}
