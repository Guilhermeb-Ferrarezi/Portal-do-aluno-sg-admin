import Redis from "ioredis";

type StudentViewSsoEntry = {
  sourceUserId: string;
  sourceEmail: string;
  sourceName: string | null;
};

type StudentViewSsoStoreOptions = {
  redisUrl: string;
  keyPrefix?: string;
};

export type StudentViewSsoStore = {
  set(code: string, entry: StudentViewSsoEntry, ttlSeconds: number): Promise<void>;
  consume(code: string): Promise<StudentViewSsoEntry | null>;
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

export function createStudentViewSsoStore(
  options: StudentViewSsoStoreOptions
): StudentViewSsoStore {
  const redis = new Redis(options.redisUrl, {
    keyPrefix: options.keyPrefix?.trim() || "portal-aluno:",
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  let connectPromise: Promise<void> | null = null;

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
    async set(code, entry, ttlSeconds) {
      await ensureConnected();
      await redis.set(
        `student-view:code:${code}`,
        JSON.stringify(entry),
        "EX",
        Math.max(1, ttlSeconds)
      );
    },

    async consume(code) {
      await ensureConnected();
      const raw = await redis.eval(CONSUME_SCRIPT, 1, `student-view:code:${code}`);
      if (typeof raw !== "string") return null;
      return JSON.parse(raw) as StudentViewSsoEntry;
    },

    async disconnect() {
      if (redis.status === "end") return;
      await redis.quit().catch(async () => {
        redis.disconnect();
      });
    },
  };
}
