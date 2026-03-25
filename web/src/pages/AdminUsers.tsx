import React from "react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { FadeInUp } from "../components/animate-ui/FadeInUp";
import { AnimatedToast } from "../components/animate-ui/AnimatedToast";
import {
  listarUsuariosPaginado,
  atualizarUsuario,
  deletarUsuario,
  type User,
} from "../services/api";
import { getPresenceSnapshot, subscribeToPresence } from "../services/presenceSocket";
import {
  GraduationCap,
  User as UserIcon,
  KeyRound,
  Pencil,
  Trash2,
  Search,
  RefreshCcw,
  Loader2,
  Save,
  X,
  Copy,
  Mail,
  MoreHorizontal,
} from "lucide-react";

const PRESENCE_STALE_AFTER_MS = 90_000;
const PRESENCE_RENDER_TICK_MS = 15_000;

const pageTitle = "Gerenciar Usuarios";
const pageSubtitle = "Gerencie alunos, professores e admins";

const surfaceCardClass =
  "rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(225,29,46,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] bg-card/95 shadow-[0_18px_44px_rgba(0,0,0,0.16)]";
const fieldClass =
  "h-12 w-full rounded-2xl border border-border/75 bg-card px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-muted-foreground/90 hover:border-primary/35 focus:border-primary focus:ring-4 focus:ring-ring/30";
