import { getUserId, isLoggedIn } from "../auth/auth";
import { API_BASE_URL, createPresenceSocketTicket, sendPresenceHeartbeat } from "./api";

type PresenceSocketMessage =
  | { type: "presence:hello"; userId: string; isOnline: boolean; lastSeenAt: string }
  | { type: "presence:update"; userId: string; isOnline: boolean; lastSeenAt: string }
  | { type: "presence:reset" }
  | { type: "presence:error"; message: string }
  | { type: "ping" };

type PresenceListener = (message: PresenceSocketMessage) => void;
type PresenceState = {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string;
};

const HEARTBEAT_INTERVAL_MS = 25_000;
const RECONNECT_BASE_MS = 29_000;
const RECONNECT_MAX_MS = 30_000;
const PRESENCE_STALE_AFTER_MS = 90_000;
const PRESENCE_WS_PROTOCOL = "portal-aluno-presence.v1";
const PRESENCE_WS_TICKET_PREFIX = "presence-ticket.";

const listeners = new Set<PresenceListener>();
const latestPresenceByUserId = new Map<string, PresenceState>();

let socket: WebSocket | null = null;
let heartbeatIntervalId: number | null = null;
let reconnectTimeoutId: number | null = null;
let shouldRun = false;
let connectionAttemptId = 0;
let isConnected = false;
let reconnectAttempts = 0;
let openSocketInFlight: Promise<void> | null = null;

function log(...args: unknown[]) {
  void args;
  // console.log("[Presence]", ...args);
}

function emit(message: PresenceSocketMessage) {
  for (const listener of listeners) {
    listener(message);
  }
}

function applyPresenceMessage(
  message: Extract<PresenceSocketMessage, { type: "presence:hello" | "presence:update" }>
) {
  latestPresenceByUserId.set(message.userId, {
    userId: message.userId,
    isOnline: isFreshPresence(message.isOnline, message.lastSeenAt),
    lastSeenAt: message.lastSeenAt,
  });
}

function notify(message: PresenceSocketMessage) {
  if (message.type === "presence:hello" || message.type === "presence:update") {
    applyPresenceMessage(message);
  } else if (message.type === "presence:reset") {
    latestPresenceByUserId.clear();
  }

  emit(message);
}

