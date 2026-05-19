import { Router, type Response } from "express";
import { type PoolClient } from "pg";
import { z } from "zod";
import { pool } from "../db";
import type { AuthRequest } from "../middlewares/auth";
import {
  authOrApiTokenGuard,
  requireApiTokenScopeIfPresent,
  requireRoleOrApiTokenScope,
} from "../middlewares/apiTokenAuth";
import { logActivity } from "../utils/activityLog";

type Queryable = Pick<PoolClient, "query">;

type DbClassRow = {
  id: number;
  current_module_id: number;
  name: string | null;
};

type DbClassRoomRow = {
  id: number;
  class_id: number;
  name: string | null;
  created_at: string | Date;
  is_authorized: boolean;
  target_limited: string | Date | null;
};

type DbRoomExerciseListRow = {
  room_id: number;
  room_class_id: number;
  room_name: string | null;
  room_created_at: string | Date;
  room_is_authorized: boolean;
  room_target_limited: string | Date | null;
  exercise_id: number | null;
  exercise_title: string | null;
  exercise_description: string | null;
  exercise_term_at: string | Date | null;
  exercise_is_daily_task: boolean | null;
  exercise_phase_name: string | null;
};

type DbAvailableExerciseRow = {
  id: number;
  title: string | null;
  description: string | null;
  term_at: string | Date | null;
  is_daily_task: boolean | null;
  phase_name: string | null;
  selected: boolean;
};

type RoomStatus = "rascunho" | "aberta" | "encerrada";

const createOrUpdateRoomSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatorio"),
  target_limited: z.coerce
    .date({
      message: "Horario-limite invalido",
    })
    .refine((value) => Number.isFinite(value.getTime()), "Horario-limite invalido"),
  is_authorized: z.boolean().default(false),
  exercise_ids: z
    .array(z.coerce.number().int().positive("Exercicio invalido"))
    .min(1, "Selecione pelo menos um exercicio"),
}).superRefine((value, ctx) => {
  if (value.target_limited.getTime() <= Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["target_limited"],
      message: "Horario-limite deve estar no futuro",
    });
  }
});

const updateRoomStatusSchema = z.object({
  is_authorized: z.boolean(),
});

const availableExercisesQuerySchema = z.object({
  roomId: z.coerce.number().int().positive().optional(),
});

