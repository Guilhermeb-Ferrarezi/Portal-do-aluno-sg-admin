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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMessageMetadata(message: string | null) {
  if (!message) {
    return {
      actorRole: null as string | null,
      entityId: null as string | null,
      ipAddress: null as string | null,
      userAgent: null as string | null,
      metadata: null as Record<string, unknown> | null,
    };
  }

  const out = {
    actorRole: null as string | null,
    entityId: null as string | null,
    ipAddress: null as string | null,
    userAgent: null as string | null,
    metadata: {} as Record<string, unknown>,
  };

  const parts = message.split(" | ").map((p) => p.trim()).filter(Boolean);
  const looseParts: string[] = [];

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) {
      looseParts.push(part);
      continue;
    }

    const key = part.slice(0, eqIndex).trim();
    const rawValue = part.slice(eqIndex + 1).trim();
    if (!key) continue;

    if (key === "entityId") {
      out.entityId = rawValue || null;
      continue;
    }
    if (key === "actorRole") {
      out.actorRole = rawValue || null;
      continue;
    }
    if (key === "ip") {
      out.ipAddress = rawValue || null;
      continue;
    }
    if (key === "ua") {
      out.userAgent = rawValue || null;
      continue;
    }

    if (key === "metadata") {
      try {
        const parsed = JSON.parse(rawValue) as unknown;
        if (isRecord(parsed)) {
          out.metadata = { ...out.metadata, ...parsed };
        } else {
          out.metadata.metadata = parsed;
        }
      } catch {
        out.metadata.metadata = rawValue;
      }
      continue;
    }

    out.metadata[key] = rawValue;
  }

  if (looseParts.length > 0) {
    out.metadata.message = looseParts.join(" | ");
  }

  return {
    actorRole: out.actorRole,
    entityId: out.entityId,
    ipAddress: out.ipAddress,
    userAgent: out.userAgent,
    metadata: Object.keys(out.metadata).length > 0 ? out.metadata : null,
  };
}

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
          items: result.rows.map((row) => {
            const parsed = parseMessageMetadata(row.message);
            return {
              id: row.id,
              actorId: row.actor_id,
              actorRole: parsed.actorRole,
              actorNome: row.actor_nome,
              actorUsuario: row.actor_usuario,
              action: row.action,
              entityType: row.entity_type,
              entityId: parsed.entityId,
              metadata: parsed.metadata,
              ipAddress: parsed.ipAddress,
              userAgent: parsed.userAgent,
              createdAt: row.created_at,
            };
          }),
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
