import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import multer from "multer";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { uploadToR2, deleteFromR2 } from "../utils/uploadR2";
import { logActivity } from "../utils/activityLog";
import { validateSafeImageFile } from "../utils/fileValidation";
import { verifyPassword } from "../utils/verifyPassword";

type UserRole = "aluno" | "professor" | "admin";
type NumericRole = 1 | 2 | 3;

type DbUserRow = {
  id: number;
  name: string;
  email: string;
  role: number;
  bio: string | null;
  profile_picture_url: string | null;
  cover_photo_url: string | null;
  created_at: string;
  last_seen_at?: string | null;
  is_online?: boolean;
};

const passwordSchema = z.string().min(6, "Senha muito curta");

const createUserSchema = z.object({
  usuario: z.string().min(3, "Usuário muito curto"),
  email: z.string().min(3, "E-mail inválido").optional(),
  nome: z.string().min(2, "Nome obrigatório"),
  senha: passwordSchema,
  role: z.enum(["admin", "professor", "aluno"]).optional(),
  adminPassword: z.string().min(1, "Senha do administrador obrigatória").optional(),
});

const updateMeSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório").optional(),
  bio: z.string().max(500, "Bio muito longa").optional(),
  profilePictureUrl: z.string().optional(),
  coverPictureUrl: z.string().optional(),
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
    const mime = (file.mimetype || "").toLowerCase().trim();
    if (mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg" || mime === "image/webp") {
      cb(null, true);
      return;
    }
    cb(new Error("Apenas imagens são permitidas"));
  },
});

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

function mapUserRow(u: DbUserRow) {
  return {
    id: String(u.id),
    usuario: u.email,
    email: u.email,
    nome: u.name,
    bio: u.bio,
    profilePictureUrl: u.profile_picture_url,
    coverPictureUrl: u.cover_photo_url,
    role: toRole(u.role),
    ativo: true,
    createdAt: u.created_at,
    lastSeenAt: u.last_seen_at ?? null,
    isOnline: u.is_online ?? false,
  };
}

