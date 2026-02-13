import type { ReactNode } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getName, getRole, getUserId, hasRole } from "../../auth/auth";
import { listarTurmas, logoutWithServer, type Turma } from "../../services/api";
import ProfilePopup from "../ProfilePopup";
import SettingsOverlay from "../SettingsOverlay";
import {
  GraduationCap,
  X,
  Home,
  Compass,
  PenLine,
  FileText,
  Play,
  School,
  ClipboardList,
  Users,
  User,
  Plus,
  Package,
  KeyRound,
  BarChart3,
  Bell,
  Settings,
  Menu,
  LogOut,
  Laptop,
  Monitor,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
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
  const [profilePopupOpen, setProfilePopupOpen] = React.useState(false);
  const sbBottomRef = React.useRef<HTMLDivElement>(null);

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
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const isCreateUser = location.pathname === "/dashboard/criar-usuario";
  const isAdminUsers = location.pathname === "/dashboard/usuarios";
  const isActivityLogs = location.pathname === "/dashboard/logs";

  function handleLogout() {
    void logoutWithServer().finally(() => {
      navigate("/login", { replace: true });
    });
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
              <GraduationCap size={20} />
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
            <X size={18} />
          </button>
        </div>

        <nav className="sbNav">
          <Link className={`sbItem ${isDashboard ? "active" : ""}`} to="/dashboard">
            <span className="sbIcon" aria-hidden="true">
              <Home size={18} />
            </span>
            Dashboard
          </Link>
          <Link className={`sbItem ${isTrilha ? "active" : ""}`} to="/dashboard/trilha">
            <span className="sbIcon" aria-hidden="true">
              <Compass size={18} />
            </span>
            Trilha do Curso
          </Link>
          <Link className={`sbItem ${isExercicios ? "active" : ""}`} to="/dashboard/exercicios">
            <span className="sbIcon" aria-hidden="true">
              <PenLine size={18} />
            </span>
            Exercícios
          </Link>
          <Link className={`sbItem ${isMateriais ? "active" : ""}`} to="/dashboard/materiais">
            <span className="sbIcon" aria-hidden="true">
              <FileText size={18} />
            </span>
            Materiais
          </Link>
          <Link className={`sbItem ${isVideoaulas ? "active" : ""}`} to="/dashboard/videoaulas">
            <span className="sbIcon" aria-hidden="true">
              <Play size={18} />
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
              <span className="sbIcon" aria-hidden="true">
                <School size={18} />
              </span>
              <span>Turmas</span>
            </button>
          ) : null}

          {canCreateUser && (
            <div className="sideSection">
              <button
                className="sideSectionHeader"
                onClick={() => setExpandirTurmas(!expandirTurmas)}
              >
                <span className="sbIcon" aria-hidden="true">
                  <ClipboardList size={18} />
                </span>
                <span>Minhas Turmas</span>
                <span className="sideExpand" aria-hidden="true">
                  {expandirTurmas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
                            {turma.tipo === "turma" ? <Users size={14} /> : <User size={14} />}
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
                    <span aria-hidden="true" style={{ display: "inline-flex" }}>
                      <Plus size={14} />
                    </span>{" "}
                    Criar turma
                  </button>
                </div>
              )}
            </div>
          )}

          {canCreateUser && (
            <>
              <Link className={`sbItem ${isTemplates ? "active" : ""}`} to="/dashboard/templates">
                <span className="sbIcon" aria-hidden="true">
                  <Package size={18} />
                </span>
                Templates
              </Link>

              <Link className={`sbItem ${isAdminUsers ? "active" : ""}`} to="/dashboard/usuarios">
                <span className="sbIcon" aria-hidden="true">
                  <KeyRound size={18} />
                </span>
                Gerenciar Usuários
              </Link>

              <Link className={`sbItem ${isActivityLogs ? "active" : ""}`} to="/dashboard/logs">
                <span className="sbIcon" aria-hidden="true">
                  <BarChart3 size={18} />
                </span>
                Logs de Atividade
              </Link>

              <Link
                className={`sbItem ${isCreateUser ? "active" : ""}`}
                to="/dashboard/criar-usuario"
              >
                <span className="sbIcon" aria-hidden="true">
                  <Plus size={18} />
                </span>
                Criar usuário
              </Link>
            </>
          )}
        </nav>

        <div className="sbBottom" ref={sbBottomRef}>
          <div className="sbUser">
            <button
              className="sbUserBtn"
              type="button"
              onClick={() => setProfilePopupOpen((v) => !v)}
              aria-label="Ver perfil"
            >
              <div className="sbAvatar">{name.slice(0, 1).toUpperCase()}</div>
              <div className="sbUserText">
                <div className="sbUserName">{name}</div>
                <div className="sbUserSub">{roleLabel(role)}</div>
              </div>
            </button>

            <button
              className="sbDots"
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Configurações"
              aria-label="Configurações"
            >
              <Settings size={16} />
            </button>

            <button
              className="sbDots"
              type="button"
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>

          {profilePopupOpen && (
            <ProfilePopup
              name={name}
              role={role}
              anchorRef={sbBottomRef}
              onClose={() => setProfilePopupOpen(false)}
              onOpenSettings={() => {
                setProfilePopupOpen(false);
                setSettingsOpen(true);
              }}
            />
          )}
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
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div>
            <h1 className="pageTitle">{title}</h1>
            <p className="pageSub">{subtitle ?? `Bem-vindo de volta, ${name}`}</p>
          </div>

          <div className="topActions">
            <button className="iconBtn" aria-label="Notificações" type="button">
              <Bell size={18} /> <span className="dot" />
            </button>

          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {/* SETTINGS OVERLAY */}
      <SettingsOverlay isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

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
                      {turma.tipo === "turma" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Users size={14} /> Turma (Grupo)
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <User size={14} /> Turma Particular
                        </span>
                      )}
                      {turma.categoria && (
                        <>{" - "}{turma.categoria === "programacao"
                          ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <Laptop size={14} /> Programação
                            </span>
                          )
                          : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <Monitor size={14} /> Informática
                            </span>
                          )}</>
                      )}
                    </div>
                  </div>
                  <span className="turmaSelectorArrow" aria-hidden="true"><ArrowRight size={16} /></span>
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
