import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import multer from "multer";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { uploadToR2, deleteFromR2 } from "../utils/uploadR2";
import { logActivity } from "../utils/activityLog";
import { getForcePasswordChange, setForcePasswordChange } from "../utils/userSecurityFlags";

type UserRole = "aluno" | "professor" | "admin";
type NumericRole = 1 | 2 | 3;

type DbUserRow = {
  id: number;
  name: string;
  email: string;
  role: number;
  bio: string | null;
  profile_picture_url: string | null;
  created_at: string;
};

const passwordSchema = z.string().min(6, "Senha muito curta");

const createUserSchema = z.object({
  usuario: z.string().min(3, "Usuário muito curto"),
  email: z.string().min(3, "E-mail inválido").optional(),
  nome: z.string().min(2, "Nome obrigatório"),
  senha: passwordSchema,
  role: z.enum(["admin", "professor", "aluno"]).optional(),
  adminPassword: z.string().min(1, "Senha do administrador obrigatória").optional(),
  forcePasswordChange: z.boolean().optional(),
});

const updateMeSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório").optional(),
  bio: z.string().max(500, "Bio muito longa").optional(),
  profilePictureUrl: z.string().optional(),
});

const updateUserSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório").optional(),
  usuario: z.string().min(3, "Usuário muito curto").optional(),
  email: z.string().min(3, "E-mail inválido").optional(),
  role: z.enum(["admin", "professor", "aluno"]).optional(),
});

const changePasswordSchema = z.object({
  senhaAtual: z.string().min(1, "Senha atual obrigatória"),
  novaSenha: passwordSchema,
});

const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Apenas imagens são permitidas"));
  },
});

