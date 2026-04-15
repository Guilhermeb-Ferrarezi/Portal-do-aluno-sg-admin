import { Router } from "express";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";

type ActivityLogRow = {
  id: string;
  actor_id: string | null;
  actor_role: number | null;
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

function toActorRole(role: number | null): "aluno" | "professor" | "admin" | null {
  if (role === 1) return "aluno";
  if (role === 2) return "professor";
  if (role === 3) return "admin";
  return null;
}

function normalizeActorRole(value: string | null): "aluno" | "professor" | "admin" | null {
  if (!value) return null;
  const role = value.trim().toLowerCase();
  if (!role) return null;
  if (role === "1" || role === "aluno" || role === "user") return "aluno";
  if (role === "2" || role === "professor" || role === "teacher") return "professor";
  if (role === "3" || role === "admin" || role === "administrador") return "admin";
  return null;
}

type ParsedMessage = {
  actor: { id?: string | null; name?: string | null; email?: string | null; role?: string | number | null } | null;
  actorRole: string | null;
  entityId: string | null;
  method: string | null;
  endpoint: string | null;
  requestBody: unknown;
  responseBody: unknown;
  statusCode: number | string | null;
  responseTimeMs: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  route: string | null;
  outcome: string | null;
  errorType: string | null;
  source: string | null;
  contextArea: string | null;
  metadata: Record<string, unknown> | null;
};

function parseMessageMetadata(message: string | null): ParsedMessage {
  const empty: ParsedMessage = {
    actor: null,
    actorRole: null,
    entityId: null,
    method: null,
    endpoint: null,
    requestBody: undefined,
    responseBody: undefined,
    statusCode: null,
    responseTimeMs: null,
    ipAddress: null,
    userAgent: null,
    requestId: null,
    route: null,
    outcome: null,
    errorType: null,
    source: null,
    contextArea: null,
    metadata: null,
  };

  if (!message) return empty;

  // New format: JSON payload
  if (message.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(message) as unknown;
      if (!isRecord(parsed)) return empty;

      const actor = isRecord(parsed.actor) ? parsed.actor : null;
      const actorRoleRaw: string | number | null =
        actor?.role != null && (typeof actor.role === "string" || typeof actor.role === "number")
          ? actor.role
          : null;
      const actorRole = actorRoleRaw !== null ? String(actorRoleRaw) : null;

      const scRaw = parsed.statusCode;
      const statusCodeParsed: number | null =
        typeof scRaw === "number" ? scRaw :
        typeof scRaw === "string" && scRaw !== "" ? Number(scRaw) : null;
      const rtRaw = parsed.responseTimeMs;
      const responseTimeParsed: number | null =
        typeof rtRaw === "number" ? rtRaw : null;

      return {
        actor: actor
          ? {
              id: actor.id != null ? String(actor.id) : null,
              name: actor.name != null ? String(actor.name) : null,
              email: actor.email != null ? String(actor.email) : null,
              role: actorRoleRaw,
            }
          : null,
        actorRole: normalizeActorRole(actorRole),
        entityId: parsed.entityId != null ? String(parsed.entityId) : null,
        method: parsed.method != null ? String(parsed.method) : null,
        endpoint: parsed.endpoint != null ? String(parsed.endpoint) : null,
        requestBody: parsed.requestBody !== undefined ? parsed.requestBody : undefined,
        responseBody: parsed.responseBody !== undefined ? parsed.responseBody : undefined,
        statusCode: statusCodeParsed,
        responseTimeMs: responseTimeParsed,
        ipAddress: parsed.ipAddress != null ? String(parsed.ipAddress) : null,
        userAgent: parsed.userAgent != null ? String(parsed.userAgent) : null,
        requestId: null,
        route: null,
        outcome: null,
        errorType: null,
        source: null,
        contextArea: null,
        metadata: isRecord(parsed.metadata) ? parsed.metadata : null,
      };
    } catch {
      return empty;
    }
  }

  // Legacy format: key=value | key=value | ...
  const out = {
    actorRole: null as string | null,
    entityId: null as string | null,
    ipAddress: null as string | null,
    userAgent: null as string | null,
    requestId: null as string | null,
    route: null as string | null,
    statusCode: null as string | null,
    outcome: null as string | null,
    errorType: null as string | null,
    source: null as string | null,
    contextArea: null as string | null,
    metadata: {} as Record<string, unknown>,
  };

  const parts = message.split(" | ").map((p) => p.trim()).filter(Boolean);
  const looseParts: string[] = [];

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) { looseParts.push(part); continue; }
    const key = part.slice(0, eqIndex).trim();
    const rawValue = part.slice(eqIndex + 1).trim();
    if (!key) continue;
    if (key === "entityId") { out.entityId = rawValue || null; continue; }
    if (key === "actorRole") { out.actorRole = rawValue || null; continue; }
    if (key === "ip") { out.ipAddress = rawValue || null; continue; }
    if (key === "ua") { out.userAgent = rawValue || null; continue; }
    if (key === "requestId") { out.requestId = rawValue || null; continue; }
    if (key === "route") { out.route = rawValue || null; continue; }
    if (key === "statusCode") { out.statusCode = rawValue || null; continue; }
    if (key === "outcome") { out.outcome = rawValue || null; continue; }
    if (key === "errorType") { out.errorType = rawValue || null; continue; }
    if (key === "source") { out.source = rawValue || null; continue; }
    if (key === "contextArea") { out.contextArea = rawValue || null; continue; }
    if (key === "metadata") {
      try {
        const p = JSON.parse(rawValue) as unknown;
        if (isRecord(p)) out.metadata = { ...out.metadata, ...p };
        else out.metadata.metadata = p;
      } catch { out.metadata.metadata = rawValue; }
      continue;
    }
    out.metadata[key] = rawValue;
  }

  if (looseParts.length > 0) out.metadata.message = looseParts.join(" | ");

  return {
    actor: null,
    actorRole: normalizeActorRole(out.actorRole),
    entityId: out.entityId,
    method: null,
    endpoint: out.route,
    requestBody: undefined,
    responseBody: undefined,
    statusCode: out.statusCode,
    responseTimeMs: null,
    ipAddress: out.ipAddress,
    userAgent: out.userAgent,
    requestId: out.requestId,
    route: out.route,
    outcome: out.outcome,
    errorType: out.errorType,
    source: out.source,
    contextArea: out.contextArea,
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
        const actorGroup = (req.query.actorGroup as string | undefined)?.trim();

        const baseQuery = `
          SELECT
            l.id::text as id,
            l.user_id::text as actor_id,
            u.role as actor_role,
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
        const params: unknown[] = [];

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

        if (actorGroup === "user") {
          conditions.push(`u.role = 1`);
        } else if (actorGroup === "staff") {
          conditions.push(`u.role IN (2, 3)`);
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
            const roleFromMessage = normalizeActorRole(parsed.actorRole);
            return {
              id: row.id,
              actor: {
                id: parsed.actor?.id ?? row.actor_id,
                name: parsed.actor?.name ?? row.actor_nome,
                email: parsed.actor?.email ?? row.actor_usuario,
                role: parsed.actor?.role != null
                  ? normalizeActorRole(String(parsed.actor.role))
                  : (roleFromMessage ?? toActorRole(row.actor_role)),
              },
              action: row.action,
              entityType: row.entity_type,
              entityId: parsed.entityId,
              method: parsed.method,
              endpoint: parsed.endpoint,
              requestBody: parsed.requestBody ?? null,
              responseBody: parsed.responseBody ?? null,
              statusCode: parsed.statusCode,
              responseTimeMs: parsed.responseTimeMs,
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
