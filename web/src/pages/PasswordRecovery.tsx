import React from "react";
import { Eye, EyeOff, LoaderCircle, ArrowLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  redefinirSenha,
  solicitarRecuperacaoSenha,
  validarTokenRecuperacaoSenha,
} from "../services/api";
import { AnimatedToast } from "../components/animate-ui/AnimatedToast";
import { appRoutes } from "@/router/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60_000;
const PASSWORD_RESET_RESEND_STORAGE_KEY = "password-reset-last-request-at";
const EMAIL_SYNTAX_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PasswordRecoveryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const hasToken = token.length > 0;

  const [identifier, setIdentifier] = React.useState("");
  const [novaSenha, setNovaSenha] = React.useState("");
  const [confirmarSenha, setConfirmarSenha] = React.useState("");
  const [mostrarSenha, setMostrarSenha] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [tokenLoading, setTokenLoading] = React.useState(hasToken);
  const [tokenEmail, setTokenEmail] = React.useState<string | null>(null);
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [resendCooldownMs, setResendCooldownMs] = React.useState(0);

  const canRequestReset = !loading && resendCooldownMs <= 0;
  const resendCooldownSeconds = Math.ceil(resendCooldownMs / 1000);
  const requestButtonLabel = loading
    ? "Enviando..."
    : resendCooldownMs > 0
    ? `Reenviar em ${resendCooldownSeconds}s`
    : successMessage
    ? "Enviar outro e-mail"
    : "Gerar link de recuperacao";

  React.useEffect(() => {
    if (hasToken || typeof window === "undefined") {
      return;
    }

    const storedTimestamp = window.localStorage.getItem(PASSWORD_RESET_RESEND_STORAGE_KEY);
    if (!storedTimestamp) {
      setResendCooldownMs(0);
      return;
    }

    const lastRequestAt = Number(storedTimestamp);
    if (!Number.isFinite(lastRequestAt)) {
      window.localStorage.removeItem(PASSWORD_RESET_RESEND_STORAGE_KEY);
      setResendCooldownMs(0);
      return;
    }

    const updateCooldown = () => {
      const remaining = Math.max(0, lastRequestAt + PASSWORD_RESET_RESEND_COOLDOWN_MS - Date.now());
      setResendCooldownMs(remaining);
      if (remaining <= 0) {
        window.localStorage.removeItem(PASSWORD_RESET_RESEND_STORAGE_KEY);
      }
    };

    updateCooldown();
    const intervalId = window.setInterval(updateCooldown, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasToken]);

  React.useEffect(() => {
    if (!hasToken) {
      setTokenLoading(false);
      setTokenEmail(null);
      setTokenError(null);
      return;
    }

    let active = true;
    setTokenLoading(true);
    setTokenError(null);

    void validarTokenRecuperacaoSenha(token)
      .then((response) => {
        if (!active) return;
        setTokenEmail(response.email);
      })
      .catch((error) => {
        if (!active) return;
        setTokenError(error instanceof Error ? error.message : "Token invalido");
      })
      .finally(() => {
        if (active) setTokenLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hasToken, token]);

  async function handleRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      setErrorMessage("Informe seu e-mail ou usuario.");
      return;
    }
    if (trimmedIdentifier.includes("@") && !EMAIL_SYNTAX_REGEX.test(trimmedIdentifier)) {
      setErrorMessage("Informe um e-mail valido.");
      return;
    }
    if (!canRequestReset) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const response = await solicitarRecuperacaoSenha({ usuario: trimmedIdentifier });
      const requestedAt = Date.now();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PASSWORD_RESET_RESEND_STORAGE_KEY, String(requestedAt));
      }
      setResendCooldownMs(PASSWORD_RESET_RESEND_COOLDOWN_MS);
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao solicitar recuperacao");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!novaSenha.trim()) {
      setErrorMessage("Informe a nova senha.");
      return;
    }
    if (novaSenha.trim().length < 6) {
      setErrorMessage("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErrorMessage("As senhas nao coincidem.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const response = await redefinirSenha({ token, novaSenha: novaSenha.trim() });
      setSuccessMessage(response.message);
      window.setTimeout(() => {
        navigate(appRoutes.login, { replace: true });
      }, 1600);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-black text-white"
      style={{
        backgroundImage: "url('/backgroundLogin.png')",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.36),rgba(2,6,23,0.72))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(225,29,72,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_30%)]" />

      <AnimatedToast message={successMessage} type="success" duration={3500} />
      <AnimatedToast
        message={errorMessage}
        type="error"
        duration={4500}
        onClose={() => setErrorMessage(null)}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 sm:px-6">
        <Card className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] border border-white/18 bg-black/60 py-0 text-white shadow-[0_28px_80px_rgba(2,6,23,0.52)] backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(225,29,72,0.18),transparent_42%)]" />

          <CardHeader className="relative z-10 justify-items-center gap-3 px-6 pt-6 pb-2 text-center sm:px-8 sm:pt-8">
            <Link
              to={appRoutes.login}
              className="inline-flex items-center gap-2 self-start text-xs font-semibold uppercase tracking-[0.18em] text-white/62 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Link>
            <CardTitle className="pt-1 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
              {hasToken ? "Redefinir senha" : "Recuperar senha"}
            </CardTitle>
            <CardDescription className="mx-auto max-w-xs text-sm leading-6 text-white/68">
              {hasToken
                ? tokenLoading
                  ? "Validando seu link de recuperacao."
                  : tokenError
                  ? "Esse link nao pode mais ser usado."
                  : `Defina uma nova senha para ${tokenEmail ?? "sua conta"}.`
                : "Informe seu e-mail ou usuario para gerar um link seguro de redefinicao."}
            </CardDescription>
          </CardHeader>

          <CardContent className="relative z-10 px-6 pb-6 sm:px-8 sm:pb-8">
            {hasToken ? (
              tokenLoading ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <LoaderCircle className="h-8 w-8 animate-spin text-rose-500" />
                </div>
              ) : tokenError ? (
                <div className="space-y-4 rounded-[24px] border border-rose-500/24 bg-rose-500/10 p-5 text-center">
                  <p className="text-sm leading-6 text-rose-100">{tokenError}</p>
                  <Button
                    type="button"
                    className="h-11 w-full rounded-2xl border border-rose-500 bg-rose-600 text-sm font-black tracking-[0.16em] text-white uppercase hover:bg-rose-500"
                    onClick={() => navigate(appRoutes.passwordRecovery)}
                  >
                    Solicitar novo link
                  </Button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleConfirmSubmit}>
                  <div className="space-y-2.5">
                    <Label
                      htmlFor="password-recovery-new-password"
                      className="text-[13px] font-semibold tracking-[0.08em] text-white/86 uppercase"
                    >
                      Nova senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="password-recovery-new-password"
                        className="h-12 rounded-2xl border-white/16 bg-white/8 px-4 pr-12 text-white shadow-[0_0_18px_rgba(225,29,72,0.12)] placeholder:text-white/45 hover:border-white/28 hover:bg-white/10 focus-visible:border-rose-500 focus-visible:ring-rose-500/24"
                        value={novaSenha}
                        onChange={(event) => setNovaSenha(event.target.value)}
                        type={mostrarSenha ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Digite sua nova senha"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1/2 right-2 h-8 w-8 -translate-y-1/2 rounded-xl border border-transparent bg-transparent text-white/78 hover:border-white/14 hover:bg-white/10 hover:text-white"
                        onClick={() => setMostrarSenha((current) => !current)}
                      >
                        {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <Label
                      htmlFor="password-recovery-confirm-password"
                      className="text-[13px] font-semibold tracking-[0.08em] text-white/86 uppercase"
                    >
                      Confirmar senha
                    </Label>
                    <Input
                      id="password-recovery-confirm-password"
                      className="h-12 rounded-2xl border-white/16 bg-white/8 px-4 text-white shadow-[0_0_18px_rgba(225,29,72,0.12)] placeholder:text-white/45 hover:border-white/28 hover:bg-white/10 focus-visible:border-rose-500 focus-visible:ring-rose-500/24"
                      value={confirmarSenha}
                      onChange={(event) => setConfirmarSenha(event.target.value)}
                      type={mostrarSenha ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Repita a nova senha"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-2xl border border-rose-500 bg-rose-600 text-sm font-black tracking-[0.18em] text-white uppercase shadow-[0_16px_38px_rgba(225,29,72,0.34)] hover:bg-rose-500"
                    disabled={loading}
                  >
                    {loading ? "Salvando..." : "Redefinir senha"}
                  </Button>
                </form>
              )
            ) : (
              <form className="space-y-5" onSubmit={handleRequestSubmit}>
                <div className="space-y-2.5">
                  <Label
                    htmlFor="password-recovery-identifier"
                    className="text-[13px] font-semibold tracking-[0.08em] text-white/86 uppercase"
                  >
                    E-mail ou usuario
                  </Label>
                  <Input
                    id="password-recovery-identifier"
                    className="h-12 rounded-2xl border-white/16 bg-white/8 px-4 text-white shadow-[0_0_18px_rgba(225,29,72,0.12)] placeholder:text-white/45 hover:border-white/28 hover:bg-white/10 focus-visible:border-rose-500 focus-visible:ring-rose-500/24"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    type="text"
                    autoComplete="username"
                    placeholder="Digite seu e-mail ou usuario"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl border border-rose-500 bg-rose-600 text-sm font-black tracking-[0.18em] text-white uppercase shadow-[0_16px_38px_rgba(225,29,72,0.34)] hover:bg-rose-500"
                  disabled={!canRequestReset}
                >
                  {requestButtonLabel}
                </Button>
                <p className="text-center text-xs leading-5 text-white/52" aria-live="polite">
                  {resendCooldownMs > 0
                    ? `Aguarde ${resendCooldownSeconds}s para solicitar outro e-mail de redefinicao.`
                    : "Voce pode pedir um novo e-mail se o link anterior expirar."}
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
