import React from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, CircleCheck, ShieldCheck } from "lucide-react";
import { getName, getRole } from "../../../../auth/auth";
import {
  apiFetch,
  listarAdmins,
  listarAlunos,
  listarProfessores,
  logoutWithServer,
  type User,
} from "../../../../services/api";
import DashboardLayout from "../../DashboardLayout";
import "./CreateUser.css";

type Role = "admin" | "professor" | "aluno";

type Msg = {
  text: string;
  type: "ok" | "error";
};

type FieldErrors = {
  email?: string;
  nome?: string;
  senha?: string;
  confirmarSenha?: string;
  adminPassword?: string;
};

type EmailStatus = "idle" | "checking" | "available" | "exists" | "error";
type SubmitMode = "single" | "another";

type CreatedCredentials = {
  email: string;
  senha: string;
  role: Role;
  forcePasswordChange: boolean;
};

function roleLabel(role: Role | null) {
  if (role === "admin") return "Administrador";
  if (role === "professor") return "Professor";
  return "Aluno";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function passwordStrengthLabel(score: number) {
  if (score <= 2) return "Fraca";
  if (score <= 4) return "Média";
  return "Forte";
}

function generateTemporaryPassword(length = 14) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?";
  const bytes = new Uint32Array(length);
  window.crypto.getRandomValues(bytes);
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += alphabet[bytes[i] % alphabet.length];
  }
  return output;
}

