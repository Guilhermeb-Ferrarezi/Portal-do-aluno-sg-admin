import React from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, ChevronDown, CircleCheck, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { getName, getRole } from "../../../../auth/auth";
import {
  apiFetch,
  listarAdmins,
  listarAlunos,
  listarProfessores,
  logoutWithServer,
  type User,
} from "../../../../services/api";
import { cn } from "../../../../lib/utils";
import { AnimatedToast } from "../../../animate-ui/AnimatedToast";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import DashboardLayout from "../../DashboardLayout";

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

function helperToneClass(tone: "error" | "ok" | "info") {
  if (tone === "error") return "text-destructive";
  if (tone === "ok") return "text-emerald-400";
  return "text-sky-400";
}

function roleBadgeClass(role: Role | null) {
  if (role === "admin") return "border-violet-500/35 bg-violet-500/15 text-violet-700 dark:text-violet-100";
  if (role === "professor") return "border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-100";
  return "border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-100";
}

function strengthFillClass(score: number) {
  if (score <= 2) return "bg-destructive";
  if (score <= 4) return "bg-amber-400";
  return "bg-emerald-400";
}

const surfaceCardClass =
  "relative overflow-hidden rounded-2xl border-2 border-border bg-card p-6 shadow-sm sm:p-7";
const cardGlowClass =
  "pointer-events-none absolute inset-0 opacity-0 dark:opacity-90 [background:radial-gradient(circle_at_14%_18%,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_86%_24%,rgba(56,189,248,0.12),transparent_26%),radial-gradient(circle_at_48%_100%,rgba(148,163,184,0.06),transparent_34%)]";
const fieldClass =
  "h-12 rounded-2xl border-2 border-border bg-[var(--input-bg)] px-4 font-mono text-[15px] text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:ring-4 focus-visible:ring-primary/15";
const fieldErrorClass =
  "border-destructive/70 bg-destructive/5 focus-visible:border-destructive focus-visible:ring-destructive/15";
const helperTextClass = "text-xs font-medium leading-5";

