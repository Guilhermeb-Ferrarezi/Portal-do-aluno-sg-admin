import express from "express";
import { z } from "zod";
import multer from "multer";
import { pool } from "../db";
import { authGuard, type AuthRequest } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import { uploadToR2, deleteFromR2 } from "../utils/uploadR2";
import { logActivity } from "../utils/activityLog";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

const DEFAULT_MODULO = "Geral";
const MODULE_META_REGEX = /^\[\[module:(\d+)\|([^\]]+)\]\]\n?/;

type VideoRow = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  visibility: number | null;
  created_at: string | Date;
};

type ModuleRow = {
  id: number;
  name: string | null;
  course_id: number;
  index_order: number;
};

type ParsedDescription = {
  modulo: string;
  moduloId: number | null;
  descricao: string | null;
};

const createVideoaulaSchema = z.object({
  titulo: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  descricao: z.string().optional().nullable(),
  modulo: z.string().optional().nullable(),
  moduloId: z.coerce.number().int().positive().optional(),
  duracao: z.string().optional().nullable(),
  tipo: z.enum(["youtube", "vimeo", "arquivo"]),
  url: z.string().optional(),
});

const updateVideoaulaSchema = z.object({
  titulo: z.string().min(3).optional(),
  descricao: z.string().optional().nullable(),
  modulo: z.string().optional().nullable(),
  moduloId: z.coerce.number().int().positive().optional(),
  duracao: z.string().optional().nullable(),
  tipo: z.enum(["youtube", "vimeo", "arquivo"]).optional(),
  url: z.string().optional(),
});

function inferTipoFromUrl(url: string): "youtube" | "vimeo" | "arquivo" {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("vimeo.com")) return "vimeo";
  return "arquivo";
}

function parseDurationToSeconds(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const value = duration.trim();
  if (!value) return null;

  const parts = value.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;

  if (parts.length === 1) {
    const sec = Number(parts[0]);
    return Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : null;
  }

  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return Math.max(0, Math.floor(minutes * 60 + seconds));
  }

  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return Math.max(0, Math.floor(hours * 3600 + minutes * 60 + seconds));
  }

  return null;
}

function formatDurationFromSeconds(totalSeconds: number | null): string | null {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) return null;
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseDescriptionMetadata(description: string | null): ParsedDescription {
  const raw = description ?? "";
  const match = raw.match(MODULE_META_REGEX);

  if (!match) {
    return {
      modulo: DEFAULT_MODULO,
      moduloId: null,
      descricao: description,
    };
  }

  const moduloId = Number(match[1]);
  const modulo = match[2]?.trim() || DEFAULT_MODULO;
  const withoutMeta = raw.replace(MODULE_META_REGEX, "").trim();

  return {
    modulo,
    moduloId: Number.isFinite(moduloId) ? moduloId : null,
    descricao: withoutMeta.length > 0 ? withoutMeta : null,
  };
}

function composeDescriptionWithModule(descricao: string | null | undefined, modulo: { id: number; name: string } | null): string | null {
  const body = (descricao ?? "").trim();
  const meta = modulo ? `[[module:${modulo.id}|${modulo.name}]]` : "";
  const joined = [meta, body].filter(Boolean).join("\n").trim();
  return joined.length > 0 ? joined : null;
}

async function resolveModulo(params: { moduloId?: number; moduloNome?: string | null }) {
  if (typeof params.moduloId === "number") {
    const byId = await pool.query<ModuleRow>(
      `SELECT id, name, course_id, index_order
       FROM module
       WHERE id = $1`,
      [params.moduloId]
    );

    if (byId.rows.length === 0 || !byId.rows[0].name) return null;

    return { id: byId.rows[0].id, name: byId.rows[0].name };
  }

  const nome = (params.moduloNome ?? "").trim();
  if (!nome) return null;

  const byName = await pool.query<ModuleRow>(
    `SELECT id, name, course_id, index_order
     FROM module
     WHERE LOWER(name) = LOWER($1)
     ORDER BY id ASC
     LIMIT 1`,
    [nome]
  );

  if (byName.rows.length === 0 || !byName.rows[0].name) return null;

  return { id: byName.rows[0].id, name: byName.rows[0].name };
}

function transformVideoaula(row: VideoRow) {
  const tipo = inferTipoFromUrl(row.url);
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  const parsedDescription = parseDescriptionMetadata(row.description);

  return {
    id: String(row.id),
    titulo: row.title,
    descricao: parsedDescription.descricao,
    modulo: parsedDescription.modulo,
    moduloId: parsedDescription.moduloId ? String(parsedDescription.moduloId) : undefined,
    duracao: formatDurationFromSeconds(row.duration_seconds),
    tipo,
    url: row.url,
    createdBy: null,
    createdAt,
    updatedAt: createdAt,
    thumbnail: row.thumbnail_url || undefined,
    dataAdicionada: createdAt,
    turmas: undefined,
    alunos: undefined,
  };
}

