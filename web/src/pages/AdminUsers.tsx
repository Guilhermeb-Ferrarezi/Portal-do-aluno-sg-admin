import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { FadeInUp } from "../components/animate-ui/FadeInUp";
import { AnimatedButton } from "../components/animate-ui/AnimatedButton";
import { AnimatedToast } from "../components/animate-ui/AnimatedToast";
import { AnimatedSelect } from "../components/animate-ui/AnimatedSelect";
import {
  listarUsuariosPaginado,
  atualizarUsuario,
  deletarUsuario,
  type User,
} from "../services/api";
import { getPresenceSnapshot, subscribeToPresence } from "../services/presenceSocket";
import "./AdminUsers.css";
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
} from "lucide-react";

const PRESENCE_STALE_AFTER_MS = 90_000;
const PRESENCE_RENDER_TICK_MS = 15_000;

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

export default function AdminUsersPage() {
  const [usuarios, setUsuarios] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = React.useState<"todos" | "aluno" | "professor" | "admin">("todos");
  const [busca, setBusca] = React.useState("");

  const [editandoUsuario, setEditandoUsuario] = React.useState<User | null>(null);
  const [editNome, setEditNome] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editarAberto, setEditarAberto] = React.useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = React.useState(false);

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

  const roleLabel = (role: string) => {
    const baseStyle = { display: "inline-flex", alignItems: "center", gap: 6 };
    if (role === "aluno") {
      return (
        <span style={baseStyle}>
          <GraduationCap size={14} /> Aluno
        </span>
      );
    }
    if (role === "professor") {
      return (
        <span style={baseStyle}>
          <UserIcon size={14} /> Professor
        </span>
      );
    }
    return (
      <span style={baseStyle}>
        <KeyRound size={14} /> Admin
      </span>
    );
  };

  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 3000);
    return () => clearTimeout(timer);
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

      if (currentPage > response.pagination.totalPages) {
        setCurrentPage(response.pagination.totalPages);
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
    for (const presence of getPresenceSnapshot()) {
      applyPresenceState(presence.userId, presence.isOnline, presence.lastSeenAt);
    }

    return subscribeToPresence((message) => {
      if (message.type === "presence:reset") {
        clearVisiblePresenceState();
        return;
      }

      if (message.type !== "presence:update" && message.type !== "presence:hello") {
        return;
      }

      applyPresenceState(message.userId, message.isOnline, message.lastSeenAt);
    });
  }, [applyPresenceState, clearVisiblePresenceState]);

  const abrirEditar = (usuario: User) => {
    setEditandoUsuario(usuario);
    setEditNome(usuario.nome);
    setEditEmail(usuario.email ?? usuario.usuario ?? "");
    setEditarAberto(true);
  };

  const fecharEditar = () => {
    setEditarAberto(false);
    setEditandoUsuario(null);
    setEditNome("");
    setEditEmail("");
  };

  const salvarEdicao = async () => {
    if (!editandoUsuario) return;

    if (!editNome.trim() || !editEmail.trim()) {
      setFeedback({
        tipo: "erro",
        mensagem: "Nome e usuario sao obrigatorios",
      });
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
      setFeedback({
        tipo: "sucesso",
        mensagem: "Usuario atualizado com sucesso!",
      });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        mensagem: err instanceof Error ? err.message : "Erro ao atualizar usuario",
      });
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

      setFeedback({
        tipo: "sucesso",
        mensagem: "Usuario deletado com sucesso!",
      });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        mensagem: err instanceof Error ? err.message : "Erro ao deletar usuario",
      });
    } finally {
      setDeletando(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Gerenciar Usuarios"
        subtitle="Gerencie alunos, professores e admins"
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p>Carregando usuarios...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (erro) {
    return (
      <DashboardLayout
        title="Gerenciar Usuarios"
        subtitle="Gerencie alunos, professores e admins"
      >
        <div style={{ textAlign: "center", padding: "2rem", color: "red" }}>
          <p>Erro: {erro}</p>
          <button onClick={carregarUsuarios}>Tentar novamente</button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Gerenciar Usuarios"
      subtitle="Gerencie alunos, professores e admins"
    >
      <FadeInUp duration={0.28}>
        <div className="adminUsersContainer">
          <AnimatedToast
            message={feedback?.mensagem || null}
            type={feedback?.tipo === "sucesso" ? "success" : "error"}
            duration={3000}
            onClose={() => setFeedback(null)}
          />

          <FadeInUp duration={0.28} delay={0.08}>
            <div className="adminHeader">
              <div className="filterRow">
                <div className="searchBox">
                  <Search size={16} className="searchIcon" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou e-mail..."
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="searchInput"
                  />
                </div>

                <AnimatedSelect
                  value={filtroTipo}
                  onChange={(e) => {
                    setFiltroTipo(e.target.value as "todos" | "aluno" | "professor" | "admin");
                    setCurrentPage(1);
                  }}
                  className="filterSelect"
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="aluno">Alunos</option>
                  <option value="professor">Professores</option>
                  <option value="admin">Admins</option>
                </AnimatedSelect>

                <button
                  type="button"
                  className="usersRefreshButton"
                  onClick={() => {
                    void carregarUsuarios();
                  }}
                  disabled={refreshing}
                  title="Atualizar usuarios"
                >
                  {refreshing ? <Loader2 size={16} className="spinIcon" /> : <RefreshCcw size={16} />}
                  <span>{refreshing ? "Atualizando..." : "Atualizar usuarios"}</span>
                </button>
              </div>
            </div>
          </FadeInUp>

          {totalItems === 0 ? (
            <FadeInUp duration={0.28} delay={0.16}>
              <div className="emptyState">
                <p>Nenhum usuario encontrado</p>
              </div>
            </FadeInUp>
          ) : (
            <>
              <FadeInUp duration={0.28} delay={0.16}>
                <div className="usersTableContainer">
                  <table className="usersTable">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Usuario</th>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th>Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((usuario, idx) => (
                        (() => {
                          const isEffectivelyOnline = isPresenceStillOnline(
                            usuario.isOnline,
                            usuario.lastSeenAt,
                            presenceNow
                          );

                          return (
                            <tr
                              key={usuario.id}
                              className="userRow userRowAnimated"
                              style={{ animationDelay: `${0.16 + idx * 0.04}s` }}
                            >
                              <td data-label="Nome">{usuario.nome}</td>
                              <td data-label="Usuario" className="usuarioCell">
                                {usuario.email ?? usuario.usuario}
                              </td>
                              <td data-label="Tipo">
                                <span className={`roleTag role-${usuario.role}`}>
                                  {roleLabel(usuario.role)}
                                </span>
                              </td>
                              <td data-label="Status">
                                <div className="presenceCell">
                                  <span className={`presenceBadge ${isEffectivelyOnline ? "isOnline" : "isOffline"}`}>
                                    <span className="presenceDot" />
                                    {isEffectivelyOnline ? "Online" : "Offline"}
                                  </span>
                                  <small className="presenceMeta">
                                    {isEffectivelyOnline
                                      ? "Ativo agora"
                                      : usuario.lastSeenAt
                                        ? `Visto em ${lastSeenFormatter.format(new Date(usuario.lastSeenAt))}`
                                        : "Sem atividade recente"}
                                  </small>
                                </div>
                              </td>
                              <td data-label="Acoes" className="actionCell">
                                <AnimatedButton
                                  className="btnEdit"
                                  onClick={() => abrirEditar(usuario)}
                                  title="Editar usuario"
                                >
                                  <Pencil size={16} />
                                </AnimatedButton>
                                <AnimatedButton
                                  className="btnDelete"
                                  onClick={() => setUsuarioDeletar(usuario)}
                                  title="Deletar usuario"
                                >
                                  <Trash2 size={16} />
                                </AnimatedButton>
                              </td>
                            </tr>
                          );
                        })()
                      ))}
                    </tbody>
                  </table>
                </div>
              </FadeInUp>

              <FadeInUp duration={0.28} delay={0.24}>
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
            footer={(
              <div className="editModalFooter">
                <div className="editModalHint">Confira os dados antes de salvar.</div>
                <div className="editModalActions">
                  <button
                    type="button"
                    className="editModalButton editModalButtonSecondary"
                    onClick={fecharEditar}
                    disabled={salvandoEdicao}
                  >
                    <X size={16} />
                    <span>Cancelar</span>
                  </button>
                  <button
                    type="button"
                    className="editModalButton editModalButtonPrimary"
                    onClick={() => {
                      void salvarEdicao();
                    }}
                    disabled={salvandoEdicao}
                  >
                    {salvandoEdicao ? <Loader2 size={16} className="spinIcon" /> : <Save size={16} />}
                    <span>{salvandoEdicao ? "Salvando..." : "Salvar alteracoes"}</span>
                  </button>
                </div>
              </div>
            )}
          >
            <div className="formGroup">
              <span className="formLabel">Nome</span>
              <input
                type="text"
                className="formInput"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Digite o nome"
              />
            </div>

            <div className="formGroup">
              <span className="formLabel">E-mail</span>
              <input
                type="email"
                className="formInput"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Digite o e-mail"
              />
            </div>

            <div className="formGroup">
              <span className="formLabel">Tipo</span>
              <p style={{ margin: "8px 0", fontSize: "14px" }}>
                {editandoUsuario?.role ? roleLabel(editandoUsuario.role) : "-"}
              </p>
              <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                Alterar o tipo de usuario requer alteracao manual no banco de dados
              </small>
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
