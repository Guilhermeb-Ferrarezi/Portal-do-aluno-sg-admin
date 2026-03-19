import "dotenv/config";
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
import { containersRouter } from "./routes/containers.route";
import { presenceRouter } from "./routes/presence";
import { initializeDatabaseTables } from "./db/migrations";
import { setupPresenceWebSocketServer } from "./realtime/presence";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().optional(),
  REFRESH_TOKEN_EXPIRES_IN: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  ACCESS_TOKEN_TTL_MINUTES: z.string().optional(),
  REFRESH_TOKEN_TTL_DAYS: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  IA_SG_ALLOWED_ORIGINS: z.string().optional(),
});

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
      "http://localhost:5173,https://painel-portaldoaluno.santos-tech.com",
    ].find((value) => typeof value === "string" && value.trim().length > 0) ??
    "http://localhost:5173,https://painel-portaldoaluno.santos-tech.com";

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
const jwtExpiresIn = resolveJwtExpiresIn(env);
const refreshTokenExpiresIn = resolveRefreshTokenExpiresIn(env);
const allowedOrigins = resolveAllowedOrigins(env);
const normalizedAllowedOrigins = new Set(
  allowedOrigins
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin))
);
const allowAnyLoopbackOrigin = shouldAllowLoopbackOrigins(normalizedAllowedOrigins);

function shouldSkipApiLimiter(path: string) {
  return (
    path === "/presence/socket-ticket" ||
    path === "/presence/heartbeat" ||
    path === "/api/presence/socket-ticket" ||
    path === "/api/presence/heartbeat"
  );
}

const app = express();
const server = createServer(app);
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

// ===== ROTAS SEM PREFIXO (local / simples) =====
app.use(
  "/auth",
  loginLimiter,
  authRouter(env.JWT_SECRET, jwtExpiresIn, refreshTokenExpiresIn)
);
app.use(usersRouter(env.JWT_SECRET));
app.use(exerciciosRouter(env.JWT_SECRET));
app.use(submissoesRouter(env.JWT_SECRET));
app.use(turmasRouter(env.JWT_SECRET));
app.use(materiaisRouter(env.JWT_SECRET));
app.use(videoaulasRouter(env.JWT_SECRET));
app.use(activityLogsRouter(env.JWT_SECRET));
app.use(badgesRouter(env.JWT_SECRET));
app.use(containersRouter(env.JWT_SECRET));
app.use(presenceRouter(env.JWT_SECRET));

// ===== ROTAS COM /api (pra prod/proxy) =====
app.use(
  "/api/auth",
  loginLimiter,
  authRouter(env.JWT_SECRET, jwtExpiresIn, refreshTokenExpiresIn)
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
app.use("/api", containersRouter(env.JWT_SECRET));
app.use("/api", presenceRouter(env.JWT_SECRET));

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
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
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
  // Inicializar banco de dados
  await initializeDatabaseTables();
  setupPresenceWebSocketServer(server, env.JWT_SECRET, allowedOrigins);

  server.listen(env.PORT, "0.0.0.0", () => {
    console.log(`API rodando na porta ${env.PORT}`);
  });
})();
