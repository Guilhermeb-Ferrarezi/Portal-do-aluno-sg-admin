import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getRole } from "../auth/auth";
import {
  alterarMinhaSenha,
  obterUsuarioAtual,
  listarTurmas,
  todasMinhasSubmissoes,
  type Submissao,
  type UserMe,
  type Turma,
} from "../services/api";
import {
  AnimatedButton,
  AnimatedToast,
  AnimatedSelect,
  AnimatedToggle,
} from "./animate-ui";
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
  Shield,
  Settings,
  BarChart3,
  Palette,
  X,
} from "lucide-react";
import "../pages/Perfil.css";

type SettingsSection = "conta" | "seguranca" | "configuracoes" | "aparencia" | "desempenho" | "turmas";

type UserStats = {
  exerciciosFeitos: number;
  notaMedia: number | null;
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

function roleLabelText(role: string | null | undefined) {
  if (role === "admin") return "Administrador";
  if (role === "professor") return "Professor";
  return "Aluno";
}

function toDayStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function calcularSequencia(submissoes: Submissao[]) {
  const daySet = new Set<number>();
  for (const s of submissoes) {
    const stamp = toDayStamp(s.createdAt);
    if (stamp !== null) daySet.add(stamp);
  }
  if (daySet.size === 0) return 0;
  const diasOrdenados = Array.from(daySet).sort((a, b) => a - b);
  let streak = 1;
  let cursor = diasOrdenados[diasOrdenados.length - 1];
  const oneDay = 24 * 60 * 60 * 1000;
  while (daySet.has(cursor - oneDay)) {
    cursor -= oneDay;
    streak += 1;
  }
  return streak;
}

function calcularStats(submissoes: Submissao[], turmasInscritas: number): UserStats {
  const exercicios = new Set(submissoes.map((s) => s.exercicioId));
  const notas = submissoes
    .map((s) => s.nota)
    .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
  const notaMedia = notas.length ? notas.reduce((acc, n) => acc + n, 0) / notas.length : null;
  const diasSequencia = calcularSequencia(submissoes);
  return {
    exerciciosFeitos: exercicios.size,
    notaMedia,
    turmasInscritas,
    diasSequencia,
  };
}

const NAV_ITEMS: { key: SettingsSection; label: string; icon: React.ReactNode; group: string }[] = [
  { key: "conta", label: "Minha Conta", icon: <UserIcon size={16} />, group: "CONTA" },
  { key: "seguranca", label: "Segurança", icon: <Shield size={16} />, group: "CONTA" },
  { key: "configuracoes", label: "Configurações", icon: <Settings size={16} />, group: "PREFERÊNCIAS" },
  { key: "aparencia", label: "Aparência", icon: <Palette size={16} />, group: "PREFERÊNCIAS" },
  { key: "desempenho", label: "Desempenho", icon: <BarChart3 size={16} />, group: "ATIVIDADE" },
  { key: "turmas", label: "Turmas", icon: <Users size={16} />, group: "ATIVIDADE" },
];

type SettingsOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SettingsOverlay({ isOpen, onClose }: SettingsOverlayProps) {
  const roleLocal = getRole();

  const [activeSection, setActiveSection] = React.useState<SettingsSection>("conta");
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
  const [formData, setFormData] = React.useState({ nome: "", usuario: "" });
  const [senhaAtual, setSenhaAtual] = React.useState("");
  const [novaSenha, setNovaSenha] = React.useState("");
  const [confirmarSenha, setConfirmarSenha] = React.useState("");
  const [settings, setSettings] = React.useState<ProfileSettings>(() => loadSettings());
  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [stats, setStats] = React.useState<UserStats>({
    exerciciosFeitos: 0,
    notaMedia: null,
    turmasInscritas: 0,
    diasSequencia: 0,
  });
  const [statsLoading, setStatsLoading] = React.useState(false);
  const [statsError, setStatsError] = React.useState<string | null>(null);

  const role = userInfo?.role ?? roleLocal;

  React.useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setLoading(true);
        setErro(null);
        setStatsLoading(true);
        setStatsError(null);
        const data = await obterUsuarioAtual();
        setUserInfo(data);
        setFormData({ nome: data.nome, usuario: data.usuario });
        localStorage.setItem("nome", data.nome ?? "");

        try {
          const todasTurmas = await listarTurmas();
          let turmasUsuario = todasTurmas;
          if (data.role === "aluno") {
            turmasUsuario = todasTurmas;
          } else if (data.role === "professor") {
            turmasUsuario = todasTurmas.filter((t) => t.professorId === data.id);
          } else {
            turmasUsuario = todasTurmas;
          }
          setTurmas(turmasUsuario);
          const submissoes = await todasMinhasSubmissoes();
          setStats(calcularStats(submissoes, turmasUsuario.length));
        } catch (e) {
          console.error("Erro ao carregar turmas:", e);
          setStatsError("Erro ao carregar estatísticas.");
        }
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao carregar usuário");
      } finally {
        setLoading(false);
        setStatsLoading(false);
      }
    })();
  }, [isOpen]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !modalSenha) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, modalSenha, onClose]);

  // Lock body scroll
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  const handleChangeSenha = async () => {
    if (!senhaAtual?.trim()) { setFeedback({ type: "error", message: "Preencha a senha atual." }); return; }
    if (!novaSenha?.trim()) { setFeedback({ type: "error", message: "Preencha a nova senha." }); return; }
    if (!confirmarSenha?.trim()) { setFeedback({ type: "error", message: "Preencha a confirmação da senha." }); return; }
    if (novaSenha.trim().length < 6) { setFeedback({ type: "error", message: "A nova senha deve ter ao menos 6 caracteres." }); return; }
    if (novaSenha.trim() !== confirmarSenha.trim()) { setFeedback({ type: "error", message: "As senhas não coincidem." }); return; }

    setSavingSenha(true);
    setFeedback(null);
    try {
      const result = await alterarMinhaSenha({ senhaAtual: senhaAtual.trim(), novaSenha: novaSenha.trim() });
      closeSenhaModal();
      setFeedback({ type: "success", message: result.message || "Senha alterada com sucesso!" });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erro ao alterar senha" });
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
      window.dispatchEvent(new CustomEvent('perfil-settings-changed', { detail: settings }));
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

  // Group nav items
  const groups = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="settingsOverlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="settingsPanel"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Close button */}
            <button className="settingsCloseBtn" onClick={onClose} aria-label="Fechar configurações">
              <X size={20} />
              <span className="settingsCloseHint">ESC</span>
            </button>

            <AnimatedToast
              message={toastMsg?.msg || null}
              type={toastMsg?.type || 'success'}
              duration={3000}
              onClose={() => setToastMsg(null)}
            />

            {loading ? (
              <div style={{ display: "grid", placeItems: "center", padding: 48, color: "var(--muted)" }}>
                Carregando...
              </div>
            ) : erro ? (
              <div style={{ display: "grid", placeItems: "center", padding: 48, color: "var(--red)" }}>
                Erro ao carregar: {erro}
              </div>
            ) : (
              <div className="settingsLayout">
                {/* LEFT NAV */}
                <nav className="settingsNav">
                  {Object.entries(groups).map(([group, items]) => (
                    <div key={group} className="settingsNavGroup">
                      <div className="settingsNavLabel">{group}</div>
                      {items.map((item) => (
                        <button
                          key={item.key}
                          className={`settingsNavItem ${activeSection === item.key ? "active" : ""}`}
                          onClick={() => setActiveSection(item.key)}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </nav>

                {/* RIGHT CONTENT */}
                <div className="settingsContent">
                  {feedback && (
                    <div className={`perfilMessage ${feedback.type}`} style={{ marginBottom: 16 }}>
                      <span>{feedback.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}</span>
                      <span>{feedback.message}</span>
                    </div>
                  )}

                  {/* MINHA CONTA */}
                  {activeSection === "conta" && (
                    <>
                      <h2 className="settingsSectionTitle">Minha Conta</h2>
                      <div className="profilePreviewCard">
                        <div className="profilePreviewBanner" />
                        <div className="profilePreviewBody">
                          <div className="profilePreviewAvatarWrap">
                            <div className="profilePreviewAvatar">
                              {formData.nome.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="profilePreviewStatus" />
                          </div>
                          <div className="profilePreviewInfo">
                            <div className="profilePreviewName">{formData.nome}</div>
                            <div className="profilePreviewUser">@{formData.usuario}</div>
                          </div>
                        </div>
                        <div className="profilePreviewFields">
                          <div className="profileField">
                            <div className="profileFieldLabel">Nome Exibido</div>
                            <div className="profileFieldValue">{formData.nome}</div>
                          </div>
                          <div className="profileFieldDivider" />
                          <div className="profileField">
                            <div className="profileFieldLabel">Nome de Usuário</div>
                            <div className="profileFieldValue">@{formData.usuario}</div>
                          </div>
                          <div className="profileFieldDivider" />
                          <div className="profileField">
                            <div className="profileFieldLabel">Cargo</div>
                            <div className="profileFieldValue">{roleLabelText(role)}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* SEGURANÇA */}
                  {activeSection === "seguranca" && (
                    <>
                      <h2 className="settingsSectionTitle">Segurança</h2>
                      <section className="perfilCard">
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
                    </>
                  )}

                  {/* CONFIGURAÇÕES (Notificações + Compacto) */}
                  {activeSection === "configuracoes" && (
                    <>
                      <h2 className="settingsSectionTitle">Configurações</h2>
                      <section className="perfilCard">
                        <div className="settingsGrid">
                          <div className="settingsItem">
                            <div className="settingsInfo">
                              <h3>Notificações por e-mail</h3>
                              <p>Receba alertas sobre novas atividades e avisos</p>
                            </div>
                            <AnimatedToggle
                              checked={settings.emailNotificacoes}
                              onChange={(checked) => setSettings((prev) => ({ ...prev, emailNotificacoes: checked }))}
                            />
                          </div>
                          <div className="settingsItem">
                            <div className="settingsInfo">
                              <h3>Notificações no app</h3>
                              <p>Mostre avisos dentro do portal quando houver novidades</p>
                            </div>
                            <AnimatedToggle
                              checked={settings.pushNotificacoes}
                              onChange={(checked) => setSettings((prev) => ({ ...prev, pushNotificacoes: checked }))}
                            />
                          </div>
                          <div className="settingsItem">
                            <div className="settingsInfo">
                              <h3>Modo compacto</h3>
                              <p>Reduza o espaçamento para ver mais conteúdo</p>
                            </div>
                            <AnimatedToggle
                              checked={settings.modoCompacto}
                              onChange={(checked) => setSettings((prev) => ({ ...prev, modoCompacto: checked }))}
                            />
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
                    </>
                  )}

                  {/* APARÊNCIA */}
                  {activeSection === "aparencia" && (
                    <>
                      <h2 className="settingsSectionTitle">Aparência</h2>
                      <section className="perfilCard">
                        <div className="settingsGrid">
                          <div className="settingsItem">
                            <div className="settingsInfo">
                              <h3>Tema</h3>
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
                            {savingSettings ? "Salvando..." : "Salvar"}
                          </AnimatedButton>
                        </div>
                      </section>
                    </>
                  )}

                  {/* DESEMPENHO */}
                  {activeSection === "desempenho" && (
                    <>
                      <h2 className="settingsSectionTitle">Seu Desempenho</h2>
                      {statsLoading ? (
                        <div style={{ display: "grid", placeItems: "center", padding: 32, color: "var(--muted)" }}>
                          Carregando estat??sticas...
                        </div>
                      ) : statsError ? (
                        <div style={{ display: "grid", placeItems: "center", padding: 32, color: "var(--red)" }}>
                          {statsError}
                        </div>
                      ) : (
                        <div className="statsGrid">
                          <div className="statCard">
                            <div className="statIcon"><CheckCircle size={18} /></div>
                            <div className="statInfo">
                              <div className="statValue">{stats.exerciciosFeitos}</div>
                              <div className="statLabel">Exercícios Feitos</div>
                            </div>
                          </div>
                          <div className="statCard">
                            <div className="statIcon">★</div>
                            <div className="statInfo">
                              <div className="statValue">
                                {stats.notaMedia === null ? "-" : `${stats.notaMedia.toFixed(1)}/10`}
                              </div>
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
                      )}
                    </>
                  )}

                  {/* TURMAS */}
                  {activeSection === "turmas" && (
                    <>
                      <h2 className="settingsSectionTitle">Turmas Inscritas</h2>
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
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* MODAL DE ALTERAR SENHA */}
          {modalSenha && (
            <div className="modalOverlay" onClick={closeSenhaModal} style={{ zIndex: 10002 }}>
              <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <h3>Alterar Senha</h3>
                <div className="formGroup">
                  <label className="formLabel">Senha Atual</label>
                  <input type="password" placeholder="Digite sua senha atual" className="formInput" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoComplete="current-password" />
                </div>
                <div className="formGroup">
                  <label className="formLabel">Nova Senha</label>
                  <input type="password" placeholder="Digite sua nova senha" className="formInput" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" />
                  {novaSenha && novaSenha.length < 6 && <small className="formHint error">{iconLabel(<XCircle size={12} />, "Mínimo 6 caracteres")}</small>}
                  {novaSenha && novaSenha.length >= 6 && <small className="formHint success">{iconLabel(<CheckCircle size={12} />, "Senha forte")}</small>}
                </div>
                <div className="formGroup">
                  <label className="formLabel">Confirmar Nova Senha</label>
                  <input type="password" placeholder="Confirme sua nova senha" className="formInput" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} autoComplete="new-password" />
                  {confirmarSenha && novaSenha === confirmarSenha && <small className="formHint success">{iconLabel(<CheckCircle size={12} />, "Senhas coincidem")}</small>}
                  {confirmarSenha && novaSenha !== confirmarSenha && <small className="formHint error">{iconLabel(<XCircle size={12} />, "As senhas não coincidem")}</small>}
                </div>
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.05)", border: "1px solid var(--line)" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Requisitos:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                    <div style={{ color: senhaAtual ? "#16a34a" : "var(--muted)" }}>{senhaAtual ? <CheckCircle size={14} /> : <Circle size={12} />} Senha atual preenchida</div>
                    <div style={{ color: novaSenha && novaSenha.length >= 6 ? "#16a34a" : "var(--muted)" }}>{novaSenha && novaSenha.length >= 6 ? <CheckCircle size={14} /> : <Circle size={12} />} Nova senha com 6+ caracteres</div>
                    <div style={{ color: confirmarSenha && novaSenha === confirmarSenha ? "#16a34a" : "var(--muted)" }}>{confirmarSenha && novaSenha === confirmarSenha ? <CheckCircle size={14} /> : <Circle size={12} />} Confirmação igual</div>
                  </div>
                </div>
                <div className="modalActions">
                  <AnimatedButton type="button" className="btnCancel" onClick={closeSenhaModal}>Cancelar</AnimatedButton>
                  <AnimatedButton type="button" className="btnConfirm" onClick={handleChangeSenha} disabled={savingSenha} loading={savingSenha}>
                    {savingSenha ? iconLabel(<Loader2 size={14} />, "Alterando...") : iconLabel(<CheckCircle size={14} />, "Alterar Senha")}
                  </AnimatedButton>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
