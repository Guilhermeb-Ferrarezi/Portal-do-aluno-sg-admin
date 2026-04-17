import "./load-env";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { exerciciosRouter } from "./routes/exercicios.route";
import { submissoesRouter } from "./routes/submissoes.route";
import { turmasRouter } from "./routes/turmas.route";
import { materiaisRouter } from "./routes/materiais.route";
import { videoaulasRouter } from "./routes/videoaulas.route";
import { activityLogsRouter } from "./routes/activityLogs";
import { badgesRouter } from "./routes/badges";
import { goalsRouter } from "./routes/goals.route";
import { containersRouter } from "./routes/containers.route";
import { classRoomsRouter } from "./routes/classRooms.route";
import { notificationsRouter } from "./routes/notifications";
import { presenceRouter } from "./routes/presence";
import { initializeDatabaseTables } from "./db/migrations";
import { setupPresenceWebSocketServer } from "./realtime/presence";
import { createStudentViewSsoStore } from "./services/studentViewSsoStore";
import { createPasswordResetStore } from "./services/passwordResetStore";
import { createPasswordResetMailer } from "./services/passwordResetMailer";
import { createHttpMetrics } from "./observability/httpMetrics";
import { createLogger } from "./observability/logger";
import { authGuard } from "./middlewares/auth";
import { requireRole } from "./middlewares/requireRole";
import { buildOpenApiSpec } from "./openapi";
import { renderSwaggerHtml } from "./openapi/swaggerHtml";
import {
  createRequestObservabilityMiddleware,
  logRequestError,
} from "./observability/requestObservability";

function optionalEmailEnv() {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().email().optional());
}

function parseBoolean(value: unknown, defaultValue: boolean) {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return defaultValue;
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().optional(),
  JWT_SECRET: z.string().min(10),
  PRESENCE_PROXY_SECRET: z.string().min(10).optional(),
  JWT_EXPIRES_IN: z.string().optional(),
  REFRESH_TOKEN_EXPIRES_IN: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  ACCESS_TOKEN_TTL_MINUTES: z.string().optional(),
  REFRESH_TOKEN_TTL_DAYS: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  IA_SG_ALLOWED_ORIGINS: z.string().optional(),
  SSO_HOME_API_URL: z.string().url().optional(),
  SSO_SHARED_SECRET: z.string().min(32).optional(),
  NOTIFICATIONS_PORTAL_API_URL: z.string().url().optional(),
  NOTIFICATIONS_SHARED_SECRET: z.string().min(32).optional(),
  SSO_PROJECT_ID: z.string().min(1).optional(),
  STUDENT_PORTAL_BASE_URL: z.string().url().optional(),
  STUDENT_PORTAL_SSO_CALLBACK_PATH: z.string().min(1).optional(),
  STUDENT_PORTAL_SSO_SHARED_SECRET: z.string().min(32).optional(),
  STUDENT_PORTAL_SSO_TTL_SECONDS: z.coerce.number().int().positive().optional(),
  PASSWORD_RESET_BASE_URL: z.string().url().optional(),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().optional(),
  PASSWORD_RESET_TOKEN_SECRET: z.string().min(32).optional(),
  SENDGRID_API_KEY: z.string().min(20).optional(),
  EMAIL_FROM: optionalEmailEnv(),
  SENDGRID_FROM_EMAIL: optionalEmailEnv(),
  EMAIL_REPLY_TO: optionalEmailEnv(),
  FromEmail: optionalEmailEnv(),
  REDIS_URL: z.string().url().optional(),
  REDIS_KEY_PREFIX: z.string().optional(),
  OBSERVABILITY_ENABLED: z.string().optional(),
  OBSERVABILITY_SERVICE_NAME: z.string().optional(),
  OBSERVABILITY_ENV: z.string().optional(),
  SWAGGER_ENABLED: z.string().optional(),
});