function clearPresenceState(shouldNotify = false) {
  const hadState = latestPresenceByUserId.size > 0;
  if (hadState) {
    latestPresenceByUserId.clear();
  }

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

function isFreshPresence(isOnline: boolean, lastSeenAt: string) {
  if (!isOnline) return false;
  const timestamp = Date.parse(lastSeenAt);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= PRESENCE_STALE_AFTER_MS;
}

function pruneStalePresence() {
  const expired: PresenceSocketMessage[] = [];

  for (const [userId, state] of latestPresenceByUserId.entries()) {
    if (!state.isOnline || isFreshPresence(state.isOnline, state.lastSeenAt)) {
      continue;
    }

    latestPresenceByUserId.set(userId, {
      ...state,
      isOnline: false,
    });

    expired.push({
      type: "presence:update",
      userId,
      isOnline: false,
      lastSeenAt: state.lastSeenAt,
    });
  }

  for (const message of expired) {
    emit(message);
  }
}

async function sendHttpHeartbeat(): Promise<string | null> {
  try {
    const response = await sendPresenceHeartbeat();
    return response.lastSeenAt ?? null;
  } catch (error) {
    log("HTTP heartbeat failed:", error);
    return null;
  }
}

function hasOpenSocket() {
  return socket?.readyState === WebSocket.OPEN;
}

function isSocketConnecting() {
  return socket?.readyState === WebSocket.CONNECTING;
}

function markCurrentUserOnline(lastSeenAt = new Date().toISOString()) {
  const userId = getUserId();
  if (!userId) return;

  notify({
    type: "presence:update",
    userId,
    isOnline: true,
    lastSeenAt,
  });
}

function sendWsHeartbeat() {
  if (!hasOpenSocket()) return;

  try {
    socket!.send(JSON.stringify({ type: "presence:heartbeat" }));
  } catch {
    // Ignore send errors.
  }
}

async function runHeartbeatCycle() {
  pruneStalePresence();

  if (hasOpenSocket()) {
    sendWsHeartbeat();
  }

  const lastSeenAt = await sendHttpHeartbeat();
  if (lastSeenAt) {
    markCurrentUserOnline(lastSeenAt);
  }
}

function scheduleReconnect() {
  clearReconnect();
  if (!shouldRun || !isLoggedIn()) return;
  if (hasOpenSocket() || isSocketConnecting()) return;

  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempts, RECONNECT_MAX_MS);
  reconnectAttempts += 1;
  log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts})`);

  reconnectTimeoutId = window.setTimeout(() => {
    reconnectTimeoutId = null;
    void openPresenceSocket();
  }, delay);
}

export function connectPresenceSocket() {
  shouldRun = true;

  if (heartbeatIntervalId === null) {
    heartbeatIntervalId = window.setInterval(() => {
      void runHeartbeatCycle();
    }, HEARTBEAT_INTERVAL_MS);
  }

  void runHeartbeatCycle();
  void openPresenceSocket();
}

async function openPresenceSocket() {
  if (openSocketInFlight) {
    return openSocketInFlight;
  }

  openSocketInFlight = openPresenceSocketInternal();

  try {
    await openSocketInFlight;
  } finally {
    openSocketInFlight = null;
  }
}

async function openPresenceSocketInternal() {
  clearReconnect();

  if (!shouldRun || !isLoggedIn()) {
    return;
  }

  if (hasOpenSocket() || isSocketConnecting()) {
    return;
  }

  const attemptId = ++connectionAttemptId;
  const wsUrl = buildPresenceUrl();
  if (!wsUrl) {
    scheduleReconnect();
    return;
  }

  try {
    const { ticket } = await createPresenceSocketTicket();
    if (!shouldRun || !isLoggedIn() || attemptId !== connectionAttemptId) {
      return;
    }

    if (!ticket) {
      scheduleReconnect();
      return;
    }

    if (hasOpenSocket() || isSocketConnecting()) {
      return;
    }

    const nextSocket = new WebSocket(wsUrl, [
      PRESENCE_WS_PROTOCOL,
      `${PRESENCE_WS_TICKET_PREFIX}${ticket}`,
    ]);

    socket = nextSocket;

    nextSocket.addEventListener("open", () => {
      if (socket !== nextSocket) return;

      clearReconnect();
      isConnected = true;
      reconnectAttempts = 0;
      clearPresenceState(true);
      markCurrentUserOnline();
      void runHeartbeatCycle();
    });

    nextSocket.addEventListener("message", (event) => {
      if (socket !== nextSocket) return;

      try {
        const message = JSON.parse(event.data) as PresenceSocketMessage;

        if (message.type === "ping") {
          if (nextSocket.readyState === WebSocket.OPEN) {
            nextSocket.send(JSON.stringify({ type: "pong" }));
          }
          return;
        }

        notify(message);
      } catch {
        // ignore malformed payloads
      }
    });

    nextSocket.addEventListener("close", (event) => {
      if (socket === nextSocket) {
        socket = null;
        isConnected = false;
      }

      log("WebSocket closed:", event.code, event.reason, "wasClean:", event.wasClean);

      scheduleReconnect();
    });

    nextSocket.addEventListener("error", (event) => {
      log("WebSocket error event:", event);
      if (socket === nextSocket) {
        nextSocket.close();
      }
    });
  } catch (error) {
    log("Failed to open socket:", error);
    scheduleReconnect();
  }
}

export function disconnectPresenceSocket() {
  log("Disconnecting...");
  shouldRun = false;
  isConnected = false;
  connectionAttemptId += 1;
  reconnectAttempts = 0;
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
  pruneStalePresence();
  return Array.from(latestPresenceByUserId.values());
}

export function subscribeToPresence(listener: PresenceListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isPresenceConnected() {
  return isConnected;
}
