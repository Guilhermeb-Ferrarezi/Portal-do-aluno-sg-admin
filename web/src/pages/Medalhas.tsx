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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import PaginatedSelect from "../components/PaginatedSelect";
import Modal from "../components/Modal";
import { AnimatedToast } from "../components/animate-ui";
import {
  Medal,
  PlusCircle,
  Eye,
  CalendarClock,
  Pencil,
  Trash2,
  ChevronDown,
  Images,
  Copy,
  UserRoundCheck,
  MoreHorizontal,
} from "lucide-react";
import {
  atribuirBadgeAoUsuario,
  atualizarBadgeDoUsuario,
  atualizarBadge,
  criarBadge,
  deletarBadge,
  getRole,
  listarAdmins,
  listarAlunos,
  listarBadges,
  listarBadgeHolders,
  removerBadgeDoUsuario,
  listarProfessores,
  type Badge,
  type BadgeHolder,
  type User,
} from "../services/api";

type Aba = "ver" | "criar" | "imagens";
type HolderGroup = {
  user: BadgeHolder["user"];
  items: BadgeHolder[];
  latestAwardedAt: string;
};

const surfaceCardClass =
  "rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(225,29,46,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] bg-card/95 shadow-[0_18px_44px_rgba(0,0,0,0.16)]";
const fieldClass =
  "h-11 w-full rounded-2xl border border-border/75 bg-card px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-muted-foreground/90 hover:border-primary/35 focus:border-primary focus:ring-4 focus:ring-ring/30";
const textareaClass = cn(fieldClass, "min-h-28 h-auto py-3 leading-6");
const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_24px_rgba(225,29,46,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border/80 bg-muted/45 px-4 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60";
const dangerButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-500/35 bg-red-500/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60";
const medalhasPageClass = "flex flex-col gap-6";
const medalhasTabsClass =
  "inline-flex max-w-full flex-wrap items-center gap-2 rounded-[24px] border border-border/70 bg-card/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const medalhasTabClass = (active: boolean) =>
  cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
    active
      ? "border-primary/45 bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(225,29,46,0.25)]"
      : "border-border/70 bg-muted/45 text-foreground hover:border-primary/30 hover:bg-accent",
  );
const statCardClass =
  "rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent)] bg-card/90 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)]";
const searchCardClass = cn(
  surfaceCardClass,
  "grid gap-3 p-4 sm:p-5"
);
const emptyCardClass =
  "rounded-[28px] border border-dashed border-border/80 bg-[radial-gradient(circle_at_top,rgba(225,29,46,0.09),transparent_44%)] bg-muted/35 px-6 py-12 text-center text-sm text-muted-foreground shadow-[0_18px_44px_rgba(0,0,0,0.12)]";
const medalhaCardClass =
  "group self-start grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent)] bg-card p-4 shadow-[0_12px_36px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_22px_50px_rgba(225,29,46,0.18)]";
const medalhaIconClass =
  "relative inline-flex h-[52px] w-[52px] overflow-hidden rounded-[18px] border border-border/70 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(225,29,46,0.18))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
const medalhaFormCardClass = cn(surfaceCardClass, "grid gap-5 p-5 sm:p-6");
const medalhaFormRowClass =
  "grid gap-2.5 [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-[0.24em] [&>span]:text-muted-foreground [&>input]:h-12 [&>input]:w-full [&>input]:rounded-2xl [&>input]:border [&>input]:border-border/75 [&>input]:bg-card [&>input]:px-4 [&>input]:text-sm [&>input]:text-foreground [&>input]:outline-none [&>input]:transition [&>input]:placeholder:text-muted-foreground/90 [&>input]:hover:border-primary/35 [&>input]:focus:border-primary [&>input]:focus:ring-4 [&>input]:focus:ring-ring/30 [&>textarea]:min-h-28 [&>textarea]:w-full [&>textarea]:rounded-2xl [&>textarea]:border [&>textarea]:border-border/75 [&>textarea]:bg-card [&>textarea]:px-4 [&>textarea]:py-3 [&>textarea]:text-sm [&>textarea]:text-foreground [&>textarea]:outline-none [&>textarea]:transition [&>textarea]:placeholder:text-muted-foreground/90 [&>textarea]:hover:border-primary/35 [&>textarea]:focus:border-primary [&>textarea]:focus:ring-4 [&>textarea]:focus:ring-ring/30 [&>select]:h-12 [&>select]:w-full [&>select]:rounded-2xl [&>select]:border [&>select]:border-border/75 [&>select]:bg-card [&>select]:px-4 [&>select]:text-sm [&>select]:text-foreground [&>select]:outline-none";
const medalhaFormGridClass = "grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px]";
const medalhaFileFieldClass = "flex flex-wrap items-center gap-3";
const medalhaFileBtnClass =
  "inline-flex h-11 items-center justify-center rounded-full border border-border/80 bg-muted/45 px-4 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60";
const medalhaFileNameClass = "min-w-[180px] max-w-full truncate text-sm text-muted-foreground";
const badgeIconPreviewClass = "h-[88px] w-[88px] rounded-[20px] border border-border/70 bg-card object-cover";
const badgeIconPreviewFallbackClass =
  "grid place-items-center rounded-[20px] border border-border/70 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(225,29,46,0.18))] text-3xl font-black text-white";
const fieldErrorClass = "text-xs font-semibold text-red-300";
const fieldLabelClass = "text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground";
const panelTitleClass = "text-lg font-black tracking-[-0.02em] text-foreground";
const panelCopyClass = "text-sm leading-6 text-muted-foreground";
const filterRowClass = "mt-1 flex flex-wrap gap-3";
const filterSelectClass = cn(fieldClass, "min-w-[190px] sm:w-auto");
const holderPanelClass = cn(surfaceCardClass, "grid gap-5 p-5 sm:p-6");
const holderGroupClass = (open: boolean) =>
  cn(
    "overflow-hidden rounded-[24px] border border-border/70 bg-card/80 transition",
    open && "border-primary/35 shadow-[0_18px_40px_rgba(225,29,46,0.12)]",
  );
const holderGroupSummaryClass =
  "grid w-full gap-3 bg-transparent px-4 py-4 text-left transition hover:bg-accent/30 sm:grid-cols-[minmax(220px,1fr)_auto_auto] sm:items-center";
const holderGroupItemsClass = (open: boolean) =>
  cn(
    "grid gap-3 px-4 transition-all duration-300",
    open ? "max-h-[1200px] pb-4 opacity-100" : "max-h-0 overflow-hidden pb-0 opacity-0",
  );
const holderActionRowClass = "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-self-end";
const assignCardClass = cn(surfaceCardClass, "grid gap-5 p-5 sm:p-6");
const assignGridClass = "grid items-start gap-4 xl:grid-cols-2";
const assignSelectedListClass = "flex flex-wrap gap-2";
const assignSelectedChipClass =
  "inline-flex h-8 items-center rounded-full border border-border/70 bg-muted/45 px-3 text-[13px] font-semibold leading-none text-foreground transition hover:border-primary/35 hover:bg-accent";
const assignSearchListClass = "grid max-h-[190px] min-h-0 gap-2 overflow-auto pr-1";
const assignSearchItemClass = (active: boolean) =>
  cn(
    "rounded-2xl border border-border/70 bg-card/90 px-4 py-3 text-left text-sm text-foreground transition",
    active ? "border-primary/45 bg-primary/10" : "hover:border-primary/35 hover:bg-accent",
  );
const assignHintClass =
  "rounded-[20px] border border-dashed border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground";
const assignFooterClass =
  "flex flex-col gap-3 rounded-[22px] border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between";
