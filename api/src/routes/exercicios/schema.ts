import { pool } from "../../db";
import type { ExerciseSchemaInfo, NewExerciseRow } from "./types";
import { mapNewExerciseRow } from "./helpers";
import { loadNewSchemaMultiplaMap } from "./questions";

let exerciseSchemaInfoCache: ExerciseSchemaInfo | null = null;

export async function getExerciseSchemaInfo(): Promise<ExerciseSchemaInfo> {
  if (exerciseSchemaInfoCache) return exerciseSchemaInfoCache;
  const r = await pool.query<{
    has_exercicios: boolean;
    has_turmas: boolean;
    has_aluno_turma: boolean;
    has_daily_tasks: boolean;
    has_exercise: boolean;
    has_question: boolean;
    has_question_option: boolean;
    has_exercicios_is_daily_task: boolean;
    has_exercise_is_daily_task: boolean;
    has_exercise_video_url: boolean;
    has_exercise_difficulty: boolean;
    has_exercise_index_order: boolean;
    has_exercise_is_final_exercise: boolean;
    has_exercise_points_redeem: boolean;
    has_exercise_exercise_period: boolean;
    exercise_answer_key_column: string | null;
  }>(
    `SELECT
       to_regclass('public.exercicios') IS NOT NULL AS has_exercicios,
       to_regclass('public.turmas') IS NOT NULL AS has_turmas,
       to_regclass('public.aluno_turma') IS NOT NULL AS has_aluno_turma,
       to_regclass('public.daily_tasks') IS NOT NULL AS has_daily_tasks,
       to_regclass('public.exercise') IS NOT NULL AS has_exercise,
       to_regclass('public.question') IS NOT NULL AS has_question,
       to_regclass('public.question_option') IS NOT NULL AS has_question_option,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'exercicios'
           AND column_name = 'is_daily_task'
       ) AS has_exercicios_is_daily_task,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'exercise'
           AND column_name = 'is_daily_task'
       ) AS has_exercise_is_daily_task,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'exercise'
           AND column_name = 'video_url'
       ) AS has_exercise_video_url,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'exercise'
           AND column_name = 'difficulty'
       ) AS has_exercise_difficulty,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'exercise'
           AND column_name = 'index_order'
       ) AS has_exercise_index_order,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'exercise'
           AND column_name = 'is_final_exercise'
       ) AS has_exercise_is_final_exercise,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'exercise'
           AND column_name = 'points_redeem'
       ) AS has_exercise_points_redeem,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'exercise'
           AND column_name = 'exercise_period'
       ) AS has_exercise_exercise_period,
       (
         SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'exercise'
           AND column_name IN ('gabarito', 'answer_key', 'expected_answer', 'solution')
         ORDER BY CASE column_name
           WHEN 'gabarito' THEN 1
           WHEN 'answer_key' THEN 2
           WHEN 'expected_answer' THEN 3
           WHEN 'solution' THEN 4
           ELSE 10
         END
         LIMIT 1
       ) AS exercise_answer_key_column`
  );
  exerciseSchemaInfoCache = {
    hasExercicios: !!r.rows[0]?.has_exercicios,
    hasTurmas: !!r.rows[0]?.has_turmas,
    hasAlunoTurma: !!r.rows[0]?.has_aluno_turma,
    hasDailyTasks: !!r.rows[0]?.has_daily_tasks,
    hasExercise: !!r.rows[0]?.has_exercise,
    hasQuestion: !!r.rows[0]?.has_question,
    hasQuestionOption: !!r.rows[0]?.has_question_option,
    hasExerciciosIsDailyTask: !!r.rows[0]?.has_exercicios_is_daily_task,
    hasExerciseIsDailyTask: !!r.rows[0]?.has_exercise_is_daily_task,
    hasExerciseVideoUrl: !!r.rows[0]?.has_exercise_video_url,
    hasExerciseDifficulty: !!r.rows[0]?.has_exercise_difficulty,
    hasExerciseIndexOrder: !!r.rows[0]?.has_exercise_index_order,
    hasExerciseIsFinalExercise: !!r.rows[0]?.has_exercise_is_final_exercise,
    hasExercisePointsRedeem: !!r.rows[0]?.has_exercise_points_redeem,
    hasExerciseExercisePeriod: !!r.rows[0]?.has_exercise_exercise_period,
    exerciseAnswerKeyColumn: r.rows[0]?.exercise_answer_key_column ?? null,
  };
  return exerciseSchemaInfoCache;
}