function toIsoString(value: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function getRoomStatus(row: { is_authorized: boolean; target_limited: string | Date | null }): RoomStatus {
  const targetMs = row.target_limited ? new Date(row.target_limited).getTime() : null;
  if (targetMs !== null && targetMs <= Date.now()) {
    return "encerrada";
  }
  return row.is_authorized ? "aberta" : "rascunho";
}

async function getClassById(client: Queryable, classId: number) {
  const result = await client.query<DbClassRow>(
    `SELECT id, current_module_id, name
     FROM class
     WHERE id = $1
     LIMIT 1`,
    [classId]
  );
  return result.rows[0] ?? null;
}

async function getRoomById(client: Queryable, roomId: number) {
  const result = await client.query<DbClassRoomRow>(
    `SELECT id, class_id, name, created_at, is_authorized, target_limited
     FROM class_rooms
     WHERE id = $1
     LIMIT 1`,
    [roomId]
  );
  return result.rows[0] ?? null;
}

async function canReadClass(classId: number, req: AuthRequest) {
  const user = req.user;
  if (!user) return false;

  if (user.role !== "aluno") {
    return true;
  }

  const result = await pool.query(
    `SELECT 1
     FROM enrollment
     WHERE user_id = $1 AND class_id = $2
     LIMIT 1`,
    [Number(user.sub), classId]
  );

  return (result.rowCount ?? 0) > 0;
}

async function ensureReadableClass(req: AuthRequest, res: Response, classId: number) {
  const turma = await getClassById(pool, classId);
  if (!turma) {
    res.status(404).json({ message: "Turma nao encontrada" });
    return null;
  }

  const hasAccess = await canReadClass(classId, req);
  if (!hasAccess) {
    res.status(403).json({ message: "Sem permissao" });
    return null;
  }

  return turma;
}

async function getAttachedExerciseIds(client: Queryable, roomId: number) {
  const result = await client.query<{ exercise_id: number }>(
    `SELECT exercise_id
     FROM class_room_exercises
     WHERE class_room_id = $1
     ORDER BY created_at ASC, id ASC`,
    [roomId]
  );
  return result.rows.map((row) => row.exercise_id);
}

async function validateExercisesForRoom(params: {
  client: Queryable;
  classId: number;
  currentModuleId: number;
  exerciseIds: number[];
  currentRoomId?: number | null;
}) {
  const { client, classId, currentModuleId, exerciseIds, currentRoomId = null } = params;

  const uniqueExerciseIds = Array.from(new Set(exerciseIds));
  if (uniqueExerciseIds.length === 0) {
    return { ok: false as const, status: 400, message: "Selecione pelo menos um exercicio" };
  }

  const exerciseRows = await client.query<{ id: number }>(
    `SELECT e.id
     FROM exercise e
     JOIN phase p ON p.id = e.phase_id
     WHERE p.module_id = $1
       AND e.id = ANY($2::int[])`,
    [currentModuleId, uniqueExerciseIds]
  );

  if (exerciseRows.rowCount !== uniqueExerciseIds.length) {
    return {
      ok: false as const,
      status: 400,
      message: "Um ou mais exercicios nao pertencem ao modulo atual desta turma",
    };
  }

  const blockingAssignments = await client.query<{
    exercise_id: number;
    room_id: number;
    room_name: string | null;
    room_class_id: number;
  }>(
    `SELECT cre.exercise_id,
            cr.id AS room_id,
            cr.name AS room_name,
            cr.class_id AS room_class_id
     FROM class_room_exercises cre
     JOIN class_rooms cr ON cr.id = cre.class_room_id
     WHERE cre.exercise_id = ANY($1::int[])
       AND ($2::int IS NULL OR cre.class_room_id <> $2)
     LIMIT 1`,
    [uniqueExerciseIds, currentRoomId]
  );

  if (blockingAssignments.rowCount) {
    const blocking = blockingAssignments.rows[0];
    return {
      ok: false as const,
      status: 400,
      message: `O exercicio ${blocking.exercise_id} ja pertence a outra sala (${blocking.room_name ?? `Sala ${blocking.room_id}`})`,
    };
  }

  const classCheck = await getClassById(client, classId);
  if (!classCheck) {
    return { ok: false as const, status: 404, message: "Turma nao encontrada" };
  }

  return { ok: true as const, uniqueExerciseIds };
}

async function syncRoomExercises(params: {
  client: Queryable;
  roomId: number;
  classId: number;
  currentModuleId: number;
  targetLimited: Date;
  exerciseIds: number[];
}) {
  const { client, roomId, classId, currentModuleId, targetLimited, exerciseIds } = params;
  const validation = await validateExercisesForRoom({
    client,
    classId,
    currentModuleId,
    exerciseIds,
    currentRoomId: roomId,
  });

  if (!validation.ok) {
    return validation;
  }

  const uniqueExerciseIds = validation.uniqueExerciseIds;
  const previousExerciseIds = await getAttachedExerciseIds(client, roomId);
  const nextSet = new Set(uniqueExerciseIds);
  const removedExerciseIds = previousExerciseIds.filter((exerciseId) => !nextSet.has(exerciseId));

  if (removedExerciseIds.length > 0) {
    await client.query(
      `UPDATE exercise
       SET term_at = NULL,
           updated_at = NOW()
       WHERE id = ANY($1::int[])`,
      [removedExerciseIds]
    );
  }

  await client.query(`DELETE FROM class_room_exercises WHERE class_room_id = $1`, [roomId]);

  for (const exerciseId of uniqueExerciseIds) {
    await client.query(
      `INSERT INTO class_room_exercises (class_room_id, exercise_id, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())`,
      [roomId, exerciseId]
    );
  }

  await client.query(
    `UPDATE exercise
     SET term_at = $2,
         updated_at = NOW()
     WHERE id = ANY($1::int[])`,
    [uniqueExerciseIds, targetLimited.toISOString()]
  );

  return { ok: true as const, uniqueExerciseIds };
}

function mapRoomRows(rows: DbRoomExerciseListRow[]) {
  const grouped = new Map<
    number,
    {
      id: string;
      turmaId: string;
      nome: string;
      createdAt: string | null;
      isAuthorized: boolean;
      targetLimited: string | null;
      status: RoomStatus;
      totalExercises: number;
      exercises: Array<{
        id: string;
        title: string;
        description: string | null;
        termAt: string | null;
        isDailyTask: boolean;
        phaseName: string | null;
      }>;
    }
  >();

  for (const row of rows) {
    if (!grouped.has(row.room_id)) {
      grouped.set(row.room_id, {
        id: String(row.room_id),
        turmaId: String(row.room_class_id),
        nome: row.room_name ?? `Sala ${row.room_id}`,
        createdAt: toIsoString(row.room_created_at),
        isAuthorized: !!row.room_is_authorized,
        targetLimited: toIsoString(row.room_target_limited),
        status: getRoomStatus({
          is_authorized: !!row.room_is_authorized,
          target_limited: row.room_target_limited,
        }),
        totalExercises: 0,
        exercises: [],
      });
    }

    if (row.exercise_id == null) {
      continue;
    }

    const room = grouped.get(row.room_id)!;
    room.exercises.push({
      id: String(row.exercise_id),
      title: row.exercise_title ?? `Exercicio ${row.exercise_id}`,
      description: row.exercise_description ?? null,
      termAt: toIsoString(row.exercise_term_at),
      isDailyTask: !!row.exercise_is_daily_task,
      phaseName: row.exercise_phase_name ?? null,
    });
    room.totalExercises = room.exercises.length;
  }

  return Array.from(grouped.values());
}

export function classRoomsRouter(jwtSecret: string) {
  const router = Router();
  const auth = authOrApiTokenGuard(jwtSecret, pool);
  const requireRead = requireApiTokenScopeIfPresent("turmas:read");
  const adminOnly = requireRoleOrApiTokenScope(["admin"], "turmas:write");

  router.get("/turmas/:id/salas", auth, requireRead, async (req: AuthRequest, res) => {
    const classId = Number(req.params.id);
    if (!Number.isFinite(classId)) {
      return res.status(400).json({ message: "ID de turma invalido" });
    }

    const turma = await ensureReadableClass(req, res, classId);
    if (!turma) {
      return;
    }

    try {
      const isAluno = req.user?.role === "aluno";
      const result = await pool.query<DbRoomExerciseListRow>(
        `SELECT cr.id AS room_id,
                cr.class_id AS room_class_id,
                cr.name AS room_name,
                cr.created_at AS room_created_at,
                cr.is_authorized AS room_is_authorized,
                cr.target_limited AS room_target_limited,
                e.id AS exercise_id,
                e.title AS exercise_title,
                e.description AS exercise_description,
                e.term_at AS exercise_term_at,
                COALESCE(e.is_daily_task, false) AS exercise_is_daily_task,
                p.name AS exercise_phase_name
         FROM class_rooms cr
         LEFT JOIN class_room_exercises cre ON cre.class_room_id = cr.id
         LEFT JOIN exercise e ON e.id = cre.exercise_id
         LEFT JOIN phase p ON p.id = e.phase_id
         WHERE cr.class_id = $1
           ${isAluno ? "AND cr.is_authorized = true" : ""}
         ORDER BY cr.created_at DESC, cre.created_at ASC, cre.id ASC`,
        [classId]
      );

      return res.json({
        turma: {
          id: String(turma.id),
          nome: turma.name ?? `Turma ${turma.id}`,
        },
        items: mapRoomRows(result.rows),
      });
    } catch (error) {
      console.error("Erro ao listar salas da turma:", error);
      return res.status(500).json({ message: "Erro ao listar salas da turma" });
    }
  });

  router.get(
    "/turmas/:id/salas/exercicios-disponiveis",
    auth,
    requireRead,
    async (req: AuthRequest, res) => {
    const classId = Number(req.params.id);
    if (!Number.isFinite(classId)) {
      return res.status(400).json({ message: "ID de turma invalido" });
    }

    const turma = await getClassById(pool, classId);
    if (!turma) {
      return res.status(404).json({ message: "Turma nao encontrada" });
    }

    const parsedQuery = availableExercisesQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ message: "Parametros invalidos" });
    }

    const roomId = parsedQuery.data.roomId ?? null;

    try {
      if (roomId) {
        const room = await getRoomById(pool, roomId);
        if (!room || room.class_id !== classId) {
          return res.status(404).json({ message: "Sala nao encontrada para esta turma" });
        }
      }

      const params: Array<number | null> = [classId, roomId];
      const result = await pool.query<DbAvailableExerciseRow>(
        `SELECT e.id,
                e.title,
                e.description,
                e.term_at,
                COALESCE(e.is_daily_task, false) AS is_daily_task,
                p.name AS phase_name,
                EXISTS (
                  SELECT 1
                  FROM class_room_exercises current_cre
                  WHERE current_cre.exercise_id = e.id
                    AND $2::int IS NOT NULL
                    AND current_cre.class_room_id = $2
                ) AS selected
         FROM class c
         JOIN phase p ON p.module_id = c.current_module_id
         JOIN exercise e ON e.phase_id = p.id
         WHERE c.id = $1
           AND (
             NOT EXISTS (
               SELECT 1
               FROM class_room_exercises cre
               WHERE cre.exercise_id = e.id
                 AND ($2::int IS NULL OR cre.class_room_id <> $2)
             )
             OR EXISTS (
               SELECT 1
               FROM class_room_exercises current_cre
               WHERE current_cre.exercise_id = e.id
                 AND $2::int IS NOT NULL
                 AND current_cre.class_room_id = $2
             )
           )
         ORDER BY selected DESC, COALESCE(e.index_order, 0) ASC, e.created_at ASC, e.id ASC`,
        params
      );

      return res.json({
        turmaId: String(classId),
        items: result.rows.map((row) => ({
          id: String(row.id),
          title: row.title ?? `Exercicio ${row.id}`,
          description: row.description ?? null,
          termAt: toIsoString(row.term_at),
          isDailyTask: !!row.is_daily_task,
          phaseName: row.phase_name ?? null,
          selected: !!row.selected,
        })),
      });
    } catch (error) {
      console.error("Erro ao listar exercicios disponiveis para a sala:", error);
      return res.status(500).json({ message: "Erro ao listar exercicios disponiveis" });
    }
  });

  router.post("/turmas/:id/salas", auth, adminOnly, async (req: AuthRequest, res) => {
    const classId = Number(req.params.id);
    if (!Number.isFinite(classId)) {
      return res.status(400).json({ message: "ID de turma invalido" });
    }

    const parsed = createOrUpdateRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "Dados invalidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const turma = await getClassById(pool, classId);
    if (!turma) {
      return res.status(404).json({ message: "Turma nao encontrada" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const validation = await validateExercisesForRoom({
        client,
        classId,
        currentModuleId: turma.current_module_id,
        exerciseIds: parsed.data.exercise_ids,
      });

      if (!validation.ok) {
        await client.query("ROLLBACK");
        return res.status(validation.status).json({ message: validation.message });
      }

      const created = await client.query<DbClassRoomRow>(
        `INSERT INTO class_rooms (class_id, name, created_at, is_authorized, target_limited)
         VALUES ($1, $2, NOW(), $3, $4)
         RETURNING id, class_id, name, created_at, is_authorized, target_limited`,
        [
          classId,
          parsed.data.nome.trim(),
          parsed.data.is_authorized,
          parsed.data.target_limited.toISOString(),
        ]
      );

      const room = created.rows[0];
      const syncResult = await syncRoomExercises({
        client,
        roomId: room.id,
        classId,
        currentModuleId: turma.current_module_id,
        targetLimited: parsed.data.target_limited,
        exerciseIds: validation.uniqueExerciseIds,
      });

      if (!syncResult.ok) {
        await client.query("ROLLBACK");
        return res.status(syncResult.status).json({ message: syncResult.message });
      }

      await client.query("COMMIT");

      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "create",
        entityType: "class_room",
        entityId: String(room.id),
        metadata: {
          classId,
          roomName: room.name,
          exerciseIds: syncResult.uniqueExerciseIds,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json({
        message: "Sala criada com sucesso",
        room: {
          id: String(room.id),
          turmaId: String(room.class_id),
          nome: room.name ?? `Sala ${room.id}`,
          createdAt: toIsoString(room.created_at),
          isAuthorized: !!room.is_authorized,
          targetLimited: toIsoString(room.target_limited),
          status: getRoomStatus(room),
          totalExercises: syncResult.uniqueExerciseIds.length,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Erro ao criar sala:", error);
      return res.status(500).json({ message: "Erro ao criar sala" });
    } finally {
      client.release();
    }
  });

  router.put("/turmas/:id/salas/:roomId", auth, adminOnly, async (req: AuthRequest, res) => {
    const classId = Number(req.params.id);
    const roomId = Number(req.params.roomId);
    if (!Number.isFinite(classId) || !Number.isFinite(roomId)) {
      return res.status(400).json({ message: "Parametros invalidos" });
    }

    const parsed = createOrUpdateRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "Dados invalidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const turma = await getClassById(pool, classId);
    if (!turma) {
      return res.status(404).json({ message: "Turma nao encontrada" });
    }

    const currentRoom = await getRoomById(pool, roomId);
    if (!currentRoom || currentRoom.class_id !== classId) {
      return res.status(404).json({ message: "Sala nao encontrada para esta turma" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const updated = await client.query<DbClassRoomRow>(
        `UPDATE class_rooms
         SET name = $1,
             is_authorized = $2,
             target_limited = $3
         WHERE id = $4
         RETURNING id, class_id, name, created_at, is_authorized, target_limited`,
        [
          parsed.data.nome.trim(),
          parsed.data.is_authorized,
          parsed.data.target_limited.toISOString(),
          roomId,
        ]
      );

      const room = updated.rows[0];
      const syncResult = await syncRoomExercises({
        client,
        roomId,
        classId,
        currentModuleId: turma.current_module_id,
        targetLimited: parsed.data.target_limited,
        exerciseIds: parsed.data.exercise_ids,
      });

      if (!syncResult.ok) {
        await client.query("ROLLBACK");
        return res.status(syncResult.status).json({ message: syncResult.message });
      }

      await client.query("COMMIT");

      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "update",
        entityType: "class_room",
        entityId: String(room.id),
        metadata: {
          classId,
          roomName: room.name,
          isAuthorized: room.is_authorized,
          exerciseIds: syncResult.uniqueExerciseIds,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({
        message: "Sala atualizada com sucesso",
        room: {
          id: String(room.id),
          turmaId: String(room.class_id),
          nome: room.name ?? `Sala ${room.id}`,
          createdAt: toIsoString(room.created_at),
          isAuthorized: !!room.is_authorized,
          targetLimited: toIsoString(room.target_limited),
          status: getRoomStatus(room),
          totalExercises: syncResult.uniqueExerciseIds.length,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Erro ao atualizar sala:", error);
      return res.status(500).json({ message: "Erro ao atualizar sala" });
    } finally {
      client.release();
    }
  });

  router.patch("/turmas/:id/salas/:roomId/status", auth, adminOnly, async (req: AuthRequest, res) => {
    const classId = Number(req.params.id);
    const roomId = Number(req.params.roomId);
    if (!Number.isFinite(classId) || !Number.isFinite(roomId)) {
      return res.status(400).json({ message: "Parametros invalidos" });
    }

    const parsed = updateRoomStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados invalidos" });
    }

    try {
      const room = await getRoomById(pool, roomId);
      if (!room || room.class_id !== classId) {
        return res.status(404).json({ message: "Sala nao encontrada para esta turma" });
      }

      const targetMs = room.target_limited ? new Date(room.target_limited).getTime() : null;
      if (parsed.data.is_authorized && (targetMs === null || targetMs <= Date.now())) {
        return res.status(400).json({
          message: "A sala ja esta encerrada. Atualize o horario-limite antes de abrir novamente",
        });
      }

      const updated = await pool.query<DbClassRoomRow>(
        `UPDATE class_rooms
         SET is_authorized = $1
         WHERE id = $2
         RETURNING id, class_id, name, created_at, is_authorized, target_limited`,
        [parsed.data.is_authorized, roomId]
      );

      const nextRoom = updated.rows[0];

      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: parsed.data.is_authorized ? "open" : "close",
        entityType: "class_room",
        entityId: String(nextRoom.id),
        metadata: {
          classId,
          roomName: nextRoom.name,
          isAuthorized: nextRoom.is_authorized,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({
        message: parsed.data.is_authorized ? "Sala aberta com sucesso" : "Sala fechada com sucesso",
        room: {
          id: String(nextRoom.id),
          turmaId: String(nextRoom.class_id),
          nome: nextRoom.name ?? `Sala ${nextRoom.id}`,
          createdAt: toIsoString(nextRoom.created_at),
          isAuthorized: !!nextRoom.is_authorized,
          targetLimited: toIsoString(nextRoom.target_limited),
          status: getRoomStatus(nextRoom),
        },
      });
    } catch (error) {
      console.error("Erro ao atualizar status da sala:", error);
      return res.status(500).json({ message: "Erro ao atualizar status da sala" });
    }
  });

  router.delete("/turmas/:id/salas/:roomId", auth, adminOnly, async (req: AuthRequest, res) => {
    const classId = Number(req.params.id);
    const roomId = Number(req.params.roomId);
    if (!Number.isFinite(classId) || !Number.isFinite(roomId)) {
      return res.status(400).json({ message: "Parametros invalidos" });
    }

    const currentRoom = await getRoomById(pool, roomId);
    if (!currentRoom || currentRoom.class_id !== classId) {
      return res.status(404).json({ message: "Sala nao encontrada para esta turma" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const attachedExerciseIds = await getAttachedExerciseIds(client, roomId);
      if (attachedExerciseIds.length > 0) {
        await client.query(
          `UPDATE exercise
           SET term_at = NULL,
               updated_at = NOW()
           WHERE id = ANY($1::int[])`,
          [attachedExerciseIds]
        );
      }

      await client.query(`DELETE FROM class_rooms WHERE id = $1`, [roomId]);
      await client.query("COMMIT");

      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "delete",
        entityType: "class_room",
        entityId: String(roomId),
        metadata: {
          classId,
          roomName: currentRoom.name,
          exerciseIds: attachedExerciseIds,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({ message: "Sala removida com sucesso" });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Erro ao deletar sala:", error);
      return res.status(500).json({ message: "Erro ao deletar sala" });
    } finally {
      client.release();
    }
  });

  return router;
}
