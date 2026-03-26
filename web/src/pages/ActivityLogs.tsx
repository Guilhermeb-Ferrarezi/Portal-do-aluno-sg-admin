import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import { FadeInUp } from "../components/animate-ui/FadeInUp";
import { ScaleIn } from "../components/animate-ui/ScaleIn";
import { listarActivityLogs, type ActivityLog } from "../services/api";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  User,
  School,
  FilePenLine,
  Package,
  FileText,
  Film,
  Search,
  X,
  SlidersHorizontal,
  ClipboardList,
  Paperclip,
  RefreshCcw,
  Loader2,
  LogIn,
  LogOut,
  KeyRound,
  ShieldCheck,
  ImageUp,
  ImageMinus,
} from "lucide-react";

type Filters = {
  q: string;
  action: string;
  entityType: string;
  actorId: string;
  from: string;
  to: string;
};

type LogSection = "users" | "staff";

const defaultFilters: Filters = {
  q: "",
  action: "",
  entityType: "",
  actorId: "",
  from: "",
  to: "",
};

const ACTION_OPTIONS = [
  { value: "", label: "Todas as ações" },
  { value: "create", label: "Criação" },
  { value: "update", label: "Atualização" },
  { value: "delete", label: "Exclusão" },
  { value: "duplicate", label: "Duplicação" },
  { value: "login", label: "Login" },
  { value: "login_failed", label: "Falha no login" },
  { value: "logout", label: "Logout" },
  { value: "token_refresh", label: "Refresh token" },
  { value: "password_change", label: "Troca de senha" },
  { value: "profile_update", label: "Perfil atualizado" },
  { value: "profile_picture_upload", label: "Upload de foto" },
  { value: "profile_picture_update", label: "Foto atualizada" },
  { value: "profile_picture_remove", label: "Foto removida" },
  { value: "profile_cover_upload", label: "Banner atualizado" },
  { value: "user_create", label: "Usuário criado" },
  { value: "user_update", label: "Usuário atualizado" },
  { value: "user_delete", label: "Usuário removido" },
  { value: "badge_create", label: "Medalha criada" },
  { value: "badge_update", label: "Medalha atualizada" },
  { value: "badge_delete", label: "Medalha excluída" },
  { value: "badge_holder_create", label: "Medalha atribuída" },
  { value: "badge_holder_update", label: "Medalha alterada" },
  { value: "badge_holder_delete", label: "Medalha removida" },
];

