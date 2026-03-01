import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import { AnimatedToast } from "../components/animate-ui";
import { Medal, PlusCircle, Eye, CalendarClock, Pencil, Trash2, ChevronDown, Images } from "lucide-react";
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
import "./Medalhas.css";

type Aba = "ver" | "criar" | "imagens";
type HolderGroup = {
  user: BadgeHolder["user"];
  items: BadgeHolder[];
  latestAwardedAt: string;
};

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
  const [assignUserQuery, setAssignUserQuery] = React.useState("");
  const [assignBadgeQuery, setAssignBadgeQuery] = React.useState("");
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
    setMensagem(null);
    setErro(null);
    const userIds = assignUserIds.length > 0 ? assignUserIds : assignUserId ? [assignUserId] : [];
    if (userIds.length === 0) {
      setErro("Selecione o usuário.");
      return;
    }
    if (!assignBadgeId) {
      setErro("Selecione a medalha.");
      return;
    }

    setAssigning(true);
    try {
      let sucesso = 0;
      let falhas = 0;
      for (const userId of userIds) {
        try {
          await atribuirBadgeAoUsuario(userId, assignBadgeId);
          sucesso += 1;
        } catch {
          falhas += 1;
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
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atribuir medalha");
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

  const badgesFiltradasAtribuicao = React.useMemo(() => {
    const q = assignBadgeQuery.trim().toLowerCase();
    if (!q) return [];
    const base = badgeOptions.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    );
    return base.slice(0, 8);
  }, [badgeOptions, assignBadgeQuery]);

  const selecionarUsuarioParaAtribuicao = (u: User) => {
    setAssignUserIds((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
    setAssignUserId(u.id);
    setAssignUserQuery("");
  };

  const selecionarBadgeParaAtribuicao = (b: Badge) => {
    setAssignBadgeId(b.id);
    setAssignBadgeQuery(b.name);
  };

  const removerUsuarioSelecionado = (userId: string) => {
    setAssignUserIds((prev) => prev.filter((id) => id !== userId));
    if (assignUserId === userId) {
      const next = assignUserIds.find((id) => id !== userId) || "";
      setAssignUserId(next);
    }
  };

  const previewFallbackText = nome.trim() ? nome.trim().slice(0, 1).toUpperCase() : "Sem preview";

  return (
    <DashboardLayout
      title="Medalhas"
      subtitle="Visualize e crie medalhas do portal"
    >
      <section className="medalhasPage">
        <div className="medalhasTabs">
          <button
            className={`medalhasTab ${aba === "ver" ? "active" : ""}`}
            onClick={() => setAba("ver")}
            type="button"
          >
            <Eye size={16} />
            Ver medalhas
          </button>
          <button
            className={`medalhasTab ${aba === "criar" ? "active" : ""}`}
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
            className={`medalhasTab ${aba === "imagens" ? "active" : ""}`}
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
          <div className="medalhasView">
            <div className="medalhasStatsGrid">
              <article className="medalhasStatCard">
                <span>Total de medalhas</span>
                <strong>{medalhasRaw.length}</strong>
              </article>
              <article className="medalhasStatCard">
                <span>Usuarios medalhados</span>
                <strong>{totalUsuariosMedalhados}</strong>
              </article>
              <article className="medalhasStatCard">
                <span>Medalha mais usada</span>
                <strong>{medalhaMaisUsada ? `${medalhaMaisUsada.nome} (${medalhaMaisUsada.count})` : "-"}</strong>
              </article>
            </div>

            <div className="medalhasSearchCard">
              <label htmlFor="busca-medalha">Buscar medalha por escrita</label>
              <input
                id="busca-medalha"
                value={buscaMedalha}
                onChange={(e) => setBuscaMedalha(e.target.value)}
                placeholder="Digite nome ou descrição da medalha..."
              />
              <div className="medalhasSearchFilters">
                <select
                  value={medalhaUsoFiltro}
                  onChange={(e) => setMedalhaUsoFiltro(e.target.value as "todas" | "com_uso" | "sem_uso")}
                >
                  <option value="todas">Todas</option>
                  <option value="com_uso">Com atribuição</option>
                  <option value="sem_uso">Sem atribuição</option>
                </select>
                <select
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

            <div className="medalhasGrid">
              {loading ? (
                <div className="medalhaEmpty">Carregando medalhas...</div>
              ) : medalhas.length === 0 ? (
                <div className="medalhaEmpty">Nenhuma medalha criada ainda.</div>
              ) : (
                medalhas.map((m) => (
                  <article key={m.id} className="medalhaCard">
                    <div className="medalhaIcon">
                      {m.iconUrl && !badgeIconLoadError[m.id] ? (
                        <img
                          src={m.iconUrl}
                          alt={m.name}
                          onError={() => {
                            setBadgeIconLoadError((prev) => ({ ...prev, [m.id]: true }));
                          }}
                        />
                      ) : null}
                      {(!m.iconUrl || badgeIconLoadError[m.id]) && (
                        <span>{m.name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="medalhaContent">
                      <h3>{m.name}</h3>
                      <p>{m.description}</p>
                      <div className="medalhaUsageCount">
                        {(badgeUsageById.get(m.id)?.count ?? m.holdersCount ?? 0)} usuário{(badgeUsageById.get(m.id)?.count ?? m.holdersCount ?? 0) === 1 ? "" : "s"}
                      </div>
                      <small className="medalhaContextLine">
                        Última atribuição:{" "}
                        {badgeUsageById.get(m.id)?.latestAwardedAt
                          ? new Date(badgeUsageById.get(m.id)!.latestAwardedAt!).toLocaleDateString("pt-BR")
                          : "nunca"}
                      </small>
                      <small>
                        <CalendarClock size={12} />{" "}
                        {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                      </small>
                      {role === "admin" && (
                        <div className="medalhaActions">
                          <button
                            type="button"
                            className="medalhaActionBtn"
                            onClick={() => {
                              iniciarEdicaoMedalha(m, { manterAbaAtual: true, abrirModal: true });
                            }}
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                          <button
                            type="button"
                            className="medalhaActionBtn danger"
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

            <div className="medalhasHoldersCard">
              <div className="medalhasHoldersHeader">
                <h3>Quem tem medalhas</h3>
                <div className="medalhasHoldersFilters">
                  <input
                    value={buscaHolder}
                    onChange={(e) => setBuscaHolder(e.target.value)}
                    placeholder="Buscar usuário ou medalha..."
                  />
                  <select
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
                <div className="medalhaEmpty">Carregando usuários...</div>
              ) : holdersAgrupados.length === 0 ? (
                <div className="medalhaEmpty">Ninguém recebeu essa medalha ainda.</div>
              ) : (
                <div className="holdersList">
                  {holdersAgrupados.map((group) => (
                    <div
                      key={group.user.id}
                      className={`holderGroup ${openHolderGroups[group.user.id] ? "isOpen" : ""}`}
                    >
                      <button
                        type="button"
                        className="holderGroupSummary"
                        onClick={() => toggleHolderGroup(group.user.id)}
                        aria-expanded={Boolean(openHolderGroups[group.user.id])}
                        aria-controls={`holder-group-items-${group.user.id}`}
                      >
                        <div className="holderMain">
                          <strong>{group.user.nome}</strong>
                          <span>{group.user.email}</span>
                        </div>
                        <div className="holderGroupMeta">
                          <span>
                            {group.items.length} medalha
                            {group.items.length === 1 ? "" : "s"}
                          </span>
                          <small>
                            Ultima: {" "}
                            {new Date(group.latestAwardedAt).toLocaleDateString("pt-BR")}
                          </small>
                        </div>
                        <span className="holderChevron" aria-hidden="true">
                          <ChevronDown size={16} />
                        </span>
                      </button>

                      <div
                        id={`holder-group-items-${group.user.id}`}
                        className="holderGroupItems"
                      >
                        {group.items.map((holder) => (
                          <div key={holder.holderId} className="holderItem">
                            <div className="holderMeta">
                              <span>{holder.badgeName}</span>
                              <small>
                                {new Date(holder.awardedAt).toLocaleDateString("pt-BR")}
                              </small>
                            </div>
                            {role === "admin" && (
                              <div className="holderEdit">
                                <select
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
                                  className="holderDeleteBtn"
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
                  ))}
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
              <div className="medalhasAssignCard">
                <h3>Atribuir medalha a usuário</h3>
                <div className="medalhasAssignGrid">
                  <div className="medalhaFormRow">
                    <span>Usuário</span>
                    <input
                      value={assignUserQuery}
                      onChange={(e) => {
                        setAssignUserQuery(e.target.value);
                      }}
                      placeholder="Buscar por nome ou email..."
                    />
                    {assignUserIds.length > 0 && (
                      <div className="assignSelectedList">
                        {assignUserIds.map((uid) => {
                          const user = usuarios.find((u) => u.id === uid);
                          return (
                            <button
                              key={uid}
                              type="button"
                              className="assignSelectedChip"
                              onClick={() => removerUsuarioSelecionado(uid)}
                            >
                              {user?.nome || uid} x
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {assignUserQuery.trim() !== "" && (
                      <div className="assignSearchList">
                        {usuariosFiltradosAtribuicao.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className={`assignSearchItem ${assignUserIds.includes(u.id) ? "active" : ""}`}
                            onClick={() => selecionarUsuarioParaAtribuicao(u)}
                          >
                            {u.nome} ({u.email || u.usuario || "sem email"})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="medalhaFormRow">
                    <span>Medalha</span>
                    <input
                      value={assignBadgeQuery}
                      onChange={(e) => {
                        setAssignBadgeQuery(e.target.value);
                        setAssignBadgeId("");
                      }}
                      placeholder="Buscar medalha por nome/descrição..."
                    />
                    {assignBadgeId === "" && (
                      <div className="assignSearchList">
                        {badgesFiltradasAtribuicao.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className={`assignSearchItem ${assignBadgeId === b.id ? "active" : ""}`}
                            onClick={() => selecionarBadgeParaAtribuicao(b)}
                          >
                            {b.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="medalhaSubmit"
                  onClick={atribuirMedalha}
                  disabled={assigning || (assignUserIds.length === 0 && !assignUserId) || !assignBadgeId}
                >
                  {assigning ? "Atribuindo..." : `Atribuir medalha (${assignUserIds.length || (assignUserId ? 1 : 0)})`}
                </button>
              </div>
            )}
          </div>
        ) : aba === "imagens" ? (
          <div className="medalhaFormCard">
            <h3>Imagens das medalhas</h3>
            <div className="medalhasSearchCard">
              <label htmlFor="busca-imagens-medalhas">Filtrar imagens</label>
              <input
                id="busca-imagens-medalhas"
                value={buscaImagemBiblioteca}
                onChange={(e) => setBuscaImagemBiblioteca(e.target.value)}
                placeholder="Buscar por nome da medalha ou URL da imagem..."
              />
            </div>
            {loadingBadgeOptions ? (
              <div className="medalhasImagesGrid">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <article key={`img-loading-${idx}`} className="medalhasImageCard medalhasImageCardLoading">
                    <div className="medalhasImageThumbWrap medalhasImageThumbLoading" />
                    <strong className="medalhasImageTextLoading" />
                  </article>
                ))}
              </div>
            ) : imagensBibliotecaFiltradas.length === 0 ? (
              <div className="medalhaEmpty">
                {buscaImagemBiblioteca.trim()
                  ? "Nenhuma imagem encontrada para esse filtro."
                  : "Nenhuma imagem cadastrada ainda."}
              </div>
            ) : (
              <>
                <div className="medalhasImagesGrid">
                  {imagensBibliotecaPaginadas.map((img) => (
                    <article
                      key={img.id}
                      className={`medalhasImageCard ${role === "admin" ? "isClickable" : ""}`}
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
                      <div className="medalhasImageThumbWrap">
                        {img.url && !imagemBibliotecaLoadError[img.id] ? (
                          <img
                            className="medalhasImageThumb"
                            src={img.url}
                            alt={img.nome}
                            onError={() =>
                              setImagemBibliotecaLoadError((prev) => ({ ...prev, [img.id]: true }))
                            }
                          />
                        ) : null}
                        {(!img.url || imagemBibliotecaLoadError[img.id]) && (
                          <div className="medalhasImageThumbFallback">
                            {img.nome.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <strong>{img.nome}</strong>
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
          <div className="medalhaFormCard">
            <h3>{editingBadgeId ? "Editar medalha" : "Criar medalha"}</h3>
            <div className="medalhaFormRow">
              <span>Nome da medalha</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Mestre do SQL"
              />
            </div>
            <div className="medalhaFormRow">
              <span>Descrição</span>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={4}
                placeholder="Ex: Concluiu a trilha avançada de banco de dados."
              />
            </div>
            <div className="medalhaFormGrid">
              <div className="medalhaFormRow">
                <span>Ícone</span>
                <div className="medalhaFileField">
                  <label htmlFor="icone-medalha-file" className="medalhaFileBtn">Selecionar imagem</label>
                  <span className="medalhaFileName">{iconeArquivoNome || "Nenhum arquivo selecionado"}</span>
                  <button
                    type="button"
                    className="medalhaFileBtn medalhaFileBtnDanger"
                    onClick={removerImagemBadge}
                    disabled={!icone.trim() && !iconeArquivoNome}
                  >
                    Remover imagem
                  </button>
                  <input
                    id="icone-medalha-file"
                    className="medalhaFileInput"
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
                <div className="badgeIconPreviewWrap">
                  {icone.trim() && !iconePreviewError ? (
                    <img
                      className="badgeIconPreview"
                      src={icone}
                      alt="Preview do ícone"
                      onError={() => setIconePreviewError(true)}
                      onLoad={() => setIconePreviewError(false)}
                    />
                  ) : (
                    <div className={`badgeIconPreview badgeIconPreviewFallback ${!icone.trim() ? "isEmpty" : ""}`}>
                      {icone.trim() ? previewFallbackText : "Sem preview"}
                    </div>
                  )}
                </div>
                {icone.trim() && iconePreviewError && (
                  <small className="medalhaFieldError">
                    Não foi possível carregar o ícone selecionado.
                  </small>
                )}
              </div>
            </div>
            <button
              type="button"
              className="medalhaSubmit"
              onClick={() => void criarOuAtualizarMedalha()}
              disabled={saving}
            >
              <Medal size={16} />
              {saving ? "Salvando..." : editingBadgeId ? "Salvar alterações" : "Salvar medalha"}
            </button>
            {editingBadgeId && (
              <button
                type="button"
                className="medalhaSubmit medalhaCancelBtn"
                onClick={cancelarEdicaoMedalha}
                disabled={saving}
              >
                Cancelar edição
              </button>
            )}
          </div>
        )}
        <Modal
          isOpen={imagemModalAberto}
          onClose={() => setImagemModalAberto(false)}
          title={editingBadgeId ? "Editar medalha" : "Editar medalha"}
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="medalhaSubmit medalhaCancelBtn"
                onClick={() => setImagemModalAberto(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="medalhaSubmit"
                onClick={() => void criarOuAtualizarMedalha({ manterAbaAtual: true, fecharModal: true })}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </>
          }
        >
          <div className="medalhaFormRow">
            <span>Nome da medalha</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Mestre do SQL"
            />
          </div>
          <div className="medalhaFormRow">
            <span>Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              placeholder="Ex: Concluiu a trilha avançada de banco de dados."
            />
          </div>
          <div className="medalhaFormRow">
            <span>Ícone</span>
            <div className="medalhaFileField">
              <label htmlFor="icone-medalha-file-modal" className="medalhaFileBtn">Selecionar imagem</label>
              <span className="medalhaFileName">{iconeArquivoNome || "Nenhum arquivo selecionado"}</span>
              <button
                type="button"
                className="medalhaFileBtn medalhaFileBtnDanger"
                onClick={removerImagemBadge}
                disabled={!icone.trim() && !iconeArquivoNome}
              >
                Remover imagem
              </button>
              <input
                id="icone-medalha-file-modal"
                className="medalhaFileInput"
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
            <div className="badgeIconPreviewWrap">
              {icone.trim() && !iconePreviewError ? (
                <img
                  className="badgeIconPreview"
                  src={icone}
                  alt="Preview do ícone"
                  onError={() => setIconePreviewError(true)}
                  onLoad={() => setIconePreviewError(false)}
                />
              ) : (
                <div className={`badgeIconPreview badgeIconPreviewFallback ${!icone.trim() ? "isEmpty" : ""}`}>
                  {icone.trim() ? previewFallbackText : "Sem preview"}
                </div>
              )}
            </div>
            {icone.trim() && iconePreviewError && (
              <small className="medalhaFieldError">
                Não foi possível carregar o ícone selecionado.
              </small>
            )}
          </div>
        </Modal>
      </section>
    </DashboardLayout>
  );
}




