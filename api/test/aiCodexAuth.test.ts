import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { aiRouter } from "../src/routes/ai";
import type { CodexAuthService } from "../src/lib/codex-auth";

class MinimalDb {
  async query() {
    throw new Error("Unexpected DB access in codex auth test.");
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

describe("ai codex auth endpoints", () => {
  let server: ReturnType<typeof import("http").createServer> | null = null;
  let baseUrl = "";
  const jwtSecret = "super-secret-for-tests-12345";

  const codexAuth: CodexAuthService = {
    getLoginStatus: async () => ({
      authenticated: false,
      message: "Codex nao autenticado.",
      rawOutput: "Logged out",
      deviceAuth: null,
    }),
    startDeviceAuth: async () => ({
      code: "ABCD-EFGHI",
      url: "https://auth.openai.com/codex/device",
      startedAt: "2026-05-19T15:30:00.000Z",
    }),
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", aiRouter(jwtSecret, {
      db: new MinimalDb() as never,
      codexAuth,
      runner: async () => ({
        stdout: "",
        stderr: "",
        lastMessage: "",
        exitCode: 0,
        signal: null,
        rawLines: [],
      }),
    }));

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

  it("expõe o status de login do Codex e inicia device auth", async () => {
    const authorization = `Bearer ${makeJwt(7, jwtSecret)}`;

    const statusResponse = await fetch(`${baseUrl}/api/ai/codex/login/status`, {
      headers: { Authorization: authorization },
    });

    expect(statusResponse.status).toBe(200);
    const status = (await statusResponse.json()) as {
      authenticated: boolean;
      deviceAuth: null;
    };
    expect(status.authenticated).toBe(false);

    const deviceResponse = await fetch(`${baseUrl}/api/ai/codex/login/device`, {
      method: "POST",
      headers: { Authorization: authorization },
    });

    expect(deviceResponse.status).toBe(200);
    const device = (await deviceResponse.json()) as {
      deviceAuth: { code: string; url: string };
    };
    expect(device.deviceAuth.code).toBe("ABCD-EFGHI");
    expect(device.deviceAuth.url).toBe("https://auth.openai.com/codex/device");
  });
});
