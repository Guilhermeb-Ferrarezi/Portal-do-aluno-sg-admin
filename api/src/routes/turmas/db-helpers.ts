import { pool } from "../../db";
import type {
  Categoria,
  CourseColumnConfig,
  DbClassRow,
  DbCourseRow,
  DbModuleRow,
  DbPhaseRow,
  ProgressStudentPhaseConfig,
  Queryable,
} from "./types";
import { isMissingDatabaseObjectError } from "./helpers";

let courseColumnConfigCache: CourseColumnConfig | null = null;
let progressStudentPhaseConfigCache: ProgressStudentPhaseConfig | null = null;

export async function getCourseColumnConfig(forceRefresh = false): Promise<CourseColumnConfig> {
  if (!forceRefresh && courseColumnConfigCache) {
    return courseColumnConfigCache;
  }

  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'course'`
  );

  const columns = new Set(result.rows.map((row) => row.column_name));
  const durationColumn = columns.has("duration_hours") ? "duration_hours" : null;
  const levelColumn = columns.has("level_difficulty") ? "level_difficulty" : columns.has("level") ? "level" : null;
  const focusColumn = columns.has("paid_focus") ? "paid_focus" : columns.has("focus") ? "focus" : null;
  const priceColumn = columns.has("price") ? "price" : null;

  courseColumnConfigCache = {
    hasCourseTable: columns.size > 0,
    durationColumn,
    levelColumn,
    focusColumn,
    priceColumn,
    selectList: [
      "id",
      "name",
      "description",
      "is_paid",
      durationColumn ?? "NULL::int AS duration_hours",
      levelColumn ? `${levelColumn} AS level` : "NULL::text AS level",
      focusColumn ? `${focusColumn} AS focus` : "NULL::text AS focus",
      priceColumn ?? "NULL::numeric AS price",
    ].join(", "),
  };

  return courseColumnConfigCache;
}

export async function getProgressStudentPhaseConfig(forceRefresh = false): Promise<ProgressStudentPhaseConfig> {
  if (!forceRefresh && progressStudentPhaseConfigCache) {
    return progressStudentPhaseConfigCache;
  }

  const tableResult = await pool.query<{ has_table: boolean }>(
    `SELECT to_regclass('public.progress_student_phase') IS NOT NULL AS has_table`
  );

  if (!tableResult.rows[0]?.has_table) {
    progressStudentPhaseConfigCache = {
      hasTable: false,
      hasUserIdColumn: false,
      hasPhaseIdColumn: false,
      hasProgressColumn: false,
      hasStatusColumn: false,
      hasUnlockedAtColumn: false,
      hasCompletedAtColumn: false,
      hasCreatedAtColumn: false,
    };
    return progressStudentPhaseConfigCache;
  }

  const columnsResult = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'progress_student_phase'`
  );

  const columns = new Set(columnsResult.rows.map((row) => row.column_name));

  progressStudentPhaseConfigCache = {
    hasTable: true,
    hasUserIdColumn: columns.has("user_id"),
    hasPhaseIdColumn: columns.has("phase_id"),
    hasProgressColumn: columns.has("progress"),
    hasStatusColumn: columns.has("status"),
    hasUnlockedAtColumn: columns.has("unlocked_at"),
    hasCompletedAtColumn: columns.has("completed_at"),
    hasCreatedAtColumn: columns.has("created_at"),
  };

  return progressStudentPhaseConfigCache;
}

export async function getCourseById(courseId: number): Promise<DbCourseRow | null> {
  try {
    const courseColumns = await getCourseColumnConfig();
    if (!courseColumns.hasCourseTable) {
      return null;
    }

    const result = await pool.query<DbCourseRow>(
      `SELECT ${courseColumns.selectList}
       FROM course
       WHERE id = $1
       LIMIT 1`,
      [courseId]
    );
    return result.rows[0] ?? null;
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      return null;
    }
    throw error;
  }
}

export async function findPreferredCourse(categoria: Categoria): Promise<DbCourseRow | null> {
  try {
    const courseColumns = await getCourseColumnConfig();
    if (!courseColumns.hasCourseTable) {
      return null;
    }

    if (categoria === "informatica") {
      const inf = await pool.query<DbCourseRow>(
        `SELECT ${courseColumns.selectList}
         FROM course
         WHERE COALESCE(name, '') ILIKE '%informat%'
         ORDER BY id ASC
         LIMIT 1`
      );
      if (inf.rows[0]) return inf.rows[0];
    }

    const any = await pool.query<DbCourseRow>(
      `SELECT ${courseColumns.selectList}
       FROM course
       ORDER BY id ASC
       LIMIT 1`
    );
    return any.rows[0] ?? null;
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      return null;
    }
    throw error;
  }
}

export async function getModuleById(moduleId: number): Promise<DbModuleRow | null> {
  const result = await pool.query<DbModuleRow>(
    `SELECT id, course_id, name, description, index_order
     FROM module
     WHERE id = $1
     LIMIT 1`,
    [moduleId]
  );
  return result.rows[0] ?? null;
}

export async function getFirstModuleFromCourse(courseId: number): Promise<DbModuleRow | null> {
  const result = await pool.query<DbModuleRow>(
    `SELECT id, course_id, name, description, index_order
     FROM module
     WHERE course_id = $1
     ORDER BY index_order ASC, id ASC
     LIMIT 1`,
    [courseId]
  );
  return result.rows[0] ?? null;
}

