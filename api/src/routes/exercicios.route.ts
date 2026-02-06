import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";

type DBDate = string | Date;
type TipoExercicio = "codigo" | "texto";

type ExercicioRow = {
  id: string;
  titulo: string;
  descricao: string;
  modulo: string;
  tema: string | null;
  prazo: DBDate | null;
  publicado: boolean;
  published_at: DBDate | null;
  created_by: string | null;
  tipo_exercicio: TipoExercicio | null;
  gabarito: string | null;
  linguagem_esperada: string | null;
  is_template: boolean;
  categoria: string;
  mouse_regras: string | null;
  multipla_regras: string | null;
  created_at: DBDate;
  updated_at: DBDate;
};

type ExercicioAccessRow = ExercicioRow & {
  turmas?: Array<{ id: string; nome: string; tipo: string }>;
  alunos?: Array<{ id: string; nome: string; usuario: string }>;
};

function detectarTipoExercicio(titulo: string, descricao: string): TipoExercicio {
  const texto = `${titulo} ${descricao}`.toLowerCase();

  const palavrasCodigo = [
    "código",
    "codigo",
    "programar",
    "implementar",
    "função",
    "funcao",
    "algoritmo",
    "script",
    "class",
    "classe",
    "def",
    "function",
    "const",
    "let",
    "var",
    "criar um programa",
    "escrever um código",
    "escrever codigo",
    "looping",
    "mostra",
    "for",
    "while",
    "repetindo",
    "lista",
    "percorrendo",
    "número",
    "numero",
    "programa",
    "ação",
    "açao",
    "acao",
    "log",
    "()" ,
    "js",
    "python",
    "c#",
    "c++",
    "javaScript",
    "hello"
  ];

  const palavrasTexto = [
    "dissertação",
    "dissertacao",
    "redação",
    "redacao",
    "escrever sobre",
    "descrever",
    "explicar",
    "argumento",
    "opinião",
    "opiniao",
    "análise",
    "analise",
    "resumo",
    "resenha",
    "texto",
    "redação",
  ];

  // Verificar se contém tipos especiais (mouse ou múltipla escolha)
  if (titulo.includes("Mouse") || descricao.includes("mouse") || titulo.includes("mouse")) {
    return "texto"; // Mouse exercises armazenam regras em mouse_regras
  }
  if (
    titulo.includes("Múltipla Escolha") ||
    titulo.includes("multipla escolha") ||
    titulo.includes("pergunta múltipla") ||
    descricao.includes("múltipla escolha") ||
    descricao.includes("multipla escolha")
  ) {
    return "texto"; // Múltipla escolha exercises armazenam regras em multipla_regras
  }

  const scoreCodigo = palavrasCodigo.filter((p) => texto.includes(p)).length;
  const scoreTexto = palavrasTexto.filter((p) => texto.includes(p)).length;

  if (scoreCodigo > scoreTexto) return "codigo";
  if (scoreTexto > scoreCodigo) return "texto";

  // Default: se tem símbolos de código, considera código
  if (/[{}<>=;()\[\]]/.test(texto)) return "codigo";

  return "texto"; // fallback padrão
}

const createSchema = z.object({
  titulo: z.string().min(2, "Título obrigatório"),
  descricao: z.string().min(2, "Descrição obrigatória"),
  modulo: z.string().min(1, "Módulo obrigatório"),
  tema: z.string().optional().nullable(),
  prazo: z.coerce.date().optional().nullable(),
  publicado: z.boolean().optional(),
  published_at: z.coerce.date().optional().nullable(),
  gabarito: z.string().optional().nullable(),
  linguagem_esperada: z.string().optional().nullable(),
  is_template: z.boolean().optional().default(false),
  categoria: z.string().optional().default("programacao"),
  mouse_regras: z.string().optional().nullable(),
  multipla_regras: z.string().optional().nullable(),
});

function parseIdArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter((v) => v.trim().length > 0);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v)).filter((v) => v.trim().length > 0);
      }
    } catch {
      // ignore JSON parse errors
    }
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.includes(",")) {
      return trimmed.split(",").map((v) => v.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

export function exerciciosRouter(jwtSecret: string) {
  const router = Router();

  // GET /exercicios - Listar todos os exercícios públicos
  router.get("/exercicios", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const isAluno = req.user?.role === "aluno";
    const userId = req.user?.sub;

    const conditions: string[] = [
      "e.publicado = true",
      "(e.published_at IS NULL OR e.published_at <= NOW())",
      "e.is_template = false",
    ];
    const params: any[] = [];

    if (isAluno) {
      const alunoParam = `$${params.length + 1}`;
      params.push(userId);
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM exercicio_aluno ea
          WHERE ea.exercicio_id = e.id AND ea.aluno_id = ${alunoParam}
        )
        OR (
          NOT EXISTS (SELECT 1 FROM exercicio_aluno ea2 WHERE ea2.exercicio_id = e.id)
          AND (
            EXISTS (
              SELECT 1 FROM exercicio_turma et
              WHERE et.exercicio_id = e.id
                AND et.turma_id IN (
                  SELECT turma_id FROM aluno_turma WHERE aluno_id = ${alunoParam}
                )
            )
            OR NOT EXISTS (SELECT 1 FROM exercicio_turma et2 WHERE et2.exercicio_id = e.id)
          )
        )
      )`);
    }

    const query = `
      SELECT
        e.id, e.titulo, e.descricao, e.modulo, e.tema, e.prazo, e.publicado, e.published_at, e.created_by,
        e.tipo_exercicio, e.gabarito, e.linguagem_esperada, e.is_template, e.categoria, e.mouse_regras,
        e.multipla_regras, e.created_at, e.updated_at,
        COALESCE(turmas.turmas, '[]'::jsonb) as turmas,
        COALESCE(alunos.alunos, '[]'::jsonb) as alunos
      FROM exercicios e
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'nome', t.nome, 'tipo', t.tipo)) as turmas
        FROM exercicio_turma et
        JOIN turmas t ON et.turma_id = t.id
        WHERE et.exercicio_id = e.id
      ) turmas ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario)) as alunos
        FROM exercicio_aluno ea
        JOIN users u ON ea.aluno_id = u.id
        WHERE ea.exercicio_id = e.id
      ) alunos ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY e.created_at DESC
    `;

    const r = await pool.query<ExercicioAccessRow>(query, params);

    return res.json(
      r.rows.map((row) => ({
        id: row.id,
        titulo: row.titulo,
        descricao: row.descricao,
        modulo: row.modulo,
        tema: row.tema,
        prazo: row.prazo,
        publishedAt: row.published_at,
        tipoExercicio: row.tipo_exercicio,
        is_template: row.is_template,
        categoria: row.categoria,
        mouse_regras: row.mouse_regras,
        multipla_regras: row.multipla_regras,
        createdAt: row.created_at,
        turmas: row.turmas && row.turmas.length > 0 ? row.turmas : undefined,
        alunos: row.alunos && row.alunos.length > 0 ? row.alunos : undefined,
      }))
    );
  });

  // GET /exercicios/:id - Pegar detalhes de um exercício específico
  router.get("/exercicios/:id", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const isAluno = req.user?.role === "aluno";
    const filtroTemplate = isAluno ? " AND is_template = false" : "";
    const { id } = req.params;

    const params: any[] = [id];
    const conditions: string[] = [
      "e.id = $1",
      "e.publicado = true",
      "(e.published_at IS NULL OR e.published_at <= NOW())",
    ];
    if (filtroTemplate) {
      conditions.push("e.is_template = false");
    }
    if (isAluno) {
      const alunoParam = `$${params.length + 1}`;
      params.push(req.user?.sub);
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM exercicio_aluno ea
          WHERE ea.exercicio_id = e.id AND ea.aluno_id = ${alunoParam}
        )
        OR (
          NOT EXISTS (SELECT 1 FROM exercicio_aluno ea2 WHERE ea2.exercicio_id = e.id)
          AND (
            EXISTS (
              SELECT 1 FROM exercicio_turma et
              WHERE et.exercicio_id = e.id
                AND et.turma_id IN (
                  SELECT turma_id FROM aluno_turma WHERE aluno_id = ${alunoParam}
                )
            )
            OR NOT EXISTS (SELECT 1 FROM exercicio_turma et2 WHERE et2.exercicio_id = e.id)
          )
        )
      )`);
    }

    const r = await pool.query<ExercicioAccessRow>(
      `SELECT
         e.id, e.titulo, e.descricao, e.modulo, e.tema, e.prazo, e.publicado, e.published_at, e.created_by,
         e.tipo_exercicio, e.gabarito, e.linguagem_esperada, e.is_template, e.categoria, e.mouse_regras,
         e.multipla_regras, e.created_at, e.updated_at,
         COALESCE(turmas.turmas, '[]'::jsonb) as turmas,
         COALESCE(alunos.alunos, '[]'::jsonb) as alunos
       FROM exercicios e
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'nome', t.nome, 'tipo', t.tipo)) as turmas
         FROM exercicio_turma et
         JOIN turmas t ON et.turma_id = t.id
         WHERE et.exercicio_id = e.id
       ) turmas ON true
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario)) as alunos
         FROM exercicio_aluno ea
         JOIN users u ON ea.aluno_id = u.id
         WHERE ea.exercicio_id = e.id
       ) alunos ON true
       WHERE ${conditions.join(" AND ")}`,
      params
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ message: "Exercício não encontrado" });
    }

    const row = r.rows[0];
    return res.json({
      id: row.id,
      titulo: row.titulo,
      descricao: row.descricao,
      modulo: row.modulo,
      tema: row.tema,
      prazo: row.prazo,
      publishedAt: row.published_at,
      publicado: row.publicado,
      tipoExercicio: row.tipo_exercicio,
      gabarito: row.gabarito, // Não retornar gabarito para alunos? Considerar isso
      linguagemEsperada: row.linguagem_esperada,
      is_template: row.is_template,
      categoria: row.categoria,
      mouse_regras: row.mouse_regras,
      multipla_regras: row.multipla_regras,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      turmas: row.turmas && row.turmas.length > 0 ? row.turmas : undefined,
      alunos: row.alunos && row.alunos.length > 0 ? row.alunos : undefined,
    });
  });

  // Protegido: só admin/professor cria
  router.post(
    "/exercicios",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { titulo, descricao, modulo, tema, prazo, publicado, published_at, gabarito, linguagem_esperada, is_template, categoria, mouse_regras, multipla_regras } = parsed.data;

      // Detectar tipo automaticamente
      const tipoExercicio = detectarTipoExercicio(titulo, descricao);

      // Se tem published_at, publicado deve ser false até que a data chegue
      const shouldPublish = published_at ? false : (publicado ?? true);

      const created = await pool.query<ExercicioRow>(
        `INSERT INTO exercicios (titulo, descricao, modulo, tema, prazo, publicado, published_at, created_by, tipo_exercicio, gabarito, linguagem_esperada, is_template, categoria, mouse_regras, multipla_regras)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id, titulo, descricao, modulo, tema, prazo, publicado, created_by, tipo_exercicio, gabarito, linguagem_esperada, is_template, categoria, mouse_regras, multipla_regras, created_at, updated_at`,
        [
          titulo,
          descricao,
          modulo,
          tema ?? null,
          prazo ?? null,
          shouldPublish,
          published_at ?? null,
          req.user?.sub ?? null,
          tipoExercicio,
          gabarito ?? null,
          linguagem_esperada ?? null,
          is_template ?? false,
          categoria ?? "programacao",
          mouse_regras ?? null,
          multipla_regras ?? null,
        ]
      );

      const row = created.rows[0];
      const turmaIds = parseIdArray((req.body as any).turma_ids);
      if (turmaIds.length > 0) {
        for (const turmaId of turmaIds) {
          await pool.query(
            `INSERT INTO exercicio_turma (exercicio_id, turma_id)
             VALUES ($1, $2)
             ON CONFLICT (exercicio_id, turma_id) DO NOTHING`,
            [row.id, turmaId]
          );
        }
      }

      const alunoIds = parseIdArray((req.body as any).aluno_ids);
      if (alunoIds.length > 0) {
        for (const alunoId of alunoIds) {
          await pool.query(
            `INSERT INTO exercicio_aluno (exercicio_id, aluno_id)
             VALUES ($1, $2)
             ON CONFLICT (exercicio_id, aluno_id) DO NOTHING`,
            [row.id, alunoId]
          );
        }
      }
      return res.status(201).json({
        message: "Exercício criado!",
        exercicio: {
          id: row.id,
          titulo: row.titulo,
          descricao: row.descricao,
          modulo: row.modulo,
          tema: row.tema,
          prazo: row.prazo,
          publicado: row.publicado,
          tipoExercicio: row.tipo_exercicio,
          gabarito: row.gabarito,
          linguagemEsperada: row.linguagem_esperada,
          categoria: row.categoria,
          is_template: row.is_template,
          mouse_regras: row.mouse_regras,
          multipla_regras: row.multipla_regras,
          createdAt: row.created_at,
        },
      });
    }
  );

  // Protegido: só admin/professor pode atualizar
  router.put(
    "/exercicios/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;

      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      // Verificar se exercício existe
      const checkExercicio = await pool.query<ExercicioRow>(
        `SELECT id FROM exercicios WHERE id = $1`,
        [id]
      );

      if (checkExercicio.rows.length === 0) {
        return res.status(404).json({ message: "Exercício não encontrado" });
      }

      const { titulo, descricao, modulo, tema, prazo, publicado, gabarito, linguagem_esperada, categoria, mouse_regras, multipla_regras } = parsed.data;

      // Detectar tipo automaticamente
      const tipoExercicio = detectarTipoExercicio(titulo, descricao);

      const updated = await pool.query<ExercicioRow>(
        `UPDATE exercicios
         SET titulo = $1, descricao = $2, modulo = $3, tema = $4, prazo = $5,
             publicado = $6, tipo_exercicio = $7, gabarito = $8, linguagem_esperada = $9,
             categoria = $10, mouse_regras = $11, multipla_regras = $12, updated_at = NOW()
         WHERE id = $13
         RETURNING id, titulo, descricao, modulo, tema, prazo, publicado, created_by, tipo_exercicio, gabarito, linguagem_esperada, is_template, categoria, mouse_regras, multipla_regras, created_at, updated_at`,
        [
          titulo,
          descricao,
          modulo,
          tema ?? null,
          prazo ?? null,
          publicado ?? true,
          tipoExercicio,
          gabarito ?? null,
          linguagem_esperada ?? null,
          categoria ?? "programacao",
          mouse_regras ?? null,
          multipla_regras ?? null,
          id,
        ]
      );

      const row = updated.rows[0];
      const hasTurmaIds = Object.prototype.hasOwnProperty.call(req.body, "turma_ids");
      const hasAlunoIds = Object.prototype.hasOwnProperty.call(req.body, "aluno_ids");

      if (hasAlunoIds && !hasTurmaIds) {
        await pool.query("DELETE FROM exercicio_turma WHERE exercicio_id = $1", [id]);
      }
      if (hasTurmaIds && !hasAlunoIds) {
        await pool.query("DELETE FROM exercicio_aluno WHERE exercicio_id = $1", [id]);
      }

      if (hasTurmaIds) {
        const turmaIds = parseIdArray((req.body as any).turma_ids);
        await pool.query("DELETE FROM exercicio_turma WHERE exercicio_id = $1", [id]);
        if (turmaIds.length > 0) {
          for (const turmaId of turmaIds) {
            await pool.query(
              `INSERT INTO exercicio_turma (exercicio_id, turma_id)
               VALUES ($1, $2)
               ON CONFLICT (exercicio_id, turma_id) DO NOTHING`,
              [id, turmaId]
            );
          }
        }
      }

      if (hasAlunoIds) {
        const alunoIds = parseIdArray((req.body as any).aluno_ids);
        await pool.query("DELETE FROM exercicio_aluno WHERE exercicio_id = $1", [id]);
        if (alunoIds.length > 0) {
          for (const alunoId of alunoIds) {
            await pool.query(
              `INSERT INTO exercicio_aluno (exercicio_id, aluno_id)
               VALUES ($1, $2)
               ON CONFLICT (exercicio_id, aluno_id) DO NOTHING`,
              [id, alunoId]
            );
          }
        }
      }
      return res.json({
        message: "Exercício atualizado!",
        exercicio: {
          id: row.id,
          titulo: row.titulo,
          descricao: row.descricao,
          modulo: row.modulo,
          tema: row.tema,
          prazo: row.prazo,
          publicado: row.publicado,
          tipoExercicio: row.tipo_exercicio,
          gabarito: row.gabarito,
          linguagemEsperada: row.linguagem_esperada,
          categoria: row.categoria,
          is_template: row.is_template,
          mouse_regras: row.mouse_regras,
          multipla_regras: row.multipla_regras,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    }
  );

  // Protegido: só admin/professor pode deletar
  router.delete(
    "/exercicios/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;

      // Verificar se exercício existe
      const checkExercicio = await pool.query<ExercicioRow>(
        `SELECT id FROM exercicios WHERE id = $1`,
        [id]
      );

      if (checkExercicio.rows.length === 0) {
        return res.status(404).json({ message: "Exercício não encontrado" });
      }

      // Deletar submissões primeiro (cascade)
      await pool.query(
        `DELETE FROM submissoes WHERE exercicio_id = $1`,
        [id]
      );

      // Deletar exercício
      await pool.query(
        `DELETE FROM exercicios WHERE id = $1`,
        [id]
      );

      return res.json({ message: "Exercício deletado com sucesso" });
    }
  );

  // GET /exercicios/templates - Listar templates (apenas admin)
  router.get(
    "/templates",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (_req: AuthRequest, res) => {
      try {
        const result = await pool.query<ExercicioRow>(
          `SELECT id, titulo, descricao, modulo, tema, prazo, publicado, published_at,
                   created_by, tipo_exercicio, gabarito, linguagem_esperada, is_template, categoria,
                   mouse_regras, multipla_regras, created_at, updated_at
           FROM exercicios
           WHERE is_template = true
           ORDER BY categoria, modulo, titulo ASC`
        );

        return res.json({
          templates: result.rows.map((row) => ({
            id: row.id,
            titulo: row.titulo,
            descricao: row.descricao,
            modulo: row.modulo,
            tema: row.tema,
            categoria: row.categoria,
            tipoExercicio: row.tipo_exercicio,
            mouse_regras: row.mouse_regras,
            multipla_regras: row.multipla_regras,
            createdAt: row.created_at,
          })),
        });
      } catch (error) {
        console.error("Erro ao listar templates:", error);
        return res.status(500).json({ message: "Erro ao listar templates" });
      }
    }
  );

  // POST /exercicios/templates/:id/duplicate - Duplicar template (apenas admin)
  router.post(
    "/templates/:id/duplicate",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const { nova_titulo } = req.body;

      try {
        // Buscar template
        const templateResult = await pool.query<ExercicioRow>(
          `SELECT * FROM exercicios WHERE id = $1 AND is_template = true`,
          [id]
        );

        if (templateResult.rows.length === 0) {
          return res.status(404).json({ message: "Template não encontrado" });
        }

        const template = templateResult.rows[0];

        // Duplicar exercício
        const result = await pool.query<ExercicioRow>(
          `INSERT INTO exercicios (
            id, titulo, descricao, modulo, tema, prazo, publicado, published_at,
            created_by, gabarito, linguagem_esperada, is_template, mouse_regras, multipla_regras, categoria, tipo_exercicio, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $12, $13, $14, NOW(), NOW()
          ) RETURNING *`,
          [
            nova_titulo || template.titulo,
            template.descricao,
            template.modulo,
            template.tema,
            template.prazo,
            true,
            null,
            req.user?.sub,
            template.gabarito,
            template.linguagem_esperada,
            template.mouse_regras,
            template.multipla_regras,
            template.categoria ?? 'programacao',
            template.tipo_exercicio ?? 'texto',
          ]
        );

        const newExercicio = result.rows[0];
        return res.status(201).json({
          message: "Template duplicado com sucesso!",
          exercicio: {
            id: newExercicio.id,
            titulo: newExercicio.titulo,
            modulo: newExercicio.modulo,
            tipoExercicio: newExercicio.tipo_exercicio,
            createdAt: newExercicio.created_at,
          },
        });
      } catch (error) {
        console.error("Erro ao duplicar template:", error);
        return res.status(500).json({ message: "Erro ao duplicar template" });
      }
    }
  );

  // PUT /exercicios/:id/marcar-como-template - Marcar exercício como template (apenas admin)
  router.put(
    "/:id/marcar-como-template",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const { is_template } = req.body;

      try {
        const result = await pool.query<ExercicioRow>(
          `UPDATE exercicios
           SET is_template = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [is_template === true, id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ message: "Exercício não encontrado" });
        }

        const updated = result.rows[0];
        return res.json({
          message: `Exercício marcado como ${updated.is_template ? "template" : "exercício normal"}`,
          exercicio: {
            id: updated.id,
            titulo: updated.titulo,
            isTemplate: updated.is_template,
          },
        });
      } catch (error) {
        console.error("Erro ao marcar template:", error);
        return res.status(500).json({ message: "Erro ao marcar template" });
      }
    }
  );

  // SEED - Criar exercícios do Dia 1 (apenas admin)
  router.post(
    "/seed/dia1",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        // Verificar se já existem exercícios do Dia 1
        const checkExisting = await pool.query(
          `SELECT COUNT(*) as count FROM exercicios WHERE modulo = 'Dia 1 - Primeiro Contato'`
        );

        if (checkExisting.rows[0].count > 0) {
          return res.status(400).json({
            message:
              "Exercícios do Dia 1 já foram criados. Delete-os primeiro se quiser recriá-los.",
          });
        }

        // Exercício 1: Navegação no Portal
        const ex1 = await pool.query<ExercicioRow>(
          `INSERT INTO exercicios (id, titulo, descricao, modulo, tema, publicado, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
           RETURNING *`,
          [
            "Dia 1: Navegação no Portal",
            `## 🎯 Objetivo
Aprender a navegar no portal do aluno e encontrar elementos-chave.

## 📋 Questões

### Q1: Onde fica o menu principal?
- A) No topo da página
- B) Na barra lateral esquerda
- C) No rodapé
- D) Não existe menu

