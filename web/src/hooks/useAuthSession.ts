import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getTokenExpiryMs, isTokenExpired, onAuthChanged } from "../auth/auth";
import { logoutWithServer } from "../services/api";
import { connectPresenceSocket, disconnectPresenceSocket } from "../services/presenceSocket";
import { appRoutes } from "@/router/routes";

const MAX_TIMEOUT_MS = 2_147_483_647;

export function useAuthSession() {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: number | null = null;

    const clearExpiryTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const forceLogout = () => {
      void logoutWithServer().finally(() => {
        navigate(appRoutes.login, { replace: true });
      });
    };

    const scheduleExpiry = () => {
      clearExpiryTimer();
      const expMs = getTokenExpiryMs();
      if (!expMs) return;

      const delay = expMs - Date.now();
      if (delay <= 0) {
        forceLogout();
        return;
      }

      if (delay > MAX_TIMEOUT_MS) {
        timeoutId = window.setTimeout(syncAuth, MAX_TIMEOUT_MS);
        return;
      }

      timeoutId = window.setTimeout(forceLogout, delay);
    };

    const syncAuth = () => {
      const token = getToken();
      if (!token) {
        disconnectPresenceSocket();
        clearExpiryTimer();
        return;
      }

      if (isTokenExpired(token)) {
        forceLogout();
        return;
      }

      connectPresenceSocket();
      scheduleExpiry();
    };

    syncAuth();

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "token") return;
      if (!e.newValue) {
        navigate(appRoutes.login, { replace: true });
        return;
      }
      syncAuth();
    };

    const unsubscribe = onAuthChanged(syncAuth);

    window.addEventListener("storage", handleStorage);
    return () => {
      clearExpiryTimer();
      disconnectPresenceSocket();
      window.removeEventListener("storage", handleStorage);
      unsubscribe();
    };
  }, [navigate]);
}
