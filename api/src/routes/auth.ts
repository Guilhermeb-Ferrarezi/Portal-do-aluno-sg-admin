import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db";

export type Role = "admin" | "professor" | "aluno";

type DbUserRow = {
  id: string;
  usuario: string;
  nome: string;
  senha_hash: string;
  role: Role;
  ativo: boolean;
};

const loginSchema = z.object({
  usuario: z.string().min(1, "Usuário obrigatório"),
  senha: z.string().min(1, "Senha obrigatória"),
});

export function authRouter(jwtSecret: string) {
  const router = Router();

  router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { usuario, senha } = parsed.data;

    try {
      console.log(" Tentativa de login:", usuario);
      const result = await pool.query<DbUserRow>(
        `SELECT id, usuario, nome, senha_hash, role, ativo
         FROM users
         WHERE LOWER(usuario) = LOWER($1)
         LIMIT 1`,
        [usuario]
      );

      const user = result.rows[0];
      if (!user || user.ativo === false) {
        console.log(" Usuário não encontrado ou inativo:", usuario);
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      console.log(" Usuário encontrado:", user.usuario);
      console.log(" Tipo de senha_hash:", typeof user.senha_hash);
      console.log(" Comprimento de senha_hash:", user.senha_hash?.length);

      // Validar que a senha_hash existe e não é vazia
      if (!user.senha_hash || user.senha_hash.trim() === "") {
        console.error("️ ERRO: Usuário sem senha_hash:", user.usuario);
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      const ok = await bcrypt.compare(senha, user.senha_hash);
      console.log(" Comparação bcrypt resultado:", ok);
      if (!ok) {
        console.log(" Senha incorreta para:", usuario);
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      console.log(" Login bem-sucedido:", usuario);

      const token = jwt.sign(
        { sub: user.id, usuario: user.usuario, role: user.role },
        jwtSecret,
        { expiresIn: "100y" }
      );

      return res.status(200).json({
        message: "Login realizado com sucesso!",
        token,
        user: {
          id: user.id,
          usuario: user.usuario,
          nome: user.nome,
          role: user.role,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erro interno" });
    }
  });

  return router;
}