export function usersRouter(jwtSecret: string) {
  const router = Router();

  router.get("/users/me", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const userId = Number(req.user!.sub);
    const r = await pool.query<DbUserRow>(
      `SELECT id, name, email, role, bio, profile_picture_url, cover_photo_url, created_at,
              last_seen_at,
              COALESCE(last_seen_at >= NOW() - INTERVAL '90 seconds', false) AS is_online
       FROM "user"
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (!r.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

    const u = r.rows[0];
    return res.json({
      id: String(u.id),
      usuario: u.email,
      email: u.email,
      nome: u.name,
      bio: u.bio,
      profilePictureUrl: u.profile_picture_url,
      coverPictureUrl: u.cover_photo_url,
      role: toRole(u.role),
      ativo: true,
      createdAt: u.created_at,
      lastSeenAt: u.last_seen_at ?? null,
      isOnline: u.is_online ?? false,
    });
  });

  router.get(
    "/users",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const roleFilter = req.query.role as UserRole | undefined;
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const hasPaginationInput = req.query.page !== undefined || req.query.limit !== undefined || req.query.q !== undefined;
      const pageRaw = Number(req.query.page ?? 1);
      const limitRaw = Number(req.query.limit ?? 20);
      const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
      const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;
      const offset = (page - 1) * limit;

      const params: unknown[] = [];
      const conditions: string[] = [];
      if (roleFilter === "admin" || roleFilter === "professor" || roleFilter === "aluno") {
        params.push(toNumericRole(roleFilter));
        conditions.push(`role = $${params.length}`);
      }
      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const mappedRows = (rows: DbUserRow[]) => rows.map(mapUserRow);

      if (!hasPaginationInput) {
        const r = await pool.query<DbUserRow>(
          `SELECT id, name, email, role, bio, profile_picture_url, cover_photo_url, created_at,
                  last_seen_at,
                  COALESCE(last_seen_at >= NOW() - INTERVAL '90 seconds', false) AS is_online
           FROM "user"
           ${where}
           ORDER BY created_at DESC
           LIMIT 200`,
          params
        );

        return res.json(mappedRows(r.rows));
      }

      const countQuery = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM "user"
         ${where}`,
        params
      );

      const listParams = [...params, limit, offset];

      const r = await pool.query<DbUserRow>(
        `SELECT id, name, email, role, bio, profile_picture_url, cover_photo_url, created_at,
                last_seen_at,
                COALESCE(last_seen_at >= NOW() - INTERVAL '90 seconds', false) AS is_online
         FROM "user"
         ${where}
         ORDER BY created_at DESC
         LIMIT $${listParams.length - 1}
         OFFSET $${listParams.length}`,
        listParams
      );

      const total = Number(countQuery.rows[0]?.total ?? "0");

      return res.json({
        items: mappedRows(r.rows),
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
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
    const current = await pool.query<{
      profile_picture_url: string | null;
      cover_photo_url: string | null;
    }>(
      `SELECT profile_picture_url, cover_photo_url FROM "user" WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!current.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

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
    if (parsed.data.coverPictureUrl !== undefined) {
      updates.push(`cover_photo_url = $${idx++}`);
      values.push(
        parsed.data.coverPictureUrl.trim() === ""
          ? null
          : parsed.data.coverPictureUrl.trim()
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
       RETURNING id, name, email, role, bio, profile_picture_url, cover_photo_url, created_at`,
      values
    );

    if (!updated.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

    const u = updated.rows[0];
    const oldProfilePicture = current.rows[0]?.profile_picture_url;
    const oldCoverPicture = current.rows[0]?.cover_photo_url;
    if (oldProfilePicture && oldProfilePicture !== u.profile_picture_url) {
      deleteFromR2(oldProfilePicture).catch(() => undefined);
    }
    if (oldCoverPicture && oldCoverPicture !== u.cover_photo_url) {
      deleteFromR2(oldCoverPicture).catch(() => undefined);
    }
    const pictureChanged = parsed.data.profilePictureUrl !== undefined;
    const pictureRemoved = pictureChanged && parsed.data.profilePictureUrl?.trim() === "";
    const action = pictureRemoved
      ? "profile_picture_remove"
      : pictureChanged
        ? "profile_picture_update"
        : "profile_update";

    logActivity({
      actor: { id: String(userId), role: req.user?.role ?? null },
      action,
      entityType: "user",
      entityId: String(u.id),
      metadata: {
        nome: parsed.data.nome !== undefined,
        bio: parsed.data.bio !== undefined,
        profilePictureUrl: parsed.data.profilePictureUrl !== undefined,
        coverPictureUrl: parsed.data.coverPictureUrl !== undefined,
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
      coverPictureUrl: u.cover_photo_url,
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

    logActivity({
      actor: { id: String(userId), role: req.user?.role ?? null },
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

        const now = new Date();
        const yyyy = now.getUTCFullYear();
        const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
        const safeImage = validateSafeImageFile(req.file);
        const pictureUrl = await uploadToR2(req.file, `users/profile/${yyyy}/${mm}`, {
          contentType: safeImage.contentType,
          extension: safeImage.extension,
        });

        const updated = await pool.query<DbUserRow>(
          `UPDATE "user"
           SET profile_picture_url = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING id, name, email, role, bio, profile_picture_url, cover_photo_url, created_at`,
          [pictureUrl, userId]
        );

        const oldPicture = current.rows[0]?.profile_picture_url;
        if (oldPicture && oldPicture !== pictureUrl) {
          deleteFromR2(oldPicture).catch(() => undefined);
        }

        const u = updated.rows[0];
        logActivity({
          actor: { id: String(userId), role: req.user?.role ?? null },
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
            coverPictureUrl: u.cover_photo_url,
            role: toRole(u.role),
            ativo: true,
            createdAt: u.created_at,
          },
        });
      } catch (error) {
        if (error instanceof Error && /imagem|tipo|formato|arquivo/i.test(error.message)) {
          return res.status(400).json({ message: error.message });
        }
        console.error(error);
        return res.status(500).json({ message: "Erro ao atualizar foto de perfil" });
      }
    }
  );

  router.post(
    "/users/me/cover-picture",
    authGuard(jwtSecret),
    profileUpload.single("file"),
    async (req: AuthRequest, res) => {
      try {
        const userId = Number(req.user!.sub);
        if (!req.file) {
          return res.status(400).json({ message: "Arquivo de imagem é obrigatório" });
        }

        const current = await pool.query<{ cover_photo_url: string | null }>(
          `SELECT cover_photo_url FROM "user" WHERE id = $1 LIMIT 1`,
          [userId]
        );

        if (!current.rowCount) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const now = new Date();
        const yyyy = now.getUTCFullYear();
        const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
        const safeImage = validateSafeImageFile(req.file);
        const coverUrl = await uploadToR2(req.file, `users/cover/${yyyy}/${mm}`, {
          contentType: safeImage.contentType,
          extension: safeImage.extension,
        });

        const updated = await pool.query<DbUserRow>(
          `UPDATE "user"
           SET cover_photo_url = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING id, name, email, role, bio, profile_picture_url, cover_photo_url, created_at`,
          [coverUrl, userId]
        );

        const oldCover = current.rows[0]?.cover_photo_url;
        if (oldCover && oldCover !== coverUrl) {
          deleteFromR2(oldCover).catch(() => undefined);
        }

        const u = updated.rows[0];
        logActivity({
          actor: { id: String(userId), role: req.user?.role ?? null },
          action: "profile_cover_upload",
          entityType: "user",
          entityId: String(u.id),
          metadata: { oldCoverExists: !!oldCover },
          req,
        }).catch((err) => console.error("activity log error:", err));

        return res.status(200).json({
          message: "Banner de perfil atualizado com sucesso!",
          coverPictureUrl: coverUrl,
          user: {
            id: String(u.id),
            usuario: u.email,
            email: u.email,
            nome: u.name,
            bio: u.bio,
            profilePictureUrl: u.profile_picture_url,
            coverPictureUrl: u.cover_photo_url,
            role: toRole(u.role),
            ativo: true,
            createdAt: u.created_at,
          },
        });
      } catch (error) {
        if (error instanceof Error && /imagem|tipo|formato|arquivo/i.test(error.message)) {
          return res.status(400).json({ message: error.message });
        }
        console.error(error);
        return res.status(500).json({ message: "Erro ao atualizar banner de perfil" });
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

    const { usuario, email, nome, senha, adminPassword } = parsed.data;
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
         RETURNING id, name, email, role, bio, profile_picture_url, cover_photo_url, created_at`,
        [nome.trim(), finalEmail, senhaHash, toNumericRole(role)]
      );

      const u = created.rows[0];
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
        action: "user_create",
        entityType: "user",
        entityId: String(u.id),
        metadata: { role: toRole(u.role) },
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
      coverPictureUrl: u.cover_photo_url,
          role: toRole(u.role),
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
         RETURNING id, name, email, role, bio, profile_picture_url, cover_photo_url, created_at`,
        params
      );

      if (!updated.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

      const u = updated.rows[0];
      logActivity({
        actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
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
      coverPictureUrl: u.cover_photo_url,
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
        const current = await pool.query<{
          profile_picture_url: string | null;
          cover_photo_url: string | null;
        }>(
          `SELECT profile_picture_url, cover_photo_url FROM "user" WHERE id = $1 LIMIT 1`,
          [id]
        );
        if (!current.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });

        const deleted = await pool.query<{ id: number }>(
          `DELETE FROM "user" WHERE id = $1 RETURNING id`,
          [id]
        );

        if (!deleted.rowCount) return res.status(404).json({ message: "Usuário não encontrado" });
        const oldProfilePicture = current.rows[0]?.profile_picture_url;
        const oldCoverPicture = current.rows[0]?.cover_photo_url;
        if (oldProfilePicture) deleteFromR2(oldProfilePicture).catch(() => undefined);
        if (oldCoverPicture) deleteFromR2(oldCoverPicture).catch(() => undefined);
        logActivity({
          actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
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






