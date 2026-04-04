import { z } from "zod";
import multer from "multer";
import rateLimit from "express-rate-limit";
import type { AuthRequest } from "../../middlewares/auth";

export const createSchema = z.object({
  titulo: z.string().min(2, "Título obrigatório"),
  descricao: z.string().min(2, "Descrição obrigatória"),
  modulo: z.string().min(1, "Módulo obrigatório"),
  tema: z.string().optional().nullable(),
  prazo: z.coerce.date().optional().nullable(),
  publicado: z.boolean().optional(),
  published_at: z.coerce.date().optional().nullable(),
  gabarito: z.string().optional().nullable(),
  linguagem_esperada: z.string().optional().nullable(),
  categoria: z.string().optional().default("programacao"),
  mouse_regras: z.string().optional().nullable(),
  multipla_regras: z.string().optional().nullable(),
  atalho_tipo: z.enum(["copiar-colar", "copiar-colar-imagens", "selecionar-deletar"]).optional().nullable(),
  tipo_exercicio: z.string().optional().nullable(),
  permitir_repeticao: z.boolean().optional().default(false),
  max_tentativas: z.coerce.number().int().optional().nullable(),
  penalidade_por_tentativa: z.coerce.number().optional().nullable(),
  intervalo_reenvio: z.coerce.number().int().optional().nullable(),
});

export const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0" || normalized === "") return false;
  }
  return value;
}, z.boolean());

export const createNewSchema = z.object({
  titulo: z.string().min(2, "Titulo obrigatorio"),
  descricao: z.string().min(2, "Descricao obrigatoria"),
  phase_id: z.coerce.number().int().positive("Fase obrigatoria"),
  course_id: z.coerce.number().int().positive().optional().nullable(),
  prazo: z.coerce.date().optional().nullable(),
  gabarito: z.string().optional().nullable(),
  multipla_regras: z.string().optional().nullable(),
  tipo_exercicio: z.string().optional().nullable(),
  video_url: z.string().trim().optional().nullable(),
  difficulty: z.preprocess(
    (value) => (value === null || value === undefined || value === "" ? undefined : value),
    z.coerce.number().int().min(1)
  ).optional().nullable(),
  index_order: z.coerce.number().int().min(1).optional().nullable(),
  is_final_exercise: booleanFromInput.optional().nullable(),
  is_daily_task: booleanFromInput.optional().nullable(),
  points_redeem: z.coerce.number().int().min(0).optional().nullable(),
  exercise_period: z.coerce.date().optional().nullable(),
});

export const aiGenerateSchema = z.object({
  prompt: z.string().trim().min(10, "Prompt obrigatorio"),
  courseId: z.coerce.number().int().positive("Curso obrigatorio"),
  moduleId: z.coerce.number().int().positive("Modulo obrigatorio"),
  phaseId: z.coerce.number().int().positive("Fase obrigatoria"),
  categoria: z.enum(["programacao", "informatica"]),
  componentType: z.enum(["escrita", "multipla"]),
  difficulty: z.coerce.number().int().min(1).optional().nullable(),
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Tipo de arquivo não permitido"));
  },
});

export const aiDraftLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as AuthRequest).user?.sub?.trim();
    return userId && userId.length > 0 ? `exercise-ai:${userId}` : `exercise-ai:${req.ip}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      message: "Muitas geracoes de rascunho em pouco tempo. Tente novamente em alguns minutos.",
    });
  },
});