function validateNotificationsConfig(env: z.infer<typeof envSchema>) {
  const notificationsUrl = env.NOTIFICATIONS_PORTAL_API_URL?.trim();
  const notificationsSecret = env.NOTIFICATIONS_SHARED_SECRET?.trim();
  const legacyUrl = env.SSO_HOME_API_URL?.trim();
  const legacySecret = env.SSO_SHARED_SECRET?.trim();
  const isProduction = (env.NODE_ENV?.trim() || "").toLowerCase() === "production";

  if (notificationsUrl && notificationsSecret) {
    return;
  }

  if (!isProduction && legacyUrl && legacySecret) {
    console.warn(
      "[notifications] Using legacy SSO_* variables as fallback. Set NOTIFICATIONS_PORTAL_API_URL and NOTIFICATIONS_SHARED_SECRET."
    );
    return;
  }

  if (isProduction) {
    throw new Error(
      "Missing notifications configuration in production. Define NOTIFICATIONS_PORTAL_API_URL and NOTIFICATIONS_SHARED_SECRET."
    );
  }
}

function resolveJwtExpiresIn(env: z.infer<typeof envSchema>) {
  const explicit = env.JWT_EXPIRES_IN?.trim();
  if (explicit) return explicit;

  const legacyMinutes = Number(env.ACCESS_TOKEN_TTL_MINUTES);
  if (Number.isFinite(legacyMinutes) && legacyMinutes > 0) {
    return `${Math.floor(legacyMinutes)}m`;
  }

  return "24h";
}

function resolveRefreshTokenExpiresIn(env: z.infer<typeof envSchema>) {
  const explicit = env.REFRESH_TOKEN_EXPIRES_IN?.trim();
  if (explicit) return explicit;

  const legacyDays = Number(env.REFRESH_TOKEN_TTL_DAYS);
  if (Number.isFinite(legacyDays) && legacyDays > 0) {
    return `${Math.floor(legacyDays)}d`;
  }

  return "30d";
}

function resolveAllowedOrigins(env: z.infer<typeof envSchema>) {
  const rawOrigins =
    [
      env.CORS_ORIGIN,
      env.ALLOWED_ORIGINS,
      env.IA_SG_ALLOWED_ORIGINS,
      "http://localhost:5173,https://painel-portaldoaluno.santos-tech.com,https://admin-portal.santos-tech.com,https://portaldoaluno.santos-tech.com",
    ].find((value) => typeof value === "string" && value.trim().length > 0) ??
    "http://localhost:5173,https://painel-portaldoaluno.santos-tech.com,https://admin-portal.santos-tech.com,https://portaldoaluno.santos-tech.com";

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname === "::1" ||
    normalizedHostname === "[::1]"
  );
}

function shouldAllowLoopbackOrigins(allowedOrigins: Set<string>) {
  for (const allowedOrigin of allowedOrigins) {
    const normalizedOrigin = normalizeOrigin(allowedOrigin);
    if (!normalizedOrigin) {
      continue;
    }

    if (isLoopbackHostname(new URL(normalizedOrigin).hostname)) {
      return true;
    }
  }

  return false;
}

function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedOrigins: Set<string>,
  allowAnyLoopbackOrigin: boolean
) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  if (!allowAnyLoopbackOrigin) {
    return false;
  }

  return isLoopbackHostname(new URL(normalizedOrigin).hostname);
}

const env = envSchema.parse(process.env);
validateNotificationsConfig(env);
const jwtExpiresIn = resolveJwtExpiresIn(env);
const refreshTokenExpiresIn = resolveRefreshTokenExpiresIn(env);
const allowedOrigins = resolveAllowedOrigins(env);
const normalizedAllowedOrigins = new Set(
  allowedOrigins
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin))
);
const allowAnyLoopbackOrigin = shouldAllowLoopbackOrigins(normalizedAllowedOrigins);
const studentViewSsoStore = env.REDIS_URL
  ? createStudentViewSsoStore({
      redisUrl: env.REDIS_URL,
      keyPrefix: env.REDIS_KEY_PREFIX,
    })
  : undefined;
const passwordResetStore = env.REDIS_URL
  ? createPasswordResetStore({
      redisUrl: env.REDIS_URL,
      keyPrefix: env.REDIS_KEY_PREFIX,
    })
  : undefined;
const passwordResetMailer =
  env.SENDGRID_API_KEY && (env.EMAIL_FROM || env.SENDGRID_FROM_EMAIL || env.FromEmail)
    ? createPasswordResetMailer({
        apiKey: env.SENDGRID_API_KEY,
        fromEmail: env.EMAIL_FROM || env.SENDGRID_FROM_EMAIL || env.FromEmail || "",
        replyToEmail: env.EMAIL_REPLY_TO,
      })
    : undefined;

