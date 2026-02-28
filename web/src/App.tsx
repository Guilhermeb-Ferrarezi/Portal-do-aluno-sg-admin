import React, { useEffect } from "react";
import { LazyMotion, domAnimation } from "framer-motion";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastContainer } from "./components/ToastContainer";
import { getToken, getTokenExpiryMs, isTokenExpired, onAuthChanged } from "./auth/auth";
import { logoutWithServer } from "./services/api";

const Login = React.lazy(() => import("./components/Login/Login"));
const Dashboard = React.lazy(() => import("./components/Dashboard/Dashboard"));
const CreateUser = React.lazy(() => import("./components/Dashboard/Sidebar/CreateUser/CreateUser"));
const ExerciciosPage = React.lazy(() => import("./pages/Exercises"));
const ExerciseDetail = React.lazy(() => import("./pages/ExerciseDetail"));
const AdminUsersPage = React.lazy(() => import("./pages/AdminUsers"));
const ActivityLogsPage = React.lazy(() => import("./pages/ActivityLogs"));
const Turmas = React.lazy(() => import("./pages/Turmas"));
const TurmaDetail = React.lazy(() => import("./pages/TurmaDetail"));
const EstruturaCursoPage = React.lazy(() => import("./pages/EstruturaCurso"));
const MateriaisPage = React.lazy(() => import("./pages/Materiais"));
const VideoaulaBonusPage = React.lazy(() => import("./pages/VideoaulaBonus"));
const PerfilPage = React.lazy(() => import("./pages/Perfil"));
const MedalhasPage = React.lazy(() => import("./pages/Medalhas"));

function RouteLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        color: "var(--muted)",
        fontWeight: 600,
      }}
    >
      Carregando...
    </div>
  );
}

function AppContent() {
  useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: number | null = null;
    const MAX_TIMEOUT_MS = 2_147_483_647;

    const clearExpiryTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const forceLogout = () => {
      void logoutWithServer().finally(() => {
        navigate("/login", { replace: true });
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
        clearExpiryTimer();
        return;
      }

      if (isTokenExpired(token)) {
        forceLogout();
        return;
      }

      scheduleExpiry();
    };

    syncAuth();

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "token") return;
      if (!e.newValue) {
        navigate("/login", { replace: true });
        return;
      }
      syncAuth();
    };

    const unsubscribe = onAuthChanged(syncAuth);

    window.addEventListener("storage", handleStorage);
    return () => {
      clearExpiryTimer();
      window.removeEventListener("storage", handleStorage);
      unsubscribe();
    };
  }, [navigate]);

  return (
    <React.Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* logado */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* exercicios: qualquer logado (admin/prof/aluno) */}
          <Route path="/dashboard/exercicios" element={<ExerciciosPage />} />
          <Route
            path="/dashboard/exercicios/:id"
            element={<ExerciseDetail />}
          />
          <Route
            path="/exercicios"
            element={<Navigate to="/dashboard/exercicios" replace />}
          />

          {/* materiais: qualquer logado */}
          <Route path="/dashboard/materiais" element={<MateriaisPage />} />

          {/* videoaulas bonus: qualquer logado */}
          <Route
            path="/dashboard/videoaulas"
            element={<VideoaulaBonusPage />}
          />

          {/* medalhas: qualquer logado */}
          <Route path="/dashboard/medalhas" element={<MedalhasPage />} />

          {/* perfil: qualquer logado */}
          <Route path="/dashboard/perfil" element={<PerfilPage />} />

          <Route path="/dashboard/turmas/:id" element={<TurmaDetail />} />

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/dashboard/criar-usuario" element={<CreateUser />} />
            <Route
              path="/criar-usuario"
              element={<Navigate to="/dashboard/criar-usuario" replace />}
            />
            <Route path="/dashboard/usuarios" element={<AdminUsersPage />} />
            <Route path="/dashboard/estrutura-curso/cursos" element={<EstruturaCursoPage />} />
            <Route path="/dashboard/estrutura-curso/modulos" element={<EstruturaCursoPage />} />
            <Route path="/dashboard/estrutura-curso/fases" element={<EstruturaCursoPage />} />
            <Route
              path="/dashboard/estrutura-curso"
              element={<Navigate to="/dashboard/estrutura-curso/cursos" replace />}
            />
            <Route
              path="/usuarios"
              element={<Navigate to="/dashboard/usuarios" replace />}
            />
            <Route path="/dashboard/logs" element={<ActivityLogsPage />} />
            <Route
              path="/logs"
              element={<Navigate to="/dashboard/logs" replace />}
            />
          </Route>

          <Route
            element={<ProtectedRoute allowedRoles={["admin", "professor"]} />}
          >
            <Route path="/dashboard/turmas" element={<Turmas />} />
            <Route
              path="/turmas"
              element={<Navigate to="/dashboard/turmas" replace />}
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </React.Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LazyMotion features={domAnimation}>
        <ToastProvider>
          <AppContent />
          <ToastContainer />
        </ToastProvider>
      </LazyMotion>
    </BrowserRouter>
  );
}
