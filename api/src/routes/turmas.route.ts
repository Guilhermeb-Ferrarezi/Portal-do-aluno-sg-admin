import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { logActivity } from "../utils/activityLog";

type DbTurmaRow = {
  id: string;
  nome: string;
  tipo: "turma" | "particular";
  categoria: string;
  professor_id: string | null;
  descricao: string | null;
  ativo: boolean;
  data_inicio: string | null;
  duracao_semanas: number;
  cronograma_ativo: boolean;
  created_at: string;
  updated_at: string;
};

const createTurmaSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["turma", "particular"]),
  categoria: z.enum(["programacao", "informatica"]).default("programacao"),
  professor_id: z.string().uuid("Professor ID inválido").optional().nullable(),
  descricao: z.string().optional().nullable(),
  data_inicio: z.string().optional().nullable(),
  duracao_semanas: z.number().int().min(1).max(52).default(12),
  cronograma_ativo: z.boolean().default(false),
});

const updateTurmaSchema = createTurmaSchema.partial();

export function turmasRouter(jwtSecret: string) {
  const router = Router();

  // GET /turmas - Listar turmas (baseado no role do usuário)
  router.get("/turmas", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const userId = req.user!.sub;
    const userRole = req.user!.role;

    let query = `
      SELECT id, nome, tipo, categoria, professor_id, descricao, ativo, data_inicio, duracao_semanas, cronograma_ativo, created_at, updated_at
      FROM turmas
      WHERE ativo = true
    `;
    const params: any[] = [];

    // Admin vê todas as turmas
    if (userRole === "admin") {
      // Sem filtros adicionais
    }
    // Professor vê apenas suas turmas
    else if (userRole === "professor") {
      query += ` AND professor_id = $1`;
      params.push(userId);
    }
    // Aluno vê turmas que pertence
    else {
      query += `
        AND id IN (
          SELECT turma_id FROM aluno_turma WHERE aluno_id = $1
        )
      `;
      params.push(userId);
    }

    query += " ORDER BY created_at DESC";

    const r = await pool.query<DbTurmaRow>(query, params);

    return res.json(
      r.rows.map((row) => ({
        id: row.id,
        nome: row.nome,
        tipo: row.tipo,
        categoria: row.categoria || "programacao",
        professorId: row.professor_id,
        descricao: row.descricao,
        ativo: row.ativo,
        dataInicio: row.data_inicio,
        duracaoSemanas: row.duracao_semanas,
        cronogramaAtivo: row.cronograma_ativo,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    );
  });

  // GET /turmas/meus-responsaveis - Retorna turmas que o usuário é responsável (professor_id)
  router.get("/turmas/meus-responsaveis/count", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.sub;
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM turmas WHERE ativo = true AND professor_id = $1`,
        [userId]
      );
      const total = parseInt(result.rows[0]?.count ?? "0", 10);
      return res.json({ total });
    } catch (error) {
      console.error("Erro ao contar turmas responsáveis:", error);
      return res.status(500).json({ message: "Erro ao contar turmas responsáveis" });
    }
  });

  // GET /turmas/total - Retorna o total de turmas do sistema
  router.get("/turmas/total", authGuard(jwtSecret), async (_req: AuthRequest, res) => {
    try {
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM turmas WHERE ativo = true`
      );
      const total = parseInt(result.rows[0]?.count ?? "0", 10);
      return res.json({ total });
    } catch (error) {
      console.error("Erro ao contar turmas:", error);
      return res.status(500).json({ message: "Erro ao contar turmas" });
    }
  });

  // GET /turmas/:id - Detalhes de uma turma com alunos e exercícios
  router.get("/turmas/:id", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const userId = req.user!.sub;
    const userRole = req.user!.role;

    // Verificar se existe
    const checkTurma = await pool.query<DbTurmaRow>(
      `SELECT * FROM turmas WHERE id = $1`,
      [id]
    );

    if (checkTurma.rows.length === 0) {
      return res.status(404).json({ message: "Turma não encontrada" });
    }

    const turma = checkTurma.rows[0];

    // Verificar permissão: professor só vê suas turmas, aluno vê turmas que pertence
    if (userRole === "professor" && turma.professor_id !== userId) {
      return res.status(403).json({ message: "Sem permissão" });
    } else if (userRole === "aluno") {
      const hasAccess = await pool.query(
        `SELECT 1 FROM aluno_turma WHERE aluno_id = $1 AND turma_id = $2`,
        [userId, id]
      );
      if (hasAccess.rows.length === 0) {
        return res.status(403).json({ message: "Sem permissão" });
      }
    }

    // Buscar alunos da turma
    const alunosR = await pool.query(
      `
      SELECT u.id, u.usuario, u.nome, u.role
      FROM users u
      JOIN aluno_turma at ON u.id = at.aluno_id
      WHERE at.turma_id = $1
      ORDER BY u.nome
      `,
      [id]
    );

    // Buscar exercícios atribuídos
    const exerciciosR = await pool.query(
      `
      SELECT e.id, e.titulo, e.modulo
      FROM exercicios e
      JOIN exercicio_turma et ON e.id = et.exercicio_id
      WHERE et.turma_id = $1
      ORDER BY e.created_at DESC
      `,
      [id]
    );

    return res.json({
      id: turma.id,
      nome: turma.nome,
      tipo: turma.tipo,
      categoria: turma.categoria || "programacao",
      professorId: turma.professor_id,
      descricao: turma.descricao,
      ativo: turma.ativo,
      dataInicio: turma.data_inicio,
      duracaoSemanas: turma.duracao_semanas,
      cronogramaAtivo: turma.cronograma_ativo,
      createdAt: turma.created_at,
      updatedAt: turma.updated_at,
      alunos: alunosR.rows.map((row) => ({
        id: row.id,
        usuario: row.usuario,
        nome: row.nome,
        role: row.role,
      })),
      exercicios: exerciciosR.rows.map((row) => ({
        id: row.id,
        titulo: row.titulo,
        modulo: row.modulo,
      })),
    });
  });

  // POST /turmas - Criar turma (apenas admin)
  router.post(
    "/turmas",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const parsed = createTurmaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { nome, tipo, categoria, professor_id, descricao, data_inicio, duracao_semanas, cronograma_ativo } = parsed.data;
      const userId = req.user!.sub;

      // Admin pode se auto-atribuir ou atribuir a outro professor
      const finalProfessorId = professor_id ?? userId;

      const created = await pool.query<DbTurmaRow>(
        `INSERT INTO turmas (nome, tipo, categoria, professor_id, descricao, data_inicio, duracao_semanas, cronograma_ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [nome, tipo, categoria ?? "programacao", finalProfessorId, descricao ?? null, data_inicio ?? null, duracao_semanas ?? 12, cronograma_ativo ?? false]
      );

      const row = created.rows[0];
      
      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "create",
        entityType: "turma",
        entityId: created.rows[0]?.id ?? null,
        metadata: {
          nome,
          tipo,
          categoria,
          professor_id,
          ativo: true,
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.status(201).json({
        message: "Turma criada com sucesso!",
        turma: {
          id: row.id,
          nome: row.nome,
          tipo: row.tipo,
          categoria: row.categoria || "programacao",
          professorId: row.professor_id,
          descricao: row.descricao,
          ativo: row.ativo,
          dataInicio: row.data_inicio,
          duracaoSemanas: row.duracao_semanas,
          cronogramaAtivo: row.cronograma_ativo,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    }
  );

  // PUT /turmas/:id - Atualizar turma
  router.put(
    "/turmas/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const userId = req.user!.sub;
      const userRole = req.user!.role;

      const parsed = updateTurmaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      // Verificar se existe
      const checkTurma = await pool.query<DbTurmaRow>(
        `SELECT * FROM turmas WHERE id = $1`,
        [id]
      );

      if (checkTurma.rows.length === 0) {
        return res.status(404).json({ message: "Turma não encontrada" });
      }

      const turma = checkTurma.rows[0];

      // Professor só pode editar suas turmas
      if (userRole === "professor" && turma.professor_id !== userId) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      const { nome, tipo, categoria, professor_id, descricao, data_inicio, duracao_semanas, cronograma_ativo } = parsed.data;

      const campos: string[] = [];
      const valores: any[] = [];
      let idx = 1;

      if (nome !== undefined) {
        campos.push(`nome = $${idx++}`);
        valores.push(nome);
      }

      if (tipo !== undefined) {
        campos.push(`tipo = $${idx++}`);
        valores.push(tipo);
      }

      if (categoria !== undefined) {
        campos.push(`categoria = $${idx++}`);
        valores.push(categoria);
      }

      if (descricao !== undefined) {
        campos.push(`descricao = $${idx++}`);
        valores.push(descricao);
      }

      if (data_inicio !== undefined) {
        campos.push(`data_inicio = $${idx++}`);
        valores.push(data_inicio ?? null);
      }

      if (duracao_semanas !== undefined) {
        campos.push(`duracao_semanas = $${idx++}`);
        valores.push(duracao_semanas);
      }

      if (cronograma_ativo !== undefined) {
        campos.push(`cronograma_ativo = $${idx++}`);
        valores.push(cronograma_ativo);
      }

      const temProfessorId = Object.prototype.hasOwnProperty.call(parsed.data, "professor_id");
      if (userRole === "admin" && temProfessorId) {
        campos.push(`professor_id = $${idx++}`);
        valores.push(professor_id);
      }

      campos.push("updated_at = NOW()");

      const updated = await pool.query<DbTurmaRow>(
        `UPDATE turmas
         SET ${campos.join(", ")}
         WHERE id = $${idx}
         RETURNING *`,
        [...valores, id]
      );
      const row = updated.rows[0];
      
      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "update",
        entityType: "turma",
        entityId: id,
        metadata: {
          updatedFields: Object.keys(parsed.data),
        },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({
        message: "Turma atualizada!",
        turma: {
          id: row.id,
          nome: row.nome,
          tipo: row.tipo,
          categoria: row.categoria || "programacao",
          professorId: row.professor_id,
          descricao: row.descricao,
          ativo: row.ativo,
          dataInicio: row.data_inicio,
          duracaoSemanas: row.duracao_semanas,
          cronogramaAtivo: row.cronograma_ativo,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    }
  );

  // DELETE /turmas/:id - Deletar turma
  router.delete(
    "/turmas/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const userId = req.user!.sub;
      const userRole = req.user!.role;

      // Verificar se existe
      const checkTurma = await pool.query<DbTurmaRow>(
        `SELECT * FROM turmas WHERE id = $1`,
        [id]
      );

      if (checkTurma.rows.length === 0) {
        return res.status(404).json({ message: "Turma não encontrada" });
      }

      const turma = checkTurma.rows[0];

      // Professor só pode deletar suas turmas
      if (userRole === "professor" && turma.professor_id !== userId) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      // Deletar relações (cascata automática no banco)
      await pool.query(`DELETE FROM turmas WHERE id = $1`, [id]);

      
      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "delete",
        entityType: "turma",
        entityId: id,
        metadata: { id },
        req,
      }).catch((err) => console.error("activity log error:", err));

      return res.json({ message: "Turma deletada com sucesso" });
    }
  );

  // POST /turmas/:id/alunos - Adicionar alunos à turma
  router.post(
    "/turmas/:id/alunos",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const { aluno_ids } = req.body;
      const userId = req.user!.sub;
      const userRole = req.user!.role;

      if (!Array.isArray(aluno_ids) || aluno_ids.length === 0) {
        return res.status(400).json({ message: "aluno_ids deve ser um array não vazio" });
      }

      // Verificar se turma existe
      const checkTurma = await pool.query<DbTurmaRow>(
        `SELECT * FROM turmas WHERE id = $1`,
        [id]
      );

      if (checkTurma.rows.length === 0) {
        return res.status(404).json({ message: "Turma não encontrada" });
      }

      const turma = checkTurma.rows[0];

      // Professor só pode adicionar alunos em suas turmas
      if (userRole === "professor" && turma.professor_id !== userId) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      // Adicionar alunos
      for (const alunoId of aluno_ids) {
        try {
          await pool.query(
            `INSERT INTO aluno_turma (aluno_id, turma_id)
             VALUES ($1, $2)
             ON CONFLICT (aluno_id, turma_id) DO NOTHING`,
            [alunoId, id]
          );
        } catch (e) {
          // Ignorar erros de constraint (aluno já está na turma)
        }
      }

      return res.json({ message: "Alunos adicionados com sucesso" });
    }
  );

  // DELETE /turmas/:id/alunos/:alunoId - Remover aluno da turma
  router.delete(
    "/turmas/:id/alunos/:alunoId",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id, alunoId } = req.params;
      const userId = req.user!.sub;
      const userRole = req.user!.role;

      // Verificar se turma existe
      const checkTurma = await pool.query<DbTurmaRow>(
        `SELECT * FROM turmas WHERE id = $1`,
        [id]
      );

      if (checkTurma.rows.length === 0) {
        return res.status(404).json({ message: "Turma não encontrada" });
      }

      const turma = checkTurma.rows[0];

      // Professor só pode remover alunos de suas turmas
      if (userRole === "professor" && turma.professor_id !== userId) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      // Remover aluno
      await pool.query(
        `DELETE FROM aluno_turma WHERE aluno_id = $1 AND turma_id = $2`,
        [alunoId, id]
      );

      return res.json({ message: "Aluno removido da turma" });
    }
  );

  // POST /turmas/:id/exercicios - Atribuir exercícios à turma
  router.post(
    "/turmas/:id/exercicios",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const { exercicio_ids } = req.body;
      const userId = req.user!.sub;
      const userRole = req.user!.role;

      if (!Array.isArray(exercicio_ids) || exercicio_ids.length === 0) {
        return res.status(400).json({ message: "exercicio_ids deve ser um array não vazio" });
      }

      // Verificar se turma existe
      const checkTurma = await pool.query<DbTurmaRow>(
        `SELECT * FROM turmas WHERE id = $1`,
        [id]
      );

      if (checkTurma.rows.length === 0) {
        return res.status(404).json({ message: "Turma não encontrada" });
      }

      const turma = checkTurma.rows[0];

      // Professor só pode atribuir exercícios em suas turmas
      if (userRole === "professor" && turma.professor_id !== userId) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      // Atribuir exercícios
      for (const exercicioId of exercicio_ids) {
        try {
          await pool.query(
            `INSERT INTO exercicio_turma (exercicio_id, turma_id)
             VALUES ($1, $2)
             ON CONFLICT (exercicio_id, turma_id) DO NOTHING`,
            [exercicioId, id]
          );
        } catch (e) {
          // Ignorar erros de constraint
        }
      }

      return res.json({ message: "Exercícios atribuídos com sucesso" });
    }
  );

  // DELETE /turmas/:id/exercicios/:exercicioId - Remover exercício da turma
  router.delete(
    "/turmas/:id/exercicios/:exercicioId",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id, exercicioId } = req.params;
      const userId = req.user!.sub;
      const userRole = req.user!.role;

      // Verificar se turma existe
      const checkTurma = await pool.query<DbTurmaRow>(
        `SELECT * FROM turmas WHERE id = $1`,
        [id]
      );

      if (checkTurma.rows.length === 0) {
        return res.status(404).json({ message: "Turma não encontrada" });
      }

      const turma = checkTurma.rows[0];

      // Professor só pode remover exercícios de suas turmas
      if (userRole === "professor" && turma.professor_id !== userId) {
        return res.status(403).json({ message: "Sem permissão" });
      }

      // Remover exercício
      await pool.query(
        `DELETE FROM exercicio_turma WHERE exercicio_id = $1 AND turma_id = $2`,
        [exercicioId, id]
      );

      return res.json({ message: "Exercício removido da turma" });
    }
  );

  // POST /turmas/:id/cronograma - Criar/atualizar cronograma completo
  router.post(
    "/turmas/:id/cronograma",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const { semanas } = req.body;
      const userId = req.user!.sub;
      const userRole = req.user!.role;

      try {
        // Verificar se turma existe
        const turmaCheck = await pool.query<DbTurmaRow>(
          `SELECT * FROM turmas WHERE id = $1`,
          [id]
        );

        if (turmaCheck.rows.length === 0) {
          return res.status(404).json({ message: "Turma não encontrada" });
        }

        const turma = turmaCheck.rows[0];

        // Verificar permissão
        if (userRole === "professor" && turma.professor_id !== userId) {
          return res.status(403).json({ message: "Sem permissão" });
        }

        // Limpar cronograma existente
        await pool.query(`DELETE FROM cronograma_turma WHERE turma_id = $1`, [id]);

        // Inserir novo cronograma
        if (semanas && Array.isArray(semanas)) {
          for (const s of semanas) {
            if (!s.exercicios || !Array.isArray(s.exercicios)) continue;

            for (let i = 0; i < s.exercicios.length; i++) {
              const exercicioId = s.exercicios[i];

              // Verificar se é um template
              const checkTemplate = await pool.query<{
                is_template: boolean;
                titulo: string;
                descricao: string;
                modulo: string;
                tema: string | null;
                prazo: string | null;
                gabarito: string | null;
                linguagem_esperada: string | null;
                mouse_regras: string | null;
                multipla_regras: string | null;
                tipo_exercicio: string | null;
                categoria: string;
              }>(
                `SELECT is_template, titulo, descricao, modulo, tema, prazo, gabarito, linguagem_esperada, mouse_regras, multipla_regras, tipo_exercicio, categoria FROM exercicios WHERE id = $1`,
                [exercicioId]
              );

              let finalExercicioId = exercicioId;

              // Se for um template, duplicar em um novo exercício
              if (checkTemplate.rows.length > 0 && checkTemplate.rows[0].is_template) {
                const template = checkTemplate.rows[0];

                // Duplicar o template com um novo ID
                const duplicateResult = await pool.query<{ id: string }>(
                  `INSERT INTO exercicios (
                    id, titulo, descricao, modulo, tema, prazo, publicado, published_at,
                    created_by, tipo_exercicio, gabarito, linguagem_esperada, is_template,
                    mouse_regras, multipla_regras, categoria, created_at, updated_at
                  )
                  VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, true, null,
                    $6, $7, $8, $9, false,
                    $10, $11, $12, NOW(), NOW()
                  )
                  RETURNING id`,
                  [
                    template.titulo,
                    template.descricao,
                    template.modulo,
                    template.tema,
                    template.prazo,
                    userId,
                    template.tipo_exercicio,
                    template.gabarito,
                    template.linguagem_esperada,
                    template.mouse_regras,
                    template.multipla_regras,
                    template.categoria ?? 'programacao',
                  ]
                );

                if (duplicateResult.rows.length > 0) {
                  finalExercicioId = duplicateResult.rows[0].id;
                  console.log(` Template "${template.titulo}" duplicado em novo exercício: ${finalExercicioId}`);
                }
              }

              // Adicionar ao cronograma com o exercício final (seja original ou duplicado)
              await pool.query(
                `INSERT INTO cronograma_turma (turma_id, exercicio_id, semana, ordem)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (turma_id, exercicio_id, semana) DO NOTHING`,
                [id, finalExercicioId, s.semana, i]
              );
            }
          }
        }

        return res.json({ message: "Cronograma configurado com sucesso!" });
      } catch (error) {
        console.error("Erro ao configurar cronograma:", error);
        return res.status(500).json({ message: "Erro ao configurar cronograma" });
      }
    }
  );

  // GET /turmas/:id/cronograma - Buscar cronograma
  router.get(
    "/turmas/:id/cronograma",
    authGuard(jwtSecret),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const userId = req.user!.sub;
      const userRole = req.user!.role;

      try {
        // Verificar se turma existe e se usuário tem acesso
        const turmaCheck = await pool.query<DbTurmaRow>(
          `SELECT * FROM turmas WHERE id = $1`,
          [id]
        );

        if (turmaCheck.rows.length === 0) {
          return res.status(404).json({ message: "Turma não encontrada" });
        }

        const turma = turmaCheck.rows[0];

        // Verificar permissão
        if (userRole === "professor" && turma.professor_id !== userId) {
          return res.status(403).json({ message: "Sem permissão" });
        } else if (userRole === "aluno") {
          const hasAccess = await pool.query(
            `SELECT 1 FROM aluno_turma WHERE aluno_id = $1 AND turma_id = $2`,
            [userId, id]
          );
          if (hasAccess.rows.length === 0) {
            return res.status(403).json({ message: "Sem permissão" });
          }
        }

        const result = await pool.query(`
          SELECT c.semana, c.ordem, e.id, e.titulo, e.modulo
          FROM cronograma_turma c
          JOIN exercicios e ON c.exercicio_id = e.id
          WHERE c.turma_id = $1
          ORDER BY c.semana, c.ordem
        `, [id]);

        // Agrupar por semana
        const cronograma = result.rows.reduce((acc: any, row: any) => {
          if (!acc[row.semana]) acc[row.semana] = [];
          acc[row.semana].push({ id: row.id, titulo: row.titulo, modulo: row.modulo });
          return acc;
        }, {});

        return res.json({
          cronograma,
          turma: {
            id: turma.id,
            nome: turma.nome,
            dataInicio: turma.data_inicio,
            duracaoSemanas: turma.duracao_semanas,
            cronogramaAtivo: turma.cronograma_ativo,
          }
        });
      } catch (error) {
        console.error("Erro ao buscar cronograma:", error);
        return res.status(500).json({ message: "Erro ao buscar cronograma" });
      }
    }
  );

  return router;
}
