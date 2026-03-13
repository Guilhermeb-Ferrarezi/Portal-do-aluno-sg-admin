import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { logActivity } from "../utils/activityLog";

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
});

function groupRows(rows: DbContainerTaskRow[]): ContainerGroupResponse[] {
  const map = new Map<string, ContainerGroupResponse>();

  for (const row of rows) {
    const key = `${row.name ?? ""}|${row.container_date_target_int ?? "null"}`;

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

  // GET /containers/by-phase/:phaseId
  router.get("/containers/by-phase/:phaseId", auth, adminOnly, async (req: AuthRequest, res) => {
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
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
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
           AND (container_date_target_int = $3 OR ($3::int IS NULL AND container_date_target_int IS NULL))`,
        [data.name, data.phase_id, data.container_date_target_int]
      );

      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
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
