export { API_BASE_URL, apiFetch, uploadFormData } from "./core";
export type { UserRef, PaginationMeta, PaginatedItemsResponse, UploadOptions, UploadProgress } from "./core";

export {
  login,
  solicitarRecuperacaoSenha,
  validarTokenRecuperacaoSenha,
  redefinirSenha,
  logoutWithServer,
  createPresenceSocketTicket,
  startStudentViewSso,
} from "./auth";

export type {
  Exercicio,
  TipoExercicio,
  ExerciseMultipleChoiceOption,
  ExerciseMultipleChoiceQuestion,
  ExerciseAIDraft,
  Submissao,
  ExerciseAnswerItem,
  ExerciseAnswersByStudent,
  ExerciseAnswersResponse,
  ExerciseAnswerStudent,
  AnsweredExerciseByStudent,
} from "./exercicios";
export {
  listarExercicios,
  listarTarefasDiarias,
  obterExercicio,
  gerarRascunhoExercicioIA,
  criarExercicio,
  atualizarExercicio,
  anexarExercicioArquivo,
  removerExercicioArquivo,
  deletarExercicio,
  enviarSubmissao,
  enviarSubmissaoComArquivo,
  minhasSubmissoes,
  todasMinhasSubmissoes,
  listarSubmissoesExercicio,
  listarAnswersExercicio,
  listarAlunosQueResponderam,
  listarAlunosQueResponderamPaginado,
  listarExerciciosRespondidosPorAluno,
  atualizarAnswer,
  atualizarAnswersEmLote,
  corrigirSubmissao,
  reordenarExercicio,
} from "./exercicios";

export type {
  Turma,
  TurmaAlunoPhaseStatus,
  TurmaAluno,
  ClassRoomStatus,
  ClassRoomExercise,
  ClassRoom,
  ClassRoomAvailableExercise,
  CronogramaSemana,
} from "./turmas";
export {
  listarTurmas,
  obterTurmasResponsavel,
  obterTotalTurmas,
  obterContagemAlunosDashboard,
  obterTurma,
  criarTurma,
  atualizarTurma,
  deletarTurma,
  adicionarAlunosNaTurma,
  removerAlunoDaTurma,
  iniciarFasesNaTurma,
  atribuirExerciciosNaTurma,
  removerExercicioDaTurma,
  configurarCronograma,
  obterCronograma,
  listarSalasDaTurma,
  listarExerciciosDisponiveisSala,
  criarSalaDaTurma,
  atualizarSalaDaTurma,
  atualizarStatusSalaDaTurma,
  deletarSalaDaTurma,
} from "./turmas";

export type { User, UserMe } from "./users";
export {
  obterUsuarioAtual,
  atualizarMeuPerfil,
  uploadMinhaFotoPerfil,
  uploadMeuBannerPerfil,
  alterarMinhaSenha,
  listarProfessores,
  listarAlunos,
  listarAdmins,
  listarUsuariosPaginado,
  atualizarUsuario,
  deletarUsuario,
  getRole,
} from "./users";

export type { Material } from "./materiais";
export {
  listarMateriais,
  obterMaterial,
  criarMaterial,
  atualizarMaterial,
  deletarMaterial,
  atribuirMaterialTurmas,
  removerMaterialDaTurma,
} from "./materiais";

export type { Videoaula } from "./videoaulas";
export {
  listarVideoaulas,
  obterVideoaula,
  criarVideoaula,
  atualizarVideoaula,
  deletarVideoaula,
  atribuirVideoaulaTurmas,
  removerVideoaulaDaTurma,
} from "./videoaulas";

export type {
  Modulo,
  Curso,
  Fase,
  ExercicioFase,
  ContainerGroup,
  ContainerExerciseInfo,
} from "./estrutura";
export {
  listarModulos,
  obterEstruturaStats,
  listarCursos,
  criarCurso,
  deletarCurso,
  listarModulosPorCurso,
  criarModulo,
  deletarModulo,
  reordenarModulo,
  listarFasesDoModulo,
  criarFase,
  deletarFase,
  reordenarFase,
  listarExerciciosPorFase,
  listarContainersPorFase,
  criarContainer,
  deletarContainerGroup,
  adicionarExerciciosAoContainer,
  removerExercicioDoContainer,
} from "./estrutura";

export type { Badge, BadgeHolder } from "./badges";
export {
  listarBadges,
  criarBadge,
  atualizarBadge,
  deletarBadge,
  listarBadgeHolders,
  atualizarBadgeDoUsuario,
  atribuirBadgeAoUsuario,
  removerBadgeDoUsuario,
} from "./badges";
export type { Goal, GoalReward, GoalStudent, GoalType } from "./goals";
export {
  GOAL_TYPE,
  listarGoals,
  obterGoal,
  criarGoal,
  atualizarGoal,
  deletarGoal,
  listarGoalRewards,
  criarGoalReward,
  atualizarGoalReward,
  deletarGoalReward,
  listarGoalStudents,
  atribuirGoalAoAluno,
  atualizarProgressoAluno,
  deletarGoalStudent,
  resgatarRecompensa,
} from "./goals";

export type { ActivityLog } from "./activityLogs";
export { listarActivityLogs } from "./activityLogs";
export type {
  MonitoringBreakdownItem,
  MonitoringMethodItem,
  MonitoringSnapshot,
  MonitoringStatusItem,
  MonitoringTotals,
} from "./monitoring";
export { fetchMonitoringSnapshot } from "./monitoring";
export type { NotificationTemplate, NotificationDispatch, UserNotification } from "./notifications";
export {
  listarMinhasNotificacoes,
  marcarTodasNotificacoesComoLidas,
  marcarNotificacaoComoLida,
  listarTemplatesNotificacao,
  criarTemplateNotificacao,
  atualizarTemplateNotificacao,
  deletarTemplateNotificacao,
  listarDisparosNotificacao,
  deletarDisparoNotificacao,
  dispararTemplateNotificacao,
} from "./notifications";

export type {
  CustomResponse,
  RankingEventType,
  PointRanking,
  CategoryRankingEntry,
  RankingPerCategory,
  RankingCategory,
  PageResult,
  RankingEventAward,
  RankingEventListItem,
  RankingEventInput,
  RankingEventResponse,
  RankingEventHistoryItem,
} from "./rankings";
export {
  RANKING_EVENT_TYPE,
  RANKING_EVENT_TYPE_LABEL,
  getRankingPoints,
  getRankingCategories,
  getAvailableRankingPerCategory,
  getAvailableRankingPerCategoryPage,
  getRankingEventsByType,
  getRankingEventHistory,
  getRankingEventHistoryPage,
  scheduleRankingEvent,
  criarRankingEvent,
  atualizarRankingEvent,
  deletarRankingEvent,
} from "./rankings";
