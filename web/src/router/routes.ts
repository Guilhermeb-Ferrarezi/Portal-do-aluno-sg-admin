export type EstruturaCursoTab =
  | "cursos"
  | "modulos"
  | "fases"
  | "exercicios"
  | "conteiners"
  | "turmas";

const DASHBOARD_BASE = "/dashboard";
const OPERACOES_BASE = `${DASHBOARD_BASE}/operacao`;
const CONTEUDO_BASE = `${DASHBOARD_BASE}/conteudo`;
const USUARIOS_BASE = `${DASHBOARD_BASE}/usuarios`;
const SISTEMA_BASE = `${DASHBOARD_BASE}/sistema`;
const ESTRUTURA_CURSO_BASE = `${CONTEUDO_BASE}/estrutura`;

export const appRoutes = {
  login: "/login",
  passwordRecovery: "/recuperar-senha",
  authSso: "/auth/sso",
  dashboard: DASHBOARD_BASE,
  profile: `${DASHBOARD_BASE}/perfil`,
  operations: {
    base: OPERACOES_BASE,
    turmas: `${OPERACOES_BASE}/turmas`,
    turmaDetalhe: (id: string) => `${OPERACOES_BASE}/turmas/${id}`,
    metas: `${OPERACOES_BASE}/metas`,
    medalhas: `${OPERACOES_BASE}/medalhas`,
    notificacoes: `${OPERACOES_BASE}/notificacoes`,
    rankings: {
      base: `${OPERACOES_BASE}/rankings`,
      notas: `${OPERACOES_BASE}/rankings/notas`,
      pontos: `${OPERACOES_BASE}/rankings/pontos`,
      eventos: `${OPERACOES_BASE}/rankings/eventos`,
    },
  },
  content: {
    base: CONTEUDO_BASE,
    exercicios: `${CONTEUDO_BASE}/exercicios`,
    exercicioDetalhe: (id: string) => `${CONTEUDO_BASE}/exercicios/${id}`,
    materiais: `${CONTEUDO_BASE}/materiais`,
    videoaulas: `${CONTEUDO_BASE}/videoaulas`,
    estruturaCurso: {
      base: ESTRUTURA_CURSO_BASE,
      root: `${ESTRUTURA_CURSO_BASE}/cursos`,
      tab: (tab: EstruturaCursoTab) => `${ESTRUTURA_CURSO_BASE}/${tab}`,
    },
  },
  people: {
    base: USUARIOS_BASE,
    usuarios: `${USUARIOS_BASE}/usuarios`,
    criar: `${USUARIOS_BASE}/criar`,
  },
  system: {
    base: SISTEMA_BASE,
    logs: `${SISTEMA_BASE}/logs`,
    observabilidade: `${SISTEMA_BASE}/observabilidade`,
  },
  // Transitional flat accessors for app-internal callers.
  exercicios: `${CONTEUDO_BASE}/exercicios`,
  exercicioDetalhe: (id: string) => `${CONTEUDO_BASE}/exercicios/${id}`,
  materiais: `${CONTEUDO_BASE}/materiais`,
  videoaulas: `${CONTEUDO_BASE}/videoaulas`,
  medalhas: `${OPERACOES_BASE}/medalhas`,
  metas: `${OPERACOES_BASE}/metas`,
  perfil: `${DASHBOARD_BASE}/perfil`,
  turmas: `${OPERACOES_BASE}/turmas`,
  turmaDetalhe: (id: string) => `${OPERACOES_BASE}/turmas/${id}`,
  criarUsuario: `${USUARIOS_BASE}/criar`,
  usuarios: `${USUARIOS_BASE}/usuarios`,
  notificacoes: `${OPERACOES_BASE}/notificacoes`,
  rankingNotas: `${OPERACOES_BASE}/rankings/notas`,
  rankingPontos: `${OPERACOES_BASE}/rankings/pontos`,
  rankingEventos: `${OPERACOES_BASE}/rankings/eventos`,
  logs: `${SISTEMA_BASE}/logs`,
  observabilidade: `${SISTEMA_BASE}/observabilidade`,
  estruturaCurso: {
    base: ESTRUTURA_CURSO_BASE,
    root: `${ESTRUTURA_CURSO_BASE}/cursos`,
    tab: (tab: EstruturaCursoTab) => `${ESTRUTURA_CURSO_BASE}/${tab}`,
  },
} as const;

export function isExactRoute(pathname: string, target: string) {
  return pathname === target;
}

export function isRouteBranch(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
