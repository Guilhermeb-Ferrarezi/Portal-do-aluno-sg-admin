import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import { Medal, PlusCircle, Eye, CalendarClock, Pencil, Trash2 } from "lucide-react";
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

type Aba = "ver" | "criar";
type HolderGroup = {
  user: BadgeHolder["user"];
  items: BadgeHolder[];
  latestAwardedAt: string;
};

export default function MedalhasPage() {
  const [aba, setAba] = React.useState<Aba>("ver");
  const [medalhas, setMedalhas] = React.useState<Badge[]>([]);
  const [badgeOptions, setBadgeOptions] = React.useState<Badge[]>([]);
  const [totalMedalhas, setTotalMedalhas] = React.useState(0);
  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [icone, setIcone] = React.useState("");
  const [editingBadgeId, setEditingBadgeId] = React.useState<string | null>(null);
  const [mensagem, setMensagem] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [badgeFiltro, setBadgeFiltro] = React.useState<string>("");
  const [buscaMedalha, setBuscaMedalha] = React.useState("");
  const [holders, setHolders] = React.useState<BadgeHolder[]>([]);
  const [totalHolders, setTotalHolders] = React.useState(0);
  const [loadingHolders, setLoadingHolders] = React.useState(true);
  const [savingHolderId, setSavingHolderId] = React.useState<string | null>(null);
  const [removingHolderId, setRemovingHolderId] = React.useState<string | null>(null);
  const [holderBadgeDraft, setHolderBadgeDraft] = React.useState<Record<string, string>>({});
  const [buscaHolder, setBuscaHolder] = React.useState("");
  const [medalhasPage, setMedalhasPage] = React.useState(1);
  const [medalhasPerPage, setMedalhasPerPage] = React.useState(10);
  const [holdersPage, setHoldersPage] = React.useState(1);
  const [holdersPerPage, setHoldersPerPage] = React.useState(10);
  const [usuarios, setUsuarios] = React.useState<User[]>([]);
  const [assignUserId, setAssignUserId] = React.useState("");
  const [assignBadgeId, setAssignBadgeId] = React.useState("");
  const [assignUserQuery, setAssignUserQuery] = React.useState("");
  const [assignBadgeQuery, setAssignBadgeQuery] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);
  const role = getRole();

  const carregarMedalhas = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarBadges({
        q: buscaMedalha.trim() || undefined,
        limit: medalhasPerPage,
        offset: (medalhasPage - 1) * medalhasPerPage,
      });
      setMedalhas(res.items);
      setTotalMedalhas(res.total);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar medalhas");
    } finally {
      setLoading(false);
    }
  }, [buscaMedalha, medalhasPage, medalhasPerPage]);

  const carregarBadgeOptions = React.useCallback(async () => {
    try {
      const res = await listarBadges({ limit: 200, offset: 0 });
      setBadgeOptions(res.items);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar opções de medalhas");
    }
  }, []);

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
        const all = Array.from(map.values()).sort((a, b) =>
          (a.nome || "").localeCompare(b.nome || "", "pt-BR")
        );
        setUsuarios(all);
      })
      .catch((e) =>
        setErro(e instanceof Error ? e.message : "Erro ao carregar usuários para atribuição")
      );
  }, [role]);

  React.useEffect(() => {
    setMedalhasPage(1);
  }, [buscaMedalha, medalhasPerPage]);

  const carregarHolders = React.useCallback(async () => {
    setLoadingHolders(true);
    try {
      const result = await listarBadgeHolders({
        badgeId: badgeFiltro || undefined,
        limit: holdersPerPage,
        offset: (holdersPage - 1) * holdersPerPage,
      });
      setHolders(result.items);
      setTotalHolders(result.total);
      const draft: Record<string, string> = {};
      for (const h of result.items) {
        draft[h.holderId] = h.badgeId;
      }
      setHolderBadgeDraft(draft);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar usuários com medalhas");
    } finally {
      setLoadingHolders(false);
    }
  }, [badgeFiltro, holdersPage, holdersPerPage]);

  React.useEffect(() => {
    void carregarHolders();
  }, [carregarHolders]);

  React.useEffect(() => {
    setHoldersPage(1);
  }, [badgeFiltro, holdersPerPage]);

  const salvarEdicaoHolder = async (holderId: string) => {
    const novoBadgeId = holderBadgeDraft[holderId];
    if (!novoBadgeId) return;
    setMensagem(null);
    setErro(null);
    setSavingHolderId(holderId);
    try {
      const result = await atualizarBadgeDoUsuario(holderId, novoBadgeId);
      setMensagem(result.message || "Medalha do usuário atualizada.");
      await carregarHolders();
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
      await carregarHolders();
      await carregarMedalhas();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover medalha do usuário");
    } finally {
      setRemovingHolderId(null);
    }
  };

  const criarOuAtualizarMedalha = async () => {
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
    if (!icone.trim()) {
      setErro("Informe a URL/caminho do ícone da medalha.");
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
      await Promise.all([carregarMedalhas(), carregarBadgeOptions()]);
      setNome("");
      setDescricao("");
      setIcone("");
      setEditingBadgeId(null);
      setMensagem(
        result.message || (editingBadgeId ? "Medalha atualizada com sucesso." : "Medalha criada com sucesso.")
      );
      setAba("ver");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar medalha");
    } finally {
      setSaving(false);
    }
  };

  const iniciarEdicaoMedalha = (badge: Badge) => {
    setErro(null);
    setMensagem(null);
    setEditingBadgeId(badge.id);
    setNome(badge.name);
    setDescricao(badge.description);
    setIcone(badge.iconUrl || "");
    setAba("criar");
  };

  const cancelarEdicaoMedalha = () => {
    setEditingBadgeId(null);
    setNome("");
    setDescricao("");
    setIcone("");
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
      await Promise.all([carregarMedalhas(), carregarBadgeOptions(), carregarHolders()]);
      setMensagem(result.message || "Medalha excluída com sucesso.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir medalha");
    }
  };

  const atribuirMedalha = async () => {
    setMensagem(null);
    setErro(null);
    if (!assignUserId) {
      setErro("Selecione o usuário.");
      return;
    }
    if (!assignBadgeId) {
      setErro("Selecione a medalha.");
      return;
    }

    setAssigning(true);
    try {
      const result = await atribuirBadgeAoUsuario(assignUserId, assignBadgeId);
      setMensagem(result.message || "Medalha atribuída com sucesso.");
      await carregarHolders();
      await carregarMedalhas();
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
    setAssignUserId(u.id);
    setAssignUserQuery(`${u.nome} (${u.email || u.usuario || "sem email"})`);
  };

  const selecionarBadgeParaAtribuicao = (b: Badge) => {
    setAssignBadgeId(b.id);
    setAssignBadgeQuery(b.name);
  };

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
        </div>

        {mensagem && <div className="medalhasMessage success">{mensagem}</div>}
        {erro && <div className="medalhasMessage error">{erro}</div>}

        {aba === "ver" ? (
          <div className="medalhasView">
            <div className="medalhasSearchCard">
              <label htmlFor="busca-medalha">Buscar medalha por escrita</label>
              <input
                id="busca-medalha"
                value={buscaMedalha}
                onChange={(e) => setBuscaMedalha(e.target.value)}
                placeholder="Digite nome ou descrição da medalha..."
              />
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
                      {m.iconUrl ? (
                        <img
                          src={m.iconUrl}
                          alt={m.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : null}
                      <span>{m.name.slice(0, 1).toUpperCase()}</span>
                    </div>
                    <div className="medalhaContent">
                      <h3>{m.name}</h3>
                      <p>{m.description}</p>
                      <div className="medalhaUsageCount">
                        {(m.holdersCount ?? 0)} usuário{(m.holdersCount ?? 0) === 1 ? "" : "s"}
                      </div>
                      <small>
                        <CalendarClock size={12} />{" "}
                        {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                      </small>
                      {role === "admin" && (
                        <div className="medalhaActions">
                          <button
                            type="button"
                            className="medalhaActionBtn"
                            onClick={() => iniciarEdicaoMedalha(m)}
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
                <div className="medalhaEmpty">Carregando usuarios...</div>
              ) : holdersAgrupados.length === 0 ? (
                <div className="medalhaEmpty">Ninguem recebeu essa medalha ainda.</div>
              ) : (
                <div className="holdersList">
                  {holdersAgrupados.map((group) => (
                    <details key={group.user.id} className="holderGroup">
                      <summary className="holderGroupSummary">
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
                      </summary>

                      <div className="holderGroupItems">
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
                    </details>
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
                    <label>Usuário</label>
                    <input
                      value={assignUserQuery}
                      onChange={(e) => {
                        setAssignUserQuery(e.target.value);
                        setAssignUserId("");
                      }}
                      placeholder="Buscar por nome ou email..."
                    />
                    {assignUserId === "" && (
                      <div className="assignSearchList">
                        {usuariosFiltradosAtribuicao.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className={`assignSearchItem ${assignUserId === u.id ? "active" : ""}`}
                            onClick={() => selecionarUsuarioParaAtribuicao(u)}
                          >
                            {u.nome} ({u.email || u.usuario || "sem email"})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="medalhaFormRow">
                    <label>Medalha</label>
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
                  disabled={assigning || !assignUserId || !assignBadgeId}
                >
                  {assigning ? "Atribuindo..." : "Atribuir medalha"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="medalhaFormCard">
            <h3>{editingBadgeId ? "Editar medalha" : "Criar medalha"}</h3>
            <div className="medalhaFormRow">
              <label>Nome da medalha</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Mestre do SQL"
              />
            </div>
            <div className="medalhaFormRow">
              <label>Descrição</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={4}
                placeholder="Ex: Concluiu a trilha avançada de banco de dados."
              />
            </div>
            <div className="medalhaFormGrid">
              <div className="medalhaFormRow">
                <label>Ícone (URL/caminho)</label>
                <input
                  value={icone}
                  onChange={(e) => setIcone(e.target.value)}
                  placeholder="/imagens/badges/exemplo.png"
                />
              </div>
            </div>
            <button
              type="button"
              className="medalhaSubmit"
              onClick={criarOuAtualizarMedalha}
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
      </section>
    </DashboardLayout>
  );
}
