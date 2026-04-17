import { Navigate, Outlet } from "react-router-dom";
import { getRole, hasRole, isLoggedIn } from "./auth";
import type { Role } from "./auth";
import { appRoutes } from "@/router/routes";

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  if (!isLoggedIn()) {
    return <Navigate to={appRoutes.login} replace />;
  }

  if (getRole() === "aluno") {
    return <Navigate to={`${appRoutes.login}?access=admin-only`} replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to={appRoutes.dashboard} replace />;
  }

  return <Outlet />;
}
