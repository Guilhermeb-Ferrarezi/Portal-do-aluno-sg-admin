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
  listarAlunos,
  listarProfessores,
  listarAdmins,
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
} from "lucide-react";

export default function AdminUsersPage() {
  const [usuarios, setUsuarios] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = React.useState<"todos" | "aluno" | "professor" | "admin">("todos");
  const [busca, setBusca] = React.useState("");

  // Estados do modal de edição
  const [editandoUsuario, setEditandoUsuario] = React.useState<User | null>(null);
  const [editNome, setEditNome] = React.useState("");
  const [editUsuario, setEditUsuario] = React.useState("");
  const [editarAberto, setEditarAberto] = React.useState(false);

  // Estados para deletar
  const [usuarioDeletar, setUsuarioDeletar] = React.useState<User | null>(null);
  const [deletando, setDeletando] = React.useState(false);

  // Estados para feedback
  const [feedback, setFeedback] = React.useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);
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

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Carregar usuários ao montar
  React.useEffect(() => {
    carregarUsuarios();
  }, []);

  // Auto-dismiss feedback após 3 segundos
  React.useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const carregarUsuarios = async () => {
    try {
      setLoading(true);
      setErro(null);

      const [alunos, professores, admins] = await Promise.all([
        listarAlunos(),
        listarProfessores(),
        listarAdmins(),
      ]);

      // Adicionar role aos usuarios
      const alunosComRole: User[] = alunos.map(a => ({ ...a, role: "aluno" }));
      const professoresComRole: User[] = professores.map(p => ({ ...p, role: "professor" }));
      const adminsComRole: User[] = admins.map(ad => ({ ...ad, role: "admin" }));

      setUsuarios([...adminsComRole, ...professoresComRole, ...alunosComRole]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  // Filtrar usuários
  const usuariosFiltrados = usuarios.filter((u) => {
    const matchTipo = filtroTipo === "todos" || u.role === filtroTipo;
    const matchBusca =
      busca === "" ||
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.usuario.toLowerCase().includes(busca.toLowerCase());

    return matchTipo && matchBusca;
  });

  const totalItems = usuariosFiltrados.length;

  // Paginação
  const startIdx = (currentPage - 1) * itemsPerPage;
  const usuariosPaginados = usuariosFiltrados.slice(
    startIdx,
    startIdx + itemsPerPage
  );

  const abrirEditar = (usuario: User) => {
    setEditandoUsuario(usuario);
    setEditNome(usuario.nome);
    setEditUsuario(usuario.usuario);
    setEditarAberto(true);
  };

  const fecharEditar = () => {
    setEditarAberto(false);
    setEditandoUsuario(null);
    setEditNome("");
    setEditUsuario("");
  };

  const salvarEdicao = async () => {
    if (!editandoUsuario) return;

    if (!editNome.trim() || !editUsuario.trim()) {
      setFeedback({
        tipo: "erro",
        mensagem: "Nome e usuário são obrigatórios",
      });
      return;
    }

    try {
      // Chamar API para atualizar usuário
      await atualizarUsuario(editandoUsuario.id, {
        nome: editNome.trim(),
        usuario: editUsuario.trim(),
      });

      // Atualizar na lista local
      setUsuarios(
        usuarios.map((u) =>
          u.id === editandoUsuario.id
            ? { ...u, nome: editNome, usuario: editUsuario }
            : u
        )
      );

      fecharEditar();
      setFeedback({
        tipo: "sucesso",
        mensagem: "Usuário atualizado com sucesso!",
      });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        mensagem: err instanceof Error ? err.message : "Erro ao atualizar usuário",
      });
    }
  };

  const confirmarDeletar = async () => {
    if (!usuarioDeletar) return;

    try {
      setDeletando(true);

      // Chamar API para deletar usuário
      await deletarUsuario(usuarioDeletar.id);

      // Remover da lista local
      setUsuarios(usuarios.filter((u) => u.id !== usuarioDeletar.id));
      setUsuarioDeletar(null);

      setFeedback({
        tipo: "sucesso",
        mensagem: "Usuário deletado com sucesso!",
      });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        mensagem: err instanceof Error ? err.message : "Erro ao deletar usuário",
      });
    } finally {
      setDeletando(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Gerenciar Usuários"
        subtitle="Gerencie alunos, professores e admins"
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p>Carregando usuários...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (erro) {
    return (
      <DashboardLayout
        title="Gerenciar Usuários"
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
      title="Gerenciar Usuários"
      subtitle="Gerencie alunos, professores e admins"
    >
      <FadeInUp duration={0.28}>
        <div className="adminUsersContainer">
          {/* FEEDBACK DE NOTIFICAÇÃO */}
          <AnimatedToast
            message={feedback?.mensagem || null}
            type={feedback?.tipo === "sucesso" ? "success" : "error"}
            duration={3000}
            onClose={() => setFeedback(null)}
          />

          {/* HEADER COM FILTROS */}
          <FadeInUp duration={0.28} delay={0.08}>
            <div className="adminHeader">
              <div className="filterRow">
                {/* Busca */}
                <div className="searchBox">
                  <input
                    type="text"
                    placeholder="Buscar por nome ou usuário..."
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="searchInput"
                  />
                </div>

                {/* Filtro de Tipo */}
                <AnimatedSelect
                  value={filtroTipo}
                  onChange={(e) => {
                    setFiltroTipo(e.target.value as any);
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

          {/* TABELA DE USUÁRIOS */}
          {usuariosFiltrados.length === 0 ? (
            <FadeInUp duration={0.28} delay={0.16}>
              <div className="emptyState">
                <p>Nenhum usuário encontrado</p>
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
                        <th>Usuário</th>
                        <th>Tipo</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosPaginados.map((usuario, idx) => (
                        <FadeInUp key={usuario.id} duration={0.28} delay={0.16 + idx * 0.04}>
                          <tr>
                            <td>{usuario.nome}</td>
                            <td className="usuarioCell">{usuario.usuario}</td>
                            <td>
                              <span className={`roleTag role-${usuario.role}`}>
                                {roleLabel(usuario.role)}
                              </span>
                            </td>
                            <td className="actionCell">
                              <AnimatedButton
                                className="btnEdit"
                                onClick={() => abrirEditar(usuario)}
                                title="Editar usuário"
                              >
                                <Pencil size={16} />
                              </AnimatedButton>
                              <AnimatedButton
                                className="btnDelete"
                                onClick={() => setUsuarioDeletar(usuario)}
                                title="Deletar usuário"
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

          {/* MODAL DE EDIÇÃO */}
          <Modal
            isOpen={editarAberto && !!editandoUsuario}
            onClose={fecharEditar}
            title="Editar Usuário"
            size="sm"
            footer={
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <AnimatedButton onClick={fecharEditar}>
                  Cancelar
                </AnimatedButton>
                <AnimatedButton onClick={salvarEdicao}>
                  Salvar Alterações
                </AnimatedButton>
              </div>
            }
          >
            <div className="formGroup">
              <label className="formLabel">Nome</label>
              <input
                type="text"
                className="formInput"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Digite o nome"
              />
            </div>

            <div className="formGroup">
              <label className="formLabel">Usuário</label>
              <input
                type="text"
                className="formInput"
                value={editUsuario}
                onChange={(e) => setEditUsuario(e.target.value)}
                placeholder="Digite o usuário"
              />
            </div>

            <div className="formGroup">
              <label className="formLabel">Tipo</label>
              <p style={{ margin: "8px 0", fontSize: "14px" }}>
                {editandoUsuario?.role ? roleLabel(editandoUsuario.role) : "-"}
              </p>
              <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                Alterar o tipo de usuário requer alteração manual no banco de dados
              </small>
            </div>
          </Modal>

          {/* MODAL DE CONFIRMAÇÃO DE DELEÇÃO */}
          <ConfirmDialog
            isOpen={!!usuarioDeletar}
            onClose={() => setUsuarioDeletar(null)}
            onConfirm={confirmarDeletar}
            title="Deletar Usuário"
            message={`Tem certeza que deseja deletar o usuário "${usuarioDeletar?.nome}"? Esta ação não pode ser desfeita.`}
            confirmText="Deletar"
            cancelText="Cancelar"
            isLoading={deletando}
            isDangerous={true}
          />
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
