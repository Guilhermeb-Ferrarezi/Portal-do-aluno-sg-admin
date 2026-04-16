import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { logActivity } from "../utils/activityLog";
import { deleteFromR2, isR2ManagedUrl, uploadToR2 } from "../utils/uploadR2";

type DbGoalRow = {
  id: number;
  name: string | null;
  description: string | null;
  type: number | null;
  image_url: string | null;
  rewards_count?: string;
};

type DbGoalRewardRow = {
  id: number;
  goal_id: number;
  badge_id: number;
  course_id: number;
  points: number | string | null;
  created_at: string;
  end_date_target: string | null;
  reward_type: number;
  start_date_target: string | null;
  points_target: number | string | null;
  goal_name: string | null;
  badge_name: string | null;
  badge_icon_url: string | null;
  course_name: string | null;
};

type DbGoalStudentRow = {
  id: number;
  user_id: number;
  goal_reward_id: number;
  course_id: number;
  progress: number | string;
  is_completed: boolean;
  completed_at: string | null;
  reward_claimed: boolean;
  reward_claimed_at: string | null;
  user_name: string | null;
  user_email: string | null;
  goal_name: string | null;
  goal_description: string | null;
  goal_image_url: string | null;
  goal_type: number | null;
  badge_id: number | null;
  badge_name: string | null;
  badge_icon_url: string | null;
  course_name: string | null;
  reward_type: number | null;
  points: number | string | null;
  points_target: number | string | null;
  start_date_target: string | null;
  end_date_target: string | null;
};

const GOAL_TYPE_VALUES = [1, 2, 3, 4, 5] as const;
type GoalType = (typeof GOAL_TYPE_VALUES)[number];

const goalTypeSchema = z
  .coerce.number()
  .int()
  .refine((value): value is GoalType => GOAL_TYPE_VALUES.includes(value as GoalType), {
    message: "Tipo de meta invalido",
  });

const createGoalSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatorio"),
  description: z.string().trim().optional().nullable(),
  type: goalTypeSchema.optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
});

