import { Router } from "express";
import { existsSync } from "node:fs";
import { z } from "zod";
import { pool } from "../db";
import { type AuthRequest } from "../middlewares/auth";
import {
  authOrApiTokenGuard,
  resolveAuthenticatedUserId,
  requireApiTokenScopeIfPresent,
  requireRoleOrApiTokenScope,
  type ApiTokenAuthRequest,
} from "../middlewares/apiTokenAuth";

const templateSchema = z.object({
  nome: z.string().min(1, "Nome interno obrigatorio"),
  tituloTemplate: z.string().min(1, "Titulo obrigatorio"),
  mensagemTemplate: z.string().min(1, "Mensagem obrigatoria"),
  ativo: z.boolean(),
});

const dispatchSchema = z.object({
  cursoIds: z.array(z.coerce.number().int().positive()).default([]),
  turmaIds: z.array(z.coerce.number().int().positive()).default([]),
  alunoIds: z.array(z.coerce.number().int().positive()).default([]),
});

const dispatchListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().trim().default(""),
});

const myNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["all", "read", "unread"]).default("all"),
});

type NotificationRow = {
  id: number;
  user_id: number;
  title: string;
  message: string;
  metadata_json: string;
  read_at: string | null;
  created_at: string;
};

type GatewayTemplate = {
  Id: number;
  Name: string;
  TitleTemplate: string;
  MessageTemplate: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
};

type GatewayTemplatePayload = GatewayTemplate & {
  id?: number;
  name?: string;
  titleTemplate?: string;
  messageTemplate?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type GatewayDispatch = {
  Id: number;
  NotificationTemplateId: number;
  TemplateName: string;
  TriggeredByActorName: string | null;
  TriggeredByActorEmail: string | null;
  Filters: {
    CourseIds?: number[];
    ClassIds?: number[];
    StudentIds?: number[];
  } | null;
  TotalRecipients: number;
  FailedRecipients: number;
  CreatedAt: string;
};

type GatewayDispatchPayload = GatewayDispatch & {
  id?: number;
  notificationTemplateId?: number;
  templateName?: string;
  triggeredByActorName?: string | null;
  triggeredByActorEmail?: string | null;
  filters?: {
    courseIds?: number[];
    classIds?: number[];
    studentIds?: number[];
  } | null;
  totalRecipients?: number;
  failedRecipients?: number;
  createdAt?: string;
};

type GatewayResponse<T> = {
  Success: boolean;
  Errors?: string[];
  Result?: T;
  TotalRows?: number;
};

type GatewayResponsePayload<T> = {
  Success?: boolean;
  Errors?: string[];
  Result?: T;
  TotalRows?: number;
  success?: boolean;
  errors?: string[];
  result?: T;
  totalRows?: number;
};

type DispatchFilterPayload = {
  cursoIds: number[];
  turmaIds: number[];
  alunoIds: number[];
};

type RecipientContextRow = {
  id: number;
  has_turma: boolean;
  has_curso: boolean;
};

function normalizeGatewayBaseUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    const isDockerized = existsSync("/.dockerenv");
    const isLoopbackHost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1" ||
      url.hostname === "[::1]";

    if (isDockerized && isLoopbackHost) {
      url.hostname = "host.docker.internal";
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return baseUrl.replace(/\/+$/, "");
  }
}

function resolveGatewayConfig() {
  const isProduction = (process.env.NODE_ENV?.trim() || "").toLowerCase() === "production";
  const baseUrl =
    process.env.NOTIFICATIONS_PORTAL_API_URL?.trim() ||
    (!isProduction ? process.env.SSO_HOME_API_URL?.trim() : undefined);
  const sharedSecret =
    process.env.NOTIFICATIONS_SHARED_SECRET?.trim() ||
    (!isProduction ? process.env.SSO_SHARED_SECRET?.trim() : undefined);

  if (!baseUrl || !sharedSecret) {
    return null;
  }

  return {
    baseUrl: normalizeGatewayBaseUrl(baseUrl),
    sharedSecret,
  };
}