export function getNewExerciseSelectFields(
  schema: ExerciseSchemaInfo,
  options: { includeDailyTaskMeta?: boolean; tableAlias?: string } = {}
) {
  const alias = options.tableAlias ?? "e";
  const fields = [
    `${alias}.id`,
    `${alias}.title`,
    `${alias}.description`,
    `${alias}.phase_id`,
    "m.name AS modulo",
    "p.name AS tema",
    `${alias}.term_at`,
    `${alias}.created_at`,
    `${alias}.updated_at`,
    `${alias}.type_exercise`,
    `${schema.hasExerciseIsDailyTask ? `COALESCE(${alias}.is_daily_task, false)` : "false"} AS is_daily_task`,
    `${schema.hasExerciseVideoUrl ? `${alias}.video_url` : "NULL::text AS video_url"}`,
    `${schema.hasExerciseDifficulty ? `${alias}.difficulty` : "NULL::int AS difficulty"}`,
    `${schema.hasExerciseIndexOrder ? `${alias}.index_order` : "NULL::int AS index_order"}`,
    `${schema.hasExerciseIsFinalExercise ? `COALESCE(${alias}.is_final_exercise, false)` : "false"} AS is_final_exercise`,
    `${schema.hasExercisePointsRedeem ? `${alias}.points_redeem` : "NULL::int AS points_redeem"}`,
    `${schema.hasExerciseExercisePeriod ? `${alias}.exercise_period` : "NULL::timestamptz AS exercise_period"}`,
    `(SELECT ct.name FROM container_tasks ct WHERE ct.exercise_id = ${alias}.id LIMIT 1) AS container_name`,
    `(SELECT ct.container_date_target_int FROM container_tasks ct WHERE ct.exercise_id = ${alias}.id LIMIT 1) AS container_day`,
    `(SELECT ct.is_daily_task FROM container_tasks ct WHERE ct.exercise_id = ${alias}.id LIMIT 1) AS container_is_daily_task`,
  ];

  if (options.includeDailyTaskMeta) {
    fields.unshift(
      schema.hasDailyTasks ? "dt.name AS daily_task_name" : "NULL::text AS daily_task_name"
    );
    fields.unshift(
      schema.hasDailyTasks ? "dt.id AS daily_task_id" : "NULL::bigint AS daily_task_id"
    );
  }

  return fields;
}

export function getNewExerciseReturningFields(schema: ExerciseSchemaInfo) {
  return [
    "id",
    "title",
    "description",
    "phase_id",
    "term_at",
    "type_exercise",
    "created_at",
    "updated_at",
    `${schema.hasExerciseIsDailyTask ? "COALESCE(is_daily_task, false)" : "false"} AS is_daily_task`,
    `${schema.hasExerciseVideoUrl ? "video_url" : "NULL::text AS video_url"}`,
    `${schema.hasExerciseDifficulty ? "difficulty" : "NULL::int AS difficulty"}`,
    `${schema.hasExerciseIndexOrder ? "index_order" : "NULL::int AS index_order"}`,
    `${schema.hasExerciseIsFinalExercise ? "COALESCE(is_final_exercise, false)" : "false"} AS is_final_exercise`,
    `${schema.hasExercisePointsRedeem ? "points_redeem" : "NULL::int AS points_redeem"}`,
    `${schema.hasExerciseExercisePeriod ? "exercise_period" : "NULL::timestamptz AS exercise_period"}`,
  ];
}

export async function mapNewExerciseRowsWithInteraction(rows: NewExerciseRow[]) {
  const multiplaMap = await loadNewSchemaMultiplaMap(
    pool,
    rows.map((row) => Number(row.id))
  );

  return rows.map((row) => mapNewExerciseRow(row, {
    multiplaQuestoes: multiplaMap.get(Number(row.id)) ?? [],
  }));
}

export async function listFromNewExerciseSchema(userId: string | undefined, isAluno: boolean, schema: ExerciseSchemaInfo) {
  const params: any[] = [];
  const where: string[] = [];
  if (schema.hasExerciseIsDailyTask) {
    where.push(`(
      COALESCE(e.is_daily_task, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM container_tasks ct
        WHERE ct.exercise_id = e.id
          AND COALESCE(ct.is_daily_task, false) = true
      )
    )`);
  }
  if (isAluno) {
    params.push(userId);
    where.push(`(
      EXISTS (
        SELECT 1
        FROM enrollment en
        JOIN class c ON c.id = en.class_id
        JOIN phase p2 ON p2.module_id = c.current_module_id
        WHERE en.user_id = $1
          AND p2.id = e.phase_id
      )
      OR EXISTS (
        SELECT 1
        FROM progress_paid_courses ppc
        JOIN course co ON co.id = ppc.course_id
        JOIN module m2 ON m2.course_id = co.id
        JOIN phase p2 ON p2.module_id = m2.id
        WHERE ppc.user_id = $1
          AND p2.id = e.phase_id
          AND m2.index_order <= CEIL(ppc.progress_percentage / 100 * COALESCE((SELECT COUNT(*) FROM module WHERE course_id = co.id), 1))
      )
    )`);
  }

  const q = `
    SELECT
      ${getNewExerciseSelectFields(schema).join(",\n      ")}
    FROM exercise e
    JOIN phase p ON p.id = e.phase_id
    JOIN module m ON m.id = p.module_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY e.created_at DESC
  `;

  const r = await pool.query<NewExerciseRow>(q, params);
  const items = await mapNewExerciseRowsWithInteraction(r.rows);
  return items.map((item, index) => {
    const row = r.rows[index];
    return {
      ...item,
    tema: row.tema ?? row.daily_task_name ?? null,
    dailyTaskId: row.daily_task_id != null ? String(row.daily_task_id) : null,
    dailyTaskName: row.daily_task_name ?? null,
    isDailyTask: schema.hasExerciseIsDailyTask ? !!row.is_daily_task : true,
    };
  });
}

