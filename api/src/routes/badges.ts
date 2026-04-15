import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { logActivity } from "../utils/activityLog";
import { uploadToR2, deleteFromR2, isR2ManagedUrl } from "../utils/uploadR2";

type DbBadgeRow = {
  id: number;
  name: string;
  description: string;
  icon_url: string;
  created_at: string;
  holders_count?: string;
};

type DbBadgeHolderRow = {
  holder_id: number;
  badge_id: number;
  badge_name: string;
  user_id: number;
  user_name: string;
  user_email: string;
  awarded_at: string;
};

const createBadgeSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  description: z.string().min(2, "Descrição obrigatória"),
  iconUrl: z.string().min(1, "Ícone obrigatório"),
});

const updateBadgeSchema = z
  .object({
    name: z.string().min(2, "Nome obrigatório").optional(),
    description: z.string().min(2, "Descrição obrigatória").optional(),
    iconUrl: z.string().optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined || data.iconUrl !== undefined, {
    message: "Informe ao menos um campo para atualização",
  });

const updateHolderBadgeSchema = z.object({
  badgeId: z.coerce.number().int().positive("badgeId inválido"),
});

const assignBadgeSchema = z.object({
  userId: z.coerce.number().int().positive("userId inválido"),
  badgeId: z.coerce.number().int().positive("badgeId inválido"),
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
    throw new Error("Formato de imagem não suportado para ícone");
  }

  const base64Payload = match[2].replace(/\s+/g, "");
  const buffer = Buffer.from(base64Payload, "base64");
  if (!buffer.length) {
    throw new Error("Ícone inválido");
  }

  return { mimetype, buffer, ext };
}

async function resolveBadgeIconUrl(inputIconUrl: string): Promise<string> {
  const parsedImage = parseDataUrlImage(inputIconUrl);
  if (!parsedImage) return inputIconUrl.trim();

  const uploadedUrl = await uploadToR2(
    {
      originalname: `badge-icon.${parsedImage.ext}`,
      buffer: parsedImage.buffer,
      mimetype: parsedImage.mimetype,
    },
    "badges"
  );
  return uploadedUrl;
}

export function badgesRouter(jwtSecret: string) {
  const router = Router();

  router.get("/badges", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const limitParam = Number(req.query.limit ?? 10);
    const offsetParam = Number(req.query.offset ?? 0);
    const qParam =
      typeof req.query.q === "string" && req.query.q.trim() !== "" ? req.query.q.trim() : null;

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 10;
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

    const totalResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM badge
       WHERE ($1::text IS NULL
         OR name ILIKE '%' || $1 || '%'
         OR description ILIKE '%' || $1 || '%')`,
      [qParam]
    );
    const total = Number(totalResult.rows[0]?.total ?? 0);

    const result = await pool.query<DbBadgeRow>(
      `SELECT
         b.id,
         b.name,
         b.description,
         b.icon_url,
         b.created_at,
         (
           SELECT COUNT(*)::text
           FROM badge_student bs
           WHERE bs.badge_id = b.id
         ) AS holders_count
       FROM badge b
       WHERE ($1::text IS NULL
         OR name ILIKE '%' || $1 || '%'
         OR description ILIKE '%' || $1 || '%')
       ORDER BY b.created_at DESC
       LIMIT $2 OFFSET $3`,
      [qParam, limit, offset]
    );

    return res.json({
      items: result.rows.map((b) => ({
        id: String(b.id),
        name: b.name,
        description: b.description,
        iconUrl: b.icon_url,
        createdAt: b.created_at,
        holdersCount: Number(b.holders_count ?? 0),
      })),
      total,
    });
  });

  router.get("/badges/holders", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const badgeIdParam = req.query.badgeId;
    const badgeId =
      typeof badgeIdParam === "string" && badgeIdParam.trim() !== ""
        ? Number(badgeIdParam)
        : null;

    if (badgeId !== null && (!Number.isInteger(badgeId) || badgeId <= 0)) {
      return res.status(400).json({ message: "badgeId inválido" });
    }

    const limitParam = Number(req.query.limit ?? 10);
    const offsetParam = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 10;
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

    const totalResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM badge_student bs
       WHERE ($1::int IS NULL OR bs.badge_id = $1)`,
      [badgeId]
    );
    const total = Number(totalResult.rows[0]?.total ?? 0);

    const result = await pool.query<DbBadgeHolderRow>(
      `SELECT
         bs.id AS holder_id,
         bs.badge_id,
         b.name AS badge_name,
         u.id AS user_id,
         u.name AS user_name,
         u.email AS user_email,
         bs.awarded_at
       FROM badge_student bs
       JOIN badge b ON b.id = bs.badge_id
       JOIN "user" u ON u.id = bs.user_id
       WHERE ($1::int IS NULL OR bs.badge_id = $1)
       ORDER BY bs.awarded_at DESC
       LIMIT $2 OFFSET $3`,
      [badgeId, limit, offset]
    );

    return res.json({
      items: result.rows.map((row) => ({
        holderId: String(row.holder_id),
        badgeId: String(row.badge_id),
        badgeName: row.badge_name,
        user: {
          id: String(row.user_id),
          nome: row.user_name,
          email: row.user_email,
        },
        awardedAt: row.awarded_at,
      })),
      total,
    });
  });

  router.put(
    "/badges/holders/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const holderId = Number(req.params.id);
      if (!Number.isInteger(holderId) || holderId <= 0) {
        return res.status(400).json({ message: "ID do vínculo inválido" });
      }

      const parsed = updateHolderBadgeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { badgeId } = parsed.data;

      const updated = await pool.query<DbBadgeHolderRow>(
        `UPDATE badge_student bs
         SET badge_id = $1, awarded_at = NOW()
         FROM badge b, "user" u
         WHERE bs.id = $2
           AND b.id = $1
           AND u.id = bs.user_id
         RETURNING
           bs.id AS holder_id,
           bs.badge_id,
           b.name AS badge_name,
           u.id AS user_id,
           u.name AS user_name,
           u.email AS user_email,
           bs.awarded_at`,
        [badgeId, holderId]
      );

      if (!updated.rowCount) {
        return res.status(404).json({ message: "Vínculo de medalha não encontrado" });
      }

      const row = updated.rows[0];
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "badge_holder_update",
        entityType: "badge",
        entityId: String(row.holder_id),
        metadata: { badgeId: row.badge_id, userId: row.user_id },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({
        message: "Medalha do usuário atualizada com sucesso!",
        holder: {
          holderId: String(row.holder_id),
          badgeId: String(row.badge_id),
          badgeName: row.badge_name,
          user: {
            id: String(row.user_id),
            nome: row.user_name,
            email: row.user_email,
          },
          awardedAt: row.awarded_at,
        },
      });
    }
  );

  router.delete(
    "/badges/holders/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const holderId = Number(req.params.id);
      if (!Number.isInteger(holderId) || holderId <= 0) {
        return res.status(400).json({ message: "ID do vínculo inválido" });
      }

      const deleted = await pool.query<{ id: number }>(
        `DELETE FROM badge_student WHERE id = $1 RETURNING id`,
        [holderId]
      );

      if (!deleted.rowCount) {
        return res.status(404).json({ message: "Vínculo de medalha não encontrado" });
      }

      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "badge_holder_delete",
        entityType: "badge",
        entityId: String(holderId),
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({ message: "Medalha removida do usuário com sucesso!" });
    }
  );

  router.post(
    "/badges",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const parsed = createBadgeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { name, description, iconUrl } = parsed.data;
      let persistedIconUrl: string;
      try {
        persistedIconUrl = await resolveBadgeIconUrl(iconUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao processar ícone";
        return res.status(400).json({ message });
      }

      const created = await pool.query<DbBadgeRow>(
        `INSERT INTO badge (name, description, icon_url, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, name, description, icon_url, created_at`,
        [name.trim(), description.trim(), persistedIconUrl]
      );

      const b = created.rows[0];
      const responseBody = {
        message: "Medalha criada com sucesso!",
        badge: {
          id: String(b.id),
          name: b.name,
          description: b.description,
          iconUrl: b.icon_url,
          createdAt: b.created_at,
        },
      };
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "badge_create",
        entityType: "badge",
        entityId: String(b.id),
        requestBody: req.body,
        responseBody,
        statusCode: 201,
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json(responseBody);
    }
  );

  router.put(
    "/badges/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const badgeId = Number(req.params.id);
      if (!Number.isInteger(badgeId) || badgeId <= 0) {
        return res.status(400).json({ message: "ID da medalha inválido" });
      }

      const parsed = updateBadgeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const current = await pool.query<DbBadgeRow>(
        `SELECT id, name, description, icon_url, created_at
         FROM badge
         WHERE id = $1`,
        [badgeId]
      );

      if (!current.rowCount) {
        return res.status(404).json({ message: "Medalha não encontrada" });
      }

      const base = current.rows[0];
      const payload = parsed.data;

      const nextName = payload.name !== undefined ? payload.name.trim() : base.name;
      const nextDescription =
        payload.description !== undefined ? payload.description.trim() : base.description;
      let nextIconUrl = base.icon_url;
      if (payload.iconUrl !== undefined) {
        try {
          nextIconUrl = await resolveBadgeIconUrl(payload.iconUrl);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao processar ícone";
          return res.status(400).json({ message });
        }
      }

      const updated = await pool.query<DbBadgeRow>(
        `UPDATE badge
         SET name = $1,
             description = $2,
             icon_url = $3
         WHERE id = $4
         RETURNING id, name, description, icon_url, created_at`,
        [nextName, nextDescription, nextIconUrl, badgeId]
      );

      const row = updated.rows[0];
      if (payload.iconUrl !== undefined && base.icon_url !== row.icon_url && isR2ManagedUrl(base.icon_url)) {
        deleteFromR2(base.icon_url).catch(() => undefined);
      }

      const responseBody = {
        message: "Medalha atualizada com sucesso!",
        badge: { id: String(row.id), name: row.name, description: row.description, iconUrl: row.icon_url, createdAt: row.created_at },
      };
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "badge_update",
        entityType: "badge",
        entityId: String(row.id),
        requestBody: req.body,
        responseBody,
        statusCode: 200,
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json(responseBody);
    }
  );

  router.delete(
    "/badges/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const badgeId = Number(req.params.id);
      if (!Number.isInteger(badgeId) || badgeId <= 0) {
        return res.status(400).json({ message: "ID da medalha inválido" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const exists = await client.query<{ id: number; name: string; icon_url: string | null }>(
          `SELECT id, name, icon_url
           FROM badge
           WHERE id = $1
           FOR UPDATE`,
          [badgeId]
        );

        if (!exists.rowCount) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Medalha não encontrada" });
        }

        const deletedHolders = await client.query<{ id: number }>(
          `DELETE FROM badge_student WHERE badge_id = $1 RETURNING id`,
          [badgeId]
        );

        await client.query(`DELETE FROM badge WHERE id = $1`, [badgeId]);
        await client.query("COMMIT");

        const oldBadgeIconUrl = exists.rows[0]?.icon_url;
        if (oldBadgeIconUrl && isR2ManagedUrl(oldBadgeIconUrl)) {
          deleteFromR2(oldBadgeIconUrl).catch(() => undefined);
        }

        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
          action: "badge_delete",
          entityType: "badge",
          entityId: String(badgeId),
          metadata: { name: exists.rows[0].name, removedAssignments: deletedHolders.rowCount ?? 0 },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.json({
          message: "Medalha excluída com sucesso!",
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  );

  router.post(
    "/badges/holders",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const parsed = assignBadgeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { userId, badgeId } = parsed.data;

      const already = await pool.query<{ id: number }>(
        `SELECT id
         FROM badge_student
         WHERE user_id = $1 AND badge_id = $2
         LIMIT 1`,
        [userId, badgeId]
      );

      if (already.rowCount) {
        return res.status(409).json({ message: "Usuário já possui essa medalha" });
      }

      const inserted = await pool.query<DbBadgeHolderRow>(
        `WITH inserted AS (
           INSERT INTO badge_student (user_id, badge_id, awarded_at)
           SELECT $1, $2, NOW()
           FROM "user" u, badge b
           WHERE u.id = $1 AND b.id = $2
           RETURNING id, user_id, badge_id, awarded_at
         )
         SELECT
           i.id AS holder_id,
           i.badge_id,
           b.name AS badge_name,
           u.id AS user_id,
           u.name AS user_name,
           u.email AS user_email,
           i.awarded_at
         FROM inserted i
         JOIN badge b ON b.id = i.badge_id
         JOIN "user" u ON u.id = i.user_id`,
        [userId, badgeId]
      );

      if (!inserted.rowCount) {
        return res.status(404).json({ message: "Usuário ou medalha não encontrados" });
      }

      const row = inserted.rows[0];
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "badge_holder_create",
        entityType: "badge",
        entityId: String(row.holder_id),
        metadata: { badgeId: row.badge_id, userId: row.user_id },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json({
        message: "Medalha atribuída com sucesso!",
        holder: {
          holderId: String(row.holder_id),
          badgeId: String(row.badge_id),
          badgeName: row.badge_name,
          user: {
            id: String(row.user_id),
            nome: row.user_name,
            email: row.user_email,
          },
          awardedAt: row.awarded_at,
        },
      });
    }
  );

  return router;
}