export default function CreateUser() {
  const navigate = useNavigate();

  const [email, setEmail] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [confirmarSenha, setConfirmarSenha] = React.useState("");
  const [adminPassword, setAdminPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [role, setRole] = React.useState<Role>("aluno");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<Msg | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [emailStatus, setEmailStatus] = React.useState<EmailStatus>("idle");
  const [registeredEmails, setRegisteredEmails] = React.useState<Set<string>>(new Set());

  const viewerName = getName() ?? "Usuario";
  const viewerRole = getRole() as Role | null;
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

    void loadEmails();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    const normalized = normalizeEmail(email);

    if (!normalized) {
      setEmailStatus("idle");
      setFieldErrors((prev) => (prev.email ? { ...prev, email: undefined } : prev));
      return;
    }

    if (!isValidEmail(normalized)) {
      setEmailStatus("idle");
      setFieldErrors((prev) => ({ ...prev, email: "Digite um e-mail valido." }));
      return;
    }

    setFieldErrors((prev) => ({ ...prev, email: undefined }));
    setEmailStatus("checking");

    const timer = window.setTimeout(() => {
      if (registeredEmails.has(normalized)) {
        setEmailStatus("exists");
        setFieldErrors((prev) => ({ ...prev, email: "Este e-mail ja esta cadastrado." }));
      } else {
        setEmailStatus("available");
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [email, registeredEmails]);

  function validateForm() {
    const nextErrors: FieldErrors = {};
    const normalizedEmail = normalizeEmail(email);
    const trimmedNome = nome.trim();

    if (!normalizedEmail) nextErrors.email = "E-mail e obrigatorio.";
    else if (!isValidEmail(normalizedEmail)) nextErrors.email = "Digite um e-mail valido.";
    else if (registeredEmails.has(normalizedEmail)) nextErrors.email = "Este e-mail ja esta cadastrado.";

    if (!trimmedNome) nextErrors.nome = "Nome e obrigatorio.";
    else if (trimmedNome.length < 2) nextErrors.nome = "Nome deve ter pelo menos 2 caracteres.";

    if (!senha) nextErrors.senha = "Senha e obrigatoria.";
    else if (senha.length < 6) nextErrors.senha = "Senha deve ter pelo menos 6 caracteres.";

    if (!confirmarSenha) nextErrors.confirmarSenha = "Confirme a senha.";
    else if (confirmarSenha !== senha) nextErrors.confirmarSenha = "As senhas nao conferem.";

    if (role === "admin" && !adminPassword.trim()) {
      nextErrors.adminPassword = "Informe sua senha para criar um administrador.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    if (!validateForm()) return;

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
          ...(role === "admin" ? { adminPassword } : {}),
        }),
      });

      setMsg({ text: "Usuario criado com sucesso!", type: "ok" });
      setEmail("");
      setNome("");
      setSenha("");
      setConfirmarSenha("");
      setAdminPassword("");
      setShowPassword(false);
      setRole("aluno");
      setFieldErrors({});
      setEmailStatus("idle");
      setRegisteredEmails((prev) => {
        const updated = new Set(prev);
        updated.add(normalizedEmail);
        return updated;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao criar usuario";
      const lower = message.toLowerCase();

      if (
        lower.includes("senha do administrador invalida") ||
        lower.includes("senha do administrador e obrigatoria")
      ) {
        setFieldErrors((prev) => ({ ...prev, adminPassword: message }));
        setMsg({ text: message, type: "error" });
        return;
      }

      if (lower.includes("ja existe") || message.includes("409")) {
        setEmailStatus("exists");
        setFieldErrors((prev) => ({ ...prev, email: "Este e-mail ja esta cadastrado." }));
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

  const emailHint = fieldErrors.email
    ? { text: fieldErrors.email, tone: "error" as const }
    : emailStatus === "checking"
      ? { text: "Verificando disponibilidade...", tone: "info" as const }
      : emailStatus === "available"
        ? { text: "E-mail disponivel.", tone: "ok" as const }
        : emailStatus === "error"
          ? { text: "Nao foi possivel validar os e-mails cadastrados agora.", tone: "info" as const }
          : null;

  const confirmPasswordHint = fieldErrors.confirmarSenha
    ? { text: fieldErrors.confirmarSenha, tone: "error" as const }
    : confirmarSenha && confirmarSenha === senha
      ? { text: "Senhas conferem.", tone: "ok" as const }
      : null;

  const adminPasswordHint = fieldErrors.adminPassword
    ? { text: fieldErrors.adminPassword, tone: "error" as const }
    : { text: "Obrigatorio para criar usuario com cargo Administrador.", tone: "info" as const };

  const checklistItems = [
    {
      icon: ShieldCheck,
      text: "Acesso protegido por perfil de admin",
    },
    {
      icon: CircleCheck,
      text: "Usuario criado compativel com o frontend atual",
    },
    {
      icon: CircleCheck,
      text: "Cadastro instantaneo sem fluxo adicional",
    },
  ];

  return (
    <DashboardLayout title="Criar usuario" subtitle="Cadastre novos perfis dentro do dashboard">
      <AnimatedToast
        message={msg?.text ?? null}
        type={msg?.type === "ok" ? "success" : "error"}
        duration={3500}
        onClose={() => setMsg(null)}
      />

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className={surfaceCardClass}>
          <div className={cardGlowClass} />
          <div className="relative space-y-8">
            <div className="space-y-4">
              <span className="inline-flex w-fit items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Acesso restrito
              </span>
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-[-0.03em] text-foreground sm:text-4xl">
                  Novo usuario
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Somente administradores podem criar novos perfis.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-5">
              <div className="grid items-start gap-5 md:grid-cols-2">
                <div className="grid gap-2.5">
                  <Label htmlFor="create-user-email" className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    E-mail
                  </Label>
                  <Input
                    id="create-user-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ex: usuario@dominio.com"
                    autoComplete="email"
                    className={cn(fieldClass, fieldErrors.email && fieldErrorClass)}
                    aria-invalid={!!fieldErrors.email}
                    required
                  />
                  {emailHint ? (
                    <p className={cn(helperTextClass, helperToneClass(emailHint.tone))}>{emailHint.text}</p>
                  ) : null}
                </div>

                <div className="grid gap-2.5">
                  <Label htmlFor="create-user-name" className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Nome
                  </Label>
                  <Input
                    id="create-user-name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="ex: Joao Silva"
                    autoComplete="name"
                    className={cn(fieldClass, fieldErrors.nome && fieldErrorClass)}
                    aria-invalid={!!fieldErrors.nome}
                    required
                  />
                  {fieldErrors.nome ? (
                    <p className={cn(helperTextClass, helperToneClass("error"))}>{fieldErrors.nome}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid items-start gap-5 md:grid-cols-2">
                <div className="grid gap-2.5">
                  <Label htmlFor="create-user-password" className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="create-user-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="min. 6 caracteres"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className={cn(fieldClass, "pr-14", fieldErrors.senha && fieldErrorClass)}
                      aria-invalid={!!fieldErrors.senha}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-2 my-auto inline-flex size-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition hover:border-border/70 hover:bg-muted/60 hover:text-foreground"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <div className="grid gap-2" aria-live="polite">
                    <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                      <span
                        className={cn("block h-full rounded-full transition-all", strengthFillClass(senhaScore))}
                        style={{ width: `${(senhaScore / 5) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Forca da senha:{" "}
                      <span className={cn("font-semibold", helperToneClass(senhaScore <= 2 ? "error" : senhaScore <= 4 ? "info" : "ok"))}>
                        {passwordStrengthLabel(senhaScore)}
                      </span>
                    </p>
                  </div>
                  {fieldErrors.senha ? (
                    <p className={cn(helperTextClass, helperToneClass("error"))}>{fieldErrors.senha}</p>
                  ) : null}
                </div>

                <div className="grid gap-2.5">
                  <Label htmlFor="create-user-password-confirm" className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Confirmar senha
                  </Label>
                  <Input
                    id="create-user-password-confirm"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="repita a senha"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className={cn(fieldClass, fieldErrors.confirmarSenha && fieldErrorClass)}
                    aria-invalid={!!fieldErrors.confirmarSenha}
                    required
                    minLength={6}
                  />
                  {confirmPasswordHint ? (
                    <p className={cn(helperTextClass, helperToneClass(confirmPasswordHint.tone))}>
                      {confirmPasswordHint.text}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-muted-foreground">
                      Repita exatamente a senha definida acima.
                    </p>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "grid items-start gap-5",
                  role === "admin" && "md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
                )}
              >
                <div className="grid gap-2.5">
                  <Label htmlFor="create-user-role" className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Cargo
                  </Label>
                  <div className="relative">
                    <select
                      id="create-user-role"
                      value={role}
                      onChange={(e) => {
                        const nextRole = e.target.value as Role;
                        setRole(nextRole);
                        if (nextRole !== "admin") {
                          setAdminPassword("");
                          setFieldErrors((prev) => ({ ...prev, adminPassword: undefined }));
                        }
                      }}
                      className={cn(
                        fieldClass,
                        "w-full appearance-none pr-12 text-sm font-semibold text-foreground",
                      )}
                    >
                      <option value="aluno">Aluno</option>
                      <option value="professor">Professor</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", roleBadgeClass(role))}>
                      {roleLabel(role)}
                    </span>
                  </div>
                </div>

                {role === "admin" ? (
                  <div className="grid gap-2.5">
                    <Label htmlFor="create-user-admin-password" className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Sua senha
                    </Label>
                    <Input
                      id="create-user-admin-password"
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        if (fieldErrors.adminPassword) {
                          setFieldErrors((prev) => ({ ...prev, adminPassword: undefined }));
                        }
                      }}
                      placeholder="digite sua senha atual"
                      type="password"
                      autoComplete="current-password"
                      className={cn(fieldClass, fieldErrors.adminPassword && fieldErrorClass)}
                      aria-invalid={!!fieldErrors.adminPassword}
                      required
                    />
                    <p className={cn(helperTextClass, helperToneClass(adminPasswordHint.tone))}>
                      {adminPasswordHint.text}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-border/70 bg-background/35 px-5 font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  onClick={() => navigate("/dashboard")}
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  className="h-12 rounded-2xl px-5 font-semibold shadow-[0_14px_30px_rgba(225,29,46,0.22)] hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? "Criando..." : "Criar usuario"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <aside className="grid gap-6">
          <div className={surfaceCardClass}>
            <div className={cardGlowClass} />
            <div className="relative grid gap-5">
              <div className="flex items-center gap-4 rounded-2xl border-2 border-border bg-muted/30 p-4 dark:bg-background/35">
                <div className="grid size-14 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-xl font-black text-primary">
                  {viewerName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-foreground">{viewerName}</p>
                  <span className={cn("mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", roleBadgeClass(viewerRole))}>
                    {roleLabel(viewerRole)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Como funciona
                </p>
                <h3 className="text-2xl font-black tracking-[-0.03em] text-foreground">
                  Criacao direta no painel
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  Esta tela cria usuarios diretamente na tabela <code className="rounded bg-background/60 px-1.5 py-0.5 text-foreground">user</code>,
                  com cargo numerico no banco e contrato compativel com o frontend.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(["aluno", "professor", "admin"] as Role[]).map((itemRole) => (
                  <span
                    key={itemRole}
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
                      roleBadgeClass(itemRole),
                    )}
                  >
                    {roleLabel(itemRole)}
                  </span>
                ))}
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground">
                <BadgeCheck size={16} className="text-primary" />
                Cargo selecionado: <strong>{roleLabel(role)}</strong>
              </div>

              <div className="grid gap-3" aria-label="Checklist de criacao">
                {checklistItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.text}
                      className="flex items-start gap-3 rounded-2xl border-2 border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground dark:bg-background/35"
                    >
                      <Icon size={16} className="mt-0.5 shrink-0 text-primary" />
                      <span>{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </section>
    </DashboardLayout>
  );
}