export async function getFirstPhaseFromModule(
  moduleId: number,
  db: Queryable = pool
): Promise<DbPhaseRow | null> {
  const result = await db.query<DbPhaseRow>(
    `SELECT id, module_id, name, week_number, index_order, admin_authorize, created_at, updated_at
     FROM phase
     WHERE module_id = $1
     ORDER BY index_order ASC, id ASC
     LIMIT 1`,
    [moduleId]
  );
  return result.rows[0] ?? null;
}

export async function resolveCourseAndModule(params: {
  courseId?: number;
  currentModuleId?: number;
  categoria: Categoria;
}) {
  const course = params.courseId
    ? await getCourseById(params.courseId)
    : await findPreferredCourse(params.categoria);

  if (!course) {
    return { error: "Nenhum curso encontrado para criar a turma" as const };
  }

  let moduleRow: DbModuleRow | null = null;

  if (params.currentModuleId) {
    const byId = await getModuleById(params.currentModuleId);
    if (!byId) {
      return { error: "M\u00f3dulo selecionado n\u00e3o existe" as const };
    }
    if (byId.course_id !== course.id) {
      return { error: "O m\u00f3dulo informado n\u00e3o pertence ao curso selecionado" as const };
    }
    moduleRow = byId;
  } else {
    moduleRow = await getFirstModuleFromCourse(course.id);
  }

  if (!moduleRow) {
    return { error: "Curso sem m\u00f3dulos. Crie um m\u00f3dulo antes de criar a turma" as const };
  }

  return { course, moduleRow };
}

export async function getTurmaByIdOrNull(id: number) {
  const found = await pool.query<DbClassRow>(
    `SELECT id, current_module_id, course_id, name, start_date, end_date, created_at, updated_at
     FROM class
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (!found.rows[0]) return null;

  const row = found.rows[0];
  const course = await getCourseById(row.course_id);
  return { row, course };
}

export async function syncProgressStudentPhaseForModule(
  db: Queryable,
  userId: number,
  moduleId: number
) {
  const progressConfig = await getProgressStudentPhaseConfig();

  if (
    !progressConfig.hasTable ||
    !progressConfig.hasUserIdColumn ||
    !progressConfig.hasPhaseIdColumn
  ) {
    return;
  }

  const insertColumns = ["user_id", "phase_id"];
  const selectValues = ["$1", "p.id"];

  if (progressConfig.hasProgressColumn) {
    insertColumns.push("progress");
    selectValues.push("0");
  }

  if (progressConfig.hasStatusColumn) {
    insertColumns.push("status");
    selectValues.push("0");
  }

  if (progressConfig.hasUnlockedAtColumn) {
    insertColumns.push("unlocked_at");
    selectValues.push("NULL");
  }

  if (progressConfig.hasCompletedAtColumn) {
    insertColumns.push("completed_at");
    selectValues.push("NULL");
  }

  if (progressConfig.hasCreatedAtColumn) {
    insertColumns.push("created_at");
    selectValues.push("NOW()");
  }

  await db.query(
    `INSERT INTO progress_student_phase (${insertColumns.join(", ")})
     SELECT ${selectValues.join(", ")}
     FROM phase p
     WHERE p.module_id = $2
       AND NOT EXISTS (
         SELECT 1
         FROM progress_student_phase psp
         WHERE psp.user_id = $1
           AND psp.phase_id = p.id
       )`,
    [userId, moduleId]
  );
}

export async function startFirstPhaseForStudents(
  db: Queryable,
  classId: number,
  moduleId: number,
  studentIds: number[]
) {
  const firstPhase = await getFirstPhaseFromModule(moduleId, db);
  if (!firstPhase) {
    return { firstPhase: null, affectedStudentIds: [] as number[] };
  }

  const progressConfig = await getProgressStudentPhaseConfig();
  if (
    !progressConfig.hasTable ||
    !progressConfig.hasUserIdColumn ||
    !progressConfig.hasPhaseIdColumn
  ) {
    throw new Error("Tabela de progresso de fases indisponivel");
  }

  const updatableFields: string[] = [];
  if (progressConfig.hasStatusColumn) {
    updatableFields.push(
      `status = CASE WHEN COALESCE(status, 0) = 2 THEN 2 ELSE 1 END`
    );
  }
  if (progressConfig.hasUnlockedAtColumn) {
    updatableFields.push(`unlocked_at = COALESCE(unlocked_at, NOW())`);
  }

  if (updatableFields.length === 0) {
    throw new Error("Tabela de progresso sem colunas para iniciar fases");
  }

  const enrolledStudents = await db.query<{ user_id: number }>(
    `SELECT DISTINCT user_id
     FROM enrollment
     WHERE class_id = $1
       AND user_id = ANY($2::int[])`,
    [classId, studentIds]
  );

  const affectedStudentIds = enrolledStudents.rows.map((row) => row.user_id);
  if (affectedStudentIds.length === 0) {
    return { firstPhase, affectedStudentIds };
  }

  for (const studentId of affectedStudentIds) {
    await syncProgressStudentPhaseForModule(db, studentId, moduleId);
  }

  await db.query(
    `UPDATE progress_student_phase
     SET ${updatableFields.join(", ")}
     WHERE user_id = ANY($1::int[])
       AND phase_id = $2`,
    [affectedStudentIds, firstPhase.id]
  );

  return { firstPhase, affectedStudentIds };
}
