import React from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import Login from "./components/Login/Login";
import { ToastContainer } from "./components/ToastContainer";
import { ToastProvider } from "./contexts/ToastContext";
import { useAuthSession } from "./hooks/useAuthSession";
import { useTheme } from "./hooks/useTheme";
import { usePrefersReducedMotion } from "./hooks/use-prefers-reduced-motion";
import { appRoutes } from "./router/routes";

const Dashboard = React.lazy(() => import("./components/Dashboard/Dashboard"));
const DashboardLayout = React.lazy(() => import("./components/Dashboard/DashboardLayout"));
const CreateUser = React.lazy(() => import("./components/Dashboard/Sidebar/CreateUser/CreateUser"));
const ActivityLogsPage = React.lazy(() => import("./pages/ActivityLogs"));
const AdminObservabilityPage = React.lazy(() => import("./pages/AdminObservability"));
const AdminUsersPage = React.lazy(() => import("./pages/AdminUsers"));
const EstruturaCursoPage = React.lazy(() => import("./pages/EstruturaCurso"));
const ExerciseDetail = React.lazy(() => import("./pages/ExerciseDetail"));
const ExercisesPage = React.lazy(() => import("./pages/Exercises"));
const MateriaisPage = React.lazy(() => import("./pages/Materiais"));
const MedalhasPage = React.lazy(() => import("./pages/Medalhas"));
const MetasPage = React.lazy(() => import("./pages/Metas"));
const NotificationsPage = React.lazy(() => import("./pages/Notifications"));
const RankingNotasPage = React.lazy(() => import("./pages/RankingNotas"));
const RankingPontosPage = React.lazy(() => import("./pages/RankingPontos"));
const RankingEventosPage = React.lazy(() => import("./pages/RankingEventos"));
const PasswordRecoveryPage = React.lazy(() => import("./pages/PasswordRecovery"));
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

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-10">
      <div className="rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm text-muted-foreground shadow-sm">
        Carregando...
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={location.pathname}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
        className="min-h-screen"
      >
        <Routes location={location}>
          <Route path={appRoutes.login} element={<Login />} />
          <Route path={appRoutes.passwordRecovery} element={<PasswordRecoveryPage />} />
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
                <Route path={appRoutes.operations.rankings.notas} element={<RankingNotasPage />} />
                <Route path={appRoutes.operations.rankings.pontos} element={<RankingPontosPage />} />
                <Route path={appRoutes.operations.rankings.eventos} element={<RankingEventosPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to={appRoutes.dashboard} replace />} />
        </Routes>
      </m.div>
    </AnimatePresence>
  );
}

function AppContent() {
  useTheme();
  useAuthSession();

  return (
    <React.Suspense fallback={<RouteFallback />}>
      <AnimatedRoutes />
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
