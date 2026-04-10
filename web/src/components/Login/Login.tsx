import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { notifyAuthChanged } from "../../auth/auth";
import { login } from "../../services/api";
import { AnimatedToast } from "../animate-ui/AnimatedToast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormState = {
  usuario: string;
  senha: string;
  mostrarSenha: boolean;
  loading: boolean;
  sucesso: string | null;
  erro: string | null;
  isDarkMode: boolean;
};

type LoginFormAction =
  | { type: "set_usuario"; value: string }
  | { type: "set_senha"; value: string }
  | { type: "toggle_mostrar_senha" }
  | { type: "set_loading"; value: boolean }
  | { type: "set_sucesso"; value: string | null }
  | { type: "set_erro"; value: string | null }
  | { type: "set_dark_mode"; value: boolean };

function createInitialLoginFormState(): LoginFormState {
  return {
    usuario: "",
    senha: "",
    mostrarSenha: false,
    loading: false,
    sucesso: null,
    erro: null,
    isDarkMode:
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "dark",
  };
}

function loginFormReducer(state: LoginFormState, action: LoginFormAction): LoginFormState {
  switch (action.type) {
    case "set_usuario":
      return { ...state, usuario: action.value };
    case "set_senha":
      return { ...state, senha: action.value };
    case "toggle_mostrar_senha":
      return { ...state, mostrarSenha: !state.mostrarSenha };
    case "set_loading":
      return { ...state, loading: action.value };
    case "set_sucesso":
      return { ...state, sucesso: action.value };
    case "set_erro":
      return { ...state, erro: action.value };
    case "set_dark_mode":
      return { ...state, isDarkMode: action.value };
    default:
      return state;
  }
}

