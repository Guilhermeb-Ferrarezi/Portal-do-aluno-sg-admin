import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { apiTokensRouter } from "../src/routes/apiTokens";
import { usersRouter } from "../src/routes/users";
import { buildApiTokenValue, hashApiTokenSecret } from "../src/services/apiTokens";

type StoredToken = {
  public_id: string;
  user_id: number;
  name: string;
  description: string | null;
  scopes: string[];
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

type StoredUser = {
  id: number;
  name: string;
  email: string;
  role: number;
  bio: string | null;
  profile_picture_url: string | null;
  cover_photo_url: string | null;
  created_at: string;
  last_seen_at: string | null;
  is_online: boolean;
};

class MockDb {
  tokens = new Map<string, StoredToken>();

  users = new Map<number, StoredUser>([
    [
      7,
      {
        id: 7,
        name: "Alice Example",
        email: "alice@example.com",
        role: 3,
        bio: null,
        profile_picture_url: null,
        cover_photo_url: null,
        created_at: new Date("2026-05-01T10:00:00.000Z").toISOString(),
        last_seen_at: null,
        is_online: false,
      },
    ],
  ]);

  async query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
    const sql = text.replace(/\s+/g, " ").trim();

    if (sql.includes("INSERT INTO api_tokens")) {
      const row: StoredToken = {
        public_id: String(params[0]),
        user_id: Number(params[1]),
        name: String(params[2]),
        description: params[3] === null ? null : String(params[3]),
        scopes: JSON.parse(String(params[4])) as string[],
        token_hash: String(params[5]),
        expires_at: params[6] === null || params[6] === undefined ? null : String(params[6]),
        revoked_at: null,
        last_used_at: null,
        created_at: new Date("2026-05-19T15:00:00.000Z").toISOString(),
      };
      this.tokens.set(row.public_id, row);
      return { rowCount: 1, rows: [row] as T[] };
    }

    if (sql.includes("FROM api_tokens") && sql.includes("WHERE user_id = $1")) {
      const userId = Number(params[0]);
      const rows = Array.from(this.tokens.values()).filter((token) => token.user_id === userId);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("FROM api_tokens") && sql.includes("WHERE public_id = $1 AND user_id = $2")) {
      const publicId = String(params[0]);
      const userId = Number(params[1]);
      const token = this.tokens.get(publicId);
      const rows = token && token.user_id === userId ? [token] : [];
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("FROM api_tokens") && sql.includes("WHERE public_id = $1 LIMIT 1")) {
      const publicId = String(params[0]);
      const token = this.tokens.get(publicId);
      const rows = token ? [token] : [];
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("UPDATE api_tokens SET last_used_at = NOW() WHERE public_id = $1")) {
      const publicId = String(params[0]);
      const token = this.tokens.get(publicId);
      if (token) {
        token.last_used_at = new Date("2026-05-19T15:01:00.000Z").toISOString();
      }
      return { rowCount: token ? 1 : 0, rows: [] as T[] };
    }

    if (sql.includes("SET name = $1")) {
      const publicId = String(params[4]);
      const token = this.tokens.get(publicId);
      if (!token) return { rowCount: 0, rows: [] as T[] };
      token.name = String(params[0]);
      token.description = params[1] === null ? null : String(params[1]);
      token.scopes = JSON.parse(String(params[2])) as string[];
      token.expires_at = params[3] === null || params[3] === undefined ? null : String(params[3]);
      return { rowCount: 1, rows: [token] as T[] };
    }

    if (sql.includes("SET revoked_at = NOW()")) {
      const publicId = String(params[0]);
      const token = this.tokens.get(publicId);
      if (!token) return { rowCount: 0, rows: [] as T[] };
      token.revoked_at = new Date("2026-05-19T15:02:00.000Z").toISOString();
      return { rowCount: 1, rows: [token] as T[] };
    }

    if (sql.includes('FROM "user"') && sql.includes("WHERE id = $1 LIMIT 1")) {
      const userId = Number(params[0]);
      const user = this.users.get(userId);
      return { rowCount: user ? 1 : 0, rows: (user ? [user] : []) as T[] };
    }

    throw new Error(`Unhandled SQL: ${sql}`);
  }
}

function makeJwt(userId: number, secret: string) {
  return jwt.sign(
    {
      sub: String(userId),
      usuario: "alice@example.com",
      role: "admin",
    },
    secret,
    { algorithm: "HS256", expiresIn: "1h" }
  );
}

describe("api tokens router", () => {
  let server: ReturnType<typeof import("http").createServer> | null = null;
  let baseUrl = "";
  const jwtSecret = "super-secret-for-tests-12345";
  const db = new MockDb();

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", apiTokensRouter(jwtSecret, { db }));
    app.use("/api", usersRouter(jwtSecret, { db }));
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

  it("cria, lista e revoga tokens sem expor o segredo", async () => {
    const authorization = `Bearer ${makeJwt(7, jwtSecret)}`;
    const issued = buildApiTokenValue("aaaa1111-bbbb-2222-cccc-333333333333");
    db.tokens.set(issued.publicId, {
      public_id: issued.publicId,
      user_id: 7,
      name: "Token existente",
      description: null,
      scopes: ["usuarios:read"],
      token_hash: hashApiTokenSecret(issued.secret),
      expires_at: null,
      revoked_at: null,
      last_used_at: null,
      created_at: new Date("2026-05-19T14:00:00.000Z").toISOString(),
    });

    const createResponse = await fetch(`${baseUrl}/api/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({
        name: "Service Account",
        description: "Integracao principal",
        scopes: ["turmas:read", "usuarios:read", "turmas:read"],
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      token: { publicId: string; name: string };
      secret: string;
      secretHint: string;
      scopes: string[];
    };
    expect(created.secret).toStartWith("pat_");
    expect(created.token.name).toBe("Service Account");
    expect(created.scopes).toEqual(["turmas:read", "usuarios:read"]);

    const listResponse = await fetch(`${baseUrl}/api/tokens`, {
      headers: { Authorization: authorization },
    });

    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as {
      items: Array<{ publicId: string; name: string; secret?: string }>;
      total: number;
    };
    expect(listed.total).toBeGreaterThanOrEqual(2);
    expect(listed.items.some((item) => item.secret !== undefined)).toBe(false);

    const meResponse = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${created.secret}` },
    });

    const meBody = await meResponse.text();
    expect(meResponse.status).toBe(200);
    const me = JSON.parse(meBody) as { id: string; email: string };
    expect(me.id).toBe("7");
    expect(me.email).toBe("alice@example.com");

    const revokeResponse = await fetch(`${baseUrl}/api/tokens/${created.token.publicId}`, {
      method: "DELETE",
      headers: { Authorization: authorization },
    });
    expect(revokeResponse.status).toBe(200);

    const revokedAccess = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${created.secret}` },
    });
    expect(revokedAccess.status).toBe(401);
  });
});
