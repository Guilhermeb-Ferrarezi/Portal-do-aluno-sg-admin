import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastContainer } from "./components/ToastContainer";
import { getToken, getTokenExpiryMs, isTokenExpired, logout, onAuthChanged } from "./auth/auth";

import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";
import CreateUser from "./components/Dashboard/Sidebar/CreateUser/CreateUser";
import ExerciciosPage from "./pages/Exercises";
import ExerciseDetail from "./pages/ExerciseDetail";
import ExerciseTemplates from "./pages/ExerciseTemplates";
import AdminUsersPage from "./pages/AdminUsers";
import ActivityLogsPage from "./pages/ActivityLogs";
import Turmas from "./pages/Turmas";
import TurmaDetail from "./pages/TurmaDetail";
import TrilhaCursoPage from "./pages/TrilhaCurso";
import MateriaisPage from "./pages/Materiais";
import VideoaulaBonusPage from "./pages/VideoaulaBonus";
import PerfilPage from "./pages/Perfil";

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
      logout();
      navigate("/login", { replace: true });
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
    <Routes>
      <Route path="/login" element={<Login />} />

        {/* logado */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* ✅ exercícios: qualquer logado (admin/prof/aluno) */}
          <Route path="/dashboard/exercicios" element={<ExerciciosPage />} />
          <Route
            path="/dashboard/exercicios/:id"
            element={<ExerciseDetail />}
          />
          <Route
            path="/exercicios"
            element={<Navigate to="/dashboard/exercicios" replace />}
          />

          {/* ✅ trilha do curso: qualquer logado */}
          <Route path="/dashboard/trilha" element={<TrilhaCursoPage />} />

          {/* ✅ materiais: qualquer logado */}
          <Route path="/dashboard/materiais" element={<MateriaisPage />} />

          {/* ✅ videoaulas bônus: qualquer logado */}
          <Route
            path="/dashboard/videoaulas"
            element={<VideoaulaBonusPage />}
          />

          {/* ✅ perfil: qualquer logado */}
          <Route path="/dashboard/perfil" element={<PerfilPage />} />

          <Route path="/dashboard/turmas/:id" element={<TurmaDetail />} />

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/dashboard/criar-usuario" element={<CreateUser />} />
            <Route
              path="/criar-usuario"
              element={<Navigate to="/dashboard/criar-usuario" replace />}
            />
            <Route path="/dashboard/templates" element={<ExerciseTemplates />} />
            <Route
              path="/templates"
              element={<Navigate to="/dashboard/templates" replace />}
            />
            <Route path="/dashboard/usuarios" element={<AdminUsersPage />} />
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppContent />
        <ToastContainer />
      </ToastProvider>
    </BrowserRouter>
  );
}
