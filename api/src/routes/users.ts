import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest, Role } from "../middlewares/auth";
import { logActivity } from "../utils/activityLog";

type DbUserRow = {
  id: string;
  usuario: string;
  nome: string;
  role: Role;
  ativo: boolean;
  created_at: string; // pode ser Date dependendo do pg, mas string funciona bem
};

const passwordSchema = z
  .string()
  .min(6, "Senha muito curta")

const createUserSchema = z.object({
  usuario: z.string().min(3, "Usuário muito curto"),
  nome: z.string().min(2, "Nome obrigatório"),
  senha: passwordSchema,
  role: z.enum(["admin", "professor", "aluno"]).optional(),
  ativo: z.boolean().optional(),
});

const updateMeSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
});

const updateUserSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório").optional(),
  usuario: z.string().min(3, "Usuário muito curto").optional(),
  role: z.enum(["admin", "professor", "aluno"]).optional(),
  ativo: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  senhaAtual: z.string().min(1, "Senha atual obrigatória"),
  novaSenha: passwordSchema,
});

export function usersRouter(jwtSecret: string) {
  const router = Router();

  // Quem tá logado (pra testar token e pegar role/nome no front)
  router.get("/users/me", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const userId = req.user!.sub;

    const r = await pool.query<DbUserRow>(
      `SELECT id, usuario, nome, role, ativo, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (!r.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

    const u = r.rows[0];
    return res.json({
      id: u.id,
      usuario: u.usuario,
      nome: u.nome,
      role: u.role,
      ativo: u.ativo,
      createdAt: u.created_at,
    });
  });

  // Listar usuários (admin) ou professores (admin/professor)
  router.get(
    "/users",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const userRole = req.user!.role;
      const roleFilter = req.query.role as string | undefined;

      let query = `SELECT id, usuario, nome, role, ativo, created_at
         FROM users
         WHERE ativo = true`;

      // Se for professor, só pode ver professores (para atribuir turmas)
      if (userRole === "professor" && !roleFilter) {
        query += ` AND role = 'professor'`;
      }

      // Se solicitou filtro específico e é admin, aplica
      if (roleFilter && userRole === "admin") {
        query += ` AND role = $1`;
      } else if (roleFilter && userRole === "professor") {
        // Professor só pode ver professores, ignora outro filtro
        query += ` AND role = 'professor'`;
      }

      query += ` ORDER BY created_at DESC LIMIT 200`;

      const params = roleFilter && userRole === "admin" ? [roleFilter] : [];
      const r = await pool.query<DbUserRow>(query, params);

      return res.json(
        r.rows.map((u) => ({
          id: u.id,
          usuario: u.usuario,
          nome: u.nome,
          role: u.role,
          ativo: u.ativo,
          createdAt: u.created_at,
        }))
      );
    }
  );

  // Atualizar perfil do próprio usuário
  router.put("/users/me", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = req.user!.sub;
    const { nome } = parsed.data;

    const updated = await pool.query<DbUserRow>(
      `UPDATE users
       SET nome = $1
       WHERE id = $2
       RETURNING id, usuario, nome, role, ativo, created_at`,
      [nome.trim(), userId]
    );

    if (!updated.rowCount) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const u = updated.rows[0];
    return res.json({
      message: "Perfil atualizado com sucesso!",
      user: {
        id: u.id,
        usuario: u.usuario,
        nome: u.nome,
        role: u.role,
        ativo: u.ativo,
        createdAt: u.created_at,
      },
    });
  });

  // Alterar senha do próprio usuário
  router.put("/users/me/password", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = req.user!.sub;
    const { senhaAtual, novaSenha } = parsed.data;

    const result = await pool.query<{ senha_hash: string }>(
      `SELECT senha_hash FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const ok = await bcrypt.compare(senhaAtual, result.rows[0].senha_hash);
    if (!ok) {
      return res.status(401).json({ message: "Senha atual incorreta" });
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await pool.query(`UPDATE users SET senha_hash = $1 WHERE id = $2`, [senhaHash, userId]);

    return res.json({ message: "Senha alterada com sucesso!" });
  });

  // Criar usuário:
  // - admin pode criar admin/professor/aluno
  // - professor pode criar APENAS aluno (se tentar outro, força aluno)
  router.post(
    "/users",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { usuario, nome, senha } = parsed.data;

      const role: Role = (parsed.data.role ?? "aluno") as Role;

      const ativo = parsed.data.ativo ?? true;

      const senhaHash = await bcrypt.hash(senha, 10);

      try {
        const created = await pool.query<DbUserRow>(
          `INSERT INTO users (usuario, nome, senha_hash, role, ativo)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, usuario, nome, role, ativo, created_at`,
          [usuario.trim(), nome.trim(), senhaHash, role, ativo]
        );

        const u = created.rows[0];

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "create",
          entityType: "user",
          entityId: u.id,
          metadata: {
            usuario: u.usuario,
            nome: u.nome,
            role: u.role,
            ativo: u.ativo,
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.status(201).json({
          message: "Usuário criado com sucesso!",
          user: {
            id: u.id,
            usuario: u.usuario,
            nome: u.nome,
            role: u.role,
            ativo: u.ativo,
            createdAt: u.created_at,
          },
        });
      } catch (err: any) {
        // unique violation (usuario)
        if (err?.code === "23505") {
          return res.status(409).json({ message: "Usuário já existe" });
        }
        console.error(err);
        return res.status(500).json({ message: "Erro interno" });
      }
    }
  );

  // Atualizar usuário (admin)
  router.put(
    "/users/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const parsed = updateUserSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      try {
        const { nome, usuario, role, ativo } = parsed.data;

        // Construir query dinamicamente
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (nome !== undefined) {
          updates.push(`nome = $${paramIndex++}`);
          params.push(nome.trim());
        }

        if (usuario !== undefined) {
          updates.push(`usuario = $${paramIndex++}`);
          params.push(usuario.trim());
        }

        if (role !== undefined) {
          updates.push(`role = $${paramIndex++}`);
          params.push(role);
        }

        if (ativo !== undefined) {
          updates.push(`ativo = $${paramIndex++}`);
          params.push(ativo);
        }

        if (updates.length === 0) {
          return res
            .status(400)
            .json({ message: "Nenhum campo para atualizar" });
        }

        params.push(id);

        const updated = await pool.query<DbUserRow>(
          `UPDATE users
           SET ${updates.join(", ")}
           WHERE id = $${paramIndex}
           RETURNING id, usuario, nome, role, ativo, created_at`,
          params
        );

        if (!updated.rowCount) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const u = updated.rows[0];

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "update",
          entityType: "user",
          entityId: u.id,
          metadata: {
            updatedFields: Object.keys(parsed.data),
            usuario: u.usuario,
            nome: u.nome,
            role: u.role,
            ativo: u.ativo,
          },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.json({
          message: "Usuário atualizado com sucesso!",
          user: {
            id: u.id,
            usuario: u.usuario,
            nome: u.nome,
            role: u.role,
            ativo: u.ativo,
            createdAt: u.created_at,
          },
        });
      } catch (err: any) {
        // unique violation (usuario)
        if (err?.code === "23505") {
          return res.status(409).json({ message: "Usuário já existe" });
        }
        console.error(err);
        return res.status(500).json({ message: "Erro ao atualizar usuário" });
      }
    }
  );

  // Deletar usuário (admin)
  router.delete(
    "/users/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const { id } = req.params;

      try {
        // Não deixar deletar a si mesmo
        if (id === req.user!.sub) {
          return res.status(400).json({
            message: "Você não pode deletar sua própria conta",
          });
        }

        const deleted = await pool.query<DbUserRow>(
          `DELETE FROM users WHERE id = $1 RETURNING id`,
          [id]
        );

        if (!deleted.rowCount) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }

        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "delete",
          entityType: "user",
          entityId: id,
          metadata: { id },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.json({ message: "Usuário deletado com sucesso!" });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Erro ao deletar usuário" });
      }
    }
  );

  return router;
}
