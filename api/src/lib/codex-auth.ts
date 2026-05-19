import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import path from "path";

export type CodexLoginStatus = {
  authenticated: boolean;
  message: string;
  rawOutput: string;
  deviceAuth: CodexDeviceAuthChallenge | null;
};

export type CodexDeviceAuthChallenge = {
  code: string;
  url: string;
  startedAt: string;
};

export type CodexAuthService = {
  getLoginStatus(): Promise<CodexLoginStatus>;
  startDeviceAuth(): Promise<CodexDeviceAuthChallenge>;
};

type DeviceAuthSession = {
  process: ChildProcessWithoutNullStreams;
  startedAt: string;
  code: string | null;
  url: string | null;
  ready: Promise<CodexDeviceAuthChallenge>;
};

type CodexCommandResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: NodeJS.Signals | null;
};

const DEVICE_CODE_RE = /\b[A-Z0-9]{4}-[A-Z0-9]{5}\b/;
const URL_RE = /https?:\/\/[^\s)]+/i;

let activeDeviceAuth: DeviceAuthSession | null = null;

function resolveWorkspaceRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === "api" ? path.resolve(cwd, "..") : cwd;
}

function resolveCodexBin() {
  return process.env.CODEX_BIN?.trim() || "codex";
}

function stripAnsi(value: string) {
  return value.replace(
    // eslint-disable-next-line no-control-regex
    /\u001B\[[0-?]*[ -/]*[@-~]/g,
    ""
  );
}

function normalizeOutput(value: string) {
  return stripAnsi(value).replace(/\r/g, "");
}

function extractDeviceAuthChallenge(output: string, fallbackStartedAt: string) {
  const normalized = normalizeOutput(output);
  const codeMatch = normalized.match(DEVICE_CODE_RE);
  const urlMatch = normalized.match(URL_RE);

  if (!codeMatch || !urlMatch) {
    return null;
  }

  return {
    code: codeMatch[0],
    url: urlMatch[0].replace(/[).,]+$/, ""),
    startedAt: fallbackStartedAt,
  } satisfies CodexDeviceAuthChallenge;
}

function isLoggedInFromStatusOutput(output: string, exitCode: number | null) {
  const normalized = normalizeOutput(output).trim();

  if (/logged in/i.test(normalized)) {
    return true;
  }

  if (/not logged in|sign in|login required|no credentials|authentication failed/i.test(normalized)) {
    return false;
  }

  return exitCode === 0 && normalized.length > 0;
}

async function runCodexCommand(args: string[], options: { timeoutMs?: number } = {}): Promise<CodexCommandResult> {
  const child = spawn(resolveCodexBin(), args, {
    cwd: resolveWorkspaceRoot(),
    env: {
      ...process.env,
      CODEX_WORKSPACE_ROOT: resolveWorkspaceRoot(),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  let timeoutHandle: NodeJS.Timeout | null = null;
  if (options.timeoutMs && options.timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        }, 3_000).unref();
      }
    }, options.timeoutMs);
    timeoutHandle.unref();
  }

  try {
    const completion = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
      child.stdin.end();
    });

    return {
      stdout,
      stderr,
      code: completion.code,
      signal: completion.signal,
    };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function ensureActiveDeviceAuth() {
  if (!activeDeviceAuth) return null;
  if (activeDeviceAuth.process.exitCode !== null || activeDeviceAuth.process.signalCode !== null) {
    activeDeviceAuth = null;
    return null;
  }
  return activeDeviceAuth;
}

export function createCodexAuthService(): CodexAuthService {
  async function getLoginStatus(): Promise<CodexLoginStatus> {
    const result = await runCodexCommand(["login", "status"], { timeoutMs: 10_000 });
    const output = `${result.stdout}\n${result.stderr}`.trim();
    const authenticated = isLoggedInFromStatusOutput(output, result.code);
    const current = ensureActiveDeviceAuth();

    return {
      authenticated,
      message: authenticated
        ? "Codex autenticado."
        : current
          ? "Aguardando confirmacao do device auth."
          : "Codex nao autenticado.",
      rawOutput: normalizeOutput(output),
      deviceAuth:
        current && current.code && current.url
          ? {
              code: current.code,
              url: current.url,
              startedAt: current.startedAt,
            }
          : null,
    };
  }

  async function startDeviceAuth(): Promise<CodexDeviceAuthChallenge> {
    const current = ensureActiveDeviceAuth();
    if (current) {
      if (current.code && current.url) {
        return {
          code: current.code,
          url: current.url,
          startedAt: current.startedAt,
        };
      }

      return current.ready;
    }

    const startedAt = new Date().toISOString();
    const child = spawn(resolveCodexBin(), ["login", "--device-auth"], {
      cwd: resolveWorkspaceRoot(),
      env: {
        ...process.env,
        CODEX_WORKSPACE_ROOT: resolveWorkspaceRoot(),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let resolved = false;
    let resolveReady: ((value: CodexDeviceAuthChallenge) => void) | null = null;
    let rejectReady: ((reason?: unknown) => void) | null = null;

    const ready = new Promise<CodexDeviceAuthChallenge>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });

    const session: DeviceAuthSession = {
      process: child,
      startedAt,
      code: null,
      url: null,
      ready,
    };
    activeDeviceAuth = session;

    const maybeResolve = () => {
      if (resolved) return;
      if (!session.code || !session.url) return;
      resolved = true;
      resolveReady?.({
        code: session.code,
        url: session.url,
        startedAt: session.startedAt,
      });
    };

    child.stdout.on("data", (chunk) => {
      const text = normalizeOutput(chunk.toString());
      stdout += text;
      const challenge = extractDeviceAuthChallenge(stdout, startedAt);
      if (challenge) {
        session.code = challenge.code;
        session.url = challenge.url;
        maybeResolve();
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += normalizeOutput(chunk.toString());
    });

    const cleanup = () => {
      if (activeDeviceAuth === session) {
        activeDeviceAuth = null;
      }
    };

    child.once("error", (error) => {
      cleanup();
      if (!resolved) {
        rejectReady?.(error);
      }
    });

    child.once("close", (code) => {
      cleanup();
      if (resolved) return;

      const challenge = extractDeviceAuthChallenge(`${stdout}\n${stderr}`, startedAt);
      if (challenge) {
        session.code = challenge.code;
        session.url = challenge.url;
        resolved = true;
        resolveReady?.(challenge);
        return;
      }

      rejectReady?.(
        new Error(
          code === 0
            ? "Nao foi possivel capturar o codigo do device auth."
            : "Falha ao iniciar o device auth."
        )
      );
    });

    child.stdin.end();

    return ready;
  }

  return {
    getLoginStatus,
    startDeviceAuth,
  };
}
