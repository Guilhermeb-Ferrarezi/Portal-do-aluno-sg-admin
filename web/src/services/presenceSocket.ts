import { getToken, getUserId, isLoggedIn } from "../auth/auth";
import { API_BASE_URL, sendPresenceHeartbeat } from "./api";

type PresenceSocketMessage =
  | { type: "presence:hello"; userId: string; isOnline: boolean; lastSeenAt: string }
  | { type: "presence:update"; userId: string; isOnline: boolean; lastSeenAt: string }
  | { type: "presence:reset" }
  | { type: "presence:error"; message: string };

type PresenceListener = (message: PresenceSocketMessage) => void;
type PresenceState = {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string;
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;

const listeners = new Set<PresenceListener>();
const latestPresenceByUserId = new Map<string, PresenceState>();

let socket: WebSocket | null = null;
let heartbeatIntervalId: number | null = null;
let reconnectTimeoutId: number | null = null;
let shouldRun = false;
let apiHeartbeatInFlight = false;

function notify(message: PresenceSocketMessage) {
  if (message.type === "presence:hello" || message.type === "presence:update") {
    latestPresenceByUserId.set(message.userId, {
      userId: message.userId,
      isOnline: message.isOnline,
      lastSeenAt: message.lastSeenAt,
    });
  }

  for (const listener of listeners) {
    listener(message);
  }
}

function clearPresenceState(shouldNotify = false) {
  if (latestPresenceByUserId.size === 0) return;

  latestPresenceByUserId.clear();

  if (shouldNotify) {
    notify({ type: "presence:reset" });
  }
}

function clearHeartbeat() {
  if (heartbeatIntervalId !== null) {
    window.clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
}

async function sendApiHeartbeat() {
  if (!shouldRun || !isLoggedIn() || apiHeartbeatInFlight) return;

  apiHeartbeatInFlight = true;
  try {
    const response = await sendPresenceHeartbeat();
    const currentUserId = getUserId();
    if (currentUserId) {
      notify({
        type: "presence:update",
        userId: currentUserId,
        isOnline: true,
        lastSeenAt: response.lastSeenAt,
      });
    }
  } catch {
    // keep websocket presence best-effort
  } finally {
    apiHeartbeatInFlight = false;
  }
}

function clearReconnect() {
  if (reconnectTimeoutId !== null) {
    window.clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
}

function buildPresenceUrl(token: string) {
  const explicitWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicitWsUrl && explicitWsUrl.trim()) {
    const url = new URL(explicitWsUrl.trim());
    url.searchParams.set("token", token);
    return url.toString();
  }

  const hasAbsoluteApiUrl = /^https?:\/\//i.test(API_BASE_URL);
  const apiBase =
    hasAbsoluteApiUrl
      ? API_BASE_URL
      : import.meta.env.DEV
        ? "http://localhost:3000/api"
        : API_BASE_URL;

  const apiUrl = new URL(apiBase, window.location.origin);
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  const basePath = apiUrl.pathname.endsWith("/api")
    ? apiUrl.pathname.slice(0, -4)
    : apiUrl.pathname;
  const wsPath = `${basePath}/ws/presence`.replace(/\/{2,}/g, "/");
  const url = new URL(`${protocol}//${apiUrl.host}${wsPath}`);
  url.searchParams.set("token", token);
  return url.toString();
}

function sendHeartbeat() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "presence:heartbeat" }));
  }

  void sendApiHeartbeat();
}

function scheduleReconnect() {
  clearReconnect();
  if (!shouldRun || !isLoggedIn()) return;

  reconnectTimeoutId = window.setTimeout(() => {
    connectPresenceSocket();
  }, RECONNECT_DELAY_MS);
}

export function connectPresenceSocket() {
  shouldRun = true;

  const token = getToken();
  if (!token) return;

  if (heartbeatIntervalId === null) {
    heartbeatIntervalId = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }

  sendHeartbeat();

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  clearReconnect();

  socket = new WebSocket(buildPresenceUrl(token));

  socket.addEventListener("open", () => {
    clearPresenceState(true);
    sendHeartbeat();
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data) as PresenceSocketMessage;
      notify(message);
    } catch {
      // ignore malformed payloads
    }
  });

  socket.addEventListener("close", () => {
    clearPresenceState(true);
    socket = null;
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    socket?.close();
  });
}

export function disconnectPresenceSocket() {
  shouldRun = false;
  clearReconnect();
  clearHeartbeat();
  clearPresenceState(true);

  if (socket) {
    const current = socket;
    socket = null;
    current.close();
  }
}

export function getPresenceSnapshot() {
  return Array.from(latestPresenceByUserId.values());
}

export function subscribeToPresence(listener: PresenceListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
