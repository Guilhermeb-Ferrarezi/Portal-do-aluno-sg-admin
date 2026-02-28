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
import "./AdminUsers.css";
import {
  GraduationCap,
  User as UserIcon,
  KeyRound,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";

export default function AdminUsersPage() {
  const [usuarios, setUsuarios] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = React.useState<"todos" | "aluno" | "professor" | "admin">("todos");
  const [busca, setBusca] = React.useState("");

  const [editandoUsuario, setEditandoUsuario] = React.useState<User | null>(null);
  const [editNome, setEditNome] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editarAberto, setEditarAberto] = React.useState(false);

  const [usuarioDeletar, setUsuarioDeletar] = React.useState<User | null>(null);
  const [deletando, setDeletando] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);
  const [totalItems, setTotalItems] = React.useState(0);

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

  const carregarUsuarios = React.useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);

      const response = await listarUsuariosPaginado({
        role: filtroTipo === "todos" ? undefined : filtroTipo,
        q: busca.trim() || undefined,
        page: currentPage,
        limit: itemsPerPage,
      });

      setUsuarios(response.items);
      setTotalItems(response.total);

      if (currentPage > response.pagination.totalPages) {
        setCurrentPage(response.pagination.totalPages);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar usuarios");
    } finally {
      setLoading(false);
    }
  }, [busca, currentPage, filtroTipo, itemsPerPage]);

  React.useEffect(() => {
    void carregarUsuarios();
  }, [carregarUsuarios]);

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
                        <th>Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((usuario, idx) => (
                        <FadeInUp key={usuario.id} duration={0.28} delay={0.16 + idx * 0.04}>
                          <tr className="userRow">
                            <td data-label="Nome">{usuario.nome}</td>
                            <td data-label="Usuario" className="usuarioCell">
                              {usuario.email ?? usuario.usuario}
                            </td>
                            <td data-label="Tipo">
                              <span className={`roleTag role-${usuario.role}`}>
                                {roleLabel(usuario.role)}
                              </span>
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
                        </FadeInUp>
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
            onClose={fecharEditar}
            title="Editar Usuario"
            size="sm"
            footer={(
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <AnimatedButton onClick={fecharEditar}>
                  Cancelar
                </AnimatedButton>
                <AnimatedButton onClick={salvarEdicao}>
                  Salvar Alteracoes
                </AnimatedButton>
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
