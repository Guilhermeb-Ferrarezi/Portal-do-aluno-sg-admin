import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { logActivity } from "../utils/activityLog";

const CONTAINER_BLOCKED_DIFFICULTIES = [2, 3, 4] as const;
const CONTAINER_BLOCKED_TYPE_EXERCISES = [3] as const;

type DbContainerTaskRow = {
  id: number;
  name: string | null;
  exercise_id: number;
  phase_id: number;
  is_daily_task: boolean;
  created_at: string;
  container_date_target_int: number | null;
  exercise_title?: string;
  exercise_description?: string | null;
  exercise_index_order?: number | null;
};

type ContainerGroupResponse = {
  name: string;
  phaseId: string;
  containerDateTargetInt: number | null;
  isDailyTask: boolean;
  exercises: Array<{
    id: string;
    containerTaskId: string;
    title: string;
    description: string | null;
    indexOrder: number | null;
  }>;
};

const createContainerSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  phase_id: z.coerce.number().int().positive(),
  exercise_ids: z.array(z.coerce.number().int().positive()).min(1, "Selecione pelo menos um exercício"),
  is_daily_task: z.boolean().default(false),
  container_date_target_int: z.coerce.number().int().positive().nullable().optional(),
});

const deleteGroupSchema = z.object({
  name: z.string().min(1),
  phase_id: z.coerce.number().int().positive(),
  container_date_target_int: z.coerce.number().int().nullable(),
  is_daily_task: z.boolean(),
});

const addExercisesToGroupSchema = z.object({
  name: z.string().min(1),
  phase_id: z.coerce.number().int().positive(),
  container_date_target_int: z.coerce.number().int().nullable(),
  is_daily_task: z.boolean(),
  exercise_ids: z.array(z.coerce.number().int().positive()).min(1, "Selecione pelo menos um exercício"),
});

function groupRows(rows: DbContainerTaskRow[]): ContainerGroupResponse[] {
  const map = new Map<string, ContainerGroupResponse>();

  for (const row of rows) {
    const key = `${row.name ?? ""}|${row.container_date_target_int ?? "null"}|${row.is_daily_task ? "daily" : "normal"}`;

    if (!map.has(key)) {
      map.set(key, {
        name: row.name ?? "",
        phaseId: String(row.phase_id),
        containerDateTargetInt: row.container_date_target_int,
        isDailyTask: row.is_daily_task,
        exercises: [],
      });
    }

    map.get(key)!.exercises.push({
      id: String(row.exercise_id),
      containerTaskId: String(row.id),
      title: row.exercise_title ?? `Exercício ${row.exercise_id}`,
      description: row.exercise_description ?? null,
      indexOrder: row.exercise_index_order ?? null,
    });
  }

  return Array.from(map.values());
}

