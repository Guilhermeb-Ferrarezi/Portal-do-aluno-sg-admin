import React from "react";
import { useNavigate } from "react-router-dom";
import { getName, getRole } from "../../../../auth/auth";
import { apiFetch, logoutWithServer, type User } from "../../../../services/api";
import DashboardLayout from "../../DashboardLayout";
import "./CreateUser.css";

type Role = "admin" | "professor" | "aluno";

type Msg = {
  text: string;
  type: "ok" | "error";
};

function roleLabel(role: Role | null) {
  if (role === "admin") return "Administrador";
  if (role === "professor") return "Professor";
  return "Aluno";
}

export default function CreateUser() {
  const navigate = useNavigate();

  const [email, setEmail] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [role, setRole] = React.useState<Role>("aluno");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<Msg | null>(null);

  const viewerName = getName() ?? "Usuário";
  const viewerRole = getRole();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    setLoading(true);
    try {
      await apiFetch<{ message: string; user: User }>("/users", {
        method: "POST",
        body: JSON.stringify({ usuario: email, nome, senha, role }),
      });

      setMsg({ text: "Usuário criado com sucesso!", type: "ok" });
      setEmail("");
      setNome("");
      setSenha("");
      setRole("aluno");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao criar usuário";
      if (message.toLowerCase().includes("401")) {
        await logoutWithServer();
        navigate("/login", { replace: true });
        return;
      }
      setMsg({ text: message, type: "error" });
    } finally {
      setLoading(false);
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
            <p>Disponível para admin.</p>
          </div>

          <form onSubmit={handleSubmit} className="cuForm">
            <label>
              E-mail
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: usuario@dominio.com"
                required
              />
            </label>

            <label>
              Nome
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="ex: João Silva"
                required
              />
            </label>

            <label>
              Senha
              <input
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="min. 6 caracteres"
                type="password"
                required
                minLength={6}
              />
            </label>

            <label>
              Cargo
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="aluno">Aluno</option>
                <option value="professor">Professor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>

            {msg ? <div className={`cuMsg ${msg.type}`}>{msg.text}</div> : null}

            <div className="cuActions">
              <button
                type="button"
                className="cuBtn ghost"
                onClick={() => navigate("/dashboard")}
              >
                Voltar
              </button>
              <button type="submit" className="cuBtn" disabled={loading}>
                {loading ? "Criando..." : "Criar"}
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
            <div className="cuInfoTitle">Novo schema</div>
            <p>
              Esta tela cria usuários diretamente na tabela <code>"user"</code> com cargo
              numérico no banco e contrato compatível com o frontend.
            </p>

            <div className="cuPills">
              <span>Aluno</span>
              <span>Professor</span>
              <span>Administrador</span>
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
