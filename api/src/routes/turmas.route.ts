import { Router } from "express";
import { type PoolClient } from "pg";
import { z } from "zod";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { logActivity } from "../utils/activityLog";

type Categoria = "programacao" | "informatica";

type DbClassRow = {
  id: number;
  current_module_id: number;
  course_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
};

type DbCourseRow = {
  id: number;
  name: string | null;
  description: string | null;
  is_paid: boolean;
  duration_hours: number | null;
  level: string | null;
  focus: string | null;
  price: number | null;
};

type CourseColumnConfig = {
  hasCourseTable: boolean;
  durationColumn: "duration_hours" | null;
  levelColumn: "level_difficulty" | "level" | null;
  focusColumn: "paid_focus" | "focus" | null;
  priceColumn: "price" | null;
  selectList: string;
};

type ProgressStudentPhaseConfig = {
  hasTable: boolean;
  hasUserIdColumn: boolean;
  hasPhaseIdColumn: boolean;
  hasProgressColumn: boolean;
  hasStatusColumn: boolean;
  hasUnlockedAtColumn: boolean;
  hasCompletedAtColumn: boolean;
  hasCreatedAtColumn: boolean;
};

type DbModuleRow = {
  id: number;
  course_id: number;
  name: string | null;
  description: string | null;
  index_order: number;
};

type DbPhaseRow = {
  id: number;
  module_id: number;
  name: string | null;
  week_number: number;
  index_order: number;
  admin_authorize: boolean;
  created_at: string;
  updated_at: string;
};

type DbStudentPhaseProgressRow = {
  user_id: number;
  status: number | null;
  progress: number | null;
  unlocked_at: string | null;
};

const createTurmaSchema = z.object({
  nome: z.string().min(2, "Nome obrigatÃ³rio"),
  tipo: z.enum(["turma", "particular"]).default("turma"),
  categoria: z.enum(["programacao", "informatica"]).default("programacao"),
  descricao: z.string().optional().nullable(),
  data_inicio: z.string().optional().nullable(),
  duracao_semanas: z.number().int().min(1).max(104).default(12),
  course_id: z.coerce.number().int().positive().optional(),
  current_module_id: z.coerce.number().int().positive().optional(),
});

const updateTurmaSchema = createTurmaSchema.partial();

const createModuleSchema = z.object({
  nome: z.string().min(2, "Nome obrigatÃ³rio"),
  descricao: z.string().optional().nullable(),
  course_id: z.coerce.number().int().positive().optional(),
  courseId: z.coerce.number().int().positive().optional(),
  index_order: z.coerce.number().int().positive().optional(),
});

const createPhaseSchema = z.object({
  nome: z.string().min(2, "Nome obrigatÃ³rio"),
  week_number: z.coerce.number().int().positive().optional(),
  index_order: z.coerce.number().int().positive().optional(),
  admin_authorize: z.boolean().optional().default(true),
});

function inferCategoria(courseName: string | null): Categoria {
  const normalized = (courseName ?? "").toLowerCase();
  if (normalized.includes("inform") || normalized.includes("excel") || normalized.includes("office")) {
    return "informatica";
  }
  return "programacao";
}

function toDurationWeeks(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const weeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, weeks || 1);
}

function buildEndDate(startDateIso: string, durationWeeks: number): string {
  const d = new Date(startDateIso);
  d.setUTCDate(d.getUTCDate() + durationWeeks * 7);
  return d.toISOString();
}

function isMissingDatabaseObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code === "42P01" || code === "42703";
}

function isNotNullConstraintError(error: unknown): error is { code: string; column?: string | null } {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code === "23502";
}

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return undefined;
}

function mapPhaseStartStatus(status: number | null, unlockedAt: string | null) {
  if (status === 2) {
    return { key: "concluido", label: "Concluido" };
  }
  if (status === 1) {
    return { key: "em_progresso", label: "Em progresso" };
  }
  if (status === 0) {
    return { key: "nao_iniciado", label: "Nao iniciado" };
  }
  if (unlockedAt) {
    return { key: "em_progresso", label: "Em progresso" };
  }
  return { key: "desconhecido", label: "Desconhecido" };
}

let courseColumnConfigCache: CourseColumnConfig | null = null;
let progressStudentPhaseConfigCache: ProgressStudentPhaseConfig | null = null;

type Queryable = Pick<PoolClient, "query">;

