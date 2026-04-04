import { z } from "zod";

export const createTurmaSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["turma", "particular"]).default("turma"),
  categoria: z.enum(["programacao", "informatica"]).default("programacao"),
  descricao: z.string().optional().nullable(),
  data_inicio: z.string().optional().nullable(),
  duracao_semanas: z.number().int().min(1).max(104).default(12),
  course_id: z.coerce.number().int().positive().optional(),
  current_module_id: z.coerce.number().int().positive().optional(),
});

export const updateTurmaSchema = createTurmaSchema.partial();

export const createModuleSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  descricao: z.string().optional().nullable(),
  course_id: z.coerce.number().int().positive().optional(),
  courseId: z.coerce.number().int().positive().optional(),
  index_order: z.coerce.number().int().positive().optional(),
});

export const createPhaseSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  week_number: z.coerce.number().int().positive().optional(),
  index_order: z.coerce.number().int().positive().optional(),
  admin_authorize: z.boolean().optional().default(true),
});
