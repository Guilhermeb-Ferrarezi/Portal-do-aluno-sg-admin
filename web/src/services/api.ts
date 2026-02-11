// src/services/api.ts
type Role = "admin" | "professor" | "aluno";

export type UserRef = {
  id: string;
  usuario?: string;
  nome?: string;
};

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "/api"

async function parseError(res: Response) {
  const data = await res.json().catch(() => null);
  return data?.message ?? `Erro ${res.status}`;
}

export async function login(dados: { usuario: string; senha: string }) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    message: string;
    token: string;
    user: { id: string; usuario: string; nome: string; role: Role };
  }>;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as T;
}

export type Exercicio = {
  id: string;
  titulo: string;
  descricao: string;
  modulo: string;
  tema: string | null;
  prazo: string | null;
  publishedAt: string | null;
  tipoExercicio?: "nenhum" | "codigo" | "texto" | "escrita" | "mouse" | "multipla" | "atalho" | null;
  is_template?: boolean;
  categoria?: "programacao" | "informatica";
  mouse_regras?: string | null;
  multipla_regras?: string | null;
  atalho_tipo?: "copiar-colar" | "copiar-colar-imagens" | "selecionar-deletar" | null;
  permitir_repeticao?: boolean;
  createdAt: string;
  turmas?: Turma[];
  alunos?: UserRef[];
  aluno_ids?: string[];
};

export type TipoExercicio = "nenhum" | "codigo" | "texto" | "escrita" | "mouse" | "multipla" | "atalho";

export type Submissao = {
  id: string;
  exercicioId: string;
  alunoId: string;
  resposta: string;
  tipoResposta: TipoExercicio;
  linguagem: string | null;
  nota: number | null;
  corrigida: boolean;
  feedbackProfessor: string | null;
  isLate?: boolean;
  verificacaoDescricao?: number | null;
  createdAt: string;
};

export async function listarExercicios() {
  return apiFetch<Exercicio[]>("/exercicios");
}

export async function obterExercicio(id: string) {
  return apiFetch<Exercicio>(`/exercicios/${id}`);
}