async function resolveActor(req: ApiTokenAuthRequest) {
  const userId = resolveAuthenticatedUserId(req);
  if (userId === null || typeof userId !== 'number' || userId <= 0 || !Number.isInteger(userId)) {
    return {
      externalId: req.user?.sub ?? req.apiToken?.publicId ?? null,
      name: null,
      email: req.user?.usuario ?? null,
    };
  }

  const normalizedUserId = userId as number;
  const result = await pool.query<{ id: number; name: string | null; email: string | null }>(
    `SELECT id, name, email
     FROM "user"
     WHERE id = $1
     LIMIT 1`,
    [normalizedUserId]
  );

  return {
    externalId: req.user?.sub ?? req.apiToken?.publicId ?? null,
    name: result.rows[0]?.name ?? null,
    email: result.rows[0]?.email ?? req.user?.usuario ?? null,
  };
}

async function callGateway<T>(
  path: string,
  init?: RequestInit
): Promise<GatewayResponse<T>> {
  const config = resolveGatewayConfig();
  if (!config) {
    throw new Error(
      "Configuracao de notificacoes ausente. Defina NOTIFICATIONS_PORTAL_API_URL e NOTIFICATIONS_SHARED_SECRET."
    );
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        "x-notification-admin-secret": config.sharedSecret,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Falha na comunicacao com o portal do aluno.";

    return {
      Success: false,
      Errors: [
        `Falha ao conectar com o portal do aluno em ${config.baseUrl}. ${message}`,
      ],
    };
  }

  const json = (await response.json().catch(() => null)) as GatewayResponsePayload<T> | null;

  const normalizedResponse: GatewayResponse<T> | null = json
    ? {
      Success: json.Success ?? json.success ?? false,
      Errors: json.Errors ?? json.errors ?? [],
      Result: json.Result ?? json.result,
      TotalRows: json.TotalRows ?? json.totalRows,
    }
  : null;

  if (!response.ok) {
    const upstreamSummary = `Upstream ${response.status} ${response.statusText}`.trim();
    return {
      Success: false,
      Errors:
        normalizedResponse?.Errors && normalizedResponse.Errors.length > 0
          ? normalizedResponse.Errors
          : [`${upstreamSummary} ao acessar ${path} no portal do aluno.`],
    };
  }

  return normalizedResponse ?? { Success: false, Errors: ["Resposta invalida do portal do aluno."] };
}

function mapTemplate(template: GatewayTemplatePayload) {
  return {
    id: template.Id ?? template.id ?? 0,
    nome: template.Name ?? template.name ?? "",
    tituloTemplate: template.TitleTemplate ?? template.titleTemplate ?? "",
    mensagemTemplate: template.MessageTemplate ?? template.messageTemplate ?? "",
    ativo: template.IsActive ?? template.isActive ?? false,
    createdAt: template.CreatedAt ?? template.createdAt ?? "",
    updatedAt: template.UpdatedAt ?? template.updatedAt ?? "",
  };
}

function mapDispatch(dispatch: GatewayDispatchPayload) {
  return {
    id: dispatch.Id ?? dispatch.id ?? 0,
    templateId: dispatch.NotificationTemplateId ?? dispatch.notificationTemplateId ?? 0,
    templateName: dispatch.TemplateName ?? dispatch.templateName ?? "",
    triggeredByActorName: dispatch.TriggeredByActorName ?? dispatch.triggeredByActorName ?? null,
    triggeredByActorEmail: dispatch.TriggeredByActorEmail ?? dispatch.triggeredByActorEmail ?? null,
    cursoIds: dispatch.Filters?.CourseIds ?? dispatch.filters?.courseIds ?? [],
    turmaIds: dispatch.Filters?.ClassIds ?? dispatch.filters?.classIds ?? [],
    alunoIds: dispatch.Filters?.StudentIds ?? dispatch.filters?.studentIds ?? [],
    totalRecipients: dispatch.TotalRecipients ?? dispatch.totalRecipients ?? 0,
    failedRecipients: dispatch.FailedRecipients ?? dispatch.failedRecipients ?? 0,
    createdAt: dispatch.CreatedAt ?? dispatch.createdAt ?? "",
  };
}