export function videoaulasRouter(jwtSecret: string) {
  const router = express.Router();

  router.get("/modules", authGuard(jwtSecret), async (_req: AuthRequest, res) => {
    try {
      const result = await pool.query<ModuleRow>(
        `SELECT id, name, course_id, index_order
         FROM module
         WHERE name IS NOT NULL
         ORDER BY course_id ASC, index_order ASC, id ASC`
      );

      res.json(
        result.rows.map((row) => ({
          id: String(row.id),
          nome: row.name,
          courseId: String(row.course_id),
          indexOrder: row.index_order,
        }))
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao listar módulos" });
    }
  });

  router.get("/videoaulas", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const modulo = typeof req.query.modulo === "string" ? req.query.modulo.trim() : "";
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const tipo = typeof req.query.tipo === "string" ? req.query.tipo.trim().toLowerCase() : "todos";
      const hasPaginationInput =
        req.query.page !== undefined ||
        req.query.limit !== undefined ||
        req.query.q !== undefined ||
        req.query.modulo !== undefined ||
        req.query.tipo !== undefined;
      const pageRaw = Number(req.query.page ?? 1);
      const limitRaw = Number(req.query.limit ?? 20);
      const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
      const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;
      const offset = (page - 1) * limit;

      const queryParams: unknown[] = [];
      const whereClauses: string[] = [];
      if (q) {
        queryParams.push(`%${q}%`);
        whereClauses.push(`(title ILIKE $${queryParams.length} OR COALESCE(description, '') ILIKE $${queryParams.length})`);
      }
      const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const result = await pool.query<VideoRow>(
        `SELECT id, title, description, url, thumbnail_url, duration_seconds, visibility, created_at
         FROM video
         ${where}
         ORDER BY created_at DESC`,
        queryParams
      );

      const mapped = result.rows
        .map(transformVideoaula)
        .filter((v) => {
          if (modulo && modulo.toLowerCase() !== "todos" && !v.modulo.toLowerCase().includes(modulo.toLowerCase())) {
            return false;
          }
          if (tipo && tipo !== "todos" && v.tipo !== tipo) {
            return false;
          }
          return true;
        });

      if (!hasPaginationInput) {
        res.json(mapped);
        return;
      }

      const total = mapped.length;
      const items = mapped.slice(offset, offset + limit);
      res.json({
        items,
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao listar videoaulas" });
    }
  });

  router.get("/videoaulas/:id", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID inválido" });
        return;
      }

      const result = await pool.query<VideoRow>(
        `SELECT id, title, description, url, thumbnail_url, duration_seconds, visibility, created_at
         FROM video
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Videoaula não encontrada" });
        return;
      }

      res.json(transformVideoaula(result.rows[0]));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao obter videoaula" });
    }
  });

  router.post(
    "/videoaulas",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    upload.single("file"),
    async (req: AuthRequest, res) => {
      try {
        const userId = req.user?.sub;
        if (!userId) {
          res.status(401).json({ message: "Usuário não identificado" });
          return;
        }

        let data;
        try {
          data = createVideoaulaSchema.parse(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            res.status(400).json({ message: error.issues[0].message });
            return;
          }
          throw error;
        }

        const modulo = await resolveModulo({
          moduloId: data.moduloId,
          moduloNome: data.modulo,
        });

        if (!modulo) {
          res.status(400).json({ message: "Selecione um módulo existente" });
          return;
        }

        let fileUrl = data.url;

        if (data.tipo === "arquivo") {
          if (!req.file) {
            res.status(400).json({ message: "Arquivo é obrigatório para tipo 'arquivo'" });
            return;
          }
          fileUrl = await uploadToR2(req.file);
        } else {
          if (!data.url) {
            res.status(400).json({ message: `URL é obrigatória para tipo '${data.tipo}'` });
            return;
          }

          try {
            new URL(data.url);
          } catch {
            res.status(400).json({ message: "URL inválida" });
            return;
          }
        }

        const durationSeconds = parseDurationToSeconds(data.duracao);
        const descricaoComModulo = composeDescriptionWithModule(data.descricao, modulo);

        const result = await pool.query<VideoRow>(
          `INSERT INTO video (title, description, url, thumbnail_url, duration_seconds, visibility, created_at)
           VALUES ($1, $2, $3, NULL, $4, 1, NOW())
           RETURNING id, title, description, url, thumbnail_url, duration_seconds, visibility, created_at`,
          [data.titulo, descricaoComModulo, fileUrl, durationSeconds]
        );

        const created = transformVideoaula(result.rows[0]);

        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
          action: "create",
          entityType: "videoaula",
          entityId: created.id,
          metadata: {
            titulo: created.titulo,
            tipo: created.tipo,
            modulo: created.modulo,
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

        res.status(201).json({ message: "Videoaula criada com sucesso", videoaula: created });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao criar videoaula" });
      }
    }
  );

  router.put(
    "/videoaulas/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    upload.single("file"),
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          res.status(400).json({ message: "ID inválido" });
          return;
        }

        let data;
        try {
          data = updateVideoaulaSchema.parse(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            res.status(400).json({ message: error.issues[0].message });
            return;
          }
          throw error;
        }

        const currentResult = await pool.query<VideoRow>(
          `SELECT id, title, description, url, thumbnail_url, duration_seconds, visibility, created_at
           FROM video
           WHERE id = $1`,
          [id]
        );

        if (currentResult.rows.length === 0) {
          res.status(404).json({ message: "Videoaula não encontrada" });
          return;
        }

        const current = currentResult.rows[0];
        const currentParsed = parseDescriptionMetadata(current.description);

        let nextUrl = current.url;
        if (req.file) {
          const oldType = inferTipoFromUrl(current.url);
          if (oldType === "arquivo") {
            await deleteFromR2(current.url).catch(() => null);
          }
          nextUrl = await uploadToR2(req.file);
        } else if (data.url) {
          try {
            new URL(data.url);
            nextUrl = data.url;
          } catch {
            res.status(400).json({ message: "URL inválida" });
            return;
          }
        }

        let moduloAtual: { id: number; name: string } | null = null;
        if (currentParsed.moduloId) {
          moduloAtual = { id: currentParsed.moduloId, name: currentParsed.modulo };
        }

        if (typeof data.moduloId === "number" || typeof data.modulo === "string") {
          const moduloResolvido = await resolveModulo({
            moduloId: data.moduloId,
            moduloNome: data.modulo,
          });

          if (!moduloResolvido) {
            res.status(400).json({ message: "Selecione um módulo existente" });
            return;
          }

          moduloAtual = moduloResolvido;
        }

        const descricaoBase =
          typeof data.descricao === "undefined"
            ? currentParsed.descricao
            : data.descricao;

        const nextDescription = composeDescriptionWithModule(descricaoBase, moduloAtual);

        const durationSeconds =
          typeof data.duracao === "string"
            ? parseDurationToSeconds(data.duracao)
            : current.duration_seconds;

        const result = await pool.query<VideoRow>(
          `UPDATE video
           SET title = COALESCE($1, title),
               description = $2,
               url = $3,
               duration_seconds = $4
           WHERE id = $5
           RETURNING id, title, description, url, thumbnail_url, duration_seconds, visibility, created_at`,
          [data.titulo ?? null, nextDescription, nextUrl, durationSeconds, id]
        );

        const updated = transformVideoaula(result.rows[0]);

        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
          action: "update",
          entityType: "videoaula",
          entityId: String(id),
          metadata: {
            titulo: updated.titulo,
            tipo: updated.tipo,
            modulo: updated.modulo,
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

        res.json({ message: "Videoaula atualizada com sucesso", videoaula: updated });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao atualizar videoaula" });
      }
    }
  );

  router.delete(
    "/videoaulas/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          res.status(400).json({ message: "ID inválido" });
          return;
        }

        const currentResult = await pool.query<VideoRow>(
          `SELECT id, title, description, url, thumbnail_url, duration_seconds, visibility, created_at
           FROM video
           WHERE id = $1`,
          [id]
        );

        if (currentResult.rows.length === 0) {
          res.status(404).json({ message: "Videoaula não encontrada" });
          return;
        }

        const current = currentResult.rows[0];
        if (inferTipoFromUrl(current.url) === "arquivo") {
          await deleteFromR2(current.url).catch(() => null);
        }

        await pool.query("DELETE FROM video WHERE id = $1", [id]);

        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
          action: "delete",
          entityType: "videoaula",
          entityId: String(id),
          metadata: { id: String(id) },
          req,
        }).catch((err) => console.error("activity log error:", err));

        res.json({ message: "Videoaula deletada com sucesso" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao deletar videoaula" });
      }
    }
  );

  // No schema novo não existe vínculo video/turma nessa rota antiga.
  // Mantemos endpoint para compatibilidade sem quebrar frontend legado.
  router.post(
    "/videoaulas/:id/turmas",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (_req: AuthRequest, res) => {
      res.json({ message: "Atribuição de turmas indisponível no schema atual" });
    }
  );

  router.delete(
    "/videoaulas/:id/turmas/:turmaId",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (_req: AuthRequest, res) => {
      res.json({ message: "Remoção de turma indisponível no schema atual" });
    }
  );

  return router;
}