export default function Login() {
  const navigate = useNavigate();

  const [state, dispatch] = useReducer(
    loginFormReducer,
    undefined,
    createInitialLoginFormState
  );
  const { usuario, senha, mostrarSenha, loading, sucesso, erro, isDarkMode } = state;

  const [segundos, setSegundos] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const podeEntrar = useMemo(() => {
    return usuario.trim().length > 0 && senha.trim().length > 0 && !loading;
  }, [usuario, senha, loading]);

  const redirecionando = sucesso !== null && segundos !== null;
  const showLoadingScreen = loading || redirecionando;
  const loadingTitle = loading ? "Validando acesso..." : "Login realizado";
  const loadingDescription = loading
    ? "Conferindo suas credenciais no servidor."
    : `Redirecionando para o painel em ${segundos ?? 0}s.`;
  const backgroundImage = isDarkMode
    ? "url('/backgroundLogin.png')"
    : "url('/backgroundLoginBranco.png')";
  const logoSrc = isDarkMode ? "/favicon.png" : "/faviconPreto.png";

  function clearCountdown() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSegundos(null);
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (mountedRef.current) {
        dispatch({ type: "set_dark_mode", value: isDark });
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!podeEntrar) return;

    dispatch({ type: "set_erro", value: null });
    dispatch({ type: "set_sucesso", value: null });
    clearCountdown();

    dispatch({ type: "set_loading", value: true });

    try {
      const data = await login({ usuario: usuario.trim(), senha });

      if (!mountedRef.current) return;

      localStorage.setItem("token", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("nome", data.user?.nome ?? "");
      localStorage.removeItem("role");
      notifyAuthChanged();

      dispatch({ type: "set_sucesso", value: data.message ?? "Login realizado!" });
      dispatch({ type: "set_erro", value: null });

      setSegundos(2);

      intervalRef.current = window.setInterval(() => {
        setSegundos((prev) => {
          if (prev === null) return null;

          if (prev <= 1) {
            if (intervalRef.current !== null) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }

            navigate("/dashboard", { replace: true });
            return 0;
          }

          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      if (!mountedRef.current) return;

      dispatch({
        type: "set_erro",
        value: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      if (mountedRef.current) {
        dispatch({ type: "set_loading", value: false });
      }
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-black text-white"
      style={{
        backgroundImage,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.36),rgba(2,6,23,0.72))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(225,29,72,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_30%)]" />

      <AnimatedToast message={sucesso} type="success" duration={0} />
      <AnimatedToast
        message={erro}
        type="error"
        duration={4500}
        onClose={() => dispatch({ type: "set_erro", value: null })}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 sm:px-6">
        <Card className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] border border-white/18 bg-black/60 py-0 text-white shadow-[0_28px_80px_rgba(2,6,23,0.52)] backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(225,29,72,0.18),transparent_42%)]" />
          <div
            className="absolute -left-12 top-12 h-28 w-28 rounded-full bg-rose-500/18 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute -right-14 bottom-12 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl"
            aria-hidden="true"
          />

          <CardHeader className="relative z-10 justify-items-center gap-3 px-6 pt-6 pb-2 text-center sm:px-8 sm:pt-8">
            <div className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-rose-100 uppercase">
              Santos Tech
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-rose-500/50 bg-black/30 shadow-[0_0_32px_rgba(225,29,72,0.22)]">
              <img className="h-11 w-11 object-contain" src={logoSrc} alt="Santos Tech" />
            </div>
            <CardTitle className="pt-1 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
              Entrar
            </CardTitle>
            <CardDescription className="mx-auto max-w-xs text-sm leading-6 text-white/68">
              Acesse o Portal do Aluno com o mesmo usuario e senha usados no painel.
            </CardDescription>
          </CardHeader>

          <CardContent className="relative z-10 px-6 pb-6 sm:px-8 sm:pb-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2.5">
                <Label
                  htmlFor="login-usuario"
                  className="text-[13px] font-semibold tracking-[0.08em] text-white/86 uppercase"
                >
                  Usuário
                </Label>
                <Input
                  id="login-usuario"
                  className="h-12 rounded-2xl border-white/16 bg-white/8 px-4 text-white shadow-[0_0_18px_rgba(225,29,72,0.12)] placeholder:text-white/45 hover:border-white/28 hover:bg-white/10 focus-visible:border-rose-500 focus-visible:ring-rose-500/24"
                  value={usuario}
                  onChange={(e) => dispatch({ type: "set_usuario", value: e.target.value })}
                  type="text"
                  autoComplete="username"
                  placeholder="Digite seu usuário"
                />
              </div>

              <div className="space-y-2.5">
                <Label
                  htmlFor="login-senha"
                  className="text-[13px] font-semibold tracking-[0.08em] text-white/86 uppercase"
                >
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="login-senha"
                    className="h-12 rounded-2xl border-white/16 bg-white/8 px-4 pr-12 text-white shadow-[0_0_18px_rgba(225,29,72,0.12)] placeholder:text-white/45 hover:border-white/28 hover:bg-white/10 focus-visible:border-rose-500 focus-visible:ring-rose-500/24"
                    value={senha}
                    onChange={(e) => dispatch({ type: "set_senha", value: e.target.value })}
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-2 h-8 w-8 -translate-y-1/2 rounded-xl border border-transparent bg-transparent text-white/78 hover:border-white/14 hover:bg-white/10 hover:text-white focus-visible:border-white/18 focus-visible:ring-white/18"
                    onClick={() => dispatch({ type: "toggle_mostrar_senha" })}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={mostrarSenha}
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-[12px] font-bold tracking-[0.08em] text-rose-200 no-underline hover:text-rose-100 hover:no-underline"
                  onClick={() => undefined}
                  disabled={loading}
                >
                  Esqueci minha senha
                </Button>
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-2xl border border-rose-500 bg-rose-600 text-sm font-black tracking-[0.18em] text-white uppercase shadow-[0_16px_38px_rgba(225,29,72,0.34)] hover:bg-rose-500 focus-visible:border-rose-400 focus-visible:ring-rose-500/28"
                disabled={!podeEntrar}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs tracking-[0.14em] text-white/54 uppercase">
              © {new Date().getFullYear()} Santos Tech
            </p>
          </CardContent>
        </Card>
      </div>

      {showLoadingScreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/78 px-5 backdrop-blur-md animate-in fade-in duration-200 motion-reduce:animate-none"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Card className="relative w-full max-w-[420px] rounded-[28px] border border-white/12 bg-slate-950/92 py-0 text-white shadow-[0_30px_90px_rgba(2,6,23,0.62)] animate-in zoom-in-95 fade-in duration-200 motion-reduce:animate-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(225,29,72,0.18),transparent_42%)]" />
            <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-8 text-center sm:px-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-rose-500/45 bg-rose-500/10">
                <img className="h-11 w-11 object-contain" src={logoSrc} alt="" />
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/6">
                <LoaderCircle className="h-8 w-8 animate-spin text-rose-500 motion-reduce:animate-none" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-[-0.03em] text-white">
                  {loadingTitle}
                </h2>
                <p className="mx-auto max-w-xs text-sm leading-6 text-white/72">
                  {loadingDescription}
                </p>
              </div>

              <div className="flex items-center gap-2" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-bounce motion-reduce:animate-none [animation-duration:900ms]" />
                <span
                  className="h-2 w-2 rounded-full bg-rose-500 animate-bounce motion-reduce:animate-none [animation-duration:900ms]"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="h-2 w-2 rounded-full bg-rose-500 animate-bounce motion-reduce:animate-none [animation-duration:900ms]"
                  style={{ animationDelay: "240ms" }}
                />
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