function extractTemplateContextRequirements(template: {
  tituloTemplate: string;
  mensagemTemplate: string;
}) {
  const matches = `${template.tituloTemplate}\n${template.mensagemTemplate}`.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g);
  let requiresCurso = false;
  let requiresTurma = false;

  for (const match of matches) {
    const expression = (match[1] ?? "").trim().toLowerCase();
    if (!expression) continue;

    const root = expression.split(".")[0]?.trim();
    if (root === "curso" || root === "course") {
      requiresCurso = true;
    }
    if (root === "turma" || root === "class") {
      requiresTurma = true;
    }
  }

  return {
    requiresCurso,
    requiresTurma,
  };
}

async function loadTemplateForDispatch(templateId: number) {
  const response = await callGateway<GatewayTemplatePayload[]>("/api/Notification/Admin/Templates");
  if (!response.Success) {
    throw new Error(response.Errors?.[0] ?? "Erro ao carregar template para disparo");
  }

  const template = (response.Result ?? [])
    .map(mapTemplate)
    .find((item) => item.id === templateId);

  if (!template) {
    throw new Error("Template nao encontrado");
  }

  return template;
}

async function resolveTargetUserIds(filters: DispatchFilterPayload) {
  const userIds = new Set<number>();

  for (const userId of filters.alunoIds) {
    if (Number.isInteger(userId) && userId > 0) {
      userIds.add(userId);
    }
  }

  if (filters.turmaIds.length > 0) {
    const turmaRecipients = await pool.query<{ user_id: number }>(
      `SELECT DISTINCT e.user_id
       FROM enrollment e
       WHERE e.class_id = ANY($1::int[])`,
      [filters.turmaIds]
    );

    for (const row of turmaRecipients.rows) {
      userIds.add(row.user_id);
    }
  }

  if (filters.cursoIds.length > 0) {
    const cursoRecipients = await pool.query<{ user_id: number }>(
      `SELECT DISTINCT e.user_id
       FROM enrollment e
       JOIN class c ON c.id = e.class_id
       WHERE c.course_id = ANY($1::int[])`,
      [filters.cursoIds]
    );

    for (const row of cursoRecipients.rows) {
      userIds.add(row.user_id);
    }
  }

  return Array.from(userIds);
}

async function filterRecipientsByTemplateContext(
  recipientIds: number[],
  requirements: { requiresCurso: boolean; requiresTurma: boolean }
) {
  if (recipientIds.length === 0) {
    return [];
  }

  if (!requirements.requiresCurso && !requirements.requiresTurma) {
    return recipientIds;
  }

  const recipients = await pool.query<RecipientContextRow>(
    `SELECT
       u.id,
       EXISTS(
         SELECT 1
         FROM enrollment e
         WHERE e.user_id = u.id
       ) AS has_turma,
       EXISTS(
         SELECT 1
         FROM enrollment e
         JOIN class c ON c.id = e.class_id
         WHERE e.user_id = u.id
           AND c.course_id IS NOT NULL
       ) AS has_curso
     FROM "user" u
     WHERE u.id = ANY($1::int[])`,
    [recipientIds]
  );

  return recipients.rows
    .filter((row) => {
      if (requirements.requiresTurma && !row.has_turma) {
        return false;
      }
      if (requirements.requiresCurso && !row.has_curso) {
        return false;
      }
      return true;
    })
    .map((row) => row.id);
}