export function containersRouter(jwtSecret: string) {
  const router = Router();
  const auth = authGuard(jwtSecret);
  const adminOnly = requireRole(["admin"]);
  const adminOrProfessor = requireRole(["admin", "professor"]);

  // GET /containers/by-phase/:phaseId
  router.get("/containers/by-phase/:phaseId", auth, adminOrProfessor, async (req: AuthRequest, res) => {
    try {
      const phaseId = Number(req.params.phaseId);
      if (!phaseId || phaseId < 1) {
        return res.status(400).json({ message: "phaseId inválido" });
      }

      const result = await pool.query<DbContainerTaskRow>(
        `SELECT ct.id, ct.name, ct.exercise_id, ct.phase_id,
                ct.is_daily_task, ct.created_at, ct.container_date_target_int,
                e.title AS exercise_title,
                e.description AS exercise_description,
                e.index_order AS exercise_index_order
         FROM container_tasks ct
         JOIN exercise e ON e.id = ct.exercise_id
         WHERE ct.phase_id = $1
         ORDER BY ct.container_date_target_int ASC NULLS LAST, ct.name, ct.id ASC`,
        [phaseId]
      );

      return res.json(groupRows(result.rows));
    } catch (error) {
      console.error("Erro ao listar containers:", error);
      return res.status(500).json({ message: "Erro ao listar containers" });
    }
  });

  // GET /containers/exercise/:exerciseId
  router.get("/containers/exercise/:exerciseId", auth, async (req: AuthRequest, res) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!exerciseId || exerciseId < 1) {
        return res.status(400).json({ message: "exerciseId inválido" });
      }

      const result = await pool.query(
        `SELECT ct.name, ct.container_date_target_int, ct.phase_id
         FROM container_tasks ct
         WHERE ct.exercise_id = $1
         LIMIT 1`,
        [exerciseId]
      );

      if (result.rows.length === 0) {
        return res.json(null);
      }

      const row = result.rows[0];
      return res.json({
        name: row.name,
        containerDateTargetInt: row.container_date_target_int,
        phaseId: String(row.phase_id),
      });
    } catch (error) {
      console.error("Erro ao buscar container do exercício:", error);
      return res.status(500).json({ message: "Erro ao buscar container" });
    }
  });

  // POST /containers
  router.post("/containers", auth, adminOnly, async (req: AuthRequest, res) => {
    try {
      const parsed = createContainerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos" });
      }

      const data = parsed.data;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const blockedDifficultyResult = await client.query<{ id: number }>(
          `SELECT id
           FROM exercise
           WHERE phase_id = $1
             AND id = ANY($2::int[])
             AND (
               difficulty = ANY($3::int[])
               OR type_exercise = ANY($4::int[])
             )
           LIMIT 1`,
          [data.phase_id, data.exercise_ids, CONTAINER_BLOCKED_DIFFICULTIES, CONTAINER_BLOCKED_TYPE_EXERCISES]
        );

        if ((blockedDifficultyResult.rowCount ?? 0) > 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Lower, Prova Semanal, dificuldade 4 e type_exercise 3 não podem ser adicionados em container" });
        }

        for (const exerciseId of data.exercise_ids) {
          await client.query(
            `INSERT INTO container_tasks (name, exercise_id, phase_id, is_daily_task, container_date_target_int, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [data.name, exerciseId, data.phase_id, data.is_daily_task, data.container_date_target_int ?? null]
          );
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "create",
        entityType: "container",
        entityId: data.name,
        metadata: { phase_id: data.phase_id, exercises: data.exercise_ids.length },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json({
        message: "Container criado com sucesso!",
        count: data.exercise_ids.length,
      });
    } catch (error) {
      console.error("Erro ao criar container:", error);
      return res.status(500).json({ message: "Erro ao criar container" });
    }
  });

  // DELETE /containers/group
  router.delete("/containers/group", auth, adminOnly, async (req: AuthRequest, res) => {
    try {
      const parsed = deleteGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos" });
      }

      const data = parsed.data;

      const result = await pool.query(
        `DELETE FROM container_tasks
         WHERE name = $1 AND phase_id = $2
           AND COALESCE(is_daily_task, false) = $3
           AND (container_date_target_int = $4 OR ($4::int IS NULL AND container_date_target_int IS NULL))`,
        [data.name, data.phase_id, data.is_daily_task, data.container_date_target_int]
      );

      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "delete",
        entityType: "container",
        entityId: data.name,
        metadata: { phase_id: data.phase_id, deleted: result.rowCount },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({ message: "Container deletado", deleted: result.rowCount });
    } catch (error) {
      console.error("Erro ao deletar container:", error);
      return res.status(500).json({ message: "Erro ao deletar container" });
    }
  });

  // POST /containers/group/add-exercises
  router.post("/containers/group/add-exercises", auth, adminOnly, async (req: AuthRequest, res) => {
    try {
      const parsed = addExercisesToGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos" });
      }

      const data = parsed.data;
      const uniqueExerciseIds = Array.from(new Set(data.exercise_ids));
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const groupResult = await client.query<{
          is_daily_task: boolean;
        }>(
          `SELECT is_daily_task
           FROM container_tasks
           WHERE name = $1 AND phase_id = $2
             AND COALESCE(is_daily_task, false) = $3
             AND (container_date_target_int = $4 OR ($4::int IS NULL AND container_date_target_int IS NULL))
           LIMIT 1`,
          [data.name, data.phase_id, data.is_daily_task, data.container_date_target_int]
        );

        if (groupResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Container não encontrado" });
        }

        const validExercisesInPhase = await client.query<{ id: number }>(
          `SELECT id
           FROM exercise
           WHERE phase_id = $1
             AND id = ANY($2::int[])`,
          [data.phase_id, uniqueExerciseIds]
        );

        if (validExercisesInPhase.rowCount !== uniqueExerciseIds.length) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Um ou mais exercícios não pertencem à fase do container" });
        }

        const blockedDifficultyResult = await client.query<{ id: number }>(
          `SELECT id
           FROM exercise
           WHERE phase_id = $1
             AND id = ANY($2::int[])
             AND (
               difficulty = ANY($3::int[])
               OR type_exercise = ANY($4::int[])
             )
           LIMIT 1`,
          [data.phase_id, uniqueExerciseIds, CONTAINER_BLOCKED_DIFFICULTIES, CONTAINER_BLOCKED_TYPE_EXERCISES]
        );

        if ((blockedDifficultyResult.rowCount ?? 0) > 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Lower, Prova Semanal, dificuldade 4 e type_exercise 3 não podem ser adicionados em container" });
        }

        const duplicateInSameGroup = await client.query<{ exercise_id: number }>(
          `SELECT exercise_id
           FROM container_tasks
           WHERE phase_id = $1
             AND name = $2
             AND COALESCE(is_daily_task, false) = $3
             AND (container_date_target_int = $4 OR ($4::int IS NULL AND container_date_target_int IS NULL))
             AND exercise_id = ANY($5::int[])`,
          [data.phase_id, data.name, data.is_daily_task, data.container_date_target_int, uniqueExerciseIds]
        );

        if ((duplicateInSameGroup.rowCount ?? 0) > 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Um ou mais exercícios já estão neste container" });
        }

        const alreadyInAnotherContainer = await client.query<{ exercise_id: number }>(
          `SELECT exercise_id
           FROM container_tasks
           WHERE phase_id = $1
             AND exercise_id = ANY($2::int[])
             AND NOT (
               name = $3
               AND COALESCE(is_daily_task, false) = $4
               AND (container_date_target_int = $5 OR ($5::int IS NULL AND container_date_target_int IS NULL))
             )`,
          [data.phase_id, uniqueExerciseIds, data.name, data.is_daily_task, data.container_date_target_int]
        );

        if ((alreadyInAnotherContainer.rowCount ?? 0) > 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Um ou mais exercícios já pertencem a outro container nesta fase" });
        }

        const isDailyTask = groupResult.rows[0].is_daily_task;
        for (const exerciseId of uniqueExerciseIds) {
          await client.query(
            `INSERT INTO container_tasks (name, exercise_id, phase_id, is_daily_task, container_date_target_int, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [data.name, exerciseId, data.phase_id, isDailyTask, data.container_date_target_int]
          );
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "update",
        entityType: "container",
        entityId: data.name,
        metadata: {
          phase_id: data.phase_id,
          added_exercises: uniqueExerciseIds.length,
          container_date_target_int: data.container_date_target_int,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({
        message: "Exercícios adicionados ao container",
        count: uniqueExerciseIds.length,
      });
    } catch (error) {
      console.error("Erro ao adicionar exercícios no container:", error);
      return res.status(500).json({ message: "Erro ao adicionar exercícios no container" });
    }
  });

  // DELETE /containers/:id
  router.delete("/containers/:id", auth, adminOnly, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || id < 1) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const result = await pool.query(
        "DELETE FROM container_tasks WHERE id = $1 RETURNING *",
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Container task não encontrado" });
      }

      return res.json({ message: "Container task removido" });
    } catch (error) {
      console.error("Erro ao deletar container task:", error);
      return res.status(500).json({ message: "Erro ao deletar container task" });
    }
  });

  return router;
}