function sha256Base64(value: string) {
  return crypto.createHash("sha256").update(value).digest("base64");
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function verifyPassword(inputPassword: string, storedHash: string) {
  const normalized = storedHash.trim();
  const normalizedBcrypt = normalized.replace(/^\$\$2([aby])\$\$/i, "$2$1$");

  if (
    normalizedBcrypt.startsWith("$2a$") ||
    normalizedBcrypt.startsWith("$2b$") ||
    normalizedBcrypt.startsWith("$2y$")
  ) {
    return bcrypt.compare(inputPassword, normalizedBcrypt);
  }

  const matchesBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
  if (matchesBase64 && normalized.length >= 43) {
    return sha256Base64(inputPassword) === normalized;
  }

  if (/^[A-Fa-f0-9]{64}$/.test(normalized)) {
    return sha256Hex(inputPassword) === normalized.toLowerCase();
  }

  return false;
}

function toNumericRole(role: UserRole): NumericRole {
  if (role === "aluno") return 1;
  if (role === "professor") return 2;
  return 3;
}

function toRole(role: number): UserRole {
  if (role === 1) return "aluno";
  if (role === 2) return "professor";
  return "admin";
}

export function usersRouter(jwtSecret: string) {
  const router = Router();

  router.get("/users/me", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const userId = Number(req.user!.sub);
    const r = await pool.query<DbUserRow>(
      `SELECT id, name, email, role, bio, profile_picture_url, created_at
       FROM "user"
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (!r.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

    const u = r.rows[0];
    const mustChangePassword = await getForcePasswordChange(u.id);
    return res.json({
      id: String(u.id),
      usuario: u.email,
      email: u.email,
      nome: u.name,
      bio: u.bio,
      profilePictureUrl: u.profile_picture_url,
      role: toRole(u.role),
      mustChangePassword,
      ativo: true,
      createdAt: u.created_at,
    });
  });

  router.get(
    "/users",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const roleFilter = req.query.role as UserRole | undefined;

      const params: unknown[] = [];
      let where = "";
      if (roleFilter === "admin" || roleFilter === "professor" || roleFilter === "aluno") {
        params.push(toNumericRole(roleFilter));
        where = "WHERE role = $1";
      }

      const r = await pool.query<DbUserRow>(
        `SELECT id, name, email, role, bio, profile_picture_url, created_at
         FROM "user"
         ${where}
         ORDER BY created_at DESC
         LIMIT 200`,
        params
      );

      return res.json(
        await Promise.all(
          r.rows.map(async (u) => ({
            id: String(u.id),
            usuario: u.email,
            email: u.email,
            nome: u.name,
            bio: u.bio,
            profilePictureUrl: u.profile_picture_url,
            role: toRole(u.role),
            mustChangePassword: await getForcePasswordChange(u.id),
            ativo: true,
            createdAt: u.created_at,
          }))
        )
      );
    }
  );

  router.put("/users/me", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = Number(req.user!.sub);
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (parsed.data.nome !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(parsed.data.nome.trim());
    }
    if (parsed.data.bio !== undefined) {
      updates.push(`bio = $${idx++}`);
      values.push(parsed.data.bio.trim() === "" ? null : parsed.data.bio.trim());
    }
    if (parsed.data.profilePictureUrl !== undefined) {
      updates.push(`profile_picture_url = $${idx++}`);
      values.push(
        parsed.data.profilePictureUrl.trim() === ""
          ? null
          : parsed.data.profilePictureUrl.trim()
      );
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    values.push(userId);
    const updated = await pool.query<DbUserRow>(
      `UPDATE "user"
       SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = $${idx}
       RETURNING id, name, email, role, bio, profile_picture_url, created_at`,
      values
    );

    if (!updated.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

    const u = updated.rows[0];
    const pictureChanged = parsed.data.profilePictureUrl !== undefined;
    const pictureRemoved = pictureChanged && parsed.data.profilePictureUrl?.trim() === "";
    const action = pictureRemoved
      ? "profile_picture_remove"
      : pictureChanged
        ? "profile_picture_update"
        : "profile_update";

    logActivity({
      actorId: String(userId),
      actorRole: req.user?.role ?? null,
      action,
      entityType: "user",
      entityId: String(u.id),
      metadata: {
        nome: parsed.data.nome !== undefined,
        bio: parsed.data.bio !== undefined,
        profilePictureUrl: parsed.data.profilePictureUrl !== undefined,
      },
      req,
    }).catch((err) => console.error("activity log error:", err));

    return res.json({
      message: "Perfil atualizado com sucesso!",
      user: {
        id: String(u.id),
        usuario: u.email,
        email: u.email,
        nome: u.name,
        bio: u.bio,
        profilePictureUrl: u.profile_picture_url,
        role: toRole(u.role),
        ativo: true,
        createdAt: u.created_at,
      },
    });
  });

  router.put("/users/me/password", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = Number(req.user!.sub);
    const result = await pool.query<{ password_hash: string }>(
      `SELECT password_hash FROM "user" WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (!result.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

    const ok = await verifyPassword(parsed.data.senhaAtual, result.rows[0].password_hash);
    if (!ok) return res.status(403).json({ message: "Senha atual incorreta" });

    const senhaHash = await bcrypt.hash(parsed.data.novaSenha, 10);
    await pool.query(`UPDATE "user" SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
      senhaHash,
      userId,
    ]);
    await setForcePasswordChange(userId, false);

    logActivity({
      actorId: String(userId),
      actorRole: req.user?.role ?? null,
      action: "password_change",
      entityType: "security",
      entityId: String(userId),
      req,
    }).catch((err) => console.error("activity log error:", err));

    return res.json({ message: "Senha alterada com sucesso!" });
  });

  router.post(
    "/users/me/profile-picture",
    authGuard(jwtSecret),
    profileUpload.single("file"),
    async (req: AuthRequest, res) => {
      try {
        const userId = Number(req.user!.sub);
        if (!req.file) {
          return res.status(400).json({ message: "Arquivo de imagem é obrigatório" });
        }

        const current = await pool.query<{ profile_picture_url: string | null }>(
          `SELECT profile_picture_url FROM "user" WHERE id = $1 LIMIT 1`,
          [userId]
        );

        if (!current.rowCount) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const pictureUrl = await uploadToR2(req.file, "profile-pictures");

        const updated = await pool.query<DbUserRow>(
          `UPDATE "user"
           SET profile_picture_url = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING id, name, email, role, bio, profile_picture_url, created_at`,
          [pictureUrl, userId]
        );

        const oldPicture = current.rows[0]?.profile_picture_url;
        if (oldPicture && oldPicture !== pictureUrl) {
          deleteFromR2(oldPicture).catch(() => undefined);
        }

        const u = updated.rows[0];
        logActivity({
          actorId: String(userId),
          actorRole: req.user?.role ?? null,
          action: "profile_picture_upload",
          entityType: "user",
          entityId: String(u.id),
          metadata: { oldPictureExists: !!oldPicture },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.status(200).json({
          message: "Foto de perfil atualizada com sucesso!",
          profilePictureUrl: pictureUrl,
          user: {
            id: String(u.id),
            usuario: u.email,
            email: u.email,
            nome: u.name,
            bio: u.bio,
            profilePictureUrl: u.profile_picture_url,
            role: toRole(u.role),
            ativo: true,
            createdAt: u.created_at,
          },
        });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao atualizar foto de perfil" });
      }
    }
  );

  router.post("/users", authGuard(jwtSecret), requireRole(["admin"]), async (req: AuthRequest, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { usuario, email, nome, senha, adminPassword, forcePasswordChange } = parsed.data;
    const finalEmail = (email ?? usuario).trim();
    const role = parsed.data.role ?? "aluno";

    if (role === "admin") {
      const actorId = Number(req.user?.sub);
      if (!Number.isInteger(actorId)) {
        return res.status(401).json({ message: "Sessão inválida" });
      }

      if (!adminPassword) {
        return res.status(400).json({ message: "Senha do administrador é obrigatória para criar outro admin" });
      }

      const actor = await pool.query<{ password_hash: string }>(
        `SELECT password_hash FROM "user" WHERE id = $1 LIMIT 1`,
        [actorId]
      );

      if (!actor.rowCount) {
        return res.status(401).json({ message: "Administrador não encontrado" });
      }

      const valid = await verifyPassword(adminPassword, actor.rows[0].password_hash);
      if (!valid) {
        return res.status(403).json({ message: "Senha do administrador inválida" });
      }
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    try {
      const created = await pool.query<DbUserRow>(
        `INSERT INTO "user" (name, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, name, email, role, bio, profile_picture_url, created_at`,
        [nome.trim(), finalEmail, senhaHash, toNumericRole(role)]
      );

      const u = created.rows[0];
      await setForcePasswordChange(u.id, !!forcePasswordChange);
      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "user_create",
        entityType: "user",
        entityId: String(u.id),
        metadata: { role: toRole(u.role), forcePasswordChange: !!forcePasswordChange },
        req,
      }).catch((error) => console.error("activity log error:", error));

      return res.status(201).json({
        message: "Usuário criado com sucesso!",
        user: {
          id: String(u.id),
          usuario: u.email,
          email: u.email,
          nome: u.name,
          bio: u.bio,
          profilePictureUrl: u.profile_picture_url,
          role: toRole(u.role),
          mustChangePassword: !!forcePasswordChange,
          ativo: true,
          createdAt: u.created_at,
        },
      });
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Usuário já existe" });
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  router.put("/users/:id", authGuard(jwtSecret), requireRole(["admin"]), async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "ID inválido" });

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (parsed.data.nome !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(parsed.data.nome.trim());
    }
    const nextEmail = parsed.data.email ?? parsed.data.usuario;
    if (nextEmail !== undefined) {
      updates.push(`email = $${idx++}`);
      params.push(nextEmail.trim());
    }
    if (parsed.data.role !== undefined) {
      updates.push(`role = $${idx++}`);
      params.push(toNumericRole(parsed.data.role));
    }

    if (!updates.length) return res.status(400).json({ message: "Nenhum campo para atualizar" });

    updates.push(`updated_at = NOW()`);
    params.push(id);

    try {
      const updated = await pool.query<DbUserRow>(
        `UPDATE "user"
         SET ${updates.join(", ")}
         WHERE id = $${idx}
         RETURNING id, name, email, role, bio, profile_picture_url, created_at`,
        params
      );

      if (!updated.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

      const u = updated.rows[0];
      logActivity({
        actorId: req.user?.sub ?? null,
        actorRole: req.user?.role ?? null,
        action: "user_update",
        entityType: "user",
        entityId: String(u.id),
        metadata: {
          nome: parsed.data.nome !== undefined,
          email: nextEmail !== undefined,
          role: parsed.data.role !== undefined,
        },
        req,
      }).catch((error) => console.error("activity log error:", error));

      return res.json({
        message: "Usuário atualizado com sucesso!",
        user: {
          id: String(u.id),
          usuario: u.email,
          email: u.email,
          nome: u.name,
          bio: u.bio,
          profilePictureUrl: u.profile_picture_url,
          role: toRole(u.role),
          ativo: true,
          createdAt: u.created_at,
        },
      });
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Usuário já existe" });
      console.error(err);
      return res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  router.delete(
    "/users/:id",
    authGuard(jwtSecret),
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "ID inválido" });

      if (String(id) === req.user!.sub) {
        return res.status(400).json({ message: "Você não pode deletar sua própria conta" });
      }

      try {
        const deleted = await pool.query<{ id: number }>(
          `DELETE FROM "user" WHERE id = $1 RETURNING id`,
          [id]
        );

        if (!deleted.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });
        logActivity({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: "user_delete",
          entityType: "user",
          entityId: String(id),
          req,
        }).catch((error) => console.error("activity log error:", error));
        return res.json({ message: "Usuário deletado com sucesso!" });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Erro ao deletar usuário" });
      }
    }
  );

  return router;
}