export async function criarExercicio(dados: {
  titulo: string;
  descricao: string;
  modulo: string;
  tema?: string | null;
  prazo?: string | null;
  publicado?: boolean;
  gabarito?: string | null;
  linguagem_esperada?: string | null;
  is_template?: boolean;
  categoria?: "programacao" | "informatica";
  mouse_regras?: string | null;
  multipla_regras?: string | null;
  turma_ids?: string[];
  aluno_ids?: string[];
  tipoExercicio?: TipoExercicio;
}) {
  return apiFetch<{ message: string; exercicio: unknown }>("/exercicios", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarExercicio(id: string, dados: {
  titulo: string;
  descricao: string;
  modulo: string;
  tema?: string | null;
  prazo?: string | null;
  publicado?: boolean;
  gabarito?: string | null;
  linguagem_esperada?: string | null;
  is_template?: boolean;
  categoria?: "programacao" | "informatica";
  mouse_regras?: string | null;
  multipla_regras?: string | null;
  turma_ids?: string[];
  aluno_ids?: string[];
  tipoExercicio?: TipoExercicio;
}) {
  return apiFetch<{ message: string; exercicio: unknown }>(`/exercicios/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function deletarExercicio(id: string) {
  return apiFetch<{ message: string }>(`/exercicios/${id}`, {
    method: "DELETE",
  });
}

export async function enviarSubmissao(exercicioId: string, dados: {
  resposta: string;
  tipo_resposta: TipoExercicio;
  linguagem?: string;
}) {
  return apiFetch<{ message: string; submissao: Submissao }>(
    `/exercicios/${exercicioId}/submissoes`,
    {
      method: "POST",
      body: JSON.stringify(dados),
    }
  );
}

export async function minhasSubmissoes(exercicioId: string) {
  return apiFetch<Submissao[]>(`/exercicios/${exercicioId}/minhas-submissoes`);
}

export async function todasMinhasSubmissoes() {
  return apiFetch<Submissao[]>("/minhas-submissoes");
}

export async function listarSubmissoesExercicio(exercicioId: string) {
  return apiFetch<Array<Submissao & { alunoNome: string; alunoUsuario: string }>>(
    `/exercicios/${exercicioId}/submissoes`
  );
}

export async function corrigirSubmissao(submissaoId: string, dados: {
  nota: number;
  feedback?: string;
}) {
  return apiFetch<{ message: string; submissao: Submissao }>(
    `/submissoes/${submissaoId}/corrigir`,
    {
      method: "PUT",
      body: JSON.stringify(dados),
    }
  );
}

export type Turma = {
  id: string;
  nome: string;
  tipo: "turma" | "particular";
  categoria: "programacao" | "informatica";
  professorId: string | null;
  descricao: string | null;
  ativo: boolean;
  dataInicio?: string | null;
  duracaoSemanas?: number;
  cronogramaAtivo?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type CronogramaSemana = {
  semana: number;
  exercicios: Array<{
    id: string;
    titulo: string;
    modulo: string;
  }>;
};

// Funções de Turma
export async function listarTurmas() {
  return apiFetch<Turma[]>("/turmas");
}

export async function obterTurmasResponsavel() {
  return apiFetch<{ total: number }>("/turmas/meus-responsaveis/count");
}

export async function obterTotalTurmas() {
  return apiFetch<{ total: number }>("/turmas/total");
}

export async function obterTurma(id: string) {
  return apiFetch<Turma & {
    alunos: Array<{ id: string; usuario: string; nome: string; role: Role }>;
    exercicios: Array<{ id: string; titulo: string; modulo: string }>;
  }>(`/turmas/${id}`);
}

export async function criarTurma(dados: {
  nome: string;
  tipo: "turma" | "particular";
  categoria?: "programacao" | "informatica";
  professor_id?: string | null;
  descricao?: string | null;
  data_inicio?: string | null;
  duracao_semanas?: number;
  cronograma_ativo?: boolean;
}) {
  return apiFetch<{ message: string; turma: Turma }>("/turmas", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarTurma(id: string, dados: {
  nome?: string;
  tipo?: "turma" | "particular";
  categoria?: "programacao" | "informatica";
  professor_id?: string | null;
  descricao?: string | null;
  data_inicio?: string | null;
  duracao_semanas?: number;
  cronograma_ativo?: boolean;
}) {
  return apiFetch<{ message: string; turma: Turma }>(`/turmas/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function deletarTurma(id: string) {
  return apiFetch<{ message: string }>(`/turmas/${id}`, {
    method: "DELETE",
  });
}

export async function adicionarAlunosNaTurma(turmaId: string, alunoIds: string[]) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/alunos`, {
    method: "POST",
    body: JSON.stringify({ aluno_ids: alunoIds }),
  });
}

export async function removerAlunoDaTurma(turmaId: string, alunoId: string) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/alunos/${alunoId}`, {
    method: "DELETE",
  });
}

export async function atribuirExerciciosNaTurma(turmaId: string, exercicioIds: string[]) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/exercicios`, {
    method: "POST",
    body: JSON.stringify({ exercicio_ids: exercicioIds }),
  });
}

export async function removerExercicioDaTurma(turmaId: string, exercicioId: string) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/exercicios/${exercicioId}`, {
    method: "DELETE",
  });
}

export async function configurarCronograma(turmaId: string, semanas: Array<{
  semana: number;
  exercicios: string[];
}>) {
  return apiFetch<{ message: string }>(`/turmas/${turmaId}/cronograma`, {
    method: "POST",
    body: JSON.stringify({ semanas }),
  });
}

export async function obterCronograma(turmaId: string) {
  return apiFetch<{
    cronograma: Record<number, Array<{ id: string; titulo: string; modulo: string }>>;
    turma: {
      id: string;
      nome: string;
      dataInicio: string | null;
      duracaoSemanas: number;
      cronogramaAtivo: boolean;
    };
  }>(`/turmas/${turmaId}/cronograma`);
}

export type User = {
  id: string;
  usuario: string;
  nome: string;
  role: Role;
};

export type UserMe = User & {
  ativo: boolean;
  createdAt: string;
};

export async function obterUsuarioAtual() {
  return apiFetch<UserMe>("/users/me");
}

