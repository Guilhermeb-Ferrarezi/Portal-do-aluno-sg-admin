import { LazyMotion, domAnimation } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import Dashboard from "./components/Dashboard/Dashboard";
import DashboardLayout from "./components/Dashboard/DashboardLayout";
import CreateUser from "./components/Dashboard/Sidebar/CreateUser/CreateUser";
import Login from "./components/Login/Login";
import { ToastContainer } from "./components/ToastContainer";
import { ToastProvider } from "./contexts/ToastContext";
import { useAuthSession } from "./hooks/useAuthSession";
import { useTheme } from "./hooks/useTheme";
import ActivityLogsPage from "./pages/ActivityLogs";
import AdminObservabilityPage from "./pages/AdminObservability";
import AdminUsersPage from "./pages/AdminUsers";
import EstruturaCursoPage from "./pages/EstruturaCurso";
import ExerciseDetail from "./pages/ExerciseDetail";
import ExercisesPage from "./pages/Exercises";
import MateriaisPage from "./pages/Materiais";
import MedalhasPage from "./pages/Medalhas";
import MetasPage from "./pages/Metas";
import NotificationsPage from "./pages/Notifications";
import PerfilPage from "./pages/Perfil";
import SsoCallback from "./pages/SsoCallback";
import TurmaDetail from "./pages/TurmaDetail";
import TurmasPage from "./pages/Turmas";
import VideoaulaBonusPage from "./pages/VideoaulaBonus";
import { appRoutes } from "./router/routes";

const estruturaCursoTabs = [
  "cursos",
  "modulos",
  "fases",
  "exercicios",
  "conteiners",
  "turmas",
] as const;

function AppContent() {
  useTheme();
  useAuthSession();

  return (
    <Routes>
      <Route path={appRoutes.login} element={<Login />} />
      <Route path={appRoutes.authSso} element={<SsoCallback />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path={appRoutes.dashboard} element={<Dashboard />} />
          <Route path={appRoutes.content.exercicios} element={<ExercisesPage />} />
          <Route path={appRoutes.content.exercicioDetalhe(":id")} element={<ExerciseDetail />} />
          <Route path={appRoutes.content.materiais} element={<MateriaisPage />} />
          <Route path={appRoutes.content.videoaulas} element={<VideoaulaBonusPage />} />
          <Route path={appRoutes.operations.medalhas} element={<MedalhasPage />} />
          <Route path={appRoutes.operations.metas} element={<MetasPage />} />
          <Route path={appRoutes.profile} element={<PerfilPage />} />
          <Route path={appRoutes.operations.turmaDetalhe(":id")} element={<TurmaDetail />} />

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path={appRoutes.people.criar} element={<CreateUser />} />
            <Route path={appRoutes.people.usuarios} element={<AdminUsersPage />} />
            <Route path={appRoutes.operations.notificacoes} element={<NotificationsPage />} />
            {estruturaCursoTabs.map((tab) => (
              <Route key={tab} path={appRoutes.content.estruturaCurso.tab(tab)} element={<EstruturaCursoPage />} />
            ))}
            <Route path={appRoutes.content.estruturaCurso.base} element={<Navigate to={appRoutes.content.estruturaCurso.root} replace />} />
            <Route path={appRoutes.system.logs} element={<ActivityLogsPage />} />
            <Route path={appRoutes.system.observabilidade} element={<AdminObservabilityPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin", "professor"]} />}>
            <Route path={appRoutes.operations.turmas} element={<TurmasPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={appRoutes.dashboard} replace />} />
    </Routes>
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
