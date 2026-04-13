import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { setToken, setRefreshToken, notifyAuthChanged } from "@/auth/auth";
import { API_BASE_URL } from "@/services/api";
import { appRoutes } from "@/router/routes";

export default function SsoCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code");
  const [error, setError] = useState<string | null>(() =>
    code ? null : "Codigo SSO ausente na URL."
  );
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;

    if (!code) {
      return;
    }

    exchanged.current = true;

    async function exchange(ssoCode: string) {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/sso?code=${encodeURIComponent(ssoCode)}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.message ?? "Falha na autenticacao SSO.");
          return;
        }

        setToken(data.token);
        setRefreshToken(data.refreshToken);
        localStorage.setItem("nome", data.user?.nome ?? "");
        localStorage.removeItem("role");
        notifyAuthChanged();

        navigate(appRoutes.dashboard, { replace: true });
      } catch {
        setError("Erro de conexao ao validar SSO.");
      }
    }

    exchange(code);
  }, [code, navigate]);

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
          fontWeight: 600,
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <p style={{ color: "var(--destructive, #ef4444)", marginBottom: "1rem" }}>
            {error}
          </p>
          <a href={appRoutes.login} style={{ color: "var(--primary)", textDecoration: "underline" }}>
            Voltar ao login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        color: "var(--muted)",
        fontWeight: 600,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <LoaderCircle className="animate-spin" size={20} />
        Autenticando via SSO...
      </div>
    </div>
  );
}
