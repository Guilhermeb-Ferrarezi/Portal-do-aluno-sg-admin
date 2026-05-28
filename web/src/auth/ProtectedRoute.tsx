import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { setAuthUser, type AuthUser, type Role } from "./auth";
import { appRoutes } from "@/router/routes";
import { connectPresenceSocket } from "@/services/presenceSocket";
const AUTH_ORIGIN = "https://auth.santos-tech.com";
const STUDENT_PORTAL = "https://portal.santos-tech.com";
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string | undefined ?? "https://api.santos-tech.com";

type Status = "checking" | "ok" | "forbidden";

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const [status, setStatus] = useState<Status>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch(`${AUTH_API_URL}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          window.location.replace(`${AUTH_ORIGIN}?redirect=${encodeURIComponent(window.location.href)}`);
          return null;
        }
        if (!res.ok) throw new Error("auth_check_failed");
        return res.json() as Promise<{ user: AuthUser }>;
      })
      .then((data) => {
        if (!data) return;
        setAuthUser(data.user);
        setUser(data.user);
        connectPresenceSocket();
        setStatus("ok");
      })
      .catch(() => {
        window.location.replace(AUTH_ORIGIN);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (status === "forbidden") {
    return <Navigate to={appRoutes.dashboard} replace />;
  }

  // Block student role from admin portal — vai direto para o portal do aluno
  if (user && user.role === 1) {
    window.location.replace(STUDENT_PORTAL);
    return null;
  }

  if (allowedRoles && user) {
    const hasAllowed = allowedRoles.some((r) => {
      if (r === "admin") return user.role === 3;
      if (r === "professor") return user.role === 2;
      return false;
    });

    if (!hasAllowed) return <Navigate to={appRoutes.dashboard} replace />;
  }

  return <Outlet />;
}
