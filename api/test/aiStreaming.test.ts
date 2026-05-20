import { describe, expect, it } from "bun:test";
import { createAiChatService, type DbLike } from "../src/lib/ai-chat";

type StoredThread = {
  id: number;
  user_id: number;
  title: string;
  summary: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type StoredMessage = {
  id: number;
  thread_id: number;
  run_id: number | null;
  role: string;
  content: string;
  metadata_json: string | null;
  created_at: string;
};

type StoredRun = {
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

type StoredToken = {
  public_id: string;
  user_id: number;
  name: string;
  description: string | null;
  scopes: string[];
  kind: "integration" | "codex";
  codex_version: number;
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

class MockDb implements DbLike {
  nextThreadId = 1;
  nextMessageId = 1;
  nextRunId = 1;
  nextEventId = 1;
  threads = new Map<number, StoredThread>();
  messages: StoredMessage[] = [];
  runs: StoredRun[] = [];
  events: Array<{ id: number; run_id: number; thread_id: number; kind: string; payload_json: string; created_at: string }> = [];
  tokens = new Map<string, StoredToken>();

  private now = "2026-05-19T15:30:00.000Z";

  async query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
    const sql = text.replace(/\s+/g, " ").trim();

    if (sql.includes("FROM api_tokens") && sql.includes("= 'codex'") && sql.includes("WHERE user_id = $1")) {
      const userId = Number(params[0]);
      const rows = Array.from(this.tokens.values()).filter((token) => token.user_id === userId && token.kind === "codex");
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("INSERT INTO api_tokens")) {
      const row: StoredToken = {
        public_id: String(params[0]),
        user_id: Number(params[1]),
        name: String(params[2]),
        description: params[3] === null ? null : String(params[3]),
        scopes: JSON.parse(String(params[4])) as string[],
        kind: sql.includes("'codex'") ? "codex" : "integration",
        token_hash: String(params[5]),
        codex_version: Number(params[6]) || 1,
        expires_at: null,
        revoked_at: null,
        last_used_at: null,
        created_at: this.now,
      };
      this.tokens.set(row.public_id, row);
      return { rowCount: 1, rows: [row] as T[] };
    }

    if (sql.includes("INSERT INTO ai_threads")) {
      const row: StoredThread = {
        id: this.nextThreadId++,
        user_id: Number(params[0]),
        title: String(params[1]),
        summary: null,
        status: "idle",
        last_message_at: null,
        created_at: this.now,
        updated_at: this.now,
      };
      this.threads.set(row.id, row);
      return { rowCount: 1, rows: [row] as T[] };
    }

    if (sql.includes("SELECT t.id, t.user_id, t.title, t.summary, t.status, t.last_message_at, t.created_at, t.updated_at FROM ai_threads t WHERE t.user_id = $1 AND t.title = 'Nova conversa'")) {
      return { rowCount: 0, rows: [] as T[] };
    }

    if (sql.includes("SELECT id, user_id, title, summary, status, last_message_at, created_at, updated_at FROM ai_threads WHERE user_id = $1 ORDER BY updated_at DESC, id DESC")) {
      const userId = Number(params[0]);
      const rows = [...this.threads.values()].filter((thread) => thread.user_id === userId);
      rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("SELECT id, user_id, title, summary, status, last_message_at, created_at, updated_at FROM ai_threads WHERE id = $1 AND user_id = $2")) {
      const id = Number(params[0]);
      const userId = Number(params[1]);
      const thread = this.threads.get(id);
      const rows = thread && thread.user_id === userId ? [thread] : [];
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("UPDATE ai_threads") && sql.includes("RETURNING id, user_id, title, summary, status, last_message_at, created_at, updated_at")) {
      const id = Number(params[4]);
      const thread = this.threads.get(id);
      if (!thread) {
        return { rowCount: 0, rows: [] as T[] };
      }
      if (params[0] !== null && params[0] !== undefined) thread.title = String(params[0]);
      if (params[1] !== null && params[1] !== undefined) thread.summary = String(params[1]);
      if (params[2] !== null && params[2] !== undefined) thread.status = String(params[2]);
      if (params[3] !== null && params[3] !== undefined) thread.last_message_at = String(params[3]);
      thread.updated_at = this.now;
      return { rowCount: 1, rows: [thread] as T[] };
    }

    if (sql.includes("INSERT INTO ai_messages") && sql.includes("'user'")) {
      const row: StoredMessage = {
        id: this.nextMessageId++,
        thread_id: Number(params[0]),
        run_id: null,
        role: "user",
        content: String(params[1]),
        metadata_json: String(params[2]),
        created_at: this.now,
      };
      this.messages.push(row);
      return { rowCount: 1, rows: [row] as T[] };
    }

    if (sql.includes("INSERT INTO ai_messages") && sql.includes("'assistant'")) {
      const row: StoredMessage = {
        id: this.nextMessageId++,
        thread_id: Number(params[0]),
        run_id: params[1] === null ? null : Number(params[1]),
        role: "assistant",
        content: String(params[2]),
        metadata_json: String(params[3]),
        created_at: this.now,
      };
      this.messages.push(row);
      return { rowCount: 1, rows: [row] as T[] };
    }

    if (sql.includes("UPDATE ai_messages") && sql.includes("SET content = $1")) {
      const id = Number(params[2]);
      const message = this.messages.find((item) => item.id === id);
      if (!message) {
        return { rowCount: 0, rows: [] as T[] };
      }
      message.content = String(params[0]);
      message.metadata_json = String(params[1]);
      return { rowCount: 1, rows: [message] as T[] };
    }

    if (sql.includes("UPDATE ai_messages") && sql.includes("SET run_id = $1")) {
      const id = Number(params[3]);
      const message = this.messages.find((item) => item.id === id);
      if (!message) {
        return { rowCount: 0, rows: [] as T[] };
      }
      message.run_id = Number(params[0]);
      message.content = String(params[1]);
      message.metadata_json = String(params[2]);
      return { rowCount: 1, rows: [message] as T[] };
    }

    if (sql.includes("FROM ai_messages") && sql.includes("WHERE thread_id = $1 ORDER BY created_at ASC, id ASC")) {
      const threadId = Number(params[0]);
      const rows = this.messages.filter((message) => message.thread_id === threadId);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("INSERT INTO ai_runs")) {
      const row: StoredRun = {
        id: this.nextRunId++,
        thread_id: Number(params[0]),
        prompt_message_id: params[1] === null ? null : Number(params[1]),
        status: "running",
        model: params[2] === null ? null : String(params[2]),
        prompt_context_json: String(params[3]),
        exit_code: null,
        error_message: null,
        started_at: this.now,
        completed_at: null,
        created_at: this.now,
        updated_at: this.now,
      };
      this.runs.push(row);
      return { rowCount: 1, rows: [row] as T[] };
    }

    if (sql.includes("FROM ai_runs") && sql.includes("ORDER BY started_at DESC, id DESC LIMIT 1")) {
      const threadId = Number(params[0]);
      const rows = [...this.runs]
        .filter((run) => run.thread_id === threadId && run.status === "running")
        .sort((a, b) => b.started_at.localeCompare(a.started_at) || b.id - a.id)
        .slice(0, 1);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("FROM ai_runs") && sql.includes("ORDER BY started_at ASC, id ASC")) {
      const threadId = Number(params[0]);
      const rows = this.runs.filter((run) => run.thread_id === threadId);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("SELECT id, run_id, thread_id, kind, payload_json, created_at FROM ai_events")) {
      const threadId = Number(params[0]);
      const rows = this.events.filter((event) => event.thread_id === threadId);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("INSERT INTO ai_events")) {
      const row = {
        id: this.nextEventId++,
        run_id: Number(params[0]),
        thread_id: Number(params[1]),
        kind: String(params[2]),
        payload_json: String(params[3]),
        created_at: this.now,
      };
      this.events.push(row);
      return { rowCount: 1, rows: [] as T[] };
    }

    if (sql.includes("UPDATE ai_runs") && sql.includes("status = 'completed'")) {
      const id = Number(params[1]);
      const run = this.runs.find((item) => item.id === id);
      if (!run) {
        return { rowCount: 0, rows: [] as T[] };
      }
      run.status = "completed";
      run.exit_code = params[0] === null ? null : Number(params[0]);
      run.error_message = null;
      run.completed_at = this.now;
      run.updated_at = this.now;
      return { rowCount: 1, rows: [] as T[] };
    }

    if (sql.includes("UPDATE ai_runs") && sql.includes("status = $1")) {
      const id = Number(params[3]);
      const run = this.runs.find((item) => item.id === id);
      if (!run) {
        return { rowCount: 0, rows: [] as T[] };
      }
      run.status = String(params[0]);
      run.exit_code = params[1] === null ? null : Number(params[1]);
      run.error_message = params[2] === null ? null : String(params[2]);
      run.completed_at = this.now;
      run.updated_at = this.now;
      return { rowCount: 1, rows: [] as T[] };
    }

    throw new Error(`Unhandled SQL: ${sql}`);
  }
}

function waitFor(check: () => boolean, timeoutMs = 1500) {
  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();
    const tick = () => {
      if (check()) {
        resolve();
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("Timeout aguardando o draft parcial do Codex."));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe("ai streaming", () => {
  it("persiste a resposta parcial enquanto o Codex ainda esta escrevendo", async () => {
    const db = new MockDb();
    let releaseRunner: (() => void) | null = null;
    const streamedEvents: Array<{ type: string; payload: unknown }> = [];

    const service = createAiChatService({
      db,
      runner: async (_prompt, options) => {
        void options.onProgress?.({
          kind: "assistant.delta",
          payload: { delta: "Pensando..." },
          rawLine: JSON.stringify({ type: "assistant.delta", delta: "Pensando..." }),
          text: "Pensando...",
        });

        await new Promise<void>((resolve) => {
          releaseRunner = resolve;
        });

        return {
          stdout: "",
          stderr: "",
          lastMessage: "Resposta final do Codex.",
          exitCode: 0,
          signal: null,
          rawLines: [JSON.stringify({ type: "thinking", message: "avaliando contexto" })],
        };
      },
    });

    const thread = await service.createThread(7, "Primeira conversa");
    const unsubscribe = service.subscribeThreadStream(thread.id, (event) => {
      streamedEvents.push({ type: event.type, payload: event.payload });
    });
    const sendPromise = service.sendMessage(
      7,
      thread.id,
      "O que esta tela faz?",
      {
        pathname: "/estrutura-do-curso",
        pageTitle: "Estrutura do Curso",
        pageSubtitle: "Criação e listagem separadas por página",
      }
    );

    await waitFor(() =>
      db.messages.some(
        (message) => message.thread_id === thread.id && message.role === "assistant" && message.content === "Pensando..."
      )
    );

    const draft = db.messages.find(
      (message) => message.thread_id === thread.id && message.role === "assistant"
    );
    expect(draft?.content).toBe("Pensando...");
    expect(draft?.metadata_json).toContain("\"partial\":true");
    expect(streamedEvents.some((event) => event.type === "draft")).toBe(true);

    releaseRunner?.();

    const result = await sendPromise;
    unsubscribe();
    expect(result.assistantMessage?.content).toBe("Resposta final do Codex.");
    expect(result.thread.status).toBe("idle");
    expect(streamedEvents.some((event) => event.type === "done")).toBe(true);
  });
});
