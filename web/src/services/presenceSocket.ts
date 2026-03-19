import { isLoggedIn } from "../auth/auth";
import { API_BASE_URL, createPresenceSocketTicket, apiFetch } from "./api";

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
const RECONNECT_DELAY_MS = 3_000;
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

function log(...args: unknown[]) {
  console.log("[Presence]", ...args);
}

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

async function sendHttpHeartbeat(): Promise<string | null> {
  try {
    const response = await apiFetch<{ ok: boolean; lastSeenAt?: string }>(
      "/presence/heartbeat",
      { method: "POST" }
    );
    return response.lastSeenAt ?? null;
  } catch (error) {
    log("HTTP heartbeat failed:", error);
    return null;
  }
}

function sendWsHeartbeat() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "presence:heartbeat" }));
  }
}

async function runHeartbeatCycle() {
  // Prune stale presence data
  const now = Date.now();
  for (const [userId, state] of latestPresenceByUserId.entries()) {
    if (!isFreshPresence(state.isOnline, state.lastSeenAt)) {
      latestPresenceByUserId.delete(userId);
      notify({ type: "presence:update", userId, isOnline: false, lastSeenAt: state.lastSeenAt });
    }
  }

  // Send WebSocket heartbeat if connected
  if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
    sendWsHeartbeat();
  } else {
    // Fallback to HTTP heartbeat if WebSocket is not connected
    const lastSeenAt = await sendHttpHeartbeat();
    if (lastSeenAt) {
      log("HTTP heartbeat sent, lastSeenAt:", lastSeenAt);
    }
  }
}

function scheduleReconnect() {
  clearReconnect();
  if (!shouldRun || !isLoggedIn()) return;

  // Don't reconnect if already connected
  if (isConnected) {
    log("Already connected, skipping reconnect");
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(RECONNECT_DELAY_MS * Math.pow(1.5, Math.min(reconnectAttempts, 10)), 30000);
  log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts})`);

  reconnectTimeoutId = window.setTimeout(() => {
    connectPresenceSocket();
  }, delay);
}

export function connectPresenceSocket() {
  shouldRun = true;

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    log("Socket already open or connecting, skipping");
    return;
  }

  const attemptId = ++connectionAttemptId;
  void openPresenceSocket(attemptId);
}

async function openPresenceSocket(attemptId: number) {
  clearReconnect();

  if (!shouldRun || !isLoggedIn()) {
    log("Should not run or not logged in, aborting");
    return;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    log("Socket already exists and is open/connecting");
    return;
  }

  const wsUrl = buildPresenceUrl();
  log("Connecting to WebSocket:", wsUrl);

  try {
    const { ticket } = await createPresenceSocketTicket();
    log("Got ticket:", ticket?.substring(0, 20) + "...");

    if (!shouldRun || !isLoggedIn() || attemptId !== connectionAttemptId) {
      log("Aborting: conditions changed");
      return;
    }

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      log("Socket already connected while waiting for ticket");
      return;
    }

    const nextSocket = new WebSocket(wsUrl, [
      PRESENCE_WS_PROTOCOL,
      `${PRESENCE_WS_TICKET_PREFIX}${ticket}`,
    ]);

    socket = nextSocket;

    nextSocket.addEventListener("open", () => {
      if (socket !== nextSocket) return;

      log("WebSocket connected!");
      isConnected = true;
      reconnectAttempts = 0;
      clearPresenceState(true);

      if (heartbeatIntervalId !== null) {
        window.clearInterval(heartbeatIntervalId);
      }
      heartbeatIntervalId = window.setInterval(runHeartbeatCycle, HEARTBEAT_INTERVAL_MS);

      // Send initial heartbeat
      sendWsHeartbeat();
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

        if (message.type === "presence:hello" || message.type === "presence:update") {
          log(`Received ${message.type}:`, message.userId, message.isOnline);
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

      log("WebSocket closed:", event.code, event.reason);

      if (heartbeatIntervalId !== null) {
        window.clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
      }

      scheduleReconnect();
    });

    nextSocket.addEventListener("error", (error) => {
      if (socket !== nextSocket) return;
      log("WebSocket error:", error);
      nextSocket.close();
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

export function isPresenceConnected() {
  return isConnected;
}