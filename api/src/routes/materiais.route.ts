import express from "express";
import { z } from "zod";
import multer from "multer";
import { pool } from "../db";
import { authGuard, type AuthRequest } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import { uploadToR2, deleteFromR2 } from "../utils/uploadR2";
import { logActivity } from "../utils/activityLog";
import { isSafeHttpUrl, validateSafeImageFile } from "../utils/fileValidation";

const ALLOWED_MATERIAL_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase().trim();
    if (ALLOWED_MATERIAL_MIME_TYPES.has(mime)) {
      cb(null, true);
      return;
    }
    cb(new Error("Tipo de arquivo nao permitido"));
  },
});

const DEFAULT_MODULO = "Geral";
const MODULE_META_REGEX = /^\[\[module:(\d+)\|([^\]]+)\]\]\n?/;

type MaterialRow = {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  visibility: number;
  uploaded_at: string | Date;
};

type ModuleRow = {
  id: number;
  name: string | null;
  course_id: number;
};

type ClassRow = {
  id: number;
  course_id: number;
};

type ParsedDescription = {
  modulo: string;
  moduloId: number | null;
  descricao: string | null;
};

type MaterialResponse = {
  id: string;
  titulo: string;
  tipo: "arquivo" | "link";
  modulo: string;
  moduloId?: string;
  descricao: string | null;
  url: string;
  createdBy: null;
  createdAt: string;
  updatedAt: string;
  turmas?: undefined;
  alunos?: undefined;
};

const createMaterialSchema = z.object({
  titulo: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  tipo: z.enum(["arquivo", "link"]),
  courseId: z.coerce.number().int().positive().optional(),
  modulo: z.string().optional().nullable(),
  moduloId: z.coerce.number().int().positive().optional(),
  exerciseId: z.coerce.number().int().positive().optional(),
  descricao: z.string().optional().nullable(),
  url: z.string().optional(),
});

const updateMaterialSchema = z.object({
  titulo: z.string().min(3).optional(),
  tipo: z.enum(["arquivo", "link"]).optional(),
  courseId: z.coerce.number().int().positive().optional(),
  modulo: z.string().optional().nullable(),
  moduloId: z.coerce.number().int().positive().optional(),
  exerciseId: z.coerce.number().int().positive().optional(),
  descricao: z.string().optional().nullable(),
  url: z.string().optional(),
});

const MIME_TO_SIMPLE_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/x-rar-compressed": "rar",
  "application/vnd.rar": "rar",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
};

function normalizeMaterialFileType(file: Express.Multer.File): string {
  const mime = (file.mimetype || "").toLowerCase().trim();
  if (mime && MIME_TO_SIMPLE_TYPE[mime]) {
    return MIME_TO_SIMPLE_TYPE[mime];
  }

  const extension = (file.originalname.split(".").pop() || "").toLowerCase().trim();
  if (extension) return extension.slice(0, 20);

  if (mime.includes("/")) {
    const subtype = mime.split("/")[1]?.split(";")[0]?.trim();
    if (subtype) return subtype.slice(0, 20);
  }

  return "arquivo";
}

function resolveMaterialUploadOptions(file: Express.Multer.File) {
  const mime = (file.mimetype || "").toLowerCase().trim();
  if (mime.startsWith("image/")) {
    const safeImage = validateSafeImageFile(file);
    return {
      contentType: safeImage.contentType,
      extension: safeImage.extension,
      fileType: normalizeMaterialFileType({
        ...file,
        mimetype: safeImage.contentType,
      }),
    };
  }

  return {
    contentType: mime || "application/octet-stream",
    extension: (file.originalname.split(".").pop() || "bin").toLowerCase(),
    fileType: normalizeMaterialFileType(file),
  };
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

function inferTipoFromFile(fileUrl: string, fileType: string | null): "arquivo" | "link" {
  const type = (fileType ?? "").toLowerCase();
  if (type === "link") return "link";
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    const isDirectFile = /(\.pdf|\.docx?|\.xlsx?|\.pptx?|\.zip|\.rar|\.txt|\.csv|\.png|\.jpe?g|\.webp|\.mp4|\.mov|\.mkv)$/i.test(fileUrl);
    return isDirectFile ? "arquivo" : "link";
  }
  return "arquivo";
}

