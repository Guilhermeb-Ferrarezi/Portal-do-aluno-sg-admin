import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export type DbLike = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{
    rowCount?: number | null;
    rows: T[];
  }>;
};

export type AiThreadRow = {
  id: number;
  user_id: number;
  title: string;
  summary: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMessageRow = {
  id: number;
  thread_id: number;
  run_id: number | null;
  role: string;
  content: string;
  metadata_json: string | null;
  created_at: string;
};

export type AiRunRow = {
  id: number;
  thread_id: number;
  prompt_message_id: number | null;
  status: string;
  model: string | null;
  prompt_context_json: string | null;
  exit_code: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiEventRow = {
  id: number;
  run_id: number;
  thread_id: number;
  kind: string;
  payload_json: string;
  created_at: string;
};

export type AiThreadSummary = {
  id: number;
  title: string;
  summary: string | null;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiThreadMessage = {
  id: number;
  threadId: number;
  runId: number | null;
  role: "user" | "assistant" | "system" | "tool" | string;
  content: string;
  metadata: unknown;
  createdAt: string;
};

export type AiThreadRun = {
  id: number;
  threadId: number;
  promptMessageId: number | null;
  status: string;
  model: string | null;
  promptContext: unknown;
  exitCode: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiThreadDetail = {
  thread: AiThreadSummary;
  messages: AiThreadMessage[];
  runs: AiThreadRun[];
};

export type AiSendMessageResult = {
  thread: AiThreadSummary;
  userMessage: AiThreadMessage;
  assistantMessage: AiThreadMessage | null;
  run: AiThreadRun;
  events: Array<{ kind: string; payload: unknown; createdAt: string }>;
  interrupted: boolean;
};

export type CodexRunnerResult = {
  stdout: string;
  stderr: string;
  lastMessage: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  rawLines: string[];
};

export type CodexRunnerOptions = {
  cwd: string;
  signal?: AbortSignal;
  promptLabel?: string;
};

export type CodexRunner = (prompt: string, options: CodexRunnerOptions) => Promise<CodexRunnerResult>;

export type AiChatServiceOptions = {
  db?: DbLike;
  workspaceRoot?: string;
  codexBin?: string;
  runner?: CodexRunner;
};

type RunHandle = {
  controller: AbortController;
};

const DEFAULT_SYSTEM_PROMPT = [
  "Voce e o assistente interno de IA do painel administrativo do Portal do Aluno.",
  "Responda em portugues do Brasil, com objetividade e contexto suficiente para um admin agir.",
  "Se a resposta envolver uma acao sobre o projeto, explique os proximos passos de forma pratica.",
  "Nao invente fatos; quando faltar contexto, diga o que precisa ser verificado.",
].join(" ");

function resolveWorkspaceRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === "api" ? path.resolve(cwd, "..") : cwd;
}

function resolveCodexBin() {
  return process.env.CODEX_BIN?.trim() || "codex";
}

function shouldBypassSandbox() {
  const raw = process.env.CODEX_DANGEROUSLY_BYPASS_APPROVALS_AND_SANDBOX?.trim();
  if (!raw) {
    return false;
  }

  return /^(1|true|yes)$/i.test(raw);
}

function safeJsonParse(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function mapThread(row: AiThreadRow): AiThreadSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: AiMessageRow): AiThreadMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    runId: row.run_id,
    role: row.role,
    content: row.content,
    metadata: safeJsonParse(row.metadata_json),
    createdAt: row.created_at,
  };
}

function mapRun(row: AiRunRow): AiThreadRun {
  return {
    id: row.id,
    threadId: row.thread_id,
    promptMessageId: row.prompt_message_id,
    status: row.status,
    model: row.model,
    promptContext: safeJsonParse(row.prompt_context_json),
    exitCode: row.exit_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRole(role: string) {
  if (role === "assistant" || role === "system" || role === "tool" || role === "user") {
    return role;
  }

  return "system";
}

function truncate(value: string, max = 160) {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function buildPrompt(
  messages: Array<Pick<AiThreadMessage, "role" | "content">>,
  context?: { pathname?: string | null; pageTitle?: string | null; pageSubtitle?: string | null }
) {
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content.trim()}`)
    .join("\n\n");

  const contextLines = [
    `Pagina atual: ${context?.pageTitle?.trim() || "Painel admin"}`,
    context?.pathname?.trim() ? `Route: ${context.pathname.trim()}` : null,
    context?.pageSubtitle?.trim() ? `Subtitulo: ${context.pageSubtitle.trim()}` : null,
  ].filter((line): line is string => Boolean(line));

  return [
    DEFAULT_SYSTEM_PROMPT,
    contextLines.length > 0 ? `Contexto atual:\n${contextLines.join("\n")}` : null,
    transcript.length > 0 ? `Historico da conversa:\n${transcript}` : null,
    "Responda ao ultimo pedido do usuario. Se houver necessidade de analise no codigo, descreva o que faria e quais pontos verificar.",
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

function extractLastAssistantMessage(messages: AiThreadMessage[], fallback: string) {
  const assistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  return truncate(assistantMessage?.content || fallback || "Resposta vazia", 180);
}

async function runCodexCli(
  prompt: string,
  options: CodexRunnerOptions & { codexBin?: string; bypassSandbox?: boolean }
): Promise<CodexRunnerResult> {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "admin-ai-"));
  const outputPath = path.join(outputDir, "last-message.txt");
  const args = [
    "exec",
    "--json",
    "--output-last-message",
    outputPath,
    "--cd",
    options.cwd,
    "--skip-git-repo-check",
  ];

  if (options.bypassSandbox) {
    args.unshift("--dangerously-bypass-approvals-and-sandbox");
  }

  const child = spawn(options.codexBin || resolveCodexBin(), args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      CODEX_WORKSPACE_ROOT: options.cwd,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  const rawLines: string[] = [];

  const closeWithAbort = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 3_000).unref();
    }
  };

  if (options.signal) {
    if (options.signal.aborted) {
      closeWithAbort();
    } else {
      options.signal.addEventListener("abort", closeWithAbort, { once: true });
    }
  }

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdout += text;

    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) {
        rawLines.push(line.trim());
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.stdin.end(`${prompt}\n`);

  const completion = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });

  const lastMessage = await fs.readFile(outputPath, "utf8").catch(() => "");

  return {
    stdout,
    stderr,
    lastMessage: lastMessage.trim() || stdout.trim(),
    exitCode: completion.code,
    signal: completion.signal,
    rawLines,
  };
}

function buildEventPayload(kind: string, payload: unknown) {
  return {
    kind,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createAiChatService(options: AiChatServiceOptions = {}) {
  const db = options.db;
  if (!db) {
    throw new Error("Database nao configurado para IA.");
  }
  const database = db as DbLike;

  const workspaceRoot = options.workspaceRoot ?? resolveWorkspaceRoot();
  const codexBin = options.codexBin ?? resolveCodexBin();
  const runner = options.runner ?? ((prompt, runnerOptions) =>
    runCodexCli(prompt, {
      ...runnerOptions,
      codexBin,
      bypassSandbox: shouldBypassSandbox(),
    }));
  const activeRuns = new Map<number, RunHandle>();

  async function assertThreadBelongsToUser(userId: number, threadId: number) {
    const result = await database.query<AiThreadRow>(
      `SELECT id, user_id, title, summary, status, last_message_at, created_at, updated_at
       FROM ai_threads
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [threadId, userId]
    );

    const thread = result.rows[0];
    if (!thread) {
      throw new Error("Thread nao encontrada.");
    }

    return thread;
  }

  async function getLatestRun(threadId: number) {
    const result = await database.query<AiRunRow>(
      `SELECT id, thread_id, prompt_message_id, status, model, prompt_context_json, exit_code, error_message, started_at, completed_at, created_at, updated_at
       FROM ai_runs
       WHERE thread_id = $1
       ORDER BY started_at DESC, id DESC
       LIMIT 1`,
      [threadId]
    );

    return result.rows[0] ? mapRun(result.rows[0]) : null;
  }

  async function listRuns(threadId: number) {
    const result = await database.query<AiRunRow>(
      `SELECT id, thread_id, prompt_message_id, status, model, prompt_context_json, exit_code, error_message, started_at, completed_at, created_at, updated_at
       FROM ai_runs
       WHERE thread_id = $1
       ORDER BY started_at ASC, id ASC`,
      [threadId]
    );

    return result.rows.map(mapRun);
  }

  async function listMessages(threadId: number) {
    const result = await database.query<AiMessageRow>(
      `SELECT id, thread_id, run_id, role, content, metadata_json, created_at
       FROM ai_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC, id ASC`,
      [threadId]
    );

    return result.rows.map(mapMessage);
  }

  async function listThreadEvents(threadId: number) {
    const result = await database.query<AiEventRow>(
      `SELECT id, run_id, thread_id, kind, payload_json, created_at
       FROM ai_events
       WHERE thread_id = $1
       ORDER BY created_at ASC, id ASC
       LIMIT 200`,
      [threadId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      threadId: row.thread_id,
      kind: row.kind,
      payload: safeJsonParse(row.payload_json),
      createdAt: row.created_at,
    }));
  }

  async function updateThread(
    threadId: number,
    patch: {
      title?: string | null;
      summary?: string | null;
      status?: string | null;
      last_message_at?: string | null;
    }
  ) {
    const result = await database.query<AiThreadRow>(
      `UPDATE ai_threads
       SET title = COALESCE($1, title),
           summary = COALESCE($2, summary),
           status = COALESCE($3, status),
           last_message_at = COALESCE($4, last_message_at),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, user_id, title, summary, status, last_message_at, created_at, updated_at`,
      [
        patch.title ?? null,
        patch.summary ?? null,
        patch.status ?? null,
        patch.last_message_at ?? null,
        threadId,
      ]
    );

    return result.rows[0] ? mapThread(result.rows[0]) : null;
  }

  async function persistEvent(runId: number, threadId: number, kind: string, payload: unknown) {
    await database.query(
      `INSERT INTO ai_events (run_id, thread_id, kind, payload_json, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [runId, threadId, kind, JSON.stringify(payload ?? null)]
    );
  }

  async function createThread(userId: number, title = "Nova conversa") {
    const reusableDraft = await database.query<AiThreadRow>(
      `SELECT t.id, t.user_id, t.title, t.summary, t.status, t.last_message_at, t.created_at, t.updated_at
       FROM ai_threads t
       WHERE t.user_id = $1
         AND t.title = 'Nova conversa'
         AND t.status = 'idle'
         AND t.last_message_at IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM ai_messages m
           WHERE m.thread_id = t.id
         )
       ORDER BY t.updated_at DESC, t.id DESC
       LIMIT 1`,
      [userId]
    );

    const reusableThread = reusableDraft.rows[0];
    if (reusableThread) {
      return mapThread(reusableThread);
    }

    const result = await database.query<AiThreadRow>(
      `INSERT INTO ai_threads (user_id, title, summary, status, last_message_at, created_at, updated_at)
       VALUES ($1, $2, NULL, 'idle', NULL, NOW(), NOW())
       RETURNING id, user_id, title, summary, status, last_message_at, created_at, updated_at`,
      [userId, truncate(title, 120)]
    );

    const thread = result.rows[0];
    if (!thread) {
      throw new Error("Nao foi possivel criar a conversa.");
    }

    return mapThread(thread);
  }

  async function listThreads(userId: number) {
    const result = await database.query<AiThreadRow>(
      `SELECT id, user_id, title, summary, status, last_message_at, created_at, updated_at
       FROM ai_threads
       WHERE user_id = $1
       ORDER BY updated_at DESC, id DESC`,
      [userId]
    );

    return result.rows.map(mapThread);
  }

  async function getThread(userId: number, threadId: number) {
    const thread = await assertThreadBelongsToUser(userId, threadId);
    const [messages, runs, events, latestRun] = await Promise.all([
      listMessages(threadId),
      listRuns(threadId),
      listThreadEvents(threadId),
      getLatestRun(threadId),
    ]);

    return {
      thread: mapThread(thread),
      messages,
      runs,
      latestRun,
      events,
    } satisfies AiThreadDetail & { latestRun: AiThreadRun | null; events: unknown[] };
  }

  async function sendMessage(
    userId: number,
    threadId: number,
    content: string,
    context?: { pathname?: string | null; pageTitle?: string | null; pageSubtitle?: string | null },
    signal?: AbortSignal,
  ): Promise<AiSendMessageResult> {
    const thread = await assertThreadBelongsToUser(userId, threadId);
    if (activeRuns.has(threadId)) {
      throw new Error("A conversa ja possui uma geracao em andamento.");
    }

    const userMessageResult = await database.query<AiMessageRow>(
      `INSERT INTO ai_messages (thread_id, run_id, role, content, metadata_json, created_at)
       VALUES ($1, NULL, 'user', $2, $3::jsonb, NOW())
       RETURNING id, thread_id, run_id, role, content, metadata_json, created_at`,
      [threadId, content, JSON.stringify({ context: context ?? null })]
    );

    const userMessage = mapMessage(userMessageResult.rows[0] as AiMessageRow);
    const messagesBeforeRun = await listMessages(threadId);
    const prompt = buildPrompt(
      messagesBeforeRun.map((message) => ({ role: message.role, content: message.content })),
      context
    );

    const runResult = await database.query<AiRunRow>(
      `INSERT INTO ai_runs
         (thread_id, prompt_message_id, status, model, prompt_context_json, exit_code, error_message, started_at, completed_at, created_at, updated_at)
       VALUES ($1, $2, 'running', $3, $4::jsonb, NULL, NULL, NOW(), NULL, NOW(), NOW())
       RETURNING id, thread_id, prompt_message_id, status, model, prompt_context_json, exit_code, error_message, started_at, completed_at, created_at, updated_at`,
      [threadId, userMessage.id, process.env.CODEX_MODEL?.trim() || "codex", JSON.stringify({ context: context ?? null, prompt })]
    );

    const run = mapRun(runResult.rows[0] as AiRunRow);
    activeRuns.set(threadId, { controller: new AbortController() });

    const activeHandle = activeRuns.get(threadId);
    if (!activeHandle) {
      throw new Error("Nao foi possivel iniciar a geracao.");
    }

    const combinedController = new AbortController();
    const forwardAbort = () => combinedController.abort();
    signal?.addEventListener("abort", forwardAbort, { once: true });
    activeHandle.controller = combinedController;

    const events: Array<{ kind: string; payload: unknown; createdAt: string }> = [];
    let assistantMessage: AiThreadMessage | null = null;
    let interrupted = false;

    try {
    const runnerResult = await runner(prompt, {
        cwd: workspaceRoot,
        signal: combinedController.signal,
        promptLabel: truncate(content, 80),
      });

      for (const rawLine of runnerResult.rawLines) {
        let payload: unknown = rawLine;
        let kind = "stdout";

        try {
          payload = JSON.parse(rawLine);
          if (
            payload &&
            typeof payload === "object" &&
            !Array.isArray(payload) &&
            typeof (payload as { type?: unknown }).type === "string"
          ) {
            kind = String((payload as { type: string }).type);
          }
        } catch {
          kind = "stdout";
        }

        const event = buildEventPayload(kind, payload);
        events.push(event);
        await persistEvent(run.id, threadId, kind, payload);
      }

      const assistantContent = truncate(runnerResult.lastMessage || runnerResult.stdout || "Resposta vazia", 4000);
      const assistantMessageResult = await database.query<AiMessageRow>(
        `INSERT INTO ai_messages (thread_id, run_id, role, content, metadata_json, created_at)
         VALUES ($1, $2, 'assistant', $3, $4::jsonb, NOW())
         RETURNING id, thread_id, run_id, role, content, metadata_json, created_at`,
        [
          threadId,
          run.id,
          assistantContent,
          JSON.stringify({
            exitCode: runnerResult.exitCode,
            signal: runnerResult.signal,
            stdout: truncate(runnerResult.stdout, 8000),
            stderr: truncate(runnerResult.stderr, 8000),
          }),
        ]
      );

      assistantMessage = mapMessage(assistantMessageResult.rows[0] as AiMessageRow);

      const nextSummary = extractLastAssistantMessage(
        [userMessage, assistantMessage].filter(Boolean) as AiThreadMessage[],
        assistantContent
      );
      await database.query(
        `UPDATE ai_runs
         SET status = 'completed',
             exit_code = $1,
             error_message = NULL,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [runnerResult.exitCode, run.id]
      );
      const updatedThread = await updateThread(threadId, {
        title: thread.title === "Nova conversa" ? truncate(content, 120) : null,
        summary: nextSummary,
        status: "idle",
        last_message_at: new Date().toISOString(),
      });

      if (!updatedThread) {
        throw new Error("Nao foi possivel atualizar a conversa.");
      }

      return {
        thread: updatedThread,
        userMessage,
        assistantMessage,
        run,
        events,
        interrupted,
      };
    } catch (error) {
      interrupted = combinedController.signal.aborted || (error instanceof Error && /aborted/i.test(error.message));

      await database.query(
        `UPDATE ai_runs
         SET status = $1,
             exit_code = $2,
             error_message = $3,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $4`,
        [
          interrupted ? "interrupted" : "failed",
          null,
          error instanceof Error ? truncate(error.message, 500) : "Falha na execucao",
          run.id,
        ]
      );

      await updateThread(threadId, {
        summary: interrupted ? thread.summary : truncate(error instanceof Error ? error.message : "Falha na execucao", 160),
        status: "idle",
        last_message_at: new Date().toISOString(),
      });

      throw error;
    } finally {
      signal?.removeEventListener("abort", forwardAbort);
      activeRuns.delete(threadId);
    }
  }

  async function interruptThread(userId: number, threadId: number) {
    await assertThreadBelongsToUser(userId, threadId);

    const activeRun = activeRuns.get(threadId);
    if (activeRun) {
      activeRun.controller.abort();
    }

    const latestRunning = await database.query<AiRunRow>(
      `SELECT id, thread_id, prompt_message_id, status, model, prompt_context_json, exit_code, error_message, started_at, completed_at, created_at, updated_at
       FROM ai_runs
       WHERE thread_id = $1 AND status = 'running'
       ORDER BY started_at DESC, id DESC
       LIMIT 1`,
      [threadId]
    );

    const run = latestRunning.rows[0];
    if (!run) {
      return { interrupted: false, message: "Nenhuma geracao em andamento." };
    }

    await database.query(
      `UPDATE ai_runs
       SET status = 'interrupted',
           error_message = 'Interrompido pelo usuario',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [run.id]
    );

    await updateThread(threadId, { status: "idle" });
    return { interrupted: true, message: "Geracao interrompida." };
  }

  return {
    createThread,
    getThread,
    interruptThread,
    listThreads,
    sendMessage,
  };
}
