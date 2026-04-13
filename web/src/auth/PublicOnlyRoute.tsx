import { Navigate, Outlet } from "react-router-dom";
import { isLoggedIn } from "./auth";
import { appRoutes } from "@/router/routes";

export default function PublicOnlyRoute() {
  if (isLoggedIn()) return <Navigate to={appRoutes.dashboard} replace />;
  return <Outlet />;
}
