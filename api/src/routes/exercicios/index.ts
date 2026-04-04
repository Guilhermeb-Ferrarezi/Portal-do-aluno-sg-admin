import { Router } from "express";
import { pool } from "../../db";
import { hasLegacySubmissoesTable } from "../../db/legacySubmissoes";
import { authGuard } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/requireRole";
import type { AuthRequest } from "../../middlewares/auth";
import { logActivity } from "../../utils/activityLog";
import { uploadToR2, deleteFromR2 } from "../../utils/uploadR2";

import type { ExercicioRow, ExercicioAccessRow, NewExerciseRow } from "./types";
import {
  detectarTipoExercicio,
  normalizeNewSchemaBody,
  normalizeOptionalText,
  mapTipoExercicioToTypeExercise,
  mapTypeExerciseToTipoExercicio,
  getMultiplaQuestoesFromPayload,
  stringifyMultiplaQuestoes,
  getMultipleChoicePersistenceMissingMessage,
  mapNewExerciseRow,
  parseIdArray,
} from "./helpers";
import {
  createSchema,
  createNewSchema,
  aiGenerateSchema,
  upload,
  aiDraftLimiter,
} from "./validation";
import {
  getExerciseSchemaInfo,
  getNewExerciseSelectFields,
  getNewExerciseReturningFields,
  listFromNewExerciseSchema,
  listDailyTasksFromNewExerciseSchema,
  getFromNewExerciseSchema,
} from "./schema";
import {
  resolveGenerationContext,
  generateExerciseDraftWithGroq,
} from "./ai-draft";
import {
  loadNewSchemaMultiplaMap,
  syncNewSchemaMultiplaQuestoes,
  getPhaseWithModuleById,
  realignExerciseIdSequence,
  getIndexOrderConflictInfo,
} from "./questions";

