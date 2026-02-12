import React from "react";
import { createPortal } from "react-dom";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { getRole } from "../auth/auth";
import {
  alterarMinhaSenha,
  obterUsuarioAtual,
  listarTurmas,
  type UserMe,
  type Turma,
} from "../services/api";
import {
  FadeInUp,
  AnimatedButton,
  AnimatedToast,
  AnimatedSelect,
  AnimatedToggle,
} from "../components/animate-ui";
import {
  Users,
  Flame,
  BookOpen,
  User as UserIcon,
  Laptop,
  Monitor,
  CheckCircle,
  XCircle,
  Circle,
  Loader2,
} from "lucide-react";
import "./Perfil.css";

type UserStats = {
  exerciciosFeitos: number;
  notaMedia: number;
  turmasInscritas: number;
  diasSequencia: number;
};

type ProfileSettings = {
  emailNotificacoes: boolean;
  pushNotificacoes: boolean;
  perfilPublico: boolean;
  modoCompacto: boolean;
  temaPreferido: "sistema" | "claro" | "escuro";
};

const SETTINGS_KEY = "perfil_settings";
const iconLabel = (icon: React.ReactNode, label: string) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    {icon}
    <span>{label}</span>
  </span>
);

const defaultSettings: ProfileSettings = {
  emailNotificacoes: true,
  pushNotificacoes: true,
  perfilPublico: false,
  modoCompacto: false,
  temaPreferido: "sistema",
};

function loadSettings(): ProfileSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