const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_24px_rgba(225,29,46,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border/80 bg-muted/45 px-4 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60";
const emptyCardClass =
  "rounded-[28px] border border-dashed border-border/80 bg-[radial-gradient(circle_at_top,rgba(225,29,46,0.09),transparent_44%)] bg-muted/35 px-6 py-12 text-center text-sm text-muted-foreground shadow-[0_18px_44px_rgba(0,0,0,0.12)]";
const usersTableShellClass = cn(surfaceCardClass, "overflow-hidden p-0");
const mobileActionTriggerClass =
  "inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-muted/45 text-muted-foreground transition hover:border-primary/35 hover:bg-accent";

type RoleFilter = "todos" | "aluno" | "professor" | "admin";

function getPresenceTimestamp(lastSeenAt?: string | null) {
  if (!lastSeenAt) return null;
  const parsed = Date.parse(lastSeenAt);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPresenceStillOnline(isOnline: boolean | undefined, lastSeenAt?: string | null, now = Date.now()) {
  if (!isOnline) return false;
  const timestamp = getPresenceTimestamp(lastSeenAt);
  if (timestamp === null) return false;
  return now - timestamp <= PRESENCE_STALE_AFTER_MS;
}

function formatRelativeActivity(lastSeenAt?: string | null, isOnline?: boolean, now = Date.now()) {
  if (isOnline) return "Agora";

  const timestamp = getPresenceTimestamp(lastSeenAt);
  if (timestamp === null) return "Sem atividade";

  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "Agora";
  if (diffMinutes < 60) return `${diffMinutes}min atras`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h atras`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} dia${diffDays === 1 ? "" : "s"} atras`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} semana${diffWeeks === 1 ? "" : "s"} atras`;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(timestamp));
}

function getRoleMeta(role: User["role"]) {
  if (role === "aluno") {
    return {
      label: "Aluno",
      icon: GraduationCap,
      badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-200",
      avatarClass: "border-sky-500/25 bg-sky-500/10 text-sky-100",
    };
  }

  if (role === "professor") {
    return {
      label: "Professor",
      icon: UserIcon,
      badgeClass: "border-violet-500/30 bg-violet-500/10 text-violet-200",
      avatarClass: "border-violet-500/25 bg-violet-500/10 text-violet-100",
    };
  }

  return {
    label: "Admin",
    icon: KeyRound,
    badgeClass: "border-primary/30 bg-primary/10 text-red-200",
    avatarClass: "border-primary/25 bg-primary/10 text-red-100",
  };
}

export default function AdminUsersPage() {
  const [usuarios, setUsuarios] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = React.useState<RoleFilter>("todos");
  const [busca, setBusca] = React.useState("");

  const [editandoUsuario, setEditandoUsuario] = React.useState<User | null>(null);
  const [editNome, setEditNome] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editarAberto, setEditarAberto] = React.useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = React.useState(false);
  const [alterandoPapelId, setAlterandoPapelId] = React.useState<string | null>(null);

  const [usuarioDeletar, setUsuarioDeletar] = React.useState<User | null>(null);
  const [deletando, setDeletando] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);
  const [totalItems, setTotalItems] = React.useState(0);
  const [presenceNow, setPresenceNow] = React.useState(() => Date.now());
  const hasLoadedUsersRef = React.useRef(false);
  const lastSeenFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    []
  );

  const showFeedback = React.useCallback((tipo: "sucesso" | "erro", mensagem: string) => {
    setFeedback({ tipo, mensagem });
  }, []);

  const applyPresenceState = React.useCallback((userId: string, isOnline: boolean, lastSeenAt: string) => {
    setUsuarios((current) =>
      current.map((usuario) =>
        usuario.id === userId
          ? {
              ...usuario,
              isOnline,
              lastSeenAt,
            }
          : usuario
      )
    );
  }, []);

  const clearVisiblePresenceState = React.useCallback(() => {
    setUsuarios((current) =>
      current.map((usuario) => ({
        ...usuario,
        isOnline: false,
      }))
    );
  }, []);

  const mergePresenceSnapshot = React.useCallback((items: User[]) => {
    const snapshot = new Map(
      getPresenceSnapshot().map((presence) => [
        presence.userId,
        presence,
      ])
    );

    return items.map((usuario) => {
      const currentPresence = snapshot.get(usuario.id);
      if (!currentPresence) {
        return usuario;
      }

      return {
        ...usuario,
        isOnline: currentPresence.isOnline,
        lastSeenAt: currentPresence.lastSeenAt,
      };
    });
  }, []);

  React.useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPresenceNow(Date.now());
    }, PRESENCE_RENDER_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const carregarUsuarios = React.useCallback(async () => {
    const keepVisibleContent = hasLoadedUsersRef.current;

    try {
      if (keepVisibleContent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErro(null);
      const response = await listarUsuariosPaginado({
        role: filtroTipo === "todos" ? undefined : filtroTipo,
        q: busca.trim() || undefined,
        page: currentPage,
        limit: itemsPerPage,
      });

      setUsuarios(mergePresenceSnapshot(response.items));
      setTotalItems(response.total);
      hasLoadedUsersRef.current = true;

      const safeTotalPages = Math.max(response.pagination.totalPages || 1, 1);
      if (currentPage > safeTotalPages) {
        setCurrentPage(safeTotalPages);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar usuarios");
    } finally {
      if (keepVisibleContent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [busca, currentPage, filtroTipo, itemsPerPage, mergePresenceSnapshot]);

  React.useEffect(() => {
    void carregarUsuarios();
  }, [carregarUsuarios]);

  React.useEffect(() => {
    const snapshot = getPresenceSnapshot();
    for (const presence of snapshot) {
      applyPresenceState(presence.userId, presence.isOnline, presence.lastSeenAt);
    }

    const unsubscribe = subscribeToPresence((message) => {
      if (message.type === "presence:reset") {
        clearVisiblePresenceState();
        return;
      }

      if (message.type !== "presence:update" && message.type !== "presence:hello") {
        return;
      }

      applyPresenceState(message.userId, message.isOnline, message.lastSeenAt);
    });

    return unsubscribe;
  }, [applyPresenceState, clearVisiblePresenceState]);

  const abrirEditar = React.useCallback((usuario: User) => {
    setEditandoUsuario(usuario);
    setEditNome(usuario.nome);
    setEditEmail(usuario.email ?? usuario.usuario ?? "");
    setEditarAberto(true);
  }, []);

  const fecharEditar = React.useCallback(() => {
    setEditarAberto(false);
    setEditandoUsuario(null);
    setEditNome("");
    setEditEmail("");
  }, []);

  const copiarContato = React.useCallback(
    async (usuario: User) => {
      const contato = usuario.email ?? usuario.usuario;
      if (!contato) {
        showFeedback("erro", "Usuario sem contato disponivel");
        return;
      }

      try {
        await navigator.clipboard.writeText(contato);
        showFeedback("sucesso", "Contato copiado com sucesso");
      } catch {
        showFeedback("erro", "Nao foi possivel copiar o contato");
      }
    },
    [showFeedback]
  );

  const enviarEmail = React.useCallback(
    (usuario: User) => {
      if (!usuario.email) {
        showFeedback("erro", "Usuario sem e-mail configurado");
        return;
      }

      window.location.href = `mailto:${usuario.email}`;
    },
    [showFeedback]
  );

  const alterarPapel = React.useCallback(
    async (usuario: User, role: User["role"]) => {
      if (usuario.role === role) return;

      try {
        setAlterandoPapelId(usuario.id);
        await atualizarUsuario(usuario.id, { role });
        await carregarUsuarios();
        showFeedback("sucesso", `Papel de ${usuario.nome} atualizado para ${getRoleMeta(role).label}`);
      } catch (err) {
        showFeedback("erro", err instanceof Error ? err.message : "Erro ao alterar papel do usuario");
      } finally {
        setAlterandoPapelId(null);
      }
    },
    [carregarUsuarios, showFeedback]
  );

  const salvarEdicao = async () => {
    if (!editandoUsuario) return;

    if (!editNome.trim() || !editEmail.trim()) {
      showFeedback("erro", "Nome e usuario sao obrigatorios");
      return;
    }

    try {
      setSalvandoEdicao(true);
      await atualizarUsuario(editandoUsuario.id, {
        nome: editNome.trim(),
        email: editEmail.trim(),
      });

      await carregarUsuarios();
      fecharEditar();
      showFeedback("sucesso", "Usuario atualizado com sucesso");
    } catch (err) {
      showFeedback("erro", err instanceof Error ? err.message : "Erro ao atualizar usuario");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const confirmarDeletar = async () => {
    if (!usuarioDeletar) return;

    try {
      setDeletando(true);
      await deletarUsuario(usuarioDeletar.id);
      await carregarUsuarios();
      setUsuarioDeletar(null);
      showFeedback("sucesso", "Usuario deletado com sucesso");
    } catch (err) {
      showFeedback("erro", err instanceof Error ? err.message : "Erro ao deletar usuario");
    } finally {
      setDeletando(false);
    }
  };

  if (loading && !hasLoadedUsersRef.current) {
    return (
      <DashboardLayout title={pageTitle} subtitle={pageSubtitle}>
        <div className={cn(surfaceCardClass, "grid place-items-center gap-3 px-6 py-16 text-center")}>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Carregando usuarios...</p>
            <p className="text-sm text-muted-foreground">Buscando a lista paginada e o status de presence.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (erro && !hasLoadedUsersRef.current) {
    return (
      <DashboardLayout title={pageTitle} subtitle={pageSubtitle}>
        <div className={cn(emptyCardClass, "space-y-4")}>
          <div className="space-y-2">
            <p className="text-base font-semibold text-foreground">Nao foi possivel carregar os usuarios.</p>
            <p className="mx-auto max-w-xl leading-6 text-muted-foreground">{erro}</p>
          </div>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              void carregarUsuarios();
            }}
          >
            <RefreshCcw size={16} />
            <span>Tentar novamente</span>
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const editRoleMeta = editandoUsuario ? getRoleMeta(editandoUsuario.role) : null;
  const EditRoleIcon = editRoleMeta?.icon;

  return (
    <DashboardLayout title={pageTitle} subtitle={pageSubtitle}>
      <AnimatedToast
        message={feedback?.mensagem || null}
        type={feedback?.tipo === "sucesso" ? "success" : "error"}
        duration={3000}
        onClose={() => setFeedback(null)}
      />

      <FadeInUp duration={0.28}>
        <div className="flex flex-col gap-6">
          <FadeInUp duration={0.28} delay={0.04}>
            <section className={cn(surfaceCardClass, "p-4 sm:p-5")}>
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_220px_auto]">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex w-14 items-center justify-center text-muted-foreground">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por nome ou e-mail..."
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={cn(fieldClass, "pl-16")}
                    style={{ paddingLeft: "4rem" }}
                  />
                </div>

                <select
                  value={filtroTipo}
                  onChange={(e) => {
                    setFiltroTipo(e.target.value as RoleFilter);
                    setCurrentPage(1);
                  }}
                  className={cn(fieldClass, "appearance-none")}
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="aluno">Alunos</option>
                  <option value="professor">Professores</option>
                  <option value="admin">Admins</option>
                </select>

                <button
                  type="button"
                  className={cn(secondaryButtonClass, "w-full xl:w-auto")}
                  onClick={() => {
                    void carregarUsuarios();
                  }}
                  disabled={refreshing}
                  title="Atualizar usuarios"
                >
                  {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                  <span>{refreshing ? "Atualizando..." : "Atualizar usuarios"}</span>
                </button>
              </div>
            </section>
          </FadeInUp>

          {erro ? (
            <FadeInUp duration={0.24} delay={0.08}>
              <section className="rounded-[24px] border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-200 shadow-[0_14px_32px_rgba(127,29,29,0.14)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p>{erro}</p>
                  <button
                    type="button"
                    className={cn(secondaryButtonClass, "h-10 px-4 text-xs uppercase tracking-[0.24em]")}
                    onClick={() => {
                      void carregarUsuarios();
                    }}
                  >
                    <RefreshCcw size={14} />
                    <span>Tentar de novo</span>
                  </button>
                </div>
              </section>
            </FadeInUp>
          ) : null}

          {totalItems === 0 ? (
            <FadeInUp duration={0.28} delay={0.12}>
              <section className={emptyCardClass}>
                <p className="text-base font-semibold text-foreground">Nenhum usuario encontrado.</p>
                <p className="mx-auto mt-2 max-w-xl leading-6 text-muted-foreground">
                  Ajuste a busca ou troque o filtro de tipo para ver outros registros.
                </p>
              </section>
            </FadeInUp>
          ) : (
            <>
              <FadeInUp duration={0.28} delay={0.12}>
                <section className={usersTableShellClass}>
                  <div className="border-b border-border/70 px-4 py-3 sm:px-6">
                    <p className="text-sm text-muted-foreground">
                      Clique com o botao direito em um usuario para ver as opcoes.
                    </p>
                  </div>

                  <div className="hidden grid-cols-[minmax(0,1.7fr)_160px_150px_170px] gap-4 border-b border-border/70 bg-muted/20 px-6 py-4 lg:grid">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Usuario
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Papel
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Status
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Ultima atividade
                    </span>
                  </div>

                  <div className="divide-y divide-border/70">
                  {usuarios.map((usuario, idx) => {
                    const isEffectivelyOnline = isPresenceStillOnline(
                      usuario.isOnline,
                      usuario.lastSeenAt,
                      presenceNow
                    );
                    const roleMeta = getRoleMeta(usuario.role);
                    const RoleIcon = roleMeta.icon;
                    const contato = usuario.email ?? usuario.usuario ?? "Sem contato cadastrado";
                    const copyTarget = usuario.email ?? usuario.usuario ?? null;
                    const lastSeenLabel = usuario.lastSeenAt
                      ? `Visto em ${lastSeenFormatter.format(new Date(usuario.lastSeenAt))}`
                      : "Sem atividade recente";
                    const activityLabel = formatRelativeActivity(
                      usuario.lastSeenAt,
                      isEffectivelyOnline,
                      presenceNow
                    );
                    const initial = usuario.nome.trim().charAt(0).toUpperCase() || "U";

                    return (
                      <FadeInUp key={usuario.id} duration={0.24} delay={Math.min(0.08 + idx * 0.04, 0.28)}>
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              className={cn(
                                "grid w-full cursor-context-menu gap-4 px-4 py-4 text-left transition hover:bg-accent/20 sm:px-6 lg:grid-cols-[minmax(0,1.7fr)_160px_150px_170px] lg:items-center",
                                refreshing && "opacity-85"
                              )}
                            >
                              <div className="flex min-w-0 items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                <div
                                  className={cn(
                                    "grid size-10 shrink-0 place-items-center rounded-full border text-sm font-black uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                                    roleMeta.avatarClass
                                  )}
                                >
                                  {initial}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-lg font-black tracking-[-0.02em] text-foreground">
                                    {usuario.nome}
                                  </p>
                                  <p className="truncate font-mono text-sm text-muted-foreground">{contato}</p>
                                </div>
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className={cn(mobileActionTriggerClass, "lg:hidden")}
                                      aria-label={`Acoes para ${usuario.nome}`}
                                    >
                                      <MoreHorizontal />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="min-w-56 lg:hidden">
                                    <DropdownMenuLabel>{usuario.nome}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem onSelect={() => abrirEditar(usuario)}>
                                      <Pencil size={15} />
                                      <span>Editar usuario</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      disabled={!copyTarget}
                                      onSelect={() => {
                                        void copiarContato(usuario);
                                      }}
                                    >
                                      <Copy size={15} />
                                      <span>Copiar contato</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      disabled={!usuario.email}
                                      onSelect={() => enviarEmail(usuario)}
                                    >
                                      <Mail size={15} />
                                      <span>Enviar email</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger disabled={alterandoPapelId === usuario.id}>
                                        <KeyRound size={15} />
                                        <span>{alterandoPapelId === usuario.id ? "Alterando papel..." : "Alterar papel"}</span>
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent className="min-w-48">
                                        {(["admin", "professor", "aluno"] as const).map((roleOption) => {
                                          const roleOptionMeta = getRoleMeta(roleOption);
                                          const RoleOptionIcon = roleOptionMeta.icon;

                                          return (
                                            <DropdownMenuItem
                                              key={roleOption}
                                              disabled={alterandoPapelId === usuario.id || usuario.role === roleOption}
                                              onSelect={() => {
                                                void alterarPapel(usuario, roleOption);
                                              }}
                                            >
                                              <RoleOptionIcon size={15} />
                                              <span>{roleOptionMeta.label}</span>
                                            </DropdownMenuItem>
                                          );
                                        })}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem variant="destructive" onSelect={() => setUsuarioDeletar(usuario)}>
                                      <Trash2 size={15} />
                                      <span>Deletar usuario</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div className="flex items-center gap-2 lg:block">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground lg:hidden">
                                  Papel
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.22em]",
                                    roleMeta.badgeClass
                                  )}
                                >
                                  <RoleIcon size={14} />
                                  {roleMeta.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 lg:block">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground lg:hidden">
                                  Status
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-2 text-sm font-semibold",
                                    isEffectivelyOnline ? "text-emerald-300" : "text-muted-foreground"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "size-2 rounded-full",
                                      isEffectivelyOnline ? "bg-emerald-400" : "bg-slate-400"
                                    )}
                                  />
                                  {isEffectivelyOnline ? "Ativo" : "Offline"}
                                </span>
                              </div>

                              <div
                                className="flex items-center gap-2 text-sm text-muted-foreground lg:justify-end"
                                title={lastSeenLabel}
                              >
                                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground lg:hidden">
                                  Ultima atividade
                                </span>
                                <span className="font-mono text-sm">{activityLabel}</span>
                              </div>
                            </div>
                          </ContextMenuTrigger>

                          <ContextMenuContent className="min-w-60">
                            <ContextMenuLabel>{usuario.nome}</ContextMenuLabel>
                            <ContextMenuSeparator />

                            <ContextMenuItem onSelect={() => abrirEditar(usuario)}>
                              <Pencil size={15} />
                              <span>Editar usuario</span>
                            </ContextMenuItem>

                            <ContextMenuItem
                              disabled={!copyTarget}
                              onSelect={() => {
                                void copiarContato(usuario);
                              }}
                            >
                              <Copy size={15} />
                              <span>Copiar contato</span>
                            </ContextMenuItem>

                            <ContextMenuItem
                              disabled={!usuario.email}
                              onSelect={() => enviarEmail(usuario)}
                            >
                              <Mail size={15} />
                              <span>Enviar email</span>
                            </ContextMenuItem>

                            <ContextMenuSub>
                              <ContextMenuSubTrigger disabled={alterandoPapelId === usuario.id}>
                                <KeyRound size={15} />
                                <span>{alterandoPapelId === usuario.id ? "Alterando papel..." : "Alterar papel"}</span>
                              </ContextMenuSubTrigger>
                              <ContextMenuSubContent className="min-w-48">
                                {(["admin", "professor", "aluno"] as const).map((roleOption) => {
                                  const roleOptionMeta = getRoleMeta(roleOption);
                                  const RoleOptionIcon = roleOptionMeta.icon;

                                  return (
                                    <ContextMenuItem
                                      key={roleOption}
                                      disabled={alterandoPapelId === usuario.id || usuario.role === roleOption}
                                      onSelect={() => {
                                        void alterarPapel(usuario, roleOption);
                                      }}
                                    >
                                      <RoleOptionIcon size={15} />
                                      <span>{roleOptionMeta.label}</span>
                                    </ContextMenuItem>
                                  );
                                })}
                              </ContextMenuSubContent>
                            </ContextMenuSub>

                            <ContextMenuSeparator />

                            <ContextMenuItem variant="destructive" onSelect={() => setUsuarioDeletar(usuario)}>
                              <Trash2 size={15} />
                              <span>Deletar usuario</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </FadeInUp>
                    );
                  })}
                  </div>
                </section>
              </FadeInUp>

              <FadeInUp duration={0.28} delay={0.16}>
                <Pagination
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalItems}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </FadeInUp>
            </>
          )}

          <Modal
            isOpen={editarAberto && !!editandoUsuario}
            onClose={salvandoEdicao ? () => undefined : fecharEditar}
            title="Editar Usuario"
            size="sm"
            closeOnEscape={!salvandoEdicao}
            closeOnBackdropClick={!salvandoEdicao}
            footer={
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">Confira os dados antes de salvar.</div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={fecharEditar}
                    disabled={salvandoEdicao}
                  >
                    <X size={16} />
                    <span>Cancelar</span>
                  </button>

                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => {
                      void salvarEdicao();
                    }}
                    disabled={salvandoEdicao}
                  >
                    {salvandoEdicao ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{salvandoEdicao ? "Salvando..." : "Salvar alteracoes"}</span>
                  </button>
                </div>
              </div>
            }
          >
            <div className="grid gap-4">
              <label className="grid gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Nome
                </span>
                <input
                  type="text"
                  className={fieldClass}
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  placeholder="Digite o nome"
                />
              </label>

              <label className="grid gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  E-mail
                </span>
                <input
                  type="email"
                  className={fieldClass}
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Digite o e-mail"
                />
              </label>

              <div className="grid gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Tipo
                </span>

                <div className="rounded-[24px] border border-border/70 bg-muted/25 p-4">
                  {editRoleMeta && EditRoleIcon ? (
                    <div
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.22em]",
                        editRoleMeta.badgeClass
                      )}
                    >
                      <EditRoleIcon size={14} />
                      <span>{editRoleMeta.label}</span>
                    </div>
                  ) : null}

                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Alterar o tipo de usuario continua exigindo ajuste manual no backend ou no banco.
                  </p>
                </div>
              </div>
            </div>
          </Modal>

          <ConfirmDialog
            isOpen={!!usuarioDeletar}
            onClose={() => setUsuarioDeletar(null)}
            onConfirm={confirmarDeletar}
            title="Deletar Usuario"
            message={`Tem certeza que deseja deletar o usuario "${usuarioDeletar?.nome}"? Esta acao nao pode ser desfeita.`}
            confirmText="Deletar"
            cancelText="Cancelar"
            isLoading={deletando}
            isDangerous
          />
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