export function exerciciosRouter(jwtSecret: string) {
  const router = Router();

  // GET /exercicios - Listar todos os exercícios públicos
  router.get("/exercicios", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const schema = await getExerciseSchemaInfo();
    const isAluno = req.user?.role === "aluno";
    const userId = req.user?.sub;

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const modulo = typeof req.query.modulo === "string" ? req.query.modulo.trim() : "";
    const turmaId = typeof req.query.turmaId === "string" ? req.query.turmaId.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "todos";
    const hasPaginationInput =
      req.query.page !== undefined ||
      req.query.limit !== undefined ||
      req.query.q !== undefined ||
      req.query.modulo !== undefined ||
      req.query.turmaId !== undefined ||
      req.query.status !== undefined;
    const pageRaw = Number(req.query.page ?? 1);
    const limitRaw = Number(req.query.limit ?? 20);
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;
    const offset = (page - 1) * limit;

    if (!schema.hasExercicios) {
      const mapped = await listFromNewExerciseSchema(userId, isAluno, schema);
      const filtered = mapped.filter((ex) => {
        if (q) {
          const term = q.toLowerCase();
          const hasMatch =
            ex.titulo.toLowerCase().includes(term) ||
            (ex.descricao ?? "").toLowerCase().includes(term) ||
            (ex.tema ?? "").toLowerCase().includes(term);
          if (!hasMatch) return false;
        }
        if (modulo && ex.modulo !== modulo) return false;
        if (!isAluno && status !== "todos") {
          const isPublished = ex.publicado !== false;
          const isScheduled = !!ex.publishedAt && new Date(ex.publishedAt).getTime() > Date.now();
          if (status === "rascunho" && (isPublished || isScheduled)) return false;
          if (status === "programado" && !isScheduled) return false;
          if (status === "publicado" && (!isPublished || isScheduled)) return false;
        }
        return true;
      });

      if (!hasPaginationInput) {
        return res.json(filtered);
      }

      const total = filtered.length;
      const items = filtered.slice(offset, offset + limit);
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
    }

    const conditions: string[] = ["1=1"];
    const params: any[] = [];

    if (isAluno) {
      conditions.push("e.publicado = true");
      conditions.push("(e.published_at IS NULL OR e.published_at <= NOW())");
    }

    if (isAluno) {
      const alunoParam = `$${params.length + 1}`;
      params.push(userId);
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM exercicio_aluno ea
          WHERE ea.exercicio_id = e.id AND ea.aluno_id = ${alunoParam}
        )
        OR (
          NOT EXISTS (SELECT 1 FROM exercicio_aluno ea2 WHERE ea2.exercicio_id = e.id)
          AND (
            EXISTS (
              SELECT 1 FROM exercicio_turma et
              WHERE et.exercicio_id = e.id
                AND et.turma_id IN (
                  SELECT ${
                    schema.hasAlunoTurma ? "turma_id" : "class_id"
                  } FROM ${schema.hasAlunoTurma ? "aluno_turma" : "enrollment"}
                  WHERE ${schema.hasAlunoTurma ? "aluno_id" : "user_id"} = ${alunoParam}
                )
            )
            OR NOT EXISTS (SELECT 1 FROM exercicio_turma et2 WHERE et2.exercicio_id = e.id)
          )
        )
      )`);
    }

    if (schema.hasExerciciosIsDailyTask) {
      conditions.push("COALESCE(e.is_daily_task, false) = false");
    }

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(
        e.titulo ILIKE $${params.length}
        OR COALESCE(e.descricao, '') ILIKE $${params.length}
        OR COALESCE(e.tema, '') ILIKE $${params.length}
      )`);
    }

    if (modulo) {
      params.push(modulo);
      conditions.push(`e.modulo = $${params.length}`);
    }

    if (!isAluno && status !== "todos") {
      if (status === "rascunho") {
        conditions.push(`(COALESCE(e.publicado, true) = false AND NOT (e.published_at IS NOT NULL AND e.published_at > NOW()))`);
      } else if (status === "programado") {
        conditions.push(`(e.published_at IS NOT NULL AND e.published_at > NOW())`);
      } else if (status === "publicado") {
        conditions.push(`(COALESCE(e.publicado, true) = true AND NOT (e.published_at IS NOT NULL AND e.published_at > NOW()))`);
      }
    }

    if (turmaId && turmaId !== "todas") {
      params.push(turmaId);
      conditions.push(`NOT EXISTS (SELECT 1 FROM exercicio_aluno ea3 WHERE ea3.exercicio_id = e.id)`);
      conditions.push(`EXISTS (
        SELECT 1 FROM exercicio_turma etf
        WHERE etf.exercicio_id = e.id
          AND etf.turma_id = $${params.length}
      )`);
    }

    const whereClause = conditions.join(" AND ");
    const countResult = hasPaginationInput
      ? await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM exercicios e
         WHERE ${whereClause}`,
        params
      )
      : null;

    const queryParams = hasPaginationInput ? [...params, limit, offset] : params;
    const limitClause = hasPaginationInput
      ? `\n      LIMIT $${queryParams.length - 1}\n      OFFSET $${queryParams.length}`
      : "";

    const query = `
      SELECT
        e.id, e.titulo, e.descricao, e.modulo, e.tema, e.prazo, e.publicado, e.published_at, e.created_by,
        ${schema.hasExerciciosIsDailyTask ? "COALESCE(e.is_daily_task, false)" : "false"} AS is_daily_task,
        e.tipo_exercicio, e.gabarito, e.linguagem_esperada, e.categoria, e.mouse_regras,
        e.multipla_regras, e.atalho_tipo, e.permitir_repeticao, e.max_tentativas, e.penalidade_por_tentativa,
        e.intervalo_reenvio, e.anexo_url, e.anexo_nome, e.created_at, e.updated_at,
        COALESCE(turmas.turmas, '[]'::jsonb) as turmas,
        COALESCE(alunos.alunos, '[]'::jsonb) as alunos
      FROM exercicios e
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'nome', t.${
          schema.hasTurmas ? "nome" : "name"
        }, 'tipo', ${schema.hasTurmas ? "t.tipo" : "'turma'"})) as turmas
        FROM exercicio_turma et
        JOIN ${schema.hasTurmas ? "turmas" : "class"} t ON et.turma_id = t.id
        WHERE et.exercicio_id = e.id
      ) turmas ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario)) as alunos
        FROM exercicio_aluno ea
        JOIN users u ON ea.aluno_id = u.id
        WHERE ea.exercicio_id = e.id
      ) alunos ON true
      WHERE ${whereClause}
      ORDER BY e.created_at DESC${limitClause}
    `;

    const r = await pool.query<ExercicioAccessRow>(query, queryParams);

    const items = r.rows.map((row) => ({
      id: row.id,
      titulo: row.titulo,
      descricao: row.descricao,
      modulo: row.modulo,
      tema: row.tema,
      prazo: row.prazo,
      publicado: row.publicado,
      publishedAt: row.published_at,
      isDailyTask: !!row.is_daily_task,
      tipoExercicio: row.tipo_exercicio,
      categoria: row.categoria,
      mouse_regras: row.mouse_regras,
      multipla_regras: row.multipla_regras,
      atalho_tipo: row.atalho_tipo,
      permitir_repeticao: row.permitir_repeticao ?? false,
      maxTentativas: row.max_tentativas ?? null,
      penalidadePorTentativa: row.penalidade_por_tentativa ?? null,
      intervaloReenvio: row.intervalo_reenvio ?? null,
      createdAt: row.created_at,
      turmas: row.turmas && row.turmas.length > 0 ? row.turmas : undefined,
      alunos: row.alunos && row.alunos.length > 0 ? row.alunos : undefined,
    }));

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
// GET /exercicios/daily-tasks - Lista somente tarefas diárias do banco
  router.get("/exercicios/daily-tasks", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const schema = await getExerciseSchemaInfo();
    const isAluno = req.user?.role === "aluno";
    const userId = req.user?.sub;

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const modulo = typeof req.query.modulo === "string" ? req.query.modulo.trim() : "";
    const turmaId = typeof req.query.turmaId === "string" ? req.query.turmaId.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "todos";
    const hasPaginationInput =
      req.query.page !== undefined ||
      req.query.limit !== undefined ||
      req.query.q !== undefined ||
      req.query.modulo !== undefined ||
      req.query.turmaId !== undefined ||
      req.query.status !== undefined;
    const pageRaw = Number(req.query.page ?? 1);
    const limitRaw = Number(req.query.limit ?? 20);
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;
    const offset = (page - 1) * limit;

    if (!schema.hasExercicios) {
      if (!schema.hasExercise) {
        return hasPaginationInput
          ? res.json({
            items: [],
            total: 0,
            pagination: { page, limit, total: 0, totalPages: 1 },
          })
          : res.json([]);
      }

      const mapped = await listDailyTasksFromNewExerciseSchema(userId, isAluno, schema);
      const filtered = mapped.filter((ex) => {
        if (q) {
          const term = q.toLowerCase();
          const hasMatch =
            ex.titulo.toLowerCase().includes(term) ||
            (ex.descricao ?? "").toLowerCase().includes(term) ||
            (ex.tema ?? "").toLowerCase().includes(term);
          if (!hasMatch) return false;
        }
        if (modulo && ex.modulo !== modulo) return false;
        if (!isAluno && status !== "todos") {
          const isPublished = ex.publicado !== false;
          const isScheduled = !!ex.publishedAt && new Date(ex.publishedAt).getTime() > Date.now();
          if (status === "rascunho" && (isPublished || isScheduled)) return false;
          if (status === "programado" && !isScheduled) return false;
          if (status === "publicado" && (!isPublished || isScheduled)) return false;
        }
        return true;
      });

      if (!hasPaginationInput) {
        return res.json(filtered);
      }

      const total = filtered.length;
      const items = filtered.slice(offset, offset + limit);
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
    }

    const conditions: string[] = ["1=1"];
    const params: any[] = [];

    if (isAluno) {
      conditions.push("e.publicado = true");
      conditions.push("(e.published_at IS NULL OR e.published_at <= NOW())");
    }

    if (isAluno) {
      const alunoParam = `$${params.length + 1}`;
      params.push(userId);
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM exercicio_aluno ea
          WHERE ea.exercicio_id = e.id AND ea.aluno_id = ${alunoParam}
        )
        OR (
          NOT EXISTS (SELECT 1 FROM exercicio_aluno ea2 WHERE ea2.exercicio_id = e.id)
          AND (
            EXISTS (
              SELECT 1 FROM exercicio_turma et
              WHERE et.exercicio_id = e.id
                AND et.turma_id IN (
                  SELECT ${
                    schema.hasAlunoTurma ? "turma_id" : "class_id"
                  } FROM ${schema.hasAlunoTurma ? "aluno_turma" : "enrollment"}
                  WHERE ${schema.hasAlunoTurma ? "aluno_id" : "user_id"} = ${alunoParam}
                )
            )
            OR NOT EXISTS (SELECT 1 FROM exercicio_turma et2 WHERE et2.exercicio_id = e.id)
          )
        )
      )`);
    }

    if (schema.hasExerciciosIsDailyTask) {
      conditions.push("COALESCE(e.is_daily_task, false) = true");
    } else {
      conditions.push(
        `(LOWER(COALESCE(e.tema, '')) LIKE '%tarefa diaria%' OR e.titulo ~* '^dia\\s+[0-9]+\\s*[:\\-]')`
      );
    }

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(
        e.titulo ILIKE $${params.length}
        OR COALESCE(e.descricao, '') ILIKE $${params.length}
        OR COALESCE(e.tema, '') ILIKE $${params.length}
      )`);
    }

    if (modulo) {
      params.push(modulo);
      conditions.push(`e.modulo = $${params.length}`);
    }

    if (!isAluno && status !== "todos") {
      if (status === "rascunho") {
        conditions.push(`(COALESCE(e.publicado, true) = false AND NOT (e.published_at IS NOT NULL AND e.published_at > NOW()))`);
      } else if (status === "programado") {
        conditions.push(`(e.published_at IS NOT NULL AND e.published_at > NOW())`);
      } else if (status === "publicado") {
        conditions.push(`(COALESCE(e.publicado, true) = true AND NOT (e.published_at IS NOT NULL AND e.published_at > NOW()))`);
      }
    }

    if (turmaId && turmaId !== "todas") {
      params.push(turmaId);
      conditions.push(`NOT EXISTS (SELECT 1 FROM exercicio_aluno ea3 WHERE ea3.exercicio_id = e.id)`);
      conditions.push(`EXISTS (
        SELECT 1 FROM exercicio_turma etf
        WHERE etf.exercicio_id = e.id
          AND etf.turma_id = $${params.length}
      )`);
    }

    const whereClause = conditions.join(" AND ");
    const countResult = hasPaginationInput
      ? await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM exercicios e
         WHERE ${whereClause}`,
        params
      )
      : null;

    const queryParams = hasPaginationInput ? [...params, limit, offset] : params;
    const limitClause = hasPaginationInput
      ? `\n      LIMIT $${queryParams.length - 1}\n      OFFSET $${queryParams.length}`
      : "";

    const query = `
      SELECT
        e.id, e.titulo, e.descricao, e.modulo, e.tema, e.prazo, e.publicado, e.published_at, e.created_by,
        e.tipo_exercicio, e.gabarito, e.linguagem_esperada, e.categoria, e.mouse_regras,
        e.multipla_regras, e.atalho_tipo, e.permitir_repeticao, e.max_tentativas, e.penalidade_por_tentativa,
        e.intervalo_reenvio, e.anexo_url, e.anexo_nome, e.created_at, e.updated_at,
        COALESCE(turmas.turmas, '[]'::jsonb) as turmas,
        COALESCE(alunos.alunos, '[]'::jsonb) as alunos
      FROM exercicios e
      LEFT JOIN LATERAL (
        Select jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'nome', t.${
          schema.hasTurmas ? "nome" : "name"
        }, 'tipo', ${schema.hasTurmas ? "t.tipo" : "'turma'"})) as turmas
        FROM exercicio_turma et
        JOIN ${schema.hasTurmas ? "turmas" : "class"} t ON et.turma_id = t.id
        WHERE et.exercicio_id = e.id
      ) turmas ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario)) as alunos
        FROM exercicio_aluno ea
        JOIN users u ON ea.aluno_id = u.id
        WHERE ea.exercicio_id = e.id
      ) alunos ON true
      WHERE ${whereClause}
      ORDER BY e.prazo ASC NULLS LAST, e.created_at DESC${limitClause}
    `;

    const r = await pool.query<ExercicioAccessRow>(query, queryParams);

    const items = r.rows.map((row) => ({
      id: row.id,
      titulo: row.titulo,
      descricao: row.descricao,
      modulo: row.modulo,
      tema: row.tema,
      prazo: row.prazo,
      publicado: row.publicado,
      publishedAt: row.published_at,
      tipoExercicio: row.tipo_exercicio,
      categoria: row.categoria,
      mouse_regras: row.mouse_regras,
      multipla_regras: row.multipla_regras,
      atalho_tipo: row.atalho_tipo,
      permitir_repeticao: row.permitir_repeticao ?? false,
      maxTentativas: row.max_tentativas ?? null,
      penalidadePorTentativa: row.penalidade_por_tentativa ?? null,
      intervaloReenvio: row.intervalo_reenvio ?? null,
      anexoUrl: row.anexo_url,
      anexoNome: row.anexo_nome,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      turmas: row.turmas && row.turmas.length > 0 ? row.turmas : undefined,
      alunos: row.alunos && row.alunos.length > 0 ? row.alunos : undefined,
      isDailyTask: true,
    }));

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
// GET /exercicios/:id - Pegar detalhes de um exercício específico
  router.get("/exercicios/:id", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const schema = await getExerciseSchemaInfo();
    const isAluno = req.user?.role === "aluno";
    const { id } = req.params;

    if (!schema.hasExercicios) {
      const mapped = await getFromNewExerciseSchema(String(id), req.user?.sub, isAluno, schema);
      if (!mapped) return res.status(404).json({ message: "Exercício não encontrado" });
      return res.json(mapped);
    }

    const params: any[] = [id];
    const conditions: string[] = [
      "e.id = $1",
    ];
    // Alunos só veem exercícios publicados e com published_at no passado
    if (isAluno) {
      conditions.push("e.publicado = true");
      conditions.push("(e.published_at IS NULL OR e.published_at <= NOW())");
    }
    if (isAluno) {
      const alunoParam = `$${params.length + 1}`;
      params.push(req.user?.sub);
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM exercicio_aluno ea
          WHERE ea.exercicio_id = e.id AND ea.aluno_id = ${alunoParam}
        )
        OR (
          NOT EXISTS (SELECT 1 FROM exercicio_aluno ea2 WHERE ea2.exercicio_id = e.id)
          AND (
            EXISTS (
              SELECT 1 FROM exercicio_turma et
              WHERE et.exercicio_id = e.id
                AND et.turma_id IN (
                  SELECT ${
                    schema.hasAlunoTurma ? "turma_id" : "class_id"
                  } FROM ${schema.hasAlunoTurma ? "aluno_turma" : "enrollment"}
                  WHERE ${schema.hasAlunoTurma ? "aluno_id" : "user_id"} = ${alunoParam}
                )
            )
            OR NOT EXISTS (SELECT 1 FROM exercicio_turma et2 WHERE et2.exercicio_id = e.id)
          )
        )
      )`);
    }

    const r = await pool.query<ExercicioAccessRow>(
      `SELECT
         e.id, e.titulo, e.descricao, e.modulo, e.tema, e.prazo, e.publicado, e.published_at, e.created_by,
         e.tipo_exercicio, e.gabarito, e.linguagem_esperada, e.categoria, e.mouse_regras,
         e.multipla_regras, e.atalho_tipo, e.permitir_repeticao, e.max_tentativas, e.penalidade_por_tentativa,
         e.intervalo_reenvio, e.anexo_url, e.anexo_nome, e.created_at, e.updated_at,
         COALESCE(turmas.turmas, '[]'::jsonb) as turmas,
         COALESCE(alunos.alunos, '[]'::jsonb) as alunos
       FROM exercicios e
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'nome', t.${
           schema.hasTurmas ? "nome" : "name"
         }, 'tipo', ${schema.hasTurmas ? "t.tipo" : "'turma'"})) as turmas
         FROM exercicio_turma et
         JOIN ${schema.hasTurmas ? "turmas" : "class"} t ON et.turma_id = t.id
         WHERE et.exercicio_id = e.id
       ) turmas ON true
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario)) as alunos
         FROM exercicio_aluno ea
         JOIN users u ON ea.aluno_id = u.id
         WHERE ea.exercicio_id = e.id
       ) alunos ON true
       WHERE ${conditions.join(" AND ")}`,
      params
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ message: "Exercício não encontrado" });
    }

    const row = r.rows[0];
    return res.json({
      id: row.id,
      titulo: row.titulo,
      descricao: row.descricao,
      modulo: row.modulo,
      tema: row.tema,
      prazo: row.prazo,
      publishedAt: row.published_at,
      publicado: row.publicado,
      tipoExercicio: row.tipo_exercicio,
      gabarito: isAluno ? undefined : row.gabarito,
      linguagemEsperada: row.linguagem_esperada,
      categoria: row.categoria,
      mouse_regras: row.mouse_regras,
      multipla_regras: row.multipla_regras,
      atalho_tipo: row.atalho_tipo,
      permitir_repeticao: row.permitir_repeticao ?? false,
      maxTentativas: row.max_tentativas ?? null,
      penalidadePorTentativa: row.penalidade_por_tentativa ?? null,
      intervaloReenvio: row.intervalo_reenvio ?? null,
      anexoUrl: row.anexo_url,
      anexoNome: row.anexo_nome,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      turmas: row.turmas && row.turmas.length > 0 ? row.turmas : undefined,
      alunos: row.alunos && row.alunos.length > 0 ? row.alunos : undefined,
    });
  });

  // Protegido: só admin/professor cria
  router.post(
    "/exercicios/ai/generate",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    aiDraftLimiter,
    async (req: AuthRequest, res) => {
      const parsed = aiGenerateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { prompt, courseId, moduleId, phaseId, categoria, componentType, difficulty } = parsed.data;

      try {
        const context = await resolveGenerationContext(courseId, moduleId, phaseId);
        if (!context) {
          return res.status(400).json({
            message: "Curso, modulo e fase invalidos ou inconsistentes entre si.",
          });
        }

        const draft = await generateExerciseDraftWithGroq({
          prompt,
          categoria,
          componentType,
          difficulty,
          courseName: context.course_name,
          moduleName: context.module_name,
          phaseName: context.phase_name,
        });

        await logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "generate_exercicio_ai_draft",
          entityType: "exercicio_ai",
          entityId: null,
          metadata: {
            courseId,
            moduleId,
            phaseId,
            categoria,
            componentType,
            difficulty: difficulty ?? null,
            promptLength: prompt.length,
          },
          req,
        }).catch((error) => console.error("activity log error:", error));

        return res.json({
          message: "Rascunho gerado com sucesso",
          draft,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro ao gerar rascunho no Groq.";
        if (error instanceof Error && error.name === "AbortError") {
          return res.status(504).json({ message: "Tempo limite atingido ao gerar rascunho no Groq." });
        }
        if (errorMessage.includes("GROQ_API_KEY")) {
          return res.status(503).json({ message: errorMessage });
        }
        if (errorMessage.toLowerCase().includes("groq")) {
          return res.status(502).json({ message: errorMessage });
        }
        if (errorMessage.toLowerCase().includes("invalid")) {
          return res.status(502).json({ message: "Resposta invalida recebida do Groq." });
        }
        console.error("Erro ao gerar rascunho de exercicio com IA:", error);
        return res.status(500).json({ message: "Erro ao gerar rascunho de exercicio com IA." });
      }
    }
  );

  router.post(
    "/exercicios",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const schema = await getExerciseSchemaInfo();
      if (!schema.hasExercicios) {
        if (!schema.hasExercise) {
          return res.status(500).json({ message: "Tabela exercise nao encontrada no banco" });
        }

        const normalizedNewBody = normalizeNewSchemaBody(req.body);
        const parsedNew = createNewSchema.safeParse(normalizedNewBody);
        if (!parsedNew.success) {
          return res.status(400).json({
            message: "Dados invalidos",
            issues: parsedNew.error.flatten().fieldErrors,
          });
        }

        const {
          titulo,
          descricao,
          phase_id,
          course_id,
          prazo,
          multipla_regras,
          tipo_exercicio,
          video_url,
          difficulty,
          index_order,
          is_final_exercise,
          is_daily_task,
          points_redeem,
          exercise_period,
        } = parsedNew.data;
        if (!prazo) {
          return res.status(400).json({
            message: "Dados invalidos",
            issues: {
              prazo: ["Prazo obrigatorio para criar exercicio"],
            },
          });
        }
        const difficultyValue = difficulty ?? 1;
        const indexOrderValue = index_order ?? 1;
        const pointsRedeemValue = points_redeem ?? 0;
        const exercisePeriodValue = exercise_period ?? new Date();
        const hasMultiplaInput = Object.prototype.hasOwnProperty.call(normalizedNewBody, "multipla_regras");
        const multiplaRawValue = normalizeOptionalText(multipla_regras);
        const multiplaQuestoes = getMultiplaQuestoesFromPayload(multipla_regras);
        const phaseRow = await getPhaseWithModuleById(phase_id);
        if (!phaseRow) {
          return res.status(404).json({ message: "Fase nao encontrada" });
        }
        if (course_id && phaseRow.course_id !== Number(course_id)) {
          return res.status(400).json({ message: "A fase selecionada nao pertence ao curso informado" });
        }
        if (schema.hasExerciseIndexOrder) {
          const conflict = await getIndexOrderConflictInfo(phase_id, indexOrderValue);
          if (conflict.taken) {
            return res.status(400).json({
              message: `A ordem ${indexOrderValue} ja existe nessa fase/modulo. A menor ordem e ${conflict.smallestAvailable} (index disponivel).`,
              issues: {
                index_order: [
                  `A menor ordem e ${conflict.smallestAvailable} (index disponivel).`,
                ],
              },
            });
          }
        }
        if (multiplaRawValue && multiplaQuestoes.length === 0) {
          return res.status(400).json({
            message: "Preencha todas as informações necessárias para a alteração.",
          });
        }
        if (multiplaQuestoes.length > 0 && (!schema.hasQuestion || !schema.hasQuestionOption)) {
          return res.status(400).json({
            message: getMultipleChoicePersistenceMissingMessage(),
          });
        }

        const providedTipo = tipo_exercicio ?? (req.body as any).tipoExercicio ?? (req.body as any).tipo ?? null;
        const tipoExercicio = providedTipo ?? detectarTipoExercicio(titulo, descricao);

        const dailyTask = !!is_daily_task;
        const finalExercise = !!is_final_exercise;
        const client = await pool.connect();
        let row: NewExerciseRow | null = null;

        try {
          for (let attempt = 0; attempt < 2 && !row; attempt += 1) {
            await client.query("BEGIN");
            try {
              const insertColumns = ["title", "description", "phase_id", "term_at", "type_exercise"];
              const insertValues = ["$1", "$2", "$3", "$4", "$5"];
              const insertParams: unknown[] = [
                titulo,
                descricao,
                phase_id,
                prazo ?? null,
                mapTipoExercicioToTypeExercise(tipoExercicio),
              ];

              if (schema.hasExerciseIsDailyTask) {
                insertColumns.push("is_daily_task");
                insertParams.push(dailyTask);
                insertValues.push(`$${insertParams.length}`);
              }
              if (schema.hasExerciseVideoUrl) {
                insertColumns.push("video_url");
                insertParams.push(video_url?.trim() || null);
                insertValues.push(`$${insertParams.length}`);
              }
              if (schema.hasExerciseDifficulty) {
                insertColumns.push("difficulty");
                insertParams.push(difficultyValue);
                insertValues.push(`$${insertParams.length}`);
              }
              if (schema.hasExerciseIndexOrder) {
                insertColumns.push("index_order");
                insertParams.push(indexOrderValue);
                insertValues.push(`$${insertParams.length}`);
              }
              if (schema.hasExerciseIsFinalExercise) {
                insertColumns.push("is_final_exercise");
                insertParams.push(finalExercise);
                insertValues.push(`$${insertParams.length}`);
              }
              if (schema.hasExercisePointsRedeem) {
                insertColumns.push("points_redeem");
                insertParams.push(pointsRedeemValue);
                insertValues.push(`$${insertParams.length}`);
              }
              if (schema.hasExerciseExercisePeriod) {
                insertColumns.push("exercise_period");
                insertParams.push(exercisePeriodValue);
                insertValues.push(`$${insertParams.length}`);
              }
              if (schema.exerciseAnswerKeyColumn) {
                insertColumns.push(schema.exerciseAnswerKeyColumn);
                insertParams.push(null);
                insertValues.push(`$${insertParams.length}`);
              }

              const insertSql = `INSERT INTO exercise (${insertColumns.join(", ")}, created_at, updated_at)
                 VALUES (${insertValues.join(", ")}, NOW(), NOW())
                 RETURNING ${getNewExerciseReturningFields(schema).join(", ")}`;

              const created = await client.query<NewExerciseRow>(insertSql, insertParams);
              row = created.rows[0];

              if (row && (hasMultiplaInput || multiplaQuestoes.length > 0)) {
                await syncNewSchemaMultiplaQuestoes(client, row.id, multiplaQuestoes);
              }

              await client.query("COMMIT");
            } catch (err: any) {
              await client.query("ROLLBACK");
              const isDuplicateId =
                err?.code === "23505" &&
                typeof err?.detail === "string" &&
                err.detail.includes("(id)=");
              if (isDuplicateId && attempt === 0) {
                await realignExerciseIdSequence();
                continue;
              }
              throw err;
            }
          }
        } finally {
          client.release();
        }

        if (!row) {
          return res.status(500).json({ message: "Nao foi possivel criar o exercicio no schema novo." });
        }

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "create",
          entityType: "exercicio",
          entityId: String(row.id),
          metadata: {
            titulo: row.title,
            courseId: phaseRow.course_id,
            modulo: phaseRow.module_name,
            tema: phaseRow.phase_name,
            phaseId: row.phase_id,
            categoria: "programacao",
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

        const exercicio = mapNewExerciseRow({
          ...row,
          modulo: phaseRow.module_name ?? null,
          tema: phaseRow.phase_name ?? null,
        }, {
          multiplaQuestoes,
        });

        return res.status(201).json({
          message: "Exercicio criado!",
          exercicio,
        });
      }

      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { titulo, descricao, modulo, tema, prazo, publicado, published_at, linguagem_esperada, categoria, mouse_regras, multipla_regras, tipo_exercicio, permitir_repeticao, max_tentativas, penalidade_por_tentativa, intervalo_reenvio } = parsed.data;

      // Usar tipo fornecido (snake_case ou camelCase) se houver, caso contrário detectar automaticamente
      const providedTipo = tipo_exercicio ?? (req.body as any).tipoExercicio ?? (req.body as any).tipo ?? null;
      const tipoExercicio = providedTipo ?? detectarTipoExercicio(titulo, descricao);

      // Se tem published_at, publicado deve ser false até que a data chegue
      const shouldPublish = published_at ? false : (publicado ?? true);

      const created = await pool.query<ExercicioRow>(
        `INSERT INTO exercicios (titulo, descricao, modulo, tema, prazo, publicado, published_at, created_by, tipo_exercicio, gabarito, linguagem_esperada, categoria, mouse_regras, multipla_regras, atalho_tipo, permitir_repeticao, max_tentativas, penalidade_por_tentativa, intervalo_reenvio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING id, titulo, descricao, modulo, tema, prazo, publicado, created_by, tipo_exercicio, gabarito, linguagem_esperada, categoria, mouse_regras, multipla_regras, atalho_tipo, permitir_repeticao, max_tentativas, penalidade_por_tentativa, intervalo_reenvio, anexo_url, anexo_nome, created_at, updated_at`,
        [
          titulo,
          descricao,
          modulo,
          tema ?? null,
          prazo ?? null,
          shouldPublish,
          published_at ?? null,
          req.user?.sub ?? null,
          tipoExercicio,
          null,
          linguagem_esperada ?? null,
          categoria ?? "programacao",
          mouse_regras ?? null,
          multipla_regras ?? null,
          (req.body as any).atalho_tipo ?? null,
          permitir_repeticao ?? false,
          max_tentativas ?? null,
          penalidade_por_tentativa ?? 0,
          intervalo_reenvio ?? null,
        ]
      );

      const row = created.rows[0];
      const turmaIds = parseIdArray((req.body as any).turma_ids);
      if (turmaIds.length > 0) {
        for (const turmaId of turmaIds) {
          await pool.query(
            `INSERT INTO exercicio_turma (exercicio_id, turma_id)
             VALUES ($1, $2)
             ON CONFLICT (exercicio_id, turma_id) DO NOTHING`,
            [row.id, turmaId]
          );
        }
      }

      const alunoIds = parseIdArray((req.body as any).aluno_ids);
      if (alunoIds.length > 0) {
        for (const alunoId of alunoIds) {
          await pool.query(
            `INSERT INTO exercicio_aluno (exercicio_id, aluno_id)
             VALUES ($1, $2)
             ON CONFLICT (exercicio_id, aluno_id) DO NOTHING`,
            [row.id, alunoId]
          );
        }
      }
      
      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "create",
        entityType: "exercicio",
        entityId: row.id,
        metadata: {
          titulo: row.titulo,
          modulo: row.modulo,
          publicado: row.publicado,
          categoria: row.categoria,
          turmaIds,
          alunoIds,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

        return res.status(201).json({
        message: "Exercício criado!",
        exercicio: {
          id: row.id,
          titulo: row.titulo,
          descricao: row.descricao,
          modulo: row.modulo,
          tema: row.tema,
          prazo: row.prazo,
          publicado: row.publicado,
          tipoExercicio: row.tipo_exercicio,
          gabarito: row.gabarito,
          linguagemEsperada: row.linguagem_esperada,
          categoria: row.categoria,
          mouse_regras: row.mouse_regras,
          multipla_regras: row.multipla_regras,
          atalho_tipo: row.atalho_tipo,
          permitir_repeticao: row.permitir_repeticao ?? false,
          maxTentativas: row.max_tentativas ?? null,
          penalidadePorTentativa: row.penalidade_por_tentativa ?? null,
          intervaloReenvio: row.intervalo_reenvio ?? null,
          anexoUrl: row.anexo_url,
          anexoNome: row.anexo_nome,
          createdAt: row.created_at,
        },
      });
    }
  );

  // Protegido: só admin/professor pode atualizar
  router.put(
    "/exercicios/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const schema = await getExerciseSchemaInfo();

      if (!schema.hasExercicios) {
        if (!schema.hasExercise) {
          return res.status(500).json({ message: "Tabela exercise nao encontrada no banco" });
        }

        const exerciseId = Number(id);
        if (!Number.isFinite(exerciseId)) {
          return res.status(400).json({ message: "ID de exercicio invalido" });
        }

        const normalizedNewBody = normalizeNewSchemaBody(req.body);
        const parsedNew = createNewSchema.safeParse(normalizedNewBody);
        if (!parsedNew.success) {
          return res.status(400).json({
            message: "Dados invalidos",
            issues: parsedNew.error.flatten().fieldErrors,
          });
        }

        const {
          titulo,
          descricao,
          phase_id,
          course_id,
          prazo,
          multipla_regras,
          tipo_exercicio,
          video_url,
          difficulty,
          index_order,
          is_final_exercise,
          is_daily_task,
          points_redeem,
          exercise_period,
        } = parsedNew.data;
        if (!prazo) {
          return res.status(400).json({
            message: "Dados invalidos",
            issues: {
              prazo: ["Prazo obrigatorio para atualizar exercicio"],
            },
          });
        }
        const difficultyValue = difficulty ?? 1;
        const indexOrderValue = index_order ?? 1;
        const pointsRedeemValue = points_redeem ?? 0;
        const exercisePeriodValue = exercise_period ?? new Date();
        const hasMultiplaInput = Object.prototype.hasOwnProperty.call(normalizedNewBody, "multipla_regras");
        const multiplaRawValue = normalizeOptionalText(multipla_regras);
        const multiplaQuestoes = getMultiplaQuestoesFromPayload(multipla_regras);
        const phaseRow = await getPhaseWithModuleById(phase_id);
        if (!phaseRow) {
          return res.status(404).json({ message: "Fase nao encontrada" });
        }
        if (course_id && phaseRow.course_id !== Number(course_id)) {
          return res.status(400).json({ message: "A fase selecionada nao pertence ao curso informado" });
        }
        if (schema.hasExerciseIndexOrder) {
          const conflict = await getIndexOrderConflictInfo(phase_id, indexOrderValue, exerciseId);
          if (conflict.taken) {
            return res.status(400).json({
              message: `A ordem ${indexOrderValue} ja existe nessa fase/modulo. A menor ordem e ${conflict.smallestAvailable} (index disponivel).`,
              issues: {
                index_order: [
                  `A menor ordem e ${conflict.smallestAvailable} (index disponivel).`,
                ],
              },
            });
          }
        }
        if (multiplaRawValue && multiplaQuestoes.length === 0) {
          return res.status(400).json({
            message: "Preencha todas as informações necessárias para a alteração.",
          });
        }
        if (multiplaQuestoes.length > 0 && (!schema.hasQuestion || !schema.hasQuestionOption)) {
          return res.status(400).json({
            message: getMultipleChoicePersistenceMissingMessage(),
          });
        }

        const checkExercicioNovo = await pool.query<{ id: number }>(
          `SELECT id FROM exercise WHERE id = $1 LIMIT 1`,
          [exerciseId]
        );
        if (checkExercicioNovo.rows.length === 0) {
          return res.status(404).json({ message: "Exercicio nao encontrado" });
        }

        const providedTipo = tipo_exercicio ?? (req.body as any).tipoExercicio ?? (req.body as any).tipo ?? null;
        const tipoExercicio = providedTipo ?? detectarTipoExercicio(titulo, descricao);
        const dailyTask = !!is_daily_task;
        const finalExercise = !!is_final_exercise;
        const client = await pool.connect();
        let rowNew: NewExerciseRow | null = null;

        try {
          await client.query("BEGIN");

          const updateSet: string[] = [
            "title = $1",
            "description = $2",
            "phase_id = $3",
            "term_at = $4",
            "type_exercise = $5",
          ];
          const updateParams: unknown[] = [
            titulo,
            descricao,
            phase_id,
            prazo ?? null,
            mapTipoExercicioToTypeExercise(tipoExercicio),
          ];

          if (schema.hasExerciseIsDailyTask) {
            updateSet.push(`is_daily_task = $${updateParams.length + 1}`);
            updateParams.push(dailyTask);
          }
          if (schema.hasExerciseVideoUrl) {
            updateSet.push(`video_url = $${updateParams.length + 1}`);
            updateParams.push(video_url?.trim() || null);
          }
          if (schema.hasExerciseDifficulty) {
            updateSet.push(`difficulty = $${updateParams.length + 1}`);
            updateParams.push(difficultyValue);
          }
          if (schema.hasExerciseIndexOrder) {
            updateSet.push(`index_order = $${updateParams.length + 1}`);
            updateParams.push(indexOrderValue);
          }
          if (schema.hasExerciseIsFinalExercise) {
            updateSet.push(`is_final_exercise = $${updateParams.length + 1}`);
            updateParams.push(finalExercise);
          }
          if (schema.hasExercisePointsRedeem) {
            updateSet.push(`points_redeem = $${updateParams.length + 1}`);
            updateParams.push(pointsRedeemValue);
          }
          if (schema.hasExerciseExercisePeriod) {
            updateSet.push(`exercise_period = $${updateParams.length + 1}`);
            updateParams.push(exercisePeriodValue);
          }
          if (schema.exerciseAnswerKeyColumn) {
            updateSet.push(`${schema.exerciseAnswerKeyColumn} = NULL`);
          }

          updateSet.push("updated_at = NOW()");
          updateParams.push(exerciseId);

          const updatedNew = await client.query<NewExerciseRow>(
            `UPDATE exercise
             SET ${updateSet.join(", ")}
             WHERE id = $${updateParams.length}
             RETURNING ${getNewExerciseReturningFields(schema).join(", ")}`,
            updateParams
          );

          rowNew = updatedNew.rows[0] ?? null;
          if (!rowNew) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Exercicio nao encontrado" });
          }

          if (hasMultiplaInput) {
            await syncNewSchemaMultiplaQuestoes(client, exerciseId, multiplaQuestoes);
          }

          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          if (error instanceof Error && error.message.includes("Nao e possivel alterar as questoes de multipla escolha")) {
            return res.status(409).json({ message: error.message });
          }
          throw error;
        } finally {
          client.release();
        }

        if (!rowNew) {
          return res.status(500).json({ message: "Nao foi possivel atualizar o exercicio no schema novo." });
        }

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "update",
          entityType: "exercicio",
          entityId: String(rowNew.id),
          metadata: {
            titulo: rowNew.title,
            courseId: phaseRow.course_id,
            modulo: phaseRow.module_name,
            tema: phaseRow.phase_name,
            phaseId: rowNew.phase_id,
            categoria: "programacao",
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

        const persistedMultiplaQuestoes = hasMultiplaInput
          ? multiplaQuestoes
          : (await loadNewSchemaMultiplaMap(pool, [exerciseId])).get(exerciseId) ?? [];

        const exercicio = mapNewExerciseRow({
          ...rowNew,
          modulo: phaseRow.module_name ?? null,
          tema: phaseRow.phase_name ?? null,
        }, {
          multiplaQuestoes: persistedMultiplaQuestoes,
        });

        return res.json({
          message: "Exercicio atualizado!",
          exercicio,
        });
      }

      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      // Verificar se exercício existe
      const checkExercicio = await pool.query<ExercicioRow>(
        `SELECT id, anexo_url FROM exercicios WHERE id = $1`,
        [id]
      );

      if (checkExercicio.rows.length === 0) {
        return res.status(404).json({ message: "Exercício não encontrado" });
      }

      const { titulo, descricao, modulo, tema, prazo, publicado, linguagem_esperada, categoria, mouse_regras, multipla_regras, atalho_tipo, tipo_exercicio, permitir_repeticao, max_tentativas, penalidade_por_tentativa, intervalo_reenvio, published_at } = parsed.data;

      // Usar tipo fornecido (snake_case ou camelCase) se houver, caso contrário detectar automaticamente
      const providedTipo = tipo_exercicio ?? (req.body as any).tipoExercicio ?? (req.body as any).tipo ?? null;
      const tipoExercicio = providedTipo ?? detectarTipoExercicio(titulo, descricao);

      const shouldPublish = published_at ? false : (publicado ?? true);

      const updated = await pool.query<ExercicioRow>(
        `UPDATE exercicios
         SET titulo = $1, descricao = $2, modulo = $3, tema = $4, prazo = $5,
             publicado = $6, published_at = $7, tipo_exercicio = $8, gabarito = $9, linguagem_esperada = $10,
             categoria = $11, mouse_regras = $12, multipla_regras = $13, atalho_tipo = $14, permitir_repeticao = $15,
             max_tentativas = $16, penalidade_por_tentativa = $17, intervalo_reenvio = $18, updated_at = NOW()
         WHERE id = $19
         RETURNING id, titulo, descricao, modulo, tema, prazo, publicado, created_by, tipo_exercicio, gabarito, linguagem_esperada, categoria, mouse_regras, multipla_regras, atalho_tipo, permitir_repeticao, max_tentativas, penalidade_por_tentativa, intervalo_reenvio, anexo_url, anexo_nome, created_at, updated_at`,
        [
          titulo,
          descricao,
          modulo,
          tema ?? null,
          prazo ?? null,
          shouldPublish,
          published_at ?? null,
          tipoExercicio,
          null,
          linguagem_esperada ?? null,
          categoria ?? "programacao",
          mouse_regras ?? null,
          multipla_regras ?? null,
          atalho_tipo ?? null,
          permitir_repeticao ?? false,
          max_tentativas ?? null,
          penalidade_por_tentativa ?? 0,
          intervalo_reenvio ?? null,
          id,
        ]
      );

      const row = updated.rows[0];
      const hasTurmaIds = Object.prototype.hasOwnProperty.call(req.body, "turma_ids");
      const hasAlunoIds = Object.prototype.hasOwnProperty.call(req.body, "aluno_ids");

      if (hasAlunoIds && !hasTurmaIds) {
        await pool.query("DELETE FROM exercicio_turma WHERE exercicio_id = $1", [id]);
      }
      if (hasTurmaIds && !hasAlunoIds) {
        await pool.query("DELETE FROM exercicio_aluno WHERE exercicio_id = $1", [id]);
      }

      if (hasTurmaIds) {
        const turmaIds = parseIdArray((req.body as any).turma_ids);
        await pool.query("DELETE FROM exercicio_turma WHERE exercicio_id = $1", [id]);
        if (turmaIds.length > 0) {
          for (const turmaId of turmaIds) {
            await pool.query(
              `INSERT INTO exercicio_turma (exercicio_id, turma_id)
               VALUES ($1, $2)
               ON CONFLICT (exercicio_id, turma_id) DO NOTHING`,
              [id, turmaId]
            );
          }
        }
      }

      if (hasAlunoIds) {
        const alunoIds = parseIdArray((req.body as any).aluno_ids);
        await pool.query("DELETE FROM exercicio_aluno WHERE exercicio_id = $1", [id]);
        if (alunoIds.length > 0) {
          for (const alunoId of alunoIds) {
            await pool.query(
              `INSERT INTO exercicio_aluno (exercicio_id, aluno_id)
               VALUES ($1, $2)
               ON CONFLICT (exercicio_id, aluno_id) DO NOTHING`,
              [id, alunoId]
            );
          }
        }
      }
      
      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "update",
        entityType: "exercicio",
        entityId: row.id,
        metadata: {
          titulo: row.titulo,
          modulo: row.modulo,
          publicado: row.publicado,
          categoria: row.categoria,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({
        message: "Exercício atualizado!",
        exercicio: {
          id: row.id,
          titulo: row.titulo,
          descricao: row.descricao,
          modulo: row.modulo,
          tema: row.tema,
          prazo: row.prazo,
          publicado: row.publicado,
          tipoExercicio: row.tipo_exercicio,
          gabarito: row.gabarito,
          linguagemEsperada: row.linguagem_esperada,
          categoria: row.categoria,
          mouse_regras: row.mouse_regras,
          multipla_regras: row.multipla_regras,
          atalho_tipo: row.atalho_tipo,
          permitir_repeticao: row.permitir_repeticao ?? false,
          maxTentativas: row.max_tentativas ?? null,
          penalidadePorTentativa: row.penalidade_por_tentativa ?? null,
          intervaloReenvio: row.intervalo_reenvio ?? null,
          anexoUrl: row.anexo_url,
          anexoNome: row.anexo_nome,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    }
  );

  // Protegido: anexar arquivo ao exercício
  router.post(
    "/exercicios/:id/anexo",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    upload.single("anexo"),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "Arquivo é obrigatório" });
      }

      const check = await pool.query<ExercicioRow>(
        `SELECT id, anexo_url, anexo_nome FROM exercicios WHERE id = $1`,
        [id]
      );

      if (check.rows.length === 0) {
        return res.status(404).json({ message: "Exercício não encontrado" });
      }

      const existing = check.rows[0];
      if (existing.anexo_url) {
        await deleteFromR2(existing.anexo_url).catch((err) =>
          console.error("Erro ao deletar anexo anterior:", err)
        );
      }

      const url = await uploadToR2(file, "exercicios");
      const nome = file.originalname;

      const updatedRow = await pool.query<ExercicioRow>(
        `UPDATE exercicios
         SET anexo_url = $1, anexo_nome = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, anexo_url, anexo_nome`,
        [url, nome, id]
      );

      return res.json({
        message: "Anexo atualizado!",
        anexoUrl: updatedRow.rows[0].anexo_url,
        anexoNome: updatedRow.rows[0].anexo_nome,
      });
    }
  );

  // Protegido: remover anexo do exercício
  router.delete(
    "/exercicios/:id/anexo",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;

      const check = await pool.query<ExercicioRow>(
        `SELECT id, anexo_url FROM exercicios WHERE id = $1`,
        [id]
      );

      if (check.rows.length === 0) {
        return res.status(404).json({ message: "Exercício não encontrado" });
      }

      const existing = check.rows[0];
      if (existing.anexo_url) {
        await deleteFromR2(existing.anexo_url).catch((err) =>
          console.error("Erro ao deletar anexo:", err)
        );
      }

      await pool.query(
        `UPDATE exercicios SET anexo_url = NULL, anexo_nome = NULL, updated_at = NOW() WHERE id = $1`,
        [id]
      );

      return res.json({ message: "Anexo removido" });
    }
  );

  // Protegido: só admin/professor pode deletar
  router.delete(
    "/exercicios/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const schema = await getExerciseSchemaInfo();

      if (!schema.hasExercicios) {
        if (!schema.hasExercise) {
          return res.status(500).json({ message: "Tabela exercise nao encontrada no banco" });
        }

        const exerciseId = Number(id);
        if (!Number.isFinite(exerciseId)) {
          return res.status(400).json({ message: "ID de exercicio invalido" });
        }

        const checkExercicioNovo = await pool.query<{ id: number }>(
          `SELECT id FROM exercise WHERE id = $1 LIMIT 1`,
          [exerciseId]
        );
        if (checkExercicioNovo.rows.length === 0) {
          return res.status(404).json({ message: "Exercicio nao encontrado" });
        }

        await pool.query(`DELETE FROM exercise WHERE id = $1`, [exerciseId]);

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "delete",
          entityType: "exercicio",
          entityId: String(exerciseId),
          metadata: { id: exerciseId },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.json({ message: "Exercicio deletado com sucesso" });
      }

      const checkExercicio = await pool.query<ExercicioRow>(
        `SELECT id, anexo_url FROM exercicios WHERE id = $1`,
        [id]
      );
      if (checkExercicio.rows.length === 0) {
        return res.status(404).json({ message: "Exercicio nao encontrado" });
      }

      const exercicio = checkExercicio.rows[0];
      if (exercicio.anexo_url) {
        await deleteFromR2(exercicio.anexo_url).catch((err) =>
          console.error("Erro ao deletar anexo do exercicio:", err)
        );
      }

      if (await hasLegacySubmissoesTable()) {
        const arquivosSubmissoes = await pool.query<{ arquivo_url: string | null }>(
          `SELECT arquivo_url FROM submissoes WHERE exercicio_id = $1 AND arquivo_url IS NOT NULL`,
          [id]
        );
        for (const row of arquivosSubmissoes.rows) {
          if (row.arquivo_url) {
            await deleteFromR2(row.arquivo_url).catch((err) =>
              console.error("Erro ao deletar arquivo de submissao:", err)
            );
          }
        }

        await pool.query(`DELETE FROM submissoes WHERE exercicio_id = $1`, [id]);
      }

      await pool.query(`DELETE FROM exercicios WHERE id = $1`, [id]);

      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "delete",
        entityType: "exercicio",
        entityId: id,
        metadata: { id },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({ message: "Exercicio deletado com sucesso" });
    }
  );

  // GET /exercicios/by-phase/:phaseId - list exercises for a specific phase
  router.get(
    "/exercicios/by-phase/:phaseId",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      try {
        const phaseId = Number(req.params.phaseId);
        if (!Number.isFinite(phaseId)) {
          return res.status(400).json({ message: "ID de fase inválido" });
        }

        const rawDifficulty =
          typeof req.query.difficulty === "string" ? req.query.difficulty.trim() : "";
        let difficulty: number | null = null;
        if (rawDifficulty.length > 0) {
          const parsedDifficulty = Number(rawDifficulty);
          if (!Number.isInteger(parsedDifficulty) || parsedDifficulty < 1) {
            return res.status(400).json({ message: "Dificuldade inválida" });
          }
          difficulty = parsedDifficulty;
        }

        const schema = await getExerciseSchemaInfo();

        if (schema.hasExercise) {
          const params: number[] = [phaseId];
          const where = ["e.phase_id = $1"];

          if (difficulty !== null && schema.hasExerciseDifficulty) {
            params.push(difficulty);
            where.push(`COALESCE(e.difficulty, 1) = $${params.length}`);
          } else if (difficulty !== null && difficulty !== 1) {
            return res.json([]);
          }

          const result = await pool.query(
            `SELECT e.id, e.title, e.description, e.index_order,
                    e.type_exercise,
                    ${schema.hasExerciseDifficulty ? "e.difficulty" : "NULL::int AS difficulty"},
                    e.phase_id,
                    ${schema.hasExerciseIsDailyTask ? "COALESCE(e.is_daily_task, false)" : "false"} AS is_daily_task,
                    e.created_at, e.updated_at
             FROM exercise e
             WHERE ${where.join(" AND ")}
             ORDER BY e.index_order ASC, e.created_at ASC`,
            params
          );

          return res.json(result.rows.map((row: any) => ({
            id: String(row.id),
            titulo: row.title ?? "",
            descricao: row.description ?? "",
            indexOrder: row.index_order ?? 0,
            difficulty: row.difficulty ?? null,
            typeExercise: row.type_exercise ?? null,
            isDailyTask: !!row.is_daily_task,
            phaseId: String(row.phase_id),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })));
        }

        return res.json([]);
      } catch (error) {
        console.error("Erro ao listar exercícios por fase:", error);
        return res.status(500).json({ message: "Erro ao listar exercícios por fase" });
      }
    }
  );

  // PATCH /exercicios/:id/reorder - reorder exercise index_order
  router.patch(
    "/exercicios/:id/reorder",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        const { direction } = req.body as { direction: "up" | "down" };
        if (!Number.isFinite(id) || !["up", "down"].includes(direction)) {
          return res.status(400).json({ message: "Dados inválidos" });
        }

        const schema = await getExerciseSchemaInfo();
        if (!schema.hasExercise) {
          return res.status(400).json({ message: "Schema de exercícios não suporta reordenação" });
        }

        const current = await pool.query(
          `SELECT id, phase_id, index_order FROM exercise WHERE id = $1`,
          [id]
        );
        if (current.rows.length === 0) {
          return res.status(404).json({ message: "Exercício não encontrado" });
        }

        const exercise = current.rows[0];
        const op = direction === "up" ? "<" : ">";
        const order = direction === "up" ? "DESC" : "ASC";

        const neighbor = await pool.query(
          `SELECT id, index_order FROM exercise
           WHERE phase_id = $1 AND index_order ${op} $2
           ORDER BY index_order ${order}
           LIMIT 1`,
          [exercise.phase_id, exercise.index_order]
        );

        if (neighbor.rows.length === 0) {
          return res.json({ message: "Já está na posição limite" });
        }

        const neighborRow = neighbor.rows[0];

        // Swap index_order
        await pool.query(
          `UPDATE exercise SET index_order = $1, updated_at = NOW() WHERE id = $2`,
          [neighborRow.index_order, exercise.id]
        );
        await pool.query(
          `UPDATE exercise SET index_order = $1, updated_at = NOW() WHERE id = $2`,
          [exercise.index_order, neighborRow.id]
        );

        return res.json({ message: "Exercício reordenado com sucesso" });
      } catch (error) {
        console.error("Erro ao reordenar exercício:", error);
        return res.status(500).json({ message: "Erro ao reordenar exercício" });
      }
    }
  );

  return router;
}
