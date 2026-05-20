import { apiFetch } from "./core";

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
  latestRun: AiThreadRun | null;
  events: Array<{ id: number; kind: string; payload: unknown; createdAt: string }>;
};

export type AiSendMessageContext = {
  pathname?: string | null;
  pageTitle?: string | null;
  pageSubtitle?: string | null;
  mode?: "ask" | "edit";
};

export type CodexDeviceAuthChallenge = {
  code: string;
  url: string;
  startedAt: string;
};

export type CodexLoginStatus = {
  authenticated: boolean;
  message: string;
  rawOutput: string;
  deviceAuth: CodexDeviceAuthChallenge | null;
};

export async function listarAiThreads() {
  return apiFetch<{ items: AiThreadSummary[]; total: number }>("/ai/threads");
}

export async function criarAiThread(payload?: { title?: string }) {
  return apiFetch<{ thread: AiThreadSummary }>("/ai/threads", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function obterAiThread(threadId: number) {
  return apiFetch<AiThreadDetail>(`/ai/threads/${threadId}`);
}

export async function enviarAiMessage(
  threadId: number,
  payload: {
    content: string;
    context?: AiSendMessageContext;
  },
  signal?: AbortSignal
) {
  return apiFetch<{
    thread: AiThreadSummary;
    userMessage: AiThreadMessage;
    assistantMessage: AiThreadMessage | null;
    run: AiThreadRun;
    events: Array<{ kind: string; payload: unknown; createdAt: string }>;
    interrupted: boolean;
  }>(`/ai/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export async function interromperAiThread(threadId: number) {
  return apiFetch<{ interrupted: boolean; message: string }>(`/ai/threads/${threadId}/interrupt`, {
    method: "POST",
  });
}

export async function obterCodexLoginStatus() {
  return apiFetch<CodexLoginStatus>("/ai/codex/login/status");
}

export async function iniciarCodexDeviceAuth() {
  return apiFetch<{
    authenticated: false;
    message: string;
    deviceAuth: CodexDeviceAuthChallenge;
  }>("/ai/codex/login/device", {
    method: "POST",
  });
}
