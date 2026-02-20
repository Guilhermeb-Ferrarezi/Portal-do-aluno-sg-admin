import { Router } from "express";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";

type ActivityLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  message: string | null;
  created_at: string;
  actor_nome: string | null;
  actor_usuario: string | null;
};

export function activityLogsRouter(jwtSecret: string) {
  const router = Router();

  router.get(
    "/activity-logs",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const limitRaw = Number(req.query.limit ?? 200);
        const offsetRaw = Number(req.query.offset ?? 0);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
        const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
        const action = (req.query.action as string | undefined)?.trim();
        const entityType = (req.query.entityType as string | undefined)?.trim();
        const actorId = (req.query.actorId as string | undefined)?.trim();
        const q = (req.query.q as string | undefined)?.trim();
        const from = (req.query.from as string | undefined)?.trim();
        const to = (req.query.to as string | undefined)?.trim();

        const baseQuery = `
          SELECT
            l.id::text as id,
            l.user_id::text as actor_id,
            l.action as action,
            COALESCE(l.entity_name, 'unknown') as entity_type,
            l."Message" as message,
            l."LogDate" as created_at,
            u.name as actor_nome,
            u.email as actor_usuario
          FROM logs l
          LEFT JOIN "user" u ON u.id = l.user_id
        `;

        const conditions: string[] = [];
        const params: any[] = [];

        if (action) {
          params.push(action);
          conditions.push(`l.action = $${params.length}`);
        }

        if (entityType) {
          params.push(entityType);
          conditions.push(`l.entity_name = $${params.length}`);
        }

        if (actorId) {
          params.push(actorId);
          conditions.push(`l.user_id::text = $${params.length}`);
        }

        if (from) {
          params.push(from);
          conditions.push(`l."LogDate" >= $${params.length}`);
        }

        if (to) {
          params.push(to);
          conditions.push(`l."LogDate" <= $${params.length}`);
        }

        if (q) {
          params.push(`%${q}%`);
          conditions.push(`(
            u.name ILIKE $${params.length}
            OR u.email ILIKE $${params.length}
            OR l.entity_name ILIKE $${params.length}
            OR l.action ILIKE $${params.length}
            OR l."Message" ILIKE $${params.length}
          )`);
        }

        const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

        const countQuery = `SELECT COUNT(*)::int as total FROM logs l LEFT JOIN "user" u ON u.id = l.user_id${whereClause}`;
        const countResult = await pool.query<{ total: number }>(countQuery, params);

        const query = `${baseQuery}${whereClause} ORDER BY l."LogDate" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const result = await pool.query<ActivityLogRow>(query, [...params, limit, offset]);

        return res.json({
          items: result.rows.map((row) => ({
            id: row.id,
            actorId: row.actor_id,
            actorRole: null,
            actorNome: row.actor_nome,
            actorUsuario: row.actor_usuario,
            action: row.action,
            entityType: row.entity_type,
            entityId: null,
            metadata: row.message ? { message: row.message } : null,
            ipAddress: null,
            userAgent: null,
            createdAt: row.created_at,
          })),
          total: countResult.rows[0]?.total ?? 0,
        });
      } catch (error) {
        console.error("Erro ao listar activity logs:", error);
        return res.status(500).json({ message: "Erro ao listar logs" });
      }
    }
  );

  return router;
}
