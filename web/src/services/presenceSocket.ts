import { isLoggedIn } from "../auth/auth";
import { API_BASE_URL, createPresenceSocketTicket, sendPresenceHeartbeat } from "./api";

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
const RECONNECT_DELAY_MS = 5_000;
const PRESENCE_WS_PROTOCOL = "portal-aluno-presence.v1";
const PRESENCE_WS_TICKET_PREFIX = "presence-ticket.";

const listeners = new Set<PresenceListener>();
const latestPresenceByUserId = new Map<string, PresenceState>();

let socket: WebSocket | null = null;
let heartbeatIntervalId: number | null = null;
let reconnectTimeoutId: number | null = null;
let shouldRun = false;
let apiHeartbeatInFlight = false;
let connectionAttemptId = 0;

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

function clearReconnect() {
  if (reconnectTimeoutId !== null) {
    window.clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
}

async function sendApiHeartbeat() {
  if (!shouldRun || !isLoggedIn() || apiHeartbeatInFlight) return;

  apiHeartbeatInFlight = true;
  try {
    await sendPresenceHeartbeat();
  } catch {
    // keep presence best-effort when HTTP heartbeat fails
  } finally {
    apiHeartbeatInFlight = false;
  }
}

function buildPresenceUrl() {
  const explicitWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicitWsUrl && explicitWsUrl.trim()) {
    return explicitWsUrl.trim();
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
  return `${protocol}//${apiUrl.host}${wsPath}`;
}

function sendWsHeartbeat() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "presence:heartbeat" }));
  }
}

function sendHeartbeat() {
  sendWsHeartbeat();
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

  if (heartbeatIntervalId === null) {
    heartbeatIntervalId = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }

  sendHeartbeat();

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const attemptId = ++connectionAttemptId;
  void openPresenceSocket(attemptId);
}

async function openPresenceSocket(attemptId: number) {
  clearReconnect();

  if (!shouldRun || !isLoggedIn()) {
    return;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    const { ticket } = await createPresenceSocketTicket();

    if (!shouldRun || !isLoggedIn() || attemptId !== connectionAttemptId) {
      return;
    }

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const nextSocket = new WebSocket(buildPresenceUrl(), [
      PRESENCE_WS_PROTOCOL,
      `${PRESENCE_WS_TICKET_PREFIX}${ticket}`,
    ]);

    socket = nextSocket;

    nextSocket.addEventListener("open", () => {
      if (socket !== nextSocket) return;

      clearPresenceState(true);
      sendHeartbeat();
    });

    nextSocket.addEventListener("message", (event) => {
      if (socket !== nextSocket) return;

      try {
        const message = JSON.parse(event.data) as PresenceSocketMessage;
        notify(message);
      } catch {
        // ignore malformed payloads
      }
    });

    nextSocket.addEventListener("close", () => {
      if (socket === nextSocket) {
        socket = null;
      }

      scheduleReconnect();
    });

    nextSocket.addEventListener("error", () => {
      if (socket !== nextSocket) return;
      nextSocket.close();
    });
  } catch {
    scheduleReconnect();
  }
}

export function disconnectPresenceSocket() {
  shouldRun = false;
  connectionAttemptId += 1;
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
