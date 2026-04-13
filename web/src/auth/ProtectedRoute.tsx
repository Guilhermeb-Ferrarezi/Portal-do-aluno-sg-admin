import { Navigate, Outlet } from "react-router-dom";
import { hasRole, isLoggedIn } from "./auth";
import type { Role } from "./auth";
import { appRoutes } from "@/router/routes";

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  if (!isLoggedIn()) {
    return <Navigate to={appRoutes.login} replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to={appRoutes.dashboard} replace />;
  }

  return <Outlet />;
}