function shouldSkipApiLimiter(path: string) {
  return (
    path === "/docs" ||
    path === "/docs/openapi.json" ||
    path === "/presence/socket-ticket" ||
    path === "/presence/heartbeat" ||
    path === "/metrics" ||
    path === "/health" ||
    path === "/api/docs" ||
    path === "/api/docs/openapi.json" ||
    path === "/api/presence/socket-ticket" ||
    path === "/api/presence/heartbeat" ||
    path === "/api/metrics" ||
    path === "/api/health"
  );
}

const app = express();
const server = createServer(app);
const observabilityEnabled = parseBoolean(env.OBSERVABILITY_ENABLED, true);
const observabilityServiceName =
  env.OBSERVABILITY_SERVICE_NAME?.trim() || "portal-do-aluno-api";
const observabilityEnvironment =
  env.OBSERVABILITY_ENV?.trim() || env.NODE_ENV?.trim() || "development";
const swaggerEnabled = parseBoolean(
  env.SWAGGER_ENABLED,
  (env.NODE_ENV?.trim() || "development") !== "production"
);
const logger = createLogger({
  serviceName: observabilityServiceName,
  environment: observabilityEnvironment,
});
const httpMetrics = createHttpMetrics(observabilityServiceName);
const openApiSpec = buildOpenApiSpec();

function applyDocsCsp(res: express.Response) {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "font-src 'self' https: data:",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://unpkg.com",
      "script-src-attr 'none'",
      "style-src 'self' https: 'unsafe-inline'",
      "connect-src 'self'",
      "upgrade-insecure-requests",
    ].join(";")
  );
}
app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      callback(
        null,
        isAllowedCorsOrigin(origin, normalizedAllowedOrigins, allowAnyLoopbackOrigin)
      );
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));

if (observabilityEnabled) {
  app.use(
    createRequestObservabilityMiddleware({
      logger,
      metrics: httpMetrics,
    })
  );
}

const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => shouldSkipApiLimiter(req.path),
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use(apiLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
if (swaggerEnabled) {
  app.get(
    "/docs",
    authGuard(env.JWT_SECRET),
    requireRole(["admin"]),
    (_req, res) => {
      applyDocsCsp(res);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderSwaggerHtml());
    }
  );
  app.get(
    "/api/docs",
    authGuard(env.JWT_SECRET),
    requireRole(["admin"]),
    (_req, res) => {
      applyDocsCsp(res);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderSwaggerHtml());
    }
  );
  app.get(
    "/docs/openapi.json",
    authGuard(env.JWT_SECRET),
    requireRole(["admin"]),
    (_req, res) => {
      res.json(openApiSpec);
    }
  );
  app.get(
    "/api/docs/openapi.json",
    authGuard(env.JWT_SECRET),
    requireRole(["admin"]),
    (_req, res) => {
      res.json(openApiSpec);
    }
  );
}
app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", httpMetrics.registry.contentType);
  res.end(await httpMetrics.registry.metrics());
});
app.get("/api/metrics", async (_req, res) => {
  res.setHeader("Content-Type", httpMetrics.registry.contentType);
  res.end(await httpMetrics.registry.metrics());
});

// ===== ROTAS SEM PREFIXO (local / simples) =====
app.use(
  "/auth",
  loginLimiter,
  authRouter(env.JWT_SECRET, jwtExpiresIn, refreshTokenExpiresIn, {
    studentPortalBaseUrl: env.STUDENT_PORTAL_BASE_URL,
    studentPortalSsoCallbackPath: env.STUDENT_PORTAL_SSO_CALLBACK_PATH,
    studentPortalSsoSharedSecret: env.STUDENT_PORTAL_SSO_SHARED_SECRET,
    studentPortalSsoTtlSeconds: env.STUDENT_PORTAL_SSO_TTL_SECONDS,
    studentViewSsoStore,
    passwordResetTokenSecret: env.PASSWORD_RESET_TOKEN_SECRET,
    passwordResetStore,
    passwordResetMailer,
    passwordResetBaseUrl: env.PASSWORD_RESET_BASE_URL,
    passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
  })
);
app.use(usersRouter(env.JWT_SECRET));
app.use(exerciciosRouter(env.JWT_SECRET));
app.use(submissoesRouter(env.JWT_SECRET));
app.use(turmasRouter(env.JWT_SECRET));
app.use(materiaisRouter(env.JWT_SECRET));
app.use(videoaulasRouter(env.JWT_SECRET));
app.use(activityLogsRouter(env.JWT_SECRET));
app.use(badgesRouter(env.JWT_SECRET));
app.use(goalsRouter(env.JWT_SECRET));
app.use(containersRouter(env.JWT_SECRET));
app.use(classRoomsRouter(env.JWT_SECRET));
app.use(notificationsRouter(env.JWT_SECRET));
app.use(presenceRouter(env.JWT_SECRET, env.PRESENCE_PROXY_SECRET));