const ENTITY_OPTIONS = [
  { value: "", label: "Todas as entidades" },
  { value: "user", label: "Usuário" },
  { value: "turma", label: "Turma" },
  { value: "exercicio", label: "Exercício" },
  { value: "material", label: "Material" },
  { value: "videoaula", label: "Videoaula" },
  { value: "auth", label: "Autenticação" },
  { value: "security", label: "Segurança" },
  { value: "badge", label: "Medalha" },
];

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; label: string; surfaceClass: string; badgeClass: string }> = {
  create: {
    icon: <Plus size={14} />,
    label: "Criação",
    surfaceClass: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    badgeClass: "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300",
  },
  update: {
    icon: <Pencil size={14} />,
    label: "Atualização",
    surfaceClass: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
    badgeClass: "border-blue-300/60 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:text-blue-300",
  },
  delete: {
    icon: <Trash2 size={14} />,
    label: "Exclusão",
    surfaceClass: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
    badgeClass: "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300",
  },
  duplicate: {
    icon: <Copy size={14} />,
    label: "Duplicação",
    surfaceClass: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
    badgeClass: "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300",
  },
  login: {
    icon: <LogIn size={14} />,
    label: "Login",
    surfaceClass: "bg-primary/12 text-primary",
    badgeClass: "border-primary/25 bg-primary/10 text-primary",
  },
  login_failed: {
    icon: <ShieldCheck size={14} />,
    label: "Falha no login",
    surfaceClass: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
    badgeClass: "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300",
  },
  logout: {
    icon: <LogOut size={14} />,
    label: "Logout",
    surfaceClass: "bg-primary/12 text-primary",
    badgeClass: "border-primary/25 bg-primary/10 text-primary",
  },
  token_refresh: {
    icon: <RefreshCcw size={14} />,
    label: "Refresh token",
    surfaceClass: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
    badgeClass: "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:text-sky-300",
  },
  password_change: {
    icon: <KeyRound size={14} />,
    label: "Troca de senha",
    surfaceClass: "bg-orange-500/12 text-orange-600 dark:text-orange-300",
    badgeClass: "border-orange-300/60 bg-orange-500/10 text-orange-700 dark:border-orange-500/30 dark:text-orange-300",
  },
  profile_update: {
    icon: <User size={14} />,
    label: "Perfil atualizado",
    surfaceClass: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
    badgeClass: "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:text-sky-300",
  },
  profile_picture_upload: {
    icon: <ImageUp size={14} />,
    label: "Upload de foto",
    surfaceClass: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
    badgeClass: "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:text-sky-300",
  },
  profile_picture_update: {
    icon: <ImageUp size={14} />,
    label: "Foto atualizada",
    surfaceClass: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
    badgeClass: "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:text-sky-300",
  },
  profile_picture_remove: {
    icon: <ImageMinus size={14} />,
    label: "Foto removida",
    surfaceClass: "bg-orange-500/12 text-orange-600 dark:text-orange-300",
    badgeClass: "border-orange-300/60 bg-orange-500/10 text-orange-700 dark:border-orange-500/30 dark:text-orange-300",
  },
  profile_cover_upload: {
    icon: <ImageUp size={14} />,
    label: "Banner atualizado",
    surfaceClass: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
    badgeClass: "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:text-sky-300",
  },
  user_create: {
    icon: <Plus size={14} />,
    label: "Usuário criado",
    surfaceClass: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    badgeClass: "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300",
  },
  user_update: {
    icon: <Pencil size={14} />,
    label: "Usuário atualizado",
    surfaceClass: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
    badgeClass: "border-blue-300/60 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:text-blue-300",
  },
  user_delete: {
    icon: <Trash2 size={14} />,
    label: "Usuário removido",
    surfaceClass: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
    badgeClass: "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300",
  },
  badge_create: {
    icon: <Plus size={14} />,
    label: "Medalha criada",
    surfaceClass: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    badgeClass: "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300",
  },
  badge_update: {
    icon: <Pencil size={14} />,
    label: "Medalha atualizada",
    surfaceClass: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
    badgeClass: "border-blue-300/60 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:text-blue-300",
  },
  badge_delete: {
    icon: <Trash2 size={14} />,
    label: "Medalha excluída",
    surfaceClass: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
    badgeClass: "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300",
  },
  badge_holder_create: {
    icon: <Plus size={14} />,
    label: "Medalha atribuída",
    surfaceClass: "bg-primary/12 text-primary",
    badgeClass: "border-primary/25 bg-primary/10 text-primary",
  },
  badge_holder_update: {
    icon: <Pencil size={14} />,
    label: "Medalha alterada",
    surfaceClass: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
    badgeClass: "border-blue-300/60 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:text-blue-300",
  },
  badge_holder_delete: {
    icon: <Trash2 size={14} />,
    label: "Medalha removida",
    surfaceClass: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
    badgeClass: "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300",
  },
};