async function resolveModulo(params: { moduloId?: number; moduloNome?: string | null }) {
  if (typeof params.moduloId === "number") {
    const byId = await pool.query<ModuleRow>(
      `SELECT id, name, course_id
       FROM module
       WHERE id = $1`,
      [params.moduloId]
    );

    if (byId.rows.length === 0 || !byId.rows[0].name) return null;

    return { id: byId.rows[0].id, name: byId.rows[0].name, courseId: byId.rows[0].course_id };
  }

  const nome = (params.moduloNome ?? "").trim();
  if (!nome) return null;

  const byName = await pool.query<ModuleRow>(
    `SELECT id, name, course_id
     FROM module
     WHERE LOWER(name) = LOWER($1)
     ORDER BY id ASC
     LIMIT 1`,
    [nome]
  );

  if (byName.rows.length === 0 || !byName.rows[0].name) return null;

  return { id: byName.rows[0].id, name: byName.rows[0].name, courseId: byName.rows[0].course_id };
}

async function resolveClassIdByCourse(courseId: number): Promise<number | null> {
  const found = await pool.query<ClassRow>(
    `SELECT id, course_id
     FROM class
     WHERE course_id = $1
     ORDER BY id ASC
     LIMIT 1`,
    [courseId]
  );

  if (found.rows.length === 0) return null;
  return found.rows[0].id;
}

