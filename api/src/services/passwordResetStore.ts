import Redis from "ioredis";

type PasswordResetEntry = {
  userId: string;
  email: string;
  role: number;
  expiresAt: string;
};

type PasswordResetStoreOptions = {
  redisUrl: string;
  keyPrefix?: string;
};

export type PasswordResetStore = {
  issue(tokenHash: string, entry: PasswordResetEntry, ttlSeconds: number): Promise<void>;
  get(tokenHash: string): Promise<PasswordResetEntry | null>;
  consume(tokenHash: string): Promise<PasswordResetEntry | null>;
  disconnect(): Promise<void>;
};

const CONSUME_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then
  return nil
end
redis.call('DEL', KEYS[1])
return value
`;

export function createPasswordResetStore(
  options: PasswordResetStoreOptions
): PasswordResetStore {
  const redis = new Redis(options.redisUrl, {
    keyPrefix: options.keyPrefix?.trim() || "portal-aluno:",
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  let connectPromise: Promise<void> | null = null;

  function tokenKey(tokenHash: string) {
    return `password-reset:token:${tokenHash}`;
  }

  function userKey(userId: string) {
    return `password-reset:user:${userId}`;
  }

  async function ensureConnected() {
    if (redis.status === "ready") return;
    if (!connectPromise) {
      connectPromise = redis.connect().finally(() => {
        connectPromise = null;
      });
    }
    await connectPromise;
  }

  return {
    async issue(tokenHash, entry, ttlSeconds) {
      await ensureConnected();

      const pointerKey = userKey(entry.userId);
      const previousTokenHash = await redis.get(pointerKey);
      if (previousTokenHash) {
        await redis.del(tokenKey(previousTokenHash));
      }

      const expiresIn = Math.max(1, ttlSeconds);
      await redis.set(tokenKey(tokenHash), JSON.stringify(entry), "EX", expiresIn);
      await redis.set(pointerKey, tokenHash, "EX", expiresIn);
    },

    async get(tokenHash) {
      await ensureConnected();
      const raw = await redis.get(tokenKey(tokenHash));
      if (typeof raw !== "string") return null;
      return JSON.parse(raw) as PasswordResetEntry;
    },

    async consume(tokenHash) {
      await ensureConnected();
      const raw = await redis.eval(CONSUME_SCRIPT, 1, tokenKey(tokenHash));
      if (typeof raw !== "string") return null;
      const entry = JSON.parse(raw) as PasswordResetEntry;
      await redis.del(userKey(entry.userId));
      return entry;
    },

    async disconnect() {
      if (redis.status === "end") return;
      await redis.quit().catch(async () => {
        redis.disconnect();
      });
    },
  };
}
