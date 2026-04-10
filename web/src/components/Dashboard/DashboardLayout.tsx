import type { ReactNode } from "react";
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  clearStudentViewReturnUrl,
  getName,
  getRole,
  getStudentViewReturnUrl,
  hasRole,
  setStudentViewReturnUrl,
} from "../../auth/auth";
import {
  listarTurmas,
  logoutWithServer,
  obterUsuarioAtual,
  startStudentViewSso,
  type Turma,
} from "../../services/api";
import ProfilePopup from "../ProfilePopup";
import SettingsOverlay from "../SettingsOverlay";
import { cn } from "@/lib/utils";
import { useToastActions } from "@/contexts/ToastContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  GraduationCap,
  X,
  Home,
  PenLine,
  FileText,
  Play,
  School,
  Users,
  User,
  Plus,
  Blocks,
  KeyRound,
  BarChart3,
  Bell,
  Settings,
  Menu,
  Laptop,
  Monitor,
  ArrowRight,
  ArrowLeft,
  Medal,
  ChevronDown,
  BookOpen,
} from "lucide-react";

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function readStoredDropdownState(key: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "true";
}

function roleLabel(role: string | null) {
  if (role === "admin") return "Administrador";
  if (role === "professor") return "Professor";
  return "Aluno";
}

function navItemClass(active: boolean, nested = false) {
  return cn(
    "group flex w-full items-center gap-3 rounded-2xl border text-left transition duration-200",
    nested ? "px-3 py-2.5 pl-10 text-[13px] font-medium" : "px-3.5 py-3 text-sm font-semibold",
    active
      ? "border-primary/30 bg-primary/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      : "border-transparent text-white/72 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
  );
}

function sectionToggleClass(active: boolean) {
  return cn(
    "group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition duration-200",
    active
      ? "border-primary/30 bg-primary/12 text-white"
      : "border-transparent text-white/72 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
  );
}

