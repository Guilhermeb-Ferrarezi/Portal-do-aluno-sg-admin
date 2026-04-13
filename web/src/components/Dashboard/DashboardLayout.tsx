import type { ReactNode } from "react";
import React from "react";
import { m } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getName, getRole, hasRole } from "../../auth/auth";
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
import { appRoutes, isExactRoute, isRouteBranch } from "@/router/routes";
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
  Medal,
  ChevronDown,
  BookOpen,
  Radar,
  Slash,
  type LucideIcon,
} from "lucide-react";

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

type BreadcrumbItem = {
  label: string;
  to?: string;
  icon: LucideIcon;
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

const NAV_ITEM_BASE =
  "flex w-full items-center gap-3 rounded-[0.85rem] border text-left transition-all duration-200";
const NAV_ITEM_ACTIVE =
  "border-[var(--sidebar-item-active-border)] bg-[var(--sidebar-item-active-bg)] text-[var(--sidebar-item-active-text)] font-semibold";
const NAV_ITEM_IDLE =
  "border-transparent text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-item-hover-bg)] hover:text-[var(--sidebar-text)]";

const iconSpring = { type: "spring", stiffness: 500, damping: 18 } as const;
const iconHover = { scale: 1.22, y: -3 } as const;
const iconRest = { scale: 1, y: 0 } as const;

function NavLinkItem({
  to,
  active,
  nested = false,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  nested?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <Link
      className={cn(
        NAV_ITEM_BASE,
        nested ? "px-3 py-2.5 pl-10 text-[13px] font-medium" : "px-3.5 py-3 text-sm font-semibold",
        active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE
      )}
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <m.span
        className={cn("grid shrink-0 place-items-center", nested ? "size-4" : "size-5")}
        animate={hovered ? iconHover : iconRest}
        transition={iconSpring}
        aria-hidden="true"
      >
        {icon}
      </m.span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavButtonItem({
  onClick,
  active,
  icon,
  label,
}: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      className={cn(NAV_ITEM_BASE, "px-3.5 py-3 text-sm font-semibold", active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE)}
      onClick={onClick}
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <m.span
        className="grid size-5 shrink-0 place-items-center"
        animate={hovered ? iconHover : iconRest}
        transition={iconSpring}
        aria-hidden="true"
      >
        {icon}
      </m.span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function NavSectionToggle({
  active,
  open,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  open: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      className={cn(NAV_ITEM_BASE, "px-3.5 py-3 text-sm font-semibold", active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE)}
      onClick={onClick}
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <m.span
        className="grid size-5 shrink-0 place-items-center"
        animate={hovered ? iconHover : iconRest}
        transition={iconSpring}
        aria-hidden="true"
      >
        {icon}
      </m.span>
      <span className="truncate">{label}</span>
      <m.span
        className="ml-auto"
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        aria-hidden="true"
      >
        <ChevronDown size={14} />
      </m.span>
    </button>
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

  const isDashboard = isExactRoute(location.pathname, appRoutes.dashboard);
  const isExercicios = isExactRoute(location.pathname, appRoutes.exercicios);
  const isMateriais = isExactRoute(location.pathname, appRoutes.materiais);
  const isVideoaulas = isExactRoute(location.pathname, appRoutes.videoaulas);
  const isMedalhas = isExactRoute(location.pathname, appRoutes.medalhas);
  const isCreateUser = isExactRoute(location.pathname, appRoutes.criarUsuario);
  const isAdminUsers = isExactRoute(location.pathname, appRoutes.usuarios);
  const isEstruturaCurso = isRouteBranch(location.pathname, appRoutes.estruturaCurso.base);
  const isActivityLogs = isExactRoute(location.pathname, appRoutes.logs);
  const isObservability = isExactRoute(location.pathname, appRoutes.observabilidade);
  const isTurmas = isRouteBranch(location.pathname, appRoutes.turmas);

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
      navigate(appRoutes.login, { replace: true });
    });
  }

  function handleOpenStudentView() {
    if (studentViewPending) return;

    setStudentViewPending(true);
    void startStudentViewSso(window.location.href)
      .then(({ redirectUrl }) => {
        window.location.assign(redirectUrl);
      })
      .catch((error) => {
        addToast(
          error instanceof Error ? error.message : "Nao foi possivel abrir a visao do aluno.",
          "error"
        );
        setStudentViewPending(false);
      });
  }

  function handleMinhasTurmas() {
    if (role === "aluno") {
      if (turmas.length === 0) {
        navigate(appRoutes.dashboard);
      } else if (turmas.length === 1) {
        navigate(appRoutes.turmaDetalhe(turmas[0].id));
      } else {
        setModalSelecionarTurmaAberto(true);
      }
    } else {
      navigate(appRoutes.turmas);
    }
  }

  const pageSubtitle = subtitle ?? `Bem-vindo de volta, ${name}`;
  const breadcrumbs: BreadcrumbItem[] = React.useMemo(() => {
    if (isDashboard) {
      return [
        { label: "", icon: Home },
      ];
    }

    if (isMateriais) {
      return [
        { label: "Dashboard", to: appRoutes.dashboard, icon: Home },
        { label: "Materiais", icon: FileText },
      ];
    }

    if (isVideoaulas) {
      return [
        { label: "Dashboard", to: appRoutes.dashboard, icon: Home },
        { label: "Videoaulas Bonus", icon: Play },
      ];
    }

    if (isMedalhas) {
      return [
        { label: "Dashboard", to: appRoutes.dashboard, icon: Home },
        { label: "Medalhas", icon: Medal },
      ];
    }

    if (isActivityLogs) {
      return [
        { label: "Operacao", to: appRoutes.dashboard, icon: BarChart3 },
        { label: "Logs de Atividade", icon: BarChart3 },
      ];
    }

    if (isObservability) {
      return [
        { label: "Operacao", to: appRoutes.dashboard, icon: Radar },
        { label: "Observabilidade", icon: Radar },
      ];
    }

    if (isAdminUsers || isCreateUser) {
      return [
        { label: "Usuarios", to: appRoutes.dashboard, icon: Users },
        { label: isCreateUser ? "Criar Usuario" : "Gerenciar Usuarios", icon: isCreateUser ? Plus : KeyRound },
      ];
    }

    if (isEstruturaCurso) {
      return [
        { label: "Criar Estrutura", to: appRoutes.dashboard, icon: Blocks },
        { label: title, icon: BookOpen },
      ];
    }

    if (isExercicios) {
      return [
        { label: "Estrutura do Curso", to: appRoutes.dashboard, icon: Blocks },
        { label: "Exercicios", icon: PenLine },
      ];
    }

    if (isTurmas) {
      return [
        { label: "Estrutura do Curso", to: appRoutes.dashboard, icon: Blocks },
        { label: "Turmas", icon: School },
      ];
    }

    return [
      { label: "Workspace", to: appRoutes.dashboard, icon: Home },
      { label: title, icon: Home },
    ];
  }, [
    isActivityLogs,
    isAdminUsers,
    isCreateUser,
    isDashboard,
    isEstruturaCurso,
    isExercicios,
    isMateriais,
    isMedalhas,
    isObservability,
    isTurmas,
    isVideoaulas,
    title,
  ]);
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
          "fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[88vw] flex-col border-r transition-transform duration-300 lg:max-w-none lg:translate-x-0 lg:w-[16rem] xl:w-[18rem]",
          "border-[var(--sidebar-border-color)] bg-[var(--sidebar-color)]",
          "dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_28%),linear-gradient(180deg,rgba(17,22,33,0.99),rgba(10,13,20,1))] dark:shadow-[0_32px_80px_-28px_rgba(0,0,0,0.95)]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex min-h-[5.75rem] items-center justify-between gap-3 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCap size={20} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold tracking-[-0.04em] text-[var(--sidebar-text)]">
                Santos Tech
              </div>
              <div className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sidebar-text-secondary)]">
                Portal administrativo
              </div>
            </div>
          </div>

          <button
            className="inline-flex size-10 items-center justify-center rounded-[1rem] border border-[var(--sidebar-item-hover-border)] bg-[var(--sidebar-item-hover-bg)] text-[var(--sidebar-text-secondary)] transition hover:text-[var(--sidebar-text)] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            type="button"
          >
            <X size={18} />
          </button>
        </div>


        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-4">
          <NavLinkItem to={appRoutes.dashboard} active={isDashboard} icon={<Home size={18} />} label="Dashboard" />

          {!canCreateUser ? (
            <NavLinkItem to={appRoutes.exercicios} active={isExercicios} icon={<PenLine size={18} />} label="Exercicios" />
          ) : null}

          <NavLinkItem to={appRoutes.materiais} active={isMateriais} icon={<FileText size={18} />} label="Materiais" />
          <NavLinkItem to={appRoutes.videoaulas} active={isVideoaulas} icon={<Play size={18} />} label="Videoaulas Bonus" />
          <NavLinkItem to={appRoutes.medalhas} active={isMedalhas} icon={<Medal size={18} />} label="Medalhas" />

          {!canCreateUser && (role === "professor" || turmas.length > 0) ? (
            <NavButtonItem onClick={handleMinhasTurmas} active={isTurmas} icon={<School size={18} />} label="Turmas" />
          ) : null}

          {canCreateUser ? (
            <>
              <div className="flex flex-col gap-2">
                <NavSectionToggle
                  active={isAdminUsers || isCreateUser}
                  open={usuariosOpen}
                  icon={<Users size={18} />}
                  label="Usuarios"
                  onClick={() => setUsuariosOpen((v) => !v)}
                />

                {usuariosOpen ? (
                  <div className="flex flex-col gap-1 pl-2">
                    <NavLinkItem to={appRoutes.usuarios} active={isAdminUsers} nested icon={<KeyRound size={16} />} label="Gerenciar Usuarios" />
                    <NavLinkItem to={appRoutes.criarUsuario} active={isCreateUser} nested icon={<Plus size={16} />} label="Criar Usuario" />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <NavSectionToggle
                  active={isEstruturaCurso || isExercicios || isTurmas}
                  open={estruturaOpen}
                  icon={<Blocks size={18} />}
                  label="Estrutura do Curso"
                  onClick={() => setEstruturaOpen((v) => !v)}
                />

                {estruturaOpen ? (
                  <div className="flex flex-col gap-1 pl-2">
                    <NavLinkItem to={appRoutes.estruturaCurso.root} active={isEstruturaCurso} nested icon={<BookOpen size={16} />} label="Criar Estrutura" />
                    <NavLinkItem to={appRoutes.exercicios} active={isExercicios} nested icon={<PenLine size={16} />} label="Exercicios" />
                    <NavLinkItem to={appRoutes.turmas} active={isTurmas} nested icon={<School size={16} />} label="Turmas" />
                  </div>
                ) : null}
              </div>

              <NavLinkItem to={appRoutes.logs} active={isActivityLogs} icon={<BarChart3 size={18} />} label="Logs de Atividade" />
              <NavLinkItem to={appRoutes.observabilidade} active={isObservability} icon={<Radar size={18} />} label="Observabilidade" />
            </>
          ) : null}

        </nav>

        <div className="p-4" ref={sbBottomRef}>
          <div className="flex items-center gap-3 rounded-[1rem] border border-border bg-muted/40 p-2 transition hover:bg-muted/60 dark:border-transparent dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] dark:shadow-[0_18px_42px_-32px_rgba(0,0,0,0.95)]">
            <button
              className="cursor-pointer flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition hover:opacity-80"
              type="button"
              onClick={() => setProfilePopupOpen((v) => !v)}
              aria-label="Ver perfil"
            >
              <Avatar className="size-10 border border-border bg-muted text-sm font-bold text-foreground shadow-sm">
                {profilePictureUrl ? <AvatarImage src={profilePictureUrl} alt={name} /> : null}
                <AvatarFallback className="bg-transparent text-sm font-black text-[var(--primary-ink)]">
                  {name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--sidebar-text)]">{name}</div>
                <div className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-text-secondary)]">
                  {roleLabel(role)}
                </div>
              </div>
            </button>

            <button
              className="cursor-pointer inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition hover:bg-muted hover:text-foreground dark:bg-white/[0.05]"
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

      <div className="flex min-h-screen flex-col lg:pl-[16rem] xl:pl-[18rem]">
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[96rem] items-center justify-between gap-4 px-6 pt-5 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition hover:text-primary lg:hidden"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label="Abrir menu"
                aria-expanded={sidebarOpen}
                type="button"
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[0.8rem] font-medium text-muted-foreground">
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    const content = (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          isLast ? "font-semibold text-foreground" : "hover:text-foreground"
                        )}
                      >
                        <span>{crumb.label}</span>
                      </span>
                    );

                    return (
                      <React.Fragment key={`${crumb.label}-${index}`}>
                        {crumb.to && !isLast ? (
                          <Link to={crumb.to} className="transition">
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                        {!isLast ? <Slash size={12} className="text-border" /> : null}
                      </React.Fragment>
                    );
                  })}
                </div>
                <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
                  {title}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {pageSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canOpenStudentView ? (
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleOpenStudentView}
                  type="button"
                  disabled={studentViewPending}
                  aria-label="Abrir visao do aluno"
                  title="Abrir visao do aluno"
                >
                  <Monitor size={14} />
                  <span className="hidden sm:inline">
                    {studentViewPending ? "Abrindo..." : "Visao do aluno"}
                  </span>
                </button>
              ) : null}
              <button
                className="relative inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-muted/50 hover:text-foreground"
                aria-label="Notificacoes"
                type="button"
              >
                <Bell size={18} />
                <span className="absolute right-2.5 top-2 size-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(255,255,255,0.08)] animate-pulse" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <SettingsOverlay
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={handleLogout}
      />

      <Dialog open={modalSelecionarTurmaAberto} onOpenChange={setModalSelecionarTurmaAberto}>
        <DialogContent className="max-w-2xl overflow-hidden border-border/70 bg-card p-0 text-foreground shadow-[0_32px_90px_-40px_rgba(0,0,0,0.4)] dark:bg-[linear-gradient(180deg,rgba(24,33,51,0.98),rgba(15,21,35,1))] dark:shadow-[0_32px_90px_-40px_rgba(0,0,0,1)]">
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
                    navigate(appRoutes.turmaDetalhe(turma.id));
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
