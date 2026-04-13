import React from "react";
import { LazyMotion, domAnimation } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ToastContainer } from "./components/ToastContainer";
import { ToastProvider } from "./contexts/ToastContext";
import { useAuthSession } from "./hooks/useAuthSession";
import { useTheme } from "./hooks/useTheme";
import { appRoutes } from "./router/routes";

const Login = React.lazy(() => import("./components/Login/Login"));
const Dashboard = React.lazy(() => import("./components/Dashboard/Dashboard"));
const CreateUser = React.lazy(() => import("./components/Dashboard/Sidebar/CreateUser/CreateUser"));
const ActivityLogsPage = React.lazy(() => import("./pages/ActivityLogs"));
const AdminObservabilityPage = React.lazy(() => import("./pages/AdminObservability"));
const AdminUsersPage = React.lazy(() => import("./pages/AdminUsers"));
const EstruturaCursoPage = React.lazy(() => import("./pages/EstruturaCurso"));
const ExerciseDetail = React.lazy(() => import("./pages/ExerciseDetail"));
const ExercisesPage = React.lazy(() => import("./pages/Exercises"));
const MateriaisPage = React.lazy(() => import("./pages/Materiais"));
const MedalhasPage = React.lazy(() => import("./pages/Medalhas"));
const PerfilPage = React.lazy(() => import("./pages/Perfil"));
const SsoCallback = React.lazy(() => import("./pages/SsoCallback"));
const TurmaDetail = React.lazy(() => import("./pages/TurmaDetail"));
const TurmasPage = React.lazy(() => import("./pages/Turmas"));
const VideoaulaBonusPage = React.lazy(() => import("./pages/VideoaulaBonus"));

const estruturaCursoTabs = [
  "cursos",
  "modulos",
  "fases",
  "exercicios",
  "conteiners",
  "turmas",
] as const;

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
  useAuthSession();

  return (
    <React.Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path={appRoutes.login} element={<Login />} />
        <Route path={appRoutes.authSso} element={<SsoCallback />} />

        <Route element={<ProtectedRoute />}>
          <Route path={appRoutes.dashboard} element={<Dashboard />} />
          <Route path={appRoutes.exercicios} element={<ExercisesPage />} />
          <Route path={appRoutes.exercicioDetalhe(":id")} element={<ExerciseDetail />} />
          <Route path={appRoutes.aliases.exercicios} element={<Navigate to={appRoutes.exercicios} replace />} />
          <Route path={appRoutes.materiais} element={<MateriaisPage />} />
          <Route path={appRoutes.videoaulas} element={<VideoaulaBonusPage />} />
          <Route path={appRoutes.medalhas} element={<MedalhasPage />} />
          <Route path={appRoutes.perfil} element={<PerfilPage />} />
          <Route path={appRoutes.turmaDetalhe(":id")} element={<TurmaDetail />} />

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path={appRoutes.criarUsuario} element={<CreateUser />} />
            <Route path={appRoutes.aliases.criarUsuario} element={<Navigate to={appRoutes.criarUsuario} replace />} />
            <Route path={appRoutes.usuarios} element={<AdminUsersPage />} />
            {estruturaCursoTabs.map((tab) => (
              <Route key={tab} path={appRoutes.estruturaCurso.tab(tab)} element={<EstruturaCursoPage />} />
            ))}
            <Route path={appRoutes.estruturaCurso.base} element={<Navigate to={appRoutes.estruturaCurso.root} replace />} />
            <Route path={appRoutes.aliases.usuarios} element={<Navigate to={appRoutes.usuarios} replace />} />
            <Route path={appRoutes.logs} element={<ActivityLogsPage />} />
            <Route path={appRoutes.observabilidade} element={<AdminObservabilityPage />} />
            <Route path={appRoutes.aliases.logs} element={<Navigate to={appRoutes.logs} replace />} />
            <Route path={appRoutes.aliases.observabilidade} element={<Navigate to={appRoutes.observabilidade} replace />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin", "professor"]} />}>
            <Route path={appRoutes.turmas} element={<TurmasPage />} />
            <Route path={appRoutes.aliases.turmas} element={<Navigate to={appRoutes.turmas} replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={appRoutes.dashboard} replace />} />
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