// ===== ROTAS COM /api (pra prod/proxy) =====
app.use(
  "/api/auth",
  loginLimiter,
  authRouter(env.JWT_SECRET, jwtExpiresIn, refreshTokenExpiresIn, {
    studentPortalBaseUrl: env.STUDENT_PORTAL_BASE_URL,
    studentPortalSsoCallbackPath: env.STUDENT_PORTAL_SSO_CALLBACK_PATH,
    studentPortalSsoSharedSecret: env.STUDENT_PORTAL_SSO_SHARED_SECRET,
    studentPortalSsoTtlSeconds: env.STUDENT_PORTAL_SSO_TTL_SECONDS,
    studentViewSsoStore,
    passwordResetTokenSecret: env.PASSWORD_RESET_TOKEN_SECRET,
    passwordResetStore,
    passwordResetMailer,
    passwordResetBaseUrl: env.PASSWORD_RESET_BASE_URL,
    passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
  })
);
app.use("/api", usersRouter(env.JWT_SECRET));
// (se usersRouter registra /users, vira /api/users)
app.use("/api", exerciciosRouter(env.JWT_SECRET));
// (se exerciciosRouter registra /exercicios, vira /api/exercicios)
app.use("/api", submissoesRouter(env.JWT_SECRET));
// (se submissoesRouter registra /exercicios/:id/submissoes, vira /api/exercicios/:id/submissoes)
app.use("/api", turmasRouter(env.JWT_SECRET));
// (se turmasRouter registra /turmas, vira /api/turmas)
app.use("/api", materiaisRouter(env.JWT_SECRET));
// (se materiaisRouter registra /materiais, vira /api/materiais)
app.use("/api", videoaulasRouter(env.JWT_SECRET));
// (se videoaulasRouter registra /videoaulas, vira /api/videoaulas)
app.use("/api", activityLogsRouter(env.JWT_SECRET));
app.use("/api", badgesRouter(env.JWT_SECRET));
app.use("/api", goalsRouter(env.JWT_SECRET));
app.use("/api", containersRouter(env.JWT_SECRET));
app.use("/api", classRoomsRouter(env.JWT_SECRET));
app.use("/api", notificationsRouter(env.JWT_SECRET));
app.use("/api", presenceRouter(env.JWT_SECRET, env.PRESENCE_PROXY_SECRET));

// handler de 404
app.use((req, res) => {
  res.status(404).json({
    message: "Not Found",
    path: req.path,
  });
});

app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (observabilityEnabled) {
      logRequestError(logger, req, res, err);
    } else {
      console.error(err);
    }
    if (typeof err === "object" && err !== null) {
      const e = err as { type?: string; status?: number; statusCode?: number; message?: string };
      const status = e.statusCode ?? e.status;

      if (e.type === "entity.too.large" || status === 413) {
        return res.status(413).json({
          message: "Arquivo de ícone muito grande. Envie uma imagem menor.",
        });
      }

      if (typeof status === "number" && status >= 400 && status < 600) {
        return res.status(status).json({ message: e.message || "Erro na requisição" });
      }
    }

    return res.status(500).json({ message: "Erro interno" });
  }
);

// Iniciar server
(async () => {
  try {
    await initializeDatabaseTables();
    setupPresenceWebSocketServer(server, env.JWT_SECRET, allowedOrigins);

    server.listen(env.PORT, "0.0.0.0", () => {
      logger.info("api_server_started", {
        port: env.PORT,
        observability_enabled: observabilityEnabled,
        swagger_enabled: swaggerEnabled,
      });
    });
  } catch (error) {
    await studentViewSsoStore?.disconnect();
    await passwordResetStore?.disconnect();
    logger.error("api_server_boot_failed", {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    });
    throw error;
  }
})();

async function shutdown() {
  await studentViewSsoStore?.disconnect();
  await passwordResetStore?.disconnect();
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
