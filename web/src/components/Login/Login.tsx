import React, { useMemo, useRef, useState, useEffect } from "react";
import "./Login.css";
import { login } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { notifyAuthChanged } from "../../auth/auth";

function EyeIcon() {
  return (
    <svg
      className="login-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="login-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.1 7.1C4.1 9 2 12 2 12s3.5 7 10 7c2 0 3.7-.6 5.1-1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14.6 14.6C13.8 15.5 12.9 16 12 16a4 4 0 0 1-4-4c0-.9.5-1.8 1.4-2.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // countdown
  const [segundos, setSegundos] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  // evita setState depois do unmount
  const mountedRef = useRef(true);

  // dark mode detection
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  const podeEntrar = useMemo(() => {
    return usuario.trim().length > 0 && senha.trim().length > 0 && !loading;
  }, [usuario, senha, loading]);

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
    // Listen for changes to data-theme attribute
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (mountedRef.current) {
        setIsDarkMode(isDark);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!podeEntrar) return;

    // reseta mensagens/contagem
    setErro(null);
    setSucesso(null);
    clearCountdown();

    setLoading(true);

    try {
      const data = await login({ usuario: usuario.trim(), senha });

      if (!mountedRef.current) return;

      // salva auth
      localStorage.setItem("token", data.token);
      localStorage.setItem("nome", data.user?.nome ?? "");
      localStorage.setItem("role", data.user?.role ?? "aluno");
      notifyAuthChanged();

      setSucesso(data.message ?? "Login realizado!");
      setErro(null);

      // inicia contagem 2s e depois navega
      setSegundos(2);

      intervalRef.current = window.setInterval(() => {
        setSegundos((prev) => {
          if (prev === null) return null;

          if (prev <= 1) {
            if (intervalRef.current !== null) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }

            // ✅ navega fora do render: aqui é callback de intervalo
            // troca "/dashboard" se tua rota for "/Home"
            navigate("/dashboard", { replace: true });
            return 0;
          }

          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      if (!mountedRef.current) return;

      setErro(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }

  return (
    <div className={`login-page ${isDarkMode ? 'dark-mode' : ''}`}>
      <div className="login-card">
        <header className="login-header">
          <div className="login-logo" aria-hidden>
            <img
              className="login-logo-img"
              src="/logoPreta.png"
              alt="Santos Tech"
            />
          </div>
          <h1 className="login-title">Entrar</h1>
          <p className="login-subtitle">Acesse o Portal do Aluno</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label">
            Usuário
            <input
              className="login-input"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              type="text"
              autoComplete="username"
              placeholder="Digite seu usuário"
            />
          </label>

          <label className="login-label">
            Senha
            <div className="login-input-wrapper">
              <input
                className="login-input login-input--with-toggle"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha"
              />

              <button
                type="button"
                className="login-toggle"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={mostrarSenha}
              >
                {mostrarSenha ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          <div className="login-links-row">
            <button
              type="button"
              className="login-link-btn"
              onClick={() => console.log("Esqueci senha")}
              disabled={loading}
            >
              Esqueci minha senha
            </button>
          </div>

          {sucesso && segundos !== null && (
            <div className="login-success">
              {sucesso} <br />
              Redirecionando em {segundos}s
            </div>
          )}

          {erro && <div className="login-error">{erro}</div>}

          <button
            type="submit"
            className="login-primary-btn"
            disabled={!podeEntrar}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="login-footer">© {new Date().getFullYear()} Santos Tech</p>
      </div>
    </div>
  );
}