const ENTITY_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  user: { icon: <User size={14} />, label: "Usuário" },
  turma: { icon: <School size={14} />, label: "Turma" },
  exercicio: { icon: <FilePenLine size={14} />, label: "Exercício" },
  material: { icon: <FileText size={14} />, label: "Material" },
  videoaula: { icon: <Film size={14} />, label: "Videoaula" },
  auth: { icon: <LogIn size={14} />, label: "Autenticação" },
  security: { icon: <ShieldCheck size={14} />, label: "Segurança" },
  badge: { icon: <Package size={14} />, label: "Medalha" },
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "agora mesmo";
  if (minutes < 60) return `${minutes}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;
  return formatDate(value);
}

function truncate(value: string | null | undefined, max = 40) {
  if (!value) return "-";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function detectOSFromUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  if (ua.includes("windows nt 10.0")) return "Windows 10/11";
  if (ua.includes("windows nt 6.3")) return "Windows 8.1";
  if (ua.includes("windows nt 6.2")) return "Windows 8";
  if (ua.includes("windows nt 6.1")) return "Windows 7";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iOS";
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  if (ua.includes("cros")) return "ChromeOS";

  return "SO desconhecido";
}

function detectBrowserFromUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  if (ua.includes("edg/")) return "Microsoft Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("firefox/")) return "Mozilla Firefox";
  if (ua.includes("samsungbrowser/")) return "Samsung Internet";
  if (ua.includes("chrome/") && !ua.includes("edg/") && !ua.includes("opr/")) return "Google Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";

  return "Navegador desconhecido";
}

type MetadataEntry = {
  key: string;
  type: "texto" | "numero" | "booleano" | "lista" | "objeto" | "nulo";
  valueLabel: string;
  rawValue: unknown;
};

function metadataType(value: unknown): MetadataEntry["type"] {
  if (value === null) return "nulo";
  if (Array.isArray(value)) return "lista";
  if (typeof value === "number") return "numero";
  if (typeof value === "boolean") return "booleano";
  if (typeof value === "object") return "objeto";
  return "texto";
}

function metadataLabel(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `${value.length} item(ns)`;
  if (typeof value === "object") return `${Object.keys(value as Record<string, unknown>).length} campo(s)`;
  return String(value);
}

function normalizeMetadata(metadata: ActivityLog["metadata"]): MetadataEntry[] {
  if (!metadata) return [];
  return Object.entries(metadata)
    .map(([key, value]) => ({
      key,
      type: metadataType(value),
      valueLabel: metadataLabel(value),
      rawValue: value,
    }))
    .sort((a, b) => a.key.localeCompare(b.key, "pt-BR"));
}

function roleBadgeClass(role: string | null | undefined) {
  if (role === "admin") {
    return "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300";
  }
  if (role === "professor") {
    return "border-violet-300/60 bg-violet-500/10 text-violet-700 dark:border-violet-500/30 dark:text-violet-300";
  }
  return "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:text-sky-300";
}

function metadataTypeClass(type: MetadataEntry["type"]) {
  switch (type) {
    case "texto":
      return "border-blue-300/60 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:text-blue-300";
    case "numero":
      return "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300";
    case "booleano":
      return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300";
    case "lista":
    case "objeto":
      return "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300";
    default:
      return "border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:text-slate-300";
  }
}

export default function ActivityLogsPage() {
  const [logSection, setLogSection] = React.useState<LogSection>("users");
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<Filters>(defaultFilters);
  const [draft, setDraft] = React.useState<Filters>(defaultFilters);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);
  const [totalItems, setTotalItems] = React.useState(0);
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [showFilters, setShowFilters] = React.useState(false);

  const carregarLogs = React.useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);
      const offset = (currentPage - 1) * itemsPerPage;
      const { items, total } = await listarActivityLogs({
        limit: itemsPerPage,
        offset,
        actorGroup: logSection === "users" ? "user" : "staff",
        q: filters.q || undefined,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
        actorId: filters.actorId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setLogs(items);
      setTotalItems(total);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filters, logSection]);

  React.useEffect(() => {
    carregarLogs();
  }, [carregarLogs]);

  const aplicarFiltros = () => {
    setCurrentPage(1);
    setFilters(draft);
  };

  const limparFiltros = () => {
    setCurrentPage(1);
    setDraft(defaultFilters);
    setFilters(defaultFilters);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") aplicarFiltros();
  };

  const handleSectionChange = (section: LogSection) => {
    if (section === logSection) return;
    setLogSection(section);
    setCurrentPage(1);
    setExpandedRow(null);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // Stats
  const stats = React.useMemo(() => {
    const actions: Record<string, number> = {};
    for (const log of logs) {
      actions[log.action] = (actions[log.action] || 0) + 1;
    }
    return actions;
  }, [logs]);

  const panelClass = "rounded-[28px] border border-border/70 bg-card/95 shadow-sm";
  const filterFieldClass =
    "h-10 w-full rounded-xl border border-input bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30";

  return (
    <DashboardLayout
      title="Logs de Atividade"
      subtitle={
        logSection === "users"
          ? "Acompanhe atividades dos usuarios (alunos)"
          : "Acompanhe atividades de administradores e professores"
      }
    >
      <FadeInUp duration={0.28}>
        <div className="space-y-6">
          <div className="inline-flex max-w-full flex-wrap gap-2 rounded-2xl border border-border/70 bg-card/95 p-2 shadow-sm" role="tablist" aria-label="Secoes de logs">
            <button
              type="button"
              role="tab"
              aria-selected={logSection === "users"}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                logSection === "users"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => handleSectionChange("users")}
            >
              <span className="inline-flex"><User size={15} /></span>
              Logs de usuarios
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={logSection === "staff"}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                logSection === "staff"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => handleSectionChange("staff")}
            >
              <span className="inline-flex"><ShieldCheck size={15} /></span>
              Logs de admin/professor
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ScaleIn delay={0}>
              <div className={`${panelClass} flex items-center gap-4 p-5`}>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-300">
                  <span>Σ</span>
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold tracking-tight text-foreground">{totalItems}</div>
                  <div className="text-xs font-medium text-muted-foreground">Total de Logs</div>
                </div>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.05}>
              <div className={`${panelClass} flex items-center gap-4 p-5`}>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <span>+</span>
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold tracking-tight text-foreground">{stats.create || 0}</div>
                  <div className="text-xs font-medium text-muted-foreground">Criações</div>
                </div>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.1}>
              <div className={`${panelClass} flex items-center gap-4 p-5`}>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
                  <span className="inline-flex"><Pencil size={16} /></span>
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold tracking-tight text-foreground">{stats.update || 0}</div>
                  <div className="text-xs font-medium text-muted-foreground">Atualizações</div>
                </div>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.15}>
              <div className={`${panelClass} flex items-center gap-4 p-5`}>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
                  <span className="inline-flex"><Trash2 size={16} /></span>
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold tracking-tight text-foreground">{stats.delete || 0}</div>
                  <div className="text-xs font-medium text-muted-foreground">Exclusões</div>
                </div>
              </div>
            </ScaleIn>
          </div>

<<<<<<< Updated upstream
          <div className={`${panelClass} p-4`}>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[260px] flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 inline-flex -translate-y-1/2 text-muted-foreground">
=======
          {/* Search & Filter Bar */}
          <div className="alToolbar">
            <div className="alSearchRow">
              <div className="alSearchWrap">
                <span className="alSearchIcon">
>>>>>>> Stashed changes
                  <Search size={16} />
                </span>
                <Input
                  type="text"
                  className="h-11 rounded-xl border-input bg-background/80 pl-10 pr-10"
                  placeholder="Buscar por usuário, ação, entidade..."
                  value={draft.q}
                  onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
                  onKeyDown={handleKeyDown}
                />
                {draft.q && (
                  <button
                    className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    onClick={() => setDraft((prev) => ({ ...prev, q: "" }))}
                    aria-label="Limpar busca"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="relative h-11 rounded-xl border-border/70 bg-background/80 px-4"
                onClick={() => setShowFilters(!showFilters)}
              >
                <span className="inline-flex">
                  <SlidersHorizontal size={16} />
                </span>
                Filtros
                {hasActiveFilters && <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" />}
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                onClick={aplicarFiltros}
              >
                Buscar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-border/70 bg-background/80"
                onClick={carregarLogs}
                title="Atualizar"
              >
                <RefreshCcw size={16} />
              </Button>
            </div>

            {showFilters && (
              <div className="mt-4 border-t border-border/70 pt-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-2">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ação</span>
                    <select
                      className={filterFieldClass}
                      value={draft.action}
                      onChange={(e) => setDraft((prev) => ({ ...prev, action: e.target.value }))}
                    >
                      {ACTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Entidade</span>
                    <select
                      className={filterFieldClass}
                      value={draft.entityType}
                      onChange={(e) => setDraft((prev) => ({ ...prev, entityType: e.target.value }))}
                    >
                      {ENTITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Actor ID</span>
                    <Input
                      type="text"
                      className="h-10 rounded-xl border-input bg-background/80"
                      placeholder="ID do usuário"
                      value={draft.actorId}
                      onChange={(e) => setDraft((prev) => ({ ...prev, actorId: e.target.value }))}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">De</span>
                    <Input
                      type="datetime-local"
                      className="h-10 rounded-xl border-input bg-background/80"
                      value={draft.from}
                      onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Até</span>
                    <Input
                      type="datetime-local"
                      className="h-10 rounded-xl border-input bg-background/80"
                      value={draft.to}
                      onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                    />
                  </div>
                </div>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3 h-9 rounded-xl px-3 text-primary hover:text-primary"
                    onClick={limparFiltros}
                  >
                    Limpar todos os filtros
                  </Button>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className={`${panelClass} flex flex-col items-center gap-4 px-6 py-14 text-sm text-muted-foreground`}>
              <Loader2 size={28} className="animate-spin text-primary" />
              <span>Carregando logs...</span>
            </div>
          ) : erro ? (
            <div className={`${panelClass} flex flex-col items-center gap-4 px-6 py-14 text-center`}>
              <span className="flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-xl font-bold text-rose-600 dark:text-rose-300">!</span>
              <span className="text-sm font-medium text-rose-700 dark:text-rose-300">Erro: {erro}</span>
              <Button type="button" className="h-10 rounded-xl bg-primary px-4 text-primary-foreground hover:bg-primary/90" onClick={carregarLogs}>
                Tentar novamente
              </Button>
            </div>
          ) : logs.length === 0 ? (
            <div className={`${panelClass} flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center`}>
              <span className="inline-flex rounded-full bg-muted p-4 text-muted-foreground">
                <ClipboardList size={20} />
              </span>
              <span className="text-base font-semibold text-foreground">Nenhum log encontrado</span>
              <span className="max-w-md text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Tente ajustar os filtros para encontrar o que procura."
                  : logSection === "users"
                    ? "Ainda nao ha registros de atividade de usuarios."
                    : "Ainda nao ha registros de atividade de admin/professor."}
              </span>
              {hasActiveFilters && (
                <Button type="button" variant="outline" className="h-10 rounded-xl border-border/70 bg-background/80 px-4" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {logs.map((log) => {
                  const actionCfg = ACTION_CONFIG[log.action] || {
                    icon: <Paperclip size={14} />,
                    label: log.action,
                    surfaceClass: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
                    badgeClass: "border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:text-slate-300",
                  };
                  const entityCfg = ENTITY_CONFIG[log.entityType] || {
                    icon: <Paperclip size={14} />,
                    label: log.entityType,
                  };
                  const actorName = log.actorNome || log.actorUsuario || "Sistema";
                  const isExpanded = expandedRow === log.id;
                  const metadataEntries = normalizeMetadata(log.metadata);
                  const hasMetadata = metadataEntries.length > 0;

                  return (
                    <div
                      key={log.id}
                      className={cn(
                        `${panelClass} cursor-pointer p-4 transition`,
                        isExpanded && "border-primary/25 shadow-md"
                      )}
                      onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedRow(isExpanded ? null : log.id);
                        }
                      }}
                    >
                      <div className="flex gap-4">
                        <div className={cn("mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl", actionCfg.surfaceClass)}>
                          {actionCfg.icon}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{actorName}</span>
                              {log.actorRole && (
                                <Badge className={cn("rounded-full px-2.5 text-[11px] font-semibold", roleBadgeClass(log.actorRole))}>
                                  {log.actorRole}
                                </Badge>
                              )}
                              <Badge className={cn("rounded-full px-2.5 text-[11px] font-semibold", actionCfg.badgeClass)}>
                                {actionCfg.label}
                              </Badge>
                              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                {entityCfg.icon} {entityCfg.label}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">{timeAgo(log.createdAt)}</div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {log.actorUsuario && (
                              <Badge variant="outline" className="rounded-full px-2.5 text-[11px] font-medium">
                                @{log.actorUsuario}
                              </Badge>
                            )}
                            {log.entityId && (
                              <Badge variant="outline" className="rounded-full px-2.5 text-[11px] font-medium" title={log.entityId}>
                                ID: {truncate(log.entityId, 12)}
                              </Badge>
                            )}
                            {log.ipAddress && (
                              <Badge variant="outline" className="rounded-full px-2.5 text-[11px] font-medium">
                                IP: {log.ipAddress}
                              </Badge>
                            )}
                            {hasMetadata && (
                              <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/8 px-2.5 text-[11px] font-medium text-primary">
                                {isExpanded ? "▾ Menos" : "▸ Detalhes"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 border-t border-border/70 pt-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Data/Hora</span>
                              <span className="text-sm text-foreground">{formatDate(log.createdAt)}</span>
                            </div>
                            <div className="space-y-1">
                              <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">ID do Log</span>
                              <span className="inline-flex rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{log.id}</span>
                            </div>
                            {log.actorId && (
                              <div className="space-y-1">
                                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Actor ID</span>
                                <span className="inline-flex rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{log.actorId}</span>
                              </div>
                            )}
                            {log.entityId && (
                              <div className="space-y-1">
                                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Entity ID</span>
                                <span className="inline-flex rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{log.entityId}</span>
                              </div>
                            )}
                            {log.userAgent && (
                              <div className="space-y-1">
                                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sistema Operacional</span>
                                <span className="text-sm text-foreground">{detectOSFromUserAgent(log.userAgent)}</span>
                              </div>
                            )}
                            {log.userAgent && (
                              <div className="space-y-1">
                                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Navegador</span>
                                <span className="text-sm text-foreground">{detectBrowserFromUserAgent(log.userAgent)}</span>
                              </div>
                            )}
                            {log.userAgent && (
                              <div className="space-y-1 md:col-span-2">
                                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">User Agent</span>
                                <span className="block rounded-xl border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground break-all">
                                  {log.userAgent}
                                </span>
                              </div>
                            )}
                            {hasMetadata && (
                              <div className="space-y-2 md:col-span-2">
                                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Metadata</span>
                                <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/35" role="table" aria-label="Metadados do log">
                                  <div className="hidden grid-cols-[minmax(130px,1.2fr)_90px_minmax(160px,2fr)] gap-3 border-b border-border/70 bg-muted/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground md:grid" role="row">
                                    <span role="columnheader">Campo</span>
                                    <span role="columnheader">Tipo</span>
                                    <span role="columnheader">Valor</span>
                                  </div>
                                  {metadataEntries.map((entry) => (
                                    <div key={entry.key} className="grid gap-2 border-b border-border/70 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(130px,1.2fr)_90px_minmax(160px,2fr)] md:items-center md:gap-3" role="row">
                                      <span className="font-mono text-xs text-foreground" role="cell">
                                        {entry.key}
                                      </span>
                                      <span role="cell">
                                        <Badge className={cn("rounded-full px-2.5 text-[11px] font-semibold", metadataTypeClass(entry.type))}>
                                        {entry.type}
                                        </Badge>
                                      </span>
                                      <span className="text-xs text-foreground" role="cell" title={entry.valueLabel}>
                                        {entry.valueLabel}
                                      </span>
                                      {(entry.type === "objeto" || entry.type === "lista") && (
                                        <pre className="md:col-span-3 mt-1 overflow-x-auto rounded-xl border border-border/70 bg-background/80 p-3 text-xs text-foreground">
                                          {JSON.stringify(entry.rawValue, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Pagination
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </>
          )}
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
