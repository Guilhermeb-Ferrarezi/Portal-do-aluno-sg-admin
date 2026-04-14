import { Router } from "express";
import { existsSync } from "node:fs";
import { z } from "zod";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";

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
  const baseUrl =
    process.env.NOTIFICATIONS_WILLIAN_API_URL?.trim() ||
    process.env.SSO_HOME_API_URL?.trim();
  const sharedSecret =
    process.env.NOTIFICATIONS_SHARED_SECRET?.trim() ||
    process.env.SSO_SHARED_SECRET?.trim();

  if (!baseUrl || !sharedSecret) {
    return null;
  }

  return {
    baseUrl: normalizeGatewayBaseUrl(baseUrl),
    sharedSecret,
  };
}

async function resolveActor(req: AuthRequest) {
  const userId = Number(req.user?.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    return {
      externalId: req.user?.sub ?? null,
      name: null,
      email: req.user?.usuario ?? null,
    };
  }

  const result = await pool.query<{ id: number; name: string | null; email: string | null }>(
    `SELECT id, name, email
     FROM "user"
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return {
    externalId: req.user?.sub ?? null,
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
      "Configuracao de notificacoes ausente. Defina NOTIFICATIONS_WILLIAN_API_URL e NOTIFICATIONS_SHARED_SECRET."
    );
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
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
        : "Falha na comunicacao com o portal do Willian.";

    return {
      Success: false,
      Errors: [
        `Falha ao conectar com o portal do Willian em ${config.baseUrl}. ${message}`,
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
    return {
      Success: false,
      Errors:
        normalizedResponse?.Errors && normalizedResponse.Errors.length > 0
          ? normalizedResponse.Errors
          : ["Falha na comunicacao com o portal do Willian."],
    };
  }

  return normalizedResponse ?? { Success: false, Errors: ["Resposta invalida do portal do Willian."] };
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

export function notificationsRouter(jwtSecret: string) {
  const router = Router();

  router.get(
    "/notifications/templates",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (_req: AuthRequest, res) => {
      try {
        const response = await callGateway<GatewayTemplate[]>("/api/Notification/Admin/Templates");
        if (!response.Success) {
          return res.status(502).json({ message: response.Errors?.[0] ?? "Erro ao listar templates" });
        }

        return res.json({
          items: (response.Result ?? []).map(mapTemplate),
        });
      } catch (error) {
        console.error("Erro ao listar templates de notificacao:", error);
        return res.status(500).json({ message: "Erro ao listar templates de notificacao" });
      }
    }
  );

  router.post(
    "/notifications/templates",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
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
        console.error("Erro ao criar template de notificacao:", error);
        return res.status(500).json({ message: "Erro ao criar template de notificacao" });
      }
    }
  );

  router.put(
    "/notifications/templates/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
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
        console.error("Erro ao atualizar template de notificacao:", error);
        return res.status(500).json({ message: "Erro ao atualizar template de notificacao" });
      }
    }
  );

  router.delete(
    "/notifications/templates/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
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
        console.error("Erro ao excluir template de notificacao:", error);
        return res.status(500).json({ message: "Erro ao excluir template de notificacao" });
      }
    }
  );

  router.get(
    "/notifications/dispatches",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
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
        console.error("Erro ao listar disparos de notificacao:", error);
        return res.status(500).json({ message: "Erro ao listar disparos de notificacao" });
      }
    }
  );

  router.delete(
    "/notifications/dispatches/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
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
        console.error("Erro ao excluir disparo de notificacao:", error);
        return res.status(500).json({ message: "Erro ao excluir disparo de notificacao" });
      }
    }
  );

  router.post(
    "/notifications/templates/:id/dispatch",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
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
        const response = await callGateway<{
          DispatchId: number;
          NotificationTemplateId: number;
          TemplateName: string;
          TotalRecipients: number;
          FailedRecipients: number;
          CreatedAt: string;
        }>(`/api/Notification/Admin/Templates/${id}/Dispatch`, {
          method: "POST",
          body: JSON.stringify({
            filters: {
              courseIds: parsed.data.cursoIds,
              classIds: parsed.data.turmaIds,
              studentIds: parsed.data.alunoIds,
            },
            actor,
          }),
        });

        if (!response.Success || !response.Result) {
          return res.status(400).json({ message: response.Errors?.[0] ?? "Erro ao disparar notificacao" });
        }

        return res.json({
          dispatch: {
            id: response.Result.DispatchId,
            templateId: response.Result.NotificationTemplateId,
            templateName: response.Result.TemplateName,
            totalRecipients: response.Result.TotalRecipients,
            failedRecipients: response.Result.FailedRecipients,
            createdAt: response.Result.CreatedAt,
          },
        });
      } catch (error) {
        console.error("Erro ao disparar notificacao:", error);
        return res.status(500).json({ message: "Erro ao disparar notificacao" });
      }
    }
  );

  return router;
}
