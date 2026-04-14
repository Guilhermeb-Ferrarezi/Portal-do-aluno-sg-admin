export type EstruturaCursoTab =
  | "cursos"
  | "modulos"
  | "fases"
  | "exercicios"
  | "conteiners"
  | "turmas";

const DASHBOARD_BASE = "/dashboard";
const ESTRUTURA_CURSO_BASE = `${DASHBOARD_BASE}/estrutura-curso`;

export const appRoutes = {
  login: "/login",
  authSso: "/auth/sso",
  dashboard: DASHBOARD_BASE,
  exercicios: `${DASHBOARD_BASE}/exercicios`,
  exercicioDetalhe: (id: string) => `${DASHBOARD_BASE}/exercicios/${id}`,
  materiais: `${DASHBOARD_BASE}/materiais`,
  videoaulas: `${DASHBOARD_BASE}/videoaulas`,
  medalhas: `${DASHBOARD_BASE}/medalhas`,
  perfil: `${DASHBOARD_BASE}/perfil`,
  turmas: `${DASHBOARD_BASE}/turmas`,
  turmaDetalhe: (id: string) => `${DASHBOARD_BASE}/turmas/${id}`,
  criarUsuario: `${DASHBOARD_BASE}/criar-usuario`,
  usuarios: `${DASHBOARD_BASE}/usuarios`,
  notificacoes: `${DASHBOARD_BASE}/notificacoes`,
  logs: `${DASHBOARD_BASE}/logs`,
  observabilidade: `${DASHBOARD_BASE}/observabilidade`,
  estruturaCurso: {
    base: ESTRUTURA_CURSO_BASE,
    root: `${ESTRUTURA_CURSO_BASE}/cursos`,
    tab: (tab: EstruturaCursoTab) => `${ESTRUTURA_CURSO_BASE}/${tab}`,
  },
  aliases: {
    exercicios: "/exercicios",
    turmas: "/turmas",
    criarUsuario: "/criar-usuario",
    usuarios: "/usuarios",
    logs: "/logs",
    observabilidade: "/observabilidade",
  },
} as const;

export function isExactRoute(pathname: string, target: string) {
  return pathname === target;
}

export function isRouteBranch(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