### Q2: Onde você acessa as aulas?
- A) Na aba "Trilha do Curso"
- B) Na aba "Materiais"
- C) Na aba "Videoaulas Bônus"
- D) Em "Dashboard"

### Q3: Como você submete um exercício?
- A) Pelo menu de configurações
- B) Clicando no botão de envio na página do exercício
- C) Por email
- D) Não é possível submeter

### Q4: Qual aba mostra seu perfil e informações pessoais?
- A) Dashboard
- B) Exercícios
- C) Perfil
- D) Turmas

## 📝 Respostas Corretas
Q1: B | Q2: A | Q3: B | Q4: C`,
            "Dia 1 - Primeiro Contato",
            "Navegação no Portal"
          ]
        );

        // Exercício 2: Conhecendo o Mouse
        const ex2 = await pool.query<ExercicioRow>(
          `INSERT INTO exercicios (id, titulo, descricao, modulo, tema, publicado, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
           RETURNING *`,
          [
            "Dia 1: Conhecendo o Mouse",
            `## 🎯 Objetivo
Aprender a usar o mouse corretamente e entender seus componentes.

## 🖱️ Componentes do Mouse

### Botão Esquerdo
- Usado para clicar em botões e links
- Seleção de texto

### Botão Direito
- Abre menu de contexto
- Não assuste, é seguro explorar!

### Rodinha (Scroll)
- Rola a página para cima e para baixo

## 📋 Tarefas Práticas

1. **Clique em 5 botões diferentes** no portal (Dashboard, Exercícios, Turmas, Materiais, Perfil)
2. **Rolar uma página até o final** - role toda a página de exercícios
3. **Voltar ao topo** - use a rodinha para voltar
4. **Clique direito em um elemento** - veja o menu de contexto

## 💡 Dica
Use a caixa abaixo para praticar! Clique e veja o rastreamento do seu mouse.

## ✅ Desafio
Quando completar, descreva qual foi seu maior desafio ao usar o mouse.`,
            "Dia 1 - Primeiro Contato",
            "Controle do Mouse"
          ]
        );

        // Exercício 3: Clique Consciente
        const ex3 = await pool.query<ExercicioRow>(
          `INSERT INTO exercicios (id, titulo, descricao, modulo, tema, publicado, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
           RETURNING *`,
          [
            "Dia 1: Clique Consciente",
            `## 🎯 Objetivo
Entender os diferentes tipos de cliques e perder o medo de explorar.

## 🖱️ Tipos de Cliques

### Clique Simples
- Ativa botões
- Seleciona opções
- Abre links

### Clique Duplo
- Abre arquivos
- Abre pastas
- Ativa edição

### Clique Direito
- Abre menu de opções
- Oferece alternativas
- Totalmente seguro!

## 📋 Tarefas Práticas

1. **Clique simples** em um botão (UMA VEZ)
2. **Clique duplo** em um item (DUAS VEZES rápidas)
3. **Clique direito** em um elemento (observe o menu)

## 🎓 Objetivo Oculto
Você está aprendendo que **não dá para quebrar nada!** O computador foi feito para resistir.

## 💡 Interatividade
Use a caixa abaixo para praticar todos os tipos de cliques!

## ✅ Feedback
Descreva:
- Qual tipo de clique foi mais fácil?
- Qual tipo foi mais desafiador?
- Perdeu o medo?`,
            "Dia 1 - Primeiro Contato",
            "Controle do Mouse e Cliques"
          ]
        );

        return res.status(201).json({
          message: "Exercícios do Dia 1 criados com sucesso!",
          exercicios: [
            {
              id: ex1.rows[0].id,
              titulo: ex1.rows[0].titulo,
              modulo: ex1.rows[0].modulo,
            },
            {
              id: ex2.rows[0].id,
              titulo: ex2.rows[0].titulo,
              modulo: ex2.rows[0].modulo,
            },
            {
              id: ex3.rows[0].id,
              titulo: ex3.rows[0].titulo,
              modulo: ex3.rows[0].modulo,
            },
          ],
        });
      } catch (error) {
        console.error("Erro ao seeding exercícios:", error);
        return res.status(500).json({ message: "Erro ao criar exercícios" });
      }
    }
  );

  return router;
}
