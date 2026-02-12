import React from "react";
import { useNavigate } from "react-router-dom";
import { getName, getRole, getToken, getUserId, isTokenExpired } from "../../../../auth/auth";
import { listarTurmas, apiFetch, logoutWithServer, type User } from "../../../../services/api";
import DashboardLayout from "../../DashboardLayout";
import "./CreateUser.css";

type Role = "admin" | "professor" | "aluno";

type Msg = {
  text: string;
  type: "ok" | "error";
};

type Turma = {
  id: string;
  nome: string;
  tipo: "turma" | "particular";
  professorId: string | null;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt?: string;
};

function roleLabel(role: Role | null) {
  if (role === "admin") return "Administrador";
  if (role === "professor") return "Professor";
  return "Aluno";
}

export default function CreateUser() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [role, setRole] = React.useState<Role>("aluno");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<Msg | null>(null);

  const [tipoAluno, setTipoAluno] = React.useState<"turma" | "particular">("turma");
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [professorSelecionado, setProfessorSelecionado] = React.useState("");
  const [professores, setProfessores] = React.useState<User[]>([]);

  const viewerName = getName() ?? "Usuário";
  const viewerRole = getRole();

  React.useEffect(() => {
    async function loadData() {
      try {
        const turmas = await listarTurmas();
        setTurmasDisponiveis(turmas);

        // Carregar lista de responsáveis (admins + professores)
        if (viewerRole === "admin") {
          Promise.all([
            apiFetch<User[]>("/users?role=professor"),
            apiFetch<User[]>("/users?role=admin")
          ])
            .then(([profs, admins]) => {
              setProfessores([...admins, ...profs].sort((a, b) => a.nome.localeCompare(b.nome)));
            })
            .catch(err => console.error("Erro ao carregar responsáveis:", err));
        } else if (viewerRole === "professor") {
          apiFetch<User[]>("/users?role=professor")
            .then(setProfessores)
            .catch(err => console.error("Erro ao carregar professores:", err));
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      }
    }
    loadData();
  }, [viewerRole]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const token = getToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    if (isTokenExpired(token)) {
      await logoutWithServer();
      navigate("/login", { replace: true });
      return;
    }

    setLoading(true);
    try {
      const body: any = { usuario, nome, senha, role };

      if (role === "aluno" && tipoAluno === "turma" && turmasSelecionadas.length > 0) {
        body.turma_ids = turmasSelecionadas;
      } else if (role === "aluno" && tipoAluno === "particular" && professorSelecionado) {
        body.professor_id = professorSelecionado;
      }

      const res = await fetch("https://portaldoaluno.santos-tech.com/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        await logoutWithServer();
        navigate("/login", { replace: true });
        return;
      }

      if (!res.ok) {
        setMsg({ text: data?.message ?? "Erro ao criar usuário", type: "error" });
        return;
      }

      setMsg({ text: "Usuário criado com sucesso!", type: "ok" });
      setUsuario("");
      setNome("");
      setSenha("");
      setRole("aluno");
      setTipoAluno("turma");
      setTurmasSelecionadas([]);
      setProfessorSelecionado("");
    } catch {
      setMsg({ text: "Falha de rede ao criar usuário", type: "error" });
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
            <p>Disponível para admin e professor.</p>
          </div>

          <form onSubmit={handleSubmit} className="cuForm">
            <label>
              Usuário
              <input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="ex: joao.silva"
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

            {(viewerRole === "professor" || (viewerRole === "admin" && role === "aluno")) && (
              <>
                <div className="cuRadioGroup">
                  <label className="cuRadio">
                    <input
                      type="radio"
                      checked={tipoAluno === "turma"}
                      onChange={() => {
                        setTipoAluno("turma");
                        setTurmasSelecionadas([]);
                      }}
                    />
                    <span>Turma</span>
                  </label>
                  <label className="cuRadio">
                    <input
                      type="radio"
                      checked={tipoAluno === "particular"}
                      onChange={() => {
                        setTipoAluno("particular");
                        setProfessorSelecionado("");
                      }}
                    />
                    <span>Particular</span>
                  </label>
                </div>

                {tipoAluno === "turma" && (
                  <label>
                    Turmas
                    <select
                      multiple
                      value={turmasSelecionadas}
                      onChange={(e) =>
                        setTurmasSelecionadas(
                          Array.from(e.target.selectedOptions, (opt) => opt.value)
                        )
                      }
                      size={3}
                    >
                      {turmasDisponiveis
                        .filter((t) =>
                          viewerRole === "professor" ? t.professorId === getToken() : true
                        )
                        .map((turma) => (
                          <option key={turma.id} value={turma.id}>
                            {turma.nome}
                          </option>
                        ))}
                    </select>
                    <small>Segure Ctrl/Cmd para selecionar múltiplas turmas</small>
                  </label>
                )}

                {tipoAluno === "particular" && (
                  <label>
                    Responsável pelo Aluno
                    <select
                      value={professorSelecionado}
                      onChange={(e) => setProfessorSelecionado(e.target.value)}
                      required
                    >
                      <option value="">Selecione um responsável</option>
                      {(viewerRole === "professor" || viewerRole === "admin") && (
                        <option value={getUserId() || ""}>
                          Eu mesmo ({viewerRole === "admin" ? "Admin" : "Professor"})
                        </option>
                      )}
                      {professores
                        .filter(p => p.id !== getUserId())
                        .map((prof) => (
                          <option key={prof.id} value={prof.id}>
                            {prof.nome} ({prof.role === "admin" ? "Admin" : "Professor"})
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            )}

            {msg ? (
              <div className={`cuMsg ${msg.type}`}>{msg.text}</div>
            ) : null}

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
            <div className="cuAvatar">
              {viewerName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="cuUserName">{viewerName}</div>
              <div className="cuUserRole">{roleLabel(viewerRole)}</div>
            </div>
          </div>

          <div className="cuInfo">
            <div className="cuInfoTitle">Seu acesso</div>
            <p>
              Você pode cadastrar novos perfis para organizar a turma, manter o
              controle de acessos e delegar funções.
            </p>

            <div className="cuPills">
              <span>Aluno</span>
              <span>Professor</span>
              <span>Administrador</span>
            </div>

            <div className="cuTip">
              Dica: use senhas fortes e mantenha o cargo adequado para cada
              pessoa.
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
