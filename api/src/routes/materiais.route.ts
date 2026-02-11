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
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

type MaterialRow = {
  id: string;
  titulo: string;
  tipo: "arquivo" | "link";
  modulo: string;
  descricao: string | null;
  url: string;
  created_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  turmas?: Array<{ id: string; nome: string; tipo: string }>;
  alunos?: Array<{ id: string; nome: string; usuario: string }>;
};

const createMaterialSchema = z.object({
  titulo: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  tipo: z.enum(["arquivo", "link"]),
  modulo: z.string().min(1, "Módulo é obrigatório"),
  descricao: z.string().optional().nullable(),
  url: z.string().optional(), // Para tipo="link"
});

const updateMaterialSchema = z.object({
  titulo: z.string().min(3).optional(),
  tipo: z.enum(["arquivo", "link"]).optional(),
  modulo: z.string().min(1).optional(),
  descricao: z.string().optional().nullable(),
  url: z.string().optional(),
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

function transformMaterial(row: MaterialRow) {
  return {
    id: row.id,
    titulo: row.titulo,
    tipo: row.tipo,
    modulo: row.modulo,
    descricao: row.descricao,
    url: row.url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    turmas: row.turmas && row.turmas.length > 0 ? row.turmas : undefined,
    alunos: row.alunos && row.alunos.length > 0 ? row.alunos : undefined,
  };
}

export function materiaisRouter(jwtSecret: string) {
  const router = express.Router();

  // GET /materiais - Listar todos (com filtro opcional por modulo)
  router.get("/materiais", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const { modulo } = req.query;
      const userRole = req.user?.role;
      const userId = req.user?.sub;

      let query = `
        SELECT
          m.id, m.titulo, m.tipo, m.modulo, m.descricao, m.url,
          m.created_by, m.created_at, m.updated_at,
          COALESCE(turmas.turmas, '[]'::jsonb) as turmas,
          COALESCE(alunos.alunos, '[]'::jsonb) as alunos
        FROM materiais m
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'nome', t.nome, 'tipo', t.tipo)) as turmas
          FROM material_turma mt
          JOIN turmas t ON mt.turma_id = t.id
          WHERE mt.material_id = m.id
        ) turmas ON true
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario)) as alunos
          FROM material_aluno ma
          JOIN users u ON ma.aluno_id = u.id
          WHERE ma.material_id = m.id
        ) alunos ON true
      `;

      const conditions: string[] = [];
      const params: any[] = [];

      // Se aluno, filtrar por turmas do aluno ou materiais sem turma (visíveis para todos)
      if (userRole === "aluno") {
        const alunoParam = `$${params.length + 1}`;
        params.push(userId);
        conditions.push(`(
          EXISTS (
            SELECT 1 FROM material_aluno ma
            WHERE ma.material_id = m.id AND ma.aluno_id = ${alunoParam}
          )
          OR (
            NOT EXISTS (SELECT 1 FROM material_aluno ma2 WHERE ma2.material_id = m.id)
            AND (
              EXISTS (
                SELECT 1 FROM material_turma mt
                WHERE mt.material_id = m.id
                  AND mt.turma_id IN (
                    SELECT turma_id FROM aluno_turma WHERE aluno_id = ${alunoParam}
                  )
              )
              OR NOT EXISTS (SELECT 1 FROM material_turma mt2 WHERE mt2.material_id = m.id)
            )
          )
        )`);
      }

      // Filtro por módulo
      if (modulo) {
        conditions.push(`m.modulo = $${params.length + 1}`);
        params.push(modulo as string);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += ` ORDER BY m.created_at DESC`;

      const result = await pool.query(query, params);
      const materiais = result.rows.map(transformMaterial);

      res.json(materiais);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao listar materiais" });
    }
  });

  // GET /materiais/:id - Obter detalhes
  router.get("/materiais/:id", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const userRole = req.user?.role;
      const userId = req.user?.sub;

      let query = `
        SELECT
          m.id, m.titulo, m.tipo, m.modulo, m.descricao, m.url,
          m.created_by, m.created_at, m.updated_at,
          COALESCE(turmas.turmas, '[]'::jsonb) as turmas,
          COALESCE(alunos.alunos, '[]'::jsonb) as alunos
        FROM materiais m
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'nome', t.nome, 'tipo', t.tipo)) as turmas
          FROM material_turma mt
          JOIN turmas t ON mt.turma_id = t.id
          WHERE mt.material_id = m.id
        ) turmas ON true
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario)) as alunos
          FROM material_aluno ma
          JOIN users u ON ma.aluno_id = u.id
          WHERE ma.material_id = m.id
        ) alunos ON true
        WHERE m.id = $1
      `;

      const params: any[] = [id];

      if (userRole === "aluno") {
        const alunoParam = `$${params.length + 1}`;
        params.push(userId);
        query += ` AND (
          EXISTS (
            SELECT 1 FROM material_aluno ma
            WHERE ma.material_id = m.id AND ma.aluno_id = ${alunoParam}
          )
          OR (
            NOT EXISTS (SELECT 1 FROM material_aluno ma2 WHERE ma2.material_id = m.id)
            AND (
              EXISTS (
                SELECT 1 FROM material_turma mt
                WHERE mt.material_id = m.id
                  AND mt.turma_id IN (
                    SELECT turma_id FROM aluno_turma WHERE aluno_id = ${alunoParam}
                  )
              )
              OR NOT EXISTS (SELECT 1 FROM material_turma mt2 WHERE mt2.material_id = m.id)
            )
          )
        )`;
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Material não encontrado" });
        return;
      }

      const material = transformMaterial(result.rows[0]);
      res.json(material);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao obter material" });
    }
  });

  // POST /materiais - Criar novo
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

        // Parse body
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

        // Validar URL
        let fileUrl = data.url;

        if (data.tipo === "arquivo") {
          // Fazer upload do arquivo
          if (!req.file) {
            res
              .status(400)
              .json({ message: "Arquivo é obrigatório para tipo 'arquivo'" });
            return;
          }

          fileUrl = await uploadToR2(req.file);
        } else if (data.tipo === "link") {
          // Validar URL
          if (!data.url) {
            res.status(400).json({ message: "URL é obrigatória para tipo 'link'" });
            return;
          }

          try {
            new URL(data.url);
          } catch {
            res.status(400).json({ message: "URL inválida" });
            return;
          }
        }

        // Inserir no banco
        const result = await pool.query(
          `INSERT INTO materiais (titulo, tipo, modulo, descricao, url, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING *`,
          [data.titulo, data.tipo, data.modulo, data.descricao || null, fileUrl, userId]
        );

        const materialId = result.rows[0].id;

        // Processar turma_ids se fornecido
        if (req.body.turma_ids) {
          try {
            const turmaIds = parseIdArray(req.body.turma_ids);
            if (Array.isArray(turmaIds) && turmaIds.length > 0) {
              for (const turmaId of turmaIds) {
                await pool.query(
                  `INSERT INTO material_turma (material_id, turma_id)
                   VALUES ($1, $2)
                   ON CONFLICT (material_id, turma_id) DO NOTHING`,
                  [materialId, turmaId]
                );
              }
            }
          } catch (err) {
            console.error("Erro ao processar turma_ids:", err);
          }
        }

        if (req.body.aluno_ids) {
          try {
            const alunoIds = parseIdArray(req.body.aluno_ids);
            if (Array.isArray(alunoIds) && alunoIds.length > 0) {
              for (const alunoId of alunoIds) {
                await pool.query(
                  `INSERT INTO material_aluno (material_id, aluno_id)
                   VALUES ($1, $2)
                   ON CONFLICT (material_id, aluno_id) DO NOTHING`,
                  [materialId, alunoId]
                );
              }
            }
          } catch (err) {
            console.error("Erro ao processar aluno_ids:", err);
          }
        }

        // Buscar material com turmas para retornar
        const materialCompleto = await pool.query(
          `
          SELECT
            m.id, m.titulo, m.tipo, m.modulo, m.descricao, m.url,
            m.created_by, m.created_at, m.updated_at,
            COALESCE(turmas.turmas, '[]'::jsonb) as turmas,
            COALESCE(alunos.alunos, '[]'::jsonb) as alunos
          FROM materiais m
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'nome', t.nome, 'tipo', t.tipo)) as turmas
            FROM material_turma mt
            JOIN turmas t ON mt.turma_id = t.id
            WHERE mt.material_id = m.id
          ) turmas ON true
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario)) as alunos
            FROM material_aluno ma
            JOIN users u ON ma.aluno_id = u.id
            WHERE ma.material_id = m.id
          ) alunos ON true
          WHERE m.id = $1
          `,
          [materialId]
        );

        const material = transformMaterial(materialCompleto.rows[0]);
                logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "create",
          entityType: "material",
          entityId: materialId,
          metadata: {
            titulo: data.titulo,
            tipo: data.tipo,
            modulo: data.modulo,
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

res.status(201).json({ message: "Material criado com sucesso", material });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao criar material" });
      }
    }
  );

  // PUT /materiais/:id - Atualizar
  router.put(
    "/materiais/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    upload.single("file"),
    async (req: AuthRequest, res) => {
      try {
        const { id } = req.params;
        const userId = req.user?.sub;
        const userRole = req.user?.role;

        if (!userId) {
          res.status(401).json({ message: "Usuário não identificado" });
          return;
        }

        // Validar dados
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

        // Buscar material atual
        const materialResult = await pool.query(
          "SELECT * FROM materiais WHERE id = $1",
          [id]
        );

        if (materialResult.rows.length === 0) {
          res.status(404).json({ message: "Material não encontrado" });
          return;
        }

        const material = materialResult.rows[0];

        // Verificar permissão (criador ou admin)
        if (userRole !== "admin" && material.created_by !== userId) {
          res.status(403).json({ message: "Você não tem permissão para atualizar este material" });
          return;
        }

        // Processar arquivo se enviado
        let fileUrl = data.url || material.url;

        if (req.file) {
          // Se tinha arquivo anterior, deletar do R2
          if (material.tipo === "arquivo") {
            await deleteFromR2(material.url);
          }
          // Upload novo arquivo
          fileUrl = await uploadToR2(req.file);
        }

        // Validar URL se for tipo link
        if (data.tipo === "link" && data.url) {
          try {
            new URL(data.url);
          } catch {
            res.status(400).json({ message: "URL inválida" });
            return;
          }
        }

        // Atualizar no banco
        const result = await pool.query(
          `UPDATE materiais
           SET titulo = COALESCE($1, titulo),
               tipo = COALESCE($2, tipo),
               modulo = COALESCE($3, modulo),
               descricao = COALESCE($4, descricao),
               url = $5,
               updated_at = NOW()
           WHERE id = $6
           RETURNING *`,
          [
            data.titulo,
            data.tipo,
            data.modulo,
            data.descricao,
            fileUrl,
            id,
          ]
        );

        const hasTurmaIds = typeof req.body.turma_ids !== "undefined";
        const hasAlunoIds = typeof req.body.aluno_ids !== "undefined";

        if (hasAlunoIds && !hasTurmaIds) {
          await pool.query("DELETE FROM material_turma WHERE material_id = $1", [id]);
        }
        if (hasTurmaIds && !hasAlunoIds) {
          await pool.query("DELETE FROM material_aluno WHERE material_id = $1", [id]);
        }

        // Processar turma_ids se fornecido
        if (req.body.turma_ids) {
          try {
            // Limpar atribuições antigas
            await pool.query("DELETE FROM material_turma WHERE material_id = $1", [id]);

            // Inserir novas atribuições
            const turmaIds = parseIdArray(req.body.turma_ids);
            if (Array.isArray(turmaIds) && turmaIds.length > 0) {
              for (const turmaId of turmaIds) {
                await pool.query(
                  `INSERT INTO material_turma (material_id, turma_id)
                   VALUES ($1, $2)
                   ON CONFLICT (material_id, turma_id) DO NOTHING`,
                  [id, turmaId]
                );
              }
            }
          } catch (err) {
            console.error("Erro ao processar turma_ids:", err);
          }
        }

        if (typeof req.body.aluno_ids !== "undefined") {
          try {
            await pool.query("DELETE FROM material_aluno WHERE material_id = $1", [id]);
            const alunoIds = parseIdArray(req.body.aluno_ids);
            if (Array.isArray(alunoIds) && alunoIds.length > 0) {
              for (const alunoId of alunoIds) {
                await pool.query(
                  `INSERT INTO material_aluno (material_id, aluno_id)
                   VALUES ($1, $2)
                   ON CONFLICT (material_id, aluno_id) DO NOTHING`,
                  [id, alunoId]
                );
              }
            }
          } catch (err) {
            console.error("Erro ao processar aluno_ids:", err);
          }
        }

        // Buscar material com turmas para retornar
        const materialCompleto = await pool.query(
          `
          SELECT
            m.id, m.titulo, m.tipo, m.modulo, m.descricao, m.url,
            m.created_by, m.created_at, m.updated_at,
            COALESCE(turmas.turmas, '[]'::jsonb) as turmas,
            COALESCE(alunos.alunos, '[]'::jsonb) as alunos
          FROM materiais m
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'nome', t.nome, 'tipo', t.tipo)) as turmas
            FROM material_turma mt
            JOIN turmas t ON mt.turma_id = t.id
            WHERE mt.material_id = m.id
          ) turmas ON true
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome, 'usuario', u.usuario)) as alunos
            FROM material_aluno ma
            JOIN users u ON ma.aluno_id = u.id
            WHERE ma.material_id = m.id
          ) alunos ON true
          WHERE m.id = $1
          `,
          [id]
        );

        const updatedMaterial = transformMaterial(materialCompleto.rows[0]);
                logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "update",
          entityType: "material",
          entityId: id,
          metadata: {
            titulo: updatedMaterial.titulo,
            tipo: updatedMaterial.tipo,
            modulo: updatedMaterial.modulo,
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

res.json({ message: "Material atualizado com sucesso", material: updatedMaterial });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao atualizar material" });
      }
    }
  );

  // DELETE /materiais/:id - Deletar
  router.delete(
    "/materiais/:id",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      try {
        const { id } = req.params;
        const userId = req.user?.sub;
        const userRole = req.user?.role;

        if (!userId) {
          res.status(401).json({ message: "Usuário não identificado" });
          return;
        }

        // Buscar material
        const materialResult = await pool.query(
          "SELECT * FROM materiais WHERE id = $1",
          [id]
        );

        if (materialResult.rows.length === 0) {
          res.status(404).json({ message: "Material não encontrado" });
          return;
        }

        const material = materialResult.rows[0];

        // Verificar permissão (criador ou admin)
        if (userRole !== "admin" && material.created_by !== userId) {
          res.status(403).json({ message: "Você não tem permissão para deletar este material" });
          return;
        }

        // Deletar arquivo do R2 se for tipo arquivo
        if (material.tipo === "arquivo") {
          await deleteFromR2(material.url);
        }

        // Deletar do banco
        void await pool.query("DELETE FROM materiais WHERE id = $1", [id]);

                logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "delete",
          entityType: "material",
          entityId: id,
          metadata: { id },
          req,
        }).catch((err) => console.error("activity log error:", err));

res.json({ message: "Material deletado com sucesso" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao deletar material" });
      }
    }
  );

  // POST /materiais/:id/turmas - Atribuir material a turmas
  router.post(
    "/materiais/:id/turmas",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      try {
        const { id } = req.params;
        const { turma_ids } = req.body;

        if (!Array.isArray(turma_ids) || turma_ids.length === 0) {
          return res.status(400).json({
            message: "turma_ids deve ser um array não-vazio",
          });
        }

        // Limpar atribuições antigas
        await pool.query("DELETE FROM material_turma WHERE material_id = $1", [
          id,
        ]);

        // Inserir novas atribuições
        for (const turmaId of turma_ids) {
          await pool.query(
            `INSERT INTO material_turma (material_id, turma_id)
             VALUES ($1, $2)
             ON CONFLICT (material_id, turma_id) DO NOTHING`,
            [id, turmaId]
          );
        }

        res.json({ message: "Material atribuído às turmas com sucesso" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao atribuir material" });
      }
    }
  );

  // DELETE /materiais/:id/turmas/:turmaId - Remover material de uma turma
  router.delete(
    "/materiais/:id/turmas/:turmaId",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      try {
        const { id, turmaId } = req.params;

        await pool.query(
          `DELETE FROM material_turma WHERE material_id = $1 AND turma_id = $2`,
          [id, turmaId]
        );

        res.json({ message: "Material removido da turma" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao remover material" });
      }
    }
  );

  return router;
}
