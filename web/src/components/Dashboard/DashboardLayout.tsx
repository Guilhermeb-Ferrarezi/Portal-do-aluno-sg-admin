import type { ReactNode } from "react";
import React from "react";
import { m } from "framer-motion";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getName, getRole, hasRole } from "../../auth/auth";
import {
  listarTurmas,
  listarMinhasNotificacoes,
  marcarTodasNotificacoesComoLidas,
  marcarNotificacaoComoLida,
  logoutWithServer,
  obterUsuarioAtual,
  type Turma,
  type UserNotification,
} from "../../services/api";
import ProfilePopup from "../ProfilePopup";
import SettingsOverlay from "../SettingsOverlay";
import CodexDrawer from "../AI/CodexDrawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  Target,
  Trophy,
  Coins,
  CalendarClock,
  BookOpen,
  Radar,
  Slash,
  ChevronDown,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type DashboardQuickAction = {
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  visible?: boolean;
};

type DashboardLayoutProps = {
  title?: string;
  subtitle?: string;
  quickActions?: DashboardQuickAction[];
  headerActions?: ReactNode;
  children?: ReactNode;
};

type BreadcrumbItem = {
  label: string;
  to?: string;
  icon: LucideIcon;
};

type NotificationsTab = "inbox" | "history";

type NavAreaId = "operations" | "content" | "people" | "system";
type NavEntry = {
  label: string;
  icon: LucideIcon;
  to?: string;
  branch?: string;
  onClick?: () => void;
  visible: boolean;
};
type NavArea = {
  id: NavAreaId;
  label: string;
  icon: LucideIcon;
  entries: NavEntry[];
};

