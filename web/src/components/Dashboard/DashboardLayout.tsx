import type { ReactNode } from "react";
import React from "react";
import { m, AnimatePresence } from "framer-motion";
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
import CommandPalette, { type CommandItem } from "./CommandPalette";
import HelpOverlay from "./HelpOverlay";
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
  Search,
  ArrowUp,
  Link2,
  Check,
  Keyboard,
  Clock,
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

function nameAccent(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return {
    bg: `hsl(${hue} 70% 22%)`,
    text: `hsl(${hue} 90% 82%)`,
  };
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
  const linkRef = React.useRef<HTMLAnchorElement>(null);

  React.useEffect(() => {
    if (active && linkRef.current) {
      linkRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [active]);

  return (
    <Link
      ref={linkRef}
      className={cn(
        NAV_ITEM_BASE,
        "relative",
        nested ? "px-3 py-2.5 pl-10 text-[13px] font-medium" : "px-3.5 py-3 text-sm font-semibold",
        active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE
      )}
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={active ? "page" : undefined}
    >
      {active ? (
        <m.span
          layoutId="nav-active-indicator"
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--sidebar-item-active-border)]"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          aria-hidden="true"
        />
      ) : null}
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
  const [turmasLoading, setTurmasLoading] = React.useState(true);
  const [modalSelecionarTurmaAberto, setModalSelecionarTurmaAberto] = React.useState(false);
  const [turmaSearch, setTurmaSearch] = React.useState("");
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [profilePopupOpen, setProfilePopupOpen] = React.useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = React.useState<string>("");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [codexDrawerOpen, setCodexDrawerOpen] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; variant: "success" | "error" | "info" } | null>(null);
  const [headerElevated, setHeaderElevated] = React.useState(false);
  const [isMac, setIsMac] = React.useState(false);
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
  const [notificationsTab, setNotificationsTab] = React.useState<NotificationsTab>(() => {
    if (typeof window === "undefined") return "inbox";
    try {
      const raw = window.localStorage.getItem("notifications-tab");
      return raw === "history" || raw === "inbox" ? raw : "inbox";
    } catch {
      return "inbox";
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem("notifications-tab", notificationsTab);
    } catch {
      // ignore
    }
  }, [notificationsTab]);
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
    setTurmasLoading(true);
    listarTurmas()
      .then((data) => {
        setTurmas(data);
        setTurmasLoading(false);
      })
      .catch((e) => {
        console.error("Erro ao carregar turmas:", e);
        showToast("Não foi possível carregar suas turmas", "error");
        setTurmasLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);

  const vimPrefixRef = React.useRef<{ time: number } | null>(null);
  const loadInboxNotificationsRef = React.useRef<() => Promise<void>>(async () => undefined);

  const showToast = React.useCallback(
    (message: string, variant: "success" | "error" | "info" = "success") => {
      setToast({ message, variant });
      window.setTimeout(() => {
        setToast((cur) => (cur && cur.message === message ? null : cur));
      }, 2200);
    },
    []
  );

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (target?.isContentEditable ?? false);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "p"
      ) {
        event.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }

      if (!isEditing && event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (
        !isEditing &&
        (event.key === "?" || (event.shiftKey && event.key === "/")) &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      if (isEditing) return;

      // Vim-style sequence: g + letter
      const now = Date.now();
      if (event.key === "g" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        vimPrefixRef.current = { time: now };
        return;
      }

      if (event.key === "Escape") {
        if (sidebarOpen) {
          event.preventDefault();
          setSidebarOpen(false);
          return;
        }
        if (profilePopupOpen) {
          event.preventDefault();
          setProfilePopupOpen(false);
          return;
        }
      }

      if (event.altKey && /^[1-9]$/.test(event.key)) {
        const idx = Number(event.key) - 1;
        const area = ["operations", "content", "people", "system"][idx];
        if (!area) return;
        const targets: Record<string, string> = {
          operations: appRoutes.turmas,
          content: appRoutes.exercicios,
          people: appRoutes.usuarios,
          system: appRoutes.logs,
        };
        event.preventDefault();
        navigate(targets[area]);
        return;
      }

      if (vimPrefixRef.current && now - vimPrefixRef.current.time < 900) {
        const key = event.key.toLowerCase();
        if (key === "h") {
          vimPrefixRef.current = null;
          event.preventDefault();
          setHelpOpen(true);
          return;
        }
        let target: string | null = null;
        if (key === "d") target = appRoutes.dashboard;
        else if (key === "t") target = appRoutes.turmas;
        else if (key === "u") target = appRoutes.usuarios;
        else if (key === "e") target = appRoutes.exercicios;
        else if (key === "m") target = appRoutes.materiais;
        else if (key === "v") target = appRoutes.videoaulas;
        else if (key === "s") target = appRoutes.logs;
        else if (key === "n") target = appRoutes.notificacoes;
        vimPrefixRef.current = null;
        if (target) {
          event.preventDefault();
          navigate(target);
        }
        return;
      }

      // Refresh notifications
      if (
        event.key.toLowerCase() === "r" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        canCreateUser
      ) {
        event.preventDefault();
        void loadInboxNotificationsRef.current();
        showToast("Notificações atualizadas", "info");
        return;
      }

      // Focus first input on the page
      if (
        event.key.toLowerCase() === "i" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        const firstInput = document.querySelector<HTMLElement>(
          "main input:not([type=hidden]):not([disabled]), main textarea:not([disabled]), main select:not([disabled])"
        );
        if (firstInput) {
          event.preventDefault();
          firstInput.focus();
          return;
        }
      }

      // Single key "n" for opening notifications drawer (admin)
      if (
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        canCreateUser
      ) {
        event.preventDefault();
        setNotificationsDrawerOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, sidebarOpen, profilePopupOpen, canCreateUser, showToast]);

  const [showBackToTop, setShowBackToTop] = React.useState(false);
  const [routeLoading, setRouteLoading] = React.useState(false);
  const [showFirstHint, setShowFirstHint] = React.useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return !window.localStorage.getItem("shortcut-hint-seen");
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    if (!showFirstHint) return;
    const t = window.setTimeout(() => {
      setShowFirstHint(false);
      try {
        window.localStorage.setItem("shortcut-hint-seen", "1");
      } catch {
        // ignore
      }
    }, 8000);
    return () => window.clearTimeout(t);
  }, [showFirstHint]);

  React.useEffect(() => {
    setRouteLoading(true);
    const t = window.setTimeout(() => setRouteLoading(false), 380);
    return () => window.clearTimeout(t);
  }, [location.pathname]);
  const [isOnline, setIsOnline] = React.useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [profileLoaded, setProfileLoaded] = React.useState(false);
  const [recentPaths, setRecentPaths] = React.useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("recent-paths");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    if (!isExactRoute(location.pathname, appRoutes.dashboard) && !location.pathname.startsWith("/dashboard")) {
      return;
    }
    setRecentPaths((current) => {
      const next = [location.pathname, ...current.filter((p) => p !== location.pathname)].slice(0, 8);
      try {
        window.localStorage.setItem("recent-paths", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [location.pathname]);

  React.useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  React.useEffect(() => {
    const onScroll = () => {
      setHeaderElevated(window.scrollY > 6);
      setShowBackToTop(window.scrollY > 400);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  React.useEffect(() => {
    loadInboxNotificationsRef.current = loadInboxNotifications;
  }, [loadInboxNotifications]);

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
      .then((user) => {
        setProfilePictureUrl(user.profilePictureUrl ?? "");
        setProfileLoaded(true);
      })
      .catch((e) => {
        console.error("Erro ao carregar perfil atual:", e);
        setProfileLoaded(true);
      });
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

  const filteredTurmas = React.useMemo(() => {
    const q = turmaSearch.trim().toLowerCase();
    if (!q) return turmas;
    return turmas.filter((t) => t.nome.toLowerCase().includes(q));
  }, [turmaSearch, turmas]);

  React.useEffect(() => {
    if (!modalSelecionarTurmaAberto) setTurmaSearch("");
  }, [modalSelecionarTurmaAberto]);

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

  const commandItems = React.useMemo<CommandItem[]>(() => {
    const navCommands: CommandItem[] = [
      {
        id: "nav:dashboard",
        label: "Dashboard",
        description: "Visão geral do portal",
        icon: Home,
        group: "Navegação",
        to: appRoutes.dashboard,
        keywords: ["inicio", "home", "principal", "overview"],
      },
    ];

    for (const area of navAreas) {
      for (const entry of area.entries) {
        navCommands.push({
          id: `nav:${area.id}:${entry.label}`,
          label: entry.label,
          description: area.label,
          icon: entry.icon,
          group: area.label,
          to: entry.to,
          onSelect: entry.to ? undefined : entry.onClick,
          keywords: [area.label, area.id],
        });
      }
    }

    const actions: CommandItem[] = [
      {
        id: "action:profile",
        label: "Meu perfil",
        description: "Abrir popup de perfil",
        icon: User,
        group: "Ações",
        keywords: ["conta", "usuario", "perfil", "profile"],
        onSelect: () => setProfilePopupOpen(true),
      },
      {
        id: "action:settings",
        label: "Configurações",
        description: "Abrir painel de configurações",
        icon: Settings,
        group: "Ações",
        keywords: ["preferencias", "ajustes", "config", "settings"],
        onSelect: () => setSettingsOpen(true),
      },
      {
        id: "action:codex",
        label: "Abrir IA (Codex)",
        description: "Assistente do portal",
        icon: Sparkles,
        group: "Ações",
        keywords: ["ai", "ia", "assistente", "chat", "codex"],
        onSelect: () => setCodexDrawerOpen(true),
      },
    ];

    if (canCreateUser) {
      actions.push({
        id: "action:notifications",
        label: "Notificações",
        description: "Abrir caixa de notificações",
        icon: Bell,
        group: "Ações",
        keywords: ["alertas", "avisos", "inbox"],
        onSelect: () => setNotificationsDrawerOpen(true),
      });
      actions.push({
        id: "action:reload-notifications",
        label: "Recarregar notificações",
        description: "Buscar novas notificações agora",
        icon: Bell,
        group: "Ações",
        keywords: ["refresh", "atualizar", "recarregar"],
        onSelect: () => {
          void loadInboxNotifications();
          showToast("Notificações atualizadas", "info");
        },
      });
    }

    actions.push({
      id: "action:copy-link",
      label: "Copiar link desta página",
      description: "Copia URL atual para a área de transferência",
      icon: Link2,
      group: "Ações",
      keywords: ["url", "compartilhar", "share", "copy", "link"],
      onSelect: () => {
        const url = window.location.href;
        const copy = navigator.clipboard?.writeText(url);
        if (copy && typeof copy.then === "function") {
          copy
            .then(() => showToast("Link copiado!", "success"))
            .catch(() => showToast("Não foi possível copiar", "error"));
        } else {
          showToast("Não foi possível copiar", "error");
        }
      },
    });

    actions.push({
      id: "action:back",
      label: "Voltar para página anterior",
      description: "Navegar para a rota anterior",
      icon: ArrowRight,
      group: "Ações",
      keywords: ["back", "voltar", "anterior", "previous"],
      onSelect: () => window.history.back(),
    });

    if (recentPaths.length > 1) {
      const prev = recentPaths[1];
      actions.push({
        id: "action:goto-previous",
        label: "Reabrir última página visitada",
        description: prev,
        icon: Clock,
        group: "Ações",
        keywords: ["recent", "ultima", "previa"],
        onSelect: () => navigate(prev),
      });
    }

    actions.push({
      id: "action:reload",
      label: "Recarregar página",
      description: "Faz reload completo (F5)",
      icon: ArrowRight,
      group: "Ações",
      keywords: ["reload", "refresh", "recarregar", "f5"],
      onSelect: () => window.location.reload(),
    });

    actions.push({
      id: "action:copy-name",
      label: "Copiar meu nome",
      description: name,
      icon: User,
      group: "Ações",
      keywords: ["copiar nome", "perfil", "user"],
      onSelect: () => {
        const copy = navigator.clipboard?.writeText(name);
        if (copy && typeof copy.then === "function") {
          copy
            .then(() => showToast("Nome copiado!", "success"))
            .catch(() => showToast("Não foi possível copiar", "error"));
        }
      },
    });

    actions.push({
      id: "action:fullscreen",
      label: "Alternar tela cheia",
      description: document.fullscreenElement ? "Sair da tela cheia" : "Entrar em tela cheia",
      icon: Monitor,
      group: "Ações",
      keywords: ["fullscreen", "tela cheia", "f11"],
      onSelect: () => {
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          void document.documentElement.requestFullscreen();
        }
      },
    });

    actions.push({
      id: "action:help",
      label: "Atalhos de teclado",
      description: "Lista completa de atalhos",
      icon: Keyboard,
      group: "Ações",
      keywords: ["help", "ajuda", "shortcuts", "atalhos"],
      onSelect: () => setHelpOpen(true),
    });

    actions.push({
      id: "action:logout",
      label: "Sair da conta",
      description: "Encerrar sessão",
      icon: X,
      group: "Ações",
      keywords: ["logout", "sair", "deslogar", "exit"],
      onSelect: () => handleLogout(),
    });

    return [...navCommands, ...actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navAreas, canCreateUser, recentPaths]);

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
  const relativeTimeFormatter = React.useMemo(
    () => new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }),
    []
  );
  const formatNotificationTime = React.useCallback(
    (iso: string) => {
      const date = new Date(iso);
      const diffMs = date.getTime() - Date.now();
      const diffSec = Math.round(diffMs / 1000);
      const absSec = Math.abs(diffSec);
      if (absSec < 60) return "agora";
      if (absSec < 3600) return relativeTimeFormatter.format(Math.round(diffSec / 60), "minute");
      if (absSec < 86400) return relativeTimeFormatter.format(Math.round(diffSec / 3600), "hour");
      if (absSec < 604800) return relativeTimeFormatter.format(Math.round(diffSec / 86400), "day");
      return notificationsDateFormatter.format(date);
    },
    [notificationsDateFormatter, relativeTimeFormatter]
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
      showToast(
        response.updatedCount === 1
          ? "1 notificação marcada como lida"
          : `${response.updatedCount} notificações marcadas como lidas`,
        "success"
      );
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : "Erro ao marcar notificacoes como lidas"
      );
    } finally {
      setMarkingAllNotifications(false);
    }
  }, [inboxNotifications, mergeNotifications, notificationsUnreadCount, showToast]);

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
        <div className="sticky top-0 z-10 flex min-h-[5.75rem] items-center justify-between gap-3 border-b border-transparent bg-[var(--sidebar-color)]/95 px-6 py-5 backdrop-blur-sm after:absolute after:inset-x-4 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-[var(--sidebar-item-hover-border)] after:to-transparent after:opacity-60">
          <Link
            to={appRoutes.dashboard}
            className="group flex min-w-0 items-center gap-3 rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Ir para o Dashboard"
          >
            <m.div
              className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm transition-shadow duration-300 group-hover:shadow-[0_0_24px_-4px_var(--primary)]"
              whileHover={{ rotate: -8, scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              <img
                src="/faviconPreto.png"
                alt="Santos Tech"
                className="relative z-10 size-6 object-contain"
                draggable={false}
              />
            </m.div>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold tracking-[-0.04em] text-[var(--sidebar-text)]">
                Santos Tech
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sidebar-text-secondary)]">
                  Portal administrativo
                </span>
              </div>
            </div>
          </Link>

          <button
            className="inline-flex size-10 items-center justify-center rounded-[1rem] border border-[var(--sidebar-item-hover-border)] bg-[var(--sidebar-item-hover-bg)] text-[var(--sidebar-text-secondary)] transition hover:text-[var(--sidebar-text)] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            type="button"
          >
            <X size={18} />
          </button>
        </div>


        <div className="px-4 pt-1 pb-3">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-xl border border-[var(--sidebar-item-hover-border)] bg-[var(--sidebar-item-hover-bg)]/60 px-3 py-2.5 text-left transition-all",
              "hover:border-[var(--sidebar-item-active-border)] hover:bg-[var(--sidebar-item-hover-bg)] hover:shadow-sm"
            )}
            aria-label="Abrir busca rápida"
            aria-keyshortcuts="Control+K Meta+K /"
          >
            <Search size={15} className="shrink-0 text-[var(--sidebar-text-secondary)] transition-colors group-hover:text-[var(--sidebar-text)]" />
            <span className="flex-1 truncate text-[13px] font-medium text-[var(--sidebar-text-secondary)] group-hover:text-[var(--sidebar-text)]">
              Buscar...
            </span>
            <kbd className="inline-flex items-center gap-0.5 rounded-md border border-[var(--sidebar-item-hover-border)] bg-background/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sidebar-text-secondary)]">
              {isMac ? "⌘" : "Ctrl"}K
            </kbd>
          </button>
          <div className="mt-1.5 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-text-secondary)]/70">
              {navAreas.reduce((sum, a) => sum + a.entries.length, 0) + 1} páginas
            </span>
            <button
              type="button"
              onClick={() => {
                const allOpen = openAreaIds.length === navAreas.length;
                setOpenAreaIds(allOpen ? [] : navAreas.map((a) => a.id));
              }}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sidebar-text-secondary)] transition hover:bg-[var(--sidebar-item-hover-bg)] hover:text-[var(--sidebar-text)]"
              title={openAreaIds.length === navAreas.length ? "Colapsar todas as áreas" : "Expandir todas as áreas"}
            >
              {openAreaIds.length === navAreas.length ? "Colapsar" : "Expandir"}
            </button>
          </div>
        </div>

        <nav
          ref={(el) => {
            if (!el) return;
            try {
              const saved = window.sessionStorage.getItem("sidebar-nav-scroll");
              if (saved) el.scrollTop = Number(saved);
            } catch {
              // ignore
            }
            el.addEventListener("scroll", () => {
              try {
                window.sessionStorage.setItem("sidebar-nav-scroll", String(el.scrollTop));
              } catch {
                // ignore
              }
            });
          }}
          className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-4"
        >
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
                title={`${area.label} (${area.entries.length} ${
                  area.entries.length === 1 ? "página" : "páginas"
                })`}
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
                  {isAreaActive ? (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-primary">
                      Atual
                    </span>
                  ) : (
                    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sidebar-text-secondary)]">
                      {area.entries.length}
                    </span>
                  )}
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
                  {area.entries.map((entry, idx) => (
                    <m.div
                      key={entry.label}
                      initial={isAreaOpen ? { opacity: 0, x: -6 } : false}
                      animate={isAreaOpen ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: isAreaOpen ? idx * 0.025 : 0 }}
                    >
                      {entry.to ? (
                        <NavLinkItem
                          to={entry.to}
                          active={!!entry.branch && isRouteBranch(location.pathname, entry.branch)}
                          nested
                          icon={<entry.icon size={16} />}
                          label={entry.label}
                        />
                      ) : (
                        <NavButtonItem
                          onClick={entry.onClick ?? (() => undefined)}
                          active={!!entry.branch && isRouteBranch(location.pathname, entry.branch)}
                          nested
                          icon={<entry.icon size={16} />}
                          label={entry.label}
                        />
                      )}
                    </m.div>
                  ))}
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
              aria-label={`Ver perfil — Logado como ${name}`}
              title={`Logado como ${name} (${roleLabel(role)})`}
            >
              {profileLoaded ? (
                <span className="relative inline-block shrink-0">
                  <Avatar className="size-10 border border-border bg-muted text-sm font-bold text-foreground shadow-sm">
                    {profilePictureUrl ? <AvatarImage src={profilePictureUrl} alt={name} /> : null}
                    <AvatarFallback
                      className="text-sm font-black"
                      style={{
                        backgroundColor: nameAccent(name).bg,
                        color: nameAccent(name).text,
                      }}
                    >
                      {name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    aria-hidden="true"
                    title={isOnline ? "Online" : "Offline"}
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 inline-block size-3 rounded-full border-2",
                      "border-[var(--sidebar-color,#fff)]",
                      isOnline ? "bg-emerald-400" : "bg-slate-500"
                    )}
                  />
                </span>
              ) : (
                <span
                  className="inline-block size-10 shrink-0 animate-pulse rounded-full bg-muted/70"
                  aria-hidden="true"
                />
              )}

              <div className="min-w-0 flex-1">
                {profileLoaded ? (
                  <div className="truncate text-sm font-semibold text-[var(--sidebar-text)]">{name}</div>
                ) : (
                  <div className="ux-shimmer h-3.5 w-24 rounded" aria-hidden="true" />
                )}
                <div className="mt-0.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]",
                      role === "admin"
                        ? "border-violet-500/30 bg-violet-500/12 text-violet-300"
                        : role === "professor"
                        ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-300"
                        : "border-sky-500/30 bg-sky-500/12 text-sky-300"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        role === "admin"
                          ? "bg-violet-400"
                          : role === "professor"
                          ? "bg-emerald-400"
                          : "bg-sky-400"
                      )}
                    />
                    {roleLabel(role)}
                  </span>
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

          <div className="mt-3 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sidebar-text-secondary)]">
            <span>Santos Tech © {new Date().getFullYear()}</span>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition hover:bg-[var(--sidebar-item-hover-bg)] hover:text-[var(--sidebar-text)]"
              title="Atalhos de teclado (?)"
            >
              <Keyboard size={10} />
              atalhos
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-[16rem] xl:pl-[18rem]">
        <header
          className={cn(
            "sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md transition-shadow duration-200",
            headerElevated
              ? "border-border/60 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)]"
              : "border-border/40 shadow-none"
          )}
        >
          <AnimatePresence>
            {routeLoading ? (
              <m.div
                key="route-progress"
                className="absolute inset-x-0 top-0 h-[2px] origin-left bg-primary"
                initial={{ scaleX: 0, opacity: 1 }}
                animate={{ scaleX: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.36, ease: "easeOut" }}
                aria-hidden="true"
              />
            ) : null}
          </AnimatePresence>
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
                        title={crumb.label}
                        className={cn(
                          "inline-flex items-center gap-1.5 max-w-[220px] truncate",
                          isLast ? "font-semibold text-foreground" : "hover:text-foreground"
                        )}
                      >
                        <span className="truncate">{crumb.label}</span>
                      </span>
                    );

                    return (
                      <React.Fragment key={`${crumb.label}-${index}`}>
                        {crumb.to && !isLast ? (
                          <Link
                            to={crumb.to}
                            className="group relative inline-block transition"
                          >
                            {content}
                            <span
                              aria-hidden="true"
                              className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-primary/70 transition-transform duration-200 group-hover:scale-x-100"
                            />
                          </Link>
                        ) : (
                          content
                        )}
                        {!isLast ? <Slash size={12} className="text-border" /> : null}
                      </React.Fragment>
                    );
                  })}
                </div>
                <h1
                  className="truncate text-2xl font-bold tracking-tight text-foreground"
                  title={resolvedTitle}
                >
                  {resolvedTitle}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {pageSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isOnline ? (
                <span
                  className="hidden items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-300 md:inline-flex"
                  role="status"
                  aria-live="polite"
                  title="Sem conexão com a internet"
                >
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-red-400" />
                  Offline
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-muted/60 hover:text-foreground md:inline-flex"
                aria-label="Abrir busca rápida"
                aria-keyshortcuts="Control+K Meta+K /"
                title="Buscar (Ctrl+K)"
              >
                <Search size={14} />
                <span>Buscar</span>
                <kbd className="ml-1 inline-flex items-center rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {isMac ? "⌘" : "Ctrl"}K
                </kbd>
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCodexDrawerOpen(true)}
                className="rounded-full transition-shadow hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-[0_0_16px_-4px_var(--primary)]"
                aria-label="Abrir IA"
                title="Abrir assistente de IA"
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline">Abrir IA</span>
              </Button>
              {canCreateUser ? (
                <button
                  className={cn(
                    "relative inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-muted/50 hover:text-foreground",
                    (isNotificacoes || notificationsDrawerOpen) && "border-primary/30 bg-primary/10 text-primary"
                  )}
                  aria-label={
                    notificationsUnreadCount > 0
                      ? `Notificações (${notificationsUnreadCount} não lidas)`
                      : "Notificações"
                  }
                  title={
                    notificationsUnreadCount > 0
                      ? `${notificationsUnreadCount} notificação(ões) não lida(s)`
                      : "Sem notificações pendentes"
                  }
                  type="button"
                  onClick={() => setNotificationsDrawerOpen(true)}
                >
                  <Bell size={18} />
                  {notificationsUnreadCount > 0 ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-1 -right-1 inline-flex size-5 animate-ping rounded-full bg-primary/50"
                      />
                      <m.span
                        key={notificationsUnreadCount}
                        initial={{ scale: 0.6, opacity: 0.4 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                        className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black leading-none text-primary-foreground shadow-sm"
                      >
                        {notificationsUnreadCount > 99 ? "99+" : notificationsUnreadCount}
                      </m.span>
                    </>
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

        <m.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
        >
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
        </m.main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        items={commandItems}
        currentPath={location.pathname}
      />

      <HelpOverlay open={helpOpen} onOpenChange={setHelpOpen} isMac={isMac} />

      <AnimatePresence>
        {toast ? (
          <m.div
            key="link-toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={cn(
              "fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full border px-4 py-2 text-sm font-semibold shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)]",
              toast.variant === "success" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-50",
              toast.variant === "error" && "border-red-500/40 bg-red-500/15 text-red-50",
              toast.variant === "info" && "border-border bg-card text-foreground"
            )}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="inline-flex items-center gap-2">
              {toast.variant === "error" ? (
                <X size={14} />
              ) : (
                <Check size={14} className={toast.variant === "success" ? "text-emerald-300" : "text-primary"} />
              )}
              {toast.message}
            </span>
          </m.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showFirstHint ? (
          <m.div
            key="first-hint"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 right-6 z-40 max-w-[280px] rounded-2xl border border-border bg-card p-4 text-sm shadow-[0_18px_42px_-24px_rgba(0,0,0,0.4)]"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-muted/40 text-primary">
                <Keyboard size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Atalhos disponíveis</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Pressione{" "}
                  <kbd className="inline-flex items-center rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold">
                    ?
                  </kbd>{" "}
                  a qualquer momento para ver todos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFirstHint(false);
                  try {
                    window.localStorage.setItem("shortcut-hint-seen", "1");
                  } catch {
                    // ignore
                  }
                }}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Dispensar"
              >
                <X size={12} />
              </button>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>

      {showBackToTop ? (
        <m.button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[0_12px_30px_-12px_rgba(0,0,0,0.4)] transition hover:border-primary/40 hover:bg-muted"
          initial={{ opacity: 0, y: 12, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.85 }}
          transition={{ duration: 0.18 }}
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
        >
          <ArrowUp size={18} />
        </m.button>
      ) : null}

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
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {markingAllNotifications ? (
                      <>
                        <m.span
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.8, ease: "linear" }}
                          className="inline-flex"
                          aria-hidden="true"
                        >
                          <Check size={14} />
                        </m.span>
                        Lendo tudo...
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        Ler tudo
                      </>
                    )}
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
                <m.div
                  className="inline-flex size-14 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.4, ease: "easeInOut" }}
                >
                  <Bell size={20} />
                </m.div>
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
                <AnimatePresence initial={false}>
                {visibleNotifications.map((notification) => {
                  const isUnread = !notification.readAt;
                  const isMarking = markingNotificationId === notification.id;

                  return (
                    <m.button
                      key={notification.id}
                      type="button"
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => {
                        void handleNotificationItemClick(notification);
                      }}
                      className={cn(
                        "flex flex-col gap-2 overflow-hidden rounded-[20px] border p-4 text-left transition",
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
                            {Date.now() - new Date(notification.createdAt).getTime() < 5 * 60 * 1000 ? (
                              <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">
                                Novo
                              </span>
                            ) : null}
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
                        <span title={notificationsDateFormatter.format(new Date(notification.createdAt))}>
                          {formatNotificationTime(notification.createdAt)}
                        </span>
                        <span>{isUnread ? "Nao lida" : "Lida"}</span>
                      </div>
                    </m.button>
                  );
                })}
                </AnimatePresence>

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

          {turmas.length > 4 ? (
            <div className="border-b border-border/60 px-6 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
                <Search size={15} className="text-muted-foreground" />
                <input
                  type="text"
                  value={turmaSearch}
                  onChange={(e) => setTurmaSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && turmaSearch) {
                      e.preventDefault();
                      e.stopPropagation();
                      setTurmaSearch("");
                    }
                  }}
                  placeholder="Filtrar turmas..."
                  className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
                {turmaSearch ? (
                  <button
                    type="button"
                    onClick={() => setTurmaSearch("")}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Limpar filtro"
                    title="Limpar filtro (Esc)"
                  >
                    <X size={12} />
                  </button>
                ) : null}
                <span className="rounded-full border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {filteredTurmas.length}/{turmas.length}
                </span>
              </div>
            </div>
          ) : null}

          <div className="max-h-[60vh] overflow-y-auto px-6 pb-6 pt-3">
            <div className="grid gap-3">
              {turmasLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="ux-shimmer h-16 rounded-[1.25rem] border border-border/40"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              ) : turmas.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="grid size-14 place-items-center rounded-full border border-border/70 bg-muted/30 text-muted-foreground">
                    <School size={22} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">Você ainda não tem turmas</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Quando for inscrito em uma turma, ela aparecerá aqui.
                    </p>
                  </div>
                </div>
              ) : filteredTurmas.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <Search size={20} className="opacity-60" />
                  Nenhuma turma encontrada para "{turmaSearch}".
                </div>
              ) : null}
              {filteredTurmas.map((turma) => (
                <button
                  key={turma.id}
                  className="flex items-center gap-4 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/35 hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.25)]"
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