export default function CreateUser() {
  const navigate = useNavigate();

  const [email, setEmail] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [confirmarSenha, setConfirmarSenha] = React.useState("");
  const [adminPassword, setAdminPassword] = React.useState("");
  const [role, setRole] = React.useState<Role>("aluno");
  const [forcePasswordChange, setForcePasswordChange] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<Msg | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [emailStatus, setEmailStatus] = React.useState<EmailStatus>("idle");
  const [registeredEmails, setRegisteredEmails] = React.useState<Set<string>>(new Set());
  const [lastCreatedCredentials, setLastCreatedCredentials] = React.useState<CreatedCredentials | null>(null);
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "ok" | "error">("idle");
  const [credentialsModalOpen, setCredentialsModalOpen] = React.useState(false);
  const [tempPasswordModalOpen, setTempPasswordModalOpen] = React.useState(false);
  const [lastGeneratedPassword, setLastGeneratedPassword] = React.useState("");
  const [tempPasswordCopyStatus, setTempPasswordCopyStatus] = React.useState<"idle" | "ok" | "error">("idle");

  const viewerName = getName() ?? "Usuário";
  const viewerRole = getRole();
  const senhaScore = passwordStrength(senha);

  React.useEffect(() => {
    let alive = true;

    async function loadEmails() {
      try {
        const [alunos, professores, admins] = await Promise.all([
          listarAlunos(),
          listarProfessores(),
          listarAdmins(),
        ]);

        if (!alive) return;

        const emails = new Set<string>();
        for (const user of [...alunos, ...professores, ...admins]) {
          const value = user.email ?? user.usuario;
          if (value) emails.add(normalizeEmail(value));
        }
        setRegisteredEmails(emails);
      } catch {
        if (alive) setEmailStatus("error");
      }
    }

    loadEmails();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    const normalized = normalizeEmail(email);
    const previousError = fieldErrors.email;

    if (!normalized) {
      setEmailStatus("idle");
      if (previousError) setFieldErrors((prev) => ({ ...prev, email: undefined }));
      return;
    }

    if (!isValidEmail(normalized)) {
      setEmailStatus("idle");
      setFieldErrors((prev) => ({ ...prev, email: "Digite um e-mail válido." }));
      return;
    }

    setFieldErrors((prev) => ({ ...prev, email: undefined }));
    setEmailStatus("checking");

    const timer = window.setTimeout(() => {
      if (registeredEmails.has(normalized)) {
        setEmailStatus("exists");
        setFieldErrors((prev) => ({ ...prev, email: "Este e-mail já está cadastrado." }));
      } else {
        setEmailStatus("available");
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [email, registeredEmails, fieldErrors.email]);

  function validateForm() {
    const nextErrors: FieldErrors = {};
    const normalizedEmail = normalizeEmail(email);
    const trimmedNome = nome.trim();

    if (!normalizedEmail) nextErrors.email = "E-mail é obrigatório.";
    else if (!isValidEmail(normalizedEmail)) nextErrors.email = "Digite um e-mail válido.";
    else if (registeredEmails.has(normalizedEmail)) nextErrors.email = "Este e-mail já está cadastrado.";

    if (!trimmedNome) nextErrors.nome = "Nome é obrigatório.";
    else if (trimmedNome.length < 2) nextErrors.nome = "Nome deve ter pelo menos 2 caracteres.";

    if (!senha) nextErrors.senha = "Senha é obrigatória.";
    else if (senha.length < 6) nextErrors.senha = "Senha deve ter pelo menos 6 caracteres.";
    else if (senhaScore <= 2) nextErrors.senha = "Senha fraca. Use letras maiúsculas, números e símbolos.";

    if (!confirmarSenha) nextErrors.confirmarSenha = "Confirme a senha.";
    else if (confirmarSenha !== senha) nextErrors.confirmarSenha = "As senhas não conferem.";

    if (role === "admin" && !adminPassword.trim()) {
      nextErrors.adminPassword = "Informe sua senha para criar um administrador.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setCopyStatus("idle");
    if (!validateForm()) return;

    const nativeEvent = e.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLButtonElement | null;
    const submitMode = (submitter?.dataset.mode as SubmitMode | undefined) ?? "single";
    const keepCreating = submitMode === "another";
    const normalizedEmail = normalizeEmail(email);

    setLoading(true);
    try {
      await apiFetch<{ message: string; user: User }>("/users", {
        method: "POST",
        body: JSON.stringify({
          usuario: normalizedEmail,
          nome: nome.trim(),
          senha,
          role,
          forcePasswordChange,
          ...(role === "admin" ? { adminPassword } : {}),
        }),
      });

      setMsg({
        text: keepCreating ? "Usuário criado! Formulário pronto para o próximo." : "Usuário criado com sucesso!",
        type: "ok",
      });
      setLastCreatedCredentials({
        email: normalizedEmail,
        senha,
        role,
        forcePasswordChange,
      });
      setCredentialsModalOpen(true);
      setEmail("");
      setNome("");
      setSenha("");
      setConfirmarSenha("");
      setAdminPassword("");
      if (!keepCreating) {
        setRole("aluno");
      }
      setForcePasswordChange(true);
      setFieldErrors({});
      setEmailStatus("idle");
      setRegisteredEmails((prev) => {
        const updated = new Set(prev);
        updated.add(normalizedEmail);
        return updated;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao criar usuário";
      const lower = message.toLowerCase();

      if (
        lower.includes("senha do administrador inválida") ||
        lower.includes("senha do administrador é obrigatória")
      ) {
        setFieldErrors((prev) => ({ ...prev, adminPassword: message }));
        setMsg({ text: message, type: "error" });
        return;
      }

      if (lower.includes("já existe") || message.includes("409")) {
        setEmailStatus("exists");
        setFieldErrors((prev) => ({ ...prev, email: "Este e-mail já está cadastrado." }));
      }

      if (lower.includes("401")) {
        await logoutWithServer();
        navigate("/login", { replace: true });
        return;
      }

      setMsg({ text: message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function copyCredentials() {
    if (!lastCreatedCredentials) return;
    const lines = [
      `Usuário: ${lastCreatedCredentials.email}`,
      `Senha temporária: ${lastCreatedCredentials.senha}`,
      `Cargo: ${roleLabel(lastCreatedCredentials.role)}`,
      `Troca obrigatória de senha: ${lastCreatedCredentials.forcePasswordChange ? "Sim" : "Não"}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("ok");
    } catch {
      setCopyStatus("error");
    }
  }

  function handleGeneratePassword() {
    const generated = generateTemporaryPassword();
    setSenha(generated);
    setConfirmarSenha(generated);
    setLastGeneratedPassword(generated);
    setTempPasswordModalOpen(true);
    setTempPasswordCopyStatus("idle");
    setFieldErrors((prev) => ({
      ...prev,
      senha: undefined,
      confirmarSenha: undefined,
    }));
  }

  async function copyGeneratedPassword() {
    if (!lastGeneratedPassword) return;
    try {
      await navigator.clipboard.writeText(lastGeneratedPassword);
      setTempPasswordCopyStatus("ok");
    } catch {
      setTempPasswordCopyStatus("error");
    }
  }

  return (
    <DashboardLayout
      title="Criar usuário"
      subtitle="Cadastre novos perfis dentro do dashboard"
    >
      <section className="cuGrid">
        <div className="card cuCard">
          <div className="cuHead">
            <div className="cuKicker">Acesso restrito</div>
            <h2>Novo usuário</h2>
            <p>Somente administradores podem criar novos perfis.</p>
          </div>

          <form onSubmit={handleSubmit} className="cuForm">
            <label>
              E-mail
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: usuario@dominio.com"
                className={fieldErrors.email ? "cuInputError" : ""}
                required
              />
              {fieldErrors.email ? (
                <small className="cuFieldError">{fieldErrors.email}</small>
              ) : emailStatus === "checking" ? (
                <small className="cuFieldInfo">Verificando disponibilidade...</small>
              ) : emailStatus === "available" ? (
                <small className="cuFieldOk">E-mail disponível.</small>
              ) : null}
            </label>

            <label>
              Nome
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="ex: João Silva"
                className={fieldErrors.nome ? "cuInputError" : ""}
                required
              />
              {fieldErrors.nome ? <small className="cuFieldError">{fieldErrors.nome}</small> : null}
            </label>

            <label>
              Senha
              <input
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="mín. 6 caracteres"
                type="password"
                className={fieldErrors.senha ? "cuInputError" : ""}
                required
                minLength={6}
              />
              <div className="cuInlineActions">
                <button type="button" className="cuMiniBtn" onClick={handleGeneratePassword}>
                  Gerar senha temporária
                </button>
              </div>
              <div className="cuStrength" aria-live="polite">
                <div className="cuStrengthTrack">
                  <span
                    className={`cuStrengthFill score-${Math.max(1, senhaScore)}`}
                    style={{ width: `${(senhaScore / 5) * 100}%` }}
                  />
                </div>
                <small>
                  Força da senha: <strong>{passwordStrengthLabel(senhaScore)}</strong>
                </small>
              </div>
              {fieldErrors.senha ? <small className="cuFieldError">{fieldErrors.senha}</small> : null}
            </label>

            <label>
              Confirmar senha
              <input
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="repita a senha"
                type="password"
                className={fieldErrors.confirmarSenha ? "cuInputError" : ""}
                required
                minLength={6}
              />
              {fieldErrors.confirmarSenha ? (
                <small className="cuFieldError">{fieldErrors.confirmarSenha}</small>
              ) : confirmarSenha && confirmarSenha === senha ? (
                <small className="cuFieldOk">Senhas conferem.</small>
              ) : null}
            </label>

            <label>
              Cargo
              <select
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value as Role;
                  setRole(nextRole);
                  if (nextRole !== "admin") {
                    setAdminPassword("");
                    setFieldErrors((prev) => ({ ...prev, adminPassword: undefined }));
                  }
                }}
              >
                <option value="aluno">Aluno</option>
                <option value="professor">Professor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>

            {role === "admin" && (
              <label>
                Sua senha (confirmação admin)
                <input
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    if (fieldErrors.adminPassword) {
                      setFieldErrors((prev) => ({ ...prev, adminPassword: undefined }));
                    }
                  }}
                  placeholder="digite sua senha atual"
                  type="password"
                  className={fieldErrors.adminPassword ? "cuInputError" : ""}
                  required
                />
                {fieldErrors.adminPassword ? (
                  <small className="cuFieldError">{fieldErrors.adminPassword}</small>
                ) : (
                  <small className="cuFieldInfo">
                    Obrigatório para criar usuário com cargo Administrador.
                  </small>
                )}
              </label>
            )}

            <label className="cuToggleRow">
              <input
                type="checkbox"
                checked={forcePasswordChange}
                onChange={(e) => setForcePasswordChange(e.target.checked)}
              />
              <span>Forçar troca de senha no primeiro login</span>
            </label>

            {msg ? <div className={`cuMsg ${msg.type}`}>{msg.text}</div> : null}

            {lastCreatedCredentials && (
              <div className="cuCredentialsBox">
                <div className="cuCredentialsHead">
                  <strong>Credenciais do último usuário criado</strong>
                  <button type="button" className="cuMiniBtn" onClick={copyCredentials}>
                    Copiar credenciais
                  </button>
                </div>
                <div className="cuCredentialsList">
                  <span>
                    <strong>Usuário:</strong> {lastCreatedCredentials.email}
                  </span>
                  <span>
                    <strong>Senha:</strong> {lastCreatedCredentials.senha}
                  </span>
                  <span>
                    <strong>Cargo:</strong> {roleLabel(lastCreatedCredentials.role)}
                  </span>
                  <span>
                    <strong>Troca obrigatória:</strong>{" "}
                    {lastCreatedCredentials.forcePasswordChange ? "Sim" : "Não"}
                  </span>
                </div>
                {copyStatus === "ok" && <small className="cuFieldOk">Credenciais copiadas.</small>}
                {copyStatus === "error" && (
                  <small className="cuFieldError">Não foi possível copiar automaticamente.</small>
                )}
              </div>
            )}

            <div className="cuActions">
              <button
                type="button"
                className="cuBtn ghost"
                onClick={() => navigate("/dashboard")}
              >
                Voltar
              </button>
              <button type="submit" data-mode="single" className="cuBtn ghost" disabled={loading}>
                {loading ? "Criando..." : "Criar"}
              </button>
              <button type="submit" data-mode="another" className="cuBtn" disabled={loading}>
                {loading ? "Criando..." : "Criar e criar outro"}
              </button>
            </div>
          </form>
        </div>

        <div className="card cuSide">
          <div className="cuUser">
            <div className="cuAvatar">{viewerName.slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="cuUserName">{viewerName}</div>
              <div className="cuUserRole">{roleLabel(viewerRole)}</div>
            </div>
          </div>

          <div className="cuInfo">
            <div className="cuInfoTitle">Como funciona</div>
            <p>
              Esta tela cria usuários diretamente na tabela <code>"user"</code> com cargo
              numérico no banco e contrato compatível com o frontend.
            </p>

            <div className="cuPills">
              <span>Aluno</span>
              <span>Professor</span>
              <span>Administrador</span>
            </div>

            <div className="cuSelectedRole">
              <BadgeCheck size={14} />
              Cargo selecionado: <strong>{roleLabel(role)}</strong>
            </div>

            <div className="cuChecklist" aria-label="Checklist de criação">
              <div className="cuChecklistItem">
                <ShieldCheck size={15} />
                <span>Acesso protegido por perfil de admin</span>
              </div>
              <div className="cuChecklistItem">
                <CircleCheck size={15} />
                <span>Usuário criado compatível com o frontend</span>
              </div>
              <div className="cuChecklistItem">
                <CircleCheck size={15} />
                <span>Cadastro instantâneo sem fluxo adicional</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {credentialsModalOpen && lastCreatedCredentials && (
        <div className="cuModalBackdrop" role="dialog" aria-modal="true" aria-label="Credenciais do novo usuário">
          <div className="cuModalCard">
            <div className="cuModalHead">
              <h3>Credenciais geradas</h3>
              <p>Salve agora. Esta é a senha inicial do usuário.</p>
            </div>

            <div className="cuModalCredentials">
              <div className="cuModalLine">
                <span>Usuário</span>
                <code>{lastCreatedCredentials.email}</code>
              </div>
              <div className="cuModalLine">
                <span>Senha</span>
                <code>{lastCreatedCredentials.senha}</code>
              </div>
              <div className="cuModalLine">
                <span>Cargo</span>
                <strong>{roleLabel(lastCreatedCredentials.role)}</strong>
              </div>
              <div className="cuModalLine">
                <span>Troca obrigatória</span>
                <strong>{lastCreatedCredentials.forcePasswordChange ? "Sim" : "Não"}</strong>
              </div>
            </div>

            <div className="cuModalActions">
              <button type="button" className="cuBtn ghost" onClick={() => setCredentialsModalOpen(false)}>
                Fechar
              </button>
              <button type="button" className="cuBtn" onClick={copyCredentials}>
                Copiar credenciais
              </button>
            </div>

            {copyStatus === "ok" && <small className="cuFieldOk">Credenciais copiadas.</small>}
            {copyStatus === "error" && (
              <small className="cuFieldError">Não foi possível copiar automaticamente.</small>
            )}
          </div>
        </div>
      )}

      {tempPasswordModalOpen && lastGeneratedPassword && (
        <div className="cuModalBackdrop" role="dialog" aria-modal="true" aria-label="Senha temporária gerada">
          <div className="cuModalCard">
            <div className="cuModalHead">
              <h3>Senha temporária gerada</h3>
              <p>Use esta senha no novo cadastro.</p>
            </div>

            <div className="cuTempPasswordBox">
              <code>{lastGeneratedPassword}</code>
            </div>

            <div className="cuModalActions">
              <button type="button" className="cuBtn ghost" onClick={() => setTempPasswordModalOpen(false)}>
                Fechar
              </button>
              <button type="button" className="cuBtn" onClick={copyGeneratedPassword}>
                Copiar senha
              </button>
            </div>

            {tempPasswordCopyStatus === "ok" && <small className="cuFieldOk">Senha copiada.</small>}
            {tempPasswordCopyStatus === "error" && (
              <small className="cuFieldError">Não foi possível copiar automaticamente.</small>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
