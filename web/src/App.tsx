import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastContainer } from "./components/ToastContainer";

import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";
import CreateUser from "./components/Dashboard/Sidebar/CreateUser/CreateUser";
import ExerciciosPage from "./pages/Exercises";
import ExerciseDetail from "./pages/ExerciseDetail";
import ExerciseTemplates from "./pages/ExerciseTemplates";
import AdminUsersPage from "./pages/AdminUsers";
import Turmas from "./pages/Turmas";
import TurmaDetail from "./pages/TurmaDetail";
import TrilhaCursoPage from "./pages/TrilhaCurso";
import MateriaisPage from "./pages/Materiais";
import VideoaulaBonusPage from "./pages/VideoaulaBonus";
import PerfilPage from "./pages/Perfil";

function AppContent() {
  useTheme();

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