export function notificationsRouter(jwtSecret: string) {
  const router = Router();
  const auth = authOrApiTokenGuard(jwtSecret, pool);
  const requireRead = requireApiTokenScopeIfPresent("notificacoes:read");
  const requireWrite = requireRoleOrApiTokenScope(["admin"], "notificacoes:write");

  router.get(
    "/notifications/me",
    auth,
    requireRead,
    async (req: ApiTokenAuthRequest, res) => {
      const parsedQuery = myNotificationsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({ message: "Parametros invalidos para listagem de notificacoes" });
      }

      const userId = Number(req.user?.sub);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "Usuario autenticado invalido" });
      }

      try {
        const { limit, offset, status } = parsedQuery.data;
        const statusCondition =
          status === "read"
            ? "AND read_at IS NOT NULL"
            : status === "unread"
            ? "AND read_at IS NULL"
            : "";
        const [itemsResult, totalResult, unreadResult] = await Promise.all([
          pool.query<NotificationRow>(
            `SELECT id, user_id, title, message, metadata_json, read_at, created_at
             FROM notification
             WHERE user_id = $1
             ${statusCondition}
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
          ),
          pool.query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM notification
             WHERE user_id = $1
             ${statusCondition}`,
            [userId]
          ),
          pool.query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM notification
             WHERE user_id = $1
               AND read_at IS NULL`,
            [userId]
          ),
        ]);

        const total = Number(totalResult.rows[0]?.total ?? "0");
        const unreadCount = Number(unreadResult.rows[0]?.total ?? "0");

        return res.json({
          items: itemsResult.rows.map((row) => ({
            id: row.id,
            title: row.title,
            message: row.message,
            metadataJson: row.metadata_json,
            readAt: row.read_at,
            createdAt: row.created_at,
          })),
          unreadCount,
          total,
          pagination: {
            page: Math.floor(offset / limit) + 1,
            limit,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / limit),
          },
        });
      } catch (error) {
        console.error("Erro ao listar notificacoes do usuario:", error);
        return res.status(500).json({ message: "Erro ao listar notificacoes do usuario" });
      }
    }
  );

  router.patch(
    "/notifications/read-all",
    auth,
    requireWrite,
    async (req: ApiTokenAuthRequest, res) => {
      const userId = Number(req.user?.sub);

      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "Usuario autenticado invalido" });
      }

      try {
        const result = await pool.query<{ id: number }>(
          `UPDATE notification
           SET read_at = NOW()
           WHERE user_id = $1
             AND read_at IS NULL
           RETURNING id`,
          [userId]
        );

        return res.json({
          updatedCount: result.rowCount ?? 0,
          markedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Erro ao marcar todas notificacoes como lidas:", error);
        return res.status(500).json({ message: "Erro ao marcar todas notificacoes como lidas" });
      }
    }
  );

  router.patch(
    "/notifications/:id/read",
    auth,
    requireWrite,
    async (req: ApiTokenAuthRequest, res) => {
      const notificationId = Number(req.params.id);
      const userId = Number(req.user?.sub);

      if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({ message: "ID invalido" });
      }

      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "Usuario autenticado invalido" });
      }

      try {
        const result = await pool.query<NotificationRow>(
          `UPDATE notification
           SET read_at = COALESCE(read_at, NOW())
           WHERE id = $1
             AND user_id = $2
           RETURNING id, user_id, title, message, metadata_json, read_at, created_at`,
          [notificationId, userId]
        );

        if (!result.rowCount) {
          return res.status(404).json({ message: "Notificacao nao encontrada" });
        }

        const row = result.rows[0];
        return res.json({
          notification: {
            id: row.id,
            title: row.title,
            message: row.message,
            metadataJson: row.metadata_json,
            readAt: row.read_at,
            createdAt: row.created_at,
          },
        });
      } catch (error) {
        console.error("Erro ao marcar notificacao como lida:", error);
        return res.status(500).json({ message: "Erro ao marcar notificacao como lida" });
      }
    }
  );

  router.get(
    "/notifications/templates",
    auth,
    requireRead,
    async (_req: ApiTokenAuthRequest, res) => {
      try {
        const response = await callGateway<GatewayTemplate[]>("/api/Notification/Admin/Templates");
        if (!response.Success) {
          return res.status(502).json({ message: response.Errors?.[0] ?? "Erro ao listar templates" });
        }

        return res.json({
          items: (response.Result ?? []).map(mapTemplate),
        });
      } catch (error) {
        console.error("Erro ao listar templates de Notificação:", error);
        return res.status(500).json({ message: "Erro ao listar templates de Notificação" });
      }
    }
  );

  router.post(
    "/notifications/templates",
    auth,
    requireWrite,
    async (req: ApiTokenAuthRequest, res) => {
      const parsed = templateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      try {
        const actor = await resolveActor(req);
        const response = await callGateway<GatewayTemplate>("/api/Notification/Admin/Templates", {
          method: "POST",
          body: JSON.stringify({
            name: parsed.data.nome,
            titleTemplate: parsed.data.tituloTemplate,
            messageTemplate: parsed.data.mensagemTemplate,
            isActive: parsed.data.ativo,
            actor,
          }),
        });

        if (!response.Success || !response.Result) {
          return res.status(400).json({ message: response.Errors?.[0] ?? "Erro ao criar template" });
        }

        return res.status(201).json({
          template: mapTemplate(response.Result),
        });
      } catch (error) {
        console.error("Erro ao criar template de Notificação:", error);
        return res.status(500).json({ message: "Erro ao criar template de Notificação" });
      }
    }
  );

  router.put(
    "/notifications/templates/:id",
    auth,
    requireWrite,
    async (req: ApiTokenAuthRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "ID invalido" });
      }

      const parsed = templateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      try {
        const actor = await resolveActor(req);
        const response = await callGateway<GatewayTemplate>(`/api/Notification/Admin/Templates/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: parsed.data.nome,
            titleTemplate: parsed.data.tituloTemplate,
            messageTemplate: parsed.data.mensagemTemplate,
            isActive: parsed.data.ativo,
            actor,
          }),
        });

        if (!response.Success || !response.Result) {
          return res.status(400).json({ message: response.Errors?.[0] ?? "Erro ao atualizar template" });
        }

        return res.json({
          template: mapTemplate(response.Result),
        });
      } catch (error) {
        console.error("Erro ao atualizar template de Notificação:", error);
        return res.status(500).json({ message: "Erro ao atualizar template de Notificação" });
      }
    }
  );

  router.delete(
    "/notifications/templates/:id",
    auth,
    requireWrite,
    async (req: ApiTokenAuthRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "ID invalido" });
      }

      try {
        const actor = await resolveActor(req);
        const response = await callGateway<unknown>(`/api/Notification/Admin/Templates/${id}`, {
          method: "DELETE",
          body: JSON.stringify({ actor }),
        });

        if (!response.Success) {
          return res.status(400).json({ message: response.Errors?.[0] ?? "Erro ao excluir template" });
        }

        return res.json({ success: true });
      } catch (error) {
        console.error("Erro ao excluir template de Notificação:", error);
        return res.status(500).json({ message: "Erro ao excluir template de Notificação" });
      }
    }
  );

  router.get(
    "/notifications/dispatches",
    auth,
    requireRead,
    async (req: ApiTokenAuthRequest, res) => {
      const parsedQuery = dispatchListQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({ message: "Parametros invalidos para listagem de disparos" });
      }

      try {
        const query = new URLSearchParams({
          limit: String(parsedQuery.data.limit),
          offset: String(parsedQuery.data.offset),
        });

        if (parsedQuery.data.q) {
          query.set("q", parsedQuery.data.q);
        }

        const response = await callGateway<GatewayDispatch[]>(`/api/Notification/Admin/Dispatches?${query.toString()}`);
        if (!response.Success) {
          return res.status(502).json({ message: response.Errors?.[0] ?? "Erro ao listar disparos" });
        }
        const items = (response.Result ?? []).map(mapDispatch);
        const total = response.TotalRows ?? items.length;

        return res.json({
          items,
          total,
          pagination: {
            page: Math.floor(parsedQuery.data.offset / parsedQuery.data.limit) + 1,
            limit: parsedQuery.data.limit,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / parsedQuery.data.limit),
          },
        });
      } catch (error) {
        console.error("Erro ao listar disparos de Notificação:", error);
        return res.status(500).json({ message: "Erro ao listar disparos de Notificação" });
      }
    }
  );

  router.delete(
    "/notifications/dispatches/:id",
    auth,
    requireWrite,
    async (req: ApiTokenAuthRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "ID invalido" });
      }

      try {
        const actor = await resolveActor(req);
        const response = await callGateway<unknown>(`/api/Notification/Admin/Dispatches/${id}`, {
          method: "DELETE",
          body: JSON.stringify({ actor }),
        });

        if (!response.Success) {
          return res.status(400).json({ message: response.Errors?.[0] ?? "Erro ao excluir disparo" });
        }

        return res.json({ success: true });
      } catch (error) {
        console.error("Erro ao excluir disparo de Notificação:", error);
        return res.status(500).json({ message: "Erro ao excluir disparo de Notificação" });
      }
    }
  );

  router.post(
    "/notifications/templates/:id/dispatch",
    auth,
    requireWrite,
    async (req: ApiTokenAuthRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "ID invalido" });
      }

      const parsed = dispatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invalidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      try {
        const actor = await resolveActor(req);
        const template = await loadTemplateForDispatch(id);
        const templateRequirements = extractTemplateContextRequirements(template);
        const needsContextFiltering =
          templateRequirements.requiresCurso || templateRequirements.requiresTurma;
        const recipientIds = needsContextFiltering
          ? await resolveTargetUserIds(parsed.data)
          : [];
        const eligibleRecipientIds = needsContextFiltering
          ? await filterRecipientsByTemplateContext(recipientIds, templateRequirements)
          : [];

        if (needsContextFiltering && eligibleRecipientIds.length === 0) {
          return res.status(400).json({
            message:
              "Nenhum destinatario elegivel encontrado para os placeholders usados no template.",
          });
        }

        const response = await callGateway<{
          DispatchId?: number;
          dispatchId?: number;
          NotificationTemplateId?: number;
          notificationTemplateId?: number;
          TemplateName?: string;
          templateName?: string;
          TotalRecipients?: number;
          totalRecipients?: number;
          FailedRecipients?: number;
          failedRecipients?: number;
          CreatedAt?: string;
          createdAt?: string;
        }>(`/api/Notification/Admin/Templates/${id}/Dispatch`, {
          method: "POST",
          body: JSON.stringify({
            filters: {
              courseIds: needsContextFiltering ? [] : parsed.data.cursoIds,
              classIds: needsContextFiltering ? [] : parsed.data.turmaIds,
              studentIds: needsContextFiltering ? eligibleRecipientIds : parsed.data.alunoIds,
            },
            actor,
          }),
        });

        if (!response.Success || !response.Result) {
          return res.status(400).json({ message: response.Errors?.[0] ?? "Erro ao disparar Notificação" });
        }

        return res.json({
          dispatch: {
            id: response.Result.DispatchId ?? response.Result.dispatchId ?? 0,
            templateId:
              response.Result.NotificationTemplateId ?? response.Result.notificationTemplateId ?? 0,
            templateName: response.Result.TemplateName ?? response.Result.templateName ?? "",
            totalRecipients: response.Result.TotalRecipients ?? response.Result.totalRecipients ?? 0,
            failedRecipients:
              response.Result.FailedRecipients ?? response.Result.failedRecipients ?? 0,
            createdAt: response.Result.CreatedAt ?? response.Result.createdAt ?? "",
          },
        });
      } catch (error) {
        console.error("Erro ao disparar Notificação:", error);
        return res.status(500).json({ message: "Erro ao disparar Notificação" });
      }
    }
  );

  return router;
}