const mobileActionTriggerClass =
  "inline-flex size-8 items-center justify-center rounded-full border border-border/70 bg-muted/45 text-muted-foreground transition hover:border-primary/35 hover:bg-accent";
const imagesGridClass = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
const imageCardClass = (clickable: boolean) =>
  cn(
    "grid gap-3 rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.12)]",
    clickable &&
      "cursor-pointer transition hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_18px_36px_rgba(225,29,46,0.14)]",
  );
const imageThumbWrapClass =
  "grid min-h-[168px] place-items-center overflow-hidden rounded-[20px] border border-border/70 bg-muted/35 p-3";
const imageSkeletonClass = "animate-pulse rounded-[20px] border border-border/70 bg-muted/50";
const imageTextSkeletonClass = "h-5 animate-pulse rounded-full bg-muted/50";
const previewWrapClass = "mt-2";
const fileRemoveButtonClass = cn(
  medalhaFileBtnClass,
  "border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/18",
);

export default function MedalhasPage() {
  const [aba, setAba] = React.useState<Aba>("ver");
  const [medalhasRaw, setMedalhasRaw] = React.useState<Badge[]>([]);
  const [medalhas, setMedalhas] = React.useState<Badge[]>([]);
  const [badgeOptions, setBadgeOptions] = React.useState<Badge[]>([]);
  const [totalMedalhas, setTotalMedalhas] = React.useState(0);
  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [icone, setIcone] = React.useState("");
  const [iconePreviewError, setIconePreviewError] = React.useState(false);
  const [editingBadgeId, setEditingBadgeId] = React.useState<string | null>(null);
  const [mensagem, setMensagem] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingBadgeOptions, setLoadingBadgeOptions] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [badgeFiltro, setBadgeFiltro] = React.useState<string>("");
  const [medalhaUsoFiltro, setMedalhaUsoFiltro] = React.useState<"todas" | "com_uso" | "sem_uso">("todas");
  const [medalhaSort, setMedalhaSort] = React.useState<"recentes" | "mais_usadas" | "menos_usadas" | "a_z">("recentes");
  const [buscaMedalha, setBuscaMedalha] = React.useState("");
  const [buscaMedalhaDebounced, setBuscaMedalhaDebounced] = React.useState("");
  const [holders, setHolders] = React.useState<BadgeHolder[]>([]);
  const [holdersSnapshot, setHoldersSnapshot] = React.useState<BadgeHolder[]>([]);
  const [totalHolders, setTotalHolders] = React.useState(0);
  const [loadingHolders, setLoadingHolders] = React.useState(true);
  const [savingHolderId, setSavingHolderId] = React.useState<string | null>(null);
  const [removingHolderId, setRemovingHolderId] = React.useState<string | null>(null);
  const [holderBadgeDraft, setHolderBadgeDraft] = React.useState<Record<string, string>>({});
  const [openHolderGroups, setOpenHolderGroups] = React.useState<Record<string, boolean>>({});
  const [buscaHolder, setBuscaHolder] = React.useState("");
  const [medalhasPage, setMedalhasPage] = React.useState(1);
  const [medalhasPerPage, setMedalhasPerPage] = React.useState(5);
  const [holdersPage, setHoldersPage] = React.useState(1);
  const [holdersPerPage, setHoldersPerPage] = React.useState(5);
  const [usuarios, setUsuarios] = React.useState<User[]>([]);
  const [assignUserId, setAssignUserId] = React.useState("");
  const [assignUserIds, setAssignUserIds] = React.useState<string[]>([]);
  const [assignBadgeId, setAssignBadgeId] = React.useState("");
  const [assignBadgeIds, setAssignBadgeIds] = React.useState<string[]>([]);
  const [assignUserQuery, setAssignUserQuery] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);
  const [iconeArquivoNome, setIconeArquivoNome] = React.useState("");
  const [badgeIconLoadError, setBadgeIconLoadError] = React.useState<Record<string, boolean>>({});
  const [imagemBibliotecaLoadError, setImagemBibliotecaLoadError] = React.useState<Record<string, boolean>>({});
  const [buscaImagemBiblioteca, setBuscaImagemBiblioteca] = React.useState("");
  const [imagensPage, setImagensPage] = React.useState(1);
  const [imagensPerPage, setImagensPerPage] = React.useState(5);
  const [imagemModalAberto, setImagemModalAberto] = React.useState(false);
  const role = getRole();

  const normalizarTexto = React.useCallback((valor: string) => {
    if (!valor) return valor;

    // Converte sequencias literais no formato "\\uXXXX" para o caractere real.
    const unicodeDecodificado = valor.replace(/\\x75([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    );

    // Corrige texto mojibake comum (UTF-8 lido como latin1).
    if (!unicodeDecodificado.includes("Ã")) return unicodeDecodificado;
    try {
      const bytes = Uint8Array.from(unicodeDecodificado, (ch) => ch.charCodeAt(0) & 0xff);
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch {
      return unicodeDecodificado;
    }
  }, []);

  const normalizarBadge = React.useCallback(
    (badge: Badge): Badge => ({
      ...badge,
      name: normalizarTexto(badge.name),
      description: normalizarTexto(badge.description),
      iconUrl: normalizarTexto(badge.iconUrl || ""),
    }),
    [normalizarTexto]
  );

  const normalizarUsuario = React.useCallback(
    (u: User): User => ({
      ...u,
      nome: normalizarTexto(u.nome || ""),
      email: normalizarTexto(u.email || ""),
      usuario: normalizarTexto(u.usuario || ""),
    }),
    [normalizarTexto]
  );

  const normalizarHolder = React.useCallback(
    (h: BadgeHolder): BadgeHolder => ({
      ...h,
      badgeName: normalizarTexto(h.badgeName),
      user: {
        ...h.user,
        nome: normalizarTexto(h.user.nome),
        email: normalizarTexto(h.user.email),
      },
    }),
    [normalizarTexto]
  );

  const carregarMedalhas = React.useCallback(async () => {
    // Evita chamada duplicada no carregamento inicial: usa as medalhas já carregadas para opções.
    if (!buscaMedalhaDebounced.trim()) {
      if (loadingBadgeOptions) {
        setLoading(true);
        return;
      }
      setMedalhasRaw(badgeOptions);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await listarBadges({
        q: buscaMedalhaDebounced.trim() || undefined,
        limit: 500,
        offset: 0,
      });
      setMedalhasRaw(res.items.map(normalizarBadge));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar medalhas");
    } finally {
      setLoading(false);
    }
  }, [badgeOptions, buscaMedalhaDebounced, loadingBadgeOptions, normalizarBadge]);

  const carregarBadgeOptions = React.useCallback(async () => {
    setLoadingBadgeOptions(true);
    try {
      const res = await listarBadges({ limit: 1000, offset: 0 });
      setBadgeOptions(res.items.map(normalizarBadge));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar opções de medalhas");
    } finally {
      setLoadingBadgeOptions(false);
    }
  }, [normalizarBadge]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setBuscaMedalhaDebounced(buscaMedalha);
    }, 300);
    return () => window.clearTimeout(t);
  }, [buscaMedalha]);

  React.useEffect(() => {
    void carregarMedalhas();
  }, [carregarMedalhas]);

  React.useEffect(() => {
    void carregarBadgeOptions();
  }, [carregarBadgeOptions]);

  React.useEffect(() => {
    if (role !== "admin") return;
    Promise.all([listarAlunos(), listarProfessores(), listarAdmins()])
      .then(([alunos, professores, admins]) => {
        const map = new Map<string, User>();
        [...alunos, ...professores, ...admins].forEach((u) => map.set(u.id, u));
        const all = Array.from(map.values()).map(normalizarUsuario).sort((a, b) =>
          (a.nome || "").localeCompare(b.nome || "", "pt-BR")
        );
        setUsuarios(all);
      })
      .catch((e) =>
        setErro(e instanceof Error ? e.message : "Erro ao carregar usuários para atribuição")
      );
  }, [normalizarUsuario, role]);

  React.useEffect(() => {
    setMedalhasPage(1);
  }, [buscaMedalha, medalhasPerPage, medalhaSort, medalhaUsoFiltro]);

  const carregarHolders = React.useCallback(async () => {
    setLoadingHolders(true);
    try {
      const result = await listarBadgeHolders({
        badgeId: badgeFiltro || undefined,
        limit: holdersPerPage,
        offset: (holdersPage - 1) * holdersPerPage,
      });
      const itensNormalizados = result.items.map(normalizarHolder);
      setHolders(itensNormalizados);
      setTotalHolders(result.total);
      const draft: Record<string, string> = {};
      for (const h of itensNormalizados) {
        draft[h.holderId] = h.badgeId;
      }
      setHolderBadgeDraft(draft);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar usuários com medalhas");
    } finally {
      setLoadingHolders(false);
    }
  }, [badgeFiltro, holdersPage, holdersPerPage, normalizarHolder]);

  React.useEffect(() => {
    void carregarHolders();
  }, [carregarHolders]);

  React.useEffect(() => {
    setHoldersPage(1);
  }, [badgeFiltro, holdersPerPage]);

  const carregarHoldersSnapshot = React.useCallback(async () => {
    try {
      const result = await listarBadgeHolders({ limit: 1000, offset: 0 });
      setHoldersSnapshot(result.items.map(normalizarHolder));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar contexto de uso das medalhas");
    }
  }, [normalizarHolder]);

  React.useEffect(() => {
    void carregarHoldersSnapshot();
  }, [carregarHoldersSnapshot]);

  const toggleHolderGroup = (userId: string) => {
    setOpenHolderGroups((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const setHolderGroupOpen = (userId: string, open: boolean) => {
    setOpenHolderGroups((prev) => ({
      ...prev,
      [userId]: open,
    }));
  };

  const salvarEdicaoHolder = async (holderId: string) => {
    const novoBadgeId = holderBadgeDraft[holderId];
    if (!novoBadgeId) return;
    setMensagem(null);
    setErro(null);
    setSavingHolderId(holderId);
    try {
      const result = await atualizarBadgeDoUsuario(holderId, novoBadgeId);
      setMensagem(result.message || "Medalha do usuário atualizada.");
      await Promise.all([carregarHolders(), carregarHoldersSnapshot()]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar medalha do usuário");
    } finally {
      setSavingHolderId(null);
    }
  };

  const removerMedalhaDoHolder = async (holderId: string) => {
    setMensagem(null);
    setErro(null);
    setRemovingHolderId(holderId);
    try {
      const result = await removerBadgeDoUsuario(holderId);
      setMensagem(result.message || "Medalha removida do usuário.");
      await Promise.all([carregarHolders(), carregarMedalhas(), carregarHoldersSnapshot()]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover medalha do usuário");
    } finally {
      setRemovingHolderId(null);
    }
  };

  const criarOuAtualizarMedalha = async (opcoes?: { manterAbaAtual?: boolean; fecharModal?: boolean }) => {
    setMensagem(null);
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome da medalha.");
      return;
    }
    if (!descricao.trim()) {
      setErro("Informe a descrição da medalha.");
      return;
    }
    if (descricao.trim().length < 10) {
      setErro("A descrição deve ter no mínimo 10 caracteres.");
      return;
    }
    if (!icone.trim() && !editingBadgeId) {
      setErro("Selecione um ícone para a medalha.");
      return;
    }
    if (icone.trim() && iconePreviewError) {
      setErro("O ícone selecionado não carregou corretamente.");
      return;
    }
    const nomeNormalizado = nome.trim().toLowerCase();
    const nomeDuplicado = badgeOptions.some(
      (b) => b.name.trim().toLowerCase() === nomeNormalizado && b.id !== editingBadgeId
    );
    if (nomeDuplicado) {
      setErro("Já existe uma medalha com esse nome.");
      return;
    }

    setSaving(true);
    try {
      const result = editingBadgeId
        ? await atualizarBadge(editingBadgeId, {
            name: nome.trim(),
            description: descricao.trim(),
            iconUrl: icone.trim(),
          })
        : await criarBadge({
            name: nome.trim(),
            description: descricao.trim(),
            iconUrl: icone.trim(),
          });
      setMedalhasPage(1);
      await Promise.all([carregarMedalhas(), carregarBadgeOptions(), carregarHoldersSnapshot()]);
      setNome("");
      setDescricao("");
      setIcone("");
      setIconePreviewError(false);
      setEditingBadgeId(null);
      setMensagem(
        result.message || (editingBadgeId ? "Medalha atualizada com sucesso." : "Medalha criada com sucesso.")
      );
      if (!opcoes?.manterAbaAtual) {
        setAba("ver");
      }
      if (opcoes?.fecharModal) {
        setImagemModalAberto(false);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar medalha");
    } finally {
      setSaving(false);
    }
  };

  const iniciarEdicaoMedalha = (badge: Badge, opcoes?: { manterAbaAtual?: boolean; abrirModal?: boolean }) => {
    setErro(null);
    setMensagem(null);
    setEditingBadgeId(badge.id);
    setNome(badge.name);
    setDescricao(badge.description);
    setIcone(badge.iconUrl || "");
    setIconeArquivoNome("");
    setIconePreviewError(false);
    if (!opcoes?.manterAbaAtual) {
      setAba("criar");
    }
    if (opcoes?.abrirModal) {
      setImagemModalAberto(true);
    }
  };

  const cancelarEdicaoMedalha = () => {
    setEditingBadgeId(null);
    setNome("");
    setDescricao("");
    setIcone("");
    setIconePreviewError(false);
  };

  const removerImagemBadge = () => {
    setIcone("");
    setIconeArquivoNome("");
    setIconePreviewError(false);
    setErro(null);
  };

  const excluirMedalha = async (badge: Badge) => {
    const confirmed = window.confirm(
      `Excluir a medalha "${badge.name}"? Isso remove também as atribuições dela aos usuários.`
    );
    if (!confirmed) return;

    setMensagem(null);
    setErro(null);
    try {
      const result = await deletarBadge(badge.id);
      if (editingBadgeId === badge.id) {
        cancelarEdicaoMedalha();
        setAba("ver");
      }
      await Promise.all([carregarMedalhas(), carregarBadgeOptions(), carregarHolders(), carregarHoldersSnapshot()]);
      setMensagem(result.message || "Medalha excluída com sucesso.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir medalha");
    }
  };

  const atribuirMedalha = async () => {
    return atribuirMedalhasSelecionadas();
    const userIds = assignUserIds.length > 0 ? assignUserIds : assignUserId ? [assignUserId] : [];
    const badgeIds = assignBadgeIds;
    if (userIds.length === 0) {
      setErro("Selecione o usuário.");
      return;
    }
    if (badgeIds.length === 0) {
      setErro("Selecione ao menos uma medalha.");
      return;
    }

    setAssigning(true);
    try {
      let sucesso = 0;
      let falhas = 0;
      for (const userId of userIds) {
        for (const badgeId of badgeIds) {
          try {
            await atribuirBadgeAoUsuario(userId, badgeId);
            sucesso += 1;
          } catch {
            falhas += 1;
          }
        }
      }
      if (sucesso === 0) {
        throw new Error("Não foi possível atribuir medalha para os usuários selecionados.");
      }
      setMensagem(
        falhas > 0
          ? `Medalha atribuída para ${sucesso} usuário(s). ${falhas} falharam.`
          : `Medalha atribuída para ${sucesso} usuário(s).`
      );
      setAssignUserId("");
      setAssignUserIds([]);
      setAssignUserQuery("");
      await Promise.all([carregarHolders(), carregarMedalhas(), carregarHoldersSnapshot()]);
    } catch {
      setErro("Erro ao atribuir medalha");
    } finally {
      setAssigning(false);
    }
  };

  const holdersFiltrados = React.useMemo(() => {
    const q = buscaHolder.trim().toLowerCase();
    if (!q) return holders;
    return holders.filter(
      (h) =>
        h.user.nome.toLowerCase().includes(q) ||
        h.user.email.toLowerCase().includes(q) ||
        h.badgeName.toLowerCase().includes(q)
    );
  }, [holders, buscaHolder]);

  const holdersAgrupados = React.useMemo<HolderGroup[]>(() => {
    const grouped = new Map<string, HolderGroup>();

    for (const holder of holdersFiltrados) {
      const existing = grouped.get(holder.user.id);
      if (existing) {
        existing.items.push(holder);
        if (
          new Date(holder.awardedAt).getTime() >
          new Date(existing.latestAwardedAt).getTime()
        ) {
          existing.latestAwardedAt = holder.awardedAt;
        }
      } else {
        grouped.set(holder.user.id, {
          user: holder.user,
          items: [holder],
          latestAwardedAt: holder.awardedAt,
        });
      }
    }

    return Array.from(grouped.values()).map((group) => ({
      ...group,
      items: [...group.items].sort(
        (a, b) =>
          new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime()
      ),
    }));
  }, [holdersFiltrados]);

  const badgeUsageById = React.useMemo(() => {
    const map = new Map<string, { count: number; latestAwardedAt: string | null; recentUsers: string[] }>();
    for (const holder of holdersSnapshot) {
      const prev = map.get(holder.badgeId);
      if (!prev) {
        map.set(holder.badgeId, {
          count: 1,
          latestAwardedAt: holder.awardedAt,
          recentUsers: [holder.user.nome],
        });
        continue;
      }
      prev.count += 1;
      if (!prev.latestAwardedAt || new Date(holder.awardedAt).getTime() > new Date(prev.latestAwardedAt).getTime()) {
        prev.latestAwardedAt = holder.awardedAt;
      }
      if (!prev.recentUsers.includes(holder.user.nome) && prev.recentUsers.length < 3) {
        prev.recentUsers.push(holder.user.nome);
      }
    }
    return map;
  }, [holdersSnapshot]);

  const medalhasFiltradasOrdenadas = React.useMemo(() => {
    const base = medalhasRaw.filter((m) => {
      const usage = badgeUsageById.get(m.id);
      const count = usage?.count ?? m.holdersCount ?? 0;
      if (medalhaUsoFiltro === "com_uso") return count > 0;
      if (medalhaUsoFiltro === "sem_uso") return count === 0;
      return true;
    });
    const sorted = [...base];
    sorted.sort((a, b) => {
      const countA = badgeUsageById.get(a.id)?.count ?? a.holdersCount ?? 0;
      const countB = badgeUsageById.get(b.id)?.count ?? b.holdersCount ?? 0;
      if (medalhaSort === "a_z") return a.name.localeCompare(b.name, "pt-BR");
      if (medalhaSort === "mais_usadas") return countB - countA;
      if (medalhaSort === "menos_usadas") return countA - countB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [badgeUsageById, medalhaSort, medalhaUsoFiltro, medalhasRaw]);

  React.useEffect(() => {
    setTotalMedalhas(medalhasFiltradasOrdenadas.length);
    const start = (medalhasPage - 1) * medalhasPerPage;
    const end = start + medalhasPerPage;
    setMedalhas(medalhasFiltradasOrdenadas.slice(start, end));
  }, [medalhasFiltradasOrdenadas, medalhasPage, medalhasPerPage]);

  React.useEffect(() => {
    setBadgeIconLoadError({});
  }, [medalhasRaw]);

  React.useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(medalhasFiltradasOrdenadas.length / medalhasPerPage));
    if (medalhasPage > totalPages) {
      setMedalhasPage(totalPages);
    }
  }, [medalhasFiltradasOrdenadas.length, medalhasPage, medalhasPerPage]);

  const totalUsuariosMedalhados = React.useMemo(() => {
    return new Set(holdersSnapshot.map((h) => h.user.id)).size;
  }, [holdersSnapshot]);

  const medalhaMaisUsada = React.useMemo(() => {
    const items = medalhasRaw.map((m) => ({
      id: m.id,
      nome: m.name,
      count: badgeUsageById.get(m.id)?.count ?? m.holdersCount ?? 0,
    }));
    items.sort((a, b) => b.count - a.count);
    return items[0] ?? null;
  }, [badgeUsageById, medalhasRaw]);

  const imagensBiblioteca = React.useMemo(() => {
    return badgeOptions.map((b) => ({
      id: b.id,
      nome: b.name,
      url: (b.iconUrl || "").trim(),
      description: b.description,
    }));
  }, [badgeOptions]);

  const imagensBibliotecaFiltradas = React.useMemo(() => {
    const q = buscaImagemBiblioteca.trim().toLowerCase();
    if (!q) return imagensBiblioteca;
    return imagensBiblioteca.filter(
      (img) =>
        img.nome.toLowerCase().includes(q) ||
        img.url.toLowerCase().includes(q) ||
        img.description.toLowerCase().includes(q)
    );
  }, [buscaImagemBiblioteca, imagensBiblioteca]);

  const imagensBibliotecaPaginadas = React.useMemo(() => {
    const start = (imagensPage - 1) * imagensPerPage;
    const end = start + imagensPerPage;
    return imagensBibliotecaFiltradas.slice(start, end);
  }, [imagensBibliotecaFiltradas, imagensPage, imagensPerPage]);

  React.useEffect(() => {
    setImagemBibliotecaLoadError({});
  }, [imagensBiblioteca]);

  React.useEffect(() => {
    setImagensPage(1);
  }, [buscaImagemBiblioteca, imagensPerPage]);

  React.useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(imagensBibliotecaFiltradas.length / imagensPerPage));
    if (imagensPage > totalPages) {
      setImagensPage(totalPages);
    }
  }, [imagensBibliotecaFiltradas.length, imagensPage, imagensPerPage]);

  const usuariosFiltradosAtribuicao = React.useMemo(() => {
    const q = assignUserQuery.trim().toLowerCase();
    if (!q) return [];
    const base = usuarios.filter(
      (u) =>
        (u.nome || "").toLowerCase().includes(q) ||
        (u.email || u.usuario || "").toLowerCase().includes(q)
    );
    return base.slice(0, 8);
  }, [usuarios, assignUserQuery]);

  const badgeOptionsAtribuicao = React.useMemo(
    () =>
      badgeOptions
        .filter((badge) => !assignBadgeIds.includes(badge.id))
        .map((badge) => ({
          value: badge.id,
          label: badge.name,
          meta: badge.description || "Sem descricao",
        })),
    [assignBadgeIds, badgeOptions]
  );

  const selecionarUsuarioParaAtribuicao = (u: User) => {
    setAssignUserIds((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
    setAssignUserId(u.id);
    setAssignUserQuery("");
  };

  const adicionarBadgeParaAtribuicao = (badgeId: string) => {
    setAssignBadgeId("");
    setAssignBadgeIds((prev) => (prev.includes(badgeId) ? prev : [...prev, badgeId]));
  };

  const removerBadgeSelecionada = (badgeId: string) => {
    setAssignBadgeIds((prev) => prev.filter((id) => id !== badgeId));
  };

  const limparBadgesSelecionadas = () => {
    setAssignBadgeId("");
    setAssignBadgeIds([]);
  };

  const manterSomenteUsuarioSelecionado = (userId: string) => {
    setAssignUserIds([userId]);
    setAssignUserId(userId);
  };

  const copiarContatoUsuarioSelecionado = async (
    user: Pick<User, "nome" | "email" | "usuario"> | BadgeHolder["user"],
  ) => {
    const contato = user.email || ("usuario" in user ? user.usuario : "") || "";
    if (!contato) {
      setErro("Esse usuário não possui email ou usuário para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(contato);
      setMensagem(`Contato copiado: ${contato}`);
    } catch {
      setErro("Não foi possível copiar o contato do usuário.");
    }
  };

  const adicionarUsuarioDoHolderNaAtribuicao = (user: BadgeHolder["user"]) => {
    setAssignUserIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]));
    setAssignUserId(user.id);
    setAssignUserQuery("");
    setMensagem(`Usuário ${user.nome} adicionado à atribuição.`);
  };

  const removerUsuarioSelecionado = (userId: string) => {
    setAssignUserIds((prev) => prev.filter((id) => id !== userId));
    if (assignUserId === userId) {
      const next = assignUserIds.find((id) => id !== userId) || "";
      setAssignUserId(next);
    }
  };

  const atribuirMedalhasSelecionadas = async () => {
    setMensagem(null);
    setErro(null);
    const userIds = assignUserIds.length > 0 ? assignUserIds : assignUserId ? [assignUserId] : [];
    if (userIds.length === 0) {
      setErro("Selecione o usuario.");
      return;
    }
    if (assignBadgeIds.length === 0) {
      setErro("Selecione ao menos uma medalha.");
      return;
    }

    setAssigning(true);
    try {
      let sucesso = 0;
      let falhas = 0;
      for (const userId of userIds) {
        for (const badgeId of assignBadgeIds) {
          try {
            await atribuirBadgeAoUsuario(userId, badgeId);
            sucesso += 1;
          } catch {
            falhas += 1;
          }
        }
      }
      if (sucesso === 0) {
        throw new Error("Nao foi possivel atribuir as medalhas para os usuarios selecionados.");
      }
      const totalTentativas = userIds.length * assignBadgeIds.length;
      setMensagem(
        falhas > 0
          ? `Atribuicoes concluidas: ${sucesso} de ${totalTentativas}. ${falhas} falharam.`
          : `Atribuicoes concluidas: ${sucesso} de ${totalTentativas}.`
      );
      setAssignUserId("");
      setAssignUserIds([]);
      setAssignBadgeId("");
      setAssignBadgeIds([]);
      setAssignUserQuery("");
      await Promise.all([carregarHolders(), carregarMedalhas(), carregarHoldersSnapshot()]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atribuir medalhas");
    } finally {
      setAssigning(false);
    }
  };

  const previewFallbackText = nome.trim() ? nome.trim().slice(0, 1).toUpperCase() : "Sem preview";
  const badgesSelecionadasAtribuicao = badgeOptions.filter((b) => assignBadgeIds.includes(b.id));
  const totalUsuariosSelecionados = assignUserIds.length || (assignUserId ? 1 : 0);
  const totalBadgesSelecionadas = assignBadgeIds.length;

  return (
    <DashboardLayout
      title="Medalhas"
      subtitle="Visualize e crie medalhas do portal"
    >
      <section className={medalhasPageClass}>
        <div className={medalhasTabsClass}>
          <span className="px-2 text-xs font-black uppercase tracking-[0.24em] text-muted-foreground sm:pl-3">
            Exibir:
          </span>
          <button
            className={medalhasTabClass(aba === "ver")}
            onClick={() => setAba("ver")}
            type="button"
          >
            <Eye size={16} />
            Ver medalhas
          </button>
          <button
            className={medalhasTabClass(aba === "criar")}
            onClick={() => {
              if (role === "admin") setAba("criar");
            }}
            type="button"
            disabled={role !== "admin"}
            title={role !== "admin" ? "Apenas administrador pode criar medalhas" : undefined}
          >
            <PlusCircle size={16} />
            Criar medalha
          </button>
          <button
            className={medalhasTabClass(aba === "imagens")}
            onClick={() => setAba("imagens")}
            type="button"
          >
            <Images size={16} />
            Imagens
          </button>
        </div>

        <AnimatedToast
          message={mensagem}
          type="success"
          duration={3500}
          onClose={() => setMensagem(null)}
        />
        <AnimatedToast
          message={erro}
          type="error"
          duration={4500}
          onClose={() => setErro(null)}
        />

        {aba === "ver" ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <article className={statCardClass}>
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Total de medalhas
                </span>
                <strong className="mt-2 block text-[28px] font-black tracking-[-0.03em] text-foreground">
                  {medalhasRaw.length}
                </strong>
              </article>
              <article className={statCardClass}>
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Usuarios medalhados
                </span>
                <strong className="mt-2 block text-[28px] font-black tracking-[-0.03em] text-foreground">
                  {totalUsuariosMedalhados}
                </strong>
              </article>
              <article className={statCardClass}>
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Medalha mais usada
                </span>
                <strong className="mt-2 block text-[28px] font-black tracking-[-0.03em] text-foreground">
                  {medalhaMaisUsada ? `${medalhaMaisUsada.nome} (${medalhaMaisUsada.count})` : "-"}
                </strong>
              </article>
            </div>

            <div className={searchCardClass}>
              <label htmlFor="busca-medalha" className={fieldLabelClass}>Buscar medalha por escrita</label>
              <input
                className={fieldClass}
                id="busca-medalha"
                value={buscaMedalha}
                onChange={(e) => setBuscaMedalha(e.target.value)}
                placeholder="Digite nome ou descrição da medalha..."
              />
              <div className={filterRowClass}>
                <select
                  className={filterSelectClass}
                  value={medalhaUsoFiltro}
                  onChange={(e) => setMedalhaUsoFiltro(e.target.value as "todas" | "com_uso" | "sem_uso")}
                >
                  <option value="todas">Todas</option>
                  <option value="com_uso">Com atribuição</option>
                  <option value="sem_uso">Sem atribuição</option>
                </select>
                <select
                  className={filterSelectClass}
                  value={medalhaSort}
                  onChange={(e) => setMedalhaSort(e.target.value as "recentes" | "mais_usadas" | "menos_usadas" | "a_z")}
                >
                  <option value="recentes">Mais recentes</option>
                  <option value="mais_usadas">Mais usadas</option>
                  <option value="menos_usadas">Menos usadas</option>
                  <option value="a_z">A-Z</option>
                </select>
              </div>
            </div>

            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {loading ? (
                <div className={emptyCardClass}>Carregando medalhas...</div>
              ) : medalhas.length === 0 ? (
                <div className={emptyCardClass}>Nenhuma medalha criada ainda.</div>
              ) : (
                medalhas.map((m) => (
                  <article key={m.id} className={medalhaCardClass}>
                    <div className={medalhaIconClass}>
                      {m.iconUrl && !badgeIconLoadError[m.id] ? (
                        <img
                          className="absolute inset-0 h-full w-full object-cover"
                          src={m.iconUrl}
                          alt={m.name}
                          onError={() => {
                            setBadgeIconLoadError((prev) => ({ ...prev, [m.id]: true }));
                          }}
                        />
                      ) : null}
                      {(!m.iconUrl || badgeIconLoadError[m.id]) && (
                        <span className="relative z-10 m-auto text-lg font-black text-white">
                          {m.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col gap-3">
                      <div className="space-y-1.5">
                        <h3 className="text-lg font-black tracking-[-0.02em] text-foreground">{m.name}</h3>
                        <p className="text-sm leading-5 text-muted-foreground">{m.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-border/70 bg-muted/45 px-3 py-1 text-[11px] font-semibold text-foreground">
                          {(badgeUsageById.get(m.id)?.count ?? m.holdersCount ?? 0)} usuário{(badgeUsageById.get(m.id)?.count ?? m.holdersCount ?? 0) === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full border border-border/70 bg-muted/45 px-3 py-1 text-[11px] text-muted-foreground">
                          Última atribuição:{" "}
                          {badgeUsageById.get(m.id)?.latestAwardedAt
                            ? new Date(badgeUsageById.get(m.id)!.latestAwardedAt!).toLocaleDateString("pt-BR")
                            : "nunca"}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarClock size={14} />
                        <span>{new Date(m.createdAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      {role === "admin" && (
                        <div className="flex flex-wrap gap-2.5 pt-0.5">
                          <button
                            type="button"
                            className={cn(secondaryButtonClass, "h-10 px-3.5")}
                            onClick={() => {
                              iniciarEdicaoMedalha(m, { manterAbaAtual: true, abrirModal: true });
                            }}
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                          <button
                            type="button"
                            className={cn(dangerButtonClass, "h-10 px-3.5")}
                            onClick={() => excluirMedalha(m)}
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
            <Pagination
              currentPage={medalhasPage}
              itemsPerPage={medalhasPerPage}
              totalItems={totalMedalhas}
              onPageChange={setMedalhasPage}
              onItemsPerPageChange={setMedalhasPerPage}
            />

            <div className={holderPanelClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <h3 className={panelTitleClass}>Quem tem medalhas</h3>
                  <p className={panelCopyClass}>Acompanhe usuários medalhados e ajuste atribuições quando necessário.</p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                  <input
                    className={cn(fieldClass, "sm:min-w-[240px]")}
                    value={buscaHolder}
                    onChange={(e) => setBuscaHolder(e.target.value)}
                    placeholder="Buscar usuário ou medalha..."
                  />
                  <select
                    className={cn(fieldClass, "sm:min-w-[230px]")}
                    value={badgeFiltro}
                    onChange={(e) => setBadgeFiltro(e.target.value)}
                  >
                    <option value="">Todas as medalhas</option>
                    {badgeOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingHolders ? (
                <div className={emptyCardClass}>Carregando usuários...</div>
              ) : holdersAgrupados.length === 0 ? (
                <div className={emptyCardClass}>Ninguém recebeu essa medalha ainda.</div>
              ) : (
                <div className="grid gap-3">
                  {holdersAgrupados.map((group) => {
                    const isOpen = Boolean(openHolderGroups[group.user.id]);

                    return (
                      <div
                        key={group.user.id}
                        className={holderGroupClass(isOpen)}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className={holderGroupSummaryClass}
                          onClick={() => toggleHolderGroup(group.user.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleHolderGroup(group.user.id);
                            }
                          }}
                          aria-expanded={isOpen}
                          aria-controls={`holder-group-items-${group.user.id}`}
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="grid min-w-0 gap-1">
                                  <strong className="truncate text-base font-black tracking-[-0.02em] text-foreground">
                                    {group.user.nome}
                                  </strong>
                                  <span className="truncate text-sm text-muted-foreground">
                                    {group.user.email}
                                  </span>
                                </div>
                              </ContextMenuTrigger>
                            <ContextMenuContent className="min-w-56">
                              <ContextMenuLabel>{group.user.nome}</ContextMenuLabel>
                              <ContextMenuSeparator />
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>
                                  <Medal />
                                  Medalhas
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent className="min-w-56">
                                  <ContextMenuItem onSelect={() => setHolderGroupOpen(group.user.id, !isOpen)}>
                                    <ChevronDown className={cn(isOpen && "rotate-180")} />
                                    {isOpen ? "Recolher medalhas" : "Expandir medalhas"}
                                  </ContextMenuItem>
                                  {role === "admin" && (
                                    <ContextMenuItem onSelect={() => adicionarUsuarioDoHolderNaAtribuicao(group.user)}>
                                      <UserRoundCheck />
                                      Adicionar à atribuição
                                    </ContextMenuItem>
                                  )}
                                </ContextMenuSubContent>
                              </ContextMenuSub>
                              <ContextMenuItem
                                onSelect={() => void copiarContatoUsuarioSelecionado(group.user)}
                                disabled={!group.user.email}
                              >
                                <Copy />
                                Copiar contato
                              </ContextMenuItem>
                            </ContextMenuContent>
                            </ContextMenu>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(mobileActionTriggerClass, "sm:hidden")}
                                  aria-label={`Acoes para ${group.user.nome}`}
                                  onClick={(event) => event.stopPropagation()}
                                  onPointerDown={(event) => event.stopPropagation()}
                                >
                                  <MoreHorizontal />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-56 sm:hidden">
                                <DropdownMenuLabel>{group.user.nome}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setHolderGroupOpen(group.user.id, !isOpen)}>
                                  <ChevronDown className={cn(isOpen && "rotate-180")} />
                                  {isOpen ? "Recolher medalhas" : "Expandir medalhas"}
                                </DropdownMenuItem>
                                {role === "admin" && (
                                  <DropdownMenuItem onSelect={() => adicionarUsuarioDoHolderNaAtribuicao(group.user)}>
                                    <UserRoundCheck />
                                    Adicionar a atribuicao
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onSelect={() => void copiarContatoUsuarioSelecionado(group.user)}
                                  disabled={!group.user.email}
                                >
                                  <Copy />
                                  Copiar contato
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="grid gap-1 sm:justify-items-end">
                            <span className="text-sm font-semibold text-foreground">
                              {group.items.length} medalha
                              {group.items.length === 1 ? "" : "s"}
                            </span>
                            <small className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              Ultima: {new Date(group.latestAwardedAt).toLocaleDateString("pt-BR")}
                            </small>
                          </div>
                          <span
                            className={cn(
                              "inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-muted/45 text-muted-foreground transition sm:justify-self-end",
                              isOpen && "rotate-180 border-primary/35 text-foreground",
                            )}
                            aria-hidden="true"
                          >
                            <ChevronDown size={16} />
                          </span>
                        </div>

                        <div
                          id={`holder-group-items-${group.user.id}`}
                          className={holderGroupItemsClass(isOpen)}
                        >
                          {group.items.map((holder) => (
                            <div
                              key={holder.holderId}
                              className="grid gap-4 rounded-[20px] border border-border/70 bg-muted/35 p-4 lg:grid-cols-[minmax(140px,1fr)_auto] lg:items-center"
                            >
                              <div className="grid gap-1">
                                <span className="text-sm font-semibold text-foreground">{holder.badgeName}</span>
                                <small className="text-sm text-muted-foreground">
                                  {new Date(holder.awardedAt).toLocaleDateString("pt-BR")}
                                </small>
                              </div>
                              {role === "admin" && (
                                <div className={holderActionRowClass}>
                                  <select
                                    className={cn(fieldClass, "h-10 min-w-[170px]")}
                                    value={holderBadgeDraft[holder.holderId] ?? holder.badgeId}
                                    onChange={(e) =>
                                      setHolderBadgeDraft((prev) => ({
                                        ...prev,
                                        [holder.holderId]: e.target.value,
                                      }))
                                    }
                                  >
                                    {badgeOptions.map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className={secondaryButtonClass}
                                    onClick={() => salvarEdicaoHolder(holder.holderId)}
                                    disabled={
                                      savingHolderId === holder.holderId ||
                                      (holderBadgeDraft[holder.holderId] ?? holder.badgeId) === holder.badgeId
                                    }
                                  >
                                    {savingHolderId === holder.holderId ? "Salvando..." : "Salvar"}
                                  </button>
                                  <button
                                    type="button"
                                    className={dangerButtonClass}
                                    onClick={() => removerMedalhaDoHolder(holder.holderId)}
                                    disabled={removingHolderId === holder.holderId}
                                  >
                                    {removingHolderId === holder.holderId ? "Removendo..." : "Remover"}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Pagination
                currentPage={holdersPage}
                itemsPerPage={holdersPerPage}
                totalItems={totalHolders}
                onPageChange={setHoldersPage}
                onItemsPerPageChange={setHoldersPerPage}
              />
            </div>

            {role === "admin" && (
              <div className={assignCardClass}>
                <div className="space-y-1">
                  <h3 className={panelTitleClass}>Atribuir medalha a usuário</h3>
                  <p className={panelCopyClass}>Busque usuários, selecione a medalha e conclua a atribuição em lote.</p>
                </div>
                <div className={assignGridClass}>
                  <div className={medalhaFormRowClass}>
                    <span>Usuário</span>
                    <input
                      className={cn(fieldClass, "h-12")}
                      value={assignUserQuery}
                      onChange={(e) => {
                        setAssignUserQuery(e.target.value);
                      }}
                      placeholder="Buscar por nome ou email..."
                    />
                    {assignUserIds.length > 0 && (
                      <div className={assignSelectedListClass}>
                        {assignUserIds.map((uid) => {
                          const user = usuarios.find((u) => u.id === uid);
                          return (
                            <div key={uid} className="flex items-center gap-1.5">
                              <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={assignSelectedChipClass}
                                  onClick={() => removerUsuarioSelecionado(uid)}
                                  title="Clique para remover ou use o botão direito para mais ações"
                                >
                                  {user?.nome || uid} x
                                </button>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="min-w-56">
                                <ContextMenuLabel>
                                  {user?.nome || "Usuário selecionado"}
                                </ContextMenuLabel>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onSelect={() => manterSomenteUsuarioSelecionado(uid)}
                                  disabled={assignUserIds.length <= 1}
                                >
                                  <UserRoundCheck />
                                  Manter somente este usuário
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onSelect={() => void (user ? copiarContatoUsuarioSelecionado(user) : Promise.resolve())}
                                  disabled={!user || (!user.email && !user.usuario)}
                                >
                                  <Copy />
                                  Copiar contato
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  variant="destructive"
                                  onSelect={() => removerUsuarioSelecionado(uid)}
                                >
                                  <Trash2 />
                                  Remover da seleção
                                </ContextMenuItem>
                              </ContextMenuContent>
                              </ContextMenu>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(mobileActionTriggerClass, "sm:hidden")}
                                    aria-label={`Acoes para ${user?.nome || uid}`}
                                  >
                                    <MoreHorizontal />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-56 sm:hidden">
                                  <DropdownMenuLabel>
                                    {user?.nome || "Usuario selecionado"}
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => manterSomenteUsuarioSelecionado(uid)}
                                    disabled={assignUserIds.length <= 1}
                                  >
                                    <UserRoundCheck />
                                    Manter somente este usuario
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => void (user ? copiarContatoUsuarioSelecionado(user) : Promise.resolve())}
                                    disabled={!user || (!user.email && !user.usuario)}
                                  >
                                    <Copy />
                                    Copiar contato
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => removerUsuarioSelecionado(uid)}
                                  >
                                    <Trash2 />
                                    Remover da selecao
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {assignUserQuery.trim() !== "" && (
                      <div className={assignSearchListClass}>
                        {usuariosFiltradosAtribuicao.length === 0 ? (
                          <div className={assignHintClass}>Nenhum usuário encontrado para essa busca.</div>
                        ) : (
                          usuariosFiltradosAtribuicao.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              className={assignSearchItemClass(assignUserIds.includes(u.id))}
                              onClick={() => selecionarUsuarioParaAtribuicao(u)}
                            >
                              {u.nome} ({u.email || u.usuario || "sem email"})
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className={medalhaFormRowClass}>
                    <span>Medalha</span>

                    <PaginatedSelect
                      value={assignBadgeId}
                      onChange={adicionarBadgeParaAtribuicao}
                      options={badgeOptionsAtribuicao}
                      placeholder={
                        badgeOptionsAtribuicao.length === 0
                          ? "Todas as medalhas ja foram selecionadas"
                          : "Adicionar medalha por nome/descricao..."
                      }
                      emptyText="Nenhuma medalha encontrada"
                      pageSize={3}
                      allowPageSizeChange={false}
                      disabled={badgeOptionsAtribuicao.length === 0}
                    />

                    {badgesSelecionadasAtribuicao.length > 0 ? (
                      <div className={assignSelectedListClass}>
                        {badgesSelecionadasAtribuicao.map((badge) => (
                          <button
                            key={badge.id}
                            type="button"
                            className={assignSelectedChipClass}
                            onClick={() => removerBadgeSelecionada(badge.id)}
                            title="Clique para remover da selecao"
                          >
                            {badge.name} x
                          </button>
                        ))}
                        <button
                          type="button"
                          className="inline-flex h-9 items-center rounded-full border border-border/70 bg-muted/35 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground transition hover:border-primary/35 hover:bg-accent"
                          onClick={limparBadgesSelecionadas}
                        >
                          Limpar medalhas
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                        Escolha uma ou mais medalhas para montar o lote.
                      </div>
                    )}
                  </div>
                </div>
                <div className={assignFooterClass}>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-sm font-semibold text-foreground">
                      {totalUsuariosSelecionados} usuário{totalUsuariosSelecionados === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-sm text-muted-foreground">
                      {totalBadgesSelecionadas > 0
                        ? `${totalBadgesSelecionadas} medalha${totalBadgesSelecionadas === 1 ? "" : "s"}`
                        : "Selecione medalhas"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      primaryButtonClass,
                      "w-full sm:w-fit disabled:border disabled:border-border/70 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0",
                    )}
                    onClick={atribuirMedalha}
                    disabled={assigning || totalUsuariosSelecionados === 0 || totalBadgesSelecionadas === 0}
                  >
                    {assigning ? "Atribuindo..." : `Atribuir em lote (${totalUsuariosSelecionados} x ${totalBadgesSelecionadas})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : aba === "imagens" ? (
          <div className={medalhaFormCardClass}>
            <div className="space-y-1">
              <h3 className={panelTitleClass}>Imagens das medalhas</h3>
              <p className={panelCopyClass}>Biblioteca visual das medalhas cadastradas para edição rápida.</p>
            </div>
            <div className={searchCardClass}>
              <label htmlFor="busca-imagens-medalhas" className={fieldLabelClass}>Filtrar imagens</label>
              <input
                className={fieldClass}
                id="busca-imagens-medalhas"
                value={buscaImagemBiblioteca}
                onChange={(e) => setBuscaImagemBiblioteca(e.target.value)}
                placeholder="Buscar por nome da medalha ou URL da imagem..."
              />
            </div>
            {loadingBadgeOptions ? (
              <div className={imagesGridClass}>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <article key={`img-loading-${idx}`} className={imageCardClass(false)}>
                    <div className={cn(imageThumbWrapClass, imageSkeletonClass)} />
                    <strong className={imageTextSkeletonClass} />
                  </article>
                ))}
              </div>
            ) : imagensBibliotecaFiltradas.length === 0 ? (
              <div className={emptyCardClass}>
                {buscaImagemBiblioteca.trim()
                  ? "Nenhuma imagem encontrada para esse filtro."
                  : "Nenhuma imagem cadastrada ainda."}
              </div>
            ) : (
              <>
                <div className={imagesGridClass}>
                  {imagensBibliotecaPaginadas.map((img) => (
                    <article
                      key={img.id}
                      className={imageCardClass(role === "admin")}
                      onClick={() => {
                        if (role !== "admin") return;
                        const badge = badgeOptions.find((b) => b.id === img.id);
                        if (!badge) return;
                        iniciarEdicaoMedalha(badge, { manterAbaAtual: true, abrirModal: true });
                      }}
                      onKeyDown={(event) => {
                        if (role !== "admin") return;
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        const badge = badgeOptions.find((b) => b.id === img.id);
                        if (!badge) return;
                        iniciarEdicaoMedalha(badge, { manterAbaAtual: true, abrirModal: true });
                      }}
                      role={role === "admin" ? "button" : undefined}
                      tabIndex={role === "admin" ? 0 : undefined}
                    >
                      <div className={imageThumbWrapClass}>
                        {img.url && !imagemBibliotecaLoadError[img.id] ? (
                          <img
                            className="max-h-[260px] max-w-full object-contain"
                            src={img.url}
                            alt={img.nome}
                            onError={() =>
                              setImagemBibliotecaLoadError((prev) => ({ ...prev, [img.id]: true }))
                            }
                          />
                        ) : null}
                        {(!img.url || imagemBibliotecaLoadError[img.id]) && (
                          <div className="grid h-full w-full place-items-center rounded-[16px] bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(225,29,46,0.18))] text-3xl font-black text-white">
                            {img.nome.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <strong className="truncate text-base font-black tracking-[-0.02em] text-foreground">{img.nome}</strong>
                    </article>
                  ))}
                </div>
                <Pagination
                  currentPage={imagensPage}
                  itemsPerPage={imagensPerPage}
                  totalItems={imagensBibliotecaFiltradas.length}
                  onPageChange={setImagensPage}
                  onItemsPerPageChange={setImagensPerPage}
                />
              </>
            )}
          </div>
        ) : (
          <div className={medalhaFormCardClass}>
            <div className="space-y-1">
              <h3 className={panelTitleClass}>{editingBadgeId ? "Editar medalha" : "Criar medalha"}</h3>
              <p className={panelCopyClass}>Defina nome, descrição e imagem da medalha antes de salvar.</p>
            </div>
            <div className={medalhaFormRowClass}>
              <span>Nome da medalha</span>
              <input
                className={fieldClass}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Mestre do SQL"
              />
            </div>
            <div className={medalhaFormRowClass}>
              <span>Descrição</span>
              <textarea
                className={textareaClass}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={4}
                placeholder="Ex: Concluiu a trilha avançada de banco de dados."
              />
            </div>
            <div className={medalhaFormGridClass}>
              <div className={medalhaFormRowClass}>
                <span>Ícone</span>
                <div className={medalhaFileFieldClass}>
                  <label htmlFor="icone-medalha-file" className={medalhaFileBtnClass}>Selecionar imagem</label>
                  <span className={medalhaFileNameClass}>{iconeArquivoNome || "Nenhum arquivo selecionado"}</span>
                  <button
                    type="button"
                    className={fileRemoveButtonClass}
                    onClick={removerImagemBadge}
                    disabled={!icone.trim() && !iconeArquivoNome}
                  >
                    Remover imagem
                  </button>
                  <input
                    id="icone-medalha-file"
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIconeArquivoNome(file.name);
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = String(reader.result || "");
                        if (!base64.startsWith("data:image/")) {
                          setErro("Arquivo inválido. Selecione uma imagem.");
                          return;
                        }
                        setErro(null);
                        setIcone(base64);
                        setIconePreviewError(false);
                      };
                      reader.onerror = () => {
                        setErro("Não foi possível ler a imagem selecionada.");
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
                <div className={previewWrapClass}>
                  {icone.trim() && !iconePreviewError ? (
                    <img
                      className={badgeIconPreviewClass}
                      src={icone}
                      alt="Preview do ícone"
                      onError={() => setIconePreviewError(true)}
                      onLoad={() => setIconePreviewError(false)}
                    />
                  ) : (
                    <div
                      className={cn(
                        badgeIconPreviewClass,
                        badgeIconPreviewFallbackClass,
                        !icone.trim() && "px-3 text-center text-xs font-semibold normal-case leading-5",
                      )}
                    >
                      {icone.trim() ? previewFallbackText : "Sem preview"}
                    </div>
                  )}
                </div>
                {icone.trim() && iconePreviewError && (
                  <small className={fieldErrorClass}>
                    Não foi possível carregar o ícone selecionado.
                  </small>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className={cn(primaryButtonClass, "w-full sm:w-fit")}
                onClick={() => void criarOuAtualizarMedalha()}
                disabled={saving}
              >
                <Medal size={16} />
                {saving ? "Salvando..." : editingBadgeId ? "Salvar alterações" : "Salvar medalha"}
              </button>
              {editingBadgeId && (
                <button
                  type="button"
                  className={cn(secondaryButtonClass, "w-full sm:w-fit")}
                  onClick={cancelarEdicaoMedalha}
                  disabled={saving}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </div>
        )}
        <Modal
          isOpen={imagemModalAberto}
          onClose={() => setImagemModalAberto(false)}
          title="Editar medalha"
          size="lg"
          footer={
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className={cn(secondaryButtonClass, "w-full sm:w-fit")}
                onClick={() => setImagemModalAberto(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={cn(primaryButtonClass, "w-full sm:w-fit")}
                onClick={() => void criarOuAtualizarMedalha({ manterAbaAtual: true, fecharModal: true })}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          }
        >
          <div className="grid gap-5">
            <div className={medalhaFormRowClass}>
              <span>Nome da medalha</span>
              <input
                className={fieldClass}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Mestre do SQL"
              />
            </div>
            <div className={medalhaFormRowClass}>
              <span>Descrição</span>
              <textarea
                className={textareaClass}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={4}
                placeholder="Ex: Concluiu a trilha avançada de banco de dados."
              />
            </div>
            <div className={medalhaFormRowClass}>
              <span>Ícone</span>
              <div className={medalhaFileFieldClass}>
                <label htmlFor="icone-medalha-file-modal" className={medalhaFileBtnClass}>Selecionar imagem</label>
                <span className={medalhaFileNameClass}>{iconeArquivoNome || "Nenhum arquivo selecionado"}</span>
                <button
                  type="button"
                  className={fileRemoveButtonClass}
                  onClick={removerImagemBadge}
                  disabled={!icone.trim() && !iconeArquivoNome}
                >
                  Remover imagem
                </button>
                <input
                  id="icone-medalha-file-modal"
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIconeArquivoNome(file.name);
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = String(reader.result || "");
                      if (!base64.startsWith("data:image/")) {
                        setErro("Arquivo inválido. Selecione uma imagem.");
                        return;
                      }
                      setErro(null);
                      setIcone(base64);
                      setIconePreviewError(false);
                    };
                    reader.onerror = () => {
                      setErro("Não foi possível ler a imagem selecionada.");
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
              <div className={previewWrapClass}>
                {icone.trim() && !iconePreviewError ? (
                  <img
                    className={badgeIconPreviewClass}
                    src={icone}
                    alt="Preview do ícone"
                    onError={() => setIconePreviewError(true)}
                    onLoad={() => setIconePreviewError(false)}
                  />
                ) : (
                  <div
                    className={cn(
                      badgeIconPreviewClass,
                      badgeIconPreviewFallbackClass,
                      !icone.trim() && "px-3 text-center text-xs font-semibold normal-case leading-5",
                    )}
                  >
                    {icone.trim() ? previewFallbackText : "Sem preview"}
                  </div>
                )}
              </div>
              {icone.trim() && iconePreviewError && (
                <small className={fieldErrorClass}>
                  Não foi possível carregar o ícone selecionado.
                </small>
              )}
            </div>
          </div>
        </Modal>
      </section>
    </DashboardLayout>
  );
}
