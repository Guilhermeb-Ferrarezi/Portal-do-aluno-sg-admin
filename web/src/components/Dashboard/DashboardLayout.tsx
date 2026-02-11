import type { ReactNode } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getName, getRole, getUserId, hasRole, logout } from "../../auth/auth";
import { listarTurmas, type Turma } from "../../services/api";
import "./Dashboard.css";

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function roleLabel(role: string | null) {
  if (role === "admin") return "Administrador";
  if (role === "professor") return "Professor";
  return "Aluno";
}

export default function DashboardLayout({
  title,
  subtitle,
  children,
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const canCreateUser = hasRole(["admin"]);
  const name = getName() ?? "Aluno";
  const role = getRole();
  const userId = getUserId();
  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [expandirTurmas, setExpandirTurmas] = React.useState(false);
  const [modalSelecionarTurmaAberto, setModalSelecionarTurmaAberto] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    // Load turmas for admin/professor to manage, and for alunos to view their own
    listarTurmas()
      .then(setTurmas)
      .catch((e) => console.error("Erro ao carregar turmas:", e));
  }, []);

  const isDashboard = location.pathname === "/dashboard";
  const isExercicios = location.pathname === "/dashboard/exercicios";
  const isTemplates = location.pathname === "/dashboard/templates";
  const isTrilha = location.pathname === "/dashboard/trilha";
  const isMateriais = location.pathname === "/dashboard/materiais";
  const isVideoaulas = location.pathname === "/dashboard/videoaulas";
  const isPerfil = location.pathname === "/dashboard/perfil";
  const isCreateUser = location.pathname === "/dashboard/criar-usuario";
  const isAdminUsers = location.pathname === "/dashboard/usuarios";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const turmasVinculadas =
    role === "admin" || role === "professor"
      ? userId
        ? turmas.filter((turma) => turma.professorId === userId)
        : []
      : turmas;

  function handleMinhasTurmas() {
    if (role === "aluno") {
      if (turmas.length === 0) {
        navigate("/dashboard");
      } else if (turmas.length === 1) {
        navigate(`/dashboard/turmas/${turmas[0].id}`);
      } else {
        // 2+ turmas - abrir modal de seleção
        setModalSelecionarTurmaAberto(true);
      }
    } else {
      navigate("/dashboard/turmas");
    }
  }

  return (
    <div className="appShell">
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sbTop">
          <div className="sbBrand">
            <div className="sbLogo" aria-hidden="true">
              🎓
            </div>
            <div className="sbBrandText">
              <div className="sbBrandName">Santos Tech</div>
              <div className="sbBrandSub">Portal do Aluno</div>
            </div>
          </div>
          <button
            className="sbCloseBtn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

        <nav className="sbNav">
          <Link className={`sbItem ${isDashboard ? "active" : ""}`} to="/dashboard">
            <span className="sbIcon" aria-hidden="true">
              🏠
            </span>
            Dashboard
          </Link>
          <Link className={`sbItem ${isTrilha ? "active" : ""}`} to="/dashboard/trilha">
            <span className="sbIcon" aria-hidden="true">
              🧭
            </span>
            Trilha do Curso
          </Link>
          <Link className={`sbItem ${isExercicios ? "active" : ""}`} to="/dashboard/exercicios">
            <span className="sbIcon" aria-hidden="true">
              ✍️
            </span>
            Exercícios
          </Link>
          <Link className={`sbItem ${isMateriais ? "active" : ""}`} to="/dashboard/materiais">
            <span className="sbIcon" aria-hidden="true">
              📄
            </span>
            Materiais
          </Link>
          <Link className={`sbItem ${isVideoaulas ? "active" : ""}`} to="/dashboard/videoaulas">
            <span className="sbIcon" aria-hidden="true">
              ▶️
            </span>
            Videoaulas Bônus
          </Link>
          {/* Turmas e Minhas Turmas */}
          {(role === "admin" || role === "professor" || turmas.length > 0) ? (
            <button
              className="sbItem"
              onClick={handleMinhasTurmas}
              style={{ textAlign: "left" }}
            >
              <span className="sbIcon" aria-hidden="true">🏫</span>
              <span>Turmas</span>
            </button>
          ) : null}

          {canCreateUser && (
            <div className="sideSection">
              <button
                className="sideSectionHeader"
                onClick={() => setExpandirTurmas(!expandirTurmas)}
              >
                <span className="sbIcon" aria-hidden="true">📋</span>
                <span>Minhas Turmas</span>
                <span className="sideExpand" aria-hidden="true">
                  {expandirTurmas ? "▼" : "▶"}
                </span>
              </button>

              {expandirTurmas && (
                <div className="sideSectionContent">
                  {turmasVinculadas.length > 0 ? (
                    <div className="turmasListSide">
                      {turmasVinculadas.map((turma) => (
                        <button
                          key={turma.id}
                          className="sideTurmaItem"
                          onClick={() => navigate(`/dashboard/turmas/${turma.id}`)}
                        >
                          <span className="sideTurmaName">{turma.nome}</span>
                          <span className="sideTurmaBadge">
                            {turma.tipo === "turma" ? "👥" : "👤"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="sideSectionEmpty">Nenhuma turma vinculada a você</div>
                  )}

                  <button
                    className="sideCreateTurmaBtn"
                    onClick={() => navigate("/dashboard/turmas")}
                  >
                    <span aria-hidden="true">➕</span> Criar turma
                  </button>
                </div>
              )}
            </div>
          )}

          <Link className={`sbItem ${isPerfil ? "active" : ""}`} to="/dashboard/perfil">
            <span className="sbIcon" aria-hidden="true">
              👤
            </span>
            Perfil
          </Link>

          {canCreateUser && (
            <>
              <Link className={`sbItem ${isTemplates ? "active" : ""}`} to="/dashboard/templates">
                <span className="sbIcon" aria-hidden="true">
                  📦
                </span>
                Templates
              </Link>

              <Link className={`sbItem ${isAdminUsers ? "active" : ""}`} to="/dashboard/usuarios">
                <span className="sbIcon" aria-hidden="true">
                  🔑
                </span>
                Gerenciar Usuários
              </Link>

              <Link
                className={`sbItem ${isCreateUser ? "active" : ""}`}
                to="/dashboard/criar-usuario"
              >
                <span className="sbIcon" aria-hidden="true">
                  ➕
                </span>
                Criar usuário
              </Link>
            </>
          )}
        </nav>

        <div className="sbBottom">
          <div className="sbUser">
            <div className="sbAvatar">{name.slice(0, 1).toUpperCase()}</div>
            <div className="sbUserText">
              <div className="sbUserName">{name}</div>
              <div className="sbUserSub">{roleLabel(role)}</div>
            </div>

            <button
              className="sbDots"
              type="button"
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair"
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay para fechar sidebar em mobile */}
      {sidebarOpen && (
        <div
          className="sidebarOverlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* MAIN */}
      <div className="main">
        <header className="topbar">
          <button
            className="hamburger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Abrir menu"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>

          <div>
            <h1 className="pageTitle">{title}</h1>
            <p className="pageSub">{subtitle ?? `Bem-vindo de volta, ${name}`}</p>
          </div>

          <div className="topActions">
            <button className="iconBtn" aria-label="Notificações" type="button">
              🔔 <span className="dot" />
            </button>
            <button
              className="iconBtn"
              aria-label="Configurações"
              type="button"
              onClick={() => navigate("/dashboard/perfil")}
            >
              ⚙️
            </button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {/* MODAL SELEÇÃO DE TURMA */}
      {modalSelecionarTurmaAberto && createPortal(
        <div className="modalOverlay" onClick={() => setModalSelecionarTurmaAberto(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Selecione sua turma</h3>
            <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
              Você está inscrito em {turmas.length} turmas
            </p>

            <div className="turmasSelectorList">
              {turmas.map((turma) => (
                <button
                  key={turma.id}
                  className="turmaSelectorItem"
                  onClick={() => {
                    setModalSelecionarTurmaAberto(false);
                    navigate(`/dashboard/turmas/${turma.id}`);
                  }}
                >
                  <div className="turmaSelectorInfo">
                    <div className="turmaSelectorName">{turma.nome}</div>
                    <div className="turmaSelectorMeta">
                      {turma.tipo === "turma" ? "👥 Turma (Grupo)" : "👤 Turma Particular"}
                      {turma.categoria && (
                        <> • {turma.categoria === "programacao" ? "💻 Programação" : "🖥️ Informática"}</>
                      )}
                    </div>
                  </div>
                  <span className="turmaSelectorArrow">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
