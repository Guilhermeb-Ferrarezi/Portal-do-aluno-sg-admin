export type DBDate = string | Date;
export type TipoExercicio = "nenhum" | "codigo" | "texto" | "escrita" | "multipla"
export type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};
export type MultiplaOpcao = {
  letter: string;
  text: string;
};
export type MultiplaQuestao = {
  pergunta: string;
  opcoes: MultiplaOpcao[];
  respostaCorreta: string;
};
export type ExerciseAIDraft = {
  titulo: string;
  descricao: string;
  difficulty: number;
  pointsRedeem: number;
  suggestedComponentType: "escrita" | "multipla";
  multiplaQuestoes: MultiplaQuestao[];
};

export type ExercicioRow = {
  id: string;
  titulo: string;
  descricao: string;
  modulo: string;
  tema: string | null;
  prazo: DBDate | null;
  publicado: boolean;
  published_at: DBDate | null;
  is_daily_task?: boolean | null;
  created_by: string | null;
  tipo_exercicio: TipoExercicio | null;
  gabarito: string | null;
  linguagem_esperada: string | null;
  categoria: string;
  mouse_regras: string | null;
  multipla_regras: string | null;
  atalho_tipo: string | null;
  permitir_repeticao: boolean;
  max_tentativas: number | null;
  penalidade_por_tentativa: number | null;
  intervalo_reenvio: number | null;
  anexo_url: string | null;
  anexo_nome: string | null;
  created_at: DBDate;
  updated_at: DBDate;
};

export type ExercicioAccessRow = ExercicioRow & {
  turmas?: Array<{ id: string; nome: string; tipo: string }>;
  alunos?: Array<{ id: string; nome: string; usuario: string }>;
};

export type NewExerciseRow = {
  id: number;
  title: string;
  description: string | null;
  phase_id: number;
  term_at: DBDate | null;
  type_exercise: number | null;
  is_daily_task: boolean;
  video_url: string | null;
  difficulty: number | null;
  index_order: number | null;
  is_final_exercise: boolean;
  points_redeem: number | null;
  exercise_period: DBDate | null;
  created_at: DBDate;
  updated_at: DBDate;
  modulo?: string | null;
  tema?: string | null;
  daily_task_id?: number | null;
  daily_task_name?: string | null;
  container_name?: string | null;
  container_day?: number | null;
  container_is_daily_task?: boolean | null;
};

export type ExerciseSchemaInfo = {
  hasExercicios: boolean;
  hasTurmas: boolean;
  hasAlunoTurma: boolean;
  hasDailyTasks: boolean;
  hasExercise: boolean;
  hasQuestion: boolean;
  hasQuestionOption: boolean;
  hasExerciciosIsDailyTask: boolean;
  hasExerciseIsDailyTask: boolean;
  hasExerciseVideoUrl: boolean;
  hasExerciseDifficulty: boolean;
  hasExerciseIndexOrder: boolean;
  hasExerciseIsFinalExercise: boolean;
  hasExercisePointsRedeem: boolean;
  hasExerciseExercisePeriod: boolean;
  exerciseAnswerKeyColumn: string | null;
};

export type NewSchemaQuestionRow = {
  exercise_id: number;
  question_id: number | null;
  question_statement: string | null;
  option_id: number | null;
  option_text: string | null;
  is_correct: boolean | null;
};
