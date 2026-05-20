import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authGuard, type AuthRequest } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import { createAiChatService, type AiChatServiceOptions } from "../lib/ai-chat";
import { createCodexAuthService, type CodexAuthService } from "../lib/codex-auth";

const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(12000),
  context: z
    .object({
      pathname: z.string().trim().max(500).nullable().optional(),
      pageTitle: z.string().trim().max(200).nullable().optional(),
      pageSubtitle: z.string().trim().max(300).nullable().optional(),
      mode: z.enum(["ask", "edit"]).optional(),
    })
    .optional(),
});

function resolveUserId(req: AuthRequest) {
  const userId = Number(req.user?.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Usuario invalido.");
  }
  return userId;
}

export function aiRouter(
  jwtSecret: string,
  options?: AiChatServiceOptions & { db?: AiChatServiceOptions["db"]; codexAuth?: CodexAuthService }
) {
  const router = Router();
  const service = createAiChatService({
    db: options?.db ?? pool,
    workspaceRoot: options?.workspaceRoot,
    codexBin: options?.codexBin,
    runner: options?.runner,
  });
  const codexAuth = options?.codexAuth ?? createCodexAuthService();

  router.use(authGuard(jwtSecret), requireRole(["admin"]));

  router.get("/ai/codex/login/status", async (_req, res) => {
    try {
      const status = await codexAuth.getLoginStatus();
      return res.json(status);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Falha ao verificar login do Codex.",
      });
    }
  });

  router.post("/ai/codex/login/device", async (_req, res) => {
    try {
      const deviceAuth = await codexAuth.startDeviceAuth();
      return res.json({
        authenticated: false,
        message: "Device auth iniciado.",
        deviceAuth,
      });
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Falha ao iniciar device auth.",
      });
    }
  });

  router.get("/ai/threads", async (req: AuthRequest, res) => {
    try {
      const userId = resolveUserId(req);
      const threads = await service.listThreads(userId);
      return res.json({ items: threads, total: threads.length });
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Falha ao listar conversas.",
      });
    }
  });

  router.post("/ai/threads", async (req: AuthRequest, res) => {
    const parsed = createThreadSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "Requisicao invalida.",
      });
    }

    try {
      const userId = resolveUserId(req);
      const thread = await service.createThread(userId, parsed.data.title);
      return res.status(201).json({ thread });
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Falha ao criar conversa.",
      });
    }
  });

  router.get("/ai/threads/:threadId", async (req: AuthRequest, res) => {
    try {
      const userId = resolveUserId(req);
      const threadId = Number(req.params.threadId);
      if (!Number.isFinite(threadId) || threadId <= 0) {
        return res.status(400).json({ message: "Thread invalida." });
      }

      const detail = await service.getThread(userId, threadId);
      return res.json(detail);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar conversa.";
      const status = message.includes("nao encontrada") ? 404 : 400;
      return res.status(status).json({ message });
    }
  });

  router.post("/ai/threads/:threadId/messages", async (req: AuthRequest, res) => {
    const parsed = sendMessageSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "Requisicao invalida.",
      });
    }

    try {
      const userId = resolveUserId(req);
      const threadId = Number(req.params.threadId);
      if (!Number.isFinite(threadId) || threadId <= 0) {
        return res.status(400).json({ message: "Thread invalida." });
      }

      const controller = new AbortController();
      const abort = () => controller.abort();
      req.on("close", abort);
      req.on("aborted", abort);

      try {
        const result = await service.sendMessage(
          userId,
          threadId,
          parsed.data.content,
          parsed.data.context,
          controller.signal
        );

        return res.json({
          thread: result.thread,
          userMessage: result.userMessage,
          assistantMessage: result.assistantMessage,
          run: result.run,
          events: result.events,
          interrupted: result.interrupted,
        });
      } finally {
        req.off("close", abort);
        req.off("aborted", abort);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar mensagem.";
      const status = message.includes("em andamento") ? 409 : 400;
      return res.status(status).json({ message });
    }
  });

  router.post("/ai/threads/:threadId/interrupt", async (req: AuthRequest, res) => {
    try {
      const userId = resolveUserId(req);
      const threadId = Number(req.params.threadId);
      if (!Number.isFinite(threadId) || threadId <= 0) {
        return res.status(400).json({ message: "Thread invalida." });
      }

      const result = await service.interruptThread(userId, threadId);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Falha ao interromper.",
      });
    }
  });

  return router;
}