export default function DashboardLayout({
  title,
  subtitle,
  children,
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const canCreateUser = hasRole(["admin"]);
  const canOpenStudentView = hasRole(["admin", "professor"]);
  const name = getName() ?? "Aluno";
  const role = getRole();
  const { addToast } = useToastActions();
  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [modalSelecionarTurmaAberto, setModalSelecionarTurmaAberto] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [profilePopupOpen, setProfilePopupOpen] = React.useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = React.useState<string>("");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [studentViewPending, setStudentViewPending] = React.useState(false);
  const [studentViewReturnUrl, setStudentViewReturnUrlState] = React.useState<string | null>(() =>
    getStudentViewReturnUrl()
  );
  const [estruturaOpen, setEstruturaOpen] = React.useState(() =>
    readStoredDropdownState("dashboard.sidebar.estruturaOpen")
  );
  const [usuariosOpen, setUsuariosOpen] = React.useState(() =>
    readStoredDropdownState("dashboard.sidebar.usuariosOpen")
  );
  const sbBottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listarTurmas()
      .then(setTurmas)
      .catch((e) => console.error("Erro ao carregar turmas:", e));
  }, []);

  React.useEffect(() => {
    obterUsuarioAtual()
      .then((user) => setProfilePictureUrl(user.profilePictureUrl ?? ""))
      .catch((e) => console.error("Erro ao carregar perfil atual:", e));
  }, [settingsOpen]);

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    setStudentViewReturnUrlState(getStudentViewReturnUrl());
  }, [location.pathname]);

  const isDashboard = location.pathname === "/dashboard";
  const isExercicios = location.pathname === "/dashboard/exercicios";
  const isMateriais = location.pathname === "/dashboard/materiais";
  const isVideoaulas = location.pathname === "/dashboard/videoaulas";
  const isMedalhas = location.pathname === "/dashboard/medalhas";
  const isCreateUser = location.pathname === "/dashboard/criar-usuario";
  const isAdminUsers = location.pathname === "/dashboard/usuarios";
  const isEstruturaCurso = location.pathname.startsWith("/dashboard/estrutura-curso");
  const isActivityLogs = location.pathname === "/dashboard/logs";
  const isTurmas = location.pathname.startsWith("/dashboard/turmas");

  React.useEffect(() => {
    if (isEstruturaCurso || isExercicios || isTurmas) {
      setEstruturaOpen(true);
    }
  }, [isEstruturaCurso, isExercicios, isTurmas]);

  React.useEffect(() => {
    if (isAdminUsers || isCreateUser) {
      setUsuariosOpen(true);
    }
  }, [isAdminUsers, isCreateUser]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard.sidebar.estruturaOpen", String(estruturaOpen));
  }, [estruturaOpen]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard.sidebar.usuariosOpen", String(usuariosOpen));
  }, [usuariosOpen]);

  function handleLogout() {
    void logoutWithServer().finally(() => {
      navigate("/login", { replace: true });
    });
  }

  function handleOpenStudentView() {
    if (studentViewPending) return;

    setStudentViewPending(true);
    setStudentViewReturnUrl(window.location.href);
    setStudentViewReturnUrlState(window.location.href);
    void startStudentViewSso()
      .then(({ redirectUrl }) => {
        window.location.assign(redirectUrl);
      })
      .catch((error) => {
        clearStudentViewReturnUrl();
        setStudentViewReturnUrlState(null);
        addToast(
          error instanceof Error ? error.message : "Nao foi possivel abrir a visao do aluno.",
          "error"
        );
        setStudentViewPending(false);
      });
  }

  function handleReturnFromStudentView() {
    if (!studentViewReturnUrl) return;
    clearStudentViewReturnUrl();
    setStudentViewReturnUrlState(null);
    window.location.assign(studentViewReturnUrl);
  }

  function handleMinhasTurmas() {
    if (role === "aluno") {
      if (turmas.length === 0) {
        navigate("/dashboard");
      } else if (turmas.length === 1) {
        navigate(`/dashboard/turmas/${turmas[0].id}`);
      } else {
        setModalSelecionarTurmaAberto(true);
      }
    } else {
      navigate("/dashboard/turmas");
    }
  }

  const pageSubtitle = subtitle ?? `Bem-vindo de volta, ${name}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu lateral"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17.5rem] max-w-[88vw] flex-col border-r border-white/8 bg-[radial-gradient(circle_at_top,rgba(225,29,46,0.14),transparent_30%),linear-gradient(180deg,rgba(18,25,40,0.98),rgba(11,17,29,1))] text-white shadow-[0_32px_80px_-28px_rgba(0,0,0,0.95)] transition-transform duration-300 lg:max-w-none lg:translate-x-0 lg:w-[15rem] xl:w-[17.5rem]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex min-h-[5rem] items-center justify-between gap-3 border-b border-white/8 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/12 text-primary-foreground shadow-[0_12px_28px_-18px_rgba(225,29,46,0.75)]">
              <GraduationCap size={20} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-[-0.03em] text-white">
                Santos Tech
              </div>
              <div className="mt-0.5 truncate text-xs font-medium text-white/50">
                Portal do Aluno
              </div>
            </div>
          </div>

          <button
            className="inline-flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
          <Link className={navItemClass(isDashboard)} to="/dashboard">
            <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
              <Home size={18} />
            </span>
            <span className="truncate">Dashboard</span>
          </Link>

          {!canCreateUser ? (
            <Link className={navItemClass(isExercicios)} to="/dashboard/exercicios">
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
                <PenLine size={18} />
              </span>
              <span className="truncate">Exercicios</span>
            </Link>
          ) : null}

          <Link className={navItemClass(isMateriais)} to="/dashboard/materiais">
            <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
              <FileText size={18} />
            </span>
            <span className="truncate">Materiais</span>
          </Link>

          <Link className={navItemClass(isVideoaulas)} to="/dashboard/videoaulas">
            <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
              <Play size={18} />
            </span>
            <span className="truncate">Videoaulas Bonus</span>
          </Link>

          <Link className={navItemClass(isMedalhas)} to="/dashboard/medalhas">
            <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
              <Medal size={18} />
            </span>
            <span className="truncate">Medalhas</span>
          </Link>

          {!canCreateUser && (role === "professor" || turmas.length > 0) ? (
            <button
              className={navItemClass(location.pathname.startsWith("/dashboard/turmas"))}
              onClick={handleMinhasTurmas}
              type="button"
            >
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
                <School size={18} />
              </span>
              <span className="truncate">Turmas</span>
            </button>
          ) : null}

          {canCreateUser ? (
            <>
              <div className="flex flex-col gap-2">
                <button
                  className={sectionToggleClass(isAdminUsers || isCreateUser)}
                  onClick={() => setUsuariosOpen((v) => !v)}
                  type="button"
                >
                  <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
                    <Users size={18} />
                  </span>
                  <span className="truncate">Usuarios</span>
                  <span
                    className={cn("ml-auto transition-transform duration-200", usuariosOpen && "rotate-180")}
                    aria-hidden="true"
                  >
                    <ChevronDown size={14} />
                  </span>
                </button>

                {usuariosOpen ? (
                  <div className="flex flex-col gap-1 pl-2">
                    <Link className={navItemClass(isAdminUsers, true)} to="/dashboard/usuarios">
                      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
                        <KeyRound size={16} />
                      </span>
                      <span className="truncate">Gerenciar Usuarios</span>
                    </Link>
                    <Link className={navItemClass(isCreateUser, true)} to="/dashboard/criar-usuario">
                      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
                        <Plus size={16} />
                      </span>
                      <span className="truncate">Criar Usuario</span>
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  className={sectionToggleClass(
                    isEstruturaCurso || isExercicios || isTurmas
                  )}
                  onClick={() => setEstruturaOpen((v) => !v)}
                  type="button"
                >
                  <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
                    <Blocks size={18} />
                  </span>
                  <span className="truncate">Estrutura do Curso</span>
                  <span
                    className={cn("ml-auto transition-transform duration-200", estruturaOpen && "rotate-180")}
                    aria-hidden="true"
                  >
                    <ChevronDown size={14} />
                  </span>
                </button>

                {estruturaOpen ? (
                  <div className="flex flex-col gap-1 pl-2">
                    <Link
                      className={navItemClass(isEstruturaCurso, true)}
                      to="/dashboard/estrutura-curso/cursos"
                    >
                      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
                        <BookOpen size={16} />
                      </span>
                      <span className="truncate">Criar Estrutura</span>
                    </Link>
                    <Link className={navItemClass(isExercicios, true)} to="/dashboard/exercicios">
                      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
                        <PenLine size={16} />
                      </span>
                      <span className="truncate">Exercicios</span>
                    </Link>
                    <Link
                      className={navItemClass(isTurmas, true)}
                      to="/dashboard/turmas"
                    >
                      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
                        <School size={16} />
                      </span>
                      <span className="truncate">Turmas</span>
                    </Link>
                  </div>
                ) : null}
              </div>

              <Link className={navItemClass(isActivityLogs)} to="/dashboard/logs">
                <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
                  <BarChart3 size={18} />
                </span>
                <span className="truncate">Logs de Atividade</span>
              </Link>
            </>
          ) : null}
        </nav>

        <div className="border-t border-white/8 p-4" ref={sbBottomRef}>
          <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_42px_-32px_rgba(0,0,0,0.95)]">
            <button
              className="cursor-pointer flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left transition hover:bg-white/[0.04]"
              type="button"
              onClick={() => setProfilePopupOpen((v) => !v)}
              aria-label="Ver perfil"
            >
              <Avatar className="size-11 border border-white/10 bg-[linear-gradient(135deg,rgba(139,92,246,0.95),rgba(168,85,247,0.7))] text-sm font-black text-white shadow-[0_14px_32px_-20px_rgba(139,92,246,0.95)]">
                {profilePictureUrl ? <AvatarImage src={profilePictureUrl} alt={name} /> : null}
                <AvatarFallback className="bg-transparent text-sm font-black text-white">
                  {name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{name}</div>
                <div className="mt-0.5 truncate text-xs font-medium text-white/55">
                  {roleLabel(role)}
                </div>
              </div>
            </button>

            <button
              className="cursor-pointer inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Configuracoes"
              aria-label="Configuracoes"
            >
              <Settings size={16} />
            </button>
          </div>

          {profilePopupOpen ? (
            <ProfilePopup
              name={name}
              role={role}
              profilePictureUrl={profilePictureUrl}
              anchorRef={sbBottomRef}
              onClose={() => setProfilePopupOpen(false)}
              onOpenSettings={() => {
                setProfilePopupOpen(false);
                setSettingsOpen(true);
              }}
            />
          ) : null}
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-[15rem] xl:pl-[17.5rem]">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/88 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[5rem] w-full max-w-[88rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-foreground transition hover:border-primary/30 hover:text-primary lg:hidden"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label="Abrir menu"
                aria-expanded={sidebarOpen}
                type="button"
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-[1.75rem] font-black tracking-[-0.04em] text-foreground sm:text-[2rem]">
                  {title}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">{pageSubtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {role === "aluno" && studentViewReturnUrl ? (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card px-3.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                  onClick={handleReturnFromStudentView}
                  type="button"
                  aria-label="Voltar ao portal anterior"
                  title="Voltar ao portal anterior"
                >
                  <ArrowLeft size={16} />
                  <span className="hidden sm:inline">Voltar</span>
                </button>
              ) : null}
              {canOpenStudentView ? (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card px-3.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleOpenStudentView}
                  type="button"
                  disabled={studentViewPending}
                  aria-label="Abrir visao do aluno"
                  title="Abrir visao do aluno"
                >
                  <Monitor size={16} />
                  <span className="hidden sm:inline">
                    {studentViewPending ? "Abrindo..." : "Visao do aluno"}
                  </span>
                  {!studentViewPending ? <ArrowRight size={14} className="hidden sm:inline" /> : null}
                </button>
              ) : null}
              <button
                className="relative inline-flex size-10 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                aria-label="Notificacoes"
                type="button"
              >
                <Bell size={18} />
                <span className="absolute right-2.5 top-2 size-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(255,255,255,0.08)] animate-pulse" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <SettingsOverlay
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={handleLogout}
      />

      <Dialog open={modalSelecionarTurmaAberto} onOpenChange={setModalSelecionarTurmaAberto}>
        <DialogContent className="max-w-2xl overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(24,33,51,0.98),rgba(15,21,35,1))] p-0 text-foreground shadow-[0_32px_90px_-40px_rgba(0,0,0,1)]">
          <DialogHeader className="gap-2 border-b border-border/60 pb-5">
            <DialogTitle>Selecione sua turma</DialogTitle>
            <DialogDescription>
              Voce esta inscrito em {turmas.length} turmas.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-6 pb-6">
            <div className="grid gap-3">
              {turmas.map((turma) => (
                <button
                  key={turma.id}
                  className="flex items-center gap-4 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-4 text-left transition hover:border-primary/30 hover:bg-muted/35"
                  onClick={() => {
                    setModalSelecionarTurmaAberto(false);
                    navigate(`/dashboard/turmas/${turma.id}`);
                  }}
                  type="button"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold tracking-[-0.02em] text-foreground">
                      {turma.nome}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {turma.tipo === "turma" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Users size={14} /> Turma (Grupo)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <User size={14} /> Turma Particular
                        </span>
                      )}
                      {turma.categoria ? (
                        turma.categoria === "programacao" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Laptop size={14} /> Programacao
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Monitor size={14} /> Informatica
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>

                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                    <ArrowRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