export async function listDailyTasksFromNewExerciseSchema(
  userId: string | undefined,
  isAluno: boolean,
  schema: ExerciseSchemaInfo
) {
  const params: any[] = [];
  const where: string[] = [];
  if (schema.hasExerciseIsDailyTask) {
    where.push(`(
      COALESCE(e.is_daily_task, false) = true
      OR EXISTS (
        SELECT 1
        FROM container_tasks ct
        WHERE ct.exercise_id = e.id
          AND COALESCE(ct.is_daily_task, false) = true
      )
    )`);
  } else {
    where.push(
      "(LOWER(COALESCE(e.title, '')) LIKE 'dia %' OR LOWER(COALESCE(p.name, '')) LIKE '%tarefa diaria%')"
    );
  }

  if (isAluno) {
    params.push(userId);
    where.push(`(
      EXISTS (
        SELECT 1
        FROM enrollment en
        JOIN class c ON c.id = en.class_id
        JOIN phase p2 ON p2.module_id = c.current_module_id
        WHERE en.user_id = $1
          AND p2.id = e.phase_id
      )
      OR EXISTS (
        SELECT 1
        FROM progress_paid_courses ppc
        JOIN course co ON co.id = ppc.course_id
        JOIN module m2 ON m2.course_id = co.id
        JOIN phase p2 ON p2.module_id = m2.id
        WHERE ppc.user_id = $1
          AND p2.id = e.phase_id
          AND m2.index_order <= CEIL(ppc.progress_percentage / 100 * COALESCE((SELECT COUNT(*) FROM module WHERE course_id = co.id), 1))
      )
    )`);
  }

  const q = `
    SELECT
      ${getNewExerciseSelectFields(schema, { includeDailyTaskMeta: true }).join(",\n      ")}
    FROM exercise e
    ${schema.hasDailyTasks ? "LEFT JOIN daily_tasks dt ON dt.exercise_id = e.id" : ""}
    JOIN phase p ON p.id = ${schema.hasDailyTasks ? "COALESCE(dt.phase_id, e.phase_id)" : "e.phase_id"}
    JOIN module m ON m.id = p.module_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY e.term_at ASC NULLS LAST, e.created_at DESC
  `;

  const r = await pool.query<NewExerciseRow>(q, params);
  const items = await mapNewExerciseRowsWithInteraction(r.rows);
  return items.map((item, index) => {
    const row = r.rows[index];
    return {
      ...item,
    tema: row.tema ?? row.daily_task_name ?? null,
    dailyTaskId: row.daily_task_id != null ? String(row.daily_task_id) : null,
    dailyTaskName: row.daily_task_name ?? null,
    isDailyTask: !!row.is_daily_task || !!row.container_is_daily_task,
    };
  });
}

export async function getFromNewExerciseSchema(
  id: string,
  userId: string | undefined,
  isAluno: boolean,
  schema: ExerciseSchemaInfo
) {
  const params: any[] = [id];
  const where: string[] = ["e.id = $1"];
  if (isAluno) {
    params.push(userId);
    where.push(`(
      EXISTS (
        SELECT 1
        FROM enrollment en
        JOIN class c ON c.id = en.class_id
        JOIN phase p2 ON p2.module_id = c.current_module_id
        WHERE en.user_id = $2
          AND p2.id = e.phase_id
      )
      OR EXISTS (
        SELECT 1
        FROM progress_paid_courses ppc
        JOIN course co ON co.id = ppc.course_id
        JOIN module m2 ON m2.course_id = co.id
        JOIN phase p2 ON p2.module_id = m2.id
        WHERE ppc.user_id = $2
          AND p2.id = e.phase_id
          AND m2.index_order <= CEIL(ppc.progress_percentage / 100 * COALESCE((SELECT COUNT(*) FROM module WHERE course_id = co.id), 1))
      )
    )`);
  }

  const q = `
    SELECT
      ${getNewExerciseSelectFields(schema).join(",\n      ")}
    FROM exercise e
    JOIN phase p ON p.id = e.phase_id
    JOIN module m ON m.id = p.module_id
    WHERE ${where.join(" AND ")}
    LIMIT 1
  `;

  const r = await pool.query<NewExerciseRow>(q, params);
  if (!r.rows[0]) return null;
  const [mapped] = await mapNewExerciseRowsWithInteraction([r.rows[0]]);
  return mapped ?? null;
}
