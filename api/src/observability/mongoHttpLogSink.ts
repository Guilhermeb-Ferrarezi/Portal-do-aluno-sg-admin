import { MongoClient } from "mongodb";
import type { HttpRequestLogDocument } from "./requestObservability";

type Logger = {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
};

type MongoHttpLogSinkOptions = {
  mongoUri: string;
  dbName: string;
  collectionName: string;
  routeBlacklist?: string[];
  getRouteBlacklist?: string[];
  logger: Logger;
};

function normalizePrefixes(prefixes: string[] | undefined) {
  return (prefixes ?? [])
    .map((prefix) => prefix.trim())
    .filter(Boolean);
}

function matchesPrefix(path: string, prefixes: string[]) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

export function parseRouteList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createMongoHttpLogSink(options: MongoHttpLogSinkOptions) {
  const client = new MongoClient(options.mongoUri);
  const routeBlacklist = normalizePrefixes(options.routeBlacklist);
  const getRouteBlacklist = normalizePrefixes(options.getRouteBlacklist);
  const collection = client.db(options.dbName).collection<HttpRequestLogDocument>(
    options.collectionName
  );
  let connectPromise: Promise<void> | null = null;

  async function connect() {
    if (!connectPromise) {
      connectPromise = client.connect().then(async () => {
        await collection.createIndex({ occurredAt: -1 });
        await collection.createIndex({ statusCode: 1, occurredAt: -1 });
        await collection.createIndex({ method: 1, occurredAt: -1 });
        options.logger.info("http_logs_sink_ready", {
          mongo_db: options.dbName,
          mongo_collection: options.collectionName,
        });
      });
    }

    return connectPromise;
  }

  return {
    async connect() {
      await connect();
    },
    shouldPersist(input: { method: string; path: string; statusCode: number }) {
      if (matchesPrefix(input.path, routeBlacklist)) {
        return false;
      }

      if (input.method.toUpperCase() !== "GET") {
        return true;
      }

      if (matchesPrefix(input.path, getRouteBlacklist)) {
        return false;
      }

      return input.statusCode >= 400;
    },
    async persist(document: HttpRequestLogDocument) {
      await connect();
      await collection.insertOne(document);
    },
    async close() {
      await client.close();
    },
  };
}