export async function atualizarMeuPerfil(dados: { nome: string }) {
  return apiFetch<{ message: string; user: UserMe }>("/users/me", {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function alterarMinhaSenha(dados: { senhaAtual: string; novaSenha: string }) {
  return apiFetch<{ message: string }>("/users/me/password", {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function listarProfessores() {
  return apiFetch<User[]>("/users?role=professor");
}

export async function listarAlunos() {
  return apiFetch<User[]>("/users?role=aluno");
}

export async function listarAdmins() {
  return apiFetch<User[]>("/users?role=admin");
}

export async function atualizarUsuario(
  id: string,
  dados: { nome?: string; usuario?: string; role?: Role; ativo?: boolean }
) {
  return apiFetch<{ message: string; user: UserMe }>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function deletarUsuario(id: string) {
  return apiFetch<{ message: string }>(`/users/${id}`, {
    method: "DELETE",
  });
}

export function getRole(): Role | null {
  const r = localStorage.getItem("role");
  return r === "admin" || r === "professor" || r === "aluno" ? r : null;
}

export type Material = {
  id: string;
  titulo: string;
  tipo: "arquivo" | "link";
  modulo: string;
  descricao: string | null;
  url: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  turmas?: Turma[];
  alunos?: UserRef[];
  aluno_ids?: string[];
};

export type Videoaula = {
  id: string;
  titulo: string;
  descricao: string | null;
  modulo: string;
  duracao: string | null;
  tipo: "youtube" | "vimeo" | "arquivo";
  url: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
  dataAdicionada?: string;
  turmas?: Turma[];
  alunos?: UserRef[];
  aluno_ids?: string[];
};

export async function listarMateriais(modulo?: string) {
  const query = modulo ? `?modulo=${encodeURIComponent(modulo)}` : "";
  return apiFetch<Material[]>(`/materiais${query}`);
}

export async function obterMaterial(id: string) {
  return apiFetch<Material>(`/materiais/${id}`);
}

export async function criarMaterial(dados: FormData) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/materiais`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: dados,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ message: string; material: Material }>;
}

export async function atualizarMaterial(id: string, dados: FormData) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/materiais/${id}`, {
    method: "PUT",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: dados,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ message: string; material: Material }>;
}

export async function deletarMaterial(id: string) {
  return apiFetch<{ message: string }>(`/materiais/${id}`, {
    method: "DELETE",
  });
}

export async function atribuirMaterialTurmas(materialId: string, turmaIds: string[]) {
  return apiFetch<{ message: string }>(`/materiais/${materialId}/turmas`, {
    method: "POST",
    body: JSON.stringify({ turma_ids: turmaIds }),
  });
}

export async function removerMaterialDaTurma(materialId: string, turmaId: string) {
  return apiFetch<{ message: string }>(`/materiais/${materialId}/turmas/${turmaId}`, {
    method: "DELETE",
  });
}

// Videoaulas
export async function listarVideoaulas(modulo?: string) {
  const query = modulo ? `?modulo=${encodeURIComponent(modulo)}` : "";
  return apiFetch<Videoaula[]>(`/videoaulas${query}`);
}

export async function obterVideoaula(id: string) {
  return apiFetch<Videoaula>(`/videoaulas/${id}`);
}

export async function criarVideoaula(dados: FormData) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/videoaulas`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: dados,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ message: string; videoaula: Videoaula }>;
}

export async function atualizarVideoaula(id: string, dados: FormData) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/videoaulas/${id}`, {
    method: "PUT",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: dados,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ message: string; videoaula: Videoaula }>;
}

export async function deletarVideoaula(id: string) {
  return apiFetch<{ message: string }>(`/videoaulas/${id}`, {
    method: "DELETE",
  });
}

export async function atribuirVideoaulaTurmas(videoaulaId: string, turmaIds: string[]) {
  return apiFetch<{ message: string }>(`/videoaulas/${videoaulaId}/turmas`, {
    method: "POST",
    body: JSON.stringify({ turma_ids: turmaIds }),
  });
}

export async function removerVideoaulaDaTurma(videoaulaId: string, turmaId: string) {
  return apiFetch<{ message: string }>(`/videoaulas/${videoaulaId}/turmas/${turmaId}`, {
    method: "DELETE",
  });
}