const updateGoalSchema = z
  .object({
    name: z.string().trim().min(2, "Nome obrigatorio").optional(),
    description: z.string().trim().optional().nullable(),
    type: goalTypeSchema.optional().nullable(),
    imageUrl: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.type !== undefined ||
      data.imageUrl !== undefined,
    { message: "Informe ao menos um campo para atualizacao" }
  );

const createGoalRewardSchema = z.object({
  goalId: z.coerce.number().int().positive("goalId invalido"),
  badgeId: z.coerce.number().int().positive("badgeId invalido"),
  courseId: z.coerce.number().int().positive("courseId invalido"),
  rewardType: z.coerce.number().int().default(0),
  pointsTarget: z.coerce.number().nonnegative().optional().nullable(),
  startDateTarget: z.string().datetime().optional().nullable(),
  endDateTarget: z.string().datetime().optional().nullable(),
  points: z.coerce.number().nonnegative().optional().nullable(),
});

const updateGoalRewardSchema = z
  .object({
    goalId: z.coerce.number().int().positive("goalId invalido").optional(),
    badgeId: z.coerce.number().int().positive("badgeId invalido").optional(),
    courseId: z.coerce.number().int().positive("courseId invalido").optional(),
    rewardType: z.coerce.number().int().optional(),
    pointsTarget: z.coerce.number().nonnegative().optional().nullable(),
    startDateTarget: z.string().datetime().optional().nullable(),
    endDateTarget: z.string().datetime().optional().nullable(),
    points: z.coerce.number().nonnegative().optional().nullable(),
  })
  .refine(
    (data) =>
      data.goalId !== undefined ||
      data.badgeId !== undefined ||
      data.courseId !== undefined ||
      data.rewardType !== undefined ||
      data.pointsTarget !== undefined ||
      data.startDateTarget !== undefined ||
      data.endDateTarget !== undefined ||
      data.points !== undefined,
    { message: "Informe ao menos um campo para atualizacao" }
  );

const createGoalStudentSchema = z.object({
  userId: z.coerce.number().int().positive("userId invalido"),
  goalRewardId: z.coerce.number().int().positive("goalRewardId invalido"),
  courseId: z.coerce.number().int().positive("courseId invalido"),
});

const updateGoalStudentSchema = z
  .object({
    progress: z.coerce.number().nonnegative().optional(),
    isCompleted: z.boolean().optional(),
    goalRewardId: z.coerce.number().int().positive("goalRewardId invalido").optional(),
    courseId: z.coerce.number().int().positive("courseId invalido").optional(),
  })
  .refine((data) => data.progress !== undefined || data.isCompleted !== undefined || data.goalRewardId !== undefined || data.courseId !== undefined, {
    message: "Informe ao menos um campo para atualizacao",
  });

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function parseDataUrlImage(value: string): { mimetype: string; buffer: Buffer; ext: string } | null {
  const trimmed = value.trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(trimmed);
  if (!match) return null;

  const mimetype = match[1].toLowerCase();
  const ext = IMAGE_MIME_EXT[mimetype];
  if (!ext) {
    throw new Error("Formato de imagem nao suportado");
  }

  const base64Payload = match[2].replace(/\s+/g, "");
  const buffer = Buffer.from(base64Payload, "base64");
  if (!buffer.length) {
    throw new Error("Imagem invalida");
  }

  return { mimetype, buffer, ext };
}

async function resolveGoalImageUrl(inputImageUrl: string | null | undefined): Promise<string | null> {
  if (!inputImageUrl) return null;
  const parsedImage = parseDataUrlImage(inputImageUrl);
  if (!parsedImage) return inputImageUrl.trim();

  const uploadedUrl = await uploadToR2(
    {
      originalname: `goal-image.${parsedImage.ext}`,
      buffer: parsedImage.buffer,
      mimetype: parsedImage.mimetype,
    },
    "goals"
  );
  return uploadedUrl;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapGoalRow(row: DbGoalRow) {
  return {
    id: String(row.id),
    name: row.name ?? "",
    description: row.description,
    type: row.type,
    imageUrl: row.image_url,
    rewardsCount: Number(row.rewards_count ?? 0),
  };
}

function mapGoalRewardRow(row: DbGoalRewardRow) {
  return {
    id: String(row.id),
    goalId: String(row.goal_id),
    badgeId: String(row.badge_id),
    courseId: String(row.course_id),
    points: toNumber(row.points),
    createdAt: row.created_at,
    endDateTarget: row.end_date_target,
    rewardType: row.reward_type,
    startDateTarget: row.start_date_target,
    pointsTarget: toNumber(row.points_target),
    goalName: row.goal_name ?? "",
    badgeName: row.badge_name ?? "",
    badgeIconUrl: row.badge_icon_url,
    courseName: row.course_name ?? "",
  };
}

function mapGoalStudentRow(row: DbGoalStudentRow) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    goalRewardId: String(row.goal_reward_id),
    courseId: String(row.course_id),
    progress: toNumber(row.progress) ?? 0,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    rewardClaimed: row.reward_claimed,
    rewardClaimedAt: row.reward_claimed_at,
    user: {
      id: String(row.user_id),
      nome: row.user_name ?? "",
      email: row.user_email ?? "",
    },
    goal: {
      name: row.goal_name ?? "",
      description: row.goal_description,
      imageUrl: row.goal_image_url,
      type: row.goal_type,
    },
    reward: {
      badgeId: row.badge_id ? String(row.badge_id) : null,
      badgeName: row.badge_name,
      badgeIconUrl: row.badge_icon_url,
      courseName: row.course_name,
      rewardType: row.reward_type,
      points: toNumber(row.points),
      pointsTarget: toNumber(row.points_target),
      startDateTarget: row.start_date_target,
      endDateTarget: row.end_date_target,
    },
  };
}

function isStudent(req: AuthRequest) {
  return req.user?.roleId === 1;
}