export default function PerfilPage() {
  const roleLocal = getRole();

  // Estados
  const [modalSenha, setModalSenha] = React.useState(false);
  const [userInfo, setUserInfo] = React.useState<UserMe | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [savingSenha, setSavingSenha] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [feedback, setFeedback] = React.useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [toastMsg, setToastMsg] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [formData, setFormData] = React.useState({
    nome: "",
    usuario: "",
  });
  const [senhaAtual, setSenhaAtual] = React.useState("");
  const [novaSenha, setNovaSenha] = React.useState("");
  const [confirmarSenha, setConfirmarSenha] = React.useState("");
  const [settings, setSettings] = React.useState<ProfileSettings>(() => loadSettings());
  const [turmas, setTurmas] = React.useState<Turma[]>([]);

  const role = userInfo?.role ?? roleLocal;
  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErro(null);
        const data = await obterUsuarioAtual();
        setUserInfo(data);
        setFormData({
          nome: data.nome,
          usuario: data.usuario,
        });
        localStorage.setItem("nome", data.nome ?? "");

        // Carregar turmas
        try {
          const todasTurmas = await listarTurmas();
          if (role === "aluno" || data.role === "aluno") {
            // Alunos veem apenas suas turmas
            setTurmas(todasTurmas);
          } else if (role === "professor" || data.role === "professor") {
            // Professores veem apenas as turmas que eles têm aula
            const turmasDoProf = todasTurmas.filter((t) => t.professorId === data.id);
            setTurmas(turmasDoProf);
          } else {
            // Admin vê todas
            setTurmas(todasTurmas);
          }
        } catch (e) {
          console.error("Erro ao carregar turmas:", e);
        }
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao carregar usuário");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Estatísticas
  const stats: UserStats = {
    exerciciosFeitos: 41,
    notaMedia: 8.5,
    turmasInscritas: 2,
    diasSequencia: 12,
  };


  const handleChangeSenha = async () => {
    console.log("handleChangeSenha iniciado");

    // Validações
    if (!senhaAtual?.trim()) {
      setFeedback({ type: "error", message: "Preencha a senha atual." });
      return;
    }
    if (!novaSenha?.trim()) {
      setFeedback({ type: "error", message: "Preencha a nova senha." });
      return;
    }
    if (!confirmarSenha?.trim()) {
      setFeedback({ type: "error", message: "Preencha a confirmação da senha." });
      return;
    }
    if (novaSenha.trim().length < 6) {
      setFeedback({ type: "error", message: "A nova senha deve ter ao menos 6 caracteres." });
      return;
    }
    if (novaSenha.trim() !== confirmarSenha.trim()) {
      setFeedback({ type: "error", message: "As senhas não coincidem." });
      return;
    }

    setSavingSenha(true);
    setFeedback(null);

    try {
      console.log("Enviando requisição...");
      const result = await alterarMinhaSenha({
        senhaAtual: senhaAtual.trim(),
        novaSenha: novaSenha.trim()
      });

      console.log("Sucesso:", result);
      closeSenhaModal();
      setFeedback({
        type: "success",
        message: result.message || "Senha alterada com sucesso!"
      });

    } catch (error) {
      console.error("Erro:", error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao alterar senha",
      });
    } finally {
      setSavingSenha(false);
    }
  };

  const closeSenhaModal = () => {
    setModalSenha(false);
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmarSenha("");
  };

  const handleSaveSettings = () => {
    try {
      setSavingSettings(true);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      // Disparar evento customizado para atualizar tema na mesma aba
      window.dispatchEvent(
        new CustomEvent('perfil-settings-changed', { detail: settings })
      );

      setFeedback({ type: "success", message: "Configurações salvas com sucesso!" });
    } catch {
      setFeedback({ type: "error", message: "Não foi possível salvar as configurações." });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = () => {
    setSettings(defaultSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
    setFeedback({ type: "success", message: "Configurações restauradas." });
  };


  if (loading) {
    return (
      <DashboardLayout title="Perfil" subtitle="Carregando...">
        <div style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
          Carregando dados...
        </div>
      </DashboardLayout>
    );
  }

  if (erro) {
    return (
      <DashboardLayout title="Perfil" subtitle="Erro">
        <div style={{ textAlign: "center", padding: "24px", color: "var(--red)" }}>
          Erro ao carregar usuário: {erro}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Perfil" subtitle="Gerencie suas informações pessoais">
      <FadeInUp duration={0.28}>
        <div className="perfilContainer">
          <AnimatedToast
            message={toastMsg?.msg || null}
            type={toastMsg?.type || 'success'}
            duration={3000}
            onClose={() => setToastMsg(null)}
          />

          {feedback && (
            <div className={`perfilMessage ${feedback.type}`}>
              <span>{feedback.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}</span>
              <span>{feedback.message}</span>
            </div>
          )}

          {/* SECTION 1: INFORMAÇÕES BÁSICAS */}
          <section className="perfilCard">
            <div className="cardHeader">
              <h2>Minhas Informações</h2>
            </div>

            <div className="infoGrid">
              <div className="infoItem">
                <div className="infoLabel">Nome</div>
                <div className="infoValue">{formData.nome}</div>
              </div>
              <div className="infoItem">
                <div className="infoLabel">Usuário</div>
                <div className="infoValue">@{formData.usuario}</div>
              </div>
              <div className="infoItem">
                <div className="infoLabel">Função</div>
                <div className="infoValue">
                  {role === "admin"
                    ? "Administrador"
                    : role === "professor"
                      ? "Professor"
                      : "Aluno"}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: SEGURANÇA */}
          <section className="perfilCard">
            <div className="cardHeader">
              <h2>Segurança</h2>
            </div>

            <div className="securityContent">
              <div className="securityItem">
                <div className="securityInfo">
                  <h3>Alterar Senha</h3>
                  <p>Mantenha sua conta segura com uma senha forte</p>
                </div>
                <AnimatedButton className="altBtn" onClick={() => setModalSenha(true)}>
                  Alterar
                </AnimatedButton>
              </div>
            </div>
          </section>

          {/* SECTION 3: CONFIGURAÇÕES */}
          <section className="perfilCard">
            <div className="cardHeader">
              <h2>Configurações</h2>
            </div>

            <div className="settingsGrid">
              <div className="settingsItem">
                <div className="settingsInfo">
                  <h3>Notificações por e-mail</h3>
                  <p>Receba alertas sobre novas atividades e avisos</p>
                </div>
                <AnimatedToggle
                  checked={settings.emailNotificacoes}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      emailNotificacoes: checked,
                    }))
                  }
                />
              </div>

              <div className="settingsItem">
                <div className="settingsInfo">
                  <h3>Notificações no app</h3>
                  <p>Mostre avisos dentro do portal quando houver novidades</p>
                </div>
                <AnimatedToggle
                  checked={settings.pushNotificacoes}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      pushNotificacoes: checked,
                    }))
                  }
                />
              </div>



              <div className="settingsItem">
                <div className="settingsInfo">
                  <h3>Modo compacto</h3>
                  <p>Reduza o espaçamento para ver mais conteúdo</p>
                </div>
                <AnimatedToggle
                  checked={settings.modoCompacto}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      modoCompacto: checked,
                    }))
                  }
                />
              </div>

              <div className="settingsItem">
                <div className="settingsInfo">
                  <h3>Tema preferido</h3>
                  <p>Escolha como prefere visualizar o portal</p>
                </div>
                <AnimatedSelect
                  className="settingsSelect"
                  value={settings.temaPreferido}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      temaPreferido: e.target.value as ProfileSettings["temaPreferido"],
                    }))
                  }
                >
                  <option value="sistema">Sistema</option>
                  <option value="claro">Claro</option>
                  <option value="escuro">Escuro</option>
                </AnimatedSelect>
              </div>
            </div>

            <div className="settingsActions">
              <AnimatedButton className="btnCancel" onClick={handleResetSettings}>
                Restaurar padrões
              </AnimatedButton>
              <AnimatedButton
                className="btnSalvar"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                loading={savingSettings}
              >
                {savingSettings ? "Salvando..." : "Salvar configurações"}
              </AnimatedButton>
            </div>
          </section>

          {/* SECTION 4: ESTATÍSTICAS */}
          <section className="perfilCard">
            <div className="cardHeader">
              <h2>Seu Desempenho</h2>
            </div>

            <div className="statsGrid">
              <div className="statCard">
                <div className="statIcon"><CheckCircle size={18} /></div>
                <div className="statInfo">
                  <div className="statValue">{stats.exerciciosFeitos}</div>
                  <div className="statLabel">Exercícios Feitos</div>
                </div>
              </div>

              <div className="statCard">
                <div className="statIcon">⭐</div>
                <div className="statInfo">
                  <div className="statValue">{stats.notaMedia.toFixed(1)}/10</div>
                  <div className="statLabel">Nota Média</div>
                </div>
              </div>

              <div className="statCard">
                <div className="statIcon"><Users size={18} /></div>
                <div className="statInfo">
                  <div className="statValue">{stats.turmasInscritas}</div>
                  <div className="statLabel">Turmas Inscritas</div>
                </div>
              </div>

              <div className="statCard">
                <div className="statIcon"><Flame size={18} /></div>
                <div className="statInfo">
                  <div className="statValue">{stats.diasSequencia}</div>
                  <div className="statLabel">Dias de Sequência</div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: TURMAS */}
          <section className="perfilCard">
            <div className="cardHeader">
              <h2>Turmas Inscritas</h2>
            </div>

            {turmas.length === 0 ? (
              <div className="emptyState">
                <div className="emptyIcon" style={{ display: "inline-flex" }}><BookOpen size={22} /></div>
                <p>Você não está inscrito em nenhuma turma</p>
              </div>
            ) : (
              <div className="turmasList">
                {turmas.map((turma) => (
                  <div key={turma.id} className="turmaItem">
                    <div className="turmaIcon">{turma.tipo === "turma" ? <Users size={16} /> : <UserIcon size={16} />}</div>
                    <div className="turmaInfo">
                      <h3 className="turmaNome">{turma.nome}</h3>
                      <div className="turmaMeta">
                        <span className="badge badgeCategoria">
                          {turma.categoria === "programacao" ? iconLabel(<Laptop size={14} />, "Programação") : iconLabel(<Monitor size={14} />, "Informática")}
                        </span>
                        <span className="badge badgeTipo">
                          {turma.tipo === "turma" ? "Grupo" : "Particular"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* MODAL DE ALTERAR SENHA */}
          {modalSenha && createPortal(
            <div className="modalOverlay" onClick={closeSenhaModal}>
              <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <h3>Alterar Senha</h3>

                <div className="formGroup">
                  <label className="formLabel">Senha Atual</label>
                  <input
                    type="password"
                    placeholder="Digite sua senha atual"
                    className="formInput"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <div className="formGroup">
                  <label className="formLabel">Nova Senha</label>
                  <input
                    type="password"
                    placeholder="Digite sua nova senha"
                    className="formInput"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    autoComplete="new-password"
                  />
                  {novaSenha && novaSenha.length < 6 && (
                    <small className="formHint error">{iconLabel(<XCircle size={12} />, "Mínimo 6 caracteres")}</small>
                  )}
                  {novaSenha && novaSenha.length >= 6 && (
                    <small className="formHint success">{iconLabel(<CheckCircle size={12} />, "Senha forte")}</small>
                  )}
                </div>

                <div className="formGroup">
                  <label className="formLabel">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    placeholder="Confirme sua nova senha"
                    className="formInput"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    autoComplete="new-password"
                  />
                  {confirmarSenha && novaSenha === confirmarSenha && (
                    <small className="formHint success">{iconLabel(<CheckCircle size={12} />, "Senhas coincidem")}</small>
                  )}
                  {confirmarSenha && novaSenha !== confirmarSenha && (
                    <small className="formHint error">{iconLabel(<XCircle size={12} />, "As senhas não coincidem")}</small>
                  )}
                </div>

                <div style={{ marginTop: "16px", padding: "12px", borderRadius: "8px", backgroundColor: "rgba(0,0,0,0.05)", border: "1px solid var(--line)" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Requisitos:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                    <div style={{ color: senhaAtual ? "#16a34a" : "var(--muted)" }}>
                      {senhaAtual ? <CheckCircle size={14} /> : <Circle size={12} />} Senha atual preenchida
                    </div>
                    <div style={{ color: novaSenha && novaSenha.length >= 6 ? "#16a34a" : "var(--muted)" }}>
                      {novaSenha && novaSenha.length >= 6 ? <CheckCircle size={14} /> : <Circle size={12} />} Nova senha com 6+ caracteres
                    </div>
                    <div style={{ color: confirmarSenha && novaSenha === confirmarSenha ? "#16a34a" : "var(--muted)" }}>
                      {confirmarSenha && novaSenha === confirmarSenha ? <CheckCircle size={14} /> : <Circle size={12} />} Confirmação igual
                    </div>
                  </div>
                </div>

                <div className="modalActions">
                  <AnimatedButton
                    type="button"
                    className="btnCancel"
                    onClick={closeSenhaModal}
                  >
                    Cancelar
                  </AnimatedButton>
                  <AnimatedButton
                    type="button"
                    className="btnConfirm"
                    onClick={handleChangeSenha}
                    disabled={savingSenha}
                    loading={savingSenha}
                  >
                    {savingSenha ? iconLabel(<Loader2 size={14} />, "Alterando...") : iconLabel(<CheckCircle size={14} />, "Alterar Senha")}
                  </AnimatedButton>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
