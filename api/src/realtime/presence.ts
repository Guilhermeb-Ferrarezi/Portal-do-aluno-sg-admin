import type { IncomingMessage, Server as HttpServer } from "http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { pool } from "../db";
import { authenticateToken, type AuthUser } from "../middlewares/auth";

type PresenceServerMessage =
  | { type: "presence:hello"; userId: string; isOnline: boolean; lastSeenAt: string }
  | { type: "presence:update"; userId: string; isOnline: boolean; lastSeenAt: string }
  | { type: "presence:error"; message: string };

type PresenceClientMessage = {
  type?: string;
};

const WS_PATHS = new Set(["/ws/presence", "/api/ws/presence"]);
const HEARTBEAT_PERSIST_INTERVAL_MS = 25_000;

const socketsByUserId = new Map<string, Set<WebSocket>>();
const socketUserIds = new WeakMap<WebSocket, string>();
const lastPersistByUserId = new Map<string, number>();

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

async function persistLastSeen(userId: string, force = false) {
  const now = Date.now();
  const lastPersist = lastPersistByUserId.get(userId) ?? 0;
  if (!force && now - lastPersist < HEARTBEAT_PERSIST_INTERVAL_MS) {
    return null;
  }

  lastPersistByUserId.set(userId, now);

  const result = await pool.query<{ last_seen_at: string | null }>(
    `UPDATE "user"
     SET last_seen_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING last_seen_at`,
    [Number(userId)]
  );

  return result.rows[0]?.last_seen_at ?? new Date(now).toISOString();
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

function extractToken(request: IncomingMessage) {
  const url = new URL(request.url ?? "/", "http://localhost");
  const tokenFromQuery = url.searchParams.get("token");
  if (tokenFromQuery && tokenFromQuery.trim()) {
    return tokenFromQuery.trim();
  }

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

function isPresencePath(pathname: string) {
  return WS_PATHS.has(pathname);
}

export function setupPresenceWebSocketServer(server: HttpServer, jwtSecret: string) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", async (ws: WebSocket, _request: IncomingMessage, user: AuthUser) => {
    registerSocket(user.sub, ws);

    try {
      const lastSeenAt =
        (await persistLastSeen(user.sub, true)) ?? new Date().toISOString();

      safeSend(ws, {
        type: "presence:hello",
        userId: user.sub,
        isOnline: true,
        lastSeenAt,
      });

      broadcast({
        type: "presence:update",
        userId: user.sub,
        isOnline: true,
        lastSeenAt,
      });
    } catch (error) {
      console.error("presence connect error:", error);
      safeSend(ws, {
        type: "presence:error",
        message: "Nao foi possivel iniciar a presenca.",
      });
    }

    ws.on("message", async (raw: RawData) => {
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
        await persistLastSeen(user.sub, false);
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
          (await persistLastSeen(userId, true)) ?? new Date().toISOString();

        broadcast({
          type: "presence:update",
          userId,
          isOnline: false,
          lastSeenAt,
        });
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

      const token = extractToken(request);
      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const user = await authenticateToken(token, jwtSecret);
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