async function resolveExerciseReference(params: { moduleId: number; exerciseId: number }) {
  const result = await pool.query<{
    exercise_title: string;
    phase_name: string | null;
    container_name: string | null;
  }>(
    `SELECT e.title AS exercise_title,
            p.name AS phase_name,
            ct.name AS container_name
     FROM exercise e
     JOIN phase p ON p.id = e.phase_id
     JOIN container_tasks ct ON ct.exercise_id = e.id AND ct.phase_id = p.id
     WHERE e.id = $1
       AND p.module_id = $2
     LIMIT 1`,
    [params.exerciseId, params.moduleId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    exerciseTitle: row.exercise_title,
    phaseName: row.phase_name,
    containerName: row.container_name,
    referenceDescription: `Material relacionado ao exercicio ${row.exercise_title} no container ${row.container_name ?? "sem nome"}`,
  };
}

function transformMaterial(row: MaterialRow): MaterialResponse | null {
  const fileUrl = typeof row.file_url === "string" ? row.file_url.trim() : "";
  if (!fileUrl) {
    return null;
  }

  const createdAt = row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : String(row.uploaded_at);
  const parsedDescription = parseDescriptionMetadata(row.description);

  return {
    id: String(row.id),
    titulo: row.title,
    tipo: inferTipoFromFile(fileUrl, row.file_type),
    modulo: parsedDescription.modulo,
    moduloId: parsedDescription.moduloId ? String(parsedDescription.moduloId) : undefined,
    descricao: parsedDescription.descricao,
    url: fileUrl,
    createdBy: null,
    createdAt,
    updatedAt: createdAt,
    turmas: undefined,
    alunos: undefined,
  };
}

function getFileExtension(value: string): string | null {
  const noQuery = value.split("?")[0].split("#")[0];
  const ext = noQuery.split(".").pop()?.toLowerCase() ?? "";
  return ext.length > 0 && ext !== noQuery.toLowerCase() ? ext : null;
}

function getMaterialCategoria(material: MaterialResponse) {
  if (material.tipo === "link") return "link";
  const ext = getFileExtension(material.url);
  if (!ext) return "arquivo";
  if (["pdf"].includes(ext)) return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  if (["ppt", "pptx"].includes(ext)) return "powerpoint";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "imagem";
  if (["txt", "md"].includes(ext)) return "texto";
  if (["zip", "rar", "7z"].includes(ext)) return "compactado";
  return "arquivo";
}

export function materiaisRouter(jwtSecret: string) {
  const router = express.Router();

  router.get("/materiais", authGuard(jwtSecret), async (req: AuthRequest, res) => {
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

      const result = await pool.query<MaterialRow>(
        `SELECT id, course_id, title, description, file_url, file_type, visibility, uploaded_at
         FROM material
         ${where}
         ORDER BY uploaded_at DESC`,
        queryParams
      );

      const mapped = result.rows
        .map(transformMaterial)
        .filter((material): material is MaterialResponse => material !== null)
        .filter((m) => {
          if (modulo && modulo.toLowerCase() !== "todos" && !m.modulo.toLowerCase().includes(modulo.toLowerCase())) {
            return false;
          }
          if (tipo && tipo !== "todos") {
            return getMaterialCategoria(m) === tipo;
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
      res.status(500).json({ message: "Erro ao listar materiais" });
    }
  });

  router.get("/materiais/:id", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID inválido" });
        return;
      }

      const result = await pool.query<MaterialRow>(
        `SELECT id, course_id, title, description, file_url, file_type, visibility, uploaded_at
         FROM material
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Material não encontrado" });
        return;
      }

      const material = transformMaterial(result.rows[0]);
      if (!material) {
        res.status(500).json({ message: "Material inválido encontrado no banco" });
        return;
      }

      res.json(material);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao obter material" });
    }
  });

  router.post(
    "/materiais",
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
          data = createMaterialSchema.parse(req.body);
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

        const courseId = data.courseId ?? modulo.courseId;
        if (courseId !== modulo.courseId) {
          res.status(400).json({ message: "Selecione um curso compativel com o modulo" });
          return;
        }

        const exerciseReference =
          typeof data.exerciseId === "number"
            ? await resolveExerciseReference({ moduleId: modulo.id, exerciseId: data.exerciseId })
            : null;
        if (typeof data.exerciseId === "number" && !exerciseReference) {
          res.status(400).json({ message: "Selecione um exercicio que pertença ao container do modulo" });
          return;
        }

        const descricaoComModulo = composeDescriptionWithModule(data.descricao, {
          id: modulo.id,
          name: modulo.name,
        });

        const client = await pool.connect();
        let uploadedFileUrl: string | null = null;
        let created: MaterialResponse | null = null;

        try {
          await client.query("BEGIN");

          let fileUrl = data.url;
          let fileType = "arquivo";

          if (data.tipo === "arquivo") {
            if (!req.file) {
              throw new Error("Arquivo é obrigatório para tipo 'arquivo'");
            }

            const uploadOptions = resolveMaterialUploadOptions(req.file);
            uploadedFileUrl = await uploadToR2(req.file, "materiais", {
              contentType: uploadOptions.contentType,
              extension: uploadOptions.extension,
            });
            fileUrl = uploadedFileUrl;
            fileType = uploadOptions.fileType;
          } else {
            if (!data.url) {
              throw new Error("URL é obrigatória para tipo 'link'");
            }

            if (!isSafeHttpUrl(data.url)) {
              throw new Error("URL inválida");
            }

            fileType = "link";
          }

          const result = await client.query<MaterialRow>(
            `INSERT INTO material (course_id, title, description, file_url, file_type, visibility, uploaded_at)
             VALUES ($1, $2, $3, $4, $5, 1, NOW())
             RETURNING id, course_id, title, description, file_url, file_type, visibility, uploaded_at`,
            [courseId, data.titulo, descricaoComModulo, fileUrl, fileType]
          );

          created = transformMaterial(result.rows[0]);
          if (!created) {
            throw new Error("Material criado com dados inválidos");
          }

          if (typeof data.exerciseId === "number") {
            const referenceDescription =
              exerciseReference?.referenceDescription ?? `Material relacionado ao exercicio ${created.titulo}`;
            await client.query(
              `INSERT INTO materials_reference_exercises (material_id, exercise_id, reference_description, created_at)
               VALUES ($1, $2, $3, NOW())`,
              [Number(created.id), data.exerciseId, referenceDescription]
            );
          }

          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => null);
          if (uploadedFileUrl) {
            await deleteFromR2(uploadedFileUrl).catch(() => null);
          }
          throw error;
        } finally {
          client.release();
        }

        const responseMaterial = created;
        if (!responseMaterial) {
          res.status(500).json({ message: "Material criado com dados inválidos" });
          return;
        }

        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
          action: "create",
          entityType: "material",
          entityId: responseMaterial.id,
          metadata: {
            titulo: responseMaterial.titulo,
            tipo: responseMaterial.tipo,
            modulo: responseMaterial.modulo,
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

        res.status(201).json({ message: "Material criado com sucesso", material: responseMaterial });
      } catch (error) {
        if (error instanceof Error && /arquivo|imagem|tipo|formato|url|curso|modulo|exercicio/i.test(error.message)) {
          res.status(400).json({ message: error.message });
          return;
        }
        console.error(error);
        res.status(500).json({ message: "Erro ao criar material" });
      }
    }
  );

  router.put(
    "/materiais/:id",
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
          data = updateMaterialSchema.parse(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            res.status(400).json({ message: error.issues[0].message });
            return;
          }
          throw error;
        }

        const currentResult = await pool.query<MaterialRow>(
          `SELECT id, course_id, title, description, file_url, file_type, visibility, uploaded_at
           FROM material
           WHERE id = $1`,
          [id]
        );

        if (currentResult.rows.length === 0) {
          res.status(404).json({ message: "Material não encontrado" });
          return;
        }

        const current = currentResult.rows[0];
        const currentParsed = parseDescriptionMetadata(current.description);
        const nextCourseId = data.courseId ?? current.course_id;
        const previousFileUrl = current.file_url;

        let nextFileUrl = current.file_url;
        let nextFileType = current.file_type || "arquivo";
        let deletePreviousFileAfterCommit = false;

        if (req.file) {
          if (inferTipoFromFile(current.file_url, current.file_type) === "arquivo") {
            deletePreviousFileAfterCommit = true;
          }
          const uploadOptions = resolveMaterialUploadOptions(req.file);
          nextFileUrl = await uploadToR2(req.file, "materiais", {
            contentType: uploadOptions.contentType,
            extension: uploadOptions.extension,
          });
          nextFileType = uploadOptions.fileType;
        } else if (data.tipo === "link" || typeof data.url === "string") {
          if (!data.url) {
            res.status(400).json({ message: "URL é obrigatória para tipo 'link'" });
            return;
          }
          if (!isSafeHttpUrl(data.url)) {
            res.status(400).json({ message: "URL inválida" });
            return;
          }
          nextFileUrl = data.url;
          nextFileType = "link";
        }

        let moduloAtual: { id: number; name: string; courseId: number } | null = null;
        if (currentParsed.moduloId) {
          const mod = await resolveModulo({ moduloId: currentParsed.moduloId });
          if (mod) moduloAtual = mod;
        }

        if (typeof data.moduloId === "number" || typeof data.modulo === "string") {
          const mod = await resolveModulo({ moduloId: data.moduloId, moduloNome: data.modulo });
          if (!mod) {
            res.status(400).json({ message: "Selecione um módulo existente" });
            return;
          }
          moduloAtual = mod;
        }

        if (!moduloAtual) {
          res.status(400).json({ message: "Selecione um módulo existente" });
          return;
        }

        if (nextCourseId !== moduloAtual.courseId) {
          res.status(400).json({ message: "Selecione um curso compativel com o modulo" });
          return;
        }

        const exerciseReference =
          typeof data.exerciseId === "number"
            ? await resolveExerciseReference({ moduleId: moduloAtual.id, exerciseId: data.exerciseId })
            : null;
        if (typeof data.exerciseId === "number" && !exerciseReference) {
          res.status(400).json({ message: "Selecione um exercicio que pertença ao container do modulo" });
          return;
        }

        const descricaoBase =
          typeof data.descricao === "undefined" ? currentParsed.descricao : data.descricao;

        const nextDescription = composeDescriptionWithModule(descricaoBase, {
          id: moduloAtual.id,
          name: moduloAtual.name,
        });

        const client = await pool.connect();
        let updated: MaterialResponse | null = null;

        try {
          await client.query("BEGIN");

          const result = await client.query<MaterialRow>(
            `UPDATE material
             SET course_id = $1,
                 title = COALESCE($2, title),
                 description = $3,
                 file_url = $4,
                 file_type = $5
             WHERE id = $6
             RETURNING id, course_id, title, description, file_url, file_type, visibility, uploaded_at`,
            [moduloAtual.courseId, data.titulo ?? null, nextDescription, nextFileUrl, nextFileType, id]
          );

          updated = transformMaterial(result.rows[0]);
          if (!updated) {
            throw new Error("Material atualizado com dados inválidos");
          }

          if (typeof data.exerciseId === "number") {
            await client.query("DELETE FROM materials_reference_exercises WHERE material_id = $1", [id]);
            const referenceDescription =
              exerciseReference?.referenceDescription ?? `Material relacionado ao exercicio ${updated.titulo}`;
            await client.query(
              `INSERT INTO materials_reference_exercises (material_id, exercise_id, reference_description, created_at)
               VALUES ($1, $2, $3, NOW())`,
              [id, data.exerciseId, referenceDescription]
            );
          }

          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => null);
          if (req.file && deletePreviousFileAfterCommit) {
            await deleteFromR2(nextFileUrl).catch(() => null);
          }
          throw error;
        } finally {
          client.release();
        }

        if (req.file && deletePreviousFileAfterCommit) {
          await deleteFromR2(previousFileUrl).catch(() => null);
        }

        if (!updated) {
          res.status(500).json({ message: "Material atualizado com dados inválidos" });
          return;
        }

        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
          action: "update",
          entityType: "material",
          entityId: String(id),
          metadata: {
            titulo: updated.titulo,
            tipo: updated.tipo,
            modulo: updated.modulo,
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

        res.json({ message: "Material atualizado com sucesso", material: updated });
      } catch (error) {
        if (error instanceof Error && /arquivo|imagem|tipo|formato|url|curso|modulo|exercicio/i.test(error.message)) {
          res.status(400).json({ message: error.message });
          return;
        }
        console.error(error);
        res.status(500).json({ message: "Erro ao atualizar material" });
      }
    }
  );

  router.delete(
    "/materiais/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          res.status(400).json({ message: "ID inválido" });
          return;
        }

        const currentResult = await pool.query<MaterialRow>(
          `SELECT id, course_id, title, description, file_url, file_type, visibility, uploaded_at
           FROM material
           WHERE id = $1`,
          [id]
        );

        if (currentResult.rows.length === 0) {
          res.status(404).json({ message: "Material não encontrado" });
          return;
        }

        const current = currentResult.rows[0];
        if (inferTipoFromFile(current.file_url, current.file_type) === "arquivo") {
          await deleteFromR2(current.file_url).catch(() => null);
        }

        await pool.query("DELETE FROM material WHERE id = $1", [id]);

        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
          action: "delete",
          entityType: "material",
          entityId: String(id),
          metadata: { id: String(id) },
          req,
        }).catch((err) => console.error("activity log error:", err));

        res.json({ message: "Material deletado com sucesso" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao deletar material" });
      }
    }
  );

  // Compatibilidade com front antigo: no schema atual nao ha vinculo por turma nesta rota.
  router.post(
    "/materiais/:id/turmas",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (_req: AuthRequest, res) => {
      res.json({ message: "Atribuição de turmas indisponível no schema atual" });
    }
  );

  router.delete(
    "/materiais/:id/turmas/:turmaId",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (_req: AuthRequest, res) => {
      res.json({ message: "Remoção de turma indisponível no schema atual" });
    }
  );

  return router;
}