async function getCourseColumnConfig(forceRefresh = false): Promise<CourseColumnConfig> {
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

async function getProgressStudentPhaseConfig(forceRefresh = false): Promise<ProgressStudentPhaseConfig> {
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

async function getCourseById(courseId: number): Promise<DbCourseRow | null> {
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

async function findPreferredCourse(categoria: Categoria): Promise<DbCourseRow | null> {
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

async function getModuleById(moduleId: number): Promise<DbModuleRow | null> {
  const result = await pool.query<DbModuleRow>(
    `SELECT id, course_id, name, description, index_order
     FROM module
     WHERE id = $1
     LIMIT 1`,
    [moduleId]
  );
  return result.rows[0] ?? null;
}

async function getFirstModuleFromCourse(courseId: number): Promise<DbModuleRow | null> {
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

async function getFirstPhaseFromModule(
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

async function resolveCourseAndModule(params: {
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
      return { error: "MÃ³dulo selecionado nÃ£o existe" as const };
    }
    if (byId.course_id !== course.id) {
      return { error: "O mÃ³dulo informado nÃ£o pertence ao curso selecionado" as const };
    }
    moduleRow = byId;
  } else {
    moduleRow = await getFirstModuleFromCourse(course.id);
  }

  if (!moduleRow) {
    return { error: "Curso sem mÃ³dulos. Crie um mÃ³dulo antes de criar a turma" as const };
  }

  return { course, moduleRow };
}

function mapClassToTurma(row: DbClassRow, course: DbCourseRow | null) {
  return {
    id: String(row.id),
    nome: row.name ?? `Turma ${row.id}`,
    tipo: "turma" as const,
    categoria: inferCategoria(course?.name ?? null),
    professorId: null,
    descricao: course?.description ?? null,
    ativo: true,
    dataInicio: row.start_date,
    duracaoSemanas: toDurationWeeks(row.start_date, row.end_date),
    cronogramaAtivo: false,
    courseId: String(row.course_id),
    currentModuleId: String(row.current_module_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getTurmaByIdOrNull(id: number) {
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

async function syncProgressStudentPhaseForModule(
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

async function startFirstPhaseForStudents(
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

export function turmasRouter(jwtSecret: string) {
  const router = Router();

  const createModuleHandler = async (req: AuthRequest, res: any) => {
    const parsed = createModuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados invÃ¡lidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const body = parsed.data;
      const courseId = body.course_id ?? body.courseId;
      if (!courseId) {
        return res.status(400).json({ message: "course_id Ã© obrigatÃ³rio" });
      }

      const course = await getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Curso nÃ£o encontrado" });
      }

      let indexOrder = body.index_order;
      if (!indexOrder) {
        const next = await pool.query<{ next: number }>(
          `SELECT COALESCE(MAX(index_order), 0) + 1 AS next
           FROM module
           WHERE course_id = $1`,
          [courseId]
        );
        indexOrder = Number(next.rows[0]?.next ?? 1);
      }

      const created = await pool.query<DbModuleRow>(
        `INSERT INTO module (course_id, name, description, index_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, course_id, name, description, index_order`,
        [courseId, body.nome.trim(), body.descricao ?? null, indexOrder]
      );

      const row = created.rows[0];

      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "create",
        entityType: "module",
        entityId: String(row.id),
        metadata: { courseId: row.course_id, indexOrder: row.index_order },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json({
        message: "MÃ³dulo criado com sucesso!",
        modulo: {
          id: String(row.id),
          courseId: String(row.course_id),
          nome: row.name ?? `MÃ³dulo ${row.id}`,
          descricao: row.description,
          indexOrder: row.index_order,
        },
      });
    } catch (error) {
      console.error("Erro ao criar mÃ³dulo:", error);
      return res.status(500).json({ message: "Erro ao criar mÃ³dulo" });
    }
  };

  const listPhasesHandler = async (req: AuthRequest, res: any) => {
    try {
      const moduleId = Number(req.params.moduleId);
      if (!Number.isFinite(moduleId)) {
        return res.status(400).json({ message: "Module ID invÃ¡lido" });
      }

      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const hasPaginationInput = req.query.page !== undefined || req.query.limit !== undefined || req.query.q !== undefined;
      const pageRaw = Number(req.query.page ?? 1);
      const limitRaw = Number(req.query.limit ?? 20);
      const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
      const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;
      const offset = (page - 1) * limit;
      const params: unknown[] = [moduleId];
      const conditions: string[] = ["module_id = $1"];
      if (q) {
        params.push(`%${q}%`);
        conditions.push(`COALESCE(name, '') ILIKE $${params.length}`);
      }
      const where = `WHERE ${conditions.join(" AND ")}`;
      const mapRows = (rows: DbPhaseRow[]) =>
        rows.map((row) => ({
          id: String(row.id),
          moduleId: String(row.module_id),
          nome: row.name ?? `Fase ${row.id}`,
          weekNumber: row.week_number,
          indexOrder: row.index_order,
          adminAuthorize: row.admin_authorize,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

      if (!hasPaginationInput) {
        const result = await pool.query<DbPhaseRow>(
          `SELECT id, module_id, name, week_number, index_order, admin_authorize, created_at, updated_at
           FROM phase
           ${where}
           ORDER BY index_order ASC, id ASC`,
          params
        );

        return res.json(mapRows(result.rows));
      }

      const countResult = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM phase
         ${where}`,
        params
      );
      const listParams = [...params, limit, offset];

      const result = await pool.query<DbPhaseRow>(
        `SELECT id, module_id, name, week_number, index_order, admin_authorize, created_at, updated_at
         FROM phase
         ${where}
         ORDER BY index_order ASC, id ASC
         LIMIT $${listParams.length - 1}
         OFFSET $${listParams.length}`,
        listParams
      );

      const total = Number(countResult.rows[0]?.total ?? "0");

      return res.json({
        items: mapRows(result.rows),
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error("Erro ao listar fases:", error);
      return res.status(500).json({ message: "Erro ao listar fases" });
    }
  };

  const createPhaseHandler = async (req: AuthRequest, res: any) => {
    const parsed = createPhaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados invÃ¡lidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const moduleId = Number(req.params.moduleId);
      if (!Number.isFinite(moduleId)) {
        return res.status(400).json({ message: "Module ID invÃ¡lido" });
      }

      const moduleRow = await getModuleById(moduleId);
      if (!moduleRow) {
        return res.status(404).json({ message: "MÃ³dulo nÃ£o encontrado" });
      }

      let indexOrder = parsed.data.index_order;
      if (!indexOrder) {
        const next = await pool.query<{ next: number }>(
          `SELECT COALESCE(MAX(index_order), 0) + 1 AS next
           FROM phase
           WHERE module_id = $1`,
          [moduleId]
        );
        indexOrder = Number(next.rows[0]?.next ?? 1);
      }

      const weekNumber = parsed.data.week_number ?? indexOrder;

      const created = await pool.query<DbPhaseRow>(
        `INSERT INTO phase (module_id, name, week_number, index_order, admin_authorize, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, module_id, name, week_number, index_order, admin_authorize, created_at, updated_at`,
        [moduleId, parsed.data.nome.trim(), weekNumber, indexOrder, parsed.data.admin_authorize ?? true]
      );

      const row = created.rows[0];

      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "create",
        entityType: "phase",
        entityId: String(row.id),
        metadata: { moduleId: row.module_id, weekNumber: row.week_number },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json({
        message: "Fase criada com sucesso!",
        fase: {
          id: String(row.id),
          moduleId: String(row.module_id),
          nome: row.name ?? `Fase ${row.id}`,
          weekNumber: row.week_number,
          indexOrder: row.index_order,
          adminAuthorize: row.admin_authorize,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } catch (error) {
      console.error("Erro ao criar fase:", error);
      return res.status(500).json({ message: "Erro ao criar fase" });
    }
  };

  // GET /estrutura/stats â€“ global totals for overview cards
  router.get("/estrutura/stats", authGuard(jwtSecret), async (_req: AuthRequest, res: any) => {
    try {
      const result = await pool.query<{ cursos: string; modulos: string; fases: string }>(
        `SELECT
           (SELECT COUNT(*) FROM course)::text   AS cursos,
           (SELECT COUNT(*) FROM module)::text    AS modulos,
           (SELECT COUNT(*) FROM phase)::text     AS fases`
      );
      const row = result.rows[0];
      return res.json({
        cursos: Number(row?.cursos ?? 0),
        modulos: Number(row?.modulos ?? 0),
        fases: Number(row?.fases ?? 0),
      });
    } catch (error) {
      if (isMissingDatabaseObjectError(error)) {
        return res.json({ cursos: 0, modulos: 0, fases: 0 });
      }
      console.error("Erro ao buscar stats:", error);
      return res.status(500).json({ message: "Erro ao buscar stats" });
    }
  });

  // GET /courses
  router.get("/courses", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const isPaidFilter = parseBooleanQuery(req.query.isPaid);
    const hasPaginationInput =
      req.query.page !== undefined ||
      req.query.limit !== undefined ||
      req.query.q !== undefined ||
      req.query.isPaid !== undefined;
    const pageRaw = Number(req.query.page ?? 1);
    const limitRaw = Number(req.query.limit ?? 20);
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;

    try {
      const courseColumns = await getCourseColumnConfig();
      if (!courseColumns.hasCourseTable) {
        if (!hasPaginationInput) {
          return res.json([]);
        }

        return res.json({
          items: [],
          total: 0,
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        });
      }

      const offset = (page - 1) * limit;

      const params: unknown[] = [];
      const conditions: string[] = [];
      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(COALESCE(name, '') ILIKE $${params.length} OR COALESCE(description, '') ILIKE $${params.length})`);
      }
      if (isPaidFilter !== undefined) {
        params.push(isPaidFilter);
        conditions.push(`is_paid = $${params.length}`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const mapRows = (rows: DbCourseRow[]) =>
        rows.map((row) => ({
          id: String(row.id),
          nome: row.name ?? `Curso ${row.id}`,
          descricao: row.description,
          isPaid: row.is_paid,
          durationHours: row.duration_hours,
          level: row.level,
          focus: row.focus,
          price: row.price,
        }));

      if (!hasPaginationInput) {
        const result = await pool.query<DbCourseRow>(
          `SELECT ${courseColumns.selectList}
           FROM course
           ${where}
           ORDER BY id ASC`,
          params
        );

        return res.json(mapRows(result.rows));
      }

      const countResult = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM course
         ${where}`,
        params
      );

      const listParams = [...params, limit, offset];
      const result = await pool.query<DbCourseRow>(
        `SELECT ${courseColumns.selectList}
         FROM course
         ${where}
         ORDER BY id ASC
         LIMIT $${listParams.length - 1}
         OFFSET $${listParams.length}`,
        listParams
      );

      const total = Number(countResult.rows[0]?.total ?? "0");

      return res.json({
        items: mapRows(result.rows),
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      if (isMissingDatabaseObjectError(error)) {
        if (!hasPaginationInput) {
          return res.json([]);
        }

        return res.json({
          items: [],
          total: 0,
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        });
      }
      console.error("Erro ao listar cursos:", error);
      return res.status(500).json({ message: "Erro ao listar cursos" });
    }
  });

  // POST /courses (criaÃ§Ã£o de curso)
  const createCourseSchema = z.object({
    nome: z.string().min(2, "Nome obrigatÃ³rio"),
    descricao: z.string().optional().nullable(),
    is_paid: z.boolean().optional().default(false),
    duration_hours: z.coerce.number().int().min(1).optional().nullable(),
    level: z.string().optional().nullable(),
    focus: z.string().optional().nullable(),
    price: z.coerce.number().min(0).optional().nullable(),
  });

  router.post(
    "/courses",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const parsed = createCourseSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados invÃ¡lidos" });
        }
        const data = parsed.data;
        const courseColumns = await getCourseColumnConfig(true);

        if (!courseColumns.hasCourseTable) {
          return res.status(400).json({ message: "Estrutura de cursos indisponÃ­vel no banco atual" });
        }

        const normalizedDurationHours = data.duration_hours ?? 1;
        const normalizedPrice = data.price ?? 0;

        const insertColumns = ["name", "description", "is_paid"];
        const insertValues: Array<string | number | boolean | null> = [
          data.nome,
          data.descricao ?? null,
          data.is_paid,
        ];

        if (courseColumns.durationColumn) {
          insertColumns.push(courseColumns.durationColumn);
          insertValues.push(normalizedDurationHours);
        }

        if (courseColumns.levelColumn) {
          insertColumns.push(courseColumns.levelColumn);
          insertValues.push(data.level ?? null);
        }

        if (courseColumns.focusColumn) {
          insertColumns.push(courseColumns.focusColumn);
          insertValues.push(data.focus ?? null);
        }

        if (courseColumns.priceColumn) {
          insertColumns.push(courseColumns.priceColumn);
          insertValues.push(normalizedPrice);
        }

        const valuePlaceholders = insertValues.map((_, index) => `$${index + 1}`).join(", ");

        const result = await pool.query<DbCourseRow>(
          `INSERT INTO course (${insertColumns.join(", ")}, created_at, updated_at)
           VALUES (${valuePlaceholders}, NOW(), NOW())
           RETURNING ${courseColumns.selectList}`,
          insertValues
        );

        const row = result.rows[0];

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "create",
          entityType: "course",
          entityId: String(row.id),
          metadata: { nome: data.nome },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.status(201).json({
          message: "Curso criado com sucesso!",
          curso: {
            id: String(row.id),
            nome: row.name ?? `Curso ${row.id}`,
            descricao: row.description,
            isPaid: row.is_paid,
            durationHours: row.duration_hours,
            level: row.level,
            focus: row.focus,
            price: row.price,
          },
        });
      } catch (error) {
        if (isMissingDatabaseObjectError(error)) {
          return res.status(400).json({ message: "Estrutura de cursos indisponÃ­vel no banco atual" });
        }
        if (isNotNullConstraintError(error)) {
          const column = typeof error.column === "string" ? error.column : null;
          if (column === "duration_hours") {
            return res.status(400).json({ message: "A duraÃ§Ã£o do curso Ã© obrigatÃ³ria na estrutura atual do banco" });
          }
          if (column === "price") {
            return res.status(400).json({ message: "O preÃ§o do curso Ã© obrigatÃ³rio na estrutura atual do banco" });
          }
          return res.status(400).json({ message: "Dados obrigatÃ³rios do curso nÃ£o foram informados" });
        }
        console.error("Erro ao criar curso:", error);
        return res.status(500).json({ message: "Erro ao criar curso" });
      }
    }
  );

  // DELETE /courses/:id
  router.delete(
    "/courses/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ message: "ID de curso invÃ¡lido" });
        }

        const existing = await getCourseById(id);
        if (!existing) {
          return res.status(404).json({ message: "Curso nÃ£o encontrado" });
        }

        await pool.query(`DELETE FROM course WHERE id = $1`, [id]);

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "delete",
          entityType: "course",
          entityId: String(id),
          metadata: { nome: existing.name },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.json({ message: "Curso deletado com sucesso" });
      } catch (error) {
        if (isMissingDatabaseObjectError(error)) {
          return res.status(400).json({ message: "Estrutura de cursos indisponÃ­vel no banco atual" });
        }
        console.error("Erro ao deletar curso:", error);
        return res.status(500).json({ message: "Erro ao deletar curso" });
      }
    }
  );

  // DELETE /modules/:id
  router.delete(
    "/modules/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ message: "ID de mÃ³dulo invÃ¡lido" });
        }

        const existing = await getModuleById(id);
        if (!existing) {
          return res.status(404).json({ message: "MÃ³dulo nÃ£o encontrado" });
        }

        await pool.query(`DELETE FROM module WHERE id = $1`, [id]);

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "delete",
          entityType: "module",
          entityId: String(id),
          metadata: { nome: existing.name },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.json({ message: "MÃ³dulo deletado com sucesso" });
      } catch (error) {
        console.error("Erro ao deletar mÃ³dulo:", error);
        return res.status(500).json({ message: "Erro ao deletar mÃ³dulo" });
      }
    }
  );

  // DELETE /phases/:id
  router.delete(
    "/phases/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ message: "ID de fase invÃ¡lido" });
        }

        const existing = await pool.query(`SELECT id, name FROM phase WHERE id = $1 LIMIT 1`, [id]);
        if (!existing.rows[0]) {
          return res.status(404).json({ message: "Fase nÃ£o encontrada" });
        }

        await pool.query(`DELETE FROM phase WHERE id = $1`, [id]);

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "delete",
          entityType: "phase",
          entityId: String(id),
          metadata: { nome: existing.rows[0].name },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.json({ message: "Fase deletada com sucesso" });
      } catch (error) {
        console.error("Erro ao deletar fase:", error);
        return res.status(500).json({ message: "Erro ao deletar fase" });
      }
    }
  );

  // GET /courses/:courseId/modules
  router.get("/courses/:courseId/modules", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isFinite(courseId)) {
        return res.status(400).json({ message: "Course ID invÃ¡lido" });
      }

      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const hasPaginationInput = req.query.page !== undefined || req.query.limit !== undefined || req.query.q !== undefined;
      const pageRaw = Number(req.query.page ?? 1);
      const limitRaw = Number(req.query.limit ?? 20);
      const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
      const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;
      const offset = (page - 1) * limit;

      const params: unknown[] = [courseId];
      const conditions = ["course_id = $1"];
      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(COALESCE(name, '') ILIKE $${params.length} OR COALESCE(description, '') ILIKE $${params.length})`);
      }
      const where = `WHERE ${conditions.join(" AND ")}`;
      const mapRows = (rows: DbModuleRow[]) =>
        rows.map((row) => ({
          id: String(row.id),
          courseId: String(row.course_id),
          nome: row.name ?? `MÃ³dulo ${row.id}`,
          descricao: row.description,
          indexOrder: row.index_order,
        }));

      if (!hasPaginationInput) {
        const result = await pool.query<DbModuleRow>(
          `SELECT id, course_id, name, description, index_order
           FROM module
           ${where}
           ORDER BY index_order ASC, id ASC`,
          params
        );

        return res.json(mapRows(result.rows));
      }

      const countResult = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM module
         ${where}`,
        params
      );

      const listParams = [...params, limit, offset];
      const result = await pool.query<DbModuleRow>(
        `SELECT id, course_id, name, description, index_order
         FROM module
         ${where}
         ORDER BY index_order ASC, id ASC
         LIMIT $${listParams.length - 1}
         OFFSET $${listParams.length}`,
        listParams
      );

      const total = Number(countResult.rows[0]?.total ?? "0");

      return res.json({
        items: mapRows(result.rows),
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error("Erro ao listar mÃ³dulos do curso:", error);
      return res.status(500).json({ message: "Erro ao listar mÃ³dulos do curso" });
    }
  });

  // POST /modules (criaÃ§Ã£o de mÃ³dulo)
  router.post(
    "/modules",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    createModuleHandler
  );

  // Alias PT-BR para criar mÃ³dulo
  router.post("/modulos", authGuard(jwtSecret), requireRole(["admin"]), createModuleHandler);

  // GET /modules/:moduleId/phases
  router.get("/modules/:moduleId/phases", authGuard(jwtSecret), listPhasesHandler);

  // POST /modules/:moduleId/phases (criaÃ§Ã£o de fase)
  router.post(
    "/modules/:moduleId/phases",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    createPhaseHandler
  );

  // Aliases PT-BR para fases
  router.get("/modulos/:moduleId/fases", authGuard(jwtSecret), listPhasesHandler);

  router.post(
    "/modulos/:moduleId/fases",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    createPhaseHandler
  );

  // GET /turmas - Lista turmas (class)
  router.get("/turmas", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const userId = Number(req.user!.sub);
    const userRole = req.user!.role;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const hasPaginationInput = req.query.page !== undefined || req.query.limit !== undefined || req.query.q !== undefined;
    const pageRaw = Number(req.query.page ?? 1);
    const limitRaw = Number(req.query.limit ?? 20);
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;
    const offset = (page - 1) * limit;

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (userRole === "aluno") {
      params.push(userId);
      conditions.push(`id IN (SELECT class_id FROM enrollment WHERE user_id = $${params.length})`);
    }

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`COALESCE(name, '') ILIKE $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const baseQuery = `
      SELECT id, current_module_id, course_id, name, start_date, end_date, created_at, updated_at
      FROM class
      ${where}
      ORDER BY created_at DESC
    `;

    const countResult = hasPaginationInput
      ? await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM class
         ${where}`,
        params
      )
      : null;

    let classes;
    if (hasPaginationInput) {
      const listParams = [...params, limit, offset];
      classes = await pool.query<DbClassRow>(
        `${baseQuery}
         LIMIT $${listParams.length - 1}
         OFFSET $${listParams.length}`,
        listParams
      );
    } else {
      classes = await pool.query<DbClassRow>(baseQuery, params);
    }

    const courseIds = Array.from(new Set(classes.rows.map((c) => c.course_id)));
    const coursesMap = new Map<number, DbCourseRow>();

    if (courseIds.length > 0) {
      const courseColumns = await getCourseColumnConfig();
      if (courseColumns.hasCourseTable) {
        const r = await pool.query<DbCourseRow>(
          `SELECT ${courseColumns.selectList}
           FROM course
           WHERE id = ANY($1::int[])`,
          [courseIds]
        );
        for (const c of r.rows) coursesMap.set(c.id, c);
      }
    }

    const items = classes.rows.map((row) => mapClassToTurma(row, coursesMap.get(row.course_id) ?? null));
    if (!hasPaginationInput) {
      return res.json(items);
    }

    const total = Number(countResult?.rows[0]?.total ?? "0");
    return res.json({
      items,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  });

  // GET /turmas/meus-responsaveis/count
  router.get("/turmas/meus-responsaveis/count", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const userRole = req.user!.role;
      const userId = Number(req.user!.sub);

      if (userRole === "aluno") {
        const mine = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM enrollment WHERE user_id = $1`,
          [userId]
        );
        return res.json({ total: Number(mine.rows[0]?.count ?? "0") });
      }

      const all = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM class`);
      return res.json({ total: Number(all.rows[0]?.count ?? "0") });
    } catch (error) {
      console.error("Erro ao contar turmas responsÃ¡veis:", error);
      return res.status(500).json({ message: "Erro ao contar turmas responsÃ¡veis" });
    }
  });

  // GET /turmas/total
  router.get("/turmas/total", authGuard(jwtSecret), async (_req: AuthRequest, res) => {
    try {
      const result = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM class`);
      return res.json({ total: Number(result.rows[0]?.count ?? "0") });
    } catch (error) {
      console.error("Erro ao contar turmas:", error);
      return res.status(500).json({ message: "Erro ao contar turmas" });
    }
  });

  // GET /turmas/alunos/count
  router.get("/turmas/alunos/count", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const userRole = req.user!.role;
      const userId = Number(req.user!.sub);

      if (userRole === "aluno") {
        const turmaAtual = await pool.query<{ id: number }>(
          `SELECT c.id
           FROM class c
           JOIN enrollment e ON e.class_id = c.id
           WHERE e.user_id = $1
           ORDER BY c.created_at DESC
           LIMIT 1`,
          [userId]
        );

        const turmaId = turmaAtual.rows[0]?.id;
        if (!turmaId) {
          return res.json({ total: 0, totalSistema: 0 });
        }

        const count = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM enrollment e
           JOIN "user" u ON u.id = e.user_id
           WHERE e.class_id = $1 AND u.role = 1`,
          [turmaId]
        );

        return res.json({
          total: Number(count.rows[0]?.count ?? "0"),
          totalSistema: 0,
        });
      }

      const totalNasTurmas = await pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT e.user_id)::text AS count
         FROM enrollment e
         JOIN "user" u ON u.id = e.user_id
         WHERE u.role = 1`
      );

      if (userRole === "admin") {
        const totalSistema = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM "user" WHERE role = 1`
        );

        return res.json({
          total: Number(totalNasTurmas.rows[0]?.count ?? "0"),
          totalSistema: Number(totalSistema.rows[0]?.count ?? "0"),
        });
      }

      return res.json({
        total: Number(totalNasTurmas.rows[0]?.count ?? "0"),
        totalSistema: 0,
      });
    } catch (error) {
      console.error("Erro ao contar alunos para dashboard:", error);
      return res.status(500).json({ message: "Erro ao contar alunos" });
    }
  });

  // GET /turmas/:id
  router.get("/turmas/:id", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const userId = Number(req.user!.sub);
    const userRole = req.user!.role;

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "ID de turma invÃ¡lido" });
    }

    const turmaData = await getTurmaByIdOrNull(id);
    if (!turmaData) {
      return res.status(404).json({ message: "Turma nÃ£o encontrada" });
    }

    if (userRole === "aluno") {
      const hasAccess = await pool.query(
        `SELECT 1 FROM enrollment WHERE user_id = $1 AND class_id = $2 LIMIT 1`,
        [userId, id]
      );
      if (!hasAccess.rows.length) {
        return res.status(403).json({ message: "Sem permissÃ£o" });
      }
    }

    const firstPhase = await getFirstPhaseFromModule(turmaData.row.current_module_id);

    const alunosR = await pool.query<{
      id: number;
      usuario: string | null;
      nome: string | null;
      role: number;
    }>(
      `SELECT u.id, u.email AS usuario, u.name AS nome, u.role
       FROM "user" u
       JOIN enrollment e ON u.id = e.user_id
       WHERE e.class_id = $1
       ORDER BY u.name NULLS LAST`,
      [id]
    );

    const progressConfig = await getProgressStudentPhaseConfig();
    const studentProgressMap = new Map<number, DbStudentPhaseProgressRow>();

    if (
      firstPhase &&
      progressConfig.hasTable &&
      progressConfig.hasUserIdColumn &&
      progressConfig.hasPhaseIdColumn
    ) {
      const progressR = await pool.query<DbStudentPhaseProgressRow>(
        `SELECT
           user_id,
           ${progressConfig.hasStatusColumn ? "status" : "NULL::int AS status"},
           ${progressConfig.hasProgressColumn ? "progress" : "NULL::double precision AS progress"},
           ${progressConfig.hasUnlockedAtColumn ? "unlocked_at" : "NULL::timestamptz AS unlocked_at"}
         FROM progress_student_phase
         WHERE phase_id = $1`,
        [firstPhase.id]
      );

      for (const row of progressR.rows) {
        studentProgressMap.set(row.user_id, row);
      }
    }

    const phasesR = await pool.query<{
      id: number;
      titulo: string | null;
      modulo: string | null;
    }>(
      `SELECT p.id, p.name AS titulo, m.name AS modulo
       FROM phase p
       JOIN module m ON m.id = p.module_id
       WHERE p.module_id = $1
       ORDER BY p.index_order ASC, p.id ASC`,
      [turmaData.row.current_module_id]
    );

    return res.json({
      ...mapClassToTurma(turmaData.row, turmaData.course),
      faseInicial: firstPhase
        ? {
            id: String(firstPhase.id),
            nome: firstPhase.name ?? `Fase ${firstPhase.id}`,
          }
        : null,
      alunos: alunosR.rows.map((row) => {
        const progress = studentProgressMap.get(row.id);
        const phaseStatus = mapPhaseStartStatus(progress?.status ?? null, progress?.unlocked_at ?? null);

        return {
          id: String(row.id),
          usuario: row.usuario ?? undefined,
          nome: row.nome ?? `Usuario ${row.id}`,
          role: row.role === 1 ? "aluno" : row.role === 2 ? "professor" : "admin",
          faseInicialStatus: phaseStatus.key,
          faseInicialStatusLabel: phaseStatus.label,
          faseInicialProgress: progress?.progress ?? 0,
          faseInicialUnlockedAt: progress?.unlocked_at ?? null,
        };
      }),
      exercicios: phasesR.rows.map((row) => ({
        id: String(row.id),
        titulo: row.titulo ?? `Fase ${row.id}`,
        modulo: row.modulo ?? "",
      })),
    });
  });

  // POST /turmas
  router.post(
    "/turmas",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const parsed = createTurmaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invÃ¡lidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { nome, categoria, data_inicio, duracao_semanas, course_id, current_module_id } = parsed.data;

      const resolved = await resolveCourseAndModule({
        courseId: course_id,
        currentModuleId: current_module_id,
        categoria,
      });

      if ("error" in resolved) {
        return res.status(400).json({ message: resolved.error });
      }

      const startDate = data_inicio ? new Date(data_inicio).toISOString() : new Date().toISOString();
      const endDate = buildEndDate(startDate, duracao_semanas ?? 12);

      const created = await pool.query<DbClassRow>(
        `INSERT INTO class (current_module_id, course_id, name, start_date, end_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, current_module_id, course_id, name, start_date, end_date, created_at, updated_at`,
        [resolved.moduleRow.id, resolved.course.id, nome.trim(), startDate, endDate]
      );

      const row = created.rows[0];

      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "create",
        entityType: "class",
        entityId: String(row.id),
        metadata: {
          nome: row.name,
          courseId: row.course_id,
          currentModuleId: row.current_module_id,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json({
        message: "Turma criada com sucesso!",
        turma: mapClassToTurma(row, resolved.course),
      });
    }
  );

  // PUT /turmas/:id
  router.put(
    "/turmas/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "ID de turma invÃ¡lido" });
      }

      const parsed = updateTurmaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invÃ¡lidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const current = await getTurmaByIdOrNull(id);
      if (!current) {
        return res.status(404).json({ message: "Turma nÃ£o encontrada" });
      }

      const data = parsed.data;

      const nextCourseId = data.course_id ?? current.row.course_id;
      const nextModuleId = data.current_module_id ?? current.row.current_module_id;

      const resolved = await resolveCourseAndModule({
        courseId: nextCourseId,
        currentModuleId: nextModuleId,
        categoria: data.categoria ?? inferCategoria(current.course?.name ?? null),
      });

      if ("error" in resolved) {
        return res.status(400).json({ message: resolved.error });
      }

      const nextStartDate = data.data_inicio
        ? new Date(data.data_inicio).toISOString()
        : current.row.start_date;

      const durationWeeks = data.duracao_semanas ?? toDurationWeeks(current.row.start_date, current.row.end_date);
      const nextEndDate = buildEndDate(nextStartDate, durationWeeks);

      const nextName = data.nome?.trim() ?? current.row.name ?? `Turma ${current.row.id}`;

      const updated = await pool.query<DbClassRow>(
        `UPDATE class
         SET name = $1,
             course_id = $2,
             current_module_id = $3,
             start_date = $4,
             end_date = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, current_module_id, course_id, name, start_date, end_date, created_at, updated_at`,
        [nextName, resolved.course.id, resolved.moduleRow.id, nextStartDate, nextEndDate, id]
      );

      const row = updated.rows[0];

      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "update",
        entityType: "class",
        entityId: String(id),
        metadata: {
          updatedFields: Object.keys(data),
          courseId: row.course_id,
          currentModuleId: row.current_module_id,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({
        message: "Turma atualizada!",
        turma: mapClassToTurma(row, resolved.course),
      });
    }
  );

  // DELETE /turmas/:id
  router.delete(
    "/turmas/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "ID de turma invÃ¡lido" });
      }

      const check = await getTurmaByIdOrNull(id);
      if (!check) {
        return res.status(404).json({ message: "Turma nÃ£o encontrada" });
      }

      await pool.query(`DELETE FROM class WHERE id = $1`, [id]);

      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "delete",
        entityType: "class",
        entityId: String(id),
        metadata: { id },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({ message: "Turma deletada com sucesso" });
    }
  );

  // POST /turmas/:id/alunos
  router.post(
    "/turmas/:id/alunos",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const classId = Number(req.params.id);
      const { aluno_ids } = req.body as { aluno_ids?: Array<string | number> };

      if (!Number.isFinite(classId)) {
        return res.status(400).json({ message: "ID de turma invÃ¡lido" });
      }

      if (!Array.isArray(aluno_ids) || aluno_ids.length === 0) {
        return res.status(400).json({ message: "aluno_ids deve ser um array nÃ£o vazio" });
      }

      const turma = await getTurmaByIdOrNull(classId);
      if (!turma) {
        return res.status(404).json({ message: "Turma nÃ£o encontrada" });
      }

      const normalizedAlunoIds = Array.from(
        new Set(
          aluno_ids
            .map((value) => Number(value))
            .filter((value): value is number => Number.isFinite(value))
        )
      );

      if (normalizedAlunoIds.length === 0) {
        return res.status(400).json({ message: "Nenhum aluno_id valido informado" });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        for (const alunoId of normalizedAlunoIds) {
          await client.query(
            `INSERT INTO enrollment (user_id, class_id, created_at)
             SELECT $1, $2, NOW()
             WHERE NOT EXISTS (
               SELECT 1 FROM enrollment WHERE user_id = $1 AND class_id = $2
             )`,
            [alunoId, classId]
          );

          await syncProgressStudentPhaseForModule(client, alunoId, turma.row.current_module_id);
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Erro ao adicionar alunos na turma:", error);
        return res.status(500).json({ message: "Erro ao adicionar alunos na turma" });
      } finally {
        client.release();
      }

      return res.json({ message: "Alunos adicionados com sucesso" });
    }
  );

  // POST /turmas/:id/iniciar-fases
  router.post(
    "/turmas/:id/iniciar-fases",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const classId = Number(req.params.id);
      const { aluno_ids } = req.body as { aluno_ids?: Array<string | number> };

      if (!Number.isFinite(classId)) {
        return res.status(400).json({ message: "ID de turma invalido" });
      }

      if (!Array.isArray(aluno_ids) || aluno_ids.length === 0) {
        return res.status(400).json({ message: "aluno_ids deve ser um array nao vazio" });
      }

      const turma = await getTurmaByIdOrNull(classId);
      if (!turma) {
        return res.status(404).json({ message: "Turma nao encontrada" });
      }

      const normalizedAlunoIds = Array.from(
        new Set(
          aluno_ids
            .map((value) => Number(value))
            .filter((value): value is number => Number.isFinite(value))
        )
      );

      if (normalizedAlunoIds.length === 0) {
        return res.status(400).json({ message: "Nenhum aluno_id valido informado" });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const result = await startFirstPhaseForStudents(
          client,
          classId,
          turma.row.current_module_id,
          normalizedAlunoIds
        );

        if (!result.firstPhase) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "O modulo atual da turma nao possui fases" });
        }

        await client.query("COMMIT");

        return res.json({
          message: "Fase inicial iniciada com sucesso",
          fase: {
            id: String(result.firstPhase.id),
            nome: result.firstPhase.name ?? `Fase ${result.firstPhase.id}`,
          },
          totalAlunos: result.affectedStudentIds.length,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Erro ao iniciar fases da turma:", error);

        const message =
          error instanceof Error && error.message
            ? error.message
            : "Erro ao iniciar fases da turma";

        return res.status(500).json({ message });
      } finally {
        client.release();
      }
    }
  );

  // DELETE /turmas/:id/alunos/:alunoId
  router.delete(
    "/turmas/:id/alunos/:alunoId",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const classId = Number(req.params.id);
      const alunoId = Number(req.params.alunoId);

      if (!Number.isFinite(classId) || !Number.isFinite(alunoId)) {
        return res.status(400).json({ message: "ParÃ¢metros invÃ¡lidos" });
      }

      const turma = await getTurmaByIdOrNull(classId);
      if (!turma) {
        return res.status(404).json({ message: "Turma nÃ£o encontrada" });
      }

      await pool.query(`DELETE FROM enrollment WHERE user_id = $1 AND class_id = $2`, [alunoId, classId]);

      return res.json({ message: "Aluno removido da turma" });
    }
  );

  // Endpoints legados sem suporte no novo schema
  router.post(
    "/turmas/:id/exercicios",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (_req: AuthRequest, res) => {
      return res.status(501).json({ message: "AtribuiÃ§Ã£o de exercÃ­cios por turma indisponÃ­vel no schema atual" });
    }
  );

  router.delete(
    "/turmas/:id/exercicios/:exercicioId",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (_req: AuthRequest, res) => {
      return res.status(501).json({ message: "RemoÃ§Ã£o de exercÃ­cios por turma indisponÃ­vel no schema atual" });
    }
  );

  router.post(
    "/turmas/:id/cronograma",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (_req: AuthRequest, res) => {
      return res.status(501).json({ message: "Cronograma legado indisponÃ­vel no schema atual" });
    }
  );

  // GET /turmas/:id/cronograma - fallback com fases do mÃ³dulo atual
  router.get("/turmas/:id/cronograma", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const classId = Number(req.params.id);
    const userId = Number(req.user!.sub);
    const userRole = req.user!.role;

    if (!Number.isFinite(classId)) {
      return res.status(400).json({ message: "ID de turma invÃ¡lido" });
    }

    try {
      const turma = await getTurmaByIdOrNull(classId);
      if (!turma) {
        return res.status(404).json({ message: "Turma nÃ£o encontrada" });
      }

      if (userRole === "aluno") {
        const hasAccess = await pool.query(
          `SELECT 1 FROM enrollment WHERE user_id = $1 AND class_id = $2 LIMIT 1`,
          [userId, classId]
        );
        if (!hasAccess.rows.length) {
          return res.status(403).json({ message: "Sem permissÃ£o" });
        }
      }

      const phases = await pool.query<{
        id: number;
        titulo: string | null;
        modulo: string | null;
        semana: number;
      }>(
        `SELECT p.id, p.name AS titulo, m.name AS modulo, p.week_number AS semana
         FROM phase p
         JOIN module m ON m.id = p.module_id
         WHERE p.module_id = $1
         ORDER BY p.week_number ASC, p.index_order ASC, p.id ASC`,
        [turma.row.current_module_id]
      );

      const cronograma = phases.rows.reduce((acc: Record<number, Array<{ id: string; titulo: string; modulo: string }>>, row) => {
        if (!acc[row.semana]) acc[row.semana] = [];
        acc[row.semana].push({
          id: String(row.id),
          titulo: row.titulo ?? `Fase ${row.id}`,
          modulo: row.modulo ?? "",
        });
        return acc;
      }, {});

      return res.json({
        cronograma,
        turma: {
          id: String(turma.row.id),
          nome: turma.row.name ?? `Turma ${turma.row.id}`,
          dataInicio: turma.row.start_date,
          duracaoSemanas: toDurationWeeks(turma.row.start_date, turma.row.end_date),
          cronogramaAtivo: false,
        },
      });
    } catch (error) {
      console.error("Erro ao buscar cronograma:", error);
      return res.status(500).json({ message: "Erro ao buscar cronograma" });
    }
  });

  // â”€â”€â”€ REORDER MODULES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.patch("/modules/:id/reorder", authGuard(jwtSecret), requireRole(["admin", "professor"]), async (req: AuthRequest, res: any) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "ID invÃ¡lido" });

      const direction = req.body?.direction as string;
      if (direction !== "up" && direction !== "down") {
        return res.status(400).json({ message: "direction deve ser 'up' ou 'down'" });
      }

      const current = await pool.query<{ id: number; course_id: number; index_order: number }>(
        `SELECT id, course_id, index_order FROM module WHERE id = $1`,
        [id]
      );
      if (current.rows.length === 0) return res.status(404).json({ message: "MÃ³dulo nÃ£o encontrado" });

      const mod = current.rows[0];
      const operator = direction === "up" ? "<" : ">";
      const order = direction === "up" ? "DESC" : "ASC";

      const neighbor = await pool.query<{ id: number; index_order: number }>(
        `SELECT id, index_order FROM module
         WHERE course_id = $1 AND index_order ${operator} $2
         ORDER BY index_order ${order}
         LIMIT 1`,
        [mod.course_id, mod.index_order]
      );

      if (neighbor.rows.length === 0) {
        return res.status(400).json({ message: "JÃ¡ estÃ¡ na posiÃ§Ã£o limite" });
      }

      const nb = neighbor.rows[0];

      await pool.query("BEGIN");
      await pool.query(`UPDATE module SET index_order = $1, updated_at = NOW() WHERE id = $2`, [nb.index_order, mod.id]);
      await pool.query(`UPDATE module SET index_order = $1, updated_at = NOW() WHERE id = $2`, [mod.index_order, nb.id]);
      await pool.query("COMMIT");

      return res.json({ message: "Ordem atualizada" });
    } catch (error) {
      await pool.query("ROLLBACK").catch(() => {});
      console.error("Erro ao reordenar mÃ³dulo:", error);
      return res.status(500).json({ message: "Erro ao reordenar mÃ³dulo" });
    }
  });

  // â”€â”€â”€ REORDER PHASES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.patch("/phases/:id/reorder", authGuard(jwtSecret), requireRole(["admin", "professor"]), async (req: AuthRequest, res: any) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "ID invÃ¡lido" });

      const direction = req.body?.direction as string;
      if (direction !== "up" && direction !== "down") {
        return res.status(400).json({ message: "direction deve ser 'up' ou 'down'" });
      }

      const current = await pool.query<{ id: number; module_id: number; index_order: number }>(
        `SELECT id, module_id, index_order FROM phase WHERE id = $1`,
        [id]
      );
      if (current.rows.length === 0) return res.status(404).json({ message: "Fase nÃ£o encontrada" });

      const phase = current.rows[0];
      const operator = direction === "up" ? "<" : ">";
      const order = direction === "up" ? "DESC" : "ASC";

      const neighbor = await pool.query<{ id: number; index_order: number }>(
        `SELECT id, index_order FROM phase
         WHERE module_id = $1 AND index_order ${operator} $2
         ORDER BY index_order ${order}
         LIMIT 1`,
        [phase.module_id, phase.index_order]
      );

      if (neighbor.rows.length === 0) {
        return res.status(400).json({ message: "JÃ¡ estÃ¡ na posiÃ§Ã£o limite" });
      }

      const nb = neighbor.rows[0];

      await pool.query("BEGIN");
      await pool.query(`UPDATE phase SET index_order = $1, updated_at = NOW() WHERE id = $2`, [nb.index_order, phase.id]);
      await pool.query(`UPDATE phase SET index_order = $1, updated_at = NOW() WHERE id = $2`, [phase.index_order, nb.id]);
      await pool.query("COMMIT");

      return res.json({ message: "Ordem atualizada" });
    } catch (error) {
      await pool.query("ROLLBACK").catch(() => {});
      console.error("Erro ao reordenar fase:", error);
      return res.status(500).json({ message: "Erro ao reordenar fase" });
    }
  });

  return router;
}