const SIDEBAR_OPEN_AREAS_STORAGE_KEY = "dashboard-sidebar-open-areas";
const DashboardShellContext = React.createContext<{
  setPageMeta: (meta: {
    title?: string;
    subtitle?: string;
    quickActions?: DashboardQuickAction[];
    headerActions?: ReactNode;
  }) => void;
} | null>(null);

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
  nested = false,
  icon,
  label,
}: {
  onClick: () => void;
  active: boolean;
  nested?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      className={cn(
        NAV_ITEM_BASE,
        nested ? "px-3 py-2.5 pl-10 text-[13px] font-medium" : "px-3.5 py-3 text-sm font-semibold",
        active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE
      )}
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

function DashboardPageRegistration({
  title,
  subtitle,
  quickActions,
  headerActions,
  children,
}: DashboardLayoutProps) {
  const shellContext = React.useContext(DashboardShellContext);

  React.useEffect(() => {
    shellContext?.setPageMeta({ title, subtitle, quickActions, headerActions });
  }, [headerActions, quickActions, shellContext, subtitle, title]);

  return <>{children}</>;
}

function DashboardShell({
  children,
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const canCreateUser = hasRole(["admin"]);
  const name = getName() ?? "Aluno";
  const role = getRole();
  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [modalSelecionarTurmaAberto, setModalSelecionarTurmaAberto] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [profilePopupOpen, setProfilePopupOpen] = React.useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = React.useState<string>("");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [codexDrawerOpen, setCodexDrawerOpen] = React.useState(false);
  const [notificationsDrawerOpen, setNotificationsDrawerOpen] = React.useState(false);
  const [inboxNotifications, setInboxNotifications] = React.useState<UserNotification[]>([]);
  const [historyNotifications, setHistoryNotifications] = React.useState<UserNotification[]>([]);
  const [historyTotal, setHistoryTotal] = React.useState(0);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = React.useState(0);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);
  const [notificationsError, setNotificationsError] = React.useState<string | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = React.useState<number | null>(null);
  const [markingAllNotifications, setMarkingAllNotifications] = React.useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = React.useState(false);
  const [notificationsTab, setNotificationsTab] = React.useState<NotificationsTab>("inbox");
  const [openAreaIds, setOpenAreaIds] = React.useState<NavAreaId[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const raw = window.localStorage.getItem(SIDEBAR_OPEN_AREAS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is NavAreaId =>
        item === "operations" || item === "content" || item === "people" || item === "system"
      );
    } catch {
      return [];
    }
  });
  const [pageMeta, setPageMeta] = React.useState<{
    title?: string;
    subtitle?: string;
    quickActions?: DashboardQuickAction[];
    headerActions?: ReactNode;
  }>({});
  const shellContextValue = React.useMemo(() => ({ setPageMeta }), []);
  const sbBottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listarTurmas()
      .then(setTurmas)
      .catch((e) => console.error("Erro ao carregar turmas:", e));
  }, []);

  const mergeNotifications = React.useCallback(
    (current: UserNotification[], incoming: UserNotification[]) => {
      const byId = new Map<number, UserNotification>();
      for (const item of [...current, ...incoming]) {
        byId.set(item.id, item);
      }
      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    []
  );

  const loadInboxNotifications = React.useCallback(async () => {
    if (!canCreateUser) {
      setInboxNotifications([]);
      setHistoryNotifications([]);
      setHistoryTotal(0);
      setNotificationsUnreadCount(0);
      return;
    }

    try {
      setNotificationsLoading(true);
      setNotificationsError(null);
      const response = await listarMinhasNotificacoes({ limit: 20, offset: 0, status: "unread" });
      setInboxNotifications(response.items);
      setNotificationsUnreadCount(response.unreadCount);
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : "Erro ao carregar notificacoes"
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, [canCreateUser]);

  const loadHistoryNotifications = React.useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      if (!canCreateUser) {
        setHistoryNotifications([]);
        setHistoryTotal(0);
        return;
      }

      const offset = reset ? 0 : historyNotifications.length;

      try {
        if (reset) {
          setNotificationsLoading(true);
        } else {
          setLoadingMoreHistory(true);
        }

        setNotificationsError(null);
        const response = await listarMinhasNotificacoes({ limit: 20, offset, status: "read" });
        setHistoryNotifications((current) =>
          reset ? response.items : mergeNotifications(current, response.items)
        );
        setHistoryTotal(response.total);
        setNotificationsUnreadCount(response.unreadCount);
      } catch (error) {
        setNotificationsError(
          error instanceof Error ? error.message : "Erro ao carregar historico de notificacoes"
        );
      } finally {
        setNotificationsLoading(false);
        setLoadingMoreHistory(false);
      }
    },
    [canCreateUser, historyNotifications.length, mergeNotifications]
  );

  React.useEffect(() => {
    obterUsuarioAtual()
      .then((user) => setProfilePictureUrl(user.profilePictureUrl ?? ""))
      .catch((e) => console.error("Erro ao carregar perfil atual:", e));
  }, [settingsOpen]);

  React.useEffect(() => {
    void loadInboxNotifications();
  }, [loadInboxNotifications]);

  React.useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  React.useEffect(() => {
    if (!notificationsDrawerOpen) return;
    setNotificationsTab("inbox");
    void loadInboxNotifications();
  }, [loadInboxNotifications, notificationsDrawerOpen]);

  React.useEffect(() => {
    if (!notificationsDrawerOpen || notificationsTab !== "history" || historyNotifications.length > 0) {
      return;
    }
    void loadHistoryNotifications({ reset: true });
  }, [historyNotifications.length, loadHistoryNotifications, notificationsDrawerOpen, notificationsTab]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_OPEN_AREAS_STORAGE_KEY, JSON.stringify(openAreaIds));
    } catch {
      // Ignore persistence failures and keep the in-memory state working.
    }
  }, [openAreaIds]);

  const isDashboard = isExactRoute(location.pathname, appRoutes.dashboard);
  const isExercicios = isExactRoute(location.pathname, appRoutes.exercicios);
  const isMateriais = isExactRoute(location.pathname, appRoutes.materiais);
  const isVideoaulas = isExactRoute(location.pathname, appRoutes.videoaulas);
  const isMedalhas = isExactRoute(location.pathname, appRoutes.medalhas);
  const isMetas = isExactRoute(location.pathname, appRoutes.metas);
  const isCreateUser = isExactRoute(location.pathname, appRoutes.criarUsuario);
  const isAdminUsers = isExactRoute(location.pathname, appRoutes.usuarios);
  const isEstruturaCurso = isRouteBranch(location.pathname, appRoutes.estruturaCurso.base);
  const isActivityLogs = isExactRoute(location.pathname, appRoutes.logs);
  const isNotificacoes = isExactRoute(location.pathname, appRoutes.notificacoes);
  const isObservability = isExactRoute(location.pathname, appRoutes.observabilidade);
  const isTurmas = isRouteBranch(location.pathname, appRoutes.turmas);

  function handleLogout() {
    void logoutWithServer().finally(() => {
      navigate(appRoutes.login, { replace: true });
    });
  }

  const handleMinhasTurmas = React.useCallback(() => {
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
  }, [navigate, role, setModalSelecionarTurmaAberto, turmas]);

  const navAreas = React.useMemo<NavArea[]>(() => {
    const areas: NavArea[] = [
      {
        id: "operations",
        label: "Operacao",
        icon: School,
        entries: [
          {
            label: "Turmas",
            icon: School,
            branch: appRoutes.turmas,
            visible: role === "admin" || role === "professor" || turmas.length > 0,
            ...(role === "admin" || role === "professor"
              ? { to: appRoutes.turmas }
              : { onClick: handleMinhasTurmas }),
          },
          {
            label: "Metas",
            icon: Target,
            to: appRoutes.metas,
            branch: appRoutes.metas,
            visible: role === "admin" || role === "professor",
          },
          {
            label: "Medalhas",
            icon: Medal,
            to: appRoutes.medalhas,
            branch: appRoutes.medalhas,
            visible: true,
          },
          {
            label: "Ranking de Notas",
            icon: Trophy,
            to: appRoutes.rankingNotas,
            branch: appRoutes.rankingNotas,
            visible: role === "admin" || role === "professor",
          },
          {
            label: "Ranking de Pontos",
            icon: Coins,
            to: appRoutes.rankingPontos,
            branch: appRoutes.rankingPontos,
            visible: role === "admin" || role === "professor",
          },
          {
            label: "Eventos de Rankings",
            icon: CalendarClock,
            to: appRoutes.rankingEventos,
            branch: appRoutes.rankingEventos,
            visible: role === "admin",
          },
          {
            label: "Notificacoes",
            icon: Bell,
            to: appRoutes.notificacoes,
            branch: appRoutes.notificacoes,
            visible: role === "admin",
          },
        ],
      },
      {
        id: "content",
        label: "Conteudo",
        icon: Blocks,
        entries: [
          {
            label: "Estrutura do curso",
            icon: Blocks,
            to: appRoutes.estruturaCurso.root,
            branch: appRoutes.estruturaCurso.base,
            visible: role === "admin",
          },
          {
            label: "Exercicios",
            icon: PenLine,
            to: appRoutes.exercicios,
            branch: appRoutes.exercicios,
            visible: true,
          },
          {
            label: "Materiais",
            icon: FileText,
            to: appRoutes.materiais,
            branch: appRoutes.materiais,
            visible: true,
          },
          {
            label: "Videoaulas",
            icon: Play,
            to: appRoutes.videoaulas,
            branch: appRoutes.videoaulas,
            visible: true,
          },
        ],
      },
      {
        id: "people",
        label: "Usuarios",
        icon: Users,
        entries: [
          {
            label: "Usuarios",
            icon: KeyRound,
            to: appRoutes.usuarios,
            branch: appRoutes.usuarios,
            visible: canCreateUser,
          },
          {
            label: "Criar usuario",
            icon: Plus,
            to: appRoutes.criarUsuario,
            branch: appRoutes.criarUsuario,
            visible: canCreateUser,
          },
        ],
      },
      {
        id: "system",
        label: "Sistema",
        icon: Radar,
        entries: [
          {
            label: "Logs",
            icon: BarChart3,
            to: appRoutes.logs,
            branch: appRoutes.logs,
            visible: canCreateUser,
          },
          {
            label: "Observabilidade",
            icon: Radar,
            to: appRoutes.observabilidade,
            branch: appRoutes.observabilidade,
            visible: canCreateUser,
          },
        ],
      },
    ];

    return areas
      .map((area) => ({
        ...area,
        entries: area.entries.filter((entry) => entry.visible),
      }))
      .filter((area) => area.entries.length > 0);
  }, [canCreateUser, handleMinhasTurmas, role, turmas.length]);

  const activeArea = React.useMemo(
    () =>
      navAreas.find((area) =>
        area.entries.some((entry) =>
          entry.branch
            ? entry.branch === appRoutes.dashboard
              ? isExactRoute(location.pathname, entry.branch)
              : isRouteBranch(location.pathname, entry.branch)
            : false
        )
      ) ?? null,
    [location.pathname, navAreas]
  );

  React.useEffect(() => {
    if (!activeArea) return;
    if (isDashboard) return;
    setOpenAreaIds((current) => (current.includes(activeArea.id) ? current : [...current, activeArea.id]));
  }, [activeArea, isDashboard]);

  const resolvedTitle = pageMeta.title ?? "Dashboard";
  const pageSubtitle = pageMeta.subtitle ?? `Bem-vindo de volta, ${name}`;
  const notificationsDateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    []
  );
  const dashboardQuickActions = React.useMemo(
    () => (pageMeta.quickActions ?? []).filter((action) => action.visible !== false),
    [pageMeta.quickActions]
  );
  const visibleNotifications = notificationsTab === "history" ? historyNotifications : inboxNotifications;
  const hasMoreHistory = historyNotifications.length < historyTotal;
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

    if (isMetas) {
      return [
        { label: "Dashboard", to: appRoutes.dashboard, icon: Home },
        { label: "Metas", icon: Target },
      ];
    }

    if (isActivityLogs) {
      return [
        { label: "Sistema", to: appRoutes.dashboard, icon: BarChart3 },
        { label: "Logs de Atividade", icon: BarChart3 },
      ];
    }

    if (isNotificacoes) {
      return [
        { label: "Operacao", to: appRoutes.dashboard, icon: Bell },
        { label: "Notificacoes", icon: Bell },
      ];
    }

    if (isObservability) {
      return [
        { label: "Sistema", to: appRoutes.dashboard, icon: Radar },
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
        { label: "Conteudo", to: appRoutes.dashboard, icon: Blocks },
        { label: resolvedTitle, icon: BookOpen },
      ];
    }

    if (isExercicios) {
      return [
        { label: "Conteudo", to: appRoutes.dashboard, icon: Blocks },
        { label: "Exercicios", icon: PenLine },
      ];
    }

    if (isTurmas) {
      return [
        { label: "Operacao", to: appRoutes.dashboard, icon: Blocks },
        { label: "Turmas", icon: School },
      ];
    }

    if (isMateriais || isVideoaulas || isMedalhas || isMetas) {
      return [
        { label: activeArea?.label ?? "Dashboard", to: appRoutes.dashboard, icon: activeArea?.entries[0]?.icon ?? Home },
        { label: resolvedTitle, icon: activeArea?.entries[0]?.icon ?? Home },
      ];
    }

    return [
      { label: "Workspace", to: appRoutes.dashboard, icon: Home },
      { label: resolvedTitle, icon: Home },
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
    isMetas,
    isNotificacoes,
    isObservability,
    isTurmas,
    isVideoaulas,
    activeArea,
    resolvedTitle,
  ]);

  const handleNotificationItemClick = React.useCallback(
    async (notification: UserNotification) => {
      if (notification.readAt) {
        return;
      }

      try {
        setMarkingNotificationId(notification.id);
        const response = await marcarNotificacaoComoLida(notification.id);
        setInboxNotifications((current) => current.filter((item) => item.id !== notification.id));
        setHistoryNotifications((current) => mergeNotifications([response.notification], current));
        setHistoryTotal((current) => current + 1);
        setNotificationsUnreadCount((current) => Math.max(0, current - 1));
      } catch (error) {
        setNotificationsError(
          error instanceof Error ? error.message : "Erro ao marcar notificacao como lida"
        );
      } finally {
        setMarkingNotificationId(null);
      }
    },
    [mergeNotifications]
  );

  const handleMarkAllNotificationsAsRead = React.useCallback(async () => {
    if (notificationsUnreadCount === 0) {
      return;
    }

    try {
      setMarkingAllNotifications(true);
      const response = await marcarTodasNotificacoesComoLidas();
      const markedNotifications = inboxNotifications.map((notification) => ({
        ...notification,
        readAt: response.markedAt,
      }));

      setInboxNotifications([]);
      setHistoryNotifications((current) => mergeNotifications(markedNotifications, current));
      setHistoryTotal((current) => current + response.updatedCount);
      setNotificationsUnreadCount(0);
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : "Erro ao marcar notificacoes como lidas"
      );
    } finally {
      setMarkingAllNotifications(false);
    }
  }, [inboxNotifications, mergeNotifications, notificationsUnreadCount]);

  const handleNotificationsScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (notificationsTab !== "history" || loadingMoreHistory || notificationsLoading || !hasMoreHistory) {
        return;
      }

      const element = event.currentTarget;
      const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

      if (distanceToBottom > 120) {
        return;
      }

      void loadHistoryNotifications();
    },
    [hasMoreHistory, loadHistoryNotifications, loadingMoreHistory, notificationsLoading, notificationsTab]
  );
  return (
    <DashboardShellContext.Provider value={shellContextValue}>
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
          <NavLinkItem
            to={appRoutes.dashboard}
            active={isDashboard}
            icon={<Home size={18} />}
            label="Dashboard"
          />

          {navAreas.map((area) => (
            <div key={area.id} className="flex flex-col gap-1">
              {(() => {
                const isAreaOpen = openAreaIds.includes(area.id);
                const isAreaActive = activeArea?.id === area.id;
                return (
                  <>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-[0.85rem] border px-3.5 py-3 text-left text-sm font-semibold transition-all duration-200",
                  isAreaActive || isAreaOpen
                    ? "border-[var(--sidebar-item-active-border)] bg-[var(--sidebar-item-hover-bg)] text-[var(--sidebar-text)]"
                    : "border-transparent text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-item-hover-bg)] hover:text-[var(--sidebar-text)]"
                )}
                onClick={() =>
                  setOpenAreaIds((current) =>
                    current.includes(area.id)
                      ? current.filter((id) => id !== area.id)
                      : [...current, area.id]
                  )
                }
                aria-expanded={isAreaOpen}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <m.span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-xl border transition-colors duration-200",
                      isAreaActive || isAreaOpen
                        ? "border-[var(--sidebar-item-active-border)] bg-[var(--sidebar-item-active-bg)] text-[var(--sidebar-item-active-text)]"
                        : "border-[var(--sidebar-item-hover-border)] bg-[var(--sidebar-item-hover-bg)] text-[var(--sidebar-text-secondary)]"
                    )}
                    animate={isAreaOpen ? { scale: 1.04, y: -1 } : { scale: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <area.icon size={15} />
                  </m.span>
                  <span className="truncate">{area.label}</span>
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sidebar-text-secondary)]">
                    {area.entries.length}
                  </span>
                </span>
                <m.span
                  animate={isAreaOpen ? { rotate: 180 } : { rotate: 0 }}
                  transition={{ duration: 0.18 }}
                  className="shrink-0"
                >
                  <ChevronDown size={16} />
                </m.span>
              </button>

              <m.div
                initial={false}
                animate={
                  isAreaOpen
                    ? { height: "auto", opacity: 1, marginTop: 4 }
                    : { height: 0, opacity: 0, marginTop: 0 }
                }
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="grid gap-1 pl-1">
                  {area.entries.map((entry) =>
                    entry.to ? (
                      <NavLinkItem
                        key={entry.label}
                        to={entry.to}
                        active={!!entry.branch && isRouteBranch(location.pathname, entry.branch)}
                        nested
                        icon={<entry.icon size={16} />}
                        label={entry.label}
                      />
                    ) : (
                      <NavButtonItem
                        key={entry.label}
                        onClick={entry.onClick ?? (() => undefined)}
                        active={!!entry.branch && isRouteBranch(location.pathname, entry.branch)}
                        nested
                        icon={<entry.icon size={16} />}
                        label={entry.label}
                      />
                    )
                  )}
                </div>
              </m.div>
                  </>
                );
              })()}
            </div>
          ))}
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
                  {resolvedTitle}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {pageSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCodexDrawerOpen(true)}
                className="rounded-full"
                aria-label="Abrir IA"
              >
                <Sparkles size={14} />
                Abrir IA
              </Button>
              {canCreateUser ? (
                <button
                  className={cn(
                    "relative inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-muted/50 hover:text-foreground",
                    (isNotificacoes || notificationsDrawerOpen) && "border-primary/30 bg-primary/10 text-primary"
                  )}
                  aria-label="Notificacoes"
                  type="button"
                  onClick={() => setNotificationsDrawerOpen(true)}
                >
                  <Bell size={18} />
                  {notificationsUnreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black leading-none text-primary-foreground shadow-sm">
                      {notificationsUnreadCount > 99 ? "99+" : notificationsUnreadCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <CodexDrawer
          open={codexDrawerOpen}
          onOpenChange={setCodexDrawerOpen}
          context={{
            pathname: location.pathname,
            pageTitle: resolvedTitle,
            pageSubtitle,
          }}
        />

        <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          {dashboardQuickActions.length > 0 ? (
            <section className="rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-muted-foreground/80">
                    Acoes rapidas
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Atalhos por perfil para concluir tarefas frequentes sem procurar no menu lateral.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dashboardQuickActions.map((action) => {
                    const content = (
                      <>
                        <action.icon data-icon="inline-start" size={16} />
                        {action.label}
                      </>
                    );

                    return action.to ? (
                      <Link
                        key={action.label}
                        to={action.to}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/80 bg-background/80 px-4 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:bg-muted"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/80 bg-background/80 px-4 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:bg-muted"
                      >
                        {content}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}
          {children ?? <Outlet />}
        </main>
      </div>

      <SettingsOverlay
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={handleLogout}
      />

      <Dialog open={notificationsDrawerOpen} onOpenChange={setNotificationsDrawerOpen}>
        <DialogContent
          className="fixed top-0 right-0 left-auto z-50 flex h-screen w-full max-w-[420px] translate-x-0 translate-y-0 flex-col rounded-none border-l border-border/70 border-t-0 border-r-0 border-b-0 bg-card text-foreground shadow-[0_32px_90px_-40px_rgba(0,0,0,0.6)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[460px]"
          overlayClassName="bg-black/45 backdrop-blur-[1px]"
          closeClassName="top-5 right-5 h-10 w-10 rounded-xl bg-muted text-foreground hover:bg-accent"
        >
          <DialogHeader className="gap-2 border-b border-border/60 pb-5 pr-16">
            <DialogTitle className="text-lg">Minhas notificações</DialogTitle>
            <DialogDescription>
              {notificationsTab === "history"
                ? `${historyTotal} item(ns) no historico recente.`
                : notificationsUnreadCount > 0
                ? `${notificationsUnreadCount} notificacao(oes) nao lida(s).`
                : "Voce esta em dia com suas notificacoes."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6" onScroll={handleNotificationsScroll}>
            <div className="sticky top-0 z-10 -mx-6 border-b border-border/50 bg-card px-6 py-4">
              <div className="inline-flex w-full rounded-full border border-border/70 bg-background/70 p-1">
                <button
                  type="button"
                  onClick={() => setNotificationsTab("inbox")}
                  className={cn(
                    "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition",
                    notificationsTab === "inbox"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Notificações
                  <span className="ml-2 text-[11px] font-black">{notificationsUnreadCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsTab("history")}
                  className={cn(
                    "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition",
                    notificationsTab === "history"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Histórico
                  <span className="ml-2 text-[11px] font-black">{historyTotal}</span>
                </button>
              </div>

              {notificationsTab === "inbox" && notificationsUnreadCount > 0 ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      void handleMarkAllNotificationsAsRead();
                    }}
                    disabled={markingAllNotifications}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {markingAllNotifications ? "Lendo tudo..." : "Ler tudo"}
                  </button>
                </div>
              ) : null}
            </div>

            {notificationsLoading ? (
              <div className="flex h-full min-h-[240px] items-center justify-center">
                <div className="inline-flex items-center gap-3 text-sm text-muted-foreground">
                  <m.span
                    className="inline-flex"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1, ease: "linear" }}
                  >
                    <Bell size={16} />
                  </m.span>
                  Carregando notificacoes...
                </div>
              </div>
            ) : notificationsError ? (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/8 p-4">
                <p className="text-sm text-red-200">{notificationsError}</p>
                <button
                  type="button"
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted"
                  onClick={() => {
                    if (notificationsTab === "history") {
                      void loadHistoryNotifications({ reset: true });
                    } else {
                      void loadInboxNotifications();
                    }
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                <div className="inline-flex size-14 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground">
                  <Bell size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {notificationsTab === "history" ? "Nenhum histórico" : "Nenhuma notificacao"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {notificationsTab === "history"
                      ? "As notificacoes lidas vao aparecer aqui."
                      : "Quando houver novidades, elas aparecem aqui."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {visibleNotifications.map((notification) => {
                  const isUnread = !notification.readAt;
                  const isMarking = markingNotificationId === notification.id;

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => {
                        void handleNotificationItemClick(notification);
                      }}
                      className={cn(
                        "flex flex-col gap-2 rounded-[20px] border p-4 text-left transition",
                        isUnread
                          ? "border-primary/25 bg-primary/8 hover:border-primary/35 hover:bg-primary/12"
                          : "border-border/70 bg-background/70 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            {isUnread ? (
                              <span className="inline-flex size-2 rounded-full bg-primary" aria-hidden="true" />
                            ) : null}
                            <span className="truncate text-sm font-semibold text-foreground">
                              {notification.title}
                            </span>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {notification.message}
                          </p>
                        </div>

                        {isMarking ? (
                          <m.span
                            className="shrink-0 text-muted-foreground"
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1, ease: "linear" }}
                          >
                            <Bell size={14} />
                          </m.span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>{notificationsDateFormatter.format(new Date(notification.createdAt))}</span>
                        <span>{isUnread ? "Nao lida" : "Lida"}</span>
                      </div>
                    </button>
                  );
                })}

                {notificationsTab === "history" && loadingMoreHistory ? (
                  <div className="rounded-[20px] border border-dashed border-border/70 bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
                    Carregando mais itens do histórico...
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
    </DashboardShellContext.Provider>
  );
}

export default function DashboardLayout(props: DashboardLayoutProps) {
  const shellContext = React.useContext(DashboardShellContext);
  if (shellContext) {
    return <DashboardPageRegistration {...props} />;
  }
  return <DashboardShell {...props} />;
}