export function goalsRouter(jwtSecret: string) {
  const router = Router();

  router.get("/goals", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const limitParam = Number(req.query.limit ?? 10);
    const offsetParam = Number(req.query.offset ?? 0);
    const qParam =
      typeof req.query.q === "string" && req.query.q.trim() !== "" ? req.query.q.trim() : null;

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 10;
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

    const totalResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM goals
       WHERE ($1::text IS NULL
         OR COALESCE(name, '') ILIKE '%' || $1 || '%'
         OR COALESCE(description, '') ILIKE '%' || $1 || '%')`,
      [qParam]
    );

    const result = await pool.query<DbGoalRow>(
      `SELECT
         g.id,
         g.name,
         g.description,
         g.type,
         g.image_url,
         (
           SELECT COUNT(*)::text
           FROM goals_rewards gr
           WHERE gr.goal_id = g.id
         ) AS rewards_count
       FROM goals g
       WHERE ($1::text IS NULL
         OR COALESCE(g.name, '') ILIKE '%' || $1 || '%'
         OR COALESCE(g.description, '') ILIKE '%' || $1 || '%')
       ORDER BY g.id DESC
       LIMIT $2 OFFSET $3`,
      [qParam, limit, offset]
    );

    return res.json({
      items: result.rows.map(mapGoalRow),
      total: Number(totalResult.rows[0]?.total ?? 0),
    });
  });

  router.post(
    "/goals",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const parsed = createGoalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      let imageUrl: string | null;
      try {
        imageUrl = await resolveGoalImageUrl(parsed.data.imageUrl);
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Erro ao processar imagem",
        });
      }

      const created = await pool.query<DbGoalRow>(
        `INSERT INTO goals (name, description, type, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description, type, image_url`,
        [
          parsed.data.name.trim(),
          parsed.data.description?.trim() || null,
          parsed.data.type ?? null,
          imageUrl,
        ]
      );

      const goal = mapGoalRow(created.rows[0]);
      const responseBody = { message: "Meta criada com sucesso!", goal };
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "goal_create",
        entityType: "goal",
        entityId: goal.id,
        requestBody: req.body,
        responseBody,
        statusCode: 201,
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json(responseBody);
    }
  );

  router.put(
    "/goals/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const goalId = Number(req.params.id);
      if (!Number.isInteger(goalId) || goalId <= 0) {
        return res.status(400).json({ message: "ID da meta invalido" });
      }

      const parsed = updateGoalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const current = await pool.query<DbGoalRow>(
        `SELECT id, name, description, type, image_url
         FROM goals
         WHERE id = $1`,
        [goalId]
      );

      if (!current.rowCount) {
        return res.status(404).json({ message: "Meta nao encontrada" });
      }

      const base = current.rows[0];
      let nextImageUrl = base.image_url;
      if (parsed.data.imageUrl !== undefined) {
        try {
          nextImageUrl = await resolveGoalImageUrl(parsed.data.imageUrl);
        } catch (error) {
          return res.status(400).json({
            message: error instanceof Error ? error.message : "Erro ao processar imagem",
          });
        }
      }

      const updated = await pool.query<DbGoalRow>(
        `UPDATE goals
         SET name = $1,
             description = $2,
             type = $3,
             image_url = $4
         WHERE id = $5
         RETURNING id, name, description, type, image_url`,
        [
          parsed.data.name !== undefined ? parsed.data.name.trim() : base.name,
          parsed.data.description !== undefined ? parsed.data.description?.trim() || null : base.description,
          parsed.data.type !== undefined ? parsed.data.type : base.type,
          nextImageUrl,
          goalId,
        ]
      );

      if (parsed.data.imageUrl !== undefined && base.image_url && base.image_url !== nextImageUrl && isR2ManagedUrl(base.image_url)) {
        deleteFromR2(base.image_url).catch(() => undefined);
      }

      const goal = mapGoalRow(updated.rows[0]);
      const responseBody = { message: "Meta atualizada com sucesso!", goal };
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "goal_update",
        entityType: "goal",
        entityId: goal.id,
        requestBody: req.body,
        responseBody,
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json(responseBody);
    }
  );

  router.delete(
    "/goals/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const goalId = Number(req.params.id);
      if (!Number.isInteger(goalId) || goalId <= 0) {
        return res.status(400).json({ message: "ID da meta invalido" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const current = await client.query<DbGoalRow>(
          `SELECT id, name, description, type, image_url
           FROM goals
           WHERE id = $1
           FOR UPDATE`,
          [goalId]
        );

        if (!current.rowCount) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Meta nao encontrada" });
        }

        await client.query(
          `DELETE FROM goals_students
           WHERE goal_reward_id IN (SELECT id FROM goals_rewards WHERE goal_id = $1)`,
          [goalId]
        );
        await client.query(`DELETE FROM goals_rewards WHERE goal_id = $1`, [goalId]);
        await client.query(`DELETE FROM goals WHERE id = $1`, [goalId]);
        await client.query("COMMIT");

        const oldImageUrl = current.rows[0].image_url;
        if (oldImageUrl && isR2ManagedUrl(oldImageUrl)) {
          deleteFromR2(oldImageUrl).catch(() => undefined);
        }

        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
          action: "goal_delete",
          entityType: "goal",
          entityId: String(goalId),
          metadata: { name: current.rows[0].name },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.json({ message: "Meta excluida com sucesso!" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  );

  router.get("/goals/rewards", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const goalId =
      typeof req.query.goalId === "string" && req.query.goalId.trim() !== ""
        ? Number(req.query.goalId)
        : null;
    const courseId =
      typeof req.query.courseId === "string" && req.query.courseId.trim() !== ""
        ? Number(req.query.courseId)
        : null;
    const limitParam = Number(req.query.limit ?? 50);
    const offsetParam = Number(req.query.offset ?? 0);

    if ((goalId !== null && (!Number.isInteger(goalId) || goalId <= 0)) || (courseId !== null && (!Number.isInteger(courseId) || courseId <= 0))) {
      return res.status(400).json({ message: "Filtros invalidos" });
    }

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

    const totalResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM goals_rewards gr
       WHERE ($1::int IS NULL OR gr.goal_id = $1)
         AND ($2::int IS NULL OR gr.course_id = $2)`,
      [goalId, courseId]
    );

    const result = await pool.query<DbGoalRewardRow>(
      `SELECT
         gr.id,
         gr.goal_id,
         gr.badge_id,
         gr.course_id,
         gr.points,
         gr.created_at,
         gr.end_date_target,
         gr.reward_type,
         gr.start_date_target,
         gr.points_target,
         g.name AS goal_name,
         b.name AS badge_name,
         b.icon_url AS badge_icon_url,
         c.name AS course_name
       FROM goals_rewards gr
       JOIN goals g ON g.id = gr.goal_id
       JOIN badge b ON b.id = gr.badge_id
       JOIN course c ON c.id = gr.course_id
       WHERE ($1::int IS NULL OR gr.goal_id = $1)
         AND ($2::int IS NULL OR gr.course_id = $2)
       ORDER BY gr.created_at DESC, gr.id DESC
       LIMIT $3 OFFSET $4`,
      [goalId, courseId, limit, offset]
    );

    return res.json({
      items: result.rows.map(mapGoalRewardRow),
      total: Number(totalResult.rows[0]?.total ?? 0),
    });
  });

  router.post(
    "/goals/rewards",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const parsed = createGoalRewardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { goalId, badgeId, courseId, rewardType, pointsTarget, startDateTarget, endDateTarget, points } =
        parsed.data;

      const inserted = await pool.query<DbGoalRewardRow>(
        `WITH inserted AS (
           INSERT INTO goals_rewards (
             goal_id,
             badge_id,
             course_id,
             points,
             created_at,
             end_date_target,
             reward_type,
             start_date_target,
             points_target
           )
           SELECT $1, $2, $3, $4, NOW(), $5, $6, $7, $8
           FROM goals g, badge b, course c
           WHERE g.id = $1 AND b.id = $2 AND c.id = $3
           RETURNING id, goal_id, badge_id, course_id, points, created_at, end_date_target, reward_type, start_date_target, points_target
         )
         SELECT
           i.id,
           i.goal_id,
           i.badge_id,
           i.course_id,
           i.points,
           i.created_at,
           i.end_date_target,
           i.reward_type,
           i.start_date_target,
           i.points_target,
           g.name AS goal_name,
           b.name AS badge_name,
           b.icon_url AS badge_icon_url,
           c.name AS course_name
         FROM inserted i
         JOIN goals g ON g.id = i.goal_id
         JOIN badge b ON b.id = i.badge_id
         JOIN course c ON c.id = i.course_id`,
        [goalId, badgeId, courseId, points ?? null, endDateTarget ?? null, rewardType, startDateTarget ?? null, pointsTarget ?? null]
      );

      if (!inserted.rowCount) {
        return res.status(404).json({ message: "Meta, medalha ou curso nao encontrados" });
      }

      const reward = mapGoalRewardRow(inserted.rows[0]);
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "goal_reward_create",
        entityType: "goal_reward",
        entityId: reward.id,
        metadata: { goalId, badgeId, courseId },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json({ message: "Recompensa criada com sucesso!", reward });
    }
  );

  router.put(
    "/goals/rewards/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const rewardId = Number(req.params.id);
      if (!Number.isInteger(rewardId) || rewardId <= 0) {
        return res.status(400).json({ message: "ID da recompensa invalido" });
      }

      const parsed = updateGoalRewardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const current = await pool.query<DbGoalRewardRow>(
        `SELECT
           gr.id,
           gr.goal_id,
           gr.badge_id,
           gr.course_id,
           gr.points,
           gr.created_at,
           gr.end_date_target,
           gr.reward_type,
           gr.start_date_target,
           gr.points_target,
           g.name AS goal_name,
           b.name AS badge_name,
           b.icon_url AS badge_icon_url,
           c.name AS course_name
         FROM goals_rewards gr
         JOIN goals g ON g.id = gr.goal_id
         JOIN badge b ON b.id = gr.badge_id
         JOIN course c ON c.id = gr.course_id
         WHERE gr.id = $1`,
        [rewardId]
      );

      if (!current.rowCount) {
        return res.status(404).json({ message: "Recompensa nao encontrada" });
      }

      const base = current.rows[0];
      const nextGoalId = parsed.data.goalId ?? base.goal_id;
      const nextBadgeId = parsed.data.badgeId ?? base.badge_id;
      const nextCourseId = parsed.data.courseId ?? base.course_id;
      const nextRewardType = parsed.data.rewardType ?? base.reward_type;
      const nextPoints = parsed.data.points !== undefined ? parsed.data.points : toNumber(base.points);
      const nextPointsTarget =
        parsed.data.pointsTarget !== undefined ? parsed.data.pointsTarget : toNumber(base.points_target);
      const nextStartDateTarget =
        parsed.data.startDateTarget !== undefined ? parsed.data.startDateTarget : base.start_date_target;
      const nextEndDateTarget =
        parsed.data.endDateTarget !== undefined ? parsed.data.endDateTarget : base.end_date_target;

      const updated = await pool.query<DbGoalRewardRow>(
        `WITH updated AS (
           UPDATE goals_rewards gr
           SET goal_id = $1,
               badge_id = $2,
               course_id = $3,
               reward_type = $4,
               points = $5,
               points_target = $6,
               start_date_target = $7,
               end_date_target = $8
           WHERE gr.id = $9
             AND EXISTS (SELECT 1 FROM goals g WHERE g.id = $1)
             AND EXISTS (SELECT 1 FROM badge b WHERE b.id = $2)
             AND EXISTS (SELECT 1 FROM course c WHERE c.id = $3)
           RETURNING id, goal_id, badge_id, course_id, points, created_at, end_date_target, reward_type, start_date_target, points_target
         )
         SELECT
           u.id,
           u.goal_id,
           u.badge_id,
           u.course_id,
           u.points,
           u.created_at,
           u.end_date_target,
           u.reward_type,
           u.start_date_target,
           u.points_target,
           g.name AS goal_name,
           b.name AS badge_name,
           b.icon_url AS badge_icon_url,
           c.name AS course_name
         FROM updated u
         JOIN goals g ON g.id = u.goal_id
         JOIN badge b ON b.id = u.badge_id
         JOIN course c ON c.id = u.course_id`,
        [
          nextGoalId,
          nextBadgeId,
          nextCourseId,
          nextRewardType,
          nextPoints ?? null,
          nextPointsTarget ?? null,
          nextStartDateTarget ?? null,
          nextEndDateTarget ?? null,
          rewardId,
        ]
      );

      if (!updated.rowCount) {
        return res.status(404).json({ message: "Meta, medalha ou curso nao encontrados" });
      }

      const reward = mapGoalRewardRow(updated.rows[0]);
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "goal_reward_update",
        entityType: "goal_reward",
        entityId: reward.id,
        requestBody: req.body,
        responseBody: { reward },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({ message: "Recompensa atualizada com sucesso!", reward });
    }
  );

  router.delete(
    "/goals/rewards/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const rewardId = Number(req.params.id);
      if (!Number.isInteger(rewardId) || rewardId <= 0) {
        return res.status(400).json({ message: "ID da recompensa invalido" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query<{ id: number }>(
          `SELECT id FROM goals_rewards WHERE id = $1 FOR UPDATE`,
          [rewardId]
        );

        if (!current.rowCount) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Recompensa nao encontrada" });
        }

        await client.query(`DELETE FROM goals_students WHERE goal_reward_id = $1`, [rewardId]);
        await client.query(`DELETE FROM goals_rewards WHERE id = $1`, [rewardId]);
        await client.query("COMMIT");

        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
          action: "goal_reward_delete",
          entityType: "goal_reward",
          entityId: String(rewardId),
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.json({ message: "Recompensa excluida com sucesso!" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  );

  router.get("/goals/students", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const courseId =
      typeof req.query.courseId === "string" && req.query.courseId.trim() !== ""
        ? Number(req.query.courseId)
        : null;
    const goalRewardId =
      typeof req.query.goalRewardId === "string" && req.query.goalRewardId.trim() !== ""
        ? Number(req.query.goalRewardId)
        : null;
    const limitParam = Number(req.query.limit ?? 100);
    const offsetParam = Number(req.query.offset ?? 0);

    if ((courseId !== null && (!Number.isInteger(courseId) || courseId <= 0)) || (goalRewardId !== null && (!Number.isInteger(goalRewardId) || goalRewardId <= 0))) {
      return res.status(400).json({ message: "Filtros invalidos" });
    }

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 100;
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;
    const currentUserId = isStudent(req) ? Number(req.user?.sub ?? 0) : null;

    const totalResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM goals_students gs
       WHERE ($1::int IS NULL OR gs.course_id = $1)
         AND ($2::int IS NULL OR gs.goal_reward_id = $2)
         AND ($3::int IS NULL OR gs.user_id = $3)`,
      [courseId, goalRewardId, currentUserId]
    );

    const result = await pool.query<DbGoalStudentRow>(
      `SELECT
         gs.id,
         gs.user_id,
         gs.goal_reward_id,
         gs.course_id,
         gs.progress,
         gs.is_completed,
         gs.completed_at,
         gs.reward_claimed,
         gs.reward_claimed_at,
         u.name AS user_name,
         u.email AS user_email,
         g.name AS goal_name,
         g.description AS goal_description,
         g.image_url AS goal_image_url,
         g.type AS goal_type,
         b.id AS badge_id,
         b.name AS badge_name,
         b.icon_url AS badge_icon_url,
         c.name AS course_name,
         gr.reward_type,
         gr.points,
         gr.points_target,
         gr.start_date_target,
         gr.end_date_target
       FROM goals_students gs
       JOIN "user" u ON u.id = gs.user_id
       JOIN goals_rewards gr ON gr.id = gs.goal_reward_id
       JOIN goals g ON g.id = gr.goal_id
       JOIN badge b ON b.id = gr.badge_id
       JOIN course c ON c.id = gs.course_id
       WHERE ($1::int IS NULL OR gs.course_id = $1)
         AND ($2::int IS NULL OR gs.goal_reward_id = $2)
         AND ($3::int IS NULL OR gs.user_id = $3)
       ORDER BY gs.is_completed ASC, gs.progress DESC, gs.id DESC
       LIMIT $4 OFFSET $5`,
      [courseId, goalRewardId, currentUserId, limit, offset]
    );

    return res.json({
      items: result.rows.map(mapGoalStudentRow),
      total: Number(totalResult.rows[0]?.total ?? 0),
    });
  });

  router.post(
    "/goals/students",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const parsed = createGoalStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { userId, goalRewardId, courseId } = parsed.data;

      const already = await pool.query<{ id: number }>(
        `SELECT id
         FROM goals_students
         WHERE user_id = $1 AND goal_reward_id = $2
         LIMIT 1`,
        [userId, goalRewardId]
      );

      if (already.rowCount) {
        return res.status(409).json({ message: "Aluno ja atribuido a essa meta" });
      }

      const inserted = await pool.query<DbGoalStudentRow>(
        `WITH inserted AS (
           INSERT INTO goals_students (
             user_id,
             goal_reward_id,
             course_id,
             progress,
             is_completed,
             completed_at,
             reward_claimed,
             reward_claimed_at
           )
           SELECT $1, $2, $3, 0, false, NULL, false, NULL
           FROM "user" u, goals_rewards gr, course c
           WHERE u.id = $1 AND gr.id = $2 AND c.id = $3
           RETURNING id, user_id, goal_reward_id, course_id, progress, is_completed, completed_at, reward_claimed, reward_claimed_at
         )
         SELECT
           i.id,
           i.user_id,
           i.goal_reward_id,
           i.course_id,
           i.progress,
           i.is_completed,
           i.completed_at,
           i.reward_claimed,
           i.reward_claimed_at,
           u.name AS user_name,
           u.email AS user_email,
           g.name AS goal_name,
           g.description AS goal_description,
           g.image_url AS goal_image_url,
           g.type AS goal_type,
           b.id AS badge_id,
           b.name AS badge_name,
           b.icon_url AS badge_icon_url,
           c.name AS course_name,
           gr.reward_type,
           gr.points,
           gr.points_target,
           gr.start_date_target,
           gr.end_date_target
         FROM inserted i
         JOIN "user" u ON u.id = i.user_id
         JOIN goals_rewards gr ON gr.id = i.goal_reward_id
         JOIN goals g ON g.id = gr.goal_id
         JOIN badge b ON b.id = gr.badge_id
         JOIN course c ON c.id = i.course_id`,
        [userId, goalRewardId, courseId]
      );

      if (!inserted.rowCount) {
        return res.status(404).json({ message: "Aluno, recompensa ou curso nao encontrados" });
      }

      const goalStudent = mapGoalStudentRow(inserted.rows[0]);
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "goal_student_create",
        entityType: "goal_student",
        entityId: goalStudent.id,
        metadata: { userId, goalRewardId, courseId },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json({ message: "Aluno atribuido com sucesso!", goalStudent });
    }
  );

  router.put(
    "/goals/students/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const goalStudentId = Number(req.params.id);
      if (!Number.isInteger(goalStudentId) || goalStudentId <= 0) {
        return res.status(400).json({ message: "ID do progresso invalido" });
      }

      const parsed = updateGoalStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const current = await pool.query<{
        id: number;
        progress: number | string;
        is_completed: boolean;
        goal_reward_id: number;
        course_id: number;
        user_id: number;
      }>(`SELECT id, progress, is_completed, goal_reward_id, course_id, user_id FROM goals_students WHERE id = $1`, [goalStudentId]);

      if (!current.rowCount) {
        return res.status(404).json({ message: "Registro de progresso nao encontrado" });
      }

      const base = current.rows[0];
      const nextProgress = parsed.data.progress ?? (toNumber(base.progress) ?? 0);
      const nextIsCompleted = parsed.data.isCompleted ?? base.is_completed;
      const nextGoalRewardId = parsed.data.goalRewardId ?? base.goal_reward_id;
      const nextCourseId = parsed.data.courseId ?? base.course_id;

      if (nextGoalRewardId !== base.goal_reward_id) {
        const duplicate = await pool.query<{ id: number }>(
          `SELECT id
           FROM goals_students
           WHERE user_id = $1 AND goal_reward_id = $2 AND id <> $3
           LIMIT 1`,
          [base.user_id, nextGoalRewardId, goalStudentId]
        );

        if (duplicate.rowCount) {
          return res.status(409).json({ message: "Aluno ja atribuido a essa meta" });
        }
      }

      const updated = await pool.query<DbGoalStudentRow>(
        `WITH updated AS (
           UPDATE goals_students gs
           SET progress = $1,
               is_completed = $2,
               goal_reward_id = $3,
               course_id = $4,
               completed_at = CASE
                 WHEN $2 = true AND gs.completed_at IS NULL THEN NOW()
                 WHEN $2 = false THEN NULL
                 ELSE gs.completed_at
               END
           WHERE gs.id = $5
           RETURNING id, user_id, goal_reward_id, course_id, progress, is_completed, completed_at, reward_claimed, reward_claimed_at
         )
         SELECT
           u2.id,
           u2.user_id,
           u2.goal_reward_id,
           u2.course_id,
           u2.progress,
           u2.is_completed,
           u2.completed_at,
           u2.reward_claimed,
           u2.reward_claimed_at,
           usr.name AS user_name,
           usr.email AS user_email,
           g.name AS goal_name,
           g.description AS goal_description,
           g.image_url AS goal_image_url,
           g.type AS goal_type,
           b.id AS badge_id,
           b.name AS badge_name,
           b.icon_url AS badge_icon_url,
           c.name AS course_name,
           gr.reward_type,
           gr.points,
           gr.points_target,
           gr.start_date_target,
           gr.end_date_target
         FROM updated u2
         JOIN "user" usr ON usr.id = u2.user_id
         JOIN goals_rewards gr ON gr.id = u2.goal_reward_id
         JOIN goals g ON g.id = gr.goal_id
         JOIN badge b ON b.id = gr.badge_id
         JOIN course c ON c.id = u2.course_id`,
        [nextProgress, nextIsCompleted, nextGoalRewardId, nextCourseId, goalStudentId]
      );

      if (!updated.rowCount) {
        return res.status(404).json({ message: "Registro de progresso, recompensa ou curso nao encontrados" });
      }

      const goalStudent = mapGoalStudentRow(updated.rows[0]);
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "goal_student_update",
        entityType: "goal_student",
        entityId: goalStudent.id,
        requestBody: req.body,
        responseBody: { goalStudent },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({ message: "Progresso atualizado com sucesso!", goalStudent });
    }
  );

  router.delete(
    "/goals/students/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const goalStudentId = Number(req.params.id);
      if (!Number.isInteger(goalStudentId) || goalStudentId <= 0) {
        return res.status(400).json({ message: "ID do progresso invalido" });
      }

      const deleted = await pool.query<{
        id: number;
        user_id: number;
        goal_reward_id: number;
      }>(
        `DELETE FROM goals_students
         WHERE id = $1
         RETURNING id, user_id, goal_reward_id`,
        [goalStudentId]
      );

      if (!deleted.rowCount) {
        return res.status(404).json({ message: "Registro de progresso nao encontrado" });
      }

      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "goal_student_delete",
        entityType: "goal_student",
        entityId: String(deleted.rows[0].id),
        metadata: {
          userId: deleted.rows[0].user_id,
          goalRewardId: deleted.rows[0].goal_reward_id,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({ message: "Atribuicao removida com sucesso!" });
    }
  );

  router.post("/goals/students/:id/claim", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const goalStudentId = Number(req.params.id);
    if (!Number.isInteger(goalStudentId) || goalStudentId <= 0) {
      return res.status(400).json({ message: "ID do progresso invalido" });
    }

    const updated = await pool.query<DbGoalStudentRow>(
      `WITH updated AS (
         UPDATE goals_students gs
         SET reward_claimed = true,
             reward_claimed_at = NOW()
         WHERE gs.id = $1
           AND gs.is_completed = true
           AND gs.reward_claimed = false
           AND ($2::int IS NULL OR gs.user_id = $2)
         RETURNING id, user_id, goal_reward_id, course_id, progress, is_completed, completed_at, reward_claimed, reward_claimed_at
       )
       SELECT
         u2.id,
         u2.user_id,
         u2.goal_reward_id,
         u2.course_id,
         u2.progress,
         u2.is_completed,
         u2.completed_at,
         u2.reward_claimed,
         u2.reward_claimed_at,
         usr.name AS user_name,
         usr.email AS user_email,
         g.name AS goal_name,
         g.description AS goal_description,
         g.image_url AS goal_image_url,
         g.type AS goal_type,
         b.id AS badge_id,
         b.name AS badge_name,
         b.icon_url AS badge_icon_url,
         c.name AS course_name,
         gr.reward_type,
         gr.points,
         gr.points_target,
         gr.start_date_target,
         gr.end_date_target
       FROM updated u2
       JOIN "user" usr ON usr.id = u2.user_id
       JOIN goals_rewards gr ON gr.id = u2.goal_reward_id
       JOIN goals g ON g.id = gr.goal_id
       JOIN badge b ON b.id = gr.badge_id
       JOIN course c ON c.id = u2.course_id`,
      [goalStudentId, isStudent(req) ? Number(req.user?.sub ?? 0) : null]
    );

    if (!updated.rowCount) {
      return res.status(400).json({ message: "Recompensa indisponivel para resgate" });
    }

    const goalStudent = mapGoalStudentRow(updated.rows[0]);
    logActivity({
      actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
      action: "goal_student_claim",
      entityType: "goal_student",
      entityId: goalStudent.id,
      req,
    }).catch((err) => console.error("activity log error:", err));

    return res.json({ message: "Recompensa resgatada com sucesso!", goalStudent });
  });

  router.get("/goals/:id", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const goalId = Number(req.params.id);
    if (!Number.isInteger(goalId) || goalId <= 0) {
      return res.status(400).json({ message: "ID da meta invalido" });
    }

    const goalResult = await pool.query<DbGoalRow>(
      `SELECT id, name, description, type, image_url
       FROM goals
       WHERE id = $1`,
      [goalId]
    );

    if (!goalResult.rowCount) {
      return res.status(404).json({ message: "Meta nao encontrada" });
    }

    const rewardsResult = await pool.query<DbGoalRewardRow>(
      `SELECT
         gr.id,
         gr.goal_id,
         gr.badge_id,
         gr.course_id,
         gr.points,
         gr.created_at,
         gr.end_date_target,
         gr.reward_type,
         gr.start_date_target,
         gr.points_target,
         g.name AS goal_name,
         b.name AS badge_name,
         b.icon_url AS badge_icon_url,
         c.name AS course_name
       FROM goals_rewards gr
       JOIN goals g ON g.id = gr.goal_id
       JOIN badge b ON b.id = gr.badge_id
       JOIN course c ON c.id = gr.course_id
       WHERE gr.goal_id = $1
       ORDER BY gr.created_at DESC, gr.id DESC`,
      [goalId]
    );

    return res.json({
      goal: mapGoalRow(goalResult.rows[0]),
      rewards: rewardsResult.rows.map(mapGoalRewardRow),
    });
  });

  return router;
}
