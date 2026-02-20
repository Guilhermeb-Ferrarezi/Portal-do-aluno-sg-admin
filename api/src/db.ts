import { Pool, type PoolConfig } from "pg";

const connectionString = process.env.DATABASE_URL;

const dbServer = process.env.DB_SERVER;
const dbPort = process.env.DB_PORT;
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbSsl = process.env.DB_SSL;

const hasDiscreteDbConfig =
  !!dbServer && !!dbPort && !!dbName && !!dbUser && !!dbPassword;

let poolConfig: PoolConfig;

if (connectionString) {
  poolConfig = { connectionString };
} else if (hasDiscreteDbConfig) {
  poolConfig = {
    host: dbServer,
    port: Number(dbPort),
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: dbSsl?.toLowerCase() === "disable" ? false : undefined,
  };
} else {
  throw new Error(
    "Configure DATABASE_URL ou DB_SERVER/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD"
  );
}

export const pool = new Pool(poolConfig);
