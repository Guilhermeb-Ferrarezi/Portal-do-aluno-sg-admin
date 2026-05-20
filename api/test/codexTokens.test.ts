import { describe, expect, it } from "bun:test";
import { authenticateCodexPortalToken, ensureCodexApiToken } from "../src/services/codexTokens";

type StoredCodexToken = {
  public_id: string;
  user_id: number;
  name: string;
  description: string | null;
  scopes: string[];
  kind: "codex";
  codex_version: number;
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

type StoredUser = {
  id: number;
  email: string;
  name: string;
  role: number;
};

class MockDb {
  tokens = new Map<string, StoredCodexToken>();

  users = new Map<number, StoredUser>([
    [
      7,
      {
        id: 7,
        email: "alice@example.com",
        name: "Alice Example",
        role: 3,
      },
    ],
  ]);

  async query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
    const sql = text.replace(/\s+/g, " ").trim();

    if (sql.includes("FROM api_tokens") && sql.includes("= 'codex'") && sql.includes("WHERE user_id = $1")) {
      const userId = Number(params[0]);
      const rows = Array.from(this.tokens.values()).filter((token) => token.user_id === userId);
      return { rowCount: rows.length, rows: rows as T[] };
    }

    if (sql.includes("INSERT INTO api_tokens")) {
      const row: StoredCodexToken = {
        public_id: String(params[0]),
        user_id: Number(params[1]),
        name: String(params[2]),
        description: params[3] === null ? null : String(params[3]),
        scopes: JSON.parse(String(params[4])) as string[],
        kind: "codex",
        token_hash: String(params[5]),
        codex_version: Number(params[6]) || 1,
        expires_at: null,
        revoked_at: null,
        last_used_at: null,
        created_at: new Date("2026-05-19T15:00:00.000Z").toISOString(),
      };
      this.tokens.set(row.public_id, row);
      return { rowCount: 1, rows: [row] as T[] };
    }

    if (sql.includes("FROM api_tokens") && sql.includes("= 'codex'") && sql.includes("WHERE public_id = $1")) {
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

    if (sql.includes('FROM "user"') && sql.includes("WHERE id = $1 LIMIT 1")) {
      const userId = Number(params[0]);
      const user = this.users.get(userId);
      return { rowCount: user ? 1 : 0, rows: (user ? [user] : []) as T[] };
    }

    throw new Error(`Unhandled SQL: ${sql}`);
  }
}

describe("codex api token helpers", () => {
  process.env.JWT_SECRET = "super-secret-for-tests-12345";

  it("auto-cria um token codex e autentica como o usuario", async () => {
    const db = new MockDb();

    const issued = await ensureCodexApiToken(db, 7);
    expect(issued.token).toStartWith("pat_");
    expect(issued.secret).toBeTruthy();
    expect(issued.secretHash).toHaveLength(64);

    const authenticated = await authenticateCodexPortalToken(issued.token, db);
    expect(authenticated).toMatchObject({
      sub: "7",
      usuario: "alice@example.com",
      role: "admin",
      roleId: 3,
    });

    const stored = db.tokens.get(issued.publicId);
    expect(stored?.kind).toBe("codex");
    expect(stored?.last_used_at).toBeTruthy();
  });
});
