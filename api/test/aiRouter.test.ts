import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { aiRouter } from "../src/routes/ai";

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

type StoredEvent = {
  id: number;
  run_id: number;
  thread_id: number;
  kind: string;
  payload_json: string;
  created_at: string;
};

class MockDb {
  nextThreadId = 1;
  nextMessageId = 1;
  nextRunId = 1;
  nextEventId = 1;
  threads = new Map<number, StoredThread>();
  messages: StoredMessage[] = [];
  runs: StoredRun[] = [];
  events: StoredEvent[] = [];

  private now = "2026-05-19T15:30:00.000Z";

  async query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
    const sql = text.replace(/\s+/g, " ").trim();

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

    if (
      sql.includes("FROM ai_threads t") &&
      sql.includes("AND t.title = 'Nova conversa'") &&
      sql.includes("NOT EXISTS ( SELECT 1 FROM ai_messages m WHERE m.thread_id = t.id )")
    ) {
      const userId = Number(params[0]);
      const rows = [...this.threads.values()]
        .filter((thread) => {
          if (thread.user_id !== userId) return false;
          if (thread.title !== "Nova conversa") return false;
          if (thread.status !== "idle") return false;
          if (thread.last_message_at !== null) return false;
          return !this.messages.some((message) => message.thread_id === thread.id);
        })
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)
        .slice(0, 1);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("FROM ai_threads") && sql.includes("WHERE user_id = $1 ORDER BY updated_at DESC")) {
      const userId = Number(params[0]);
      const rows = [...this.threads.values()].filter((thread) => thread.user_id === userId);
      rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("FROM ai_threads") && sql.includes("WHERE id = $1 AND user_id = $2")) {
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
        run_id: Number(params[1]),
        role: "assistant",
        content: String(params[2]),
        metadata_json: String(params[3]),
        created_at: this.now,
      };
      this.messages.push(row);
      return { rowCount: 1, rows: [row] as T[] };
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

    if (sql.includes("FROM ai_messages") && sql.includes("WHERE thread_id = $1 ORDER BY created_at ASC, id ASC")) {
      const threadId = Number(params[0]);
      const rows = this.messages.filter((message) => message.thread_id === threadId);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("FROM ai_runs") && sql.includes("WHERE thread_id = $1 ORDER BY started_at ASC, id ASC")) {
      const threadId = Number(params[0]);
      const rows = this.runs.filter((run) => run.thread_id === threadId);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("FROM ai_runs") && sql.includes("ORDER BY started_at DESC, id DESC LIMIT 1")) {
      const threadId = Number(params[0]);
      const rows = [...this.runs]
        .filter((run) => run.thread_id === threadId && run.status === "running")
        .sort((a, b) => b.started_at.localeCompare(a.started_at) || b.id - a.id)
        .slice(0, 1);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("SELECT id, run_id, thread_id, kind, payload_json, created_at FROM ai_events")) {
      const threadId = Number(params[0]);
      const rows = this.events.filter((event) => event.thread_id === threadId);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("INSERT INTO ai_events")) {
      const row: StoredEvent = {
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

    if (sql.includes("UPDATE ai_runs SET status = 'interrupted'")) {
      const id = Number(params[0]);
      const run = this.runs.find((item) => item.id === id);
      if (!run) {
        return { rowCount: 0, rows: [] as T[] };
      }
      run.status = "interrupted";
      run.error_message = "Interrompido pelo usuario";
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

    if (/UPDATE ai_runs\b.*SET status = 'completed'/i.test(sql)) {
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

    throw new Error(`Unhandled SQL: ${sql}`);
  }
}

function makeJwt(userId: number, secret: string) {
  return jwt.sign(
    {
      sub: String(userId),
      usuario: "admin@example.com",
      role: "admin",
    },
    secret,
    { algorithm: "HS256", expiresIn: "1h" }
  );
}

describe("ai router", () => {
  let server: ReturnType<typeof import("http").createServer> | null = null;
  let baseUrl = "";
  const jwtSecret = "super-secret-for-tests-12345";
  const db = new MockDb();

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", aiRouter(jwtSecret, { db, runner: async (_prompt) => ({
      stdout: "",
      stderr: "",
      lastMessage: "Resposta final do Codex.",
      exitCode: 0,
      signal: null,
      rawLines: [JSON.stringify({ type: "thinking", message: "avaliando contexto" })],
    }) }));

    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Nao foi possivel iniciar o servidor de teste.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("lista, carrega, envia mensagem e interrompe uma conversa", async () => {
    const authorization = `Bearer ${makeJwt(7, jwtSecret)}`;

    const createResponse = await fetch(`${baseUrl}/api/ai/threads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({ title: "Primeira conversa" }),
    });

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { thread: { id: number; title: string } };
    expect(created.thread.title).toBe("Primeira conversa");

    const listResponse = await fetch(`${baseUrl}/api/ai/threads`, {
      headers: { Authorization: authorization },
    });
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as { items: Array<{ id: number; title: string }>; total: number };
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.id).toBe(created.thread.id);

    const detailResponse = await fetch(`${baseUrl}/api/ai/threads/${created.thread.id}`, {
      headers: { Authorization: authorization },
    });
    expect(detailResponse.status).toBe(200);
    const detail = (await detailResponse.json()) as {
      thread: { id: number };
      messages: unknown[];
      runs: unknown[];
      latestRun: { status: string } | null;
      events: unknown[];
    };
    expect(detail.thread.id).toBe(created.thread.id);
    expect(detail.messages).toHaveLength(0);

    const sendResponse = await fetch(`${baseUrl}/api/ai/threads/${created.thread.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({
        content: "O que esta tela faz?",
        context: {
          pathname: "/estrutura-do-curso",
          pageTitle: "Estrutura do Curso",
          pageSubtitle: "Criação e listagem separadas por página",
        },
      }),
    });

    expect(sendResponse.status).toBe(200);
    const sent = (await sendResponse.json()) as {
      thread: { status: string; summary: string | null; title: string };
      userMessage: { role: string };
      assistantMessage: { role: string; content: string } | null;
      run: { status: string };
      events: Array<{ kind: string }>;
      interrupted: boolean;
    };
    expect(sent.thread.status).toBe("idle");
    expect(sent.userMessage.role).toBe("user");
    expect(sent.assistantMessage?.content).toBe("Resposta final do Codex.");
    expect(sent.run.status).toBe("running");
    expect(sent.events).toHaveLength(1);
    expect(sent.interrupted).toBe(false);

    const interruptResponse = await fetch(`${baseUrl}/api/ai/threads/${created.thread.id}/interrupt`, {
      method: "POST",
      headers: { Authorization: authorization },
    });
    expect(interruptResponse.status).toBe(200);
    const interrupted = (await interruptResponse.json()) as { interrupted: boolean; message: string };
    expect(interrupted.interrupted).toBe(false);
    expect(interrupted.message).toContain("Nenhuma geracao em andamento");
  });
});
